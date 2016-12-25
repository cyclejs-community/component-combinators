// Patch library : https://github.com/Starcounter-Jack/JSON-Patch
import {
  map as mapR, reduce as reduceR, always, mapObjIndexed, uniq, flatten, values, find, equals, clone,
  keys, filter, pick, curry, defaultTo
} from 'ramda';
import * as Rx from "rx";
import * as jsonpatch from 'fast-json-patch';
import {
  EV_GUARD_NONE, ACTION_REQUEST_NONE, ACTION_GUARD_NONE, ZERO_DRIVER,
  EVENT_PREFIX, DRIVER_PREFIX, INIT_PREFIX, INIT_EVENT_NAME, AWAITING_EVENTS,
  AWAITING_RESPONSE, INIT_STATE
} from './properties'
// NOTE1 : dont use observe functionality for generating patches
// it uses JSON stringify which makes it impossible to have functions in the
// model object
// NOTE2 : patches are applied IN PLACE

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
/**
 * @typedef {String} AWAITING_EVENTS
 */
/**
 * @typedef {String} AWAITING_ACTION_RESPONSE
 */
/**
 * @typedef {AWAITING_EVENTS|AWAITING_ACTION_RESPONSE} InternalState
 */
/**
 * @typedef {{internal_state : InternalState, external_state : State, model : FSM_Model, current_event_data : EventData, current_action_request_driver : DriverName, sinks : Sinks}} FSM_State
 */
/**
 * @typedef {String} UserEventPrefix
 */
/**
 * @typedef {String} DriverEventPrefix
 */
/**
 * @typedef {Object.<EventName, EventData>} LabelledUserEvent
 */
/**
 * @typedef {Object.<DriverName, ActionResponse>} LabelledDriverEvent
 */
/**
 * @typedef {Object.<UserEventPrefix, LabelledUserEvent>} UserEvent
 */
/**
 * @typedef {Object.<DriverEventPrefix, LabelledDriverEvent>} DriverEvent
 */


let $ = Rx.Observable;

function removeZeroDriver(driverNameArray) {
  return filter(function removeZero(driverName) {
    return driverName != ZERO_DRIVER
  }, driverNameArray)
}

function prefixWith(prefix) {
  return function _prefixWith(obj) {
    return {[prefix]: obj}
  }
}

/**
 * @param {Object.<string, *>} fsmEvent
 * @returns {String}
 */
function getPrefix(fsmEvent) {
  return keys(fsmEvent)[0]
}

/**
 * NOTE : fsmEvent MUST only have one key
 * @param fsmEvent
 * @returns {UserEventPrefix|DriverEventPrefix}
 */
function getEventOrigin(fsmEvent) {
  return getPrefix(fsmEvent);
}

/**
 * NOTE : fsmEvent MUST only have one key
 * @param prefix
 * @param {UserEvent | DriverEvent} fsmEvent
 * @returns {LabelledUserEvent | LabelledDriverEvent}
 */
function getFsmEventValue(prefix, fsmEvent) {
  return fsmEvent[prefix]
}

/**
 *
 * @param {String} eventOrDriverName
 * @param {LabelledUserEvent|LabelledDriverEvent} fsmEventValue
 * @returns {EventData | ActionResponse}
 */
function getEventDataOrActionResponse(eventOrDriverName, fsmEventValue) {
  return fsmEventValue[eventOrDriverName]
}

/**
 *
 * @param fsmEvent
 * @returns {{fsmEventOrigin: (UserEventPrefix|DriverEventPrefix), fsmEventValue: (LabelledUserEvent|LabelledDriverEvent)}}
 */
function destructureFsmEvent(fsmEvent) {
  const prefix = getEventOrigin(fsmEvent);
  const fsmEventValue = getFsmEventValue(prefix, fsmEvent);

  return {
    fsmEventOrigin: prefix,
    fsmEventValue: fsmEventValue
  }
}

// Note that types do not match! TODO : fix that or duplicate functions :-(
/**
 *
 * @param fsmEventValue
 * @returns {{eventOrDriverName: String, eventDataOrActionResponse: (EventData|ActionResponse)}}
 */
