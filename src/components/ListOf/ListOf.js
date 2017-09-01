// ListOf({list : 'items', as : 'cardInfo', buildActionsFromChildrenSinks:...,
// actionsMap:{'clickIntent$':'router'}},}, [Component],
import {
  assertContract, checkAndGatherErrors, isArray, isFunction, isObject, isString
} from "../../utils"
import { m } from '../m'
import { keys, merge, reduce, either, isNil } from 'ramda'

function isListOfSettings(settings) {
  return 'list' in settings && 'as' in settings
    && isString(settings.list) && isString(settings.as)
}

function isListAnArray(sources, settings) {
  return isArray(settings[settings.list])
}

function hasValidBuildActionsFromChildrenSinks(sources, settings) {
  return (!('buildActionsFromChildrenSinks' in settings)
    || either(isNil, either(isObject, isFunction))(settings.buildActionsFromChildrenSinks))
}

function hasValidActionsMap(sources, settings) {
  return (!('actionsMap' in settings) || isObject(settings.actionsMap))
}

function hasExactlyTwoChildComponent(arrayOfComponents) {
  return arrayOfComponents && isArray(arrayOfComponents) && arrayOfComponents.length === 2
}

const isValidListOfSettings =
  // 1. list must be an array
  // 2. buildActionsFromChildrenSinks is optional and a function (signature??)
  // 3. actionsMap is optional and a hashmap (can be empty)
  checkAndGatherErrors([
    [isListAnArray, `'list' ListOf's setting must reference a setting property which is an array!`],
    [hasValidBuildActionsFromChildrenSinks, `buildActionsFromChildrenSinks parameter is optional. When present it must be a function or a hashmap mapping a sink to a merge function!`],
    [hasValidActionsMap, `hasValidActionsMap parameter is optional. When present it must be a hashmap mapping children sinks to action sinks!`],
  ], `isValidListOfSettings : fails!`);

function computeSinks(makeOwnSinks, childrenComponents, sources, settings) {
  const { list, buildActionsFromChildrenSinks, actionsMap } = settings;
  const items = settings[list];
  const childComponent = items.length ? childrenComponents[1] : childrenComponents[0];

  const indexedChildrenComponents = items.length
    // Case when the `items` array is not empty, we branch to the second child component
    ? items.map((item, index) => {
    return function indexedChildComponent(sources, _settings) {
      const childComponentSettings = merge(_settings, { [settings.as]: item, listIndex: index });

      return childComponent(sources, childComponentSettings)
    }
  })
    // Case when the `items` array is empty, we branch to the first child component
    : [childComponent]

  const reducedSinks = m({
    makeOwnSinks: makeOwnSinks,
    mergeSinks: buildActionsFromChildrenSinks || {}
  }, { trace: 'ListOf > computing indexed children' }, indexedChildrenComponents)(sources, settings);

  const sinkNames = keys(reducedSinks);

  const mappedAndReducedSinks = reduce(
    function mapAndReduceSinks(acc, sinkName) {
      const mappedSinkName = (actionsMap || {})[sinkName];
      if (mappedSinkName) {
        acc[mappedSinkName] = reducedSinks[sinkName];
      }
      else {
        acc[sinkName] = reducedSinks[sinkName];
      }

      return acc
    },
    {},
    sinkNames
  );

  return mappedAndReducedSinks
}

// Spec
const listOfSpec = {
  computeSinks: computeSinks,
  checkPreConditions: isValidListOfSettings
};

export function ListOf(listOfSettings, childrenComponents) {
  assertContract(hasExactlyTwoChildComponent, [childrenComponents], `ListOf : ListOf combinator must have exactly one child component to list from!`);
  assertContract(isListOfSettings, [listOfSettings], `ListOf : ListOf combinator must have 'list' and 'as' property which are strings!`);

  const trace = (listOfSettings.trace || '') + ' ListOf generic'
  return m(listOfSpec, merge(listOfSettings, {trace}), childrenComponents)
}

// TODO : review and test (write test plans and then test)
// DOC NOTE : it is better to have only one child component. If several, we have to allow
// specifying how they are merged, which would complexify the API. We already have to specify
// how the array of the components are merged. That would make two merge functions to specify
// with different scopes, which is a bit harder to reason about and error-prone.
// It is always possible to specify the unique child component as a the sum of other components
// and define the merge at that level. For instance :
// ListOf(..., [UniqueComponent]); UniqueComponent = m({mergeSpecs}, {settings}, [Components])
