import { always} from 'ramda';

export const EV_GUARD_NONE = null;
export const AR_GUARD_NONE = null;
export const ACTION_REQUEST_NONE = null;
export const ACTION_GUARD_NONE = always(true);
export const ZERO_DRIVER = null;
export const [EVENT_PREFIX, DRIVER_PREFIX, INIT_PREFIX] = ['events', 'drivers', 'init'];
export const INIT_EVENT_NAME = 'init_event';
export const AWAITING_EVENTS = 'AWAITING_EVENTS';
export const AWAITING_RESPONSE = 'AWAITING_RESPONSE';
export const INIT_STATE = 'INIT';

// Error messages
export const CONTRACT_SATISFIED_GUARD_PER_ACTION_RESPONSE =
  `For each action response, there MUST be a configured guard which is satisfied!`;
export const CONTRACT_MODEL_UPDATE_FN_RETURN_VALUE =
  `Model update function must return valid update operations!`;
export const CONTRACT_EVENT_GUARD_FN_RETURN_VALUE =
  `Event guards functions must return a boolean!`;
export const CONTRACT_ACTION_GUARD_FN_RETURN_VALUE =
  `Action guards functions must return a boolean!`;
export const CONTRACT_EVENT_GUARD_CANNOT_FAIL =
  `Event guards functions cannot throw exceptions!`;
export const CONTRACT_ACTION_GUARD_CANNOT_FAIL =
  `Action guards functions cannot throw exceptions!`;
export const CONTRACT_MODEL_UPDATE_FN_CANNOT_FAIL =
  `Model update functions cannot throw exceptions!`;
