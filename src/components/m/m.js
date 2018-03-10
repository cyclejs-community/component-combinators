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

import {COMBINE_ALL_SINKS_SPECS, COMBINE_GENERIC_SPECS, COMBINE_PER_SINK_SPECS} from './properties'
import {
  CHILDREN_ONLY, componentTreePatternMatchingPredicates, CONTAINER_AND_CHILDREN, emitNullIfEmpty, format,
  getSinkNamesFromSinksArray, makePatternMatcher, ONE_COMPONENT_ONLY, projectSinksOn, removeNullsFromArray,
  traverseTree,
} from "../../../utils/src/index"
import {
  assertContract, assertSinksContracts, assertSourcesContracts, isArrayOf, isArrayOptSinks, isEmptyArray, isFunction,
  isMergeSinkFn, isOptSinks, isVNode
} from "../../../contracts/src/index"
import {
  addIndex, always, clone, concat, defaultTo, flatten, is, keys, map, merge, mergeWith, path, reduce, T
} from "ramda"
import { div } from "cycle-snabbdom"
import Rx from "rx"
import { hasMsignature, hasNoTwoSlotsSameName } from "./types"

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
function isSlotHole(vnode) {
  return vnode && vnode.data && 'slot' in vnode.data && true
}

const StoreConstructor = Array;

function pushFn(arr, node) {arr.push(node)}

// NOTE : we use `shift` here to simulate a queue structure, so we traverse breadth-first
// Breadth-first traversal is important to reflect the precedency of each slot
// However depth-first would give the same end result, just less efficient
// For instance `{slot0, children: [slot1]]` with content for all slots, content for
// `slot0` will erase all content put in `slot1`, so it is better to set `slot0` content first
function popFn(arr) {return arr.shift()}

function isEmptyStoreFn(arr) {return arr.length === 0}

function getChildrenFn(vnode) {return vnode.children ? vnode.children : []}

function visitFn(vnode) {
  return isSlotHole(vnode)
    ? vnode
    : null
}

/**
 *
 * @param vNode
 * @returns {Array.<VNode>} returns an array of whatever
 * structure `visitFn`
 * is returning
 */
function getSlotHoles(vNode) {
  if (!vNode) throw `getSlotHoles : internal error, vNode cannot be falsy!`

  const slotHoles = removeNullsFromArray(
    traverseTree({ StoreConstructor, pushFn, popFn, isEmptyStoreFn, getChildrenFn, visitFn }, vNode)
  );

  const slotNames = slotHoles.map(path(['data', 'slot']));

  // Edge case : at least one slot name has more than one corresponding slot hole
  // NOTE : I could perfectly allow such duplication - children content with the duplicated
  // slot would be copied once in several locations, that could be a feature too, but not for now
  assertContract(hasNoTwoSlotsSameName, [slotHoles, slotNames],
    `m > getSlotHoles : at least one slot name has more than one corresponding slot hole! For information : array of slot names should show duplicated - ${slotNames}`);

  // Main case : no given slot name has more than one corresponding slot hole
  return slotHoles
}

/**
 * Returns a hashmap associating a slot with an array of vnode featuring that slot
 * A vnode will be considered to belong to a slot if at the top level of its node tree it has
 * a truthy slot property (should be a string, NOT CHECKED here) in its `vnode.data` object
 * Children which are not associated to a slot, will be put in the `undefined` slot
 * @param {Array.<*>} childrenVNode
 * @returns {Object.<string, Array.<VNode>>}
 */
