import {
  addIndex, all, allPass, both, curry, difference, either, flatten, flip, intersection, isEmpty,
  isNil, keys, map, mapObjIndexed, pipe, reduce, reduced, values, where
} from "ramda"
import formatObj from "fmt-obj"

const mapIndexed = addIndex(map);

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

///////
// Helpers

/**
 * Throws an exception if the arguments parameter fails at least one
 * validation rule
 * Note that all arguments are mandatory, i.e. the function does not deal with
 * optional arguments
 * @param {String} fnName
 * @param {Array<*>} _arguments
 * @param {[Array<Object.<string, Predicate|PredicateWithError>>]} vRules
 * Validation rules.
 *
 * Given f(x, y) =  x + y, with x both int, in the body of `f`, include
 * function f(x, y) {
   *   assertSignature ('f', arguments, [{x:isInteger},{y:isInteger}],
   *                  'one of the parameters is not an integer!')
   *   ...
   * }
 */
function assertSignature(fnName, _arguments, vRules) {
  const argNames = flatten(map(keys, vRules))
  const ruleFns = flatten(map(function (vRule) {
    return values(vRule)[0]
  }, vRules))

  const args = mapIndexed(function (vRule, index) {
    return _arguments[index]
  }, vRules)

  const validatedArgs = mapIndexed((value, index) => {
    const ruleFn = ruleFns[index]
    return ruleFn(value)
  }, args)

  const hasFailed = reduce((acc, value) => {
    return isFalse(value) || acc
  }, false, validatedArgs)

  if (hasFailed) {
    const validationMessages = mapIndexed((errorMessageOrBool, index) => {
        const argName = argNames[index]

        return isTrue(errorMessageOrBool) ?
          '' :
          [
            `${fnName}: argument ${argName} fails rule ${vRules[index][argName].name}`,
            isBoolean(errorMessageOrBool) ? '' : errorMessageOrBool
          ].join(': ')
      }, validatedArgs
    ).join('\n')

    const errorMessage = ['assertSignature:', validationMessages].join(' ')
    throw errorMessage
  }

  return !hasFailed
}

function assertSignatureContract(fnName, args, signatureDef) {
  let isContractFailing = false
  const argChecks = mapIndexed((paramStruct, index) => {
    const paramName = keys(paramStruct)[0]
    const [paramContract, contractErrorMessage] = paramStruct[paramName]
    if (isTrue(paramContract.call(null, args[index]))) {
      // contract is fulfilled
      return true
    }
    else {
      isContractFailing = true
      return `${paramName} fails contract ${paramContract.name} : ${contractErrorMessage}`
    }
  }, signatureDef)

  if (isContractFailing) {
    const errorMessages = map(
      boolOrErrorMessage => isString(boolOrErrorMessage) ? boolOrErrorMessage : ""
      , argChecks)
      .join('\n')

    throw `${fnName} called with unexpected or erroneous arguments! \n ${errorMessages}`
  }


}

/**
 * Test against a predicate, and throws an exception if the predicate
 * is not satisfied
 * @param {function(*): (Boolean|String)} contractFn Predicate that must be
 * satisfied. Returns true if predicate is satisfied, otherwise return a
 * string to report about the predicate failure
 * @param {Array<*>} contractArgs arguments for the predicate
 * @param {String} errorMessage error message to report in case of failure
 * @returns {Boolean}
 * @throws if the contract fails
 */
function assertContract(contractFn, contractArgs, errorMessage) {
  const boolOrError = contractFn.apply(null, contractArgs)
  const isPredicateSatisfied = isBoolean(boolOrError) && boolOrError;

  if (!isPredicateSatisfied) {
    throw `assertContract: fails contract ${contractFn.name}\n${errorMessage}\n ${boolOrError}`
  }
  return true
}

/**
 * Returns:
 * - `true` if the object passed as parameter passes all the predicates on
 * its properties
 * - an array with the concatenated error messages otherwise
 * @param obj
 * @param {Object.<string, Predicate>} signature
 * @param {Object.<string, string>} signatureErrorMessages
 * @param {Boolean=false} isStrict When `true` signals that the object
 * should not have properties other than the ones checked for
 * @returns {Boolean | Array<String>}
 */
