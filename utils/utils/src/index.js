import { curry, defaultTo, isNil, keys, mapObjIndexed, pipe, reject, values } from "ramda"

const ERROR_MESSAGE_PREFIX = 'ERROR : '

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
    { makeFunctionDecorator, decoratorSpec, fnToDecorate, fnToDecorateName });
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

export {
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
  filterNull
}