function rankChildrenBySlot(childrenVNode) {
  return childrenVNode.reduce((acc, vnode) => {
    if (vnode && vnode.data) {
      acc[vnode.data.slot] = acc[vnode.data.slot] || [];
      acc[vnode.data.slot].push(vnode)
    }

    return acc
  }, {})
}

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
  // NOTE : some of those children sinks could be null, that is filtered out
  const childrenDOMSinkOrNull = map(emitNullIfEmpty, childrenSink);

  const allSinks = flatten([parentDOMSinkOrNull, childrenDOMSinkOrNull]);
  const allDOMSinks = removeNullsFromArray(allSinks);

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
    let _arrayVNode = removeNullsFromArray(arrayVNode);
    assertContract(isArrayOf(isVNode), [_arrayVNode], 'DOM sources must' +
      ' stream VNode objects! Got ' + _arrayVNode)

    if (!parentDOMSink) {
      // Case : the parent sinks does not have a DOM sink
      // That's simple : no slotting, no nothing, just pass the children on if any
      switch (_arrayVNode.length) {
        case 0 :
          return null
        /*
         // To avoid putting an extra `div` when there is only one vNode,
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
    else {
      // TODO:need! why?? where is that ever modified? deep cloning stuff kills performance
      let parentVNode = clone(_arrayVNode.shift());
      let childrenVNode = _arrayVNode;
      parentVNode.children = parentVNode.children || [];
      const slotHoles = getSlotHoles(parentVNode);

      // ALG : if the parent vTree has some slot holes, then try to fill them in with the children
      // slot content, if any can be found
      // Note that if the parent has an undefined slot, children content with no slot will be
      // copied there
      const slotChildrenHashmap = rankChildrenBySlot(childrenVNode);

      if (!isEmptyArray(slotHoles)) {
        slotHoles.forEach(slotHole => {
          const slotName = slotHole.data.slot;
          const childrenSlotContent = slotChildrenHashmap[slotName];
          if (childrenSlotContent) {
            slotHole.children = childrenSlotContent
          }
        });
      }

      const parentHasUndefinedSlot = slotHoles.some(slotHole => {
        return slotHole.data.slot === undefined
      });
      const childrenVNodesWithNoSlots = slotChildrenHashmap && slotChildrenHashmap[undefined];

      // ALG : if the parent node did not define a default slot for children content, then put
      // that content by default at the end of the parent VNodes
      if (!parentHasUndefinedSlot) {
        // Two cases here :
        // - The parent's vNode has a `text` property :
        //   we move that text to a text vNode at first position in the children
        //   then we add the children's DOM in last position of the
        // existing parent's children
        // - The parent's vNode does not have a `text` property :
        //   we just add the children's DOM in last position of the exisitng
        //   parent's children
        // Note that this is specific to the snabbdom vNode data structure
        // childrenVNode could be null if all children sinks are empty
        // observables, in which case we just return the parentVNode
        if (childrenVNodesWithNoSlots) {
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
          Array.prototype.push.apply(parentVNode.children, childrenVNodesWithNoSlots)
        }
      }

      return parentVNode
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

function deconstructHooksFromSettings(settings) {
  return settings && settings._hooks
    ? settings._hooks
    : { preprocessInput: undefined, postprocessOutput: undefined }
}

function computeSinksWithGenericStrategy(computeSinks, parentComponent, childrenComponents, extendedSources, localSettings){
  return computeSinks(        parentComponent, childrenComponents, extendedSources, localSettings      )
}

function computeSinksWithAllSinksStrategy(mergeSinks, parentComponent, childrenComponents, extendedSources, localSettings){
  console.groupCollapsed(`computeSinksWithAllSinksStrategy`);
  console.trace(`Computing container sinks with settings : %O`, localSettings);

  const containerSinks = parentComponent(extendedSources, localSettings);

  console.trace(`Computed container sinks`);

  console.trace(`Computing children sinks with settings : %O`, localSettings);

  const childrenSinks = computeChildrenSinks(childrenComponents, extendedSources, localSettings);

  console.trace(`Computed children sinks`);

  assertContract(isOptSinks, [containerSinks], 'containerSinks must be a hash of observable sink');
  assertContract(isArrayOptSinks, [childrenSinks], 'childrenSinks must be an array of sinks');

  console.trace(`Computing reduced sinks`);

  const reducedSinks = mergeSinks(containerSinks, childrenSinks, localSettings);

  console.trace(`Computed reduced sinks`);
  console.groupEnd()

  return reducedSinks
}

function computeSinksWithPerSinkStrategy(mergeSinks, parentComponent, childrenComponents, extendedSources, localSettings) {
  console.groupCollapsed(`computeSinksWithPerSinkStrategy`);
  console.trace(`Computing container sinks with settings : %O`, localSettings);

  const containerSinks = parentComponent(extendedSources, localSettings);

  console.trace(`Computed container sinks`);

  console.trace(`Computing children sinks with settings : %O`, localSettings);

  const childrenSinks = computeChildrenSinks(childrenComponents, extendedSources, localSettings);

  console.trace(`Computed children sinks`);

  assertContract(isOptSinks, [containerSinks], 'containerSinks must be a hash of observable sink');
  assertContract(isArrayOptSinks, [childrenSinks], 'childrenSinks must be an array of sinks');

  console.trace(`Computing reduced sinks with merge functions for sinks : ${keys(mergeSinks)}`);

  const allSinks = flatten(removeNullsFromArray([containerSinks, childrenSinks]))
  const sinkNames = getSinkNamesFromSinksArray(allSinks)

  const reducedSinks = reduce(
    computeReducedSink(containerSinks, childrenSinks, localSettings, mergeSinks),
    {}, sinkNames
  );
  console.trace(`Computed reduced sinks`);
  console.groupEnd()

  return reducedSinks
}

/** TODO update
 * # Settings
 * The output component returned by the `m` utility receives settings (at call time), termed in
 * what follows as inner settings or dynamic settings. The `m` utility also receives static
 * settings (at compile time), termed here as outer settings or static settings.
 * This allows the component factory `m` to parameterize/customize the behaviour of
 * its computed component, both statically and dynamically. In the current implementation, the
 * static settings take precedence over the inner settings in case of conflict.
 *
 * Such merging conflicts are to be avoided in general. Having the computed component
 * behaviour depending statically on a parameter external to its definition means that one can no
 * longer reason about the component behaviour in isolation, but needs to know about the component's
 * context (position in the component tree).
 * There are however some valid cases when the equivalent of environment variables needs to be
 * passed down to components. Rather than explicitly passing those parameters to every
 * component individually down the component tree, it is enough to pass it once at some level,
 * and those parameters will be :
 * - visible at every lower level
 * - can be rewritten by lower level components if need arises
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
 * @param {*} _componentDef
 * @param {Settings} __settings
 * @param {Array<Component> | [ContainerComponent, Array<Component>]} _componentTree
 *
 * @returns {Component}
 * @throws when type- and user-specified contracts are not satisfied
 */
function m(_componentDef, __settings, _componentTree) {
  console.groupCollapsed('m factory > Entry');
  console.log('componentDef, _settings, children', _componentDef, __settings, _componentTree);

  // Check contracts
  assertContract(hasMsignature, [_componentDef, __settings, _componentTree],
    `m > assertContract : error checking signature (componentDef, settings, children) = 
   ${format({ _componentDef, __settings, _children: _componentTree })}!`);

  // TODO : add corresponding contracts in future version, cf. hasMsignature where the contract as of now is empty
  const { preprocessInput, postprocessOutput } = deconstructHooksFromSettings(__settings);

  const { componentDef, settings: _settings, componentTree } = preprocessInput
    ? preprocessInput(_componentDef, __settings, _componentTree)
    : { componentDef: _componentDef, settings: __settings || {}, componentTree: _componentTree };

  const makeLocalSources = componentDef.makeLocalSources || always(null);
  const makeLocalSettings = componentDef.makeLocalSettings || always({});
  const mergeSinks = componentDef.mergeSinks || {};
  const computeSinks = componentDef.computeSinks;
  const checkPostConditions = componentDef.checkPostConditions || T;
  const checkPreConditions = componentDef.checkPreConditions || T;

  // Basically distinguish between [Parent, [child]], and [child], and get the Parent, and [child]
  // DOC : [null, [child]] is allowed, but to avoid though
  const { parentComponent, childrenComponents } =
    makePatternMatcher(componentTreePatternMatchingPredicates, {
      // TODO : refactor later the pattern match to only two cases (remove one component)
      [ONE_COMPONENT_ONLY]: componentTree => ({ parentComponent: always(null), childrenComponents: componentTree }),
      [CONTAINER_AND_CHILDREN]: componentTree => ({
        parentComponent: defaultTo(always(null), componentTree[0]),
        childrenComponents: componentTree[1]
      }),
      [CHILDREN_ONLY]: componentTree => ({ parentComponent: always(null), childrenComponents: componentTree })
    })(componentTree);

  console.groupEnd();

  function mComponent(sources, innerSettings) {
    const traceInfo = (innerSettings && innerSettings._trace.combinatorName) || (_settings && _settings._trace);
    console.groupCollapsed(`${traceInfo} component > Entry`);
    console.debug('sources, innerSettings', sources, innerSettings);

    innerSettings = innerSettings || {};
    const mergedSettings = deepMerge(innerSettings, _settings);

    // Note that per `merge` ramda spec. the second object's values
    // replace those from the first in case of conflict of keys
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

    // Identify and apply the strategy defined
    const componentDefPatternMatchingPredicates = [
      [COMBINE_GENERIC_SPECS, componentDef => Boolean(componentDef.computeSinks)],
    [COMBINE_ALL_SINKS_SPECS, componentDef => Boolean(componentDef.mergeSinks && isFunction(componentDef.mergeSinks))],
    [COMBINE_PER_SINK_SPECS, T]
    ];

    const reducedSinks = makePatternMatcher(componentDefPatternMatchingPredicates, {
      [COMBINE_GENERIC_SPECS] : _ => computeSinksWithGenericStrategy(computeSinks, parentComponent, childrenComponents, extendedSources, localSettings),
      [COMBINE_ALL_SINKS_SPECS] : _ => computeSinksWithAllSinksStrategy(mergeSinks, parentComponent, childrenComponents, extendedSources, localSettings),
      [COMBINE_PER_SINK_SPECS] : _ => computeSinksWithPerSinkStrategy(mergeSinks, parentComponent, childrenComponents, extendedSources, localSettings)
    })(componentDef);

    assertContract(isOptSinks, [reducedSinks], `m > computeSinks : must return sinks!, returned ${format(reducedSinks)}`);
    assertSinksContracts(reducedSinks, checkPostConditions);

    console.groupEnd()
    return reducedSinks
  }

  return postprocessOutput ? postprocessOutput(mComponent) : mComponent
}

export {
  m, defaultMergeSinkFn, computeDOMSinkDefault, mergeChildrenIntoParentDOM, computeReducedSink,
  getSlotHoles, rankChildrenBySlot
}