function destructureFsmEventValue(fsmEventValue) {
  const eventOrDriverName = getPrefix(fsmEventValue);
  const eventDataOrActionResponse = getEventDataOrActionResponse(eventOrDriverName, fsmEventValue);

  return {
    eventOrDriverName: eventOrDriverName,
    eventDataOrActionResponse: eventDataOrActionResponse
  }
}

/**
 *
 * @param {Transitions} transitions
 * @returns {Object.<State, EventName[]>}
 */
function computeStateEventMap(transitions) {
  return reduceR(function (/*OUT*/accStateEventMap, transName) {
    const transOptions = transitions[transName];
    const {origin_state, event} = transOptions;
    accStateEventMap[origin_state] = accStateEventMap[origin_state] || [];
    accStateEventMap[origin_state].push(event);

    return accStateEventMap;
  }, {}, keys(transitions));
}

/**
 *
 * @param {Transitions} transitions
 * @returns {Object.<State, Object.<EventName, TransitionName>>}
 */
function computeStateEventToTransitionNameMap(transitions) {
  return reduceR(function (/*OUT*/acc, transName) {
    const transOptions = transitions[transName];
    const {origin_state, event} = transOptions;
    acc[origin_state] = acc[origin_state] || {};
    acc[origin_state][event] = transName;

    return acc;
  }, {}, keys(transitions));
}

/**
 * Returns the action request corresponding to the first guard satisfied, as
 * defined by the order of the target_states array
 * @param {Transitions} transitions
 * @param {String} transName
 * @param {FSM_Model} model
 * @param {EventData} eventData
 * @return {{ action_request : ActionRequest | Null, transition_evaluation, noGuardSatisfied : Boolean}}
 */
function computeTransition(transitions, transName, model, eventData) {
  const targetStates = transitions[transName].target_states;

  const foundSatisfiedGuard = find(function (transition) {
    /** @type {EventGuard} */
    const eventGuard = transition.event_guard;

    if (eventGuard == EV_GUARD_NONE) {
      return true
    }
    else {
      // EventGuard :: Model -> EventData -> Boolean
      return eventGuard(model, eventData)
    }
  }, targetStates);

  return foundSatisfiedGuard
    ? pick(['action_request', 'transition_evaluation'], foundSatisfiedGuard)
    : {action_request: null, transition_evaluation: null, noGuardSatisfied: true}
}

function isZeroActionRequest(actionRequest) {
  return !actionRequest || isZeroDriver(actionRequest.driver)
}

function isZeroDriver(driver) {
  return driver == ZERO_DRIVER
}

/**
 *
 * @param {FSM_Model} model
 * @param {UpdateOperation[]} modelUpdateOperations
 * @returns {FSM_Model}
 */
function applyUpdateOperations(/*OUT*/model, modelUpdateOperations) {
  jsonpatch.apply(model, modelUpdateOperations);
  return model;
}

