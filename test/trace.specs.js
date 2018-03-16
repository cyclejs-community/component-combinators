import * as QUnit from "qunitjs"
import * as Rx from 'rx'
import { runTestScenario } from '../testing/src/runTestScenario'
import { convertVNodesToHTML } from "../utils/src/index"
import { identity, pipe, omit } from 'ramda'
import { addPrefix, DOM_SINK } from "../utils/src"
import { traceApp } from "../tracing/src"
import { traceDOMsinkFn, traceEventSinkFn, traceEventSourceFn } from "../tracing/src/helpers"
import { div } from 'cycle-snabbdom'
import { iframeId, iframeSource, TRACE_BOOTSTRAP_NAME } from "../tracing/src/properties"
import { Combine } from "../src/components/Combine"

const $ = Rx.Observable;

function analyzeTestResults(assert, done) {
  return function analyzeTestResults(actual, expected, message) {
    assert.deepEqual(actual, expected, message);
    done()
  }
}

function removeWhenField(traces){
  return traces.map(trace => omit(['when'], trace))
}

QUnit.module("Testing trace functionality", {});

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
// - App is a component, i.e. component tree depth 0
// - using a combinator without passing a combinator name : how is the trace affected?
// - container component is not an atomic component but a composite component...

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
const A_SETTING_PROP_VALUE = 'a_setting_prop_value';
const SOME_SETTINGS = {a_setting_prop : A_SETTING_PROP_VALUE} ;

function AtomicComponentApp(sources, settings) {
  const driver1 = sources[A_DRIVER];
  const driver2 = sources[ANOTHER_DRIVER];

  return {
    [DOM_SINK]: $.merge(driver1, driver2)
      .map(x => div(`DOM_SINK emits: ${x}`)),
    [A_DRIVER]: driver1
      .map(addPrefix(`driver1 emits: `))
  }
}

const SimpleCompositeComponentWithDepth1AndCombine = Combine(SOME_SETTINGS, [
  AtomicComponentApp
]);

// TODO : after same test but testing default trace functions
QUnit.test("edge case - App is an atomic component (depth tree 0)", function exec_test(assert) {
  const done = assert.async(3);
  const traces = [];

  const App = AtomicComponentApp;
  const tracedApp = traceApp({
    _trace: {
      traceSpecs: {
        [A_DRIVER]: [traceEventSourceFn, traceEventSinkFn],
        [ANOTHER_DRIVER]: [traceEventSourceFn, traceEventSinkFn],
        // NOTE : no need to trace the DOM source here as `AtomicComponentApp` does not use DOM source
        [DOM_SINK]: [identity, traceDOMsinkFn]
      },
      sendMessage: msg => traces.push(msg)
    }
  }, App);

  const inputs = [
    { [A_DRIVER]: { diagram: '-a--b--' } },
    { [ANOTHER_DRIVER]: { diagram: '-A--B--' } },
  ];

  const expectedMessages = {
    [A_DRIVER]: {
      outputs: inputs[0][A_DRIVER].diagram.replace(/-/g, '').split('').map(x => `driver1 emits: ${x}`),
      successMessage: `sink ${A_DRIVER} produces the expected values`
    },
    [DOM_SINK]: {
      outputs: [
        `<div><iframe id="${iframeId.slice(1)}" src="${iframeSource}" style="width: 450px; height: 200px"></iframe><div><div>DOM_SINK emits: a</div></div></div>`,
        `<div><iframe id=\"${iframeId.slice(1)}\" src=\"${iframeSource}\" style=\"width: 450px; height: 200px\"></iframe><div><div>DOM_SINK emits: A</div></div></div>`,
        `<div><iframe id="${iframeId.slice(1)}" src="${iframeSource}" style=\"width: 450px; height: 200px\"></iframe><div><div>DOM_SINK emits: b</div></div></div>`,
        `<div><iframe id="${iframeId.slice(1)}" src="${iframeSource}" style=\"width: 450px; height: 200px\"></iframe><div><div>DOM_SINK emits: B</div></div></div>`
      ],
      successMessage: `sink ${DOM_SINK} produces the expected values`,
      transform: pipe(convertVNodesToHTML)
    },
  };

  const expectedGraph = [
    {
      "combinatorName": 'Combine',
      "componentName": TRACE_BOOTSTRAP_NAME,
      "id": 0,
      "isContainerComponent": false,
      "logType": "graph_structure",
      "path": [
        0
      ]
    },
    {
      "combinatorName": undefined,
      "componentName": AtomicComponentApp.name,
      "id": 1,
      "isContainerComponent": false,
      "logType": "graph_structure",
      "path": [
        0,
        0
      ]
    }
  ];
  const expectedTraces = [
    {
      "combinatorName": "Combine",
      "componentName": "ROOT",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "a"
        },
        "type": 0
      },
      "id": 0,
      "path": [
        0
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "AtomicComponentApp",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "a"
        },
        "type": 0
      },
      "id": 1,
      "path": [
        0,
        0
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "AtomicComponentApp",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div>DOM_SINK emits: a</div>"
        },
        "type": 1
      },
      "id": 2,
      "path": [
        0,
        0
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "ROOT",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div><div>DOM_SINK emits: a</div></div>"
        },
        "type": 1
      },
      "id": 3,
      "path": [
        0
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "AtomicComponentApp",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "driver1 emits: a"
        },
        "type": 1
      },
      "id": 4,
      "path": [
        0,
        0
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "ROOT",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "driver1 emits: a"
        },
        "type": 1
      },
      "id": 5,
      "path": [
        0
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "ROOT",
      "emits": {
        "identifier": "another_driver",
        "notification": {
          "kind": "N",
          "value": "A"
        },
        "type": 0
      },
      "id": 6,
      "path": [
        0
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "AtomicComponentApp",
      "emits": {
        "identifier": "another_driver",
        "notification": {
          "kind": "N",
          "value": "A"
        },
        "type": 0
      },
      "id": 7,
      "path": [
        0,
        0
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "AtomicComponentApp",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div>DOM_SINK emits: A</div>"
        },
        "type": 1
      },
      "id": 8,
      "path": [
        0,
        0
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "ROOT",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div><div>DOM_SINK emits: A</div></div>"
        },
        "type": 1
      },
      "id": 9,
      "path": [
        0
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "ROOT",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "b"
        },
        "type": 0
      },
      "id": 10,
      "path": [
        0
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "AtomicComponentApp",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "b"
        },
        "type": 0
      },
      "id": 11,
      "path": [
        0,
        0
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "AtomicComponentApp",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div>DOM_SINK emits: b</div>"
        },
        "type": 1
      },
      "id": 12,
      "path": [
        0,
        0
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "ROOT",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div><div>DOM_SINK emits: b</div></div>"
        },
        "type": 1
      },
      "id": 13,
      "path": [
        0
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "AtomicComponentApp",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "driver1 emits: b"
        },
        "type": 1
      },
      "id": 14,
      "path": [
        0,
        0
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "ROOT",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "driver1 emits: b"
        },
        "type": 1
      },
      "id": 15,
      "path": [
        0
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "ROOT",
      "emits": {
        "identifier": "another_driver",
        "notification": {
          "kind": "N",
          "value": "B"
        },
        "type": 0
      },
      "id": 16,
      "path": [
        0
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "AtomicComponentApp",
      "emits": {
        "identifier": "another_driver",
        "notification": {
          "kind": "N",
          "value": "B"
        },
        "type": 0
      },
      "id": 17,
      "path": [
        0,
        0
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "AtomicComponentApp",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div>DOM_SINK emits: B</div>"
        },
        "type": 1
      },
      "id": 18,
      "path": [
        0,
        0
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "ROOT",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div><div>DOM_SINK emits: B</div></div>"
        },
        "type": 1
      },
      "id": 19,
      "path": [
        0
      ]
    }  ];

  const testResult = runTestScenario(inputs, expectedMessages, tracedApp, {
    tickDuration: 3,
    waitForFinishDelay: 10,
    analyzeTestResults: analyzeTestResults(assert, done),
    errorHandler: function (err) {
      done(err)
    }
  });
  testResult
    .then(_ => {
      assert.deepEqual(removeWhenField(traces), expectedGraph.concat(expectedTraces), `Traces are produced as expected!`);
      done()
    });

});

