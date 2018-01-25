import * as QUnit from "qunitjs"
import * as Rx from 'rx'
import { span } from 'cycle-snabbdom'
import { runTestScenario } from '../src/runTestScenario'
import { convertVNodesToHTML } from "../utils/debug/src/index"
import { pipe } from 'ramda'
import { Pipe } from "../src/components/Pipe/Pipe"

const $ = Rx.Observable;

function analyzeTestResults(assert, done) {
  return function analyzeTestResults(actual, expected, message) {
    assert.deepEqual(actual, expected, message);
    done()
  }
}

QUnit.module("Testing Pipe component combinator", {})

// Test plan
// All tests with three components Event, Intent, Action
// 1. Main cases
// 1.1 colliding with overwrite true
// 1.2 not colliding with overwrite true
// 1.3 not colliding with overwrite false
// 2. Edge cases
// 2.1 colliding with overwrite false
// 2.2 no component in the array
// 2.3 no component array, but a component tree

const Events = function events(sources, settings) {
  return {
    click: sources.DOM1.take(4)
      .tap(console.warn.bind(console, 'Events - click : '))
      .map(x => `Events - click : ${x}`),
    unused: sources.userAction$.map(x => `Events - user action : ${x}`)
  }
};
const Intents = function intents(sources, settings) {
  return {
    myIntent: sources.click
      .tap(console.warn.bind(console, 'Intents : '))
      .map(x => `Intents : I-${x}`),
    unused: sources.userAction$.map(x => `Intents - user action : ${x}`)
  }
};
const Actions = function actions(sources, settings) {
  return {
    DOM: sources.myIntent
      .tap(console.warn.bind(console, 'Action : '))
      .map(x => span(`A-${x}`)),
    used: sources.userAction$.map(x => `Actions - user action : ${x}`)
  }
};

QUnit.test("edge case - sources colliding with sinks, with throwIfSinkSourceConflict true", function exec_test(assert) {
  const done = null;

  const pipedComponent = Pipe({ Pipe: { throwIfSinkSourceConflict: true, } }, [Events, Intents, Actions,]);

  const inputs = [
    // put myIntent and click in sources to collide with sink for this test case - should throw
    // at the fisrt collision
    { myIntent: { diagram: '-a--b--c--d--e--f--a' } },
    { click: { diagram: '-a--b--c--d--e--f--a' } },
    { DOM1: { diagram: '-a--b--c--d--e--f--a' } },
    { DOM2: { diagram: '-a-b-c-d-e-f-abb-c-d' } },
    {
      userAction$: {
        diagram: 'abc-b-ac--ab---c',
        values: { a: 'click', b: 'select', c: 'hover', }
      }
    },
  ];

  /** @type TestResults */
  const expected = {
    DOM: {
      outputs: [],
      successMessage: 'sink DOM produces the expected values',
      // NOTE : I need to keep an eye on the html to check the good behaviour, cannot strip the tags
      transform: pipe(convertVNodesToHTML)
    },
    used: {
      outputs: [],
      successMessage: 'sink a produces the expected values',
    },
  }

  assert.throws(function () {
    runTestScenario(inputs, expected, pipedComponent, {
      tickDuration: 3,
      waitForFinishDelay: 10,
      analyzeTestResults: analyzeTestResults(assert, done),
      errorHandler: function (err) {
        done(err)
      }
    })
  }, /Pipe/, `throws an exception if called with sources colliding with sinks, with throwIfSinkSourceConflict true`);
});

QUnit.test("edge case - wrong parameter type for component array", function exec_test(assert) {
  const done = null;
  let passed = false;

  try {
    Pipe({ Pipe: { throwIfSinkSourceConflict: false, } }, [Events, [Intents, Actions]]);
  }
  catch (err) {
    assert.equal(err.toString().includes('components'), true, `throws an exception if not called with an array of components!`)
    passed = true;
  }
  assert.ok(passed, `fails test : should throw an exception!`);
});

QUnit.test("edge case - empty component array", function exec_test(assert) {
  const done = null;
  let passed = false;

  try {
    Pipe({ Pipe: { throwIfSinkSourceConflict: true, } }, []);
  }
  catch (err) {
    assert.equal(err.toString().includes('components'), true, `throws an exception if called with an empty array!`)
    passed = true;
  }
  assert.ok(passed, `fails test : should throw an exception!`);
});

