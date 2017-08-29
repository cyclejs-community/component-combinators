// ListOf({list : 'items', as : 'cardInfo', buildActionsFromChildrenSinks:...,
// actionsMap:{'clickIntent$':'router'}},}, [Component],
import {
  assertContract, checkAndGatherErrors, hasAtLeastOneChildComponent, isArray, isFunction, isObject,
  isString
} from "../../utils"
import { m, computeReducedSink } from '../m'
import { keys, merge, prop, map, reduce, defaultTo } from 'ramda'


function isListOfSettings(settings) {
  return 'list' in settings && 'as' in settings
    && isString(settings.list) && isString(settings.as)
}

function isListAnArray(sources, settings) {
  return isArray(settings.list)
}

function hasValidBuildActionsFromChildrenSinks(sources, settings) {
  return (!('buildActionsFromChildrenSinks' in settings) || isFunction(settings.buildActionsFromChildrenSinks))
}

function hasValidActionsMap(sources, settings) {
  return (!('actionsMap' in settings) || isObject(settings.actionsMap))
}

const isValidListOfSettings =
  // 1. list must be an array
  // 2. buildActionsFromChildrenSinks is optional and a function (signature??)
  // 3. actionsMap is optional and a hashmap (can be empty)
  checkAndGatherErrors([
    [isListAnArray, `'list' ListOf's setting must reference a setting property which is an array!`],
    [hasValidBuildActionsFromChildrenSinks, `buildActionsFromChildrenSinks parameter is optional. When present it must be a function!`],
    [hasValidActionsMap, `hasValidActionsMap parameter is optional. When present it must be a hashmap mapping children sinks to action sinks!`],
  ], `isValidListOfSettings : fails!`);

function computeSinks(makeOwnSinks, childrenComponents, sources, settings) {
  const { list, buildActionsFromChildrenSinks, actionsMap } = settings;
  const items = settings[list];
  const childComponent = childrenComponents[0]; // Just one child
  const parentSinks = makeOwnSinks(sources, settings);
  const _actionsMap = defaultTo({},actionsMap);

  /** @type {HashMap<SinkName, Sink>} childrenSinks */
  const childrenSinks = items.map((item, index) => {
    const childComponentSettings = merge(settings, { [settings.as]: item, listIndex: index });

    return childComponent(sources, childComponentSettings)
  });

  const sinkNames = keys(childrenSinks);

  const reducedSinks = reduce(
    computeReducedSink(parentSinks, childrenSinks, settings, buildActionsFromChildrenSinks || {}),
    {},
    sinkNames
  );

  const mappedAndReducedSinks = reduce(
    function mapAndReduceSinks(acc, sinkName) {
      const mappedSinkName = _actionsMap[sinkName];
      if (mappedSinkName){
        acc[mappedSinkName] = reducedSinks[sinkName];
      }
      else {
        acc[sinkName] = reducedSinks[sinkName];
      }

      return acc
    },
    {},
    keys(reducedSinks)
  );

  return mappedAndReducedSinks
}

// Spec
const listOfSpec = {
  computeSinks: computeSinks,
  checkPreConditions: isValidListOfSettings
};

export function ListOf(listOfSettings, childrenComponents) {
  assertContract(hasAtLeastOneChildComponent, [childrenComponents], `ListOf : ListOf combinator must at least have one child component to list!`);
  assertContract(isListOfSettings, [listOfSettings], `ForEach : ForEach combinator must have 'from' and 'as' property which are strings!`);

  return m(listOfSpec, listOfSettings, childrenComponents)
}

// TODO : review and test (write test plans and then test)
