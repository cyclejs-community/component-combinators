import { curry, defaultTo, isNil, keys, mapObjIndexed, pipe, reject, values, tap, uniq, flatten, map, reduce, equals } from "ramda"
import Rx from "rx"
import { div, nav } from "cycle-snabbdom"
import toHTML from "snabbdom-to-html"
// import { StandardError } from "standard-error"
import formatObj from 'pretty-format'

const $ = Rx.Observable;
const ERROR_MESSAGE_PREFIX = 'ERROR : '
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

/**
 * Returns an object whose keys :
 * - the first key found in `obj` for which the matching predicate was
 * fulfilled. Predicates are tested in order of indexing of the array.
 * - `_index` the index in the array where a predicate was fulfilled if
 * any, undefined otherwise
 * Ex : unfoldObjOverload('DOM', {sourceName: isString, predicate:
    * isPredicate})
 * Result : {sourceName : 'DOM'}
 * @param obj
 * @param {Array<Object.<string, Predicate>>} overloads
 * @returns {{}}
 */
function unfoldObjOverload(obj, overloads) {
  let result = {};
  let index = 0;

  overloads.some(overload => {
    // can only be one property
    const property = keys(overload)[0];
    const predicate = values(overload)[0];
    const predicateEval = predicate(obj);

    if (predicateEval) {
      result[property] = obj;
      result._index = index
    }
    index++;

    return predicateEval
  });
  return result
}

function isBoolean(obj) {
  return typeof(obj) === 'boolean'
}

function isString(obj) {
  return typeof(obj) === 'string'
}

// from https://github.com/substack/deep-freeze/blob/master/index.js
function deepFreeze(o) {
  Object.freeze(o);

  Object.getOwnPropertyNames(o).forEach(function (prop) {
    if (o.hasOwnProperty(prop)
      && o[prop] !== null
      && (typeof o[prop] === "object" || typeof o[prop] === "function")
      && !Object.isFrozen(o[prop])) {
      deepFreeze(o[prop]);
    }
  });

  return o;
}

function makeErrorMessage(errorMessage) {
  return ERROR_MESSAGE_PREFIX + errorMessage;
}

function removeNullsFromArray(arr) {
  return reject(isNil, arr)
}

