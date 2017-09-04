import {
  checkAndGatherErrors, eitherE, isArrayOf, isComponent, isFunction, isHashMap, isObject, isString
} from "../../utils"
import { both, complement, either, pipe, prop, isNil } from 'ramda'

function hasValidComponentDefProperty(componentDef, _settings, children) {
  return eitherE(
    [isNil, `m > hasMsignature > hasValidComponentDefProperty : there is no component definition`],
    [isNonNilComponentDef, `m > hasMsignature > hasValidComponentDefProperty : there is a component definition but it is not valid!`],
    ``
  )(componentDef)
}

function hasValidSettingsProperty (componentDef, _settings, children) {
  return either(isNil, isObject)(_settings)
}

const isSinkName = isString;

const isCombineGenericSpecs = checkAndGatherErrors([
    [pipe(prop('computeSinks'),
      either(isNil, both(isFunction, complement(prop('mergeSinks'))))),
      `m > hasMsignature > hasValidComponentDefProperty > isNonNilComponentDef > isCombineGenericSpecs : 'computeSinks' if not null must be  a function and in that case 'mergeSinks cannot be defined' !`],
    [pipe(prop('makeOwnSinks'), either(isNil, isFunction)), `m > hasMsignature > hasValidComponentDefProperty > isNonNilComponentDef > isCombineGenericSpecs : makeOwnSinks must be either null or a function!`]
  ],
  `m > hasMsignature > hasValidComponentDefProperty > isNonNilComponentDef > isCombineGenericSpecs : invalid combine generic definition!`);

const isCombineSinksSpecs = eitherE(
  [pipe(prop('mergeSinks'), either(isNil, isFunction)), ``],
  [pipe(prop('mergeSinks'), either(isNil, isHashMap(isSinkName, isFunction))), ``],
  `m > hasMsignature > hasValidComponentDefProperty > isNonNilComponentDef > isCombineGenericSpecs : invalid combine sinks definition! : must be a hash of functions, or a function`);

const isNonNilComponentDef = checkAndGatherErrors([
  [pipe(prop('makeLocalSources'), either(isNil, isFunction)), `m > hasMsignature > hasValidComponentDefProperty > isNonNilComponentDef : invalid 'makeLocalSources', should be null or a function!`],
  [pipe(prop('makeLocalSettings'), either(isNil, isFunction)), `m > hasMsignature > hasValidComponentDefProperty > isNonNilComponentDef : invalid 'makeLocalSettings', should be null or a function!`],
  [pipe(prop('checkPreConditions'), either(isNil, isFunction)), `m > hasMsignature > hasValidComponentDefProperty > isNonNilComponentDef : invalid 'checkPreConditions', should be null or a function!`],
  [pipe(prop('checkPostConditions'), either(isNil, isFunction)), `m > hasMsignature > hasValidComponentDefProperty > isNonNilComponentDef : invalid 'checkPostConditions', should be null or a function!`],
  [eitherE(
    [isCombineGenericSpecs, `m > hasMsignature > hasValidComponentDefProperty > isNonNilComponentDef : invalid generic merge!`],
    [isCombineSinksSpecs, `m > hasMsignature > hasValidComponentDefProperty > isNonNilComponentDef : invalid per sink merge!`],
    `m > hasMsignature > hasValidComponentDefProperty > isNonNilComponentDef : invalid component definition - must have either generic merge, or per sinks merge!`
  )]
], `m > hasMsignature > hasValidComponentDefProperty > isNonNilComponentDef : invalid component definition!`);

function hasValidChildrenProperty (componentDef, _settings, children){
  return isArrayOf(isComponent)(children)
}

export const hasMsignature = checkAndGatherErrors([
  [hasValidComponentDefProperty, `m > hasMsignature > hasValidComponentDefProperty : invalid component definition !`],
  [hasValidSettingsProperty, `m > hasMsignature > hasValidSettingsProperty : invalid settings parameter !`],
  [hasValidChildrenProperty, `m > hasMsignature > hasValidChildrenProperty : children components must be an array of components!`]
], `hasMsignature : fails!`);
