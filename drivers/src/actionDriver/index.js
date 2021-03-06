import { mapObjIndexed, tryCatch, values, isNil } from 'ramda';
import * as Rx from "rx"
import { assertContract, isError, isPromise } from "../../../contracts/src/index"
import { format } from "../../../utils/src/index"

const $ = Rx.Observable;

// Helper functions
function errorHandler(e, repository, context, params) {
  console.error('makeDomainActionDriver: an error occured', e);
  console.warn('extra info: repository, context, params', repository, context, params);

  return e;
}

function isDomainAction(action) {
  return Boolean(!(isNil(action) || isNil(action.context) || isNil(action.command)))
}

function eventEmitterFactory(_, context, __) {
  void _, context, __;

  return new Rx.Subject()
}

/**
 * Driver factory which takes a configuration object and returns a driver.
 * The returned driver will be handling action requests arriving on its input stream (sink) :
 * - the context and command parameters of the action request are matched to a action handler
 * function
 * - that function is executed on incoming input from the sink and additional useful values
 *   + repository : enclose API allowing to use a specific data repository
 *   + context : passed back for reference to the callback function
 * @param repository
 * @param config
 */
export function makeDomainActionDriver(repository, config) {
  // Create a subject for each context defined in config
  // TODO : unsubscribe flows to think about (when app is exited willingly or forcefully)
  const eventEmitters = mapObjIndexed(eventEmitterFactory, config);

  return function (sink$) {
    const source$ = sink$.map(function executeAction(action) {
      assertContract(isDomainAction, [action], `actionDriver > Invalid action ! Expecting {context:truthy, command : truthy, payload : any} ; received ${format(action)}`);
      console.info('DOMAIN ACTION | ', action);

      const { context, command, payload } = action;
      const fnToExec = config[context][command];
      const wrappedFn = tryCatch(fnToExec, errorHandler);
      const actionResult = wrappedFn(repository, context, payload);

      if (isPromise(actionResult)) {
        actionResult
          .then((result) => ({
            request: action,
            err: null,
            response: result
          }))
          .catch((e) => ({
            request: action,
            err: e,
            response: null
          }))
          .then((actionReponse) => {
            // NOTE : we emit out of the current function to avoid possible re-entry issues
            setTimeout(function () {eventEmitters[context].onNext(actionReponse);}, 0)
          })
      }
      else {
        // not a promise, hence synchronously returned value or exception from tryCatch
        if (isError(actionResult)) {
          setTimeout(function () {eventEmitters[context].onError(actionResult)}, 0)
        }
        else {
          setTimeout(function () {
            eventEmitters[context].onNext({
              request: action,
              err: null,
              response: actionResult
            })
          }, 0)
        }
      }
    });

    source$.subscribe(function (x) {console.log(`makeDomainActionDriver`, x)});

    // DOC : responseSource$ will emit responses for any of the action request
    //     : for use cases when one wants to filter per context, `getResponse` property is added
    //     : returns the subject from which one can listen for responses of a given context
    const responseSource$ = $.merge(values(eventEmitters));
    responseSource$.getResponse = function getResponse(context) {
      console.warn('getResponse', context);
      return eventEmitters[context]
    };

    return responseSource$;
  }
}
