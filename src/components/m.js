// Component typings
/**
 * @typedef {Observable} Stream
 */
/**
 * @typedef {Object.<string, Stream>} Sources
 */
/**
 * @typedef {Object.<string, Stream>} Sinks
 * NOTE : this type def is not perfect as we allow sometimes null values
 */
/**
 * @typedef {?Object.<string, ?Object>} Settings
 */
/**
 * @typedef {Object} DetailedComponentDef
 * @property {?function(Sources, Settings)} makeLocalSources
 * @property {?function(Settings)} makeLocalSettings
 * @property {?function(Sources, Settings)} makeOwnSinks
 * @property {function(Sinks, Array<Sinks>, Settings)} mergeSinks
 * @property {function(Sinks):Boolean} sinksContract
 * @property {function(Sources):Boolean} sourcesContract
 */
/**
 * @typedef {Object} ShortComponentDef
 * @property {?function(Sources, Settings)} makeLocalSources
 * @property {?function(Settings)} makeLocalSettings
 * @property {function(Sources, Settings, Array<Component>)} makeAllSinks
 * @property {function(Sinks):Boolean} sinksContract
 * @property {function(Sources):Boolean} sourcesContract
 */
/**
 * @typedef {function(Sources, Settings):Sinks} Component
 */

import {
  assertSignature,
  assertContract,
  trace,
  projectSinksOn,
  getSinkNamesFromSinksArray,
  removeNullsFromArray,
  isNullableObject,
  isFunction,
  isComponent,
  isVNode,
  isArrayOf,
  isOptSinks,
  isNullableComponentDef,
  assertSourcesContracts,
  isArrayOptSinks,
  assertSinksContracts,
  removeEmptyVNodes,
  emitNullIfEmpty,
  isMergeSinkFn,
  assertSettingsContracts,
} from '../utils'
import {
  flatten, always, merge, reduce, clone, map, is, mergeWith, concat, defaultTo
} from 'ramda'
import {div} from "cycle-snabbdom"
import * as Rx from "rx"

Rx.config.longStackSupport = true;
let $ = Rx.Observable
const deepMerge = function deepMerge(a, b) {
  return (is(Object, a) && is(Object, b)) ? mergeWith(deepMerge, a, b) : b;
}

// Configuration
const defaultMergeSinkConfig = {
  DOM: computeDOMSinkDefault,
  _default: computeSinkDefault
}

//////
// Helpers
/**
 * Merges the DOM nodes produced by a parent component with the DOM nodes
 * produced by children components, such that the parent DOM nodes
 * wrap around the children DOM nodes
 * For instance:
 * - parent -> div(..., [h2(...)])
 * - children -> [div(...), button(...)]
 * - result : div(..., [h2(...), div(...), button(...)])
 * @param {Sink} parentDOMSinkOrNull
 * @param {Array<Sink>} childrenSink
 * @param {Settings} settings
 * @returns {Observable<VNode>|Null}
 */
function computeDOMSinkDefault(parentDOMSinkOrNull, childrenSink, settings) {
  // We want `combineLatest` to still emit the parent DOM sink, even when
  // one of its children sinks is empty, so we modify the children sinks
  // to emits ONE `Null` value if it is empty
  // Note : in default function, settings parameter is not used
  const childrenDOMSinkOrNull = map(emitNullIfEmpty, childrenSink)

  const allSinks = flatten([parentDOMSinkOrNull, childrenDOMSinkOrNull])
  const allDOMSinks = removeNullsFromArray(allSinks)

  // Edge case : none of the sinks have a DOM sink
  // That should not be possible as we come here only
  // when we detect a DOM sink
  if (allDOMSinks.length === 0) {
    throw `mergeDOMSinkDefault: internal error!`
  }

  return $.combineLatest(allDOMSinks)
    .tap(console.log.bind(console, 'mergeDOMSinkDefault: allDOMSinks'))
    .map(mergeChildrenIntoParentDOM(parentDOMSinkOrNull))
}

function computeSinkDefault(parentDOMSinkOrNull, childrenSink, settings) {
  const allSinks = concat([parentDOMSinkOrNull], childrenSink)

  // Nulls have to be removed as a given sink name will not be in all children
  // sinks. It is however guaranteed by the caller that the given sink
  // name will be in at least one of the children. Hence the merged array
  // is never empty
  return $.merge(removeNullsFromArray(allSinks))
}

