// ListOf({list : 'items', as : 'cardInfo', buildActionsFromChildrenSinks:...,
// actionsMap:{'clickIntent$':'router'}},}, [Component],
import {
  assertContract, checkAndGatherErrors, isArray, isComponent, isFunction, isObject, isString
} from "../../../contracts/src/index"
import { m } from '../m/m'
import { either, isNil, keys, merge, path, reduce, uniq, set, append, over, flatten, map } from 'ramda'
import * as Rx from "rx"
import { isArrayOf, isVNode } from "../../../contracts/src"
import { combinatorNameInSettings, pathInSettings } from "../../../tracing/src/helpers"
import {
  DOM_SINK, emitNullIfEmpty, isAdvised, removeAdvice, removeEmptyVNodes, removeNullsFromArray
} from "../../../utils/src"
import { mergeChildrenIntoParentDOM } from "../m"
import { div } from "cycle-snabbdom"

const $ = Rx.Observable;

function getPathFromString(list) {
  return list.split('.');
}

function isNonEmptyArrayComponent(obj) {
  return obj && obj.length && isArrayOf(isComponent)(obj)
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

function hasExactlyTwoChildrenComponents(arrayOfComponents) {
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

function listOfDomMergeFn(parentDOMSinkOrNull, childrenSink, settings){
  const childrenDOMSinkOrNull = map(emitNullIfEmpty, childrenSink)

  const allSinks = flatten([parentDOMSinkOrNull, childrenDOMSinkOrNull])
  const allDOMSinks = removeNullsFromArray(allSinks)

  // Edge case : none of the sinks have a DOM sink
  // That should not be possible as we come here only
  // when we detect a DOM sink
  if (allDOMSinks.length === 0) {
    throw `ListOf > listOfDomMergeFn: internal error!`
  }

  // Then by ListOf semantics, only one child is always present, with no parent container, so we access it directly
  return allDOMSinks[0]
}

function computeSinks(parentComponent, childrenComponents, sources, settings) {
  // NOTE : parentComponent is supposed to be null for `ListOf`
  const { list } = settings;
  const items = path(getPathFromString(list), settings);
  const maybeAdvisedChildComponent = items.length ? childrenComponents[1] : childrenComponents[0];
  const childComponent = isAdvised(maybeAdvisedChildComponent)
    ? removeAdvice(maybeAdvisedChildComponent)
    : maybeAdvisedChildComponent;

  // NOTE : I had to remove the advice on childComponent. As a matter of fact, childComponent comes already with the
  // advised path, (m(..., componentTree) advises cptTree before running component in the tree)
  // The path that is then set is prioritary over any changes made elsewhere, so I need to unadvise first
  // An implementation directly adding the right settings to an intermediary function failed to pass on listIndex
  // NOTE : this implementation opens the door to having several children components in the ListOf. Don't know how
  // useful that is. To ponder over for later versions.

  const indexedChildrenComponents = items.length
    // Case when the `items` array is not empty, we branch to the second child component
    ? items.map((item, index) => {
      // TODO : add a custom DOM merge here, so that no extra div is added!! so children component can be on same level
      // if childComponent return null vnode pass that on
      return m(
        {mergeSinks : {[DOM_SINK]: listOfDomMergeFn}},
        set(combinatorNameInSettings, 'ListOf|Inner|Indexed', { [settings.as]: item, listIndex: index }),
        [childComponent]
      )
    })
    // Case when the `items` array is empty, we branch to the first child component
    : [childComponent]
  ;

  const reducedSinks = m({}, set(combinatorNameInSettings, 'ListOf|Inner', {}), indexedChildrenComponents)(sources, settings);

  return reducedSinks
}

// Spec
const listOfSpec = {
  computeSinks: computeSinks,
  checkPreConditions: isValidListOfSettings
};

export function ListOf(listOfSettings, childrenComponents) {
  assertContract(hasExactlyTwoChildrenComponents, [childrenComponents], `ListOf : ListOf combinator must have exactly two children component to list from!`);
  // NOTE : Do check it at that level and not with checkPreConditions
  assertContract(isListOfSettings, [listOfSettings], `ListOf : ListOf combinator must have 'list' and 'as' property which are strings!`);

  return m(listOfSpec, set(combinatorNameInSettings, 'ListOf', listOfSettings), childrenComponents)
}

// NOTE ADR: it is better to have only one child component. If several, we have to allow
// specifying how they are merged, which would complexify the API. We already have to specify
// how the array of the components are merged. That would make two merge functions to specify
// with different scopes, which is a bit harder to reason about and error-prone.
// It is always possible to specify the unique child component as a the sum of other components
// and define the merge at that level. For instance :
// ListOf(..., [UniqueComponent]); UniqueComponent = m({mergeSpecs}, {settings}, [Components])
// NOTE : ADR2 in second evolution, we added another component for the edge case when the list is empty
