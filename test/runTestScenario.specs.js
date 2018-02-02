import * as assert from 'assert'
import {runTestScenario} from '../testing/src/runTestScenario'
import {makeMockDOMSource} from '../testing/src/mocks/mockDOM'
import * as Rx from "rx"
import * as QUnit from "qunitjs"

const $ = Rx.Observable;

function analyzeTestResults(assert, done) {
  return function analyzeTestResults(actual, expected, message) {
    assert.deepEqual(actual, expected, message);
    done()
  }
}

QUnit.module("When inputs are simulating regular stream behaviour", {});

QUnit.test(`emits the inputs in increasing order of (i,j), where : 
   - i is the (row) index of the source in the input array
   - j is the (column) index of the emitted input value in the source diagram
   - (2,1) < (1,2)`, function exec_test(assert) {
  const done = assert.async(3);

  const inputs = [
    {a: {diagram: 'xy|', values: {x: 'a-0', y: 'a-1'}}},
    {b: {diagram: 'xyz|', values: {x: 'b-0', y: 'b-1', z: 'b-2'}}},
  ]

  /** @type ExpectedTestResults */
  const expected = {
    m: {
      outputs: ['m-a-0', 'm-b-0', 'm-a-1', 'm-b-1', 'm-b-2'],
      successMessage: 'sink m produces the expected values',
      analyzeTestResults: analyzeTestResults(assert, done),
      transform: undefined,
    },
    n: {
      outputs: ['t-n-a-0', 't-n-a-1'],
      successMessage: 'sink n produces the expected values',
      analyzeTestResults: analyzeTestResults(assert, done),
      transform: x => 't-' + x,
    },
    o: {
      outputs: ['o-b-0', 'o-b-1', 'o-b-2'],
      successMessage: 'sink o produces the expected values',
      analyzeTestResults: analyzeTestResults(assert, done),
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
});

QUnit.module("When inputs are simulating an object", {});

QUnit.test(`constructs the object according to the mock handler, and emits the input values through that`,
  function exec_test(assert) {
    const done = assert.async(3);

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
          diagram: 'xyz|', values: {
            x: makeDummyHoverEvent('a-0'),
            y: makeDummyHoverEvent('a-1'),
            z: makeDummyHoverEvent('a-2'),
          }
        }
      },
      {b: {diagram: 'xyz|', values: {x: 'b-0', y: 'b-1', z: 'b-2'}}},
    ]

    const testFn = function testFn(sources) {
      return {
        m: sources.DOM.select('input').events('click')
          .tap(ev => ev.preventDefault())
          .map(x => 'm-' + x.target.value),
        n: sources.DOM.select('a').events('hover').map(x => 'n-' + x.value),
        o: sources.b.delay(3).map(x => 'o-' + x)
      }
    }

    /** @type ExpectedTestResults */
    const expected = {
      m: {
        outputs: ['m-a-0', 'm-a-1'],
        successMessage: 'sink m produces the expected values',
        analyzeTestResults: analyzeTestResults(assert, done),
        transform: undefined,
      },
      n: {
        outputs: ['t-n-a-0', 't-n-a-1', 't-n-a-2'],
        successMessage: 'sink n produces the expected values',
        analyzeTestResults: analyzeTestResults(assert, done),
        transform: x => 't-' + x,
      },
      o: {
        outputs: ['o-b-0', 'o-b-1', 'o-b-2'],
        successMessage: 'sink o produces the expected values',
        analyzeTestResults: analyzeTestResults(assert, done),
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
        DOM: () => new Rx.ReplaySubject(1)
      },
      errorHandler: function (err) {
        done(err)
      }
    });
});

QUnit.module("When inputs are simulating an object, AND there is a mock", {});

QUnit.test(`constructs the object according to the mock handler, constructs the sources with the source factory and emits the input values through that`,
  function exec_test(assert) {
    const done = assert.async(3);

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
        o: DOMhover.combineLatest(DOMclick, (a,b)=> ({x: a.value,y:b.target.value}))
      }
    }

    /** @type ExpectedTestResults */
    const expected = {
      m: {
        outputs: ['m-a-0', 'm-a-1'],
        successMessage: 'sink m produces the expected values',
        analyzeTestResults: analyzeTestResults(assert,done),
        transform: undefined,
      },
      n: {
        outputs: ['t-n-a-0', 't-n-a-1', 't-n-a-2'],
        successMessage: 'sink n produces the expected values',
        analyzeTestResults: analyzeTestResults(assert,done),
        transform: x => 't-' + x,
      },
      o: {
        outputs: [{"x":"a-0","y":"a-1"},{"x":"a-1","y":"a-1"},{"x":"a-2","y":"a-1"}],
        successMessage: 'sink o produces the expected values',
        analyzeTestResults: analyzeTestResults(assert,done),
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
        'DOM!input@click': () => new Rx.Subject(),
        'DOM!a@hover' : () => new Rx.Subject(),
      },
      errorHandler: function (err) {
        done(err)
      }
    });
  });

// TODO : test errorHandler settings
// TODO : test error handling (basically all thrown exceptions should have a
// test)
// skipped for now, as being of lower priority, and subject to future changes