function checkSignature(obj, signature, signatureErrorMessages, isStrict) {
  let arrMessages = [];
  let strict = !!isStrict;

  // Check that object properties in the signature match it
  mapObjIndexed((predicate, property) => {
    if (!predicate(obj[property])) {
      arrMessages.push(signatureErrorMessages[property])
    }
  }, signature);

  // Check that object properties are all in the signature if strict is set
  if (strict) {
    mapObjIndexed((value, property) => {
      if (!(property in signature)) {
        arrMessages.push(`Object cannot contain a property called ${property}`)
      }
    }, obj)
  }

  return isEmpty(arrMessages) ? true : arrMessages
}

/**
 * Returns true iff the parameter is a boolean whose value is false.
 * This hence does both type checking and value checking
 * @param obj
 * @returns {boolean}
 */
function isFalse(obj) {
  return isBoolean(obj) ? !obj : false
}

/**
 * Returns true iff the parameter is a boolean whose value is false.
 * This hence does both type checking and value checking
 * @param obj
 * @returns {boolean}
 */
function isTrue(obj) {
  return isBoolean(obj) ? obj : false
}

function isMergeSinkFn(obj) {
  return isFunction(obj)
}

/**
 * Returns true iff the passed parameter is null or undefined OR a POJO
 * @param {Object} obj
 * @returns {boolean}
 */
function isNullableObject(obj) {
  // Note that `==` is used instead of `===`
  // This allows to test for `undefined` and `null` at the same time
  return obj == null || typeof obj === 'object'
}

/**
 *
 * @param obj
 * @returns {SignatureCheck}
 */
function isNullableComponentDef(obj) {
  return isNil(obj) || checkSignature(obj, {
    makeLocalSources: either(isNil, isFunction),
    makeLocalSettings: either(isNil, isFunction),
    makeOwnSinks: either(isNil, isFunction),
    mergeSinks: mergeSinks => {
      if (obj.computeSinks) {
        return !mergeSinks
      }
      else {
        return either(isNil, either(isObject, isFunction))(mergeSinks)
      }
    },
    computeSinks: either(isNil, isFunction),
    checkPreConditions: either(isNil, isFunction),
    checkPostConditions: either(isNil, isFunction),
  }, {
    makeLocalSources: 'makeLocalSources must be undefined or a function',
    makeLocalSettings: 'makeLocalSettings must be undefined or a' +
    ' function',
    makeOwnSinks: 'makeOwnSinks must be undefined or a function',
    mergeSinks: 'mergeSinks can only be defined when `computeSinks` is' +
    ' not, and when so, it must be undefined, an object or a function',
    computeSinks: 'computeSinks must be undefined or a function',
    checkPreConditions: 'checkPreConditions must be undefined or a function',
    checkPostConditions: 'checkPostConditions must be undefined or a function'
  }, true)
}

function isUndefined(obj) {
  return typeof obj === 'undefined'
}

function isFunction(obj) {
  return typeof(obj) === 'function'
}

function isObject(obj) {
  return typeof(obj) === 'object'
}

function isBoolean(obj) {
  return typeof(obj) === 'boolean'
}

function isOneOf(strList) {
  return function (obj) {
    return isString(obj) && strList.indexOf(obj) !== -1
  }
}

function isNumber(obj) {
  return typeof(obj) === 'number'
}

function isString(obj) {
  return typeof(obj) === 'string'
}

function isArray(obj) {
  return Array.isArray(obj)
}

function isEmptyArray(obj) {
  return allPass([isEmpty, isArray])(obj);
}

/**
 * Returns a function which returns true if its parameter is an array,
 * and each element of the array satisfies a given predicate
 * @param {function(*):Boolean} predicateFn
 * @returns {function():Boolean}
 */
function isArrayOf(predicateFn) {
  if (typeof predicateFn !== 'function') {
    throw 'isArrayOf: predicateFn is not a function!!'
  }

  return function _isArrayOf(obj) {
    if (!Array.isArray(obj)) {
      return false
    }

    return all(predicateFn, obj)
  }
}

function isVNode(obj) {
  return ["children", "data", "elm", "key", "sel", "text"]
    .every(prop => prop in obj)
}

