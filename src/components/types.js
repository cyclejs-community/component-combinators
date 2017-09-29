import { both, complement, cond, either, isEmpty, T } from "ramda"
import { isFunction, isString } from "../utils"
import {
  isOpAdd, isOpCopy, isOpMove, isOpNone, isOpRemove, isOpReplace, isOpTest
} from "../../src/components/FSM/types"
import { isArrayOf, isEmptyArray } from "../../src/utils"

export const isNotEmpty = complement(isEmpty);
export const isComponent = isFunction;
export const isSettings = T;
// dont want to go through the trouble of typing this as it is notoriously shapeshifting
export function isEventName (x){
  return both(isString, isNotEmpty)(x);
}

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
