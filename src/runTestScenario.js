/**
 * @typedef {function(*):boolean} Predicate
 */
/**
 * @typedef {Object} Input
 */
/**
 * @typedef {Object} Output
 */
/**
 * @typedef {{diagram: string, values: Object.<string, Input>}} Sequence
 */
/**
 * @typedef {Object} ExpectedRecord
 * @property {?function (outputs:Array<Output>)} transformFn
 * @property {Array<Output>} outputs
 * @property {?String} successMessage
 * @property {!function (Array<Output>, Array<Output>), String} analyzeTestResults
 */
/**
 * @typedef {!Object.<string, ExpectedRecord>} ExpectedTestResults
 */
/**
 * @typedef {{diagram: string, values:*}} Input
 * only one key,value pair though
 */
/**
 * @typedef {Object.<string, Input>} SourceInput
 * only one key,value pair though
 */

import {
  identity, mapObjIndexed, values, all as allR, addIndex, defaultTo,
  reduce as reduceR, keys as keysR, drop, isNil, map, curry, __
} from 'ramda';
import {
  isOptSinks, removeNullsFromArray, assertSignature, assertContract,
  isString, isFunction, isArray, isUndefined, isArrayOf, isNullableObject
} from './utils';
import * as Rx from 'rx';

Rx.config.longStackSupport = true;
const $ = Rx.Observable;
const mapIndexed = addIndex(map);
const tickDurationDefault = 5;

//////
// Contract and signature checking helpers
function isSourceInput(obj) {
  return obj && keysR(obj).length === 1
    && isString((values(obj)[0]).diagram)
}

function isExpectedStruct(record) {
  return (!record.transformFn || isFunction(record.transformFn)) &&
    record.outputs && isArray(record.outputs) &&
    record.analyzeTestResults && isFunction(record.analyzeTestResults) &&
    (!record.successMessage || isString(record.successMessage))
}

function isExpectedRecord(obj) {
  return allR(isExpectedStruct, values(obj))
}

function isStreamSource(inputStr) {
  return !isMockSource(inputStr)
}

function isMockSource(inputStr) {
  return inputStr.indexOf('!') > -1
}

function isValidSourceName(sourceName) {
  if (typeof(sourceName) !== 'string') return false;
  return !!sourceName
}

function hasTestCaseForEachSink(testCase, sinkNames) {
  const _sinkNames = drop(1, sinkNames)
  return allR(sinkName => !!testCase[sinkName], _sinkNames)
}

//////
// test execution helpers

function standardSubjectFactory() {
  return new Rx.Subject();
}

function analyzeTestResults(testExpectedOutputs) {
  return function analyzeTestResults(sinkResults$, sinkName) {
    const expected = testExpectedOutputs[sinkName]
    // Case the component returns a sink with no expected value
    // That is a legit possibility, we might not want to test for all
    // the sinks returned by a component
    if (isNil(expected)) return null

    const expectedResults = expected.outputs
    const successMessage = expected.successMessage
    const analyzeTestResultsFn = expected.analyzeTestResults

    return sinkResults$
    // `analyzeTestResultsFn` should include `assert` which
    // throw if the test fails
      .tap(curry(analyzeTestResultsFn)
        (__, expectedResults, successMessage)
      )
  }
}

function getTestResults(testInputs$, expected, settings) {
  const defaultWaitForFinishDelay = 50
  const waitForFinishDelay = settings.waitForFinishDelay
    || defaultWaitForFinishDelay

  return function getTestResults(sink$, sinkName) {
    if (isUndefined(sink$)) {
      console.warn('getTestResults: received an undefined sink ' + sinkName)
      return $.of([])
    }

    let endOfTestsSampler = testInputs$.isEmpty().flatMap(isEmpty =>
      isEmpty
        ? $.just().delay(waitForFinishDelay)
        : testInputs$.last().delay(waitForFinishDelay)
    )

    return sink$
      .scan(function buildResults(accumulatedResults, sinkValue) {
        const transformFn = expected[sinkName].transformFn || identity
        const transformedResult = transformFn(sinkValue)
        accumulatedResults.push(transformedResult);

        return accumulatedResults;
      }, [])
      // Give it some time to process the inputs,
      // after the inputs have finished being emitted
      // That's arbitrary, keep it in mind that the testing helper
      // is not suitable for functions with large processing delay
      // between input and the corresponding output
      .sample(endOfTestsSampler)
      .take(1)
  }
}

