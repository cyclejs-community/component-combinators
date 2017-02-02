// Patch library : https://github.com/Starcounter-Jack/JSON-Patch
import {
  map as mapR, reduce as reduceR, mapObjIndexed, uniq, flatten, values, find, equals, clone, keys,
  filter, pick, curry, defaultTo, findIndex, allPass, pipe, both, isEmpty, all, either, isNil,
  tryCatch, T
} from "ramda"
import { checkSignature, assertContract, handleError, isBoolean } from "../utils"
import {
  isFsmSettings, isFsmEvents, isFsmTransitions, isFsmEntryComponents,
  checkTargetStatesDefinedInTransitionsMustBeMappedToComponent,
  checkOriginStatesDefinedInTransitionsMustBeMappedToComponent,
  checkEventDefinedInTransitionsMustBeMappedToEventFactory, checkIsObservable,
  checkStateEntryComponentFnMustReturnComponent, isArrayUpdateOperations
} from "./types"
import * as Rx from "rx"
import * as jsonpatch from "fast-json-patch"
import {
  EV_GUARD_NONE, ACTION_REQUEST_NONE, AR_GUARD_NONE, ZERO_DRIVER, EVENT_PREFIX, DRIVER_PREFIX,
  INIT_EVENT_NAME, AWAITING_EVENTS, AWAITING_RESPONSE, INIT_STATE,
  CONTRACT_SATISFIED_GUARD_PER_ACTION_RESPONSE, CONTRACT_MODEL_UPDATE_FN_RETURN_VALUE,
  CONTRACT_EVENT_GUARD_FN_RETURN_VALUE, CONTRACT_EVENT_GUARD_CANNOT_FAIL,
  CONTRACT_ACTION_GUARD_CANNOT_FAIL, CONTRACT_ACTION_GUARD_FN_RETURN_VALUE,
  CONTRACT_MODEL_UPDATE_FN_CANNOT_FAIL
} from "./properties"
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
 *  unescaped       = %x00-2E / %x30-7D / %x7F-10FFFF ; %x2F ('/') and %x7E ('~') are excluded from
 *   'unescaped' escaped         = "~" ( "0" / "1" ) ; representing '~' and '/', respectively
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
 * @typedef {{event_guard : EventGuard, action_request : ActionRequest, transition_evaluation :
 *   TransEval[]}} Transition
 */
/**
 * @typedef {{origin_state : State, event : EventName, target_states : Transition[]}}
 *   TransitionOptions
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
 * @typedef {{internal_state : InternalState, external_state : State, model : FSM_Model,
 *   current_event_name : EventName | Null, current_event_data : EventData | Null,
 *   current_event_guard_index : Number | Null, current_action_request_driver : DriverName | Null,
 *   sinks : Sinks | Null}} FSM_State
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
    return { [prefix]: obj }
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
  return getPrefix(fsmEvent)
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
 * @returns {{fsmEventOrigin: (UserEventPrefix|DriverEventPrefix), fsmEventValue:
 *   (LabelledUserEvent|LabelledDriverEvent)}}
 */
function destructureFsmEvent(fsmEvent) {
  const prefix = getEventOrigin(fsmEvent);
  const fsmEventValue = getFsmEventValue(prefix, fsmEvent);

  return {
    fsmEventOrigin: prefix,
    fsmEventValue: fsmEventValue
  }
}

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
    const { origin_state, event } = transOptions;
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
    const { origin_state, event } = transOptions;
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
 * @return {{ actionRequest : ActionRequest | Null, transitionEvaluation, satisfiedGuardIndex :
 *   Number | Null, noGuardSatisfied : Boolean}}
 */
