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
//  const parentSinks = makeOwnSinks && makeOwnSinks(sources, settings) || null;

  const indexedChildrenComponents = items.map((item,index) => {
    return function indexedChildComponent(sources, _settings){
      const childComponentSettings = merge(_settings, { [settings.as]: item, listIndex: index });

      return childComponent(sources, childComponentSettings)
    }
  });

  const reducedSinks = m({
    makeOwnSinks : makeOwnSinks,
    mergeSinks : buildActionsFromChildrenSinks || {}
  }, {trace : 'ListOf > computing indexed children'}, indexedChildrenComponents);

  const sinkNames = keys(reducedSinks);

/*
  /!** @type {Array<HashMap<SinkName, Sink>>} childrenSinks *!/
  const childrenSinks = items.map((item, index) => {
    const childComponentSettings = merge(settings, { [settings.as]: item, listIndex: index });

    return childComponent(sources, childComponentSettings)
  });

// NO: I have to include the parent sinks
  const sinkNames = keys(childrenSinks);

  const reducedSinks = reduce(
    computeReducedSink(parentSinks, childrenSinks, settings, buildActionsFromChildrenSinks || {}),
    {},
    sinkNames
  );
*/

  const mappedAndReducedSinks = reduce(
    function mapAndReduceSinks(acc, sinkName) {
      const mappedSinkName = (actionsMap|| {})[sinkName];
      if (mappedSinkName){
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
  assertContract(hasAtLeastOneChildComponent, [childrenComponents], `ListOf : ListOf combinator must at least have one child component to list!`);
  assertContract(isListOfSettings, [listOfSettings], `ListOf : ListOf combinator must have 'list' and 'as' property which are strings!`);

  return m(listOfSpec, listOfSettings, childrenComponents)
}

// TODO : review and test (write test plans and then test)
// DOC NOTE : it is better to have only one child component. If several, we have to allow
// specifying how they are merged, which would complexify the API. We already have to specify
// how the array of the components are merged. That would make two merge functions to specify
// with different scopes, which is a bit harder to reason about and error-prone.
// It is always possible to specify the unique child component as a the sum of other components
// and define the merge at that level. For instance :
// ListOf(..., [UniqueComponent]); UniqueComponent = m({mergeSpecs}, {settings}, [Components])