/**
 *
 * @param {Number} tickNum
 * @param {Array<SourceInput>} inputs
 * @returns {Array<SourceInput>} a similar array of input but with a
 * diagram with only one character taken from the input diagram at
 * position tickNum
 */
function projectAtIndex(tickNum, inputs) {
  return map(function mapInputs(sourceInput) {
    return map(function projectDiagramAtIndex(input) {
      return {
        diagram: input.diagram[tickNum],
        values: input.values
      }
    }, sourceInput)
  }, inputs)
}

function hasMock(mockedSourcesHandlers, sourceName) {
  return mockedSourcesHandlers[sourceName]
}

function getMock(mockedSourcesHandlers, sourceName) {
  return mockedSourcesHandlers[sourceName]
}

function computeSources(inputs, mockedSourcesHandlers, sourceFactory) {
  /**
   * Accumulator function to be used in a reduce operation. Builds up a POJO
   * of the shape {sources, streams} by adding new entries for both keys with:
   * - in streams : the stream object through which the inputs will be
   * emitted. Key is an identifier for an input stream
   * - sources : either a stream (in that case, entry is the same as in
   * `streams`) or an object built through the mocking mechanism. For
   * instance, `DOM!xxxx` will result in an entry `sources: {DOM : mockedDOM}`
   * @param accSources
   * @param input
   * @returns {{sources: Object.<string, Stream | *>, streams : Object.<string, Stream>}}
   */
  function makeSources(accSources, input) {
    const inputKey = keysR(input)[0];

    if (isStreamSource(inputKey)) {
      // Case when the inputs are to emulate a stream
      // Ex : 'authentication'
      // Create the subjects which will receive the input data
      /** @type {Object.<string, Stream>} */
      accSources.sources[inputKey] = accSources.streams[inputKey] = standardSubjectFactory()
      return accSources
    }
    else if (isMockSource(inputKey)) {
      // Case when the inputs are to mock an object
      // Ex : 'DOM!selector@event'
      const [sourceName, sourceSpecs] = inputKey.split('!')

      // Check the source name is valid (not empty etc.)
      if (!isValidSourceName(sourceName)) {
        throw `Invalid source name ${sourceName}!`
      }

      // Check that the sourceName has a handler function passed in settings
      if (!hasMock(mockedSourcesHandlers, sourceName)) {
        throw `mock is not defined in settings for source ${sourceName}`
      }

      // Pass the input string to the mock function
      const mock = getMock(mockedSourcesHandlers, sourceName)
      // Note : `mock` could be executed several times
      // for instance: DOM!sel1@click, DOM!sel2@click
      // So the mock function should receive the current mocked object
      // and return another one
      let stream = sourceFactory[inputKey] && sourceFactory[inputKey]()
        || standardSubjectFactory();
      accSources.streams[inputKey] = stream
      accSources.sources[sourceName] = mock(accSources.sources[sourceName], sourceSpecs, stream)
    }
    else {
      throw 'unknown source format!'
    }

    return accSources
  }

  return reduceR(makeSources, {sources: {}, streams: {}}, inputs)
}

function defaultErrorHandler(err) {
  console.error('An error occurred while executing test!', err)
}

//////
// Main functions

