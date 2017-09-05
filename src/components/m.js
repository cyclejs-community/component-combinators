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
 * @typedef {?Object.<string, *>} Settings
 * @property {?String} trace
 */
/**
 * @typedef {?Object} DetailedComponentDef
 * @property {?function(Sources, Settings)} makeLocalSources
 * @property {?function(Settings)} makeLocalSettings
 * @property {?function(Sources, Settings)} makeOwnSinks
 * @property {function(Sinks, Array<Sinks>, Settings) || Object.<Sink, Function>} mergeSinks
 * @property {?function(Sinks):Boolean} checkPostConditions
 * @property {?function(Sources, Settings):Boolean} checkPreConditions
 */
/**
 * @typedef {?Object} ShortComponentDef
 * @property {?function(Sources, Settings)} makeLocalSources
 * @property {?function(Settings)} makeLocalSettings
 * @property {?function(Sources, Settings, Array<Component>)} makeAllSinks
 * @property {function(Function, Array<Component>, Sources, Settings)} computeSinks
 * @property {?function(Sinks):Boolean} checkPostConditions
 * @property {?function(Sources, Settings):Boolean} checkPreConditions
 */
/**
 * @typedef {function(Sources, Settings):Sinks} Component
 */
/**
 *@typedef {Component | Array<Component>} ParentAndChildren
 */

import {
  assertContract, assertSinksContracts, assertSourcesContracts, emitNullIfEmpty, format,
  getSinkNamesFromSinksArray, isArray, isArrayOf, isArrayOptSinks, isFunction, isMergeSinkFn,
  isOptSinks, isVNode, projectSinksOn, removeEmptyVNodes, removeNullsFromArray, traceSinks
} from "../utils"
import {
  addIndex, always, clone, concat, defaultTo, flatten, is, keys, map, merge, mergeWith, reduce, either, both, complement, isNil
} from "ramda"
import { div } from "cycle-snabbdom"
import * as Rx from "rx"
import { hasMsignature } from "./m/types"

Rx.config.longStackSupport = true;
let $ = Rx.Observable
const mapIndexed = addIndex(map);

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
    throw `m > computeDOMSinkDefault: internal error!`
  }

  return $.combineLatest(allDOMSinks)
  //    .tap(x => console.log(`m > computeDOMSinkDefault: allDOMSinks : ${convertVNodesToHTML(x)}`))
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
          // NOTE : if parentVNode has text, then children = [], so splice is too defensive here
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
      switch (_arrayVNode.length) {
        case 0 :
          return null
        /*
         // To avoid putting an extra `div` when there is only one vNode
         // we put the extra `div` only when there are several vNodes
         // that did not work though... `insertBefore : error...`
         // KEPT AS ADR i.e. documenting past choices
         case 1 :
         return _arrayVNode[0]
         */
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
    assertContract(isMergeSinkFn, [mergeSinkFn],
      `m : mergeSinkFn for sink ${sinkName} must be a function : check parameter or default merge function!`)

    accReducedSinks[sinkName] = mergeSinkFn(
      ownSinks ? ownSinks[sinkName] : null,
      projectSinksOn(sinkName, childrenSinks),
      localSettings
    )

    return accReducedSinks
  }
}

function defaultMergeSinkFn(eventSinks, childrenSinks, localSettings, sinkNames) {
  return reduce(
    computeReducedSink(eventSinks, childrenSinks, localSettings, {}),
    {}, sinkNames
  )
}

function computeChildrenSinks(children, extendedSources, localSettings) {
  return mapIndexed(
    (childComponent, index) => {
      const childComponentName = childComponent.name || index

      console.group(`computing children sinks for ${childComponentName}`)

      const childSinks = childComponent(extendedSources, localSettings)

      console.groupEnd()

      return childSinks
    },
    children
  )
}

