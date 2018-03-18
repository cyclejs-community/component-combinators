import { isBoolean, isFunction, isHashMap, isOptional, isStrictRecordE, isString } from "../../contracts/src"
import { T } from 'ramda'

export function isTraceSpecsFns(obj) {
  return Boolean(obj && obj.length === 2 && isFunction(obj[0]) && isFunction(obj[1]))
}

export const isTraceDefSpecs = isStrictRecordE({
  _hooks: isOptional(isStrictRecordE({
    preprocessInput: isOptional(isFunction),
    postprocessOutput: isOptional(isFunction)
  })),
  _helpers: isOptional(isStrictRecordE({
    getId: isOptional(isFunction)
  })),
  _trace: isOptional(isStrictRecordE({
    componentName: isOptional(isString),
    isTraceEnabled: isOptional(isBoolean),
    isContainerComponent: isOptional(isBoolean),
    isLeaf: isOptional(isBoolean),
    path: isOptional(isString),
    sendMessage: isOptional(isFunction),
    onMessage: T, // not used for now
    traceSpecs: isHashMap(isString, isTraceSpecsFns),
    defaultTraceSpecs: isOptional(isTraceSpecsFns),
  }, `_trace property is invalid!`)),
}, `traceApp : fails contract isTraceDefSpecs. Please review the parameter.`);