/**
 * Tests a function which takes a collection of streams and returns a
 * collection of streams. In the current implementation, a collection of
 * streams refers to a hash object (POJO or Plain Old Javascript Object).
 * The function is run on some inputs, and its output is compared against the
 * expected values defined in a test case object.
 *
 * ### Test execution
 * Input values are emitted on their respective input streams according to
 * an order defined by the array `inputs` (rows) and the marble diagrams
 * (columns). That order is such that the first column is emitted first, and
 * then subsequent columns in the marble diagrams are emitted next.
 * The time interval between column emission is configurable (`tickDuration`).
 * When there are no more input values to emit, a configurable amount of
 * time must lapse for the test to conclude (`waitForFinishDelay`).
 * Output values are optionally transformed, then hashed by output streams and
 * gathered into an output object which is compared against expected values.
 * If there is a discrepancy between actual and expected values, an
 * exception is raised.
 *
 * The testing behaviour can be configured with the following settings :
 * - tickDuration :
 *   - the interval (ms) between the emission of a column of inputs and the
 *   next one
 * - waitForFinishDelay :
 *   - the time lapse (ms) after the last input is emitted, after which the
 *   test is terminated
 * - errorHandler :
 *   - in case an exception is raised, the corresponding error is passed
 *   through that error handler
 * - mocks :
 *   - only used if one of the input source key is of the form
 *   x!y, where x is the source identifier, and y is called the
 *   source qualifier
 *   - matches a source identifier to a mock function which produces a
 *   mocked object to be used in lieu of an input source
 *   - for instance, `DOM!.button@click` as an entry in the `inputs`
 *   hash MUST correspond to a `DOM` entry in the `mocks` object
 *   - the mock function takes three parameters :
 *     - mockedObj :
 *       - current accumulated value of the mock object
 *     - sourceSpecs :
 *       - correspond to the `y` in `x!y`
 *     - stream :
 *       - subject which is produced by the matching factory
 * - sourceFactory :
 *   - entries whose keys are of the form `x!y` where `x` is the
 *   identifier for the corresponding source stream, and `y` is the
 *   qualifier for that same source. That key is matched to a function
 *   which takes no parameter and returns a stream to be used to emit
 *   input values (hence MUST be a subject).
 *
 * @param {Array<SourceInput>} inputs
 * Inputs are passed in the form of an array
 * - Each element of the array is a POJO which exactly ONE key which is the
 * identifier for the tested function's corresponding input stream
 *   - Input values for a given input streams are passed using the marble
 *   diagram syntax
 * @param {ExpectedTestResults} expected Object whose key correspond to
 * an output stream identifier, matched to an object containing the
 * data relevant to the test case :
 *   - outputs : array of expected values emitted by the output stream
 *   - successMessage : description of the test being performed
 *   TODO : factor out analyzeTestResults to settings - always same function
 *   - analyzeTestResults : function which receives the actual, expected,
 *   and test messages information. It MUST raise an exception if the test
 *   fails. Typically this function fulfills the same function as the usual
 *   `assert.equal(actual, expected, message)`.
 *   TODO : refactor tranformFN to transform
 *   - transformFn : function which transforms the actual outputs from a stream.
 *   That transform function can be used to remove fields, which are irrelevant
 *   or non-reproducible (for instance timestamps), before comparison.
 *
 *   ALL output streams returned by the tested function must have defined
 *   expected results, otherwise an exception will be thrown
 * @param {function(Sources):Sinks} testFn Function to test
 * @param {{tickDuration: Number, waitForFinishDelay: Number}} _settings
 * @throws
 */