// m :: Opt Component_Def -> Opt Settings -> [Component] -> Component
/**
 * Returns a component specified by :
 * - a component definition object (nullable)
 * - outer settings (nullable)
 * - children components (or none)
 * Component definition properties :
 * - mergeSinks : computes resulting sinks or a specific sinks according to
 * configuration. See type information
 * - computeSinks : computes resulting sinks by executing the
 * children component and parent and merging the result
 * - checkPreConditions : default to nothing
 * - checkPostConditions : default to checking all sinks are observables or `null`
 * - makeLocalSources : default -> null
 * - makeLocalSettings : default -> null
 * - makeOwnSinks : -> default null
 *
 * # Algorithm
 * The factored algorithm which derives sinks from sources is as follows :
 * - merging current `sources` with extra sources if any (configured with `makeLocalSources`)
 * - computing children sinks by executing the children components on the
 * merged sources
 * - computing some parent-component-specific sinks (i.e. that computation depends only on the
 * `sources` and `settings` parameter)
 * - merging the parent sinks with the children sinks
 *
 * There are two specification formats for the final component, according to the level of
 * granularity desired - the short spec and the detailed spec :
 * - short spec :
 *   one function `computeSinks` which computes the sinks from a children-independent sink
 *   factory, the sources, settings and children components. This is basically a big function
 *   which takes all information at disposal to compute the computed component sinks in one
 *   go. As such, this function gathers several concerns (source fetching, sinks creation,
 *   sinks merging, etc.).
 *   The rationale behind that function is that sometimes one needs complete control over the
 *   creation of the generation of the sinks for the computed component. Because the array of
 *   children components is passed directly (vs. passing the post-execution children
 *   components sinks), that function has total freedom over deciding how to compute
 *   and incorporate the children sinks.
 *   For the short spec, the relevant properties are :
 *   - `computeSinks`, `makeOwnSinks`,
 *   - the user-defined factories, the user-defined contracts
 * - detailed spec :
 *   For the detailed spec, the relevant properties are :
 *   - `makeOwnSinks`, `mergeSinks`,
 *   - the user-defined factories, the user-defined contracts
 *   TODO : in fact, the dichotomy short/detailed is not really valid - follow terminology of m docs
 *
 * Children components and local sinks factory functions will be called with the extended sources
 * (i.e. provided sources merged with locally computed sources, and settings resulting from
 * the three-way settings merge described thereafter).
 *
 * The goal of these functions is as follows:
 * - `makeOwnSinks(sources, settings)` : computation of children-independent sinks, i.e.
 * specific to that `m` factory call.
 * - `mergeSinks(ownSinks, childrenSinks, localSettings)` : outputs computed component sinks
 * as a result of the children-independent sinks, the children-generated sinks, and the
 * three-way merged settings received by the `m` factory and its run-time environment.
 *
 * @param {DetailedComponentDef} componentDef
 * @param {Settings} _settings
 * @param {Array<Component> | Array<ParentAndChildren>} componentTree
 *
 * @returns {Component}
 * @throws when type- and user-specified contracts are not satisfied
 *
 * # User-defined contracts
 * Contract functions allows to perform additional user-defined contract checking before computing
 * the component, for instance :
 * - check that sources have the expected properties
 * - check that the computed sinks have the expected type or properties
 *
 * # Sources
 * The factory-computer component is called with a `sources` argument which is the result of
 * the merge between the `sources` argument passed to the factory and the `sources` resulting
 * from the local sources factory (via `makeLocalSources`). In case of conflict, the local
 * sources factory has the lowest precedence vs. the factory sources.
 * It is important to note that this local sources factory function is called with a settings
 * parameter which ignores the local settings factory! Hence local settings cannot influence
 * the creation of sources.
 * In fact, there is almost no cases where an extra source might depend on settings. In the
 * vast majority of the cases, we expect the local sources factory to be independent of any
 * settings.
 *
 * # Settings
 * The output component returned by the `m` utility receives settings (at call time), termed in
 * what follows as inner settings. The `m` utility also receives settings, termed here as
 * outer settings. Any computation performed by the output component will be equivalent to
 * that of the same output component who would have received a merge of the inner and outer
 * settings. This allows the component factory `m` to parameterize/customize the behaviour of
 * its computed component. This in particular means that the outer settings take precedence
 * over the inner settings in case of conflict.
 *
 * Such merging conflicts are to be avoided in general. Having the computed component
 * behaviour depending on a parameter external to its definition means that one can no longer
 * reason about the component behaviour in isolation, but needs to know about the component's
 * context (position in the component tree).
 * There are however some valid cases when the equivalent of environment variables needs to be
 * passed down to components. Rather than explicitly passing those parameters to every
 * component individually down the component tree, it is enough to pass it once at some level,
 * and those parameters will be :
 * - visible at every lower level
 * - cannot be altered by lower-level components
 *
 * Those 'environment variables' should reflect concerns which are fairly orthogonal to the
 * component (leaf indexing, sinks signature, etc.), so that they do not interact with the
 * intended behaviour of the component.
 *
 * To complicate the matter further, as a part of the component definition, one can include
 * what is term here as computed settings (derived from the merge of inner and outer
 * settings). Those computed (at call time) settings are merged to the other two and have the
 * lowest precedence level of all. They aim at covering fairly narrow cases, and allow for
 * temporary customization of component behaviour (another call can result in a different
 * behaviour for the component).
 *
 * So :
 * - settings passed to the `m` factory are permanent and inherited by both the computed
 * component, and the children components which are part of the `m` factory definition
 * - the computed component is called with settings which are automatically passed down the
 * children components passed to the factory
 * - the children component behaviour can, if there is no conflict with existing settings,
 * be customized further by the local settings factory, which is a part of the `m` factory
 * definition
 *
 * TODO : this only clarifies the precedence between the factory and its computed component.
 * It might just be the opporiste of what is described there... because of tree evaluation order
 * There is a third case which is that the computed component receives also settings from
 * its upper hierarchy... To be detailed with examples, that\s the best given the three-way dance.
 * Also note that the settings passed down to children component from
 *
 * IMPLEMENTATION NOTES:
 * Source contracts are checked before merging incoming sources and user-configured sources
 * Settings contracts are checked on the final settings for the component, which is the result
 * of the merge of the outer settings passed through the `m` utility, and the inner settings
 * passed to the output component.
 *
 */
