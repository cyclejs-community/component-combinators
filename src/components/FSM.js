// Patch library : https://github.com/Starcounter-Jack/JSON-Patch
import {map as mapR, reduce as reduceR, always, mapObjIndexed, uniq, flatten} from 'ramda';
// NOTE1 : dont use observe functionality for generating patches
// it uses JSON stringify which makes it impossible to have functions in the
// model object
// NOTE2 : patches are applied IN PLACE
import * as jsonpatch from 'fast-json-patch';

/**
 * @typedef {String} EventName
 */
/**
 * @typedef {SinkName} DriverName
 */
/**
 * @typedef {*} EventData
 */
/**
 * @typedef {String} State
 */
/**
 * @typedef {String} JSON_Pointer
 * albeit a string with a particular format
 * cf. https://tools.ietf.org/html/rfc6901
 * The ABNF syntax of a JSON Pointer is:
 *  json-pointer    = *( "/" reference-token )
 *  reference-token = *( unescaped / escaped )
 *  unescaped       = %x00-2E / %x30-7D / %x7F-10FFFF ; %x2F ('/') and %x7E ('~') are excluded from 'unescaped'
 *  escaped         = "~" ( "0" / "1" ) ; representing '~' and '/', respectively
 */
/**
 * @typedef {String} TransitionName
 */
/**
 * @typedef {Object.<EventName, Event>} Events
 */
/**
 * @typedef {function(Sources):EventData} Event
 */
/**
 * @typedef {*} FSM_Model
 */
/**
 * @typedef {*} Command
 */
/**
 * @typedef {*} Payload
 */
/**
 * @typedef {*} ActionResponse
 */
/**
 * @typedef {String} ZeroDriver
 */
/**
 * @typedef {{command : Command, payload : Payload}} Request
 */
/**
 * @typedef {function(FSM_Model, EventData):Request} RequestFn
 */
/**
 * @typedef {{driver : SinkName|ZeroDriver, request : RequestFn, }} ActionRequest
 */
/**
 * @typedef {function(FSM_Model, EventData) : Boolean} EventGuard
 */
/**
 * @typedef {function(ActionResponse) : Boolean} ActionGuard
 */
/**
 * @typedef {{op : "add", path : JSON_Pointer, value : *}} Op_Add
 */
/**
 * @typedef {{op : "replace", path : JSON_Pointer, value : *}} Op_Replace
 */
/**
 * @typedef {{op : "remove", path : JSON_Pointer}} Op_Remove
 */
/**
 * @typedef {{op : "move", from : JSON_Pointer, path : JSON_Pointer}} Op_Move
 */
/**
 * @typedef {{op : "copy", from : JSON_Pointer, path : JSON_Pointer}} Op_Copy
 */
/**
 * @typedef {{op : "copy", path : JSON_Pointer, value : *}} Op_Test
 */
/**
 * @typedef {Op_Add|Op_Remove|Op_Replace|Op_Move|Op_Copy|Op_Test} JSON_Patch
 */
/**
 * @typedef {JSON_Patch} UpdateOperation
 */
/**
 * @typedef {function(FSM_Model, EventData, ActionResponse) : UpdateOperation[]} UpdateFn
 */
/**
 * @typedef {{action_guard : ActionGuard, target_state : State, model_update : UpdateFn}} TransEval
 */
/**
 * @typedef {{event_guard : EventGuard, action_request : ActionRequest, transition_evaluation : TransEval[]}} Transition
 */
/**
 * @typedef {{origin_state : State, event : EventName, target_states : Transition[]}} TransitionOptions
 */
/**
 * @typedef {Object.<TransitionName, TransitionOptions>} Transitions
 */

export const EV_GUARD_NONE = null;
export const ACTION_REQUEST_NONE = null;
export const ACTION_GUARD_NONE = always(true);
export const ZERO_DRIVER = null;
export const [EVENT_PREFIX, DRIVER_PREFIX, INIT_PREFIX] = ['events', 'drivers', 'init'];
export const INIT_EVENT_NAME = 'init_event';