//IE workaround for lack of function name property on Functions
//getFunctionName :: (* -> *) -> String
const getFunctionName = (r => fn => {
  return fn.name || ((('' + fn).match(r) || [])[1] || 'Anonymous');
})(/^\s*function\s*([^\(]*)/i);

// cf.
// http://stackoverflow.com/questions/9479046/is-there-any-non-eval-way-to-create-a-function-with-a-runtime-determined-name
/**
 *
 * @param name
 * @param {Array<String>} args Names for the arguments of the function
 * @param {String} body Body of the function (source string)
 * @param {Object | Array} scope Extra VALUES to pass to the function, addressable by their name.
 * Note that
 * the values that will be seen are the ones at the moment of the call, i.e. eager eval, NOT
 * closure, those are CONSTANT values, not variables. BUT among those values can be functions!
 * so useful to put functions in scope. Those functions can have their own closure. That helps
 * solving the issue (or advantage) that Function does not create closure from its environment.
 * @param {null | Array} values if `values` is an array, so must be `scope`. In this case,
 * `scope` must be an array of property keys, `values` being the corresponding array of values
 * NOTE : very poorly written function in terms of readability...
 * @returns {Function}
 * @example
 * --
 * var f = NamedFunction("fancyname", ["hi"], "display(hi);", {display:display});
 * f.toString(); // "function fancyname(hi) {
 *               // display(hi);
 *               // }"
 *  f("Hi");
 *  --
 *  `display` can be defined anywhere and as any function can close over its context
 * @constructor
 */
function NamedFunction(name, args, body, scope, values) {
  if (typeof args == "string")
    values = scope, scope = body, body = args, args = [];
  if (!Array.isArray(scope) || !Array.isArray(values)) {
    if (typeof scope == "object") {
      var keys = Object.keys(scope);
      values = keys.map(function (p) { return scope[p]; });
      scope = keys;
    } else {
      values = [];
      scope = [];
    }
  }
  return Function(scope, "function " + name + "(" + args.join(", ") + ") {\n" + body + "\n}\nreturn " + name + ";").apply(null, values);
}

// decorateWith(decoratingFn, fnToDecorate), where log :: fn -> fn such as both have same name
// and possibly throw exception if that make sense to decoratingFn
function decorateWithOne(decoratorSpec, fnToDecorate) {
  const fnToDecorateName = getFunctionName(fnToDecorate);

  return NamedFunction(fnToDecorateName, [], `
      const args = [].slice.call(arguments);
      const decoratingFn = makeFunctionDecorator(decoratorSpec);
      return decoratingFn(args, fnToDecorateName, fnToDecorate);
`,
    { makeFunctionDecorator, decoratorSpec, fnToDecorate, fnToDecorateName }, undefined);
}

const decorateWith = curry(function decorateWith(decoratingFnsSpecs, fnToDecorate) {
  return decoratingFnsSpecs.reduce((acc, decoratingFn) => {
    return decorateWithOne(decoratingFn, acc)
  }, fnToDecorate)
});

/**
 * NOTE : incorrect declaration... TODO : correct one day
 * before(fnToDecorate, fnToDecorateName, args) or nil
 * after(fnToDecorate, fnToDecorateName, result) or nil
 * but not both nil
 * TODO : incoherent! after can modify returned value but before cannot
 * TODO : refactor as standard advice : before, around, after - only around can modify flow/args
 * TODO : edge case not dealt with : throwing?
 * @returns {function(fnToDecorate: Function, fnToDecorateName:String, args:Array<*>)}
 */
function makeFunctionDecorator({ before, after, name }) {
  // we can have one of the two not specified, but if we have none, there is no decorator to make
  if ((typeof before !== 'function') && (typeof after !== 'function')) {
    throw `makeFunctionDecorator: you need to specify 'before' OR 'after' as decorating functions. You passed falsy values for both!`
  }

  const decoratorFnName = defaultTo('anonymousDecorator', name);

  // trick to get the same name for the returned function
  // cf.
  // http://stackoverflow.com/questions/9479046/is-there-any-non-eval-way-to-create-a-function-with-a-runtime-determined-name
  // BUG : does not seem to work in chrome actually. HAve to use Function constructor, hence eval...
  // NOTE : NamedFunction hence works
  const obj = {
    [decoratorFnName](args, fnToDecorateName, fnToDecorate) {
      before && before(args, fnToDecorateName, fnToDecorate);

      const result = fnToDecorate(...args);

      return after
        ? after(result, fnToDecorateName, fnToDecorate)
        : result;
    }
  };

  return obj[decoratorFnName];
}

const assertFunctionContractDecoratorSpecs = fnContract => ({
  before: (args, fnToDecorateName) => {
    const checkDomain = fnContract.checkDomain;
    const contractFnName = getFunctionName(checkDomain);
    const passed = checkDomain(...args);

    if (!isBoolean(passed) || (isBoolean(passed) && !passed)) {
      // contract is failed
      console.error(`assertFunctionContractDecorator: ${fnToDecorateName} fails contract ${contractFnName} \n
${isString(passed) ? passed : ''}`);
      throw `assertFunctionContractDecorator: ${fnToDecorateName} fails contract ${contractFnName}`
    }
  },
  after: (result, fnToDecorateName) => {
    const checkCodomain = fnContract.checkCodomain;
    const contractFnName = getFunctionName(checkCodomain);
    const passed = checkCodomain(result);

    if (!isBoolean(passed) || (isBoolean(passed) && !passed)) {
      // contract is failed
      console.error(`assertFunctionContractDecorator: ${fnToDecorateName} fails contract ${contractFnName} \n
${isString(passed) ? passed : ''}`);
      throw `assertFunctionContractDecorator: ${fnToDecorateName} fails contract ${contractFnName}`
    }

    return result;
  }
});

function preventDefault(ev) {
  if (ev) ev.preventDefault()
}

function addPrefix(prefix) {
  return function (str) {
    return prefix + str
  }
}

function noop() {

}

function toBoolean(x) {return !!x}

/**
 * Returns a function which turns an object to be put at a given path location into an array of
 * JSON patch operations
 * @param {JSON_Pointer} path
 * @returns {Function}
 */
function toJsonPatch(path) {
  return pipe(
    mapObjIndexed((value, key) => ({
      op: "add",
      path: [path, key].join('/'),
      value: value
    })),
    values
  );
}

function stripHtmlTags(html) {
  let tmp = document.createElement("DIV");
  tmp.innerHTML = html;

  const strippedContent = tmp.textContent || tmp.innerText || "";

  tmp.remove();

  return strippedContent
}

/**
 * Iterative tree traversal generic algorithm
 * @param StoreConstructor a constructor for either a queue (breadth-first) or a stack
 * structure (depth-first)
 * @param {Function} pushFn queue or push instruction
 * @param {Function} popFn dequeue or pop instruction
 * @param {Function} isEmptyStoreFn check if the data structure used to store node to
 * process is empty
 * @param {Function} visitFn the visiting function on the node. Its results are accumulated
 * into the final result of the traverseTree function
 * @param {Function} getChildrenFn give the children for a given node
 * @param root the root node of the tree to traverse
 */
function traverseTree({ StoreConstructor, pushFn, popFn, isEmptyStoreFn, visitFn, getChildrenFn },
                      root) {
  const traversalResult = [];
  const store = new StoreConstructor();
  pushFn(store, root);
  while ( !isEmptyStoreFn(store) ) {
    const vnode = popFn(store);
    traversalResult.push(visitFn(vnode));
    getChildrenFn(vnode).forEach((child, index) => pushFn(store, child));
  }

  return traversalResult
}

function firebaseListToArray(fbList) {
  // will have {key1:element, key2...}
  return values(fbList)
}

function getInputValue(document, sel) {
  const el = document.querySelector(sel);
  return el ? el.value : ''
}

function filterNull(driver) {
  return function filteredDOMDriver(sink$) {
    return driver(sink$.filter(Boolean))
  }
}

// debug
/**
 * Adds `tap` logging/tracing information to all sinks
 * @param {String} traceInfo
 * @param {Sinks} sinks
 * @returns {*}
 */
function traceSinks(traceInfo, sinks) {
  return mapObjIndexed((sink$, sinkName) => {
    return sink$
      ? sink$.tap(function log(x) {
        console.debug(`traceSinks > ${traceInfo} > sink ${sinkName} emits :`, x)
      })
      // Pass on null and undefined values as they are, they will be filtered out downstream
      : sink$
  }, sinks)
}

const logFnTrace = (title, paramSpecs) => ({
  before: (args, fnToDecorateName) =>
    console.info(`==> ${title.toUpperCase()} | ${fnToDecorateName}(${paramSpecs.join(', ')}): `, args),
  after: (result, fnToDecorateName) => {
    console.info(`<== ${title.toUpperCase()} | ${fnToDecorateName} <- `, result);
    return result
  },
});

function toHTMLorNull(x) {
  return x ? toHTML(x) : null
}

function convertVNodesToHTML(vNodeOrVnodes) {
  if (Array.isArray(vNodeOrVnodes)) {
    console.debug(`toHTML: ${vNodeOrVnodes.map(x => x ? toHTML(x) : null)}`)
    return vNodeOrVnodes.map(toHTMLorNull)
  }
  else {
    console.debug(`toHTML: ${toHTMLorNull(vNodeOrVnodes)}`)
    return toHTMLorNull(vNodeOrVnodes)
  }
}

function formatArrayObj(arr, separator) {
  return arr.map(format).join(separator)
}

function format(obj) {
  // basically if obj is an object, use formatObj, else use toString
  if (obj === 'null') {
    return '<null>'
  }
  else if (obj === 'undefined') {
    return '<undefined>'
  }
  else if (typeof(obj) === 'string' && obj.length === 0) {
    return '<empty string>'
  }
  else if (Array.isArray(obj)) {
    return formatArrayObj(obj, ' ; ')
  }
  else if (typeof(obj) === 'object') {
    if (keys(obj).length === 0) {
      // i.e. object is {}
      return '<empty object>'
    }
    else return formatObj(obj, {maxDepth : 3})
  }
  else {
    return "" + obj
  }
}

function traceFn(fn, text) {
  return pipe(fn, tap(console.warn.bind(console, text ? text + ":" : "")))
}

/**
 * @typedef {{before:Function, after:Function, afterThrowing:Function, afterReturning:Function, around:Function}} Advice
 */
const decorateWithAdvices = curry(_decorateWithAdvices);

/**
 *
 * @param {Array<Advice>} advices
 * @param {Function} fnToAdvise
 * @returns {Function} function decorated with the advices
 */
function _decorateWithAdvices(advices, fnToAdvise) {
  return advices.reduce((acc, advice) => {
    return decorateWithAdvice(advice, acc)
  }, fnToAdvise)
}

function decorateWithAdvice(advice, fnToAdvise) {
  const fnToDecorateName = getFunctionName(fnToAdvise);

  return NamedFunction(fnToDecorateName, [], `
      const args = [].slice.call(arguments);
      const decoratingFn = makeAdvisedFunction(advice);
      const joinpoint = {args, fnToDecorateName};
      return decoratingFn(joinpoint, fnToAdvise);
`,
    { makeAdvisedFunction, advice, fnToAdvise, fnToDecorateName }, undefined);
}

function makeAdvisedFunction(advice) {
  // Contract :
  // if `around` is correctly set, then there MUST NOT be a `before` and `after`
  // if `around` is not set, there MUST be EITHER `before` OR `after`
  if ('around' in advice && typeof(advice.around)==='function') {
    if ('before' in advice || 'after' in advice) {
      throw `makeAdvisedFunction: if 'around' is set, then there MUST NOT be a 'before' or 'after' property`
    }
    else {
      // Main case : AROUND advice
      return function aroundAdvisedFunction(joinpoint, fnToDecorate) {
        // NOTE : could be shorten, but left as is for readability
        return advice.around(joinpoint, fnToDecorate)
      }
    }
  }
  else if (!('before' in advice || 'after' in advice)) {
    throw `makeAdvisedFunction: if 'around' is not set, then there MUST be EITHER 'before' OR 'after' property`
  }
  else {
    // Main case : BEFORE or/and AFTER advice
    return function advisedFunction(joinpoint, fnToDecorate) {
      const {args, fnToDecorateName} = joinpoint;
      const { before, after, afterThrowing, afterReturning, around } = advice;

      before && before(joinpoint, fnToDecorate);
      let result;
      let exception;

      try {
        result = fnToDecorate.apply(null, args);

        // if advised function does not throw, then we execute `afterReturning` advice
        // TODO : Contract : if `after` then MUST NOT have `afterThrowing` or `afterReturning`
        afterReturning && afterReturning(assoc('returnedValue', result, joinpoint), fnToDecorate);
        return result
      }
      catch (_exception) {
        // Include the exception information in the joinpoint
        afterThrowing && afterThrowing(assoc('exception', _exception, joinpoint), fnToDecorate);
        exception = _exception;
        throw _exception
      }
      finally {
        // We execute `after` advice even if advised function throws
        after && after(merge({returnedValue: result, exception}, joinpoint), fnToDecorate);
      }
    };
  }
}

export {
  // Helpers
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
  labelSourceWith,
  // Misc. utils
  unfoldObjOverload,
  removeNullsFromArray,
  deepFreeze,
  makeErrorMessage,
  decorateWithOne,
  decorateWith,
  makeFunctionDecorator,
  assertFunctionContractDecoratorSpecs,
  preventDefault,
  addPrefix,
  noop,
  toJsonPatch,
  toBoolean,
  stripHtmlTags,
  ERROR_MESSAGE_PREFIX,
  traverseTree,
  firebaseListToArray,
  getInputValue,
  filterNull,
  // debug
  traceSinks,
  getFunctionName,
  logFnTrace,
  convertVNodesToHTML,
  formatArrayObj,
  format,
  traceFn,
  decorateWithAdvices,
  decorateWithAdvice
}