function m(componentDef, _settings, componentTree) {
  console.groupCollapsed('m factory > Entry');
  console.log('componentDef, _settings, children', componentDef, _settings, componentTree);

  // Check contracts
  assertContract(hasMsignature, [componentDef, _settings, componentTree],
    `m > assertContract : error checking signature (componentDef, settings, children) = 
   ${format({ componentDef, _settings, _children: componentTree })}!`);

  let {
    makeLocalSources, makeLocalSettings, mergeSinks,
    computeSinks, checkPostConditions, checkPreConditions
  } = componentDef;
  // DOC : beware of [ParentComponent] is not possible, it is read as [UniqueChild]
  // DOC : should be [ParentComponent, []] instead! That can be a source of frequent errors...
  // TODO : so maybe have ALWAYS the same shape, so here [null, []] and [null, [UniqueChild]]??
  // TODO : in any case, all the functions with check at least one child must check it right
  let makeOwnSinks;
  let childrenComponents;

  // Basically distinguish between [Parent, [child]], and [child], and get the Parent, and [child]
  // DOC : [null, [child]] is allowed
  if (isNil(componentTree[1])){
    makeOwnSinks = always(null);
    childrenComponents = componentTree;
  }
  else if (isArray(componentTree[1])){
    makeOwnSinks = defaultTo(always(null), componentTree[0]);
    childrenComponents = componentTree[1];
  }
  else {
    makeOwnSinks = always(null);
    childrenComponents = componentTree;
  }
  // NOTE : there is no more branches as we already type-checked prior to here

  // Set default values
  _settings = _settings || {};
  makeLocalSources = defaultTo(always(null), makeLocalSources);
  makeLocalSettings = defaultTo(always({}), makeLocalSettings);
  mergeSinks = defaultTo({}, mergeSinks);
  checkPostConditions = defaultTo(always(true), checkPostConditions);
  checkPreConditions = defaultTo(always(true), checkPreConditions);

  console.groupEnd();

  return function mComponent(sources, innerSettings) {
    /** @type {String}*/
    const traceInfo = (innerSettings && innerSettings.trace) || (_settings && _settings.trace);
    console.groupCollapsed(`${traceInfo} component > Entry`);
    console.debug('sources, innerSettings', sources, innerSettings);

    innerSettings = innerSettings || {};
    const mergedSettings = deepMerge(innerSettings, _settings);

    // Note that per `merge` ramda spec. the second object's values
    // replace those from the first in case of key conflict
    const localSettings = deepMerge(
      makeLocalSettings(mergedSettings),
      mergedSettings
    );

    console.debug('inner and outer settings merge', mergedSettings);
    console.debug(`${traceInfo} component : final settings`, localSettings);

    // Computes and MERGES the extra sources which will be passed
    // to the children and this component
    // Extra sources are derived from the `sources`
    // received as input, which remain untouched
    const extendedSources = merge(
      sources,
      makeLocalSources(sources, localSettings)
    );

    assertSourcesContracts([extendedSources, localSettings], checkPreConditions);

    let reducedSinks;

    // Case : computeSinks is defined
    if (computeSinks) {
      console.groupCollapsed(`${traceInfo} component > computeSinks`)
      reducedSinks = computeSinks(
        makeOwnSinks, childrenComponents, extendedSources, localSettings
      )
      console.log(`${traceInfo} : m > computeSinks returns : `, reducedSinks);
      assertContract(isOptSinks, [reducedSinks], `${traceInfo} : m > computeSinks : must return sinks!, returned ${format(reducedSinks)}`);
      console.groupEnd()
    }
    // Case : computeSinks is not defined, merge is defined in mergeSinks
    else {
      console.groupCollapsed(`${traceInfo} component > makeOwnSinks`);
      console.debug(`called with extendedSources : ${keys(extendedSources)}`);
      console.debug(`called with localSettings`, localSettings);

      const ownSinks = makeOwnSinks(extendedSources, localSettings);

      console.debug(`${traceInfo} component > makeOwnSinks returns : `, ownSinks);
      console.groupEnd();

      console.group(`${traceInfo} component > computing children sinks`);
      console.debug(`called with extendedSources : ${keys(extendedSources)}`);
      console.debug(`called with localSettings`, localSettings);

      const childrenSinks = computeChildrenSinks(childrenComponents, extendedSources, localSettings);

      console.debug(`${traceInfo} component > computing children sinks returns : `, childrenSinks);
      console.groupEnd();

      assertContract(isOptSinks, [ownSinks], 'ownSinks must be a hash of observable sink');
      assertContract(isArrayOptSinks, [childrenSinks], 'childrenSinks must' +
        ' be an array of sinks');

      // Merge the sinks from children and one-s own...
      // Case : mergeSinks is defined through a function
      if (isFunction(mergeSinks)) {
        console.groupCollapsed(`${traceInfo} component > (fn) mergeSinks`);
        console.debug(`called with ownSinks : ${format(keys(ownSinks))}, 
                       childrenSinks: ${format(childrenSinks.map(keys))}`);
        console.debug(`called with localSettings`, localSettings);

        reducedSinks = mergeSinks(ownSinks, childrenSinks, localSettings);

        console.debug(`${traceInfo} component > (fn) mergeSinks returns :`, reducedSinks)
        assertContract(isOptSinks, [reducedSinks], `${traceInfo} : m > mergeSinks (fn) : must return sinks!, returned ${format(reducedSinks)}`);
        console.groupEnd()
      }
      // Case : mergeSinks is defined through an object
      else {
        const allSinks = flatten(removeNullsFromArray([ownSinks, childrenSinks]))
        const sinkNames = getSinkNamesFromSinksArray(allSinks)

        console.groupCollapsed(`${traceInfo} component > (obj) mergeSinks`)
        console.log(`mergeSinks fn defined for sinks ${keys(mergeSinks)}`)
        console.debug(`called with ownSinks : ${format(keys(ownSinks))}, 
                       childrenSinks: ${format(childrenSinks.map(keys))}`)
        console.debug(`called with localSettings`, localSettings)

        reducedSinks = reduce(
          computeReducedSink(ownSinks, childrenSinks, localSettings, mergeSinks),
          {}, sinkNames
        );

        console.debug(`${traceInfo} component > (obj) mergeSinks returns :`, reducedSinks)
        assertContract(isOptSinks, [reducedSinks], `${traceInfo} : m > mergeSinks (obj) : must return sinks!, returned ${format(reducedSinks)}`);
        console.groupEnd()
      }
    }

    assertSinksContracts(reducedSinks, checkPostConditions);

    const tracedSinks = traceSinks(traceInfo, reducedSinks);

    console.groupEnd()
    return tracedSinks
  }
}

export { m, defaultMergeSinkFn, computeDOMSinkDefault, computeReducedSink }

// TODO : design better trace information
// for instance outer trace could be concatenated to inner trace to trace also the
// component hierarchy
// TODO : also add slot mechanism to default DOM merge to include child component at given
// position of parent : PUT THE SLOT IN VNODE DATA property
//       necessary to add a `currentPath` parameter somewhere which
//       carries the current path down the tree
// TODO : rethink maybe design of makeOwnSinks : that is the parent component!!
// - change the name to parentComponent, or make it the first of the array, or
// [parent,[children]], whatever is best, but seems better to take it out of first arg so I
// can then easily curry on the first argument (parent cmponent concern bothers here)
// - update tests
// - update components - see if tests are passing
// - update documentation of m
//   - actually change the case for m, starting with example