/**
 *
 * @param {Predicate} predicateKey predicate which keys of hashmap must satisfy
 * @param {Predicate} predicateValue predicate which values of hash map must satisfy
 * @returns {Predicate}
 * @throws when either one predicate is not a function
 */
function isHashMap(predicateKey, predicateValue) {
  assertContract(isFunction, [predicateKey], 'isHashMap : first argument must be a' +
    ' predicate function!');
  assertContract(isFunction, [predicateValue], 'isHashMap : second argument must be a' +
    ' predicate function!');

  return both(
    pipe(keys, all(predicateKey)),
    pipe(values, all(predicateValue))
  );
}

/**
 * check that an object :
 * - does not have any extra properties than the expected ones (strictness)
 * - that its properties follow the defined specs
 * Note that if a property is optional, the spec must include that case
 * @param {Object.<String, Predicate>} recordSpec
 * @returns {Predicate}
 * @throws when recordSpec is not an object
 *
 * Example :
 * - isStrictRecordOf({a : isNumber, b : isString})({a:1, b:'2'}) -> true
 * - isStrictRecordOf({a : isNumber, b : isString})({a:1, b:'2', c:3}) -> false
 * - isStrictRecordOf({a : isNumber, b : isString})({a:1, b:2}) -> false
 */
function isStrictRecord(recordSpec) {
  assertContract(isObject, [recordSpec], 'isStrictRecord : record specification argument must be' +
    ' a valid object!');

  return allPass([
      // 1. no extra properties, i.e. all properties in obj are in recordSpec
      // return true if recordSpec.keys - obj.keys is empty
      pipe(keys, flip(difference)(keys(recordSpec)), isEmpty),
      // 2. the properties in recordSpec all pass their corresponding predicate
      // pipe(obj => mapR(key => recordSpec[key](obj[key]), keys(recordSpec)), all(identity)),
      where(recordSpec)
    ]
  )
}

/**
 * Returns true iff the parameter `obj` represents a component.
 * @param obj
 * @returns {boolean}
 */
function isComponent(obj) {
  // Without a type system, we just test that it is a function
  return isFunction(obj)
}

function isPromise(obj) {
  return obj && obj.then && isFunction(obj.then) && true
}

function isError(obj) {
  return obj instanceof Error
}

function isObservable(obj) {
  // duck typing in the absence of a type system
  return isFunction(obj.subscribe)
}

function isSource(obj) {
  return isObservable(obj)
}

function isSources(obj) {
  // We check the minimal contract which is not to be nil
  // In `cycle`, sources can have both regular
  // objects and observables (sign that the design could be improved).
  // Regular objects are injected dependencies (DOM, router?) which
  // are initialized in the drivers, and should be separated from
  // `sources`. `sources` could then have an homogeneous type which
  // could be checked properly
  return !isNil(obj)
}

function isOptSinks(obj) {
  // obj can be null
  return isNil(obj) || (isObject(obj) && all(either(isNil, isObservable), values(obj)))
}

function isArrayOptSinks(arrSinks) {
  return all(isOptSinks, arrSinks)
}

/**
 *
 * @param {Array<>} predicatesFn An array of predicates which must all be satisfied for the
 * check to pass, together with an error message in the form of a string for when the predicate
 * fails.
 * Those error messages are accumulated, the `errorMessage` is appended to them, and the
 * concatenation of those errors strings is returned.
 * @param {String} errorMessage
 * @returns {Function} function which returns a boolean or an error message string
 */
function checkAndGatherErrors(predicatesFn, errorMessage) {
  return function (...args) {
    let hasFailed = false;
    const accErrorMessages = reduce((acc, [predicateFn, _errorMessage]) => {
      const validationResultOrError = predicateFn.apply(predicateFn, args);

      if (isTrue(validationResultOrError)) {
        return acc
      }
      else {
        // Case when the predicate returns an error message - which can be empty
        _errorMessage && acc.push(_errorMessage);
        acc.push(`Predicate ${predicateFn.name} failed with arguments : ${formatArrayObj(args, ', ')}`)
        validationResultOrError && acc.push(validationResultOrError);
        hasFailed = true;
        return reduced(acc)
      }
    }, [], predicatesFn);

    if (!hasFailed) {
      // no errors - all checks passed
      return true
    }
    else {
      errorMessage && accErrorMessages.unshift(errorMessage);
      return accErrorMessages.join('\n')
    }
  }
}