function removeZeroDriver(driverNameArray) {
  return filter(function removeZero(driverName) {
    return driverName != ZERO_DRIVER
  }, driverNameArray)
}

function prefixWith(prefix) {
  return function _prefixWith(obs) {
    return obs.map(_ => ({[prefix]: _}))
  }
}

function makeInitEventObs(fsmSettings) {
  const {init_event_data} = fsmSettings;

  return $.just(init_event_data)
}

export function makeFSM(events, transitions, entryComponents, fsmSettings) {
  // TODO : dont forget - clone initial model
  // TODO : dont forget - apply patch in place inside the fsm
  // TODO : but pass the model cloned THEN deep-frozen to any function who consumes it
  // function/event

  // 0. TODO : check signature deeply - I dont want to check for null all the time

  return function fsmComponent(sources, settings) {
    // 0. TODO : Merge settings somehow (precedence and merge to define) with fsmSettings

    // 1. Create array of events
    // This will include :
    // - initial event
    // - events from `events` parameter
    // - action responses as found in
    // Transitions.TransitionOptions.target_states[{action_request.driver}]
    // will be differentiated by an extra `type` property (EVENT | ACTION_RESPONSE)

    /** @type {Array.<Observable.<Object.<EventName, EventData>>>} */
    const eventsArray = mapObjIndexed(function labelEvents(event$, eventName, _) {
      return event$.map(prefixWith(eventName))
    }, events);

    /** @type {String|ZeroDriver[][]} */
    const driverNameArrays = mapObjIndexed(function getDriverName(transOptions, transName) {
      const {target_states} = transOptions;
      /** @type {String|ZeroDriver[]} */
      const driverNames = mapR(function (transition) {
        const {action_request} = transition;
        const {driver} = action_request;

        return driver;
      }, target_states);

      return driverNames;
    }, transitions);

    /** @type {String[]} */
    const driverNameArray = removeZeroDriver(uniq(flatten(driverNameArrays)));
    /** @type {Array.<Observable.<Object.<SinkName, ActionResponse>>>} */
    const actionResponseObsArray = mapR(function getActionResponseObs(driverName) {
      return sources[driverName].map(prefixWith(driverName))
    }, driverNameArray);

    /** @type {Observable.<Object.<EventName, EventData>>} */
    const initialEvent = makeInitEventObs(fsmSettings)
      .map(prefixWith(INIT_EVENT_NAME));

    const fsmEvents = $.merge(
      $.merge(eventsArray).map(prefixWith(EVENT_PREFIX)),
      $.merge(driverNameArray).map(prefixWith(DRIVER_PREFIX))
    )
      .startWith(initialEvent.map(prefixWith(EVENT_PREFIX)));

    // 1. Update the state of the state machine in function of the event
    //

  }

//  merge(labelledEvents.startWith(init))
//    .scan ((init, no pending, no action request, init model, orig. event data),
// (fsmInternalState, event) => {
//    if pending action :
//      if event not corresponding/expected action response (from label)
//    discard/maybe warning
//    else :
//    update internal model cf. transition success/error -MUST synchronous
//    log operations on model somewhere (external fsm driver??) - MAY async., MUST SUCCEED
//    set internal state to transition success/error target state
//    emit component configured in transition
//    else new action request :
//      if configured in transition
//        pending : YES, action request : targetDriver (label), state, model is same
//    orig event data = action request event data
//    emit : {targetDriver : ..} according to transition
//    else FATAL ERROR : must be configured in fsm
//  }).
//  switchMap({state, pending, action request, model, orig event data} => {
//    if pending :
//    emit : {targetDriver : ..} according to transition
//  else :
//    emit component configured in transition
//  })
//  !! this is a switch on component!!
//    means no more events are processed while executing actions (GOOD!)
//    - behaviours if processed with combineLatest keep their values (DOM)
//
}
