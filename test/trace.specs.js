import * as QUnit from "qunitjs"
import * as Rx from 'rx'
import { span } from 'cycle-snabbdom'
import { runTestScenario } from '../testing/src/runTestScenario'
import { convertVNodesToHTML } from "../utils/src/index"
import { pipe } from 'ramda'
import { Pipe } from "../src/components/Pipe/Pipe"
import { DOM_SINK, addPrefix } from "../utils/src"

const $ = Rx.Observable;

function analyzeTestResults(assert, done) {
  return function analyzeTestResults(actual, expected, message) {
    assert.deepEqual(actual, expected, message);
    done()
  }
}

QUnit.module("Testing trace functionality", {})

// Test plan
// Main cases
// GIVEN an application with :
// - a component tree with a depth X
// - built with a mix of different combinators (InSlot, Pipe, Switch, InjectSourcesAndSettings in particular to check
// against)
// - at App level with a redefinition of componentName
// - at every combinator level the name of the combinator, and every variable, the component name set in settings
// - several sources of input (i.e. driver input)
// - output DOM content, driver content, unknown sink content (through Pipe)
// GIVEN those sources of input emit (all ok, ok then error, ok then complete)
// THEN :
// - output is correctly traced (id, order, materialized messages, termination of components, path remains correct
// even with dynamic creation/completion of components, etc.)
// Edge cases
// - using a combinator without passing a combinator name : how is the trace affected?
// - App is a component, i.e. component tree depth 0

// Edge case
// App is a component
// try both formula

// Main cases
// Test case : w/ Combine - depth 1, breadth 1
// App = Combine(dummySettings + componentName + combinator name, [Comp])

// TODO : main code, use lenses to put component name and combinator name in settings with a standard id lens, so
// set settings will be composition of lenses - shuold be the best syntax, or else have _trace:{componentName:...} =
// long

const A_DRIVER = 'a_driver';
const ANOTHER_DRIVER = 'another_driver';

function AtomicComponentApp(sources, settings) {
  const driver1 = sources[A_DRIVER];
  const driver2 = sources[ANOTHER_DRIVER];

  return {
    [DOM_SINK] : $.merge(driver1, driver2)
      .map(addPrefix('DOM_SINK emits: ')),
    [A_DRIVER] : driver1
      .map(addPrefix(`driver1 emits: `))
  }
}

// TODO : after same test but testing default trace functions
QUnit.test("edge case - App is an atomic component (depth tree 0)", function exec_test(assert) {
  const done = assert.async(2); // TODO

  const App = AtomicComponentApp;
  // TODO : adjust the API ... don't trace run, trace the app!!
  const tracedApp = trace({
    // TODO : specs for tracing A_DRIVR, and aNOTHR_DIRVER
  }, App);

  const inputs = [
    // put myIntent and click in sources to collide with sink for this test case - should throw
    // at the fisrt collision
    { [A_DRIVER]: { diagram: '-a--b--c--d--e--f--a' } },
    { [ANOTHER_DRIVER]: { diagram: '-A--B--C--D--E--F--A' } },
  ];

  const expected = {
    [A_DRIVER]: {
      outputs: [],
      successMessage: `sink ${A_DRIVER} produces the expected values`,
//      transform: pipe(convertVNodesToHTML)
    },
    [ANOTHER_DRIVER]: {
      outputs: [],
      successMessage: `sink ${ANOTHER_DRIVER} produces the expected values`,
//      transform: pipe(convertVNodesToHTML)
    },
  };

  runTestScenario(inputs, expected, pipedComponent, {
    tickDuration: 3,
    waitForFinishDelay: 10,
    analyzeTestResults: analyzeTestResults(assert, done),
    errorHandler: function (err) {
      done(err)
    }
  });

});

QUnit.test("main case - ...", function exec_test(assert) {
  const done = assert.async(2); // TODO

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

  const expected = {
    DOM: {
      outputs: [],
      successMessage: 'sink DOM produces the expected values',
      // NOTE : I need to keep an eye on the html to check the good behaviour, cannot strip the tags
      transform: pipe(convertVNodesToHTML)
    },
    // TODO
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
