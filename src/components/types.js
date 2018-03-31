import { both, complement, cond, either, equals, isEmpty, T, lens, set, view, prop, assoc } from "ramda"
import { isArrayOf, isEmptyArray, isObject, isStrictRecord, isString } from "../../contracts/src/index"

export const isNotEmpty = complement(isEmpty);
export const isSettings = T;

// dont want to go through the trouble of typing this as it is notoriously shapeshifting
export function isEventName(x) {
  return both(isString, isNotEmpty)(x);
}

// Works but evaluates all the functions...
// export const isUpdateOperation = converge(any(identity), isOpAdd, isOpRemove, isOpReplace,
// isOpMove, isOpCopy, isOpTest, isOpNone)
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

export function markAsEvent(obs) {
  set(observableTypeLens, EVENT_TYPE, obs);

  return obs
}

export const BEHAVIOUR_TYPE = 'B';
export const EVENT_TYPE = 'E';
export const observableTypeLens = lens(
  x => x.type,
  (val, x) => (x.type = val, x)
);

export function markAsBehavior(obs) {
  set(observableTypeLens, BEHAVIOUR_TYPE, obs);

  return obs
}

export function getTypeOfObs(obs) {
  return obs && view(observableTypeLens, obs)
}

export function isBehaviourSource(source) {
  return getTypeOfObs(source) === BEHAVIOUR_TYPE
}

export function isBehaviourSink(sink) {
  return Boolean(sink && isBehaviourSource(sink))
}

export function isEventSource(source) {
  return getTypeOfObs(source) === EVENT_TYPE
}

export function isEventSink(sink) {
  return Boolean(sink && isEventSource(sink))
}

