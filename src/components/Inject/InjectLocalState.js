import { m } from "../m/m"
import { mapObjIndexed, map, set, view, omit, keys, pick, values, forEachObjIndexed } from 'ramda'
import {
  assertContract, isArray, isFunction, isHashMapE, isOptional, isRecordE, isString
} from "../../../contracts/src"
import { BEHAVIOUR_TYPE } from "../../../tracing/src/properties"
import Rx from "rx"
import { combinatorNameInSettings, reconstructComponentTree } from "../../../tracing/src/helpers"

const injectLocalStateSettingsError = `InjectLocalState : Invalid settings !`
const $ = Rx.Observable

const isInjectLocalStateSettings = isRecordE({
    behaviour : isOptional(isString),
    event : isOptional(isString)
  });

/**
 * @typedef {{behaviour : string, event : string}} InjectLocalStateSettings
 */
/**
 * Similar to drivers for the whole app. This allows to have an inner loop delimiting a scope
 * within which state sources are visible, and outside of which they can no longer be seen nor manipulated.
 * Note that this is limited to behaviours as of now, hence the name `injectLocalSTATE`.
 * @param {InjectLocalStateSettings} injectLocalStateSettings
 * @param {ComponentTree} componentTree
 * @constructor
 */
export function InjectCircularSources(injectLocalStateSettings, componentTree) {
  assertContract(isInjectLocalStateSettings, [injectLocalStateSettings], injectLocalStateSettingsError);

  /**
   * Algorithm :
   * 1. Create as many source subjects as state source configured in injectLocalStateSettings
   *    Those sources are initialized with the configured initial value
   * 2. Create the component with injected local state
   *    That component will output commands on the eponym state sink.
   * 3. Run that component, and get its sinks
   *    The eponym state sink MUST not be relayed upwards (visibility rules), so have to be erased from the sinks
   *    dictionary.
   *    Run the eponym state processing function and inject the result in the source subject
   *    ADR : We choose a default of asynchronous propagation of state changes. Synchronous propagations would favour
   *    glitch : supposing two behaviours change in the same tick (a0->a1, b0->b1) and `a` goes first, then the system
   *    will see `(a0,b0) -> (a1,b0) -> (a1,b1)` which we want to avoid. We want `(a0, b0) -> (a1, b1)`.
   *    To achieve this, we keep the `(a ,b)` in cache. We update them synchronously, but propagate the change
   *    (through the subject) asynchronously.
   *    TODO : write a test against that
   */

  // Create sources
  // Indices for state of sources
  const CURRENT_STATE_INDEX = 0;
  const IS_UPDATED_INDEX = 1;
  const SUBJECT_INDEX = 2;
  // Indices for sources settings
  const PROCESSING_FN_INDEX = 1;

  // TODO : if that works, refactor we don't need an array anymore, only subject index is used
  let sourcesState = map(initStateAndProcessingFn => {
    const [initialState, processingFn] = initStateAndProcessingFn;
    const isUpdated = false;

    return [initialState, isUpdated, new Rx.BehaviorSubject(initialState)]
    }, injectLocalStateSettings);

  function computeSinks(parentComponent, childrenComponents, sources, settings){
    const reducedSinks = m(
      {},
      set(combinatorNameInSettings, 'InjectLocalState|Inner', settings),
      reconstructComponentTree(parentComponent, childrenComponents)
    )(sources, settings);

    const reducedSinksWithoutStateSinks = omit(keys(sourcesState), reducedSinks);
    const reducedSinksWithOnlyStateSinks = pick(keys(sourcesState), reducedSinks);

    // Update source state
    // NOTE : we immediately sent the new value for the behaviour. We still ensure a glitch free behaviour as we
    // have forced the `Rx.Scheduler.async` on the subject. By the time the data change is propagated for one
    // subject, all injected subjects will have been updated.
    // TODO: to check with tests
    // NOTE : we do nothing for now with the disposables
    // TODO : merge all non state sinks so that when they complete, we run all the disposables, and complete all
    // subjects (with try catch for subject early disposal errors?). Or maybe no need? automatic GC?
    const reducedSinksWithStateUpdateDisposables = mapObjIndexed((sink, sinkName) => {
        return sink
          .do(sinkValue => {
            const processingFn = injectLocalStateSettings[sinkName][PROCESSING_FN_INDEX];
            const processedValue = processingFn(sinkValue);
            // TODO : add json patch here - but decide first and put it up if yes, if we force output to json patch
            sourcesState[sinkName][SUBJECT_INDEX].onNext(processedValue);
          })
          .subscribe(
            sinkValue => console.debug(`InjectLocalState : sinkValue!`, sinkValue),
            // This happens if an error is produced while computing state sinks. What to do?? For now, just logging
            // The idea is to not interrupt the program with an exception
            error => console.error(`InjectLocalState : error!`, error),
            completed => console.debug(`InjectLocalState : completed!`)
          )
    }, reducedSinksWithOnlyStateSinks);

    return reducedSinksWithoutStateSinks
  }

// Spec
  const injectlocalStateSpec = {
    // Propagate data changes on the next tick, after all configured local state sources have been updated
    // This means using the async scheduler from RXjs v4. Rx.Scheduler.currentThread might work too, but less clear how.
    makeLocalSources : _ => map(sourceInfo => sourceInfo[SUBJECT_INDEX].observeOn(Rx.Scheduler.async), sourcesState),
    computeSinks : computeSinks,
  };

  return m(injectlocalStateSpec, set(combinatorNameInSettings, 'InjectLocalState', {}), componentTree)

}

// TODO : change everything
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
