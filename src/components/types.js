import { both, complement, cond, either, equals, isEmpty, T } from "ramda"
import {
  isArrayOf, isEmptyArray, isObject, isStrictRecord, isString
} from "../../contracts/src/index"

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
