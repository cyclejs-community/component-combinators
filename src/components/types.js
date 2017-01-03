import {
  either,
  isNil,
  T
} from "ramda"
import {
  isHashMap,
  isStrictRecord,
  isFunction,
  isString,
  isArrayOf,
  isObject,
  isEmptyArray
} from "../utils"

////////
// Types FSM
const isEventName = isString;
const isTransitionName = isString;
const isSinkName = isString;
const isState = isString;
// NOTE : cant check at this level type of arguments
//`Event :: Sources -> Settings -> Source EventData`
const isEvent = isFunction;
//`EventData :: * | Null`
const isEventData = T;
//`FSM_Model :: Object`
const isFsmModel = isObject;

// `EventGuard :: Model -> EventData -> Boolean`
const isEventGuard = isFunction;
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
const isTransEval = isStrictRecord({
  action_guard: isActionGuard,
  target_state: isState,
  model_update: isFunction
});

// `Transition :: Record {
//   event_guard :: EventGuard
//   action_request :: ActionRequest
//   transition_evaluation :: [TransEval]
// }`
const isTransition = isStrictRecord({
  event_guard: isEventGuard,
  action_request: either(isNil, isActionRequest),
  transition_evaluation: isArrayOf(isTransEval)
});

//`TransitionOptions :: Record {
//  origin_state :: State
//  event :: EventName
//  target_states :: [Transition]
//}`
const isTransitionOptions = isStrictRecord({
  origin_state: isState,
  event: isEventName,
  target_states: isArrayOf(isTransition)
});

// `StateEntryComponent :: FSM_Model -> Component`
const isStateEntryComponent = isFunction;
// `StateEntryComponents :: HashMap State StateEntryComponent`
export const isFsmEntryComponents = isHashMap(isState, isStateEntryComponent);

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
export const isFsmTransitions = isHashMap(isTransitionName, isTransitionOptions);
