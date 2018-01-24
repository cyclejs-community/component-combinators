import { equals, flatten, isNil, map, mapObjIndexed, reduce, uniq } from "ramda"
import Rx from "rx"
import { div, nav } from "cycle-snabbdom"

const $ = Rx.Observable;

const DOM_SINK = 'DOM';

// Type checking typings
/**
 * @typedef {String} ErrorMessage
 */
/**
 * @typedef {Boolean|Array<ErrorMessage>} SignatureCheck
 * Note : The booleam can only be true
 */

// Component typings
/**
 * @typedef {String} SourceName
 */
/**
 * @typedef {String} SinkName
 */
/**
 * @typedef {Rx.Observable} Source
 */
/**
 * @typedef {Rx.Observable|Null} Sink
 */
/**
 * @typedef {Object.<string, Source>} Sources
 */
/**
 * @typedef {Object.<string, Sink>} Sinks
 */
/**
 * @typedef {?Object.<string, ?Object>} Settings
 */
/**
 * @typedef {function(Sink, Array<Sink>, Settings):Sink} mergeSink
 */
/**
 * @typedef {Object} DetailedComponentDef
 * @property {?function(Sources, Settings)} makeLocalSources
 * @property {?function(Settings)} makeLocalSettings
 * @property {?function(Sources, Settings):Sinks} makeOwnSinks
 * @property {Object.<SinkName, mergeSink> | function} mergeSinks
 * @property {function(Sinks):Boolean} sinksContract
 * @property {function(Sources):Boolean} sourcesContract
 */

/**
 * @typedef {Object} ShortComponentDef
 * @property {?function(Sources, Settings)} makeLocalSources
 * @property {?function(Settings)} makeLocalSettings
 * @property {?function(Sources, Settings):Sinks} makeOwnSinks
 * @property {function(Component, Array<Component>, Sources, Settings)}
 * computeSinks
 * @property {function(Sinks):Boolean} sinksContract
 * @property {function(Sources):Boolean} sourcesContract
 */

/**
 * @typedef {function(Sources, Settings):Sinks} Component
 */

function isUndefined(obj) {
  return typeof obj === 'undefined'
}

function removeEmptyVNodes(arrVNode) {
  return reduce((accNonEmptyVNodes, vNode) => {
    return (isNullVNode(vNode)) ?
      accNonEmptyVNodes :
      (accNonEmptyVNodes.push(vNode), accNonEmptyVNodes)
  }, [], arrVNode)
}

function isNullVNode(vNode) {
  return equals(vNode.children, []) &&
    equals(vNode.data, {}) &&
    isUndefined(vNode.elm) &&
    isUndefined(vNode.key) &&
    isUndefined(vNode.sel) &&
    isUndefined(vNode.text)
}

/**
 * For each element object of the array, returns the indicated property of
 * that object, if it exists, null otherwise.
 * For instance, `projectSinksOn('a', obj)` with obj :
 * - [{a: ..., b: ...}, {b:...}]
 * - result : [..., null]
 * @param {String} prop
 * @param {Array<*>} obj
 * @returns {Array<*>}
 */
function projectSinksOn(prop, obj) {
  return map(x => x ? x[prop] : null, obj)
}

/**
 * Returns an array with the set of sink names extracted from an array of
 * sinks. The ordering of those names should not be relied on.
 * For instance:
 * - [{DOM, auth},{DOM, route}]
 * results in ['DOM','auth','route']
 * @param {Array<Sinks>} aSinks
 * @returns {Array<String>}
 */
function getSinkNamesFromSinksArray(aSinks) {
  return uniq(flatten(map(getValidKeys, aSinks)))
}

function getValidKeys(obj) {
  let validKeys = []
  mapObjIndexed((value, key) => {
    if (value != null) {
      validKeys.push(key)
    }
  }, obj)

  return validKeys
}

function makeDivVNode(x) {
  return {
    "children": undefined,
    "data": {},
    "elm": undefined,
    "key": undefined,
    "sel": "div",
    "text": x
  }
}

function vLift(vNode) {
  return function vLift(sources, settings) {
    return {
      [DOM_SINK]: $.of(vNode)
    }
  }
}

/**
 * Lifts a div function into a Div component which only has a DOM sink, whose only value emitted
 * is computed from the arguments passed
 * @returns {Component}
 */
function Div() {
  return vLift(div.apply(null, arguments))
}

function Nav() {
  return vLift(nav.apply(null, arguments))
}

/**
 *
 * @param {String} label
 * @param {Rx.Observable} source
 */
function labelSourceWith(label, source) {
  return source.map(x => ({ [label]: x }))
}

function EmptyComponent(sources, settings) {
  return {
    [DOM_SINK]: $.of(div(''))
  }
}

function DummyComponent(sources, settings) {
  return {
    [DOM_SINK]: $.of(div('dummy content'))
  }
}

/**
 * Turns a sink which is empty into a sink which emits `Null`
 * This is necessary for use in combination with `combineLatest`
 * As a matter of fact, `combineLatest(obs1, obs2)` will block till both
 * observables emit at least one value. So if `obs2` is empty, it will
 * never emit anything
 * @param sink
 * @returns {Observable|*}
 */
function emitNullIfEmpty(sink) {
  return isNil(sink)
    ? null
    : $.create(function emitNullIfEmptyObs(observer) {
      let isEmpty = true;
      sink.subscribe(function next(x) {
        isEmpty = false;
        observer.onNext(x);
      }, function error(e) {
        console.error(`emitNullIfEmpty > Error!`, e);
        observer.onError(e);
      }, function completed() {
        if (isEmpty) {
          observer.onNext(null);
        }
        observer.onCompleted();
      });

      return function dispose() {
        // No clean-up necessary
      }
    })
  /*
    return isNil(sink) ?
      null :
      $.merge(
        sink,
        sink.isEmpty().filter(x => x).map(x => null)
      )
  */
}

export {
  emitNullIfEmpty,
  EmptyComponent,
  DummyComponent,
  vLift,
  Div,
  Nav,
  DOM_SINK,
  projectSinksOn,
  getSinkNamesFromSinksArray,
  removeEmptyVNodes,
  makeDivVNode,
  labelSourceWith
}