function computeTransition(transitions, transName, model, eventData) {
  const NOT_FOUND = -1;
  const targetStates = transitions[transName].target_states;

  const satisfiedGuardIndex = findIndex(function (transition) {
    /** @type {EventGuard} */
    const eventGuard = transition.event_guard;

    if (eventGuard == EV_GUARD_NONE) {
      return true
    }
    else {
      // EventGuard :: Model -> EventData -> Boolean
      const wrappedEventGuard = tryCatch(eventGuard, handleError(CONTRACT_EVENT_GUARD_CANNOT_FAIL));
      const guardValue = wrappedEventGuard(model, eventData);
      assertContract(isBoolean, [guardValue],
        `computeTransition: ${CONTRACT_EVENT_GUARD_FN_RETURN_VALUE}`);

      return guardValue
    }
  }, targetStates);

  return satisfiedGuardIndex !== NOT_FOUND
    ? {
    satisfiedGuardIndex,
    actionRequest: targetStates[satisfiedGuardIndex].action_request,
    transitionEvaluation: targetStates[satisfiedGuardIndex].transition_evaluation,
    noGuardSatisfied: false
  }
    : {
    satisfiedGuardIndex: null,
    actionRequest: null,
    transitionEvaluation: null,
    noGuardSatisfied: true
  }
}

/**
 * Returns the action request corresponding to the first guard satisfied, as
 * defined by the order of the target_states array
 * @param {Transitions} transitions
 * @param {String} transName
 * @param {Number} current_event_guard_index
 * @param model
 * @param {ActionResponse} actionResponse
 * @return {{target_state: null, model_update: null, noGuardSatisfied: boolean}}
 */
function computeActionResponseTransition(transitions, transName, current_event_guard_index,
                                         model, actionResponse) {
  /** @type {Array} */
  const actionResponseGuards =
    transitions[transName].target_states[current_event_guard_index].transition_evaluation;

  const foundSatisfiedGuard = find(function (transEval) {
    const { action_guard, target_state, model_update }= transEval;

    if (action_guard == AR_GUARD_NONE) {
      // if no action guard is configured, it is equivalent to a passing guard
      return true
    }
    else {
      // ActionGuard :: ActionResponse -> Boolean
      const wrappedActionGuard = tryCatch(action_guard, handleError(CONTRACT_ACTION_GUARD_CANNOT_FAIL));
      const guardValue = wrappedActionGuard(model, actionResponse);
      assertContract(isBoolean, [guardValue],
        `computeTransition: ${CONTRACT_ACTION_GUARD_FN_RETURN_VALUE}`);

      return guardValue;
    }
  }, actionResponseGuards);

  return foundSatisfiedGuard
    ? pick(['target_state', 'model_update'], foundSatisfiedGuard)
    : { target_state: null, model_update: null, noGuardSatisfied: true }
}

function isZeroActionRequest(actionRequest) {
  return actionRequest == ACTION_REQUEST_NONE || isZeroDriver(actionRequest.driver)
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
  assertContract(isArrayUpdateOperations, [modelUpdateOperations],
    `applyUpdateOperations : ${CONTRACT_MODEL_UPDATE_FN_RETURN_VALUE}`);

  jsonpatch.apply(model, modelUpdateOperations);
  return model;
}

/**
 *
 * @param sources
 * @param settings
 * @param {Event} event$Fn Event factory function
 * @param {EventName} eventName
 * @returns {Observable}
 * @throws
 */
function _labelEvents(sources, settings, event$Fn, eventName, _) {
  const event$Fn$ = event$Fn(sources, settings);
  assertContract(checkIsObservable, [event$Fn$],
    `event factory function for event ${eventName} must return an observable!`);

  return event$Fn$.map(prefixWith(eventName))
}
const computeAndLabelEvents = curry(_labelEvents);

function getDriverNames(transOptions, transName) {
  const { target_states } = transOptions;
  /** @type {Array.<String|ZeroDriver>} */
  const driverNames = mapR(function (transition) {
    const { action_request } = transition;
    const { driver } = action_request || {};

    return driver;
  }, target_states);

  return driverNames;
}

