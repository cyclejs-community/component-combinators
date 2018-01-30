import * as QUnit from "qunitjs"
import * as Rx from 'rx'
import { h } from 'cycle-snabbdom'
import { runTestScenario } from '../utils/testing/src/runTestScenario'
import { convertVNodesToHTML } from "../utils/debug/src/index"
import { pipe } from 'ramda'
import { ForEach } from "../src/components/ForEach/ForEach"

const $ = Rx.Observable;

function analyzeTestResults(assert, done) {
  return function analyzeTestResults(actual, expected, message) {
    assert.deepEqual(actual, expected, message);
    done()
  }
}

QUnit.module("Testing ForEach component", {})

// Test plan
// All tests with two children min. for components, and 3 cases
// 1. Foreach
// 1.1 source `from` not existing in sources
// 1.2 Foreach source never (emits no values)
// 1.3 Foreach source emits X values

QUnit.test("edge case - source `from` not existing in sources", function exec_test(assert) {
  const done = null;

  const childComponent1 = function childComponent1(sources, settings) {
    return {
      DOM: sources.DOM1.take(4)
        .tap(console.warn.bind(console, 'DOM : component 1: '))
        .map(x => h('span', {}, `Component 1 : ${x}`)),
      a: sources.userAction$.map(x => `Component1 - user action : ${x}`)
    }
  };
  const childComponent2 = function childComponent2(sources, settings) {
    return {
      DOM: sources.DOM2.take(4)
        .tap(console.warn.bind(console, 'DOM : component 2: '))
        .map(x => h('span', {}, `Component 2 : ${x}`)),
      b: sources.userAction$.map(x => `Component2 - user action : ${x}`)
    }
  };
  const childComponent3 = function childComponent3(sources, settings) {
    return {
      DOM: sources.DOM2.take(4)
        .tap(console.warn.bind(console, 'DOM : component 3: '))
        .map(x => h('span', {}, `Component 3 : ${x}`)),
      b: sources.userAction$.map(x => `Component3 - user action : ${x}`)
    }
  };
  const childComponent4 = function childComponent4(sources, settings) {
    return {
      c: sources.userAction$.map(x => `Component4 - user action : ${x}`)
    }
  };

  const forEachComponent = ForEach({
    from: 'source$',
    as: 'output',
//    sinkNames: ['DOM', 'a', 'b', 'c'] // No need
  }, [
    childComponent1,
    childComponent2,
  ]);

  const inputs = [
    { DOM1: { diagram: '-a--b--c--d--e--f--a' } },
    { DOM2: { diagram: '-a-b-c-d-e-f-abb-c-d' } },
    {
      userAction$: {
        diagram: 'abc-b-ac--ab---c',
        values: { a: 'click', b: 'select', c: 'hover', }
      }
    },
    {
      'sourceeeee$': {
        diagram: '-t-f-tttttff-t', values: {
          t: true,
          f: false,
        }
      }
    }
  ];

  /** @type TestResults */
  const expected = {
    DOM: {
      outputs: [],
      successMessage: 'sink DOM produces the expected values',
      // NOTE : I need to keep an eye on the html to check the good behaviour, cannot strip the tags
      transform: pipe(convertVNodesToHTML)
    },
    a: {
      outputs: [],
      successMessage: 'sink a produces the expected values',
    },
    b: {
      outputs: [],
      successMessage: 'sink b produces the expected values',
    },
    c: {
      outputs: [],
      successMessage: 'sink c produces the expected values',
    },
  }

  assert.throws(function () {
    runTestScenario(inputs, expected, forEachComponent, {
      tickDuration: 3,
      waitForFinishDelay: 10,
      analyzeTestResults: analyzeTestResults(assert, done),
      errorHandler: function (err) {
        done(err)
      }
    })
  }, /fails/, `throws an exception if called with a source setting not in sources`);
});