function mergeChildrenIntoParentDOM(parentDOMSink) {
  return function mergeChildrenIntoParentDOM(arrayVNode) {
    // We remove null elements from the array of vNode
    // We can have a null vNode emitted by a sink if that sink is empty
    let _arrayVNode = removeEmptyVNodes(removeNullsFromArray(arrayVNode))
    assertContract(isArrayOf(isVNode), [_arrayVNode], 'DOM sources must' +
      ' stream VNode objects! Got ' + _arrayVNode)

    if (parentDOMSink) {
      // Case : the parent sinks have a DOM sink
      // We want to put the children's DOM **inside** the parent's DOM
      // Two cases here :
      // - The parent's vNode has a `text` property :
      //   we move that text to a text vNode at first position in the children
      //   then we add the children's DOM in last position of the
      // existing parent's children
      // - The parent's vNode does not have a `text` property :
      //   we just add the children's DOM in last position of the exisitng
      //   parent's children
      // Note that this is specific to the snabbdom vNode data structure
      // Note that we defensively clone vNodes so the original vNode remains
      // immuted
      let parentVNode = clone(_arrayVNode.shift())
      let childrenVNode = _arrayVNode
      parentVNode.children = clone(parentVNode.children) || []

      // childrenVNode could be null if all children sinks are empty
      // observables, in which case we just return the parentVNode
      if (childrenVNode) {
        if (parentVNode.text) {
          parentVNode.children.splice(0, 0, {
            children: [],
            "data": {},
            "elm": undefined,
            "key": undefined,
            "sel": undefined,
            "text": parentVNode.text
          })
          parentVNode.text = undefined
        }
        Array.prototype.push.apply(parentVNode.children, childrenVNode)
      }

      return parentVNode
    }
    else {
      // Case : the parent sinks does not have a DOM sink
      // To avoid putting an extra `div` when there is only one vNode
      // we put the extra `div` only when there are several vNodes
      switch (_arrayVNode.length) {
        case 0 :
          return null
        case 1 :
          return _arrayVNode[0]
        default :
          return div(_arrayVNode)
      }
    }
  }
}

///////
// Helpers
function computeReducedSink(ownSinks, childrenSinks, localSettings, mergeSinks) {
  return function computeReducedSink(accReducedSinks, sinkName) {
    let mergeSinkFn = mergeSinks[sinkName]
      || defaultMergeSinkConfig[sinkName]
      || defaultMergeSinkConfig['_default']
    assertContract(isMergeSinkFn, [mergeSinkFn], 'm : mergeSinkFn' +
      ' for sink ${sinkName} must be a function : check' +
      ' parameter or default merge function!')

    if (mergeSinkFn) {
      accReducedSinks[sinkName] = mergeSinkFn(
        ownSinks ? ownSinks[sinkName] : null,
        projectSinksOn(sinkName, childrenSinks),
        localSettings
      )
    }

    return accReducedSinks
  }
}

/**
 * Returns a component specified by :
 * - a component definition object (nullable)
 * - settings (nullable)
 * - children components
 * Component definition properties :
 * - mergeSinks : computes resulting sinks or a specific sinks according to
 * configuration. See type information
 * - computeSinks : computes resulting sinks by executing the
 * children component and parent and merging the result
 * - sourcesContract : default to checking all sinks are observables or `null`
 * - sinksContract : default to checking all sinks are observables or `null`
 * - settingsContract : default to do noting
 * - makeLocalSources : default -> null
 * - makeLocalSettings : default -> null
 * - makeOwnSinks : -> default null
 *
 * The factored algorithm which derives sinks from sources is as follows :
 * - merging current sources with extra sources if any
 * - creating some sinks by itself
 * - computing children sinks by executing the children components on the
 * merged sources
 * - merging its own computed sinks with the children computed sinks
 * There are two versions of definition, according to the level of
 * granularity desired : the short spec and the detailed spec :
 * - short spec :
 *   one function `computeSinks` which outputs the sinks from the sources,
 *   settings and children components
 * - detailed spec :
 *   several properties as detailed above
 * @param {?(DetailedComponentDef|ShortComponentDef)} componentDef
 * @param {?Object} _settings
 * @param {Array<Component>} children
 * @returns {Component}
 * @throws when type- and user-specified contracts are not satisfied
 *
 * Contracts function allows to perform contract checking before computing
 * the component, for instance :
 * - check that sources have the expected type
 * - check that sources include the mandatory source property for
 * computing the component
 * - check that the sinks have the expected type/exists
 *
 * Source contracts are checked before extending the sources
 * Settings contracts are checked before merging
 *
 */
