import {
  either, isNil, allPass, complement, isEmpty, where, pipe, values, any, propEq, tap, both, flatten,
  map, prop, flip, all, identity, filter, equals, cond, T
} from "ramda"
import {
  isHashMap, isStrictRecord, isFunction, isString, isArrayOf, isObject, isEmptyArray, isBoolean
} from "../utils"
import { INIT_EVENT_NAME, INIT_STATE } from "./properties"

////////
// Types FSM
const isComponent = isFunction;
const isNotEmpty = complement(isEmpty);
const isEventName = both(isString, isNotEmpty);
const isTransitionName = both(isString, isNotEmpty);
const isSinkName = both(isString, isNotEmpty);
const isState = both(isString, isNotEmpty);
// NOTE : cant check at this level type of arguments
//`Event :: Sources -> Settings -> Source EventData`
const isEvent = isFunction;
//`EventData :: * | Null`
const isEventData = T;
//`FSM_Model :: Object`
const isFsmModel = isObject;

// `EventGuard :: Model -> EventData -> Boolean`
const isEventGuard = either(isNil, isFunction);
// `ActionRequest :: Record {
//   driver :: SinkName | Null
//   request :: (FSM_Model -> EventData) -> Request | Null
// } | Null`
const isActionRequest = isStrictRecord({
  driver: either(isNil, isSinkName),
  request: either(isNil, isFunction)
});

// `ActionGuard :: ActionResponse -> Boolean`
const isActionGuard = isFunction;

// `TransEval :: Record {
//   action_guard :: ActionGuard
//   target_state :: State
//   model_update :: FSM_Model -> EventData -> ActionResponse -> [UpdateOperation]
// }`
const isModelUpdate = isFunction;
const isTransEval = isStrictRecord({
  action_guard: isActionGuard,
  target_state: isState,
  model_update: isFunction
});

// `Transition :: Record {
//   event_guard :: EventGuard
//   action_request :: ActionRequest
//   re_entry :: Boolean | Null
//   transition_evaluation :: [TransEval]
// }`
const isTransition = isStrictRecord({
  event_guard: isEventGuard,
  re_entry: either(isNil, isBoolean),
  action_request: either(isNil, isActionRequest),
  transition_evaluation: isArrayOf(isTransEval),
});

//`TransitionOptions :: Record {
//  origin_state :: State
//  event :: EventName
//  target_states :: [Transition]
//}`
const isTransitionOptions = isStrictRecord({
  origin_state: isState,
  event: isEventName,
  target_states: both(isArrayOf(isTransition), isNotEmpty)
});

// `StateEntryComponent :: FSM_Model -> Component`
const isStateEntryComponent = isFunction;
// `StateEntryComponents :: HashMap State StateEntryComponent`
export const isFsmEntryComponents = both(isHashMap(isState, isStateEntryComponent), isNotEmpty);

// FSM_Settings :: Record {
//   initial_model :: FSM_Model
//   init_event_data :: Event_Data
//   sinkNames :: [SinkName]
// }`
export const isFsmSettings = isStrictRecord({
  initial_model: isFsmModel,
  init_event_data: isEventData,
  sinkNames: either(isEmptyArray, isArrayOf(isSinkName))
});

// `Events :: (HashMap EventName Event) | {}`
export const isFsmEvents = isHashMap(isEventName, isEvent);
export const isFsmTransitions = allPass([
  isHashMap(isTransitionName, isTransitionOptions),
  complement(isEmpty),
  pipe(values, any(propEq('event', INIT_EVENT_NAME)))
]);

export function checkTargetStatesDefinedInTransitionsMustBeMappedToComponent(events, transitions,
                                                                             entryComponents,
                                                                             fsmSettings) {
  return pipe(
    values, map(prop('target_states')), flatten,
    map(prop('transition_evaluation')), flatten,
    map(prop('target_state')),
    map(flip(prop)(entryComponents)),
    all(identity))
  (transitions);
}

export function checkOriginStatesDefinedInTransitionsMustBeMappedToComponent(events, transitions,
                                                                             entryComponents,
                                                                             fsmSettings) {
  return pipe(
    values, map(prop('origin_state')),
    filter(complement(equals(INIT_STATE))),
    map(flip(prop)(entryComponents)),
    all(identity))
  (transitions);
}

export function checkEventDefinedInTransitionsMustBeMappedToEventFactory(events, transitions,
                                                                         entryComponents,
                                                                         fsmSettings) {
  const check = pipe(
    values, map(prop('event')),
    filter(complement(equals(INIT_EVENT_NAME))),
    map(flip(prop)(events)),
    all(identity))
  (transitions);

  return check;
}

export function checkIsObservable(obj) {
  return !!obj.subscribe
}

// `JSON_Patch :: Op_Add | Op_Remove | Op_Replace | Op_Move | Op_Copy | Op_Test | Op_None`
// `Op_Add :: Record { op: "add", path: JSON_Pointer, value : *}`
// `Op_Remove :: Record { op: "remove", path: JSON_Pointer}`
// `Op_Replace :: Record { op: "replace", path: JSON_Pointer, value: *}`
// `Op_Move :: Record { op: "move", from: JSON_Pointer, path: JSON_Pointer}`
// `Op_Copy :: Record { op: "copy", from: JSON_Pointer, path: JSON_Pointer}`
// `Op_Test :: Record { op: "test", path: JSON_Pointer, value: *}`
// `Op_None :: {} | Null`

export const isJsonPointer = isString;
export const isOpNone = both(isObject, isEmpty);
export const isOpAdd = isStrictRecord({
  op: both(isString, equals('add')),
  path: isJsonPointer,
  value: T
});
export const isOpRemove = isStrictRecord({
  op: both(isString, equals('remove')),
  path: isJsonPointer,
});
export const isOpReplace = isStrictRecord({
  op: both(isString, equals('replace')),
  path: isJsonPointer,
  value: T
});
export const isOpMove = isStrictRecord({
  op: both(isString, equals('move')),
  path: isJsonPointer,
});
export const isOpCopy = isStrictRecord({
  op: both(isString, equals('copy')),
  path: isJsonPointer,
});
export const isOpTest = isStrictRecord({
  op: both(isString, equals('test')),
  path: isJsonPointer,
  value: T
});
// Works but evaluates all the functions...
// export const isUpdateOperation = converge(any(identity), isOpAdd, isOpRemove, isOpReplace,
// isOpMove, isOpCopy, isOpTest, isOpNone)
export const isUpdateOperation = cond([
  [isOpNone, T],
  [isOpAdd, T],
  [isOpRemove, T],
  [isOpReplace, T],
  [isOpMove, T],
  [isOpCopy, T],
  [isOpTest, T],
]);
export const isArrayUpdateOperations = either(isEmptyArray, isArrayOf(isUpdateOperation));

export const checkStateEntryComponentFnMustReturnComponent = isComponent;

export const isEntryComponentFactory = either(isNil, isFunction);
export const isEntryComponent = either(isNil, isFunction);

export const isDefaultActionResponseHandlerConfig = isStrictRecord({
  success: isStrictRecord({ target_state: isState, model_update: isModelUpdate }),
  error: isStrictRecord({ target_state: isState, model_update: isModelUpdate }),
});