function runTestScenario(inputs, expected, testFn, _settings) {
  assertSignature('runTestScenario', arguments, [
    {inputs: isArrayOf(isSourceInput)},
    {testCase: isExpectedRecord},
    {testFn: isFunction},
    {settings: isNullableObject},
  ])

  // Set default values if any
  const settings = defaultTo({}, _settings);
  const {mocks, sourceFactory, errorHandler, tickDuration, waitForFinishDelay} = settings;
  const mockedSourcesHandlers = defaultTo({}, mocks)
  // TODO: add contract: for each key in sourceFactory, there MUST be the
  // same key in `inputs` : this avoids error by omission
  const _sourceFactory = defaultTo({}, sourceFactory)
  const _errorHandler = defaultTo(defaultErrorHandler, errorHandler)
  const _tickDuration = defaultTo(tickDurationDefault, tickDuration)

  // @type {{sources: Object.<string, *>, streams: Object.<string, Stream>}}
  let sourcesStruct = computeSources(inputs, mockedSourcesHandlers, _sourceFactory);

  // Maximum length of input diagram strings
  // Ex:
  // a : '--x-x--'
  // b : '-x-x-'
  // -> maxLen = 7
  const maxLen = inputs.length !== 0
    ? Math.max.apply(null,
    map(sourceInput => (values(sourceInput)[0]).diagram.length, inputs))
    : 0;

  // Make an index array [0..maxLen[ for iteration purposes
  /** @type {Array<Number>} */
  const indexRange = maxLen
    ? mapIndexed((input, index) => index, new Array(maxLen))
    : [];

  // Make a single chained observable which :
  // - waits some delay before starting to emit
  // - then for n in [0..maxLen[
  //   - emits the m values in position n in the input diagram, in `inputs`
  // array order, `m` being the number of input sources
  // wait for that emission to finish before nexting (`concat`)
  // That way we ENSURE that :
  // -a--
  // -b--     if a and b are in the same vertical (emission time), they
  // will always be emitted in the same order in every execution of the
  // test scenario
  // -a-
  // b--      values that are chronologically further in the diagram will
  // always be emitted later
  // This allows to have predictable and consistent data when analyzing
  // test results. That was not the case when using the `setTimeOut`
  // scheduler to handle delays.
  const testInputs$ = indexRange.length === 0
      ? $.empty()
      : reduceR(function makeInputs$(accEmitInputs$, tickNo) {
      return accEmitInputs$
        .delay(_tickDuration)
        .concat(
          $.from(projectAtIndex(tickNo, inputs))
            .tap(function emitInputs(sourceInput) {
              // input :: {sourceName : {{diagram : char, values: Array<*>}}
              const sourceName = keysR(sourceInput)[0]
              const input = sourceInput[sourceName]
              const c = input.diagram
              const values = input.values || {}
              const sourceSubject = sourcesStruct.streams[sourceName]
              const errorVal = (values && values['#']) || '#'

              if (c) {
                // case when the diagram for that particular source is
                // finished but other sources might still go on
                // In any case, there is nothing to emit
                switch (c) {
                  case '-':
                    // do nothing
                    break;
                  case '#':
                    sourceSubject.onError({data: errorVal})
                    break;
                  case '|':
                    sourceSubject.onCompleted()
                    break;
                  default:
                    const val = values.hasOwnProperty(c) ? values[c] : c;
                    console.log('emitting for source ' + sourceName + ' ' + val)
                    sourceSubject.onNext(val)
                    break;
                }
              }
            })
        )
    }, $.empty(), indexRange)
      .share()

  // Execute the function to be tested (for example a cycle component)
  // with the source subjects
  console.groupCollapsed('runTestScenario: executing test function')
  let testSinks = testFn(sourcesStruct.sources)
  console.groupEnd()

  if (!isOptSinks(testSinks)) {
    throw 'encountered a sink which is not an observable!'
  }

  // Gather the results in an array for easier processing
  /** @type {Object.<string, Stream<Array<Output>>>} */
  const sinksResults = mapObjIndexed(
    getTestResults(testInputs$, expected, settings),
    testSinks
  )

  assertContract(hasTestCaseForEachSink, [expected, keysR(sinksResults)],
    'runTestScenario : in test Case, could not find expected ouputs for all' +
    ' sinks!'
  )

  // Side-effect : execute `analyzeTestResults` function which
  // makes use of `assert` and can lead to program interruption
  /** @type {Object.<string, Stream<Array<Output>>>} */
  const resultAnalysis = mapObjIndexed(
    analyzeTestResults(expected),
    sinksResults
  )

  const allResults = removeNullsFromArray(values(resultAnalysis))
  // This takes care of actually starting the producers
  // which generate the execution of the test assertions
  $.merge(allResults)
    .subscribe(
      x => console.warn('Test completed for sink:', x),
      function (err) {
        console.error('An error occurred while executing test!', err);
        _errorHandler(err);
      },
      x => console.warn('Tests completed!')
    )
  testInputs$.subscribe(
    x => undefined,
    function (err) {
      console.error('An error occurred while emitting test inputs!', err);
      _errorHandler(err);
    },
    x => console.warn('test inputs emitted')
  )
}

export {
  runTestScenario
}