export function makeFSM(events, transitions, entryComponents, fsmSettings) {
  const fsmSignature = {
    events: isFsmEvents,
    transitions: isFsmTransitions,
    entryComponents: isFsmEntryComponents,
    fsmSettings: isFsmSettings
  };
  const fsmSignatureErrorMessages = {
    events: '',
    transitions: 'Invalid value for transitions parameter : must be non-empty object and must' +
    ' have at least one transition defined which involves the INIT event!',
    entryComponents: 'Invalid value for entryComponents parameter : must be non-empty object!',
    fsmSettings: `Invalid settings : some parameters are mandatory - check documentation!`
  };
  assertContract(checkSignature, [
    { events, transitions, entryComponents, fsmSettings },
    fsmSignature,
    fsmSignatureErrorMessages
  ], '');
  assertContract(checkTargetStatesDefinedInTransitionsMustBeMappedToComponent, arguments,
    'makeFSM : Any target state which is referred to in the transitions parameter must be' +
    ' associated to a component via the entryComponents parameter!');
  assertContract(checkOriginStatesDefinedInTransitionsMustBeMappedToComponent, arguments,
    'makeFSM : Any origin state (except the initial state) which is referred to in the' +
    ' transitions parameter must be associated to a component via the entryComponents parameter!');
  assertContract(checkEventDefinedInTransitionsMustBeMappedToEventFactory, arguments,
    'makeFSM : Any event (except the initial event) which is referred to in the' +
    ' transitions parameter must be associated to a event factory function via the' +
    ' events parameter!');

  const { init_event_data, initial_model, sinkNames } = fsmSettings;

  // 0.1 Pre-process the state machine configuration
  const stateEventsMap = computeStateEventMap(transitions);
  const stateEventToTransitionNameMap = computeStateEventToTransitionNameMap(transitions);

  /**
   *
   * @param {FSM_State} fsmState
   * @param {UserEvent | DriverEvent} fsmEvent
   * @param events
   * @param transitions
   * @param entryComponents
   * @param sources
   * @param settings
   * @returns {FSM_State}
   */
  function _evaluateEvent(events, transitions, entryComponents, sources, settings,
                          /* OUT */fsmState, fsmEvent) {
    // NOTE : We clone the model to eliminate possible bugs coming from user-defined functions
    // inadvertently modifying the model
    let {
      internal_state, external_state, model, clonedModel,
      current_event_name, current_event_data, current_event_guard_index,
      current_action_request_driver, current_action_request, sinks
    } = fsmState;

    // NOTE : fsmEvent only has one key by construction
    const { fsmEventOrigin, fsmEventValue } = destructureFsmEvent(fsmEvent);
    const { eventOrDriverName, eventDataOrActionResponse } = destructureFsmEventValue(fsmEventValue);

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
              const { actionRequest, transitionEvaluation, satisfiedGuardIndex, noGuardSatisfied } =
                computeTransition(transitions, transName, clonedModel, eventData);

              if (!!noGuardSatisfied) {
                // no guards is satisfied
                console.warn('Received event for which there is a transition defined but none' +
                  ' of the defined guards were satisfied!' +
                  ' Ignoring...');
                sinks = null;
              }
              else {
                if (isZeroActionRequest(actionRequest)) {
                  // TODO : check contract : only ONE action_guard which MUST be Zero
                  const { target_state, model_update } =  transitionEvaluation[0];
                  // TODO : seek the second reference to it
                  const wrappedModelUpdate = tryCatch(model_update,
                    handleError(CONTRACT_MODEL_UPDATE_FN_CANNOT_FAIL));
                  const modelUpdateOperations = wrappedModelUpdate(clonedModel, eventData, null);
                  const entryComponent = entryComponents[target_state];

                  // Set values for next FSM state update
                  external_state = target_state;
                  model = applyUpdateOperations(model, modelUpdateOperations);
                  // NOTE: could also be applyUpdateOperations(clonedModel,...) dont know which
                  // is faster
                  clonedModel = clone(model);
                  // NOTE : The model to be passed to the entry component is post update
                  const stateEntryComponent = entryComponent ? entryComponent(clonedModel) : null;
                  assertContract(either(isNil, checkStateEntryComponentFnMustReturnComponent),
                    [stateEntryComponent],
                    `state entry component function ${entryComponent.name} 
                    for state ${target_state} MUST return a component or be null`
                  );

                  sinks = entryComponent ? entryComponent(clonedModel)(sources, settings) : {};
                  internal_state = AWAITING_EVENTS;
                  current_event_guard_index = null;
                  current_event_name = null;
                  current_event_data = null;
                  current_action_request_driver = null;
                  current_action_request = null;
                }
                else {
                  const { request, driver, sink } = computeSinkFromActionRequest(actionRequest, model, eventData);
                  sinks = sink;
                  internal_state = AWAITING_RESPONSE;
                  current_event_guard_index = satisfiedGuardIndex;
                  current_event_name = eventName;
                  current_event_data = eventData;
                  current_action_request_driver = driver;
                  current_action_request = request;
                  // model and external_state are unchanged
                }
              }
            }

            break;

          default :
            throw 'evaluateEvent > case AWAITING_EVENTS : unknown fsmEventOrigin!'
        }

        // Update in place fsmState
        fsmState = {
          internal_state,
          external_state,
          model,
          clonedModel,
          current_event_guard_index,
          current_event_name,
          current_event_data,
          current_action_request_driver,
          current_action_request,
          sinks
        };

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
        switch (fsmEventOrigin) {
          case EVENT_PREFIX :
            console.warn('Received event from user while awaiting driver\'s action response!' +
              ' Ignoring...');
            sinks = null;
            break;

          case DRIVER_PREFIX :
            const driverName = eventOrDriverName;
            const actionResponse = eventDataOrActionResponse;
            const { request } = actionResponse;
            const transName = stateEventToTransitionNameMap[external_state][current_event_name];

            if (driverName !== current_action_request_driver) {
              console.warn(`
              Received driver ${driverName}'s event but not from the expected 
                 ${current_action_request_driver} driver!\n
                 Ignoring...`);
              sinks = null;
            }
            else if (request != current_action_request || !equals(request, current_action_request)) {
              console.warn(`
              Received action response through driver ${driverName} and ignored it as that
                 response does not match the request sent...`);
              sinks = null;
              // TODO : document the fact that driver must return the request in the response
            }
            else {
              const { target_state, model_update, noGuardSatisfied } =
                computeActionResponseTransition(transitions, transName, current_event_guard_index,
                  model, actionResponse);

              if (noGuardSatisfied) {
                console.error(`While processing action response from driver ${driverName},
                 executed all configured guards and none were satisfied! 
                  ' Throwing...`);
                sinks = null;
                throw CONTRACT_SATISFIED_GUARD_PER_ACTION_RESPONSE
              }
              else {
                const wrappedModelUpdate = tryCatch(model_update,
                  handleError(CONTRACT_MODEL_UPDATE_FN_CANNOT_FAIL));
                const modelUpdateOperations = wrappedModelUpdate(model, current_event_data, actionResponse);
                const entryComponent = entryComponents[target_state];

                internal_state = AWAITING_EVENTS;
                external_state = target_state;
                // Set new model's values for next FSM state update
                model = applyUpdateOperations(/*OUT*/model, modelUpdateOperations);
                clonedModel = clone(model);
                // Note : The model to be passed to the entry component is post update
                sinks = entryComponent ? entryComponent(clonedModel)(sources, settings) : {};
                current_event_guard_index = null;
                current_event_name = null;
                current_event_data = null;
                current_action_request_driver = null;
                current_action_request = null;
              }
            }
            break;

          default :
            throw `Received unexpected/unknown ${fsmEventOrigin} event. 
            Can only process driver responses and user events!`
        }

        // Update in place fsmState
        fsmState = {
          internal_state,
          external_state,
          model,
          clonedModel,
          current_event_guard_index,
          current_event_name,
          current_event_data,
          current_action_request_driver,
          current_action_request,
          sinks
        };

        break;

      default :
        const err = 'Unexpected internal state reached by state machine !';
        console.error(err, clone(fsmState));
        throw err;
    }

    return fsmState
  }

  function _computeOutputSinks(sinks$, /* OUT */accOutputSinks, sinkName) {
    accOutputSinks[sinkName] = sinks$
      .map(fsmState => defaultTo($.empty(), fsmState.sinks[sinkName]))
      .switch()
      .tap(x =>
        console.warn(`post switch  ${sinkName}`, x));

    return accOutputSinks
  }

  const evaluateEvent = curry(_evaluateEvent);
  const computeOutputSinks = curry(_computeOutputSinks);

  return function fsmComponent(sources, settings) {
    // 0. TODO : Merge settings somehow (precedence and merge to define) with fsmSettings
    //           init_event_data etc. could for instance be passed there instead of ahead
    // 0.X TODO check remaining contracts
    // for instance : if an action request features a driver name, that driver name MUST be found
    // in the sources

    // 1. Create array of events dealt with by the FSM
    // This will include :
    // - initial event
    // - events from `events` parameter
    // - action responses as found in `transitions`
    /** @type {Array.<Observable.<Object.<EventName, EventData>>>} */
    const eventsArray = values(mapObjIndexed(computeAndLabelEvents(sources, settings), events));

    /** @type {String|ZeroDriver[][]} */
    const driverNameArrays = values(mapObjIndexed(getDriverNames, transitions));

    /** @type {String[]} */
    const driverNameArray = removeZeroDriver(uniq(flatten(driverNameArrays)));
    /** @type {Array.<Observable.<Object.<SinkName, ActionResponse>>>} */
    const actionResponseObsArray = mapR(function getActionResponseObs(driverName) {
      return sources[driverName].map(prefixWith(driverName))
    }, driverNameArray);

    /** @type {Object.<EventName, EventData>} */
    const initialEvent = pipe(prefixWith(INIT_EVENT_NAME), prefixWith(EVENT_PREFIX))(init_event_data);

    const fsmEvents = $.merge(
      $.merge(eventsArray).map(prefixWith(EVENT_PREFIX)).tap(x => console.warn('user event', x)),
      $.merge(actionResponseObsArray).map(prefixWith(DRIVER_PREFIX)).tap(
        x => console.warn('response event', x)),
    )
      .startWith(initialEvent);

    // 2. Update the state of the state machine in function of the event
    // State machine state is represented by the following properties :
    // - internal_state : AWAITING_EVENTS | AWAITING_ACTION_RESPONSE
    // - external_state : State
    // - model : *
    // - current_event_data : EventData
    // - current_action_request_driver : DriverName

    /** @type {FSM_State}*/
    const clonedInitialModel = clone(initial_model);
    const initialFSM_State = {
      internal_state: AWAITING_EVENTS,
      external_state: INIT_STATE,
      model: clonedInitialModel,
      clonedModel: clonedInitialModel,
      current_event_name: null,
      current_event_data: null,
      current_event_guard_index: null,
      current_action_request_driver: null,
      current_action_request: null,
      sinks: null
    };

    /** @type {Observable.<FSM_State>}*/
    let eventEvaluation$ = fsmEvents
      .tap(x =>
        console.warn('fsm events', x))
      .scan(
        evaluateEvent(events, transitions, entryComponents, sources, settings),
        initialFSM_State
      );

    // 3. Pass output sinks onto the driver
    // Important! `shareReplay` is necessary here because of varying subscription timing
    // occurring inside a `switch` (i.e. subscriptions are delayed)
    /** @type {Observable.<Object.<SinkName, Observable.<*>>>}*/
    let sinks$ = eventEvaluation$
      .filter(fsmState => fsmState.sinks)
      .tap(x => console.warn('sinks', x.sinks))
      .shareReplay(1);

    /** @type {Object.<SinkName, Observable.<*>>}*/
    let outputSinks = reduceR(computeOutputSinks(sinks$), {}, sinkNames);

    return outputSinks
  };
}

function computeSinkFromActionRequest(actionRequest, model, eventData) {
  const request = actionRequest.request(model, eventData);
  const driver = actionRequest.driver;

  return {
    request: request,
    driver: driver,
    sink: { [driver]: $.just(request) }
  }
}