QUnit.test("main case - component tree depth 1 - no container - 1 component", function exec_test(assert) {
  const done = assert.async(3);
  const traces = [];

  const App = SimpleCompositeComponentWithDepth1AndCombine;
  const tracedApp = traceApp({
    _trace: {
      traceSpecs: {
        [A_DRIVER]: [traceEventSourceFn, traceEventSinkFn],
        [ANOTHER_DRIVER]: [traceEventSourceFn, traceEventSinkFn],
        // NOTE : no need to trace the DOM source here as `AtomicComponentApp` does not use DOM source
        [DOM_SINK]: [identity, traceDOMsinkFn]
      },
      sendMessage: msg => traces.push(msg)
    }
  }, App);

  const inputs = [
    { [A_DRIVER]: { diagram: '-a--b--' } },
    { [ANOTHER_DRIVER]: { diagram: '-A--B--' } },
  ];

  const expectedMessages = {
    [A_DRIVER]: {
      outputs: inputs[0][A_DRIVER].diagram.replace(/-/g, '').split('').map(x => `driver1 emits: ${x}`),
      successMessage: `sink ${A_DRIVER} produces the expected values`
    },
    [DOM_SINK]: {
      outputs: [
        `<div><iframe id="${iframeId.slice(1)}" src="${iframeSource}" style="width: 450px; height: 200px"></iframe><div><div><div>DOM_SINK emits: a</div></div></div></div>`,
        `<div><iframe id=\"${iframeId.slice(1)}\" src=\"${iframeSource}\" style=\"width: 450px; height: 200px\"></iframe><div><div><div>DOM_SINK emits: A</div></div></div></div>`,
        `<div><iframe id="${iframeId.slice(1)}" src="${iframeSource}" style=\"width: 450px; height: 200px\"></iframe><div><div><div>DOM_SINK emits: b</div></div></div></div>`,
        `<div><iframe id="${iframeId.slice(1)}" src="${iframeSource}" style=\"width: 450px; height: 200px\"></iframe><div><div><div>DOM_SINK emits: B</div></div></div></div>`
      ],
      successMessage: `sink ${DOM_SINK} produces the expected values`,
      transform: pipe(convertVNodesToHTML)
    },
  };

  const expectedGraph = [];
  const expectedTraces = [];

  const testResult = runTestScenario(inputs, expectedMessages, tracedApp, {
    tickDuration: 3,
    waitForFinishDelay: 10,
    analyzeTestResults: analyzeTestResults(assert, done),
    errorHandler: function (err) {
      done(err)
    }
  });
  testResult
    .then(_ => {
      assert.deepEqual(removeWhenField(traces), expectedGraph.concat(expectedTraces), `Traces are produced as expected!`);
      done()
    });
});