QUnit.test("main case - emits X values", function exec_test(assert) {
  const done = assert.async(4);
  const AS = 'output';

  const childComponent1 = function childComponent1(sources, settings) {
    return {
      DOM: sources.DOM1
        .tap(console.warn.bind(console, 'DOM : component 1: '))
        .map(x => h('span', {}, `Component 1 : ${x}`)),
      a: sources.userAction$.map(x => `Component1 - user action : ${x}`),
      forEachValue: $.of(settings[AS]),
    }
  };
  const childComponent2 = function childComponent2(sources, settings) {
    return {
      DOM: sources.DOM2
        .tap(console.warn.bind(console, 'DOM : component 2: '))
        .map(x => h('span', {}, `Component 2 : ${x}`)),
      b: sources.userAction$.map(x => `Component2 - user action : ${x}`)
    }
  };

  const forEachComponent = ForEach({
    from: 'source$',
    as: AS,
    sinkNames: ['DOM', 'a', 'b', 'forEachValue']
  }, [
    childComponent1,
    childComponent2,
  ]);

  const inputs = [
    { DOM1: { diagram: '-a--b--c--d--e--f--a' } },
    { DOM2: { diagram: '-a-b-c-d-e-f-abb-c-d' } },
    {
      userAction$: {
        diagram: 'abc-b-ac--ab---c',
        values: { a: 'click', b: 'select', c: 'hover', }
      }
    },
    {
      'source$': {
//    { diagram: '-a--b--c--d--e--f--a' } },
//    { diagram: '-a-b-c-d-e-f-abb-c-d' } },
// userAction$ : 'abc-b-ac--ab---c',
        diagram: '-t-f-tttttff-t', values: {
          t: true,
          f: false,
        }
      }
    }
  ];

  /** @type TestResults */
  const expected = {
    DOM: {
      outputs: [
        "<div><span>Component 1 : b</span><span>Component 2 : c</span></div>",
        "<div><span>Component 1 : c</span><span>Component 2 : d</span></div>",
        "<div><span>Component 1 : e</span><span>Component 2 : a</span></div>",
        "<div><span>Component 1 : f</span><span>Component 2 : b</span></div>",
        "<div><span>Component 1 : f</span><span>Component 2 : c</span></div>",
        "<div><span>Component 1 : a</span><span>Component 2 : c</span></div>",
        "<div><span>Component 1 : a</span><span>Component 2 : d</span></div>",
      ],
      successMessage: 'sink DOM produces the expected values',
      // NOTE : I need to keep an eye on the html to check the good behaviour, cannot strip the tags
      transform: pipe(convertVNodesToHTML)
    },
    a: {
      outputs: [
        'hover', 'select', 'click', 'hover', 'click', 'select', 'hover'
      ].map(x => `Component1 - user action : ${x}`),
      successMessage: 'sink a produces the expected values',
    },
    b: {
      outputs: [
        'hover', 'select', 'click', 'hover', 'click', 'select', 'hover'
      ].map(x => `Component2 - user action : ${x}`),
      successMessage: 'sink b produces the expected values',
    },
    forEachValue: {
      outputs: [true, false, true, true, true, true, true, false, false, true],
      successMessage: 'sink c produces the expected values',
    },
  }


  runTestScenario(inputs, expected, forEachComponent, {
    tickDuration: 3,
    waitForFinishDelay: 10,
    analyzeTestResults: analyzeTestResults(assert, done),
    errorHandler: function (err) {
      done(err)
    }
  });

});

QUnit.test("edge case - emits 0 values", function exec_test(assert) {
  const done = assert.async(4);
  const AS = 'output';

  const childComponent1 = function childComponent1(sources, settings) {
    return {
      DOM: sources.DOM1
        .tap(console.warn.bind(console, 'DOM : component 1: '))
        .map(x => h('span', {}, `Component 1 : ${x}`)),
      a: sources.userAction$.map(x => `Component1 - user action : ${x}`),
      forEachValue: $.of(settings[AS]),
    }
  };
  const childComponent2 = function childComponent2(sources, settings) {
    return {
      DOM: sources.DOM2
        .tap(console.warn.bind(console, 'DOM : component 2: '))
        .map(x => h('span', {}, `Component 2 : ${x}`)),
      b: sources.userAction$.map(x => `Component2 - user action : ${x}`)
    }
  };

  const forEachComponent = ForEach({
    from: 'source$',
    as: AS,
    sinkNames: ['DOM', 'a', 'b', 'forEachValue']
  }, [
    childComponent1,
    childComponent2,
  ]);

  const inputs = [
    { DOM1: { diagram: '-a--b--c--d--e--f--a' } },
    { DOM2: { diagram: '-a-b-c-d-e-f-abb-c-d' } },
    {
      userAction$: {
        diagram: 'abc-b-ac--ab---c',
        values: { a: 'click', b: 'select', c: 'hover', }
      }
    },
    {
      'source$': {
//    { diagram: '-a--b--c--d--e--f--a' } },
//    { diagram: '-a-b-c-d-e-f-abb-c-d' } },
// userAction$ : 'abc-b-ac--ab---c',
        diagram: '----------', values: {
          t: true,
          f: false,
        }
      }
    }
  ];

  /** @type TestResults */
  const expected = {
    DOM: {
      outputs: [],
      successMessage: 'sink DOM produces the expected values',
      // NOTE : I need to keep an eye on the html to check the good behaviour, cannot strip the tags
      transform: pipe(convertVNodesToHTML)
    },
    a: {
      outputs: [].map(x => `Component1 - user action : ${x}`),
      successMessage: 'sink a produces the expected values',
    },
    b: {
      outputs: [].map(x => `Component2 - user action : ${x}`),
      successMessage: 'sink b produces the expected values',
    },
    forEachValue: {
      outputs: [],
      successMessage: 'sink c produces the expected values',
    },
  }


  runTestScenario(inputs, expected, forEachComponent, {
    tickDuration: 3,
    waitForFinishDelay: 10,
    analyzeTestResults: analyzeTestResults(assert, done),
    errorHandler: function (err) {
      done(err)
    }
  });

});