export function makeFSM(events, transitions, entryComponents, fsmSettings) {
  // TODO : dont forget - clone initial model
  // TODO : dont forget - apply patch in place inside the fsm
  // TODO : but pass the model cloned THEN deep-frozen to any function who consumes it
  // function/event

  // 0. TODO : check signature deeply - I dont want to check for null all the time

  const {init_event_data, initial_model, sinkNames} = fsmSettings;

  // 0.1 Pre-process the state machine configuration
  const stateEventsMap = computeStateEventMap(transitions);
  const stateEventToTransitionNameMap = computeStateEventToTransitionNameMap(transitions);

  return function fsmComponent(sources, settings) {
    // 0. TODO : Merge settings somehow (precedence and merge to define) with fsmSettings
    //           init_event_data etc. could for instance be passed there instead of ahead

    // 1. Create array of events dealt with by the FSM
    // This will include :
    // - initial event
    // - events from `events` parameter
    // - action responses as found in `transitions`

    /** @type {Array.<Observable.<Object.<EventName, EventData>>>} */
    const eventsArray = values(mapObjIndexed(function labelEvents(event$, eventName, _) {
      return event$.map(prefixWith(eventName))
    }, events));

    /** @type {String|ZeroDriver[][]} */
    const driverNameArrays = values(mapObjIndexed(function getDriverName(transOptions, transName) {
      const {target_states} = transOptions;
      /** @type {Array.<String|ZeroDriver>} */
      const driverNames = mapR(function (transition) {
        const {action_request} = transition;
        const {driver} = action_request || {};

        return driver;
      }, target_states);

      return driverNames;
    }, transitions));

    /** @type {String[]} */
    const driverNameArray = removeZeroDriver(uniq(flatten(driverNameArrays)));
    /** @type {Array.<Observable.<Object.<SinkName, ActionResponse>>>} */
    const actionResponseObsArray = mapR(function getActionResponseObs(driverName) {
      return sources[driverName].map(prefixWith(driverName))
    }, driverNameArray);

    /** @type {Object.<EventName, EventData>} */
    const initialEvent = prefixWith(EVENT_PREFIX)(prefixWith(INIT_EVENT_NAME)(init_event_data));

    const fsmEvents = $.merge(
      $.merge(eventsArray).map(prefixWith(EVENT_PREFIX)),
      $.merge(actionResponseObsArray).map(prefixWith(DRIVER_PREFIX))
    )
      .startWith(initialEvent);

    // 1. Update the state of the state machine in function of the event
    // State machine state is represented by the following properties :
    // - internal_state : AWAITING_EVENTS | AWAITING_ACTION_RESPONSE
    // - external_state : State
    // - model : *
    // - current_event_data : EventData
    // - current_action_request_driver : DriverName

    /** @type {FSM_State}*/
    const initialFSM_State = {
      internal_state: AWAITING_EVENTS,
      external_state: INIT_STATE,
      model: clone(initial_model),
      current_event_data: null,
      current_action_request_driver: null
    };

    /** @type {Observable.<FSM_State>}*/
    let eventEvaluation$ = fsmEvents
        .scan(evaluateEvent, initialFSM_State)
      ;

    /** @type {Observable.<Object.<SinkName, Observable.<*>>>}*/
    let sinks$ = eventEvaluation$
      .filter(fsmState => fsmState.sinks)
      .tap(x => console.warn('fsmState', x))
      .shareReplay(1);

    /** @type {Object.<SinkName, Observable.<*>>}*/
    let outputSinks = reduceR(function computeOutputSinks(/* OUT */accOutputSinks, sinkName) {
      accOutputSinks[sinkName] = sinks$
        .map(fsmState => defaultTo($.never(), fsmState.sinks[sinkName]))
        .tap(x => console.warn(`sink ${sinkName}`, x))
        .switch()
        .tap(x => console.warn(`pot switch`, x))
      ;
      return accOutputSinks
    }, {}, sinkNames);

    return outputSinks

// TODO : use ramda currying to add events, transitions, entryComponents, fsmSettings to the
// signature and put the function outside of makeFSM
    /**
     *
     * @param {FSM_State} fsmState
     * @param {UserEvent | DriverEvent} fsmEvent
     * @returns {FSM_State}
     */
    function evaluateEvent(/* OUT */fsmState, fsmEvent) {
      let {
        internal_state, external_state, model, current_event_data, current_action_request_driver, sinks
      } = fsmState;

      /**
       * NOTE : fsmEvent MUST only have one key
       * TODO : add contract somewhere, maybe not here
       */
      const {fsmEventOrigin, fsmEventValue} = destructureFsmEvent(fsmEvent);
      const {eventOrDriverName, eventDataOrActionResponse} = destructureFsmEventValue(fsmEventValue);

      switch (internal_state) {
        case AWAITING_EVENTS :
          // If received DriverEvent
          // -- Log warning, Ignore, no state modification, sinks = Null
          // Else If received UserEvent
          // -- If userEvent is NOT among the configured events for the FSM's external state
          // -- -- Log warning, Ignore, no state modification (could also queue??), sinks = Null
          // -- Else If no guards is passed :
          // -- -- no state modification (could also queue??), sinks = Null
          // -- -- Else a guard is passed, get the action request from it :
          // -- -- -- If ActionRequest is Zero
          // -- -- -- -- no need to wait for a response, change the fsm state directly
          // -- -- -- -- check contract : action_guard MUST be Zero
          // -- -- -- -- internal_state <- AWAITING_EVENTS
          // -- -- -- -- current_event_data <- Null
          // -- -- -- -- current_action_request_driver <- Null
          // -- -- -- -- external_state <- target_state
          // -- -- -- -- model <- apply update operations
          // -- -- -- -- sinks <- execute the component defined as entry for the state transitioned to
          // -- -- -- Else :
          // -- -- -- -- sinks <- Compute action request (MUST be non empty object)
          // TODO : add case if action request = NONE - bypass and apply directly the operations
          // -- -- -- -- internal_state <- AWAITING_RESPONSE
          // -- -- -- -- current_event_data <- event_data
          // -- -- -- -- current_action_request_driver <- the ONE key of sinks
          // -- -- -- -- external_state, model <- unmodified
          switch (fsmEventOrigin) {
            case DRIVER_PREFIX :
              console.warn('Received event from driver while awaiting user events! Ignoring...');
              sinks = null;
              break;

            case EVENT_PREFIX :
              /** @type {EventName[]} */
              const configuredEvents = stateEventsMap[external_state];
              const eventName = eventOrDriverName;
              /** @type {EventData} */
              const eventData = eventDataOrActionResponse;

              if (!find(equals(eventName), configuredEvents)) {
                console.warn('Received event for which there is no transition defined!' +
                  ' Ignoring...');
                sinks = null;
              }
              else {
                // Compute action request triggered by event, if any
                const transName = stateEventToTransitionNameMap[external_state][eventName];

                /** @type {ActionRequest | Null} */
                const {action_request, transition_evaluation, noGuardSatisfied} =
                  computeTransition(transitions, transName, model, eventData);

                if (!!noGuardSatisfied) {
                  // no guards is satisfied
                  console.warn('Received event for which there is a transition defined but none' +
                    ' of the defined guards were satisfied!' +
                    ' Ignoring...');
                  sinks = null;
                }
                else {
                  if (isZeroActionRequest(action_request)) {
                    // TODO : check contract : only ONE action_guard which MUST be Zero
                    const {target_state, model_update} =  transition_evaluation[0];
                    const modelUpdateOperations = model_update(model, eventData, null);
                    const entryComponent = entryComponents[target_state];

                    // Set values for next FSM state update
                    external_state = target_state;
                    model = applyUpdateOperations(model, modelUpdateOperations);
                    // Note : The model to be passed to the entry component is post update
                    sinks = entryComponent(model)(sources, settings);
                    internal_state = AWAITING_EVENTS;
                    current_event_data = null;
                    current_action_request_driver = null;
                  }
                  else {
                    // TODO : what happens if sinks is empty object?? also MUST have only one key
                    sinks = action_request;
                    internal_state = AWAITING_RESPONSE;
                    current_event_data = eventData;
                    current_action_request_driver = getPrefix(sinks);
                    // model and external_state are unchanged
                  }
                }
              }

              // Update in place fsmState
              fsmState = {
                internal_state,
                external_state,
                model,
                current_event_data,
                current_action_request_driver,
                sinks
              };

              break;

            default :
              throw 'evaluateEvent > case AWAITING_EVENTS : unknown fsmEventOrigin!'
          }
          break;

        case AWAITING_RESPONSE :
          // If received UserEvent
          // -- Log warning, Ignore, no state modification, sinks = Null
          // Else If received DriverEvent
          // -- If driverEvent is NOT from the expected driver (as to current_action_request_driver)
          // -- -- Log warning, Ignore, no state modification (could also queue??), sinks = Null
          // -- Else If action response fails all action guards :
          // -- -- Log Error, THROW, sinks = Null
          // -- -- Else action response pass the first action guard
          // -- -- -- external_state <- as defined by the transition for the successful action guard
          // -- -- -- sinks <- execute the component defined as entry for the state transitioned to
          // ?? with which sources and settings??
          // -- -- -- update operations <- compute model update
          // -- -- -- model <- apply update operations
          // -- -- -- internal_state <- AWAITING_EVENTS
          // -- -- -- current_event_data <- Null
          // -- -- -- current_action_request_driver <- Null
          break;
        default :
          const err = 'Unexpected internal state reached by state machine !';
          console.error(err, clone(fsmState));
          throw err;
      }

      return fsmState
    }


  };

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