QUnit.test("main case - sources colliding with sinks, with throwIfSinkSourceConflict false", function exec_test(assert) {
  const done = assert.async(2);
  const pipedComponent = Pipe({ Pipe: { throwIfSinkSourceConflict: false, } }, [Events, Intents, Actions,]);

  const inputs = [
    // put myIntent and click in sources to collide with sink for this test case - should throw
    // at the fisrt collision
    { myIntent: { diagram: '-a--b--c--d--e--f--a' } },
    { click: { diagram: '-a--b--c--d--e--f--a' } },
    { DOM1: { diagram: '-a--b--c--d--e--f--a' } },
    { DOM2: { diagram: '-a-b-c-d-e-f-abb-c-d' } },
    {
      userAction$: {
        diagram: 'abc-b-ac--ab---c',
        values: { a: 'click', b: 'select', c: 'hover', }
      }
    },
  ];

  /** @type TestResults */
  const expected = {
    DOM: {
      outputs: [
        "<span>A-Intents : I-Events - click : a</span>",
        "<span>A-Intents : I-Events - click : b</span>",
        "<span>A-Intents : I-Events - click : c</span>",
        "<span>A-Intents : I-Events - click : d</span>"
      ],
      successMessage: 'sink DOM produces the expected values',
      // NOTE : I need to keep an eye on the html to check the good behaviour, cannot strip the tags
      transform: pipe(convertVNodesToHTML)
    },
    used: {
      outputs: [
        "Actions - user action : click",
        "Actions - user action : select",
        "Actions - user action : hover",
        "Actions - user action : select",
        "Actions - user action : click",
        "Actions - user action : hover",
        "Actions - user action : click",
        "Actions - user action : select",
        "Actions - user action : hover"
      ],
      successMessage: 'sink `used` produces the expected values',
    },
  }

  runTestScenario(inputs, expected, pipedComponent, {
    tickDuration: 3,
    waitForFinishDelay: 10,
    analyzeTestResults: analyzeTestResults(assert, done),
    errorHandler: function (err) {
      done(err)
    }
  });

});

QUnit.test("main case - sources not colliding with sinks, with throwIfSinkSourceConflict false", function exec_test(assert) {
  const done = assert.async(2);
  const pipedComponent = Pipe({ Pipe: { throwIfSinkSourceConflict: false, } }, [Events, Intents, Actions,]);

  const inputs = [
    // put myIntent and click in sources to collide with sink for this test case - should throw
    // at the fisrt collision
    { DOM1: { diagram: '-a--b--c--d--e--f--a' } },
    { DOM2: { diagram: '-a-b-c-d-e-f-abb-c-d' } },
    {
      userAction$: {
        diagram: 'abc-b-ac--ab---c',
        values: { a: 'click', b: 'select', c: 'hover', }
      }
    },
  ];

  /** @type TestResults */
  const expected = {
    DOM: {
      outputs: [
        "<span>A-Intents : I-Events - click : a</span>",
        "<span>A-Intents : I-Events - click : b</span>",
        "<span>A-Intents : I-Events - click : c</span>",
        "<span>A-Intents : I-Events - click : d</span>"
      ],
      successMessage: 'sink DOM produces the expected values',
      // NOTE : I need to keep an eye on the html to check the good behaviour, cannot strip the tags
      transform: pipe(convertVNodesToHTML)
    },
    used: {
      outputs: [
        "Actions - user action : click",
        "Actions - user action : select",
        "Actions - user action : hover",
        "Actions - user action : select",
        "Actions - user action : click",
        "Actions - user action : hover",
        "Actions - user action : click",
        "Actions - user action : select",
        "Actions - user action : hover"
      ],
      successMessage: 'sink `used` produces the expected values',
    },
  }

  runTestScenario(inputs, expected, pipedComponent, {
    tickDuration: 3,
    waitForFinishDelay: 10,
    analyzeTestResults: analyzeTestResults(assert, done),
    errorHandler: function (err) {
      done(err)
    }
  });

});

QUnit.test("main case - sources not colliding with sinks, with throwIfSinkSourceConflict true", function exec_test(assert) {
  const done = assert.async(2);
  const pipedComponent = Pipe({ Pipe: { throwIfSinkSourceConflict: true, } }, [Events, Intents, Actions,]);

  const inputs = [
    // put myIntent and click in sources to collide with sink for this test case - should throw
    // at the fisrt collision
    { DOM1: { diagram: '-a--b--c--d--e--f--a' } },
    { DOM2: { diagram: '-a-b-c-d-e-f-abb-c-d' } },
    {
      userAction$: {
        diagram: 'abc-b-ac--ab---c',
        values: { a: 'click', b: 'select', c: 'hover', }
      }
    },
  ];

  /** @type TestResults */
  const expected = {
    DOM: {
      outputs: [
        "<span>A-Intents : I-Events - click : a</span>",
        "<span>A-Intents : I-Events - click : b</span>",
        "<span>A-Intents : I-Events - click : c</span>",
        "<span>A-Intents : I-Events - click : d</span>"
      ],
      successMessage: 'sink DOM produces the expected values',
      // NOTE : I need to keep an eye on the html to check the good behaviour, cannot strip the tags
      transform: pipe(convertVNodesToHTML)
    },
    used: {
      outputs: [
        "Actions - user action : click",
        "Actions - user action : select",
        "Actions - user action : hover",
        "Actions - user action : select",
        "Actions - user action : click",
        "Actions - user action : hover",
        "Actions - user action : click",
        "Actions - user action : select",
        "Actions - user action : hover"
      ],
      successMessage: 'sink `used` produces the expected values',
    },
  }

  runTestScenario(inputs, expected, pipedComponent, {
    tickDuration: 3,
    waitForFinishDelay: 10,
    analyzeTestResults: analyzeTestResults(assert, done),
    errorHandler: function (err) {
      done(err)
    }
  });

});
