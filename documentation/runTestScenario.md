# Table of content
   * [Context](#context)
   * [Dependencies](#dependencies)
   * [API](#api)
      * [Key types](#key-types)
      * [runTestScenario](#runtestscenario-1)
      * [Mocking](#mocking)
      * [Source factories](#source-factories)
      * [Contracts](#contracts)
   * [Example](#example)
      * [Basic example](#basic-example)
      * [Using ad-hoc mocks and factories](#using-ad-hoc-mocks-and-factories)
   * [Known limitations](#known-limitations)
   * [Installation](#installation)
      * [npm](#npm)
      * [Direct download](#direct-download)
      * [Bower](#bower)
      * [jspm](#jspm)
   * [Troubleshooting](#troubleshooting)
   * [Breaking Changes](#breaking-changes)
   * [Roadmap](#roadmap)
   * [License](#license)
   * [Contributing](#contributing)

# Context

There exists a number of ways to test functions which take a stream and return a stream (referred to, in what follows, as stream combinator). Most streaming libraries have at least some basic APIs to that purpose. 

- `Rxjs` for example uses a test scheduler, and offers some specific constructs (`TestScheduler`, `startWithTiming`, `createHotObservable`, `Rx.ReactiveTest.onNext` etc.). `Most` has the `most-test` community library which can also help. 
- In the worse case, if the streaming library offers subjects from the get-go, it is relatively easy to pass a sequence of inputs through that, run the stream combinator and gather back the output in sequence.

Testing functions which take a collection of streams and return a collection of streams requires specific treatment in the case when order of inputs is total. That is the case when inputs are syntactically divided into a collection of source streams (`HashMap<SourceName, Stream<*>>`), but semantically are in fact equivalent to a single source stream (`Stream<HashMap<SourceName, *>>`), whose inputs carry both source type and message information. On the other hand, we assume here that ordering of outputs is only partial on the collection, and total on any given output stream.

The total order on the input streams collection requires the testing facility to simulate the emission of inputs in the expected order. The partial order on the output streams collection allows the testing facility to only gather the outputs on a per-stream basis.

`runTestScenario` is such a testing facility which provides an interface for creating a collection of streams from an array of input values, executing a function on that collection and comparing the resulting collection of output streams vs. an expected array of output values.

In what follows :

- by a collection of streams, we will refer to a hash object (i.e. standard javascript object), keyed by stream identifier, matched to the actual stream.
- the collection of streams, when envisioned as an input to the function under test, may also be called sources
- the collection of streams, when envisioned as an output to the function under test, may also be called sinks
- hence the function under test is a function which takes sources and computes sinks.
 
# Dependencies
- functional toolkit : `ramda`
- streaming library : `rxjs`

Customizing the testing library for a specific streaming is relatively simple as only the most basic functionalities of rxjs are used here. A `most` version already has already been published in the most community though no longer maintained by this author.

# Running tests
`npm run build-node-test ; npm run test`

# API
## Key types 

```
/**
 * @typedef {function(*):boolean} Predicate
 * @typedef {Object} Input
 * @typedef {Object} Output
 * @typedef {{diagram: string, values: Object.<string, Input>}} Sequence
 * @typedef {Object} ExpectedRecord
 * @property {?function (output:Output):Output} transform
 * @property {Array<Output>} outputs
 * @property {?String} successMessage
 * @property {!function (Array<Output>, Array<Output>), String} analyzeTestResults
 * @typedef {!Object.<string, ExpectedRecord>} ExpectedTestResults
 * @typedef {{diagram: string, values:*}} Input
 * only one key,value pair though
 * @typedef {Object.<string, Input>} SourceInput
 * only one key,value pair though
 * @typedef {Object} TestRunnerSettings
 * @property {Number} tickDuration
 * @property {Number} waitForFinishDelay
 * @property {function(error:Exception):void} errorHandler
 * @property {function(actual, expected):void} analyzeTestResults By contract, should throw if actual != expected
 * @property {Object.<String, function():Subject>} sourceFactory hashmap associating a mocked source to a subject factory. The factory should create a subject through which test inputs are emitted
 * @property {Object.<String, function(mockedObj, sourceSpecs, stream):*>} mocks The keys of `mocks` are the mocked object to build. Those mocked objects are passed as a source to the sources parameter of the tested component function (:: Sources -> Sinks, where Sources :: Object.<key, Source>).
 * Mocked source objects are build iteratively. As such, the function referred to here is a reducing function, which receives as first parameter the current value of the constructed mocked object, an additional parameter allowing for further parameterization, and the subject by which test inputs will flow for that (mock object, sourceSpecs) instance.
 * Best is to review the tests to have a more precise understanding of the mechanism.
 */

```

### `runTestScenario`
As extracted for current source code (as of `v0.1.0`),
```
/**
 * Tests a function which takes a collection of streams and returns a collection of streams. In the current implementation, a collection of streams refers to a hash object (POJO or Plain Old Javascript Object).
 * The function is run on some inputs, and its output is compared against the expected values defined in a test case object.
 *
 * ### Test execution
 * Input values are emitted on their respective input streams according to an order defined by the array `inputs` (rows) and the marble diagrams (columns). That order is such that the first column is emitted first, and
 * then subsequent columns in the marble diagrams are emitted next.
 * The time interval between column emission is configurable (`tickDuration`).
 * When there are no more input values to emit, a configurable amount of time must lapse for the test to conclude (`waitForFinishDelay`).
 * Output values are optionally transformed, then hashed by output streams and gathered into an output object which is compared against expected values.
 * If there is a discrepancy between actual and expected values, an exception is raised.
 *
 * The testing behaviour can be configured with the following settings :
 * - tickDuration :
 *   - the interval (ms) between the emission of a column of inputs and the next one
 * - waitForFinishDelay :
 *   - the time lapse (ms) after the last input is emitted, after which the test is terminated
 * - errorHandler :
 *   - in case an exception is raised, the corresponding error is passed through that error handler
 * - mocks :
 *   - only used if one of the input source key is of the form
 *   x!y, where x is the source identifier, and y is called the source qualifier
 *   - matches a source identifier to a factory function which produces a mocked object to be used in lieu of an input source
 *   - for instance, `DOM!.button@click` as a key in the `inputs` parameter corresponds to a `DOM` entry in the `mocks` object passed in settings
 *   - the mock function takes three parameters :
 *     - mockedObj :
 *       - current constructed value of the mock object (object is iteratively constructed)
 *     - sourceSpecs :
 *       - correspond to the `y` in `x!y`
 *     - stream :
 *       - subject passed to transmit input values for the corresponding mocked object
 * - sourceFactory :
 *   - entries whose keys are of the form `x!y` where `x` is the identifier for the corresponding source stream, and `y` is the qualifier for that same source. That key is matched to a function which takes no parameter and returns a stream to be used to emit input values (hence MUST be a subject).
 *
 * @param {Array<SourceInput>} inputs
 * Inputs are passed in the form of an array
 * - Each element of the array is a POJO which exactly ONE key which is the identifier for the tested function's corresponding input stream
 *   - Input values for a given input streams are passed using the marble diagram syntax
 * @param {ExpectedTestResults} expected Object whose key corresponds to an output stream identifier, matched to an object containing the data relevant to the test case :
 *   - outputs : array of expected values emitted by the output stream
 *   - successMessage : description of the test being performed
 *   - analyzeTestResults : function which receives the actual, expected, and test messages information. It MUST raise an exception if the test fails. Typically this function fulfills the same function as the usual `assert.equal(actual, expected, message)`. That function is optional. It also has lower precedence over the function with the same name passed in settings, if any.
 *   - transform : function which transforms the actual outputs from a stream.
 *   That transform function can be used to remove fields, which are irrelevant or non-reproducible (for instance timestamps), before comparison.
 *
 *   ALL output streams returned by the tested function must have defined expected results, otherwise an exception will be thrown.
 * @param {function(Sources):Sinks} testFn Function to test
 * @param {TestRunnerSettings} _settings
 * @throws when a predefined contract is broken, or when the tested function throws
 */
```

## Marble syntax
The marble syntax used for representing input sequences is inspired from 
`rxjs5`'s [writing marble tests](https://github.com/ReactiveX/rxjs/blob/master/doc/writing-marble-tests.md).

In the present context, the syntax is used to denote four meanings :
- `-` : empty data slot - no data is emitted by the producer 
- `|` : completion of the sequence - this is the observable producer signaling `complete()`
- `#` : error - An error terminating the sequence. This is the observable producer signaling `error()`
- `a` (any ONE character) : input value - All other characters than the three 
previously shown represent a value being emitted by the producer signaling `next()`

### Examples
- `a--#` : represents a producer which emits a value on the first time slot, 
then emits nothing the next two time slots, and then on the 4th time slots 
emits an error.
- `-b|` : represents a producer which emits nothing on the first time slot, 
then emits a value on the next time slot, then completes on the third 
time slot..

### Total ordering
The following inputs :
```
[
  { x$: {diagram: `a-c`} }, // row 1
  { y$: {diagram: `bde`} }  // row 2
]
```

will result in the following data emission and sequence of actions:
- lapse of `tickDuration` ms
- emission of `"a"` by `x$` THEN emission of `"b"` by `y$`
- lapse of `tickDuration` ms
- emission of `"d"` by `y$`
- lapse of `tickDuration` ms
- emission of `"c"` by `x$` THEN emission of `"e"` by `y$`
- lapse of `waitForFinishDelay` ms
- completion of the test producer and processing of outputs

Hence data emission is such that, if `(i,j)`represents the input value at row `i` and column `j`, then `(i,j)` is ALWAYS emitted before `(k,l)` if `j < l` or `j==l && i < k`.

### Input values
Input values can be associated to the letter/character in the diagram through
 the `values` property. When no matching entry can be found in `values`, the 
 input stream emits the character itself. For  instance :
  ```
 [
   { x$: {diagram: `a-c`, values: {c: `dummy`}} }, // row 1
   { y$: {diagram: `bde`} }  // row 2
 ]
 ```

will result in the input stream `x$` emitting `a` on the first time slot 
and dummy` on the third time slot.

## Mocking
In order to cover `cycle.js` applications' use cases, where functions (called 
components or component functions) take as input a collection of streams OR 
regular  objects from which streams are derived, a mocking functionality has been added, extending the syntax. For example :
```
[
   { x$: {diagram: `a-c`, values: {c: `dummy`}} }, // row 1
   { `y!z`: {diagram: `bde`} }  // row 2
 ]
```
will construct a mock object `y` and an input stream (identified by `z`) which 
will emit values corresponding to the marble diagram specification. `y` is 
referred to as the mock identifier and can be any string (not including the `!` character). `z` is referred to as the stream qualifier and can be any string (not including the `!` character).

 For instance, in the included example, a `DOM!input@click` input entails the creation of a `DOM` mock object which will reference through an API of its choice an input stream corresponding to `input@click`.
 
 The DOM mock factory function, passed through the `settings` parameter 
 (`makeMockDOMSource`), builds the mock object iteratively and constructs the derived input streams using the relevant source factory (defined in 
 `settings.sourceFactory`).

  Cf. the documentation in the code source and the example above for more 
  details.

## Source factories
A source factory is a function which MUST return a subject (cf. contracts). 
The functionality is added to support the object mocking ability.

## Contracts
- key type contracts
  - tested function MUST have the expected signature
    - must take a collection of streams OR objects...
    - ...and return a collection of streams
  - `analyzeTestResults` is mandatory and must throw to signal test failure
	  - it however can be defined globally in settings, or locally for each output stream
  - source factory functions must return a subject
- other rules
  - source identifier MUST be non-empty strings
  - source identifier MUST follow either `x` or `x!y` syntax, where `x` and 
  `y` are any non empty strings, i.e. `!sth` is not a permitted syntax
  - if the syntax `x!y` is used for a source identifier, there MUST be a 
  corresponding key `x` in the `mocks` object

# Examples
## Basic example
The example thereafter illustrates the following optional features:

 - settings
   - `tickDuration`
   - `waitForFinishDelay`
 - inputs
   - values matching marble diagram letters
 - outputs
   - transform function

```
describe("When inputs are simulating regular stream behaviour", () => {
  it(`emits the inputs in increasing order of (i,j), where : 
   - i is the (row) index of the source in the input array
   - j is the (column) index of the emitted input value in the source diagram
   - (2,1) < (1,2)`, (done) => {
    const assertAsync = plan(3)

    function analyzeTestResults(actual, expected, message) {
      assert.deepEqual(actual, expected, message)
      assertAsync(done)
    }

    const inputs = [
      {a: {diagram: 'xy|', values: {x: 'a-0', y: 'a-1'}}},
      {b: {diagram: 'xyz|', values: {x: 'b-0', y: 'b-1', z: 'b-2'}}},
    ]

    /** @type ExpectedTestResults */
    const expected = {
      m: {
        outputs: ['m-a-0', 'm-b-0', 'm-a-1', 'm-b-1', 'm-b-2'],
        successMessage: 'sink m produces the expected values',
        analyzeTestResults: analyzeTestResults,
        transform: undefined,
      },
      n: {
        outputs: ['t-n-a-0', 't-n-a-1'],
        successMessage: 'sink n produces the expected values',
        analyzeTestResults: analyzeTestResults,
        transform: x => 't-' + x,
      },
      o: {
        outputs: ['o-b-0', 'o-b-1', 'o-b-2'],
        successMessage: 'sink o produces the expected values',
        analyzeTestResults: analyzeTestResults,
        transform: undefined,
      }
    }

    const testFn = sources => ({
      m: $.merge(sources.a, sources.b).map((x => 'm-' + x)),
      n: sources.a.map(x => 'n-' + x),
      o: sources.b.delay(3).map(x => 'o-' + x)
    })

    runTestScenario(inputs, expected, testFn, {
      tickDuration: 10,
      waitForFinishDelay: 30
    })
  })
})

```

## Using ad-hoc mocks and factories
The example thereafter illustrates the following features:
 - mock
   - `makeDOMSource` mock
 - stream (subject) factory 
 - error handler

Note that :
- the error handler is used here to pass on the error to the testing 
library (here `mocha`).

```
describe("When inputs are simulating an object, AND there is a mock" +
  " associated to that object", () => {
  it('constructs the object according to the mock handler, constructs the' +
    ' sources with the source factory and emits the input values through that',
    (done) => {
      const assertAsync = plan(3)

      function analyzeTestResults(actual, expected, message) {
        assert.deepEqual(actual, expected, message)
        assertAsync(done)
      }

      function noop() {
      }

      function makeDummyClickEvent(value) {
        return {
          preventDefault: noop,
          tap: x => console.log(x),
          target: {
            value: value
          }
        }
      }

      function makeDummyHoverEvent(value) {
        return {
          value: value
        }
      }

      const inputs = [
        {
          'DOM!input@click': {
            diagram: 'xy|', values: {
              x: makeDummyClickEvent('a-0'), y: makeDummyClickEvent('a-1')
            }
          }
        },
        {
          'DOM!a@hover': {
            diagram: '-xyz|', values: {
              x: makeDummyHoverEvent('a-0'),
              y: makeDummyHoverEvent('a-1'),
              z: makeDummyHoverEvent('a-2'),
            }
          }
        },
        {b: {diagram: 'xyz|', values: {x: 'b-0', y: 'b-1', z: 'b-2'}}},
      ]

      const testFn = function testFn(sources) {
        const DOMclick = sources.DOM.select('input').events('click');
        const DOMhover = sources.DOM.select('a').events('hover');
        return {
          m: DOMclick
            .tap(ev => ev.preventDefault())
            .map(x => 'm-' + x.target.value),
          n: DOMhover.map(x => 'n-' + x.value),
          o: DOMhover.combine((a,b)=> ({x: a.value,y:b.target.value}), DOMclick)
        }
      }

      /** @type ExpectedTestResults */
      const expected = {
        m: {
          outputs: ['m-a-0', 'm-a-1'],
          successMessage: 'sink m produces the expected values',
          analyzeTestResults: analyzeTestResults,
          transform: undefined,
        },
        n: {
          outputs: ['t-n-a-0', 't-n-a-1', 't-n-a-2'],
          successMessage: 'sink n produces the expected values',
          analyzeTestResults: analyzeTestResults,
          transform: x => 't-' + x,
        },
        o: {
          outputs: [{"x":"a-0","y":"a-1"},{"x":"a-1","y":"a-1"},{"x":"a-2","y":"a-1"}],
          successMessage: 'sink o produces the expected values',
          analyzeTestResults: analyzeTestResults,
          transform: undefined,
        }
      }

      runTestScenario(inputs, expected, testFn, {
        tickDuration: 10,
        waitForFinishDelay: 30,
        mocks: {
          DOM: makeMockDOMSource
        },
        sourceFactory: {
          'DOM!input@click': () => sync(),
          'DOM!a@hover' : () => sync(),
        },
        errorHandler: function (err) {
          done(err)
        }
      })
    })
})

// DOM Mocking
 function isValidDOMSourceInput(select, event) {
   // Keep it simple for now
   return !!select && !!event
 }
 
 function makeDOMMock(hashTable) {
   return function mockCycleDOMSelect(selector) {
     return {
       events: function mockCycleDOMEvent(event) {
         return hashTable[selector][event]
       }
     }
   }
 }
 
 function makeMockDOMSource(_mockedObj, sourceSpecs, stream) {
   const [select, event] = sourceSpecs.split('@');
 
   if (!isValidDOMSourceInput(select, event)) {
     throw `Invalid spec for DOM source : ${sourceSpecs}`
   }
 
   // Initialize object hash table if not done already
   let mockedObj = _mockedObj || {};
   mockedObj.hashTable = mockedObj.hashTable || {};
   mockedObj.hashTable[select] = mockedObj.hashTable[select] || {};
   mockedObj.hashTable[select][event] = mockedObj.hashTable[select][event] || {};
   // register the stream in the hash table
   mockedObj.hashTable[select][event] = stream;
   // build the mock anew to incorporate the new stream
   mockedObj.select = makeDOMMock(mockedObj.hashTable)
   return mockedObj
 }

```

# Known limitations
- The edge case of a tested function which takes streams and returns nothing is 
not handled.
- `rxjs` grammar is not enforced for the marble diagrams, i.e. behaviour of a 
sequence such as `a-|b#-c|` is unspecified and untested.
- Due to the imprecision of `setTimeOut` and the like, it is impossible to enforce an absolute timing for input emission. This means that it is not possible to send input `x` after EXACTLY `t` ms.
- It is not possible in the current version of the API to check against total order of outputs, only against the relative order of output values for a given sink. This means it is not possible to discriminate whether the `i`-th output value of sink `S` was emitted before or after the `j`-th output of sink `T`. It is only guaranteed that the `i`-th output value of sink `S` was emitted before the `j`-th output of sink `S`, iff `i < j`. For the vast majority of applications though, such a degree of precision is hopefully not necessary.
- Subjects are used to simulate input streams. Small semantic differences 
between the two around edge cases, depending on the streaming library in use, may lead to false negatives.

# Troubleshooting
No shooting, no trouble.

# Breaking Changes
Maybe one day. Cf. roadmap

# Roadmap
- clean code
- review API against open/closed principle
- combine mocks and source factory in one indexed by the mock
  i.e. DOM : {y_n: factory(), constructor: makeDOMsource}
- have documentation reviewed by external actor

# License
MIT

# Contributing

Shoot but aim high. Open a pull request!

Suggestions, if you are bored on a sunday :
- typescript type file
	- most of the type information is there
