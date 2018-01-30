// ListOf({list : 'items', as : 'cardInfo', buildActionsFromChildrenSinks:...,
// actionsMap:{'clickIntent$':'router'}},}, [Component],
import {
  assertContract, checkAndGatherErrors, isArray, isFunction, isObject, isString, isComponent
} from "../../../utils/contracts/src/index"
import { m } from '../m/m'
import { either, isNil, keys, merge, path, reduce, uniq } from 'ramda'
import * as Rx from "rx"

const $ = Rx.Observable;

function getPathFromString(list) {
  return list.split('.');
}

function isListOfSettings(settings) {
  return 'list' in settings && 'as' in settings
    && isString(settings.list) && isString(settings.as)
}

function isListAnArray(sources, settings) {
  return isArray(path(getPathFromString(settings.list), settings))
}

function hasValidBuildActionsFromChildrenSinks(sources, settings) {
  return (!('buildActionsFromChildrenSinks' in settings)
    || either(isNil, either(isObject, isFunction))(settings.buildActionsFromChildrenSinks))
}

function hasValidActionsMap(sources, settings) {
  return (!('actionsMap' in settings) || isObject(settings.actionsMap))
}

function hasExactlyTwoChildrenComponent(arrayOfComponents) {
  // NOTE : we exclude [parent, [child, child]]. We want [child, child]
  return arrayOfComponents && isArray(arrayOfComponents) && arrayOfComponents.length === 2
    && isComponent(arrayOfComponents[0]) && isComponent(arrayOfComponents[1])
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
  const items = path(getPathFromString(list), settings);
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
    mergeSinks: buildActionsFromChildrenSinks || {}
  }, { trace: 'ListOf > computing indexed children' }, indexedChildrenComponents)(sources, settings);

  const sinkNames = keys(reducedSinks);

  const collectedReducedSinks = reduce(
    function collectReducedSinks(acc, sinkName) {
      const mappedSinkName = (actionsMap || {})[sinkName];
      if (mappedSinkName) {
        acc[mappedSinkName] = acc[mappedSinkName] || [];
        acc[mappedSinkName].push(reducedSinks[sinkName]);
      }
      else {
        acc[sinkName] = acc[sinkName] || [];
        acc[sinkName].push(reducedSinks[sinkName]);
      }

      return acc
    },
    {},
    sinkNames
  );

  const mappedSinkNames = uniq(sinkNames.map(sinkName => {
    const mappedSinkName = (actionsMap || {})[sinkName];

    return mappedSinkName
      ? mappedSinkName
      : sinkName
  }));

  const finalSinks = reduce(function mergeReducedSinks(acc, sinkName) {
    // This is an array by previous construction
    const sinks = collectedReducedSinks[sinkName];
    if (sinks.length === 1) {
      // Case standard when there is only one reduced sink for a given sink name
      acc[sinkName] = sinks[0];
    }
    else {
      // Case advanced when there are several reduced sinks for a given sink name
      // This can happen because of mapping several sinks into another given sink name,
      // as a result of the mapping
      acc[sinkName] = $.merge(sinks)
    }

    return acc
  }, {}, mappedSinkNames);

  return finalSinks
}

// Spec
const listOfSpec = {
  computeSinks: computeSinks,
  checkPreConditions: isValidListOfSettings
};

export function ListOf(listOfSettings, childrenComponents) {
  assertContract(hasExactlyTwoChildrenComponent, [childrenComponents], `ListOf : ListOf combinator must have exactly two children component to list from!`);
  assertContract(isListOfSettings, [listOfSettings], `ListOf : ListOf combinator must have 'list' and 'as' property which are strings!`);

  return m(listOfSpec, listOfSettings, childrenComponents)
}

// NOTE ADR: it is better to have only one child component. If several, we have to allow
// specifying how they are merged, which would complexify the API. We already have to specify
// how the array of the components are merged. That would make two merge functions to specify
// with different scopes, which is a bit harder to reason about and error-prone.
// It is always possible to specify the unique child component as a the sum of other components
// and define the merge at that level. For instance :
// ListOf(..., [UniqueComponent]); UniqueComponent = m({mergeSpecs}, {settings}, [Components])