/**
 * Cf. isStrictRecord. Adds the error messages accumulation aspect.
 * @param recordSpec
 */
function isStrictRecordE(recordSpec) {
  assertContract(isObject, [recordSpec], 'isStrictRecordE : record specification argument must' +
    ' be a valid object!');

  return allPassE([
      // 1. no extra properties, i.e. all properties in obj are in recordSpec
      // return true if recordSpec.keys - obj.keys is empty
      [
        pipe(keys, flip(difference)(keys(recordSpec)), isEmpty),
        `isStrictRecordE : unexpected properties were found on object! Object should only have properties within a configured fixed set of properties : ${keys(recordSpec)}!`
      ],
      // 2. the properties in recordSpec all pass their corresponding predicate
      // pipe(obj => mapR(key => recordSpec[key](obj[key]), keys(recordSpec)), all(identity)),
      [
        whereE(recordSpec),
        `isStrictRecordE : At least one property of object failed its predicate!`
      ]
    ]
    , `isStrictRecordE > allPassE : fails!`)

}

/**
 * Cf. isRecord. Adds the error messages accumulation aspect.
 * @param recordSpec
 */
function isRecordE(recordSpec) {
  assertContract(isObject, [recordSpec], 'isRecordE : record specification argument must' +
    ' be a valid object!');

  return allPassE([
      // 2. the properties in recordSpec all pass their corresponding predicate
      // pipe(obj => mapR(key => recordSpec[key](obj[key]), keys(recordSpec)), all(identity)),
      [
        whereE(recordSpec, `isRecordE > allPassE > whereE : fails!`),
        `isStrictRecordE : At least one property of object failed its predicate!`
      ]
    ]
    , `isRecordE > allPassE : fails!`)

}

const allPassE = checkAndGatherErrors;

function bothE([leftPredicateE, leftError], [rightPredicateE, rightError], error) {
  return allPassE([
    [leftPredicateE, leftError],
    [rightPredicateE, rightError]
  ], error || `One of the two predicates has failed!`)
}

/**
 * @param recordSpec an object containing for each key a predicate. Cf. Ramda `where` function
 * documentation
 * @param error error text to display when one the predicate is failing
 * @returns {function}
 */
function whereE(recordSpec, error) {
  // RecordSpec :: HashMap<Key, Predicate>
  const predicates = keys(recordSpec)
    .map(key => [
      obj => recordSpec[key](obj[key]),
      `property ${key} fails predicate ${recordSpec[key].name}`
    ]);

  return checkAndGatherErrors(predicates, error)
}


/**
 * Test against a left predicate. If that predicate passes, returns true. Otherwise tests
 * against the right predicate. If that predicate passes, returns true. Otherwise, returns an
 * error message which is the concatenation of the possible error messages returned by the
 * left and right predicates
 * @param leftValidation
 * @param leftError
 * @param rightValidation
 * @param rightError
 * @param error
 * @returns {function(*) : Boolean | String}
 */
function eitherE([leftValidation, leftError], [rightValidation, rightError], error) {
  const predicates = [[
    either(leftValidation, rightValidation),
    [
      `both predicates (${leftValidation.name}, ${rightValidation.name}) failed!`,
      `left predicate : ${leftError}`,
      `right predicate : ${rightError}`
    ].join('\n')
  ]];

  return checkAndGatherErrors(predicates, error)
}

/**
 * Cf. isHashMap. Decorates isHashMap with validation error messages
 * @param {Predicate} predicateKey
 * @param {Predicate} predicateValue
 * @returns {Predicate}
 * @throws when either predicate is not a function
 */
function isHashMapE(predicateKey, predicateValue) {
  assertContract(isFunction, [predicateKey], 'isHashMapE : first argument must be a' +
    ' predicate function!');
  assertContract(isFunction, [predicateValue], 'isHashMapE : second argument must be a' +
    ' predicate function!');

  return allPassE([
    [pipe(keys, allE(predicateKey)), `isHashMapE : at least one property key of the object failed its predicate!`],
    [pipe(values, allE(predicateValue)), `isHashMapE : at least one property's value of the object failed its predicate!`]
  ], `isHashMapE : fails!`);
}

