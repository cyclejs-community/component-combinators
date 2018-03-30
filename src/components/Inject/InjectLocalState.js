import { m } from "../m/m"
import { tryCatch, map, set, omit, pick, complement, isNil, clone } from 'ramda'
import {
  assertContract, isArray, isFunction, isHashMapE, isOptional, isRecordE, isString
} from "../../../contracts/src"
import * as jsonpatch from "fast-json-patch"
import { BEHAVIOUR_TYPE, EVENT_TYPE } from "../../../tracing/src/properties"
import Rx from "rx"
import { combinatorNameInSettings, reconstructComponentTree } from "../../../tracing/src/helpers"
import { isArrayUpdateOperations } from "../types"

const $ = Rx.Observable
const injectLocalStateSettingsError = `InjectLocalState : Invalid settings !`
const isInjectLocalStateSettings = isRecordE({
    behaviour : isOptional(isRecordE({0:isString, 1:complement(isNil)})),
    event : isOptional(isRecordE([isString, isFunction]))
  });

/**
 * @typedef {{behaviour : [string, *], event : [string, Function]}} InjectLocalStateSettings
 */
/**
 * Similar to drivers for the whole app. This allows to have an inner loop delimiting a scope
 * within which sources are visible, and outside of which they can no longer be seen nor manipulated.
 * For behaviour sources, note that it is recommended to SAMPLE them rather than combineLatest them
 * @param {InjectLocalStateSettings} injectLocalStateSettings
 * @param {ComponentTree} componentTree
 */
export function InjectCircularSources(injectLocalStateSettings, componentTree) {
  assertContract(isInjectLocalStateSettings, [injectLocalStateSettings], injectLocalStateSettingsError);

  const behaviourSourceName = injectLocalStateSettings.behaviour[0];
  const initialState = injectLocalStateSettings.behaviour[1];
  const behaviourSource = new Rx.BehaviorSubject(initialState);
  const behaviourCache = clone(initialState);

  const eventSourceName = injectLocalStateSettings.event[0];
  // @type function(Command) : Rx.Observable*/
  const processingFn = injectLocalStateSettings.event[1];
  const eventSource = new Rx.Subject();
  eventSource.type = EVENT_TYPE;
  behaviourSource.type = BEHAVIOUR_TYPE;

  function computeSinks(parentComponent, childrenComponents, sources, settings){
    const reducedSinks = m(
      {},
      set(combinatorNameInSettings, 'InjectLocalState|Inner', settings),
      reconstructComponentTree(parentComponent, childrenComponents)
    )(sources, settings);

    const reducedSinksWithoutCircularSinks = omit([behaviourSourceName, eventSourceName], reducedSinks);
    const reducedSinksWithOnlyCircularSinks = pick([behaviourSourceName, eventSourceName], reducedSinks);

    // Process behaviour source commands (JSON Patch)
    const behaviourSink = reducedSinks[behaviourSourceName];
    behaviourSink.subscribe(
      patchCommands => {
        // NOTE : IN-PLACE update!!
        assertContract(isArrayUpdateOperations, [patchCommands], `InjectCircularSources > computeSinks > behaviourSink : must emit an array of json patch commands!`);
        jsonpatch.apply(behaviourCache, patchCommands);
        behaviourSource.onNext(behaviourCache)
      },
      // This happens if an error is produced while computing state sinks. What to do?? For now, just logging
      // The idea is to not interrupt the program with an exception, so we don't pass the error on the subject
      // TODO : think over strategies for error handling
      error => console.error(`InjectCircularSources/behaviour : error!`, error),
      completed => {
        console.debug(`InjectCircularSources/behaviour : completed!`);
        behaviourSource.onCompleted();
      }
    );

    const eventSink = reducedSinks[eventSourceName];
    eventSink.subscribe(
      command => {
        // NOTE : there are three possibilities for error :
        // 1. processingFn throws : that is handled by processingFnErrorHandler which throws back the error
        // 2. processingFn passes an error **notification** on its output stream : that is passed to the event source,
        // which will not admit any further notification, i.e. the error notification is final
        // 3. processingFn passes an error **code** through its output stream : the actual format for this error
        // code will be specific to the function at hand. For instance, if processingFn is an HTTP request handler,
        // it can choose to pass HTTP errors through a specific channel, emitting {error : httpCode}. The format of
        // the response is also left unspecified. We however think it is a good idea to include the request with the
        // response for matching purposes.
        const labelledEventResponse$ = tryCatch(processingFn, processingFnErrorHandler)(command);
        labelledEventResponse$.subscribe(eventSource);
      },
      // This happens if an error is produced while computing the command to execute.
      // What to do?? For now, just logging. The idea is to not interrupt the program with an exception
      // Passing an error through onError on the subject will stop the subject and no more messages will be sent by it!
      // TODO : think over strategies for error handling
      error => console.error(`InjectCircularSources/event : error!`, error),
      completed => {
        console.debug(`InjectCircularSources/event : completed!`);
        eventSource.onCompleted();
      }
    );

    return reducedSinksWithoutCircularSinks
  }

// Spec
  const injectlocalStateSpec = {
    // Propagate data changes on the next tick, after all configured local state sources have been updated
    // This means using the async scheduler from RXjs v4. Rx.Scheduler.currentThread might work too, but less clear how.
    makeLocalSources : _ => ({[eventSourceName] : eventSource, [behaviourSourceName] : behaviourSource}),
    computeSinks : computeSinks,
  };

  return m(injectlocalStateSpec, set(combinatorNameInSettings, 'InjectLocalState', {}), componentTree)
}

/**
 * An error while processing the command to execute is considered a fatal error. It is the onus of the processing
 * function to handle any recoverable error at its level.
 * @param {Error} err
 * @param {Command} command
 */
function processingFnErrorHandler(err, command){
  console.error(`InjectCircularSources > computeSinks > behaviourSink > processingFn : error (${err}) raised while processing command`, command);
  throw err
}

// TODO : DOC
// InjectCircularSources({behaviour : nameString, event : nameString})
// - inject sources[nameString] in the component tree
// - behaviour will issue json patch commands on eponym sinks
// - event will receive events labelled with the event source first, i.e. :: Event<Label, *>
// - the receive events on sink will be passed up as responses thourhg the event source.
// - event and behaviour do not go up the tree
// - behaviour MUST be initialized
// - typing info set on both observable (cf. default trace functions) (obj.type, BEHAVIOUR_TYPE, EVENT_TYPE)
//   - that way, no tracing config. is necessary for each behaviour/event...
//   - TODO : test it!
// ADRs :
// we have one behaviour because several behaviours are reducible to one b : {b1, b2} eq. to (b1,b2)
// We have JSON patch as update to better trace modifications, and also allow differential update, and to ensure no
// destructive update
// We have single event source because ...well by solidarity with the behaviour and because we can. Several events
// can be mixed in one event source by prefixing (multiplexing basically)
// ACHTUNG
// The behaviour should be SAMPLED, not combined, to avoid glitches, i.e. multiple non-atomic updates.