// m :: Opt Component_Def -> Opt Settings -> [Component] -> Component
function m(componentDef, _settings, children) {
  console.groupCollapsed('Utils > m')
  console.log('componentDef, _settings, children', componentDef, _settings, children)
  // check signature
  const mSignature = [
    {componentDef: isNullableComponentDef},
    {settings: isNullableObject},
    {children: isArrayOf(isComponent)},
  ]
  assertSignature('m', arguments, mSignature)

  let {
    makeLocalSources, makeLocalSettings, makeOwnSinks, mergeSinks,
    computeSinks, sinksContract, sourcesContract, settingsContract
  } = componentDef

  // Set default values
  _settings = _settings || {}
  makeLocalSources = defaultTo(always(null), makeLocalSources)
  makeLocalSettings = defaultTo(always({}), makeLocalSettings)
  makeOwnSinks = defaultTo(always(null), makeOwnSinks)
  mergeSinks = defaultTo({}, mergeSinks)
  sinksContract = defaultTo(always(true), sinksContract)
  sourcesContract = defaultTo(always(true), sourcesContract)
  settingsContract = defaultTo(always(true), settingsContract)

  console.groupEnd()
  return function m(sources, innerSettings) {
    console.groupCollapsed('m\'ed component > Entry')
    console.log('sources, innerSettings', sources, innerSettings)

    assertSettingsContracts(innerSettings, settingsContract)

    innerSettings = innerSettings || {}
    const mergedSettings = deepMerge(innerSettings, _settings)

    assertSourcesContracts(sources, sourcesContract)

    // Computes and MERGES the extra sources which will be passed
    // to the children and this component
    // Extra sources are derived from the `sources`
    // received as input, which remain untouched
    const extendedSources = merge(
      sources,
      makeLocalSources(sources, mergedSettings)
    )

    // Note that per `merge` ramda spec. the second object's values
    // replace those from the first in case of key conflict
    const localSettings = deepMerge(
      makeLocalSettings(mergedSettings),
      mergedSettings
    )

    let reducedSinks

    // Case : computeSinks is defined
    if (computeSinks) {
      reducedSinks = computeSinks(
        makeOwnSinks, children, extendedSources, localSettings
      )
    }
    // Case : computeSinks is not defined, merge is defined in mergeSinks
    else {
      console.groupCollapsed('m\'ed component > makeOwnSinks')
      console.log('extendedSources, localSettings', extendedSources, localSettings)
      const ownSinks = makeOwnSinks(extendedSources, localSettings)
      console.groupEnd()

      console.group('m\'ed component > computing children sinks')
      const childrenSinks = map(
        childComponent => childComponent(extendedSources, localSettings),
        children
      )
      console.groupEnd()

      assertContract(isOptSinks, [ownSinks], 'ownSinks must be a hash of observable sink')
      assertContract(isArrayOptSinks, [childrenSinks], 'childrenSinks must' +
        ' be an array of sinks')

      // Merge the sinks from children and one-s own...
      // Case : mergeSinks is defined through a function
      if (isFunction(mergeSinks)) {
        console.groupCollapsed('m\'ed component > (fn) mergeSinks')
        console.log('ownSinks, childrenSinks, localSettings', ownSinks, childrenSinks, localSettings)
        reducedSinks = mergeSinks(ownSinks, childrenSinks, localSettings)
        console.groupEnd()
      }
      // Case : mergeSinks is defined through an object
      else {
        const allSinks = flatten(removeNullsFromArray([ownSinks, childrenSinks]))
        const sinkNames = getSinkNamesFromSinksArray(allSinks)

        console.groupCollapsed('m\'ed component > (obj) mergeSinks')
        console.log('ownSinks, childrenSinks, localSettings,' +
          ' (fn) mergeSinks', ownSinks, childrenSinks, localSettings, mergeSinks)
        reducedSinks = reduce(
          computeReducedSink(ownSinks, childrenSinks, localSettings, mergeSinks),
          {}, sinkNames
        )
        console.groupEnd()
      }
    }

    assertSinksContracts(reducedSinks, sinksContract)

    const tracedSinks = trace(reducedSinks, mergedSettings)
    // ... and add tracing information(sinkPath, timestamp, sinkValue/sinkError) after each sink
    // TODO : specify trace/debug/error generation information
    // This would ensure that errors are automatically and systematically
    //       caught in the component where they occur, and not
    //       interrupting the application implementation-wise, it might be
    //       necessary to add a `currentPath` parameter somewhere which
    //       carries the current path down the tree

    console.groupEnd()
    return tracedSinks
  }
}

export {m}