/**
 * Decorate `R.all` from ramda with validation error messages
 * @param predicate
 */
function allE(predicate) {
  return function (...args) {
    const arrayOfValues = args[0] || [];

    const result = reduce((acc, value) => {
      const booleanOrErrorMessage = predicate(value);

      if (isTrue(booleanOrErrorMessage)) {
        return acc
      }
      else {
        acc.push(`allE : predicate ${predicate.name} fails with arguments : ${format(value)}`);
        booleanOrErrorMessage && acc.push(booleanOrErrorMessage);
        return acc
      }
    }, [], arrayOfValues)

    return result.length === 0
      ? true
      : result.join('\n')
  }
}

function assertSourcesContracts([sources, settings], sourcesContract) {
  // Check sources contracts
  assertContract(isSources, [sources],
    'm : `sources` parameter is invalid');
  assertContract(sourcesContract, [sources, settings], 'm: `sources, settings`' +
    ' parameters fails contract ' + sourcesContract.name);
}

function assertSinksContracts(sinks, sinksContract) {
  assertContract(isOptSinks, [sinks],
    'mergeSinks must return a hash of observable sink');
  assertContract(sinksContract, [sinks],
    'fails custom contract ' + sinksContract.name);
}

function assertSettingsContracts(mergedSettings, settingsContract) {
  // Check settings contracts
  assertContract(settingsContract, [mergedSettings], 'm: `settings`' +
    ' parameter fails contract ' + settingsContract.name);
}

//////
// Helper functions
function hasAtLeastOneChildComponent(childrenComponents) {
  return childrenComponents &&
  isArray(childrenComponents) &&
  childrenComponents.length >= 1 ? true : ''
}

function _handleError(msg, e) {
  console.error(`${msg}`, e);
  throw e;
}

const handleError = curry(_handleError);

function isOptional(predicate) {
  return function (obj) {
    return isNil(obj) ? true : predicate(obj)
  }
}

function hasNoDuplicateKeys(objA, objB) {
  const objAkeys = keys(objA);
  const objBkeys = keys(objB);

  return (objAkeys.length === 0 || objBkeys.length === 0)
    ? true // if objA or objB is empty, then there is no duplicate
    : (intersection(objAkeys, objBkeys).length === 0)
}

function hasNoCommonValues(eventSinkNames, childrenSinkNames) {
  return intersection(eventSinkNames, childrenSinkNames).length === 0
}

function isNewKey(obj, key) {
  return keys(obj).indexOf(key) === -1
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
  else if (isString(obj) && obj.length === 0) {
    return '<empty string>'
  }
  else if (isArray(obj)) {
    return formatArrayObj(obj, ' ; ')
  }
  else if (isObject(obj)) {
    if (keys(obj).length === 0) {
      // i.e. object is {}
      return '<empty object>'
    }
    else return formatObj(obj)
  }
  else {
    return "" + obj
  }
}

export {
  handleError,
  assertSignature,
  assertSignatureContract,
  assertContract,
  checkSignature,
  isNullableObject,
  isNullableComponentDef,
  isHashMap,
  isStrictRecord,
  isComponent,
  isUndefined,
  isFunction,
  isVNode,
  isOptional,
  isObject,
  isBoolean,
  isOneOf,
  isTrue,
  isNumber,
  isString,
  isArray,
  isEmptyArray,
  isArrayOf,
  isPromise,
  isError,
  isObservable,
  isSource,
  isSources,
  isOptSinks,
  isMergeSinkFn,
  isArrayOptSinks,
  checkAndGatherErrors,
  isStrictRecordE,
  allPassE,
  bothE,
  whereE,
  isHashMapE,
  allE,
  eitherE,
  isRecordE,
  assertSourcesContracts,
  assertSinksContracts,
  assertSettingsContracts,
  hasNoDuplicateKeys,
  hasNoCommonValues,
  hasAtLeastOneChildComponent,
  isNewKey,
}
