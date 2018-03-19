import * as QUnit from "qunitjs"
import * as Rx from 'rx'
import { runTestScenario } from '../testing/src/runTestScenario'
import { convertVNodesToHTML } from "../utils/src/index"
import { flatten, identity, omit, pipe, set } from 'ramda'
import { addPrefix, DOM_SINK, vLift } from "../utils/src"
import { resetGraphCounter, traceApp } from "../tracing/src"
import { componentNameInSettings, traceDOMsinkFn, traceEventSinkFn, traceEventSourceFn } from "../tracing/src/helpers"
import { div, h } from 'cycle-snabbdom'
import { iframeId, iframeSource, TRACE_BOOTSTRAP_NAME } from "../tracing/src/properties"
import { Combine } from "../src/components/Combine"
import { InjectSourcesAndSettings } from "../src"
import { ForEach } from "../src/components/ForEach"
import { Switch } from "../src/components/Switch"
import { Case } from "../src/components/Switch/Switch"

const $ = Rx.Observable;

function analyzeTestResults(assert, done) {
  return function analyzeTestResults(actual, expected, message) {
    assert.deepEqual(actual, expected, message);
    done()
  }
}

function removeWhenField(traces) {
  return traces.map(trace => omit(['when'], trace))
}

function getId(start) {
  let counter = start;
  return function () {
    return counter++
  }
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

// Main cases
// Test case : w/ Combine - depth 1, breadth 1
// App = Combine(dummySettings + componentName + combinator name, [Comp])
// Test case : w/ Combine - depth 1, breadth 2
// Test case : w/ Combine - depth 2, breadth 2
// Test case : w/ all other combinators - depth 2, breadth 2
// InSlot ? Pipe : dfault trace, Switch : index and graph structure to check, InjectSources : check local sources traced
// Test case with object which are source factory
// Test case same but with container

const APP_NAME = 'App';
const A_COMPONENT_NAME = 'a_component_name';
const EXTRA_SOURCE = 'extra_source';
const A_DRIVER = 'a_driver';
const ANOTHER_DRIVER = 'another_driver';
const A_SETTING_PROP_VALUE = 'a_setting_prop_value';
const ANOTHER_SETTING_PROP_VALUE = 'another_setting_prop_value';
const SOME_SETTINGS = { a_setting_prop: A_SETTING_PROP_VALUE };
const SOME_MORE_SETTINGS = { another_setting_prop: ANOTHER_SETTING_PROP_VALUE };
const ContainerComponent = vLift(div('.container'));
const FOREACH_AS = 'foreach_as';

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

function AnotherAtomicComponentApp(sources, settings) {
  const driver1 = sources[A_DRIVER];
  const driver2 = sources[ANOTHER_DRIVER];

  return {
    [DOM_SINK]: $.merge(driver1, driver2)
      .map(x => div(`DOM_SINK emits another : ${x}`)),
    [ANOTHER_DRIVER]: driver2
      .map(addPrefix(`driver2 emits: `))
  }
}

function AtomicComponentAppWithExtraSource(sources, settings) {
  const source = sources[EXTRA_SOURCE];

  return {
    [ANOTHER_DRIVER]: source
      .map(addPrefix(`extra source emits: `))
  }
}

function AtomicComponentMonoDriverApp(sources, settings) {
  return {
    [ANOTHER_DRIVER]: sources[ANOTHER_DRIVER]
      .map(addPrefix(`another driver emits: `))
  }
}

// NOTE : an equation that always hold is that `App` output is always the same as `traceApp(App)`, but we do not
// test that directly here
// TODO : after same test but testing default trace functions
QUnit.test("edge case - App is an atomic component (depth tree 0)", function exec_test(assert) {
  resetGraphCounter();
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
    },
    _helpers: { getId: getId(0) }
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
      "logType": "runtime",
      "path": [
        0
      ],
      "settings": {}
    },
    {
      "combinatorName": undefined,
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
      "logType": "runtime",
      "path": [
        0,
        0
      ],
      "settings": {}
    },
    {
      "combinatorName": undefined,
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
      "logType": "runtime",
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
      "logType": "runtime",
      "path": [
        0
      ]
    },
    {
      "combinatorName": undefined,
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
      "logType": "runtime",
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
      "logType": "runtime",
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
      "logType": "runtime",
      "path": [
        0
      ],
      "settings": {}
    },
    {
      "combinatorName": undefined,
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
      "logType": "runtime",
      "path": [
        0,
        0
      ],
      "settings": {}
    },
    {
      "combinatorName": undefined,
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
      "logType": "runtime",
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
      "logType": "runtime",
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
      "logType": "runtime",
      "path": [
        0
      ],
      "settings": {}
    },
    {
      "combinatorName": undefined,
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
      "logType": "runtime",
      "path": [
        0,
        0
      ],
      "settings": {}
    },
    {
      "combinatorName": undefined,
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
      "logType": "runtime",
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
      "logType": "runtime",
      "path": [
        0
      ]
    },
    {
      "combinatorName": undefined,
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
      "logType": "runtime",
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
      "logType": "runtime",
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
      "logType": "runtime",
      "path": [
        0
      ],
      "settings": {}
    },
    {
      "combinatorName": undefined,
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
      "logType": "runtime",
      "path": [
        0,
        0
      ],
      "settings": {}
    },
    {
      "combinatorName": undefined,
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
      "logType": "runtime",
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
      "logType": "runtime",
      "path": [
        0
      ]
    }
  ];

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

QUnit.test("main case - Combine - component tree depth 1 - no container - 1 component", function exec_test(assert) {
  resetGraphCounter();
  const done = assert.async(3);
  const traces = [];

  const App = Combine(set(componentNameInSettings, APP_NAME, SOME_SETTINGS), [
    AtomicComponentApp
  ]);
  const tracedApp = traceApp({
    _trace: {
      traceSpecs: {
        [A_DRIVER]: [traceEventSourceFn, traceEventSinkFn],
        [ANOTHER_DRIVER]: [traceEventSourceFn, traceEventSinkFn],
        // NOTE : no need to trace the DOM source here as `AtomicComponentApp` does not use DOM source
        [DOM_SINK]: [identity, traceDOMsinkFn]
      },
      sendMessage: msg => traces.push(msg)
    },
    _helpers: { getId: getId(0) }
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

  const expectedGraph = [
    {
      "combinatorName": "Combine",
      "componentName": "ROOT",
      "id": 0,
      "isContainerComponent": false,
      "logType": "graph_structure",
      "path": [
        0
      ]
    },
    {
      "combinatorName": 'Combine',
      "componentName": APP_NAME,
      "id": 1,
      "isContainerComponent": false,
      "logType": "graph_structure",
      "path": [
        0,
        0
      ]
    },
    {
      "combinatorName": undefined,
      "componentName": "AtomicComponentApp",
      "id": 2,
      "isContainerComponent": false,
      "logType": "graph_structure",
      "path": [
        0,
        0,
        0
      ]
    },
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
      "logType": "runtime",
      "path": [
        0
      ],
      "settings": {}
    },
    {
      "combinatorName": "Combine",
      "componentName": APP_NAME,
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "a"
        },
        "type": 0
      },
      "id": 1,
      "logType": "runtime",
      "path": [
        0,
        0
      ],
      "settings": {
        "a_setting_prop": "a_setting_prop_value"
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "AtomicComponentApp",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "a"
        },
        "type": 0
      },
      "id": 2,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ],
      "settings": {
        "a_setting_prop": "a_setting_prop_value"
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "AtomicComponentApp",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div>DOM_SINK emits: a</div>"
        },
        "type": 1
      },
      "id": 3,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": APP_NAME,
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div><div>DOM_SINK emits: a</div></div>"
        },
        "type": 1
      },
      "id": 4,
      "logType": "runtime",
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
          "value": "<div><div><div>DOM_SINK emits: a</div></div></div>"
        },
        "type": 1
      },
      "id": 5,
      "logType": "runtime",
      "path": [
        0
      ]
    },
    {
      "combinatorName": undefined,
      "componentName": "AtomicComponentApp",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "driver1 emits: a"
        },
        "type": 1
      },
      "id": 6,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": APP_NAME,
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "driver1 emits: a"
        },
        "type": 1
      },
      "id": 7,
      "logType": "runtime",
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
      "id": 8,
      "logType": "runtime",
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
      "id": 9,
      "logType": "runtime",
      "path": [
        0
      ],
      "settings": {}
    },
    {
      "combinatorName": "Combine",
      "componentName": APP_NAME,
      "emits": {
        "identifier": "another_driver",
        "notification": {
          "kind": "N",
          "value": "A"
        },
        "type": 0
      },
      "id": 10,
      "logType": "runtime",
      "path": [
        0,
        0
      ],
      "settings": {
        "a_setting_prop": "a_setting_prop_value"
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "AtomicComponentApp",
      "emits": {
        "identifier": "another_driver",
        "notification": {
          "kind": "N",
          "value": "A"
        },
        "type": 0
      },
      "id": 11,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ],
      "settings": {
        "a_setting_prop": "a_setting_prop_value"
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "AtomicComponentApp",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div>DOM_SINK emits: A</div>"
        },
        "type": 1
      },
      "id": 12,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": APP_NAME,
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div><div>DOM_SINK emits: A</div></div>"
        },
        "type": 1
      },
      "id": 13,
      "logType": "runtime",
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
          "value": "<div><div><div>DOM_SINK emits: A</div></div></div>"
        },
        "type": 1
      },
      "id": 14,
      "logType": "runtime",
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
      "id": 15,
      "logType": "runtime",
      "path": [
        0
      ],
      "settings": {}
    },
    {
      "combinatorName": "Combine",
      "componentName": APP_NAME,
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "b"
        },
        "type": 0
      },
      "id": 16,
      "logType": "runtime",
      "path": [
        0,
        0
      ],
      "settings": {
        "a_setting_prop": "a_setting_prop_value"
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "AtomicComponentApp",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "b"
        },
        "type": 0
      },
      "id": 17,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ],
      "settings": {
        "a_setting_prop": "a_setting_prop_value"
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "AtomicComponentApp",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div>DOM_SINK emits: b</div>"
        },
        "type": 1
      },
      "id": 18,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": APP_NAME,
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div><div>DOM_SINK emits: b</div></div>"
        },
        "type": 1
      },
      "id": 19,
      "logType": "runtime",
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
          "value": "<div><div><div>DOM_SINK emits: b</div></div></div>"
        },
        "type": 1
      },
      "id": 20,
      "logType": "runtime",
      "path": [
        0
      ]
    },
    {
      "combinatorName": undefined,
      "componentName": "AtomicComponentApp",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "driver1 emits: b"
        },
        "type": 1
      },
      "id": 21,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": APP_NAME,
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "driver1 emits: b"
        },
        "type": 1
      },
      "id": 22,
      "logType": "runtime",
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
      "id": 23,
      "logType": "runtime",
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
      "id": 24,
      "logType": "runtime",
      "path": [
        0
      ],
      "settings": {}
    },
    {
      "combinatorName": "Combine",
      "componentName": APP_NAME,
      "emits": {
        "identifier": "another_driver",
        "notification": {
          "kind": "N",
          "value": "B"
        },
        "type": 0
      },
      "id": 25,
      "logType": "runtime",
      "path": [
        0,
        0
      ],
      "settings": {
        "a_setting_prop": "a_setting_prop_value"
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "AtomicComponentApp",
      "emits": {
        "identifier": "another_driver",
        "notification": {
          "kind": "N",
          "value": "B"
        },
        "type": 0
      },
      "id": 26,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ],
      "settings": {
        "a_setting_prop": "a_setting_prop_value"
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "AtomicComponentApp",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div>DOM_SINK emits: B</div>"
        },
        "type": 1
      },
      "id": 27,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": APP_NAME,
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div><div>DOM_SINK emits: B</div></div>"
        },
        "type": 1
      },
      "id": 28,
      "logType": "runtime",
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
          "value": "<div><div><div>DOM_SINK emits: B</div></div></div>"
        },
        "type": 1
      },
      "id": 29,
      "logType": "runtime",
      "path": [
        0
      ]
    }
  ];

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

QUnit.test("main case - Combine - component tree depth 1 - no container - 2 components", function exec_test(assert) {
  resetGraphCounter();
  const done = assert.async(4);
  const traces = [];

  const App = Combine(set(componentNameInSettings, APP_NAME, SOME_SETTINGS), [
    AtomicComponentApp,
    AnotherAtomicComponentApp
  ]);
  const tracedApp = traceApp({
    _trace: {
      traceSpecs: {
        [A_DRIVER]: [traceEventSourceFn, traceEventSinkFn],
        [ANOTHER_DRIVER]: [traceEventSourceFn, traceEventSinkFn],
        // NOTE : no need to trace the DOM source here as `AtomicComponentApp` does not use DOM source
        [DOM_SINK]: [identity, traceDOMsinkFn]
      },
      sendMessage: msg => traces.push(msg)
    },
    _helpers: { getId: getId(0) }
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
    [ANOTHER_DRIVER]: {
      outputs: inputs[1][ANOTHER_DRIVER].diagram.replace(/-/g, '').split('').map(x => `driver2 emits: ${x}`),
      successMessage: `sink ${ANOTHER_DRIVER} produces the expected values`
    },
    [DOM_SINK]: {
      outputs: [
        "<div><iframe id=\"devtool\" src=\"devtool.html\" style=\"width: 450px; height: 200px\"></iframe><div><div><div>DOM_SINK emits: a</div><div>DOM_SINK emits another : a</div></div></div></div>",
        "<div><iframe id=\"devtool\" src=\"devtool.html\" style=\"width: 450px; height: 200px\"></iframe><div><div><div>DOM_SINK emits: A</div><div>DOM_SINK emits another : a</div></div></div></div>",
        "<div><iframe id=\"devtool\" src=\"devtool.html\" style=\"width: 450px; height: 200px\"></iframe><div><div><div>DOM_SINK emits: A</div><div>DOM_SINK emits another : A</div></div></div></div>",
        "<div><iframe id=\"devtool\" src=\"devtool.html\" style=\"width: 450px; height: 200px\"></iframe><div><div><div>DOM_SINK emits: b</div><div>DOM_SINK emits another : A</div></div></div></div>",
        "<div><iframe id=\"devtool\" src=\"devtool.html\" style=\"width: 450px; height: 200px\"></iframe><div><div><div>DOM_SINK emits: b</div><div>DOM_SINK emits another : b</div></div></div></div>",
        "<div><iframe id=\"devtool\" src=\"devtool.html\" style=\"width: 450px; height: 200px\"></iframe><div><div><div>DOM_SINK emits: B</div><div>DOM_SINK emits another : b</div></div></div></div>",
        "<div><iframe id=\"devtool\" src=\"devtool.html\" style=\"width: 450px; height: 200px\"></iframe><div><div><div>DOM_SINK emits: B</div><div>DOM_SINK emits another : B</div></div></div></div>"
      ],
      successMessage: `sink ${DOM_SINK} produces the expected values`,
      transform: pipe(convertVNodesToHTML)
    },
  };

  const expectedGraph = [
    {
      "combinatorName": "Combine",
      "componentName": "ROOT",
      "id": 0,
      "isContainerComponent": false,
      "logType": "graph_structure",
      "path": [
        0
      ]
    },
    {
      "combinatorName": 'Combine',
      "componentName": APP_NAME,
      "id": 1,
      "isContainerComponent": false,
      "logType": "graph_structure",
      "path": [
        0,
        0
      ]
    },
    {
      "combinatorName": undefined,
      "componentName": "AtomicComponentApp",
      "id": 2,
      "isContainerComponent": false,
      "logType": "graph_structure",
      "path": [
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": undefined,
      "componentName": "AnotherAtomicComponentApp",
      "id": 3,
      "isContainerComponent": false,
      "logType": "graph_structure",
      "path": [
        0,
        0,
        1
      ]
    },
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
      "logType": "runtime",
      "path": [
        0
      ],
      "settings": {}
    },
    {
      "combinatorName": "Combine",
      "componentName": "App",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "a"
        },
        "type": 0
      },
      "id": 1,
      "logType": "runtime",
      "path": [
        0,
        0
      ],
      "settings": {
        "a_setting_prop": "a_setting_prop_value"
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "AtomicComponentApp",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "a"
        },
        "type": 0
      },
      "id": 2,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ],
      "settings": {
        "a_setting_prop": "a_setting_prop_value"
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "AtomicComponentApp",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div>DOM_SINK emits: a</div>"
        },
        "type": 1
      },
      "id": 3,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": undefined,
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
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "App",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "driver1 emits: a"
        },
        "type": 1
      },
      "id": 5,
      "logType": "runtime",
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
      "id": 6,
      "logType": "runtime",
      "path": [
        0
      ]
    },
    {
      "combinatorName": undefined,
      "componentName": "AnotherAtomicComponentApp",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "a"
        },
        "type": 0
      },
      "id": 7,
      "logType": "runtime",
      "path": [
        0,
        0,
        1
      ],
      "settings": {
        "a_setting_prop": "a_setting_prop_value"
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "AnotherAtomicComponentApp",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div>DOM_SINK emits another : a</div>"
        },
        "type": 1
      },
      "id": 8,
      "logType": "runtime",
      "path": [
        0,
        0,
        1
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "App",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div><div>DOM_SINK emits: a</div><div>DOM_SINK emits another : a</div></div>"
        },
        "type": 1
      },
      "id": 9,
      "logType": "runtime",
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
          "value": "<div><div><div>DOM_SINK emits: a</div><div>DOM_SINK emits another : a</div></div></div>"
        },
        "type": 1
      },
      "id": 10,
      "logType": "runtime",
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
      "id": 11,
      "logType": "runtime",
      "path": [
        0
      ],
      "settings": {}
    },
    {
      "combinatorName": "Combine",
      "componentName": "App",
      "emits": {
        "identifier": "another_driver",
        "notification": {
          "kind": "N",
          "value": "A"
        },
        "type": 0
      },
      "id": 12,
      "logType": "runtime",
      "path": [
        0,
        0
      ],
      "settings": {
        "a_setting_prop": "a_setting_prop_value"
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "AtomicComponentApp",
      "emits": {
        "identifier": "another_driver",
        "notification": {
          "kind": "N",
          "value": "A"
        },
        "type": 0
      },
      "id": 13,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ],
      "settings": {
        "a_setting_prop": "a_setting_prop_value"
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "AtomicComponentApp",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div>DOM_SINK emits: A</div>"
        },
        "type": 1
      },
      "id": 14,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "App",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div><div>DOM_SINK emits: A</div><div>DOM_SINK emits another : a</div></div>"
        },
        "type": 1
      },
      "id": 15,
      "logType": "runtime",
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
          "value": "<div><div><div>DOM_SINK emits: A</div><div>DOM_SINK emits another : a</div></div></div>"
        },
        "type": 1
      },
      "id": 16,
      "logType": "runtime",
      "path": [
        0
      ]
    },
    {
      "combinatorName": undefined,
      "componentName": "AnotherAtomicComponentApp",
      "emits": {
        "identifier": "another_driver",
        "notification": {
          "kind": "N",
          "value": "A"
        },
        "type": 0
      },
      "id": 17,
      "logType": "runtime",
      "path": [
        0,
        0,
        1
      ],
      "settings": {
        "a_setting_prop": "a_setting_prop_value"
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "AnotherAtomicComponentApp",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div>DOM_SINK emits another : A</div>"
        },
        "type": 1
      },
      "id": 18,
      "logType": "runtime",
      "path": [
        0,
        0,
        1
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "App",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div><div>DOM_SINK emits: A</div><div>DOM_SINK emits another : A</div></div>"
        },
        "type": 1
      },
      "id": 19,
      "logType": "runtime",
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
          "value": "<div><div><div>DOM_SINK emits: A</div><div>DOM_SINK emits another : A</div></div></div>"
        },
        "type": 1
      },
      "id": 20,
      "logType": "runtime",
      "path": [
        0
      ]
    },
    {
      "combinatorName": undefined,
      "componentName": "AnotherAtomicComponentApp",
      "emits": {
        "identifier": "another_driver",
        "notification": {
          "kind": "N",
          "value": "driver2 emits: A"
        },
        "type": 1
      },
      "id": 21,
      "logType": "runtime",
      "path": [
        0,
        0,
        1
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "App",
      "emits": {
        "identifier": "another_driver",
        "notification": {
          "kind": "N",
          "value": "driver2 emits: A"
        },
        "type": 1
      },
      "id": 22,
      "logType": "runtime",
      "path": [
        0,
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
          "value": "driver2 emits: A"
        },
        "type": 1
      },
      "id": 23,
      "logType": "runtime",
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
      "id": 24,
      "logType": "runtime",
      "path": [
        0
      ],
      "settings": {}
    },
    {
      "combinatorName": "Combine",
      "componentName": "App",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "b"
        },
        "type": 0
      },
      "id": 25,
      "logType": "runtime",
      "path": [
        0,
        0
      ],
      "settings": {
        "a_setting_prop": "a_setting_prop_value"
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "AtomicComponentApp",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "b"
        },
        "type": 0
      },
      "id": 26,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ],
      "settings": {
        "a_setting_prop": "a_setting_prop_value"
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "AtomicComponentApp",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div>DOM_SINK emits: b</div>"
        },
        "type": 1
      },
      "id": 27,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "App",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div><div>DOM_SINK emits: b</div><div>DOM_SINK emits another : A</div></div>"
        },
        "type": 1
      },
      "id": 28,
      "logType": "runtime",
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
          "value": "<div><div><div>DOM_SINK emits: b</div><div>DOM_SINK emits another : A</div></div></div>"
        },
        "type": 1
      },
      "id": 29,
      "logType": "runtime",
      "path": [
        0
      ]
    },
    {
      "combinatorName": undefined,
      "componentName": "AtomicComponentApp",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "driver1 emits: b"
        },
        "type": 1
      },
      "id": 30,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "App",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "driver1 emits: b"
        },
        "type": 1
      },
      "id": 31,
      "logType": "runtime",
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
      "id": 32,
      "logType": "runtime",
      "path": [
        0
      ]
    },
    {
      "combinatorName": undefined,
      "componentName": "AnotherAtomicComponentApp",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "b"
        },
        "type": 0
      },
      "id": 33,
      "logType": "runtime",
      "path": [
        0,
        0,
        1
      ],
      "settings": {
        "a_setting_prop": "a_setting_prop_value"
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "AnotherAtomicComponentApp",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div>DOM_SINK emits another : b</div>"
        },
        "type": 1
      },
      "id": 34,
      "logType": "runtime",
      "path": [
        0,
        0,
        1
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "App",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div><div>DOM_SINK emits: b</div><div>DOM_SINK emits another : b</div></div>"
        },
        "type": 1
      },
      "id": 35,
      "logType": "runtime",
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
          "value": "<div><div><div>DOM_SINK emits: b</div><div>DOM_SINK emits another : b</div></div></div>"
        },
        "type": 1
      },
      "id": 36,
      "logType": "runtime",
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
      "id": 37,
      "logType": "runtime",
      "path": [
        0
      ],
      "settings": {}
    },
    {
      "combinatorName": "Combine",
      "componentName": "App",
      "emits": {
        "identifier": "another_driver",
        "notification": {
          "kind": "N",
          "value": "B"
        },
        "type": 0
      },
      "id": 38,
      "logType": "runtime",
      "path": [
        0,
        0
      ],
      "settings": {
        "a_setting_prop": "a_setting_prop_value"
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "AtomicComponentApp",
      "emits": {
        "identifier": "another_driver",
        "notification": {
          "kind": "N",
          "value": "B"
        },
        "type": 0
      },
      "id": 39,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ],
      "settings": {
        "a_setting_prop": "a_setting_prop_value"
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "AtomicComponentApp",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div>DOM_SINK emits: B</div>"
        },
        "type": 1
      },
      "id": 40,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "App",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div><div>DOM_SINK emits: B</div><div>DOM_SINK emits another : b</div></div>"
        },
        "type": 1
      },
      "id": 41,
      "logType": "runtime",
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
          "value": "<div><div><div>DOM_SINK emits: B</div><div>DOM_SINK emits another : b</div></div></div>"
        },
        "type": 1
      },
      "id": 42,
      "logType": "runtime",
      "path": [
        0
      ]
    },
    {
      "combinatorName": undefined,
      "componentName": "AnotherAtomicComponentApp",
      "emits": {
        "identifier": "another_driver",
        "notification": {
          "kind": "N",
          "value": "B"
        },
        "type": 0
      },
      "id": 43,
      "logType": "runtime",
      "path": [
        0,
        0,
        1
      ],
      "settings": {
        "a_setting_prop": "a_setting_prop_value"
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "AnotherAtomicComponentApp",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div>DOM_SINK emits another : B</div>"
        },
        "type": 1
      },
      "id": 44,
      "logType": "runtime",
      "path": [
        0,
        0,
        1
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "App",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div><div>DOM_SINK emits: B</div><div>DOM_SINK emits another : B</div></div>"
        },
        "type": 1
      },
      "id": 45,
      "logType": "runtime",
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
          "value": "<div><div><div>DOM_SINK emits: B</div><div>DOM_SINK emits another : B</div></div></div>"
        },
        "type": 1
      },
      "id": 46,
      "logType": "runtime",
      "path": [
        0
      ]
    },
    {
      "combinatorName": undefined,
      "componentName": "AnotherAtomicComponentApp",
      "emits": {
        "identifier": "another_driver",
        "notification": {
          "kind": "N",
          "value": "driver2 emits: B"
        },
        "type": 1
      },
      "id": 47,
      "logType": "runtime",
      "path": [
        0,
        0,
        1
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "App",
      "emits": {
        "identifier": "another_driver",
        "notification": {
          "kind": "N",
          "value": "driver2 emits: B"
        },
        "type": 1
      },
      "id": 48,
      "logType": "runtime",
      "path": [
        0,
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
          "value": "driver2 emits: B"
        },
        "type": 1
      },
      "id": 49,
      "logType": "runtime",
      "path": [
        0
      ]
    }
  ];

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

QUnit.test("main case - Combine - component tree depth 1 - 1 container - 1 component", function exec_test(assert) {
  resetGraphCounter();
  const done = assert.async(3);
  const traces = [];

  const App = Combine(set(componentNameInSettings, APP_NAME, SOME_SETTINGS), [ContainerComponent, [
    AtomicComponentApp
  ]]);
  const tracedApp = traceApp({
    _trace: {
      traceSpecs: {
        [A_DRIVER]: [traceEventSourceFn, traceEventSinkFn],
        [ANOTHER_DRIVER]: [traceEventSourceFn, traceEventSinkFn],
        // NOTE : no need to trace the DOM source here as `AtomicComponentApp` does not use DOM source
        [DOM_SINK]: [identity, traceDOMsinkFn]
      },
      sendMessage: msg => traces.push(msg)
    },
    _helpers: { getId: getId(0) }
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
        "<div><iframe id=\"devtool\" src=\"devtool.html\" style=\"width: 450px; height: 200px\"></iframe><div><div class=\"container\"><div>DOM_SINK emits: a</div></div></div></div>",
        "<div><iframe id=\"devtool\" src=\"devtool.html\" style=\"width: 450px; height: 200px\"></iframe><div><div class=\"container\"><div>DOM_SINK emits: A</div></div></div></div>",
        "<div><iframe id=\"devtool\" src=\"devtool.html\" style=\"width: 450px; height: 200px\"></iframe><div><div class=\"container\"><div>DOM_SINK emits: b</div></div></div></div>",
        "<div><iframe id=\"devtool\" src=\"devtool.html\" style=\"width: 450px; height: 200px\"></iframe><div><div class=\"container\"><div>DOM_SINK emits: B</div></div></div></div>"
      ],
      successMessage: `sink ${DOM_SINK} produces the expected values`,
      transform: pipe(convertVNodesToHTML)
    },
  };

  const expectedGraph = [
    {
      "combinatorName": "Combine",
      "componentName": "ROOT",
      "id": 0,
      "isContainerComponent": false,
      "logType": "graph_structure",
      "path": [
        0
      ]
    },
    {
      "combinatorName": 'Combine',
      "componentName": APP_NAME,
      "id": 1,
      "isContainerComponent": false,
      "logType": "graph_structure",
      "path": [
        0,
        0
      ]
    },
    {
      "combinatorName": undefined,
      "componentName": ContainerComponent.name,
      "id": 2,
      "isContainerComponent": true,
      "logType": "graph_structure",
      "path": [
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": undefined,
      "componentName": "AtomicComponentApp",
      "id": 3,
      "isContainerComponent": false,
      "logType": "graph_structure",
      "path": [
        0,
        0,
        1
      ]
    },
  ];
  const expectedTraces = [
    {
      "combinatorName": undefined,
      "componentName": "vLift",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div class=\"container\"></div>"
        },
        "type": 1
      },
      "id": 0,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": undefined,
      "componentName": "vLift",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "error": undefined,
          "kind": "C"
        },
        "type": 1
      },
      "id": 1,
      "logType": "runtime",
      "path": [
        0,
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
          "value": "a"
        },
        "type": 0
      },
      "id": 2,
      "logType": "runtime",
      "path": [
        0
      ],
      "settings": {}
    },
    {
      "combinatorName": "Combine",
      "componentName": "App",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "a"
        },
        "type": 0
      },
      "id": 3,
      "logType": "runtime",
      "path": [
        0,
        0
      ],
      "settings": {
        "a_setting_prop": "a_setting_prop_value"
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "AtomicComponentApp",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "a"
        },
        "type": 0
      },
      "id": 4,
      "logType": "runtime",
      "path": [
        0,
        0,
        1
      ],
      "settings": {
        "a_setting_prop": "a_setting_prop_value"
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "AtomicComponentApp",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div>DOM_SINK emits: a</div>"
        },
        "type": 1
      },
      "id": 5,
      "logType": "runtime",
      "path": [
        0,
        0,
        1
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "App",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div class=\"container\"><div>DOM_SINK emits: a</div></div>"
        },
        "type": 1
      },
      "id": 6,
      "logType": "runtime",
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
          "value": "<div><div class=\"container\"><div>DOM_SINK emits: a</div></div></div>"
        },
        "type": 1
      },
      "id": 7,
      "logType": "runtime",
      "path": [
        0
      ]
    },
    {
      "combinatorName": undefined,
      "componentName": "AtomicComponentApp",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "driver1 emits: a"
        },
        "type": 1
      },
      "id": 8,
      "logType": "runtime",
      "path": [
        0,
        0,
        1
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "App",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "driver1 emits: a"
        },
        "type": 1
      },
      "id": 9,
      "logType": "runtime",
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
      "id": 10,
      "logType": "runtime",
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
      "id": 11,
      "logType": "runtime",
      "path": [
        0
      ],
      "settings": {}
    },
    {
      "combinatorName": "Combine",
      "componentName": "App",
      "emits": {
        "identifier": "another_driver",
        "notification": {
          "kind": "N",
          "value": "A"
        },
        "type": 0
      },
      "id": 12,
      "logType": "runtime",
      "path": [
        0,
        0
      ],
      "settings": {
        "a_setting_prop": "a_setting_prop_value"
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "AtomicComponentApp",
      "emits": {
        "identifier": "another_driver",
        "notification": {
          "kind": "N",
          "value": "A"
        },
        "type": 0
      },
      "id": 13,
      "logType": "runtime",
      "path": [
        0,
        0,
        1
      ],
      "settings": {
        "a_setting_prop": "a_setting_prop_value"
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "AtomicComponentApp",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div>DOM_SINK emits: A</div>"
        },
        "type": 1
      },
      "id": 14,
      "logType": "runtime",
      "path": [
        0,
        0,
        1
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "App",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div class=\"container\"><div>DOM_SINK emits: A</div></div>"
        },
        "type": 1
      },
      "id": 15,
      "logType": "runtime",
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
          "value": "<div><div class=\"container\"><div>DOM_SINK emits: A</div></div></div>"
        },
        "type": 1
      },
      "id": 16,
      "logType": "runtime",
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
      "id": 17,
      "logType": "runtime",
      "path": [
        0
      ],
      "settings": {}
    },
    {
      "combinatorName": "Combine",
      "componentName": "App",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "b"
        },
        "type": 0
      },
      "id": 18,
      "logType": "runtime",
      "path": [
        0,
        0
      ],
      "settings": {
        "a_setting_prop": "a_setting_prop_value"
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "AtomicComponentApp",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "b"
        },
        "type": 0
      },
      "id": 19,
      "logType": "runtime",
      "path": [
        0,
        0,
        1
      ],
      "settings": {
        "a_setting_prop": "a_setting_prop_value"
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "AtomicComponentApp",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div>DOM_SINK emits: b</div>"
        },
        "type": 1
      },
      "id": 20,
      "logType": "runtime",
      "path": [
        0,
        0,
        1
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "App",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div class=\"container\"><div>DOM_SINK emits: b</div></div>"
        },
        "type": 1
      },
      "id": 21,
      "logType": "runtime",
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
          "value": "<div><div class=\"container\"><div>DOM_SINK emits: b</div></div></div>"
        },
        "type": 1
      },
      "id": 22,
      "logType": "runtime",
      "path": [
        0
      ]
    },
    {
      "combinatorName": undefined,
      "componentName": "AtomicComponentApp",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "driver1 emits: b"
        },
        "type": 1
      },
      "id": 23,
      "logType": "runtime",
      "path": [
        0,
        0,
        1
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "App",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "driver1 emits: b"
        },
        "type": 1
      },
      "id": 24,
      "logType": "runtime",
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
      "id": 25,
      "logType": "runtime",
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
      "id": 26,
      "logType": "runtime",
      "path": [
        0
      ],
      "settings": {}
    },
    {
      "combinatorName": "Combine",
      "componentName": "App",
      "emits": {
        "identifier": "another_driver",
        "notification": {
          "kind": "N",
          "value": "B"
        },
        "type": 0
      },
      "id": 27,
      "logType": "runtime",
      "path": [
        0,
        0
      ],
      "settings": {
        "a_setting_prop": "a_setting_prop_value"
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "AtomicComponentApp",
      "emits": {
        "identifier": "another_driver",
        "notification": {
          "kind": "N",
          "value": "B"
        },
        "type": 0
      },
      "id": 28,
      "logType": "runtime",
      "path": [
        0,
        0,
        1
      ],
      "settings": {
        "a_setting_prop": "a_setting_prop_value"
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "AtomicComponentApp",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div>DOM_SINK emits: B</div>"
        },
        "type": 1
      },
      "id": 29,
      "logType": "runtime",
      "path": [
        0,
        0,
        1
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "App",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div class=\"container\"><div>DOM_SINK emits: B</div></div>"
        },
        "type": 1
      },
      "id": 30,
      "logType": "runtime",
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
          "value": "<div><div class=\"container\"><div>DOM_SINK emits: B</div></div></div>"
        },
        "type": 1
      },
      "id": 31,
      "logType": "runtime",
      "path": [
        0
      ]
    }];

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

QUnit.test("main case - Combine - component tree depth 2 - 0 container - 2 components", function exec_test(assert) {
  resetGraphCounter();
  const done = assert.async(4);
  const traces = [];

  const App = Combine(set(componentNameInSettings, APP_NAME, SOME_SETTINGS), [
    Combine(set(componentNameInSettings, A_COMPONENT_NAME, {}), [AtomicComponentApp]),
    Combine(SOME_MORE_SETTINGS, [AnotherAtomicComponentApp])
  ]);
  const tracedApp = traceApp({
    _trace: {
      traceSpecs: {
        [A_DRIVER]: [traceEventSourceFn, traceEventSinkFn],
        [ANOTHER_DRIVER]: [traceEventSourceFn, traceEventSinkFn],
        // NOTE : no need to trace the DOM source here as `AtomicComponentApp` does not use DOM source
        [DOM_SINK]: [identity, traceDOMsinkFn]
      },
      sendMessage: msg => traces.push(msg)
    },
    _helpers: { getId: getId(0) }
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
    [ANOTHER_DRIVER]: {
      outputs: inputs[1][ANOTHER_DRIVER].diagram.replace(/-/g, '').split('').map(x => `driver2 emits: ${x}`),
      successMessage: `sink ${ANOTHER_DRIVER} produces the expected values`
    },
    [DOM_SINK]: {
      outputs: [
        "<div><iframe id=\"devtool\" src=\"devtool.html\" style=\"width: 450px; height: 200px\"></iframe><div><div><div><div>DOM_SINK emits: a</div></div><div><div>DOM_SINK emits another : a</div></div></div></div></div>",
        "<div><iframe id=\"devtool\" src=\"devtool.html\" style=\"width: 450px; height: 200px\"></iframe><div><div><div><div>DOM_SINK emits: A</div></div><div><div>DOM_SINK emits another : a</div></div></div></div></div>",
        "<div><iframe id=\"devtool\" src=\"devtool.html\" style=\"width: 450px; height: 200px\"></iframe><div><div><div><div>DOM_SINK emits: A</div></div><div><div>DOM_SINK emits another : A</div></div></div></div></div>",
        "<div><iframe id=\"devtool\" src=\"devtool.html\" style=\"width: 450px; height: 200px\"></iframe><div><div><div><div>DOM_SINK emits: b</div></div><div><div>DOM_SINK emits another : A</div></div></div></div></div>",
        "<div><iframe id=\"devtool\" src=\"devtool.html\" style=\"width: 450px; height: 200px\"></iframe><div><div><div><div>DOM_SINK emits: b</div></div><div><div>DOM_SINK emits another : b</div></div></div></div></div>",
        "<div><iframe id=\"devtool\" src=\"devtool.html\" style=\"width: 450px; height: 200px\"></iframe><div><div><div><div>DOM_SINK emits: B</div></div><div><div>DOM_SINK emits another : b</div></div></div></div></div>",
        "<div><iframe id=\"devtool\" src=\"devtool.html\" style=\"width: 450px; height: 200px\"></iframe><div><div><div><div>DOM_SINK emits: B</div></div><div><div>DOM_SINK emits another : B</div></div></div></div></div>"
      ],
      successMessage: `sink ${DOM_SINK} produces the expected values`,
      transform: pipe(convertVNodesToHTML)
    },
  };

  const expectedGraph = [
    {
      "combinatorName": "Combine",
      "componentName": "ROOT",
      "id": 0,
      "isContainerComponent": false,
      "logType": "graph_structure",
      "path": [
        0
      ]
    },
    {
      "combinatorName": 'Combine',
      "componentName": APP_NAME,
      "id": 1,
      "isContainerComponent": false,
      "logType": "graph_structure",
      "path": [
        0,
        0
      ]
    },
    {
      "combinatorName": 'Combine',
      "componentName": A_COMPONENT_NAME,
      "id": 2,
      "isContainerComponent": false,
      "logType": "graph_structure",
      "path": [
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": undefined,
      "componentName": AtomicComponentApp.name,
      "id": 3,
      "isContainerComponent": false,
      "logType": "graph_structure",
      "path": [
        0,
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": 'Combine',
      "componentName": APP_NAME,
      "id": 4,
      "isContainerComponent": false,
      "logType": "graph_structure",
      "path": [
        0,
        0,
        1
      ]
    },
    {
      "combinatorName": undefined,
      "componentName": AnotherAtomicComponentApp.name,
      "id": 5,
      "isContainerComponent": false,
      "logType": "graph_structure",
      "path": [
        0,
        0,
        1,
        0
      ]
    },
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
      "logType": "runtime",
      "path": [
        0
      ],
      "settings": {}
    },
    {
      "combinatorName": "Combine",
      "componentName": "App",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "a"
        },
        "type": 0
      },
      "id": 1,
      "logType": "runtime",
      "path": [
        0,
        0
      ],
      "settings": {
        "a_setting_prop": "a_setting_prop_value"
      }
    },
    {
      "combinatorName": "Combine",
      "componentName": "a_component_name",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "a"
        },
        "type": 0
      },
      "id": 2,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ],
      "settings": {
        "a_setting_prop": "a_setting_prop_value"
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "AtomicComponentApp",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "a"
        },
        "type": 0
      },
      "id": 3,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        0
      ],
      "settings": {
        "a_setting_prop": "a_setting_prop_value"
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "AtomicComponentApp",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div>DOM_SINK emits: a</div>"
        },
        "type": 1
      },
      "id": 4,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "a_component_name",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div><div>DOM_SINK emits: a</div></div>"
        },
        "type": 1
      },
      "id": 5,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": undefined,
      "componentName": "AtomicComponentApp",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "driver1 emits: a"
        },
        "type": 1
      },
      "id": 6,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "a_component_name",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "driver1 emits: a"
        },
        "type": 1
      },
      "id": 7,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "App",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "driver1 emits: a"
        },
        "type": 1
      },
      "id": 8,
      "logType": "runtime",
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
      "id": 9,
      "logType": "runtime",
      "path": [
        0
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "App",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "a"
        },
        "type": 0
      },
      "id": 10,
      "logType": "runtime",
      "path": [
        0,
        0,
        1
      ],
      "settings": {
        "a_setting_prop": "a_setting_prop_value",
        "another_setting_prop": "another_setting_prop_value"
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "AnotherAtomicComponentApp",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "a"
        },
        "type": 0
      },
      "id": 11,
      "logType": "runtime",
      "path": [
        0,
        0,
        1,
        0
      ],
      "settings": {
        "a_setting_prop": "a_setting_prop_value",
        "another_setting_prop": "another_setting_prop_value"
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "AnotherAtomicComponentApp",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div>DOM_SINK emits another : a</div>"
        },
        "type": 1
      },
      "id": 12,
      "logType": "runtime",
      "path": [
        0,
        0,
        1,
        0
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "App",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div><div>DOM_SINK emits another : a</div></div>"
        },
        "type": 1
      },
      "id": 13,
      "logType": "runtime",
      "path": [
        0,
        0,
        1
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "App",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div><div><div>DOM_SINK emits: a</div></div><div><div>DOM_SINK emits another : a</div></div></div>"
        },
        "type": 1
      },
      "id": 14,
      "logType": "runtime",
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
          "value": "<div><div><div><div>DOM_SINK emits: a</div></div><div><div>DOM_SINK emits another : a</div></div></div></div>"
        },
        "type": 1
      },
      "id": 15,
      "logType": "runtime",
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
      "id": 16,
      "logType": "runtime",
      "path": [
        0
      ],
      "settings": {}
    },
    {
      "combinatorName": "Combine",
      "componentName": "App",
      "emits": {
        "identifier": "another_driver",
        "notification": {
          "kind": "N",
          "value": "A"
        },
        "type": 0
      },
      "id": 17,
      "logType": "runtime",
      "path": [
        0,
        0
      ],
      "settings": {
        "a_setting_prop": "a_setting_prop_value"
      }
    },
    {
      "combinatorName": "Combine",
      "componentName": "a_component_name",
      "emits": {
        "identifier": "another_driver",
        "notification": {
          "kind": "N",
          "value": "A"
        },
        "type": 0
      },
      "id": 18,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ],
      "settings": {
        "a_setting_prop": "a_setting_prop_value"
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "AtomicComponentApp",
      "emits": {
        "identifier": "another_driver",
        "notification": {
          "kind": "N",
          "value": "A"
        },
        "type": 0
      },
      "id": 19,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        0
      ],
      "settings": {
        "a_setting_prop": "a_setting_prop_value"
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "AtomicComponentApp",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div>DOM_SINK emits: A</div>"
        },
        "type": 1
      },
      "id": 20,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "a_component_name",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div><div>DOM_SINK emits: A</div></div>"
        },
        "type": 1
      },
      "id": 21,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "App",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div><div><div>DOM_SINK emits: A</div></div><div><div>DOM_SINK emits another : a</div></div></div>"
        },
        "type": 1
      },
      "id": 22,
      "logType": "runtime",
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
          "value": "<div><div><div><div>DOM_SINK emits: A</div></div><div><div>DOM_SINK emits another : a</div></div></div></div>"
        },
        "type": 1
      },
      "id": 23,
      "logType": "runtime",
      "path": [
        0
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "App",
      "emits": {
        "identifier": "another_driver",
        "notification": {
          "kind": "N",
          "value": "A"
        },
        "type": 0
      },
      "id": 24,
      "logType": "runtime",
      "path": [
        0,
        0,
        1
      ],
      "settings": {
        "a_setting_prop": "a_setting_prop_value",
        "another_setting_prop": "another_setting_prop_value"
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "AnotherAtomicComponentApp",
      "emits": {
        "identifier": "another_driver",
        "notification": {
          "kind": "N",
          "value": "A"
        },
        "type": 0
      },
      "id": 25,
      "logType": "runtime",
      "path": [
        0,
        0,
        1,
        0
      ],
      "settings": {
        "a_setting_prop": "a_setting_prop_value",
        "another_setting_prop": "another_setting_prop_value"
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "AnotherAtomicComponentApp",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div>DOM_SINK emits another : A</div>"
        },
        "type": 1
      },
      "id": 26,
      "logType": "runtime",
      "path": [
        0,
        0,
        1,
        0
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "App",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div><div>DOM_SINK emits another : A</div></div>"
        },
        "type": 1
      },
      "id": 27,
      "logType": "runtime",
      "path": [
        0,
        0,
        1
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "App",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div><div><div>DOM_SINK emits: A</div></div><div><div>DOM_SINK emits another : A</div></div></div>"
        },
        "type": 1
      },
      "id": 28,
      "logType": "runtime",
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
          "value": "<div><div><div><div>DOM_SINK emits: A</div></div><div><div>DOM_SINK emits another : A</div></div></div></div>"
        },
        "type": 1
      },
      "id": 29,
      "logType": "runtime",
      "path": [
        0
      ]
    },
    {
      "combinatorName": undefined,
      "componentName": "AnotherAtomicComponentApp",
      "emits": {
        "identifier": "another_driver",
        "notification": {
          "kind": "N",
          "value": "driver2 emits: A"
        },
        "type": 1
      },
      "id": 30,
      "logType": "runtime",
      "path": [
        0,
        0,
        1,
        0
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "App",
      "emits": {
        "identifier": "another_driver",
        "notification": {
          "kind": "N",
          "value": "driver2 emits: A"
        },
        "type": 1
      },
      "id": 31,
      "logType": "runtime",
      "path": [
        0,
        0,
        1
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "App",
      "emits": {
        "identifier": "another_driver",
        "notification": {
          "kind": "N",
          "value": "driver2 emits: A"
        },
        "type": 1
      },
      "id": 32,
      "logType": "runtime",
      "path": [
        0,
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
          "value": "driver2 emits: A"
        },
        "type": 1
      },
      "id": 33,
      "logType": "runtime",
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
      "id": 34,
      "logType": "runtime",
      "path": [
        0
      ],
      "settings": {}
    },
    {
      "combinatorName": "Combine",
      "componentName": "App",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "b"
        },
        "type": 0
      },
      "id": 35,
      "logType": "runtime",
      "path": [
        0,
        0
      ],
      "settings": {
        "a_setting_prop": "a_setting_prop_value"
      }
    },
    {
      "combinatorName": "Combine",
      "componentName": "a_component_name",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "b"
        },
        "type": 0
      },
      "id": 36,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ],
      "settings": {
        "a_setting_prop": "a_setting_prop_value"
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "AtomicComponentApp",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "b"
        },
        "type": 0
      },
      "id": 37,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        0
      ],
      "settings": {
        "a_setting_prop": "a_setting_prop_value"
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "AtomicComponentApp",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div>DOM_SINK emits: b</div>"
        },
        "type": 1
      },
      "id": 38,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "a_component_name",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div><div>DOM_SINK emits: b</div></div>"
        },
        "type": 1
      },
      "id": 39,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "App",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div><div><div>DOM_SINK emits: b</div></div><div><div>DOM_SINK emits another : A</div></div></div>"
        },
        "type": 1
      },
      "id": 40,
      "logType": "runtime",
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
          "value": "<div><div><div><div>DOM_SINK emits: b</div></div><div><div>DOM_SINK emits another : A</div></div></div></div>"
        },
        "type": 1
      },
      "id": 41,
      "logType": "runtime",
      "path": [
        0
      ]
    },
    {
      "combinatorName": undefined,
      "componentName": "AtomicComponentApp",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "driver1 emits: b"
        },
        "type": 1
      },
      "id": 42,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "a_component_name",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "driver1 emits: b"
        },
        "type": 1
      },
      "id": 43,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "App",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "driver1 emits: b"
        },
        "type": 1
      },
      "id": 44,
      "logType": "runtime",
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
      "id": 45,
      "logType": "runtime",
      "path": [
        0
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "App",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "b"
        },
        "type": 0
      },
      "id": 46,
      "logType": "runtime",
      "path": [
        0,
        0,
        1
      ],
      "settings": {
        "a_setting_prop": "a_setting_prop_value",
        "another_setting_prop": "another_setting_prop_value"
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "AnotherAtomicComponentApp",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "b"
        },
        "type": 0
      },
      "id": 47,
      "logType": "runtime",
      "path": [
        0,
        0,
        1,
        0
      ],
      "settings": {
        "a_setting_prop": "a_setting_prop_value",
        "another_setting_prop": "another_setting_prop_value"
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "AnotherAtomicComponentApp",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div>DOM_SINK emits another : b</div>"
        },
        "type": 1
      },
      "id": 48,
      "logType": "runtime",
      "path": [
        0,
        0,
        1,
        0
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "App",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div><div>DOM_SINK emits another : b</div></div>"
        },
        "type": 1
      },
      "id": 49,
      "logType": "runtime",
      "path": [
        0,
        0,
        1
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "App",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div><div><div>DOM_SINK emits: b</div></div><div><div>DOM_SINK emits another : b</div></div></div>"
        },
        "type": 1
      },
      "id": 50,
      "logType": "runtime",
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
          "value": "<div><div><div><div>DOM_SINK emits: b</div></div><div><div>DOM_SINK emits another : b</div></div></div></div>"
        },
        "type": 1
      },
      "id": 51,
      "logType": "runtime",
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
      "id": 52,
      "logType": "runtime",
      "path": [
        0
      ],
      "settings": {}
    },
    {
      "combinatorName": "Combine",
      "componentName": "App",
      "emits": {
        "identifier": "another_driver",
        "notification": {
          "kind": "N",
          "value": "B"
        },
        "type": 0
      },
      "id": 53,
      "logType": "runtime",
      "path": [
        0,
        0
      ],
      "settings": {
        "a_setting_prop": "a_setting_prop_value"
      }
    },
    {
      "combinatorName": "Combine",
      "componentName": "a_component_name",
      "emits": {
        "identifier": "another_driver",
        "notification": {
          "kind": "N",
          "value": "B"
        },
        "type": 0
      },
      "id": 54,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ],
      "settings": {
        "a_setting_prop": "a_setting_prop_value"
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "AtomicComponentApp",
      "emits": {
        "identifier": "another_driver",
        "notification": {
          "kind": "N",
          "value": "B"
        },
        "type": 0
      },
      "id": 55,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        0
      ],
      "settings": {
        "a_setting_prop": "a_setting_prop_value"
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "AtomicComponentApp",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div>DOM_SINK emits: B</div>"
        },
        "type": 1
      },
      "id": 56,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "a_component_name",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div><div>DOM_SINK emits: B</div></div>"
        },
        "type": 1
      },
      "id": 57,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "App",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div><div><div>DOM_SINK emits: B</div></div><div><div>DOM_SINK emits another : b</div></div></div>"
        },
        "type": 1
      },
      "id": 58,
      "logType": "runtime",
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
          "value": "<div><div><div><div>DOM_SINK emits: B</div></div><div><div>DOM_SINK emits another : b</div></div></div></div>"
        },
        "type": 1
      },
      "id": 59,
      "logType": "runtime",
      "path": [
        0
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "App",
      "emits": {
        "identifier": "another_driver",
        "notification": {
          "kind": "N",
          "value": "B"
        },
        "type": 0
      },
      "id": 60,
      "logType": "runtime",
      "path": [
        0,
        0,
        1
      ],
      "settings": {
        "a_setting_prop": "a_setting_prop_value",
        "another_setting_prop": "another_setting_prop_value"
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "AnotherAtomicComponentApp",
      "emits": {
        "identifier": "another_driver",
        "notification": {
          "kind": "N",
          "value": "B"
        },
        "type": 0
      },
      "id": 61,
      "logType": "runtime",
      "path": [
        0,
        0,
        1,
        0
      ],
      "settings": {
        "a_setting_prop": "a_setting_prop_value",
        "another_setting_prop": "another_setting_prop_value"
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "AnotherAtomicComponentApp",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div>DOM_SINK emits another : B</div>"
        },
        "type": 1
      },
      "id": 62,
      "logType": "runtime",
      "path": [
        0,
        0,
        1,
        0
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "App",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div><div>DOM_SINK emits another : B</div></div>"
        },
        "type": 1
      },
      "id": 63,
      "logType": "runtime",
      "path": [
        0,
        0,
        1
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "App",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div><div><div>DOM_SINK emits: B</div></div><div><div>DOM_SINK emits another : B</div></div></div>"
        },
        "type": 1
      },
      "id": 64,
      "logType": "runtime",
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
          "value": "<div><div><div><div>DOM_SINK emits: B</div></div><div><div>DOM_SINK emits another : B</div></div></div></div>"
        },
        "type": 1
      },
      "id": 65,
      "logType": "runtime",
      "path": [
        0
      ]
    },
    {
      "combinatorName": undefined,
      "componentName": "AnotherAtomicComponentApp",
      "emits": {
        "identifier": "another_driver",
        "notification": {
          "kind": "N",
          "value": "driver2 emits: B"
        },
        "type": 1
      },
      "id": 66,
      "logType": "runtime",
      "path": [
        0,
        0,
        1,
        0
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "App",
      "emits": {
        "identifier": "another_driver",
        "notification": {
          "kind": "N",
          "value": "driver2 emits: B"
        },
        "type": 1
      },
      "id": 67,
      "logType": "runtime",
      "path": [
        0,
        0,
        1
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "App",
      "emits": {
        "identifier": "another_driver",
        "notification": {
          "kind": "N",
          "value": "driver2 emits: B"
        },
        "type": 1
      },
      "id": 68,
      "logType": "runtime",
      "path": [
        0,
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
          "value": "driver2 emits: B"
        },
        "type": 1
      },
      "id": 69,
      "logType": "runtime",
      "path": [
        0
      ]
    }];

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

QUnit.test("main case - Combine - component tree depth 2 - 1 container - 2 components", function exec_test(assert) {
  resetGraphCounter();
  const done = assert.async(4);
  const traces = [];

  const App = Combine(set(componentNameInSettings, APP_NAME, SOME_SETTINGS), [
    Combine(set(componentNameInSettings, A_COMPONENT_NAME, {}), [AtomicComponentApp]),
    Combine(SOME_MORE_SETTINGS, [ContainerComponent, [AnotherAtomicComponentApp]])
  ]);
  const tracedApp = traceApp({
    _trace: {
      traceSpecs: {
        [A_DRIVER]: [traceEventSourceFn, traceEventSinkFn],
        [ANOTHER_DRIVER]: [traceEventSourceFn, traceEventSinkFn],
        // NOTE : no need to trace the DOM source here as `AtomicComponentApp` does not use DOM source
        [DOM_SINK]: [identity, traceDOMsinkFn]
      },
      sendMessage: msg => traces.push(msg)
    },
    _helpers: { getId: getId(0) }
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
    [ANOTHER_DRIVER]: {
      outputs: inputs[1][ANOTHER_DRIVER].diagram.replace(/-/g, '').split('').map(x => `driver2 emits: ${x}`),
      successMessage: `sink ${ANOTHER_DRIVER} produces the expected values`
    },
    [DOM_SINK]: {
      outputs: [
        "<div><iframe id=\"devtool\" src=\"devtool.html\" style=\"width: 450px; height: 200px\"></iframe><div><div><div><div>DOM_SINK emits: a</div></div><div class=\"container\"><div>DOM_SINK emits another : a</div></div></div></div></div>",
        "<div><iframe id=\"devtool\" src=\"devtool.html\" style=\"width: 450px; height: 200px\"></iframe><div><div><div><div>DOM_SINK emits: A</div></div><div class=\"container\"><div>DOM_SINK emits another : a</div></div></div></div></div>",
        "<div><iframe id=\"devtool\" src=\"devtool.html\" style=\"width: 450px; height: 200px\"></iframe><div><div><div><div>DOM_SINK emits: A</div></div><div class=\"container\"><div>DOM_SINK emits another : A</div></div></div></div></div>",
        "<div><iframe id=\"devtool\" src=\"devtool.html\" style=\"width: 450px; height: 200px\"></iframe><div><div><div><div>DOM_SINK emits: b</div></div><div class=\"container\"><div>DOM_SINK emits another : A</div></div></div></div></div>",
        "<div><iframe id=\"devtool\" src=\"devtool.html\" style=\"width: 450px; height: 200px\"></iframe><div><div><div><div>DOM_SINK emits: b</div></div><div class=\"container\"><div>DOM_SINK emits another : b</div></div></div></div></div>",
        "<div><iframe id=\"devtool\" src=\"devtool.html\" style=\"width: 450px; height: 200px\"></iframe><div><div><div><div>DOM_SINK emits: B</div></div><div class=\"container\"><div>DOM_SINK emits another : b</div></div></div></div></div>",
        "<div><iframe id=\"devtool\" src=\"devtool.html\" style=\"width: 450px; height: 200px\"></iframe><div><div><div><div>DOM_SINK emits: B</div></div><div class=\"container\"><div>DOM_SINK emits another : B</div></div></div></div></div>"
      ],
      successMessage: `sink ${DOM_SINK} produces the expected values`,
      transform: pipe(convertVNodesToHTML)
    },
  };

  const expectedGraph = [
    {
      "combinatorName": "Combine",
      "componentName": "ROOT",
      "id": 0,
      "isContainerComponent": false,
      "logType": "graph_structure",
      "path": [
        0
      ]
    },
    {
      "combinatorName": 'Combine',
      "componentName": APP_NAME,
      "id": 1,
      "isContainerComponent": false,
      "logType": "graph_structure",
      "path": [
        0,
        0
      ]
    },
    {
      "combinatorName": 'Combine',
      "componentName": A_COMPONENT_NAME,
      "id": 2,
      "isContainerComponent": false,
      "logType": "graph_structure",
      "path": [
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": undefined,
      "componentName": AtomicComponentApp.name,
      "id": 3,
      "isContainerComponent": false,
      "logType": "graph_structure",
      "path": [
        0,
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": 'Combine',
      "componentName": APP_NAME,
      "id": 4,
      "isContainerComponent": false,
      "logType": "graph_structure",
      "path": [
        0,
        0,
        1
      ]
    },
    {
      "combinatorName": undefined,
      "componentName": ContainerComponent.name,
      "id": 5,
      "isContainerComponent": true,
      "logType": "graph_structure",
      "path": [
        0,
        0,
        1,
        0
      ]
    },
    {
      "combinatorName": undefined,
      "componentName": AnotherAtomicComponentApp.name,
      "id": 6,
      "isContainerComponent": false,
      "logType": "graph_structure",
      "path": [
        0,
        0,
        1,
        1
      ]
    },
  ];
  const expectedTraces = [
    {
      "combinatorName": undefined,
      "componentName": "vLift",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div class=\"container\"></div>"
        },
        "type": 1
      },
      "id": 0,
      "logType": "runtime",
      "path": [
        0,
        0,
        1,
        0
      ]
    },
    {
      "combinatorName": undefined,
      "componentName": "vLift",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "error": undefined,
          "kind": "C"
        },
        "type": 1
      },
      "id": 1,
      "logType": "runtime",
      "path": [
        0,
        0,
        1,
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
          "value": "a"
        },
        "type": 0
      },
      "id": 2,
      "logType": "runtime",
      "path": [
        0
      ],
      "settings": {}
    },
    {
      "combinatorName": "Combine",
      "componentName": "App",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "a"
        },
        "type": 0
      },
      "id": 3,
      "logType": "runtime",
      "path": [
        0,
        0
      ],
      "settings": {
        "a_setting_prop": "a_setting_prop_value"
      }
    },
    {
      "combinatorName": "Combine",
      "componentName": "a_component_name",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "a"
        },
        "type": 0
      },
      "id": 4,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ],
      "settings": {
        "a_setting_prop": "a_setting_prop_value"
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "AtomicComponentApp",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "a"
        },
        "type": 0
      },
      "id": 5,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        0
      ],
      "settings": {
        "a_setting_prop": "a_setting_prop_value"
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "AtomicComponentApp",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div>DOM_SINK emits: a</div>"
        },
        "type": 1
      },
      "id": 6,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "a_component_name",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div><div>DOM_SINK emits: a</div></div>"
        },
        "type": 1
      },
      "id": 7,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": undefined,
      "componentName": "AtomicComponentApp",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "driver1 emits: a"
        },
        "type": 1
      },
      "id": 8,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "a_component_name",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "driver1 emits: a"
        },
        "type": 1
      },
      "id": 9,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "App",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "driver1 emits: a"
        },
        "type": 1
      },
      "id": 10,
      "logType": "runtime",
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
      "id": 11,
      "logType": "runtime",
      "path": [
        0
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "App",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "a"
        },
        "type": 0
      },
      "id": 12,
      "logType": "runtime",
      "path": [
        0,
        0,
        1
      ],
      "settings": {
        "a_setting_prop": "a_setting_prop_value",
        "another_setting_prop": "another_setting_prop_value"
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "AnotherAtomicComponentApp",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "a"
        },
        "type": 0
      },
      "id": 13,
      "logType": "runtime",
      "path": [
        0,
        0,
        1,
        1
      ],
      "settings": {
        "a_setting_prop": "a_setting_prop_value",
        "another_setting_prop": "another_setting_prop_value"
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "AnotherAtomicComponentApp",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div>DOM_SINK emits another : a</div>"
        },
        "type": 1
      },
      "id": 14,
      "logType": "runtime",
      "path": [
        0,
        0,
        1,
        1
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "App",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div class=\"container\"><div>DOM_SINK emits another : a</div></div>"
        },
        "type": 1
      },
      "id": 15,
      "logType": "runtime",
      "path": [
        0,
        0,
        1
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "App",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div><div><div>DOM_SINK emits: a</div></div><div class=\"container\"><div>DOM_SINK emits another : a</div></div></div>"
        },
        "type": 1
      },
      "id": 16,
      "logType": "runtime",
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
          "value": "<div><div><div><div>DOM_SINK emits: a</div></div><div class=\"container\"><div>DOM_SINK emits another : a</div></div></div></div>"
        },
        "type": 1
      },
      "id": 17,
      "logType": "runtime",
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
      "id": 18,
      "logType": "runtime",
      "path": [
        0
      ],
      "settings": {}
    },
    {
      "combinatorName": "Combine",
      "componentName": "App",
      "emits": {
        "identifier": "another_driver",
        "notification": {
          "kind": "N",
          "value": "A"
        },
        "type": 0
      },
      "id": 19,
      "logType": "runtime",
      "path": [
        0,
        0
      ],
      "settings": {
        "a_setting_prop": "a_setting_prop_value"
      }
    },
    {
      "combinatorName": "Combine",
      "componentName": "a_component_name",
      "emits": {
        "identifier": "another_driver",
        "notification": {
          "kind": "N",
          "value": "A"
        },
        "type": 0
      },
      "id": 20,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ],
      "settings": {
        "a_setting_prop": "a_setting_prop_value"
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "AtomicComponentApp",
      "emits": {
        "identifier": "another_driver",
        "notification": {
          "kind": "N",
          "value": "A"
        },
        "type": 0
      },
      "id": 21,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        0
      ],
      "settings": {
        "a_setting_prop": "a_setting_prop_value"
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "AtomicComponentApp",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div>DOM_SINK emits: A</div>"
        },
        "type": 1
      },
      "id": 22,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "a_component_name",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div><div>DOM_SINK emits: A</div></div>"
        },
        "type": 1
      },
      "id": 23,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "App",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div><div><div>DOM_SINK emits: A</div></div><div class=\"container\"><div>DOM_SINK emits another : a</div></div></div>"
        },
        "type": 1
      },
      "id": 24,
      "logType": "runtime",
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
          "value": "<div><div><div><div>DOM_SINK emits: A</div></div><div class=\"container\"><div>DOM_SINK emits another : a</div></div></div></div>"
        },
        "type": 1
      },
      "id": 25,
      "logType": "runtime",
      "path": [
        0
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "App",
      "emits": {
        "identifier": "another_driver",
        "notification": {
          "kind": "N",
          "value": "A"
        },
        "type": 0
      },
      "id": 26,
      "logType": "runtime",
      "path": [
        0,
        0,
        1
      ],
      "settings": {
        "a_setting_prop": "a_setting_prop_value",
        "another_setting_prop": "another_setting_prop_value"
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "AnotherAtomicComponentApp",
      "emits": {
        "identifier": "another_driver",
        "notification": {
          "kind": "N",
          "value": "A"
        },
        "type": 0
      },
      "id": 27,
      "logType": "runtime",
      "path": [
        0,
        0,
        1,
        1
      ],
      "settings": {
        "a_setting_prop": "a_setting_prop_value",
        "another_setting_prop": "another_setting_prop_value"
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "AnotherAtomicComponentApp",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div>DOM_SINK emits another : A</div>"
        },
        "type": 1
      },
      "id": 28,
      "logType": "runtime",
      "path": [
        0,
        0,
        1,
        1
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "App",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div class=\"container\"><div>DOM_SINK emits another : A</div></div>"
        },
        "type": 1
      },
      "id": 29,
      "logType": "runtime",
      "path": [
        0,
        0,
        1
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "App",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div><div><div>DOM_SINK emits: A</div></div><div class=\"container\"><div>DOM_SINK emits another : A</div></div></div>"
        },
        "type": 1
      },
      "id": 30,
      "logType": "runtime",
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
          "value": "<div><div><div><div>DOM_SINK emits: A</div></div><div class=\"container\"><div>DOM_SINK emits another : A</div></div></div></div>"
        },
        "type": 1
      },
      "id": 31,
      "logType": "runtime",
      "path": [
        0
      ]
    },
    {
      "combinatorName": undefined,
      "componentName": "AnotherAtomicComponentApp",
      "emits": {
        "identifier": "another_driver",
        "notification": {
          "kind": "N",
          "value": "driver2 emits: A"
        },
        "type": 1
      },
      "id": 32,
      "logType": "runtime",
      "path": [
        0,
        0,
        1,
        1
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "App",
      "emits": {
        "identifier": "another_driver",
        "notification": {
          "kind": "N",
          "value": "driver2 emits: A"
        },
        "type": 1
      },
      "id": 33,
      "logType": "runtime",
      "path": [
        0,
        0,
        1
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "App",
      "emits": {
        "identifier": "another_driver",
        "notification": {
          "kind": "N",
          "value": "driver2 emits: A"
        },
        "type": 1
      },
      "id": 34,
      "logType": "runtime",
      "path": [
        0,
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
          "value": "driver2 emits: A"
        },
        "type": 1
      },
      "id": 35,
      "logType": "runtime",
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
      "id": 36,
      "logType": "runtime",
      "path": [
        0
      ],
      "settings": {}
    },
    {
      "combinatorName": "Combine",
      "componentName": "App",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "b"
        },
        "type": 0
      },
      "id": 37,
      "logType": "runtime",
      "path": [
        0,
        0
      ],
      "settings": {
        "a_setting_prop": "a_setting_prop_value"
      }
    },
    {
      "combinatorName": "Combine",
      "componentName": "a_component_name",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "b"
        },
        "type": 0
      },
      "id": 38,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ],
      "settings": {
        "a_setting_prop": "a_setting_prop_value"
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "AtomicComponentApp",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "b"
        },
        "type": 0
      },
      "id": 39,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        0
      ],
      "settings": {
        "a_setting_prop": "a_setting_prop_value"
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "AtomicComponentApp",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div>DOM_SINK emits: b</div>"
        },
        "type": 1
      },
      "id": 40,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "a_component_name",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div><div>DOM_SINK emits: b</div></div>"
        },
        "type": 1
      },
      "id": 41,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "App",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div><div><div>DOM_SINK emits: b</div></div><div class=\"container\"><div>DOM_SINK emits another : A</div></div></div>"
        },
        "type": 1
      },
      "id": 42,
      "logType": "runtime",
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
          "value": "<div><div><div><div>DOM_SINK emits: b</div></div><div class=\"container\"><div>DOM_SINK emits another : A</div></div></div></div>"
        },
        "type": 1
      },
      "id": 43,
      "logType": "runtime",
      "path": [
        0
      ]
    },
    {
      "combinatorName": undefined,
      "componentName": "AtomicComponentApp",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "driver1 emits: b"
        },
        "type": 1
      },
      "id": 44,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "a_component_name",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "driver1 emits: b"
        },
        "type": 1
      },
      "id": 45,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "App",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "driver1 emits: b"
        },
        "type": 1
      },
      "id": 46,
      "logType": "runtime",
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
      "id": 47,
      "logType": "runtime",
      "path": [
        0
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "App",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "b"
        },
        "type": 0
      },
      "id": 48,
      "logType": "runtime",
      "path": [
        0,
        0,
        1
      ],
      "settings": {
        "a_setting_prop": "a_setting_prop_value",
        "another_setting_prop": "another_setting_prop_value"
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "AnotherAtomicComponentApp",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "b"
        },
        "type": 0
      },
      "id": 49,
      "logType": "runtime",
      "path": [
        0,
        0,
        1,
        1
      ],
      "settings": {
        "a_setting_prop": "a_setting_prop_value",
        "another_setting_prop": "another_setting_prop_value"
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "AnotherAtomicComponentApp",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div>DOM_SINK emits another : b</div>"
        },
        "type": 1
      },
      "id": 50,
      "logType": "runtime",
      "path": [
        0,
        0,
        1,
        1
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "App",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div class=\"container\"><div>DOM_SINK emits another : b</div></div>"
        },
        "type": 1
      },
      "id": 51,
      "logType": "runtime",
      "path": [
        0,
        0,
        1
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "App",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div><div><div>DOM_SINK emits: b</div></div><div class=\"container\"><div>DOM_SINK emits another : b</div></div></div>"
        },
        "type": 1
      },
      "id": 52,
      "logType": "runtime",
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
          "value": "<div><div><div><div>DOM_SINK emits: b</div></div><div class=\"container\"><div>DOM_SINK emits another : b</div></div></div></div>"
        },
        "type": 1
      },
      "id": 53,
      "logType": "runtime",
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
      "id": 54,
      "logType": "runtime",
      "path": [
        0
      ],
      "settings": {}
    },
    {
      "combinatorName": "Combine",
      "componentName": "App",
      "emits": {
        "identifier": "another_driver",
        "notification": {
          "kind": "N",
          "value": "B"
        },
        "type": 0
      },
      "id": 55,
      "logType": "runtime",
      "path": [
        0,
        0
      ],
      "settings": {
        "a_setting_prop": "a_setting_prop_value"
      }
    },
    {
      "combinatorName": "Combine",
      "componentName": "a_component_name",
      "emits": {
        "identifier": "another_driver",
        "notification": {
          "kind": "N",
          "value": "B"
        },
        "type": 0
      },
      "id": 56,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ],
      "settings": {
        "a_setting_prop": "a_setting_prop_value"
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "AtomicComponentApp",
      "emits": {
        "identifier": "another_driver",
        "notification": {
          "kind": "N",
          "value": "B"
        },
        "type": 0
      },
      "id": 57,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        0
      ],
      "settings": {
        "a_setting_prop": "a_setting_prop_value"
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "AtomicComponentApp",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div>DOM_SINK emits: B</div>"
        },
        "type": 1
      },
      "id": 58,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "a_component_name",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div><div>DOM_SINK emits: B</div></div>"
        },
        "type": 1
      },
      "id": 59,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "App",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div><div><div>DOM_SINK emits: B</div></div><div class=\"container\"><div>DOM_SINK emits another : b</div></div></div>"
        },
        "type": 1
      },
      "id": 60,
      "logType": "runtime",
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
          "value": "<div><div><div><div>DOM_SINK emits: B</div></div><div class=\"container\"><div>DOM_SINK emits another : b</div></div></div></div>"
        },
        "type": 1
      },
      "id": 61,
      "logType": "runtime",
      "path": [
        0
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "App",
      "emits": {
        "identifier": "another_driver",
        "notification": {
          "kind": "N",
          "value": "B"
        },
        "type": 0
      },
      "id": 62,
      "logType": "runtime",
      "path": [
        0,
        0,
        1
      ],
      "settings": {
        "a_setting_prop": "a_setting_prop_value",
        "another_setting_prop": "another_setting_prop_value"
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "AnotherAtomicComponentApp",
      "emits": {
        "identifier": "another_driver",
        "notification": {
          "kind": "N",
          "value": "B"
        },
        "type": 0
      },
      "id": 63,
      "logType": "runtime",
      "path": [
        0,
        0,
        1,
        1
      ],
      "settings": {
        "a_setting_prop": "a_setting_prop_value",
        "another_setting_prop": "another_setting_prop_value"
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "AnotherAtomicComponentApp",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div>DOM_SINK emits another : B</div>"
        },
        "type": 1
      },
      "id": 64,
      "logType": "runtime",
      "path": [
        0,
        0,
        1,
        1
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "App",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div class=\"container\"><div>DOM_SINK emits another : B</div></div>"
        },
        "type": 1
      },
      "id": 65,
      "logType": "runtime",
      "path": [
        0,
        0,
        1
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "App",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div><div><div>DOM_SINK emits: B</div></div><div class=\"container\"><div>DOM_SINK emits another : B</div></div></div>"
        },
        "type": 1
      },
      "id": 66,
      "logType": "runtime",
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
          "value": "<div><div><div><div>DOM_SINK emits: B</div></div><div class=\"container\"><div>DOM_SINK emits another : B</div></div></div></div>"
        },
        "type": 1
      },
      "id": 67,
      "logType": "runtime",
      "path": [
        0
      ]
    },
    {
      "combinatorName": undefined,
      "componentName": "AnotherAtomicComponentApp",
      "emits": {
        "identifier": "another_driver",
        "notification": {
          "kind": "N",
          "value": "driver2 emits: B"
        },
        "type": 1
      },
      "id": 68,
      "logType": "runtime",
      "path": [
        0,
        0,
        1,
        1
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "App",
      "emits": {
        "identifier": "another_driver",
        "notification": {
          "kind": "N",
          "value": "driver2 emits: B"
        },
        "type": 1
      },
      "id": 69,
      "logType": "runtime",
      "path": [
        0,
        0,
        1
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "App",
      "emits": {
        "identifier": "another_driver",
        "notification": {
          "kind": "N",
          "value": "driver2 emits: B"
        },
        "type": 1
      },
      "id": 70,
      "logType": "runtime",
      "path": [
        0,
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
          "value": "driver2 emits: B"
        },
        "type": 1
      },
      "id": 71,
      "logType": "runtime",
      "path": [
        0
      ]
    }];

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

QUnit.test("main case - Combine, InjectSettings - component tree depth 2 - 0 container - 2 components", function exec_test(assert) {
  resetGraphCounter();
  const done = assert.async(4);
  const traces = [];

  const App = Combine(set(componentNameInSettings, APP_NAME, SOME_SETTINGS), [
    Combine(set(componentNameInSettings, A_COMPONENT_NAME, {}), [AtomicComponentApp]),
    InjectSourcesAndSettings({ settings: SOME_MORE_SETTINGS }, [AnotherAtomicComponentApp])
  ]);
  const tracedApp = traceApp({
    _trace: {
      traceSpecs: {
        [A_DRIVER]: [traceEventSourceFn, traceEventSinkFn],
        [ANOTHER_DRIVER]: [traceEventSourceFn, traceEventSinkFn],
        // NOTE : no need to trace the DOM source here as `AtomicComponentApp` does not use DOM source
        [DOM_SINK]: [identity, traceDOMsinkFn]
      },
      sendMessage: msg => traces.push(msg)
    },
    _helpers: { getId: getId(0) }
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
    [ANOTHER_DRIVER]: {
      outputs: inputs[1][ANOTHER_DRIVER].diagram.replace(/-/g, '').split('').map(x => `driver2 emits: ${x}`),
      successMessage: `sink ${ANOTHER_DRIVER} produces the expected values`
    },
    [DOM_SINK]: {
      outputs: [
        "<div><iframe id=\"devtool\" src=\"devtool.html\" style=\"width: 450px; height: 200px\"></iframe><div><div><div><div>DOM_SINK emits: a</div></div><div><div>DOM_SINK emits another : a</div></div></div></div></div>",
        "<div><iframe id=\"devtool\" src=\"devtool.html\" style=\"width: 450px; height: 200px\"></iframe><div><div><div><div>DOM_SINK emits: A</div></div><div><div>DOM_SINK emits another : a</div></div></div></div></div>",
        "<div><iframe id=\"devtool\" src=\"devtool.html\" style=\"width: 450px; height: 200px\"></iframe><div><div><div><div>DOM_SINK emits: A</div></div><div><div>DOM_SINK emits another : A</div></div></div></div></div>",
        "<div><iframe id=\"devtool\" src=\"devtool.html\" style=\"width: 450px; height: 200px\"></iframe><div><div><div><div>DOM_SINK emits: b</div></div><div><div>DOM_SINK emits another : A</div></div></div></div></div>",
        "<div><iframe id=\"devtool\" src=\"devtool.html\" style=\"width: 450px; height: 200px\"></iframe><div><div><div><div>DOM_SINK emits: b</div></div><div><div>DOM_SINK emits another : b</div></div></div></div></div>",
        "<div><iframe id=\"devtool\" src=\"devtool.html\" style=\"width: 450px; height: 200px\"></iframe><div><div><div><div>DOM_SINK emits: B</div></div><div><div>DOM_SINK emits another : b</div></div></div></div></div>",
        "<div><iframe id=\"devtool\" src=\"devtool.html\" style=\"width: 450px; height: 200px\"></iframe><div><div><div><div>DOM_SINK emits: B</div></div><div><div>DOM_SINK emits another : B</div></div></div></div></div>"
      ],
      successMessage: `sink ${DOM_SINK} produces the expected values`,
      transform: pipe(convertVNodesToHTML)
    },
  };

  const expectedGraph = [
    {
      "combinatorName": "Combine",
      "componentName": "ROOT",
      "id": 0,
      "isContainerComponent": false,
      "logType": "graph_structure",
      "path": [
        0
      ]
    },
    {
      "combinatorName": 'Combine',
      "componentName": APP_NAME,
      "id": 1,
      "isContainerComponent": false,
      "logType": "graph_structure",
      "path": [
        0,
        0
      ]
    },
    {
      "combinatorName": 'Combine',
      "componentName": A_COMPONENT_NAME,
      "id": 2,
      "isContainerComponent": false,
      "logType": "graph_structure",
      "path": [
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": undefined,
      "componentName": AtomicComponentApp.name,
      "id": 3,
      "isContainerComponent": false,
      "logType": "graph_structure",
      "path": [
        0,
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": 'InjectSourcesAndSettings',
      "componentName": APP_NAME,
      "id": 4,
      "isContainerComponent": false,
      "logType": "graph_structure",
      "path": [
        0,
        0,
        1
      ]
    },
    {
      "combinatorName": undefined,
      "componentName": AnotherAtomicComponentApp.name,
      "id": 5,
      "isContainerComponent": false,
      "logType": "graph_structure",
      "path": [
        0,
        0,
        1,
        0
      ]
    },
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
      "logType": "runtime",
      "path": [
        0
      ],
      "settings": {}
    },
    {
      "combinatorName": "Combine",
      "componentName": "App",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "a"
        },
        "type": 0
      },
      "id": 1,
      "logType": "runtime",
      "path": [
        0,
        0
      ],
      "settings": {
        "a_setting_prop": "a_setting_prop_value"
      }
    },
    {
      "combinatorName": "Combine",
      "componentName": "a_component_name",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "a"
        },
        "type": 0
      },
      "id": 2,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ],
      "settings": {
        "a_setting_prop": "a_setting_prop_value"
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "AtomicComponentApp",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "a"
        },
        "type": 0
      },
      "id": 3,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        0
      ],
      "settings": {
        "a_setting_prop": "a_setting_prop_value"
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "AtomicComponentApp",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div>DOM_SINK emits: a</div>"
        },
        "type": 1
      },
      "id": 4,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "a_component_name",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div><div>DOM_SINK emits: a</div></div>"
        },
        "type": 1
      },
      "id": 5,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": undefined,
      "componentName": "AtomicComponentApp",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "driver1 emits: a"
        },
        "type": 1
      },
      "id": 6,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "a_component_name",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "driver1 emits: a"
        },
        "type": 1
      },
      "id": 7,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "App",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "driver1 emits: a"
        },
        "type": 1
      },
      "id": 8,
      "logType": "runtime",
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
      "id": 9,
      "logType": "runtime",
      "path": [
        0
      ]
    },
    {
      "combinatorName": "InjectSourcesAndSettings",
      "componentName": "App",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "a"
        },
        "type": 0
      },
      "id": 10,
      "logType": "runtime",
      "path": [
        0,
        0,
        1
      ],
      "settings": {
        "a_setting_prop": "a_setting_prop_value",
        "another_setting_prop": "another_setting_prop_value"
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "AnotherAtomicComponentApp",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "a"
        },
        "type": 0
      },
      "id": 11,
      "logType": "runtime",
      "path": [
        0,
        0,
        1,
        0
      ],
      "settings": {
        "a_setting_prop": "a_setting_prop_value",
        "another_setting_prop": "another_setting_prop_value"
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "AnotherAtomicComponentApp",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div>DOM_SINK emits another : a</div>"
        },
        "type": 1
      },
      "id": 12,
      "logType": "runtime",
      "path": [
        0,
        0,
        1,
        0
      ]
    },
    {
      "combinatorName": "InjectSourcesAndSettings",
      "componentName": "App",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div><div>DOM_SINK emits another : a</div></div>"
        },
        "type": 1
      },
      "id": 13,
      "logType": "runtime",
      "path": [
        0,
        0,
        1
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "App",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div><div><div>DOM_SINK emits: a</div></div><div><div>DOM_SINK emits another : a</div></div></div>"
        },
        "type": 1
      },
      "id": 14,
      "logType": "runtime",
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
          "value": "<div><div><div><div>DOM_SINK emits: a</div></div><div><div>DOM_SINK emits another : a</div></div></div></div>"
        },
        "type": 1
      },
      "id": 15,
      "logType": "runtime",
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
      "id": 16,
      "logType": "runtime",
      "path": [
        0
      ],
      "settings": {}
    },
    {
      "combinatorName": "Combine",
      "componentName": "App",
      "emits": {
        "identifier": "another_driver",
        "notification": {
          "kind": "N",
          "value": "A"
        },
        "type": 0
      },
      "id": 17,
      "logType": "runtime",
      "path": [
        0,
        0
      ],
      "settings": {
        "a_setting_prop": "a_setting_prop_value"
      }
    },
    {
      "combinatorName": "Combine",
      "componentName": "a_component_name",
      "emits": {
        "identifier": "another_driver",
        "notification": {
          "kind": "N",
          "value": "A"
        },
        "type": 0
      },
      "id": 18,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ],
      "settings": {
        "a_setting_prop": "a_setting_prop_value"
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "AtomicComponentApp",
      "emits": {
        "identifier": "another_driver",
        "notification": {
          "kind": "N",
          "value": "A"
        },
        "type": 0
      },
      "id": 19,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        0
      ],
      "settings": {
        "a_setting_prop": "a_setting_prop_value"
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "AtomicComponentApp",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div>DOM_SINK emits: A</div>"
        },
        "type": 1
      },
      "id": 20,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "a_component_name",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div><div>DOM_SINK emits: A</div></div>"
        },
        "type": 1
      },
      "id": 21,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "App",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div><div><div>DOM_SINK emits: A</div></div><div><div>DOM_SINK emits another : a</div></div></div>"
        },
        "type": 1
      },
      "id": 22,
      "logType": "runtime",
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
          "value": "<div><div><div><div>DOM_SINK emits: A</div></div><div><div>DOM_SINK emits another : a</div></div></div></div>"
        },
        "type": 1
      },
      "id": 23,
      "logType": "runtime",
      "path": [
        0
      ]
    },
    {
      "combinatorName": "InjectSourcesAndSettings",
      "componentName": "App",
      "emits": {
        "identifier": "another_driver",
        "notification": {
          "kind": "N",
          "value": "A"
        },
        "type": 0
      },
      "id": 24,
      "logType": "runtime",
      "path": [
        0,
        0,
        1
      ],
      "settings": {
        "a_setting_prop": "a_setting_prop_value",
        "another_setting_prop": "another_setting_prop_value"
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "AnotherAtomicComponentApp",
      "emits": {
        "identifier": "another_driver",
        "notification": {
          "kind": "N",
          "value": "A"
        },
        "type": 0
      },
      "id": 25,
      "logType": "runtime",
      "path": [
        0,
        0,
        1,
        0
      ],
      "settings": {
        "a_setting_prop": "a_setting_prop_value",
        "another_setting_prop": "another_setting_prop_value"
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "AnotherAtomicComponentApp",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div>DOM_SINK emits another : A</div>"
        },
        "type": 1
      },
      "id": 26,
      "logType": "runtime",
      "path": [
        0,
        0,
        1,
        0
      ]
    },
    {
      "combinatorName": "InjectSourcesAndSettings",
      "componentName": "App",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div><div>DOM_SINK emits another : A</div></div>"
        },
        "type": 1
      },
      "id": 27,
      "logType": "runtime",
      "path": [
        0,
        0,
        1
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "App",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div><div><div>DOM_SINK emits: A</div></div><div><div>DOM_SINK emits another : A</div></div></div>"
        },
        "type": 1
      },
      "id": 28,
      "logType": "runtime",
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
          "value": "<div><div><div><div>DOM_SINK emits: A</div></div><div><div>DOM_SINK emits another : A</div></div></div></div>"
        },
        "type": 1
      },
      "id": 29,
      "logType": "runtime",
      "path": [
        0
      ]
    },
    {
      "combinatorName": undefined,
      "componentName": "AnotherAtomicComponentApp",
      "emits": {
        "identifier": "another_driver",
        "notification": {
          "kind": "N",
          "value": "driver2 emits: A"
        },
        "type": 1
      },
      "id": 30,
      "logType": "runtime",
      "path": [
        0,
        0,
        1,
        0
      ]
    },
    {
      "combinatorName": "InjectSourcesAndSettings",
      "componentName": "App",
      "emits": {
        "identifier": "another_driver",
        "notification": {
          "kind": "N",
          "value": "driver2 emits: A"
        },
        "type": 1
      },
      "id": 31,
      "logType": "runtime",
      "path": [
        0,
        0,
        1
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "App",
      "emits": {
        "identifier": "another_driver",
        "notification": {
          "kind": "N",
          "value": "driver2 emits: A"
        },
        "type": 1
      },
      "id": 32,
      "logType": "runtime",
      "path": [
        0,
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
          "value": "driver2 emits: A"
        },
        "type": 1
      },
      "id": 33,
      "logType": "runtime",
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
      "id": 34,
      "logType": "runtime",
      "path": [
        0
      ],
      "settings": {}
    },
    {
      "combinatorName": "Combine",
      "componentName": "App",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "b"
        },
        "type": 0
      },
      "id": 35,
      "logType": "runtime",
      "path": [
        0,
        0
      ],
      "settings": {
        "a_setting_prop": "a_setting_prop_value"
      }
    },
    {
      "combinatorName": "Combine",
      "componentName": "a_component_name",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "b"
        },
        "type": 0
      },
      "id": 36,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ],
      "settings": {
        "a_setting_prop": "a_setting_prop_value"
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "AtomicComponentApp",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "b"
        },
        "type": 0
      },
      "id": 37,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        0
      ],
      "settings": {
        "a_setting_prop": "a_setting_prop_value"
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "AtomicComponentApp",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div>DOM_SINK emits: b</div>"
        },
        "type": 1
      },
      "id": 38,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "a_component_name",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div><div>DOM_SINK emits: b</div></div>"
        },
        "type": 1
      },
      "id": 39,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "App",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div><div><div>DOM_SINK emits: b</div></div><div><div>DOM_SINK emits another : A</div></div></div>"
        },
        "type": 1
      },
      "id": 40,
      "logType": "runtime",
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
          "value": "<div><div><div><div>DOM_SINK emits: b</div></div><div><div>DOM_SINK emits another : A</div></div></div></div>"
        },
        "type": 1
      },
      "id": 41,
      "logType": "runtime",
      "path": [
        0
      ]
    },
    {
      "combinatorName": undefined,
      "componentName": "AtomicComponentApp",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "driver1 emits: b"
        },
        "type": 1
      },
      "id": 42,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "a_component_name",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "driver1 emits: b"
        },
        "type": 1
      },
      "id": 43,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "App",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "driver1 emits: b"
        },
        "type": 1
      },
      "id": 44,
      "logType": "runtime",
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
      "id": 45,
      "logType": "runtime",
      "path": [
        0
      ]
    },
    {
      "combinatorName": "InjectSourcesAndSettings",
      "componentName": "App",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "b"
        },
        "type": 0
      },
      "id": 46,
      "logType": "runtime",
      "path": [
        0,
        0,
        1
      ],
      "settings": {
        "a_setting_prop": "a_setting_prop_value",
        "another_setting_prop": "another_setting_prop_value"
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "AnotherAtomicComponentApp",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "b"
        },
        "type": 0
      },
      "id": 47,
      "logType": "runtime",
      "path": [
        0,
        0,
        1,
        0
      ],
      "settings": {
        "a_setting_prop": "a_setting_prop_value",
        "another_setting_prop": "another_setting_prop_value"
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "AnotherAtomicComponentApp",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div>DOM_SINK emits another : b</div>"
        },
        "type": 1
      },
      "id": 48,
      "logType": "runtime",
      "path": [
        0,
        0,
        1,
        0
      ]
    },
    {
      "combinatorName": "InjectSourcesAndSettings",
      "componentName": "App",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div><div>DOM_SINK emits another : b</div></div>"
        },
        "type": 1
      },
      "id": 49,
      "logType": "runtime",
      "path": [
        0,
        0,
        1
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "App",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div><div><div>DOM_SINK emits: b</div></div><div><div>DOM_SINK emits another : b</div></div></div>"
        },
        "type": 1
      },
      "id": 50,
      "logType": "runtime",
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
          "value": "<div><div><div><div>DOM_SINK emits: b</div></div><div><div>DOM_SINK emits another : b</div></div></div></div>"
        },
        "type": 1
      },
      "id": 51,
      "logType": "runtime",
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
      "id": 52,
      "logType": "runtime",
      "path": [
        0
      ],
      "settings": {}
    },
    {
      "combinatorName": "Combine",
      "componentName": "App",
      "emits": {
        "identifier": "another_driver",
        "notification": {
          "kind": "N",
          "value": "B"
        },
        "type": 0
      },
      "id": 53,
      "logType": "runtime",
      "path": [
        0,
        0
      ],
      "settings": {
        "a_setting_prop": "a_setting_prop_value"
      }
    },
    {
      "combinatorName": "Combine",
      "componentName": "a_component_name",
      "emits": {
        "identifier": "another_driver",
        "notification": {
          "kind": "N",
          "value": "B"
        },
        "type": 0
      },
      "id": 54,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ],
      "settings": {
        "a_setting_prop": "a_setting_prop_value"
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "AtomicComponentApp",
      "emits": {
        "identifier": "another_driver",
        "notification": {
          "kind": "N",
          "value": "B"
        },
        "type": 0
      },
      "id": 55,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        0
      ],
      "settings": {
        "a_setting_prop": "a_setting_prop_value"
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "AtomicComponentApp",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div>DOM_SINK emits: B</div>"
        },
        "type": 1
      },
      "id": 56,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "a_component_name",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div><div>DOM_SINK emits: B</div></div>"
        },
        "type": 1
      },
      "id": 57,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "App",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div><div><div>DOM_SINK emits: B</div></div><div><div>DOM_SINK emits another : b</div></div></div>"
        },
        "type": 1
      },
      "id": 58,
      "logType": "runtime",
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
          "value": "<div><div><div><div>DOM_SINK emits: B</div></div><div><div>DOM_SINK emits another : b</div></div></div></div>"
        },
        "type": 1
      },
      "id": 59,
      "logType": "runtime",
      "path": [
        0
      ]
    },
    {
      "combinatorName": "InjectSourcesAndSettings",
      "componentName": "App",
      "emits": {
        "identifier": "another_driver",
        "notification": {
          "kind": "N",
          "value": "B"
        },
        "type": 0
      },
      "id": 60,
      "logType": "runtime",
      "path": [
        0,
        0,
        1
      ],
      "settings": {
        "a_setting_prop": "a_setting_prop_value",
        "another_setting_prop": "another_setting_prop_value"
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "AnotherAtomicComponentApp",
      "emits": {
        "identifier": "another_driver",
        "notification": {
          "kind": "N",
          "value": "B"
        },
        "type": 0
      },
      "id": 61,
      "logType": "runtime",
      "path": [
        0,
        0,
        1,
        0
      ],
      "settings": {
        "a_setting_prop": "a_setting_prop_value",
        "another_setting_prop": "another_setting_prop_value"
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "AnotherAtomicComponentApp",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div>DOM_SINK emits another : B</div>"
        },
        "type": 1
      },
      "id": 62,
      "logType": "runtime",
      "path": [
        0,
        0,
        1,
        0
      ]
    },
    {
      "combinatorName": "InjectSourcesAndSettings",
      "componentName": "App",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div><div>DOM_SINK emits another : B</div></div>"
        },
        "type": 1
      },
      "id": 63,
      "logType": "runtime",
      "path": [
        0,
        0,
        1
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "App",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div><div><div>DOM_SINK emits: B</div></div><div><div>DOM_SINK emits another : B</div></div></div>"
        },
        "type": 1
      },
      "id": 64,
      "logType": "runtime",
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
          "value": "<div><div><div><div>DOM_SINK emits: B</div></div><div><div>DOM_SINK emits another : B</div></div></div></div>"
        },
        "type": 1
      },
      "id": 65,
      "logType": "runtime",
      "path": [
        0
      ]
    },
    {
      "combinatorName": undefined,
      "componentName": "AnotherAtomicComponentApp",
      "emits": {
        "identifier": "another_driver",
        "notification": {
          "kind": "N",
          "value": "driver2 emits: B"
        },
        "type": 1
      },
      "id": 66,
      "logType": "runtime",
      "path": [
        0,
        0,
        1,
        0
      ]
    },
    {
      "combinatorName": "InjectSourcesAndSettings",
      "componentName": "App",
      "emits": {
        "identifier": "another_driver",
        "notification": {
          "kind": "N",
          "value": "driver2 emits: B"
        },
        "type": 1
      },
      "id": 67,
      "logType": "runtime",
      "path": [
        0,
        0,
        1
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "App",
      "emits": {
        "identifier": "another_driver",
        "notification": {
          "kind": "N",
          "value": "driver2 emits: B"
        },
        "type": 1
      },
      "id": 68,
      "logType": "runtime",
      "path": [
        0,
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
          "value": "driver2 emits: B"
        },
        "type": 1
      },
      "id": 69,
      "logType": "runtime",
      "path": [
        0
      ]
    }];

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

QUnit.test("main case - Combine, InjectSources - component tree depth 2 - 0 container - 2 components", function exec_test(assert) {
  resetGraphCounter();
  const done = assert.async(4);
  const traces = [];

  const App = Combine(set(componentNameInSettings, APP_NAME, SOME_SETTINGS), [
    Combine(set(componentNameInSettings, A_COMPONENT_NAME, {}), [AtomicComponentApp]),
    InjectSourcesAndSettings({
      sourceFactory: sources => ({ [EXTRA_SOURCE]: sources[ANOTHER_DRIVER].map(addPrefix('-extra-')) })
    }, [AtomicComponentAppWithExtraSource])
  ]);
  const tracedApp = traceApp({
    _trace: {
      traceSpecs: {
        [A_DRIVER]: [traceEventSourceFn, traceEventSinkFn],
        [ANOTHER_DRIVER]: [traceEventSourceFn, traceEventSinkFn],
        // NOTE : no need to trace the DOM source here as `AtomicComponentApp` does not use DOM source
        [DOM_SINK]: [identity, traceDOMsinkFn]
      },
      // TODO : make a contract to chech that defaultSpecs is not null when expected
      defaultTraceSpecs: [traceEventSourceFn, traceEventSinkFn],
      sendMessage: msg => traces.push(msg)
    },
    _helpers: { getId: getId(0) }
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
    [ANOTHER_DRIVER]: {
      outputs: inputs[1][ANOTHER_DRIVER].diagram.replace(/-/g, '').split('').map(
        x => `extra source emits: -extra-${x}`),
      successMessage: `sink ${ANOTHER_DRIVER} produces the expected values`
    },
    [DOM_SINK]: {
      outputs: [
        "<div><iframe id=\"devtool\" src=\"devtool.html\" style=\"width: 450px; height: 200px\"></iframe><div><div><div><div>DOM_SINK emits: a</div></div></div></div></div>",
        "<div><iframe id=\"devtool\" src=\"devtool.html\" style=\"width: 450px; height: 200px\"></iframe><div><div><div><div>DOM_SINK emits: A</div></div></div></div></div>",
        "<div><iframe id=\"devtool\" src=\"devtool.html\" style=\"width: 450px; height: 200px\"></iframe><div><div><div><div>DOM_SINK emits: b</div></div></div></div></div>",
        "<div><iframe id=\"devtool\" src=\"devtool.html\" style=\"width: 450px; height: 200px\"></iframe><div><div><div><div>DOM_SINK emits: B</div></div></div></div></div>"
      ],
      successMessage: `sink ${DOM_SINK} produces the expected values`,
      transform: pipe(convertVNodesToHTML)
    },
  };

  const expectedGraph = [
    {
      "combinatorName": "Combine",
      "componentName": "ROOT",
      "id": 0,
      "isContainerComponent": false,
      "logType": "graph_structure",
      "path": [
        0
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "App",
      "id": 1,
      "isContainerComponent": false,
      "logType": "graph_structure",
      "path": [
        0,
        0
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "a_component_name",
      "id": 2,
      "isContainerComponent": false,
      "logType": "graph_structure",
      "path": [
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": undefined,
      "componentName": "AtomicComponentApp",
      "id": 3,
      "isContainerComponent": false,
      "logType": "graph_structure",
      "path": [
        0,
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": "InjectSourcesAndSettings",
      "componentName": "App",
      "id": 4,
      "isContainerComponent": false,
      "logType": "graph_structure",
      "path": [
        0,
        0,
        1
      ]
    },
    {
      "combinatorName": undefined,
      "componentName": "AtomicComponentAppWithExtraSource",
      "id": 5,
      "isContainerComponent": false,
      "logType": "graph_structure",
      "path": [
        0,
        0,
        1,
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
      "logType": "runtime",
      "path": [
        0
      ],
      "settings": {}
    },
    {
      "combinatorName": "Combine",
      "componentName": "App",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "a"
        },
        "type": 0
      },
      "id": 1,
      "logType": "runtime",
      "path": [
        0,
        0
      ],
      "settings": {
        "a_setting_prop": "a_setting_prop_value"
      }
    },
    {
      "combinatorName": "Combine",
      "componentName": "a_component_name",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "a"
        },
        "type": 0
      },
      "id": 2,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ],
      "settings": {
        "a_setting_prop": "a_setting_prop_value"
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "AtomicComponentApp",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "a"
        },
        "type": 0
      },
      "id": 3,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        0
      ],
      "settings": {
        "a_setting_prop": "a_setting_prop_value"
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "AtomicComponentApp",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div>DOM_SINK emits: a</div>"
        },
        "type": 1
      },
      "id": 4,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "a_component_name",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div><div>DOM_SINK emits: a</div></div>"
        },
        "type": 1
      },
      "id": 5,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "App",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div><div><div>DOM_SINK emits: a</div></div></div>"
        },
        "type": 1
      },
      "id": 6,
      "logType": "runtime",
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
          "value": "<div><div><div><div>DOM_SINK emits: a</div></div></div></div>"
        },
        "type": 1
      },
      "id": 7,
      "logType": "runtime",
      "path": [
        0
      ]
    },
    {
      "combinatorName": undefined,
      "componentName": "AtomicComponentApp",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "driver1 emits: a"
        },
        "type": 1
      },
      "id": 8,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "a_component_name",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "driver1 emits: a"
        },
        "type": 1
      },
      "id": 9,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "App",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "driver1 emits: a"
        },
        "type": 1
      },
      "id": 10,
      "logType": "runtime",
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
      "id": 11,
      "logType": "runtime",
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
      "id": 12,
      "logType": "runtime",
      "path": [
        0
      ],
      "settings": {}
    },
    {
      "combinatorName": "Combine",
      "componentName": "App",
      "emits": {
        "identifier": "another_driver",
        "notification": {
          "kind": "N",
          "value": "A"
        },
        "type": 0
      },
      "id": 13,
      "logType": "runtime",
      "path": [
        0,
        0
      ],
      "settings": {
        "a_setting_prop": "a_setting_prop_value"
      }
    },
    {
      "combinatorName": "Combine",
      "componentName": "a_component_name",
      "emits": {
        "identifier": "another_driver",
        "notification": {
          "kind": "N",
          "value": "A"
        },
        "type": 0
      },
      "id": 14,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ],
      "settings": {
        "a_setting_prop": "a_setting_prop_value"
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "AtomicComponentApp",
      "emits": {
        "identifier": "another_driver",
        "notification": {
          "kind": "N",
          "value": "A"
        },
        "type": 0
      },
      "id": 15,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        0
      ],
      "settings": {
        "a_setting_prop": "a_setting_prop_value"
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "AtomicComponentApp",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div>DOM_SINK emits: A</div>"
        },
        "type": 1
      },
      "id": 16,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "a_component_name",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div><div>DOM_SINK emits: A</div></div>"
        },
        "type": 1
      },
      "id": 17,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "App",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div><div><div>DOM_SINK emits: A</div></div></div>"
        },
        "type": 1
      },
      "id": 18,
      "logType": "runtime",
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
          "value": "<div><div><div><div>DOM_SINK emits: A</div></div></div></div>"
        },
        "type": 1
      },
      "id": 19,
      "logType": "runtime",
      "path": [
        0
      ]
    },
    {
      "combinatorName": "InjectSourcesAndSettings",
      "componentName": "App",
      "emits": {
        "identifier": "extra_source",
        "notification": {
          "kind": "N",
          "value": "-extra-A"
        },
        "type": 0
      },
      "id": 20,
      "logType": "runtime",
      "path": [
        0,
        0,
        1
      ],
      "settings": {
        "a_setting_prop": "a_setting_prop_value"
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "AtomicComponentAppWithExtraSource",
      "emits": {
        "identifier": "extra_source",
        "notification": {
          "kind": "N",
          "value": "-extra-A"
        },
        "type": 0
      },
      "id": 21,
      "logType": "runtime",
      "path": [
        0,
        0,
        1,
        0
      ],
      "settings": {
        "a_setting_prop": "a_setting_prop_value"
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "AtomicComponentAppWithExtraSource",
      "emits": {
        "identifier": "another_driver",
        "notification": {
          "kind": "N",
          "value": "extra source emits: -extra-A"
        },
        "type": 1
      },
      "id": 22,
      "logType": "runtime",
      "path": [
        0,
        0,
        1,
        0
      ]
    },
    {
      "combinatorName": "InjectSourcesAndSettings",
      "componentName": "App",
      "emits": {
        "identifier": "another_driver",
        "notification": {
          "kind": "N",
          "value": "extra source emits: -extra-A"
        },
        "type": 1
      },
      "id": 23,
      "logType": "runtime",
      "path": [
        0,
        0,
        1
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "App",
      "emits": {
        "identifier": "another_driver",
        "notification": {
          "kind": "N",
          "value": "extra source emits: -extra-A"
        },
        "type": 1
      },
      "id": 24,
      "logType": "runtime",
      "path": [
        0,
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
          "value": "extra source emits: -extra-A"
        },
        "type": 1
      },
      "id": 25,
      "logType": "runtime",
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
      "id": 26,
      "logType": "runtime",
      "path": [
        0
      ],
      "settings": {}
    },
    {
      "combinatorName": "Combine",
      "componentName": "App",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "b"
        },
        "type": 0
      },
      "id": 27,
      "logType": "runtime",
      "path": [
        0,
        0
      ],
      "settings": {
        "a_setting_prop": "a_setting_prop_value"
      }
    },
    {
      "combinatorName": "Combine",
      "componentName": "a_component_name",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "b"
        },
        "type": 0
      },
      "id": 28,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ],
      "settings": {
        "a_setting_prop": "a_setting_prop_value"
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "AtomicComponentApp",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "b"
        },
        "type": 0
      },
      "id": 29,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        0
      ],
      "settings": {
        "a_setting_prop": "a_setting_prop_value"
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "AtomicComponentApp",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div>DOM_SINK emits: b</div>"
        },
        "type": 1
      },
      "id": 30,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "a_component_name",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div><div>DOM_SINK emits: b</div></div>"
        },
        "type": 1
      },
      "id": 31,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "App",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div><div><div>DOM_SINK emits: b</div></div></div>"
        },
        "type": 1
      },
      "id": 32,
      "logType": "runtime",
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
          "value": "<div><div><div><div>DOM_SINK emits: b</div></div></div></div>"
        },
        "type": 1
      },
      "id": 33,
      "logType": "runtime",
      "path": [
        0
      ]
    },
    {
      "combinatorName": undefined,
      "componentName": "AtomicComponentApp",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "driver1 emits: b"
        },
        "type": 1
      },
      "id": 34,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "a_component_name",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "driver1 emits: b"
        },
        "type": 1
      },
      "id": 35,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "App",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "driver1 emits: b"
        },
        "type": 1
      },
      "id": 36,
      "logType": "runtime",
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
      "id": 37,
      "logType": "runtime",
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
      "id": 38,
      "logType": "runtime",
      "path": [
        0
      ],
      "settings": {}
    },
    {
      "combinatorName": "Combine",
      "componentName": "App",
      "emits": {
        "identifier": "another_driver",
        "notification": {
          "kind": "N",
          "value": "B"
        },
        "type": 0
      },
      "id": 39,
      "logType": "runtime",
      "path": [
        0,
        0
      ],
      "settings": {
        "a_setting_prop": "a_setting_prop_value"
      }
    },
    {
      "combinatorName": "Combine",
      "componentName": "a_component_name",
      "emits": {
        "identifier": "another_driver",
        "notification": {
          "kind": "N",
          "value": "B"
        },
        "type": 0
      },
      "id": 40,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ],
      "settings": {
        "a_setting_prop": "a_setting_prop_value"
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "AtomicComponentApp",
      "emits": {
        "identifier": "another_driver",
        "notification": {
          "kind": "N",
          "value": "B"
        },
        "type": 0
      },
      "id": 41,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        0
      ],
      "settings": {
        "a_setting_prop": "a_setting_prop_value"
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "AtomicComponentApp",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div>DOM_SINK emits: B</div>"
        },
        "type": 1
      },
      "id": 42,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "a_component_name",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div><div>DOM_SINK emits: B</div></div>"
        },
        "type": 1
      },
      "id": 43,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "App",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div><div><div>DOM_SINK emits: B</div></div></div>"
        },
        "type": 1
      },
      "id": 44,
      "logType": "runtime",
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
          "value": "<div><div><div><div>DOM_SINK emits: B</div></div></div></div>"
        },
        "type": 1
      },
      "id": 45,
      "logType": "runtime",
      "path": [
        0
      ]
    },
    {
      "combinatorName": "InjectSourcesAndSettings",
      "componentName": "App",
      "emits": {
        "identifier": "extra_source",
        "notification": {
          "kind": "N",
          "value": "-extra-B"
        },
        "type": 0
      },
      "id": 46,
      "logType": "runtime",
      "path": [
        0,
        0,
        1
      ],
      "settings": {
        "a_setting_prop": "a_setting_prop_value"
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "AtomicComponentAppWithExtraSource",
      "emits": {
        "identifier": "extra_source",
        "notification": {
          "kind": "N",
          "value": "-extra-B"
        },
        "type": 0
      },
      "id": 47,
      "logType": "runtime",
      "path": [
        0,
        0,
        1,
        0
      ],
      "settings": {
        "a_setting_prop": "a_setting_prop_value"
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "AtomicComponentAppWithExtraSource",
      "emits": {
        "identifier": "another_driver",
        "notification": {
          "kind": "N",
          "value": "extra source emits: -extra-B"
        },
        "type": 1
      },
      "id": 48,
      "logType": "runtime",
      "path": [
        0,
        0,
        1,
        0
      ]
    },
    {
      "combinatorName": "InjectSourcesAndSettings",
      "componentName": "App",
      "emits": {
        "identifier": "another_driver",
        "notification": {
          "kind": "N",
          "value": "extra source emits: -extra-B"
        },
        "type": 1
      },
      "id": 49,
      "logType": "runtime",
      "path": [
        0,
        0,
        1
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "App",
      "emits": {
        "identifier": "another_driver",
        "notification": {
          "kind": "N",
          "value": "extra source emits: -extra-B"
        },
        "type": 1
      },
      "id": 50,
      "logType": "runtime",
      "path": [
        0,
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
          "value": "extra source emits: -extra-B"
        },
        "type": 1
      },
      "id": 51,
      "logType": "runtime",
      "path": [
        0
      ]
    }
  ];

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

QUnit.test("main case - ForEach - component tree depth 2 - 0 container - 1 component", function exec_test(assert) {
  resetGraphCounter();
  const done = assert.async(3);
  const traces = [];
  const forEachSettings = {
    from: A_DRIVER,
    as: FOREACH_AS,
    sinkNames: [ANOTHER_DRIVER, DOM_SINK]
  };

  const App = Combine(set(componentNameInSettings, APP_NAME, {}), [
    ForEach(set(componentNameInSettings, A_COMPONENT_NAME, forEachSettings), [AtomicComponentMonoDriverApp]),
  ]);
  const tracedApp = traceApp({
    _trace: {
      traceSpecs: {
        [A_DRIVER]: [traceEventSourceFn, traceEventSinkFn],
        [ANOTHER_DRIVER]: [traceEventSourceFn, traceEventSinkFn],
        // NOTE : no need to trace the DOM source here as `AtomicComponentApp` does not use DOM source
        [DOM_SINK]: [identity, traceDOMsinkFn]
      },
      // TODO : make a contract to chech that defaultSpecs is not null when expected
      defaultTraceSpecs: [traceEventSourceFn, traceEventSinkFn],
      sendMessage: msg => traces.push(msg)
    },
    _helpers: { getId: getId(0) }
  }, App);

  const inputs = [
    { [A_DRIVER]: { diagram: 'a-b--' } },
    { [ANOTHER_DRIVER]: { diagram: '-A--B--' } },
  ];

  const expectedMessages = {
    [ANOTHER_DRIVER]: {
      outputs: inputs[1][ANOTHER_DRIVER].diagram.replace(/-/g, '').split('').map(x => `another driver emits: ${x}`),
      successMessage: `sink ${ANOTHER_DRIVER} produces the expected values`
    },
    [DOM_SINK]: {
      outputs: [],
      successMessage: `sink ${DOM_SINK} produces the expected values`,
      transform: pipe(convertVNodesToHTML)
    },
  };

  // NOTE : there is no "C" notification appearing here, as the ForEach combinator sinks do not complete. Its
  // children components are called on-demand, and their sinks do complete. However, there is no trace instruction
  // at that level to observe it
  // NOTE : Hence the only way to observe component 'instantiation' is through the graph structure tracing.
  // NOTE : For ForEach we cannot observe component 'destruction'. However, we know that component destruction is right
  // before 'instantiation'.
  const expectedGraph1 = [
    {
      "combinatorName": "Combine",
      "componentName": "ROOT",
      "id": 0,
      "isContainerComponent": false,
      "logType": "graph_structure",
      "path": [
        0
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "App",
      "id": 1,
      "isContainerComponent": false,
      "logType": "graph_structure",
      "path": [
        0,
        0
      ]
    },
    {
      "combinatorName": "ForEach",
      "componentName": "a_component_name",
      "id": 2,
      "isContainerComponent": false,
      "logType": "graph_structure",
      "path": [
        0,
        0,
        0
      ]
    },
  ];
  const expectedGraph2 = [
    {
      "combinatorName": "ForEach|Inner",
      "componentName": "a_component_name",
      "id": 3,
      "isContainerComponent": false,
      "logType": "graph_structure",
      "path": [
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": undefined,
      "componentName": "AtomicComponentMonoDriverApp",
      "id": 4,
      "isContainerComponent": false,
      "logType": "graph_structure",
      "path": [
        0,
        0,
        0,
        0
      ]
    },
  ];
  const expectedGraph3 = [
    {
      "combinatorName": "ForEach|Inner",
      "componentName": "a_component_name",
      "id": 5,
      "isContainerComponent": false,
      "logType": "graph_structure",
      "path": [
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": undefined,
      "componentName": "AtomicComponentMonoDriverApp",
      "id": 6,
      "isContainerComponent": false,
      "logType": "graph_structure",
      "path": [
        0,
        0,
        0,
        0
      ]
    },
  ];
  const expectedTraces1 = [
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
      "logType": "runtime",
      "path": [
        0
      ],
      "settings": {}
    },
    {
      "combinatorName": "Combine",
      "componentName": "App",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "a"
        },
        "type": 0
      },
      "id": 1,
      "logType": "runtime",
      "path": [
        0,
        0
      ],
      "settings": {}
    },
    {
      "combinatorName": "ForEach",
      "componentName": "a_component_name",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "a"
        },
        "type": 0
      },
      "id": 2,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ],
      "settings": {
        "as": "foreach_as",
        "from": "a_driver",
        "sinkNames": [
          "another_driver",
          "DOM"
        ]
      }
    },
  ];
  const expectedTraces2 = [
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
      "id": 3,
      "logType": "runtime",
      "path": [
        0
      ],
      "settings": {}
    },
    {
      "combinatorName": "Combine",
      "componentName": "App",
      "emits": {
        "identifier": "another_driver",
        "notification": {
          "kind": "N",
          "value": "A"
        },
        "type": 0
      },
      "id": 4,
      "logType": "runtime",
      "path": [
        0,
        0
      ],
      "settings": {}
    },
    {
      "combinatorName": "ForEach",
      "componentName": "a_component_name",
      "emits": {
        "identifier": "another_driver",
        "notification": {
          "kind": "N",
          "value": "A"
        },
        "type": 0
      },
      "id": 5,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ],
      "settings": {
        "as": "foreach_as",
        "from": "a_driver",
        "sinkNames": [
          "another_driver",
          "DOM"
        ]
      }
    },
    {
      "combinatorName": "ForEach|Inner",
      "componentName": "a_component_name",
      "emits": {
        "identifier": "another_driver",
        "notification": {
          "kind": "N",
          "value": "A"
        },
        "type": 0
      },
      "id": 6,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ],
      "settings": {
        "as": "foreach_as",
        "foreach_as": "a",
        "from": "a_driver",
        "sinkNames": [
          "another_driver",
          "DOM"
        ]
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "AtomicComponentMonoDriverApp",
      "emits": {
        "identifier": "another_driver",
        "notification": {
          "kind": "N",
          "value": "A"
        },
        "type": 0
      },
      "id": 7,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        0
      ],
      "settings": {
        "as": "foreach_as",
        "foreach_as": "a",
        "from": "a_driver",
        "sinkNames": [
          "another_driver",
          "DOM"
        ]
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "AtomicComponentMonoDriverApp",
      "emits": {
        "identifier": "another_driver",
        "notification": {
          "kind": "N",
          "value": "another driver emits: A"
        },
        "type": 1
      },
      "id": 8,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": "ForEach|Inner",
      "componentName": "a_component_name",
      "emits": {
        "identifier": "another_driver",
        "notification": {
          "kind": "N",
          "value": "another driver emits: A"
        },
        "type": 1
      },
      "id": 9,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": "ForEach",
      "componentName": "a_component_name",
      "emits": {
        "identifier": "another_driver",
        "notification": {
          "kind": "N",
          "value": "another driver emits: A"
        },
        "type": 1
      },
      "id": 10,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "App",
      "emits": {
        "identifier": "another_driver",
        "notification": {
          "kind": "N",
          "value": "another driver emits: A"
        },
        "type": 1
      },
      "id": 11,
      "logType": "runtime",
      "path": [
        0,
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
          "value": "another driver emits: A"
        },
        "type": 1
      },
      "id": 12,
      "logType": "runtime",
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
      "id": 13,
      "logType": "runtime",
      "path": [
        0
      ],
      "settings": {}
    },
    {
      "combinatorName": "Combine",
      "componentName": "App",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "b"
        },
        "type": 0
      },
      "id": 14,
      "logType": "runtime",
      "path": [
        0,
        0
      ],
      "settings": {}
    },
    {
      "combinatorName": "ForEach",
      "componentName": "a_component_name",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "b"
        },
        "type": 0
      },
      "id": 15,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ],
      "settings": {
        "as": "foreach_as",
        "from": "a_driver",
        "sinkNames": [
          "another_driver",
          "DOM"
        ]
      }
    },
  ];
  const expectedTraces3 = [
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
      "logType": "runtime",
      "path": [
        0
      ],
      "settings": {}
    },
    {
      "combinatorName": "Combine",
      "componentName": "App",
      "emits": {
        "identifier": "another_driver",
        "notification": {
          "kind": "N",
          "value": "B"
        },
        "type": 0
      },
      "id": 17,
      "logType": "runtime",
      "path": [
        0,
        0
      ],
      "settings": {}
    },
    {
      "combinatorName": "ForEach",
      "componentName": "a_component_name",
      "emits": {
        "identifier": "another_driver",
        "notification": {
          "kind": "N",
          "value": "B"
        },
        "type": 0
      },
      "id": 18,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ],
      "settings": {
        "as": "foreach_as",
        "from": "a_driver",
        "sinkNames": [
          "another_driver",
          "DOM"
        ]
      }
    },
    {
      "combinatorName": "ForEach|Inner",
      "componentName": "a_component_name",
      "emits": {
        "identifier": "another_driver",
        "notification": {
          "kind": "N",
          "value": "B"
        },
        "type": 0
      },
      "id": 19,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ],
      "settings": {
        "as": "foreach_as",
        "foreach_as": "b",
        "from": "a_driver",
        "sinkNames": [
          "another_driver",
          "DOM"
        ]
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "AtomicComponentMonoDriverApp",
      "emits": {
        "identifier": "another_driver",
        "notification": {
          "kind": "N",
          "value": "B"
        },
        "type": 0
      },
      "id": 20,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        0
      ],
      "settings": {
        "as": "foreach_as",
        "foreach_as": "b",
        "from": "a_driver",
        "sinkNames": [
          "another_driver",
          "DOM"
        ]
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "AtomicComponentMonoDriverApp",
      "emits": {
        "identifier": "another_driver",
        "notification": {
          "kind": "N",
          "value": "another driver emits: B"
        },
        "type": 1
      },
      "id": 21,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": "ForEach|Inner",
      "componentName": "a_component_name",
      "emits": {
        "identifier": "another_driver",
        "notification": {
          "kind": "N",
          "value": "another driver emits: B"
        },
        "type": 1
      },
      "id": 22,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": "ForEach",
      "componentName": "a_component_name",
      "emits": {
        "identifier": "another_driver",
        "notification": {
          "kind": "N",
          "value": "another driver emits: B"
        },
        "type": 1
      },
      "id": 23,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "App",
      "emits": {
        "identifier": "another_driver",
        "notification": {
          "kind": "N",
          "value": "another driver emits: B"
        },
        "type": 1
      },
      "id": 24,
      "logType": "runtime",
      "path": [
        0,
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
          "value": "another driver emits: B"
        },
        "type": 1
      },
      "id": 25,
      "logType": "runtime",
      "path": [
        0
      ]
    }
  ];

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
      assert.deepEqual(
        removeWhenField(traces),
        flatten([expectedGraph1, expectedTraces1, expectedGraph2, expectedTraces2, expectedGraph3, expectedTraces3]),
        `Traces are produced as expected!`);
      done()
    });
});

QUnit.test("main cases - Switch - component tree depth 2 - 0 match, 3 cases", function exec_test(assert) {
  resetGraphCounter();
  const done = assert.async(5);
  const traces = [];

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
  const SWITCH_SOURCE = 'sweatch$';
  const SWITCH_AS = 'switchedOn';
  const switchSettings = {
    on: SWITCH_SOURCE,
    as: SWITCH_AS,
    sinkNames: [DOM_SINK, 'a', 'b', 'c']
  };

  const App = Switch(set(componentNameInSettings, APP_NAME, switchSettings), [
    Case({ when: '' }, [childComponent3]),
    Case({ when: 'Y' }, [childComponent4]),
    Case({ when: 2 }, [childComponent1, childComponent2]),
  ]);
  const tracedApp = traceApp({
    _trace: {
      traceSpecs: {
        a: [traceEventSourceFn, traceEventSinkFn],
        b: [traceEventSourceFn, traceEventSinkFn],
        c: [traceEventSourceFn, traceEventSinkFn],
        DOM1: [traceEventSourceFn, traceEventSinkFn],
        DOM2: [traceEventSourceFn, traceEventSinkFn],
        userAction$: [traceEventSourceFn, traceEventSinkFn],
        [DOM_SINK]: [identity, traceDOMsinkFn]
      },

      defaultTraceSpecs: [traceEventSourceFn, traceEventSinkFn],
      sendMessage: msg => traces.push(msg)
    },
    _helpers: { getId: getId(0) }
  }, App);

  // TODO : check that non existing source do not error (for instance, only in sinkm not in source)

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
      [SWITCH_SOURCE]: {
        //diagr: '-a--b--c--d--e--f--a',
        //diagr: '-a-b-c-d-e-f-abb-c-d',
        //userA: 'abc-b-ac--ab---c',
        diagram: '-t-f-tttttff-t', values: {
          t: true,
          f: false,
        }
      }
    }
  ];

  /** @type TestResults */
  const expectedMessages = {
    DOM: {
      outputs: ["<div><iframe id=\"devtool\" src=\"devtool.html\" style=\"width: 450px; height: 200px\"></iframe><div><div></div></div></div>"],
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

  const expectedTraces = [
    {
      "combinatorName": "Combine",
      "componentName": "ROOT",
      "emits": {
        "identifier": "sweatch$",
        "notification": {
          "kind": "N",
          "value": true
        },
        "type": 0
      },
      "id": 0,
      "logType": "runtime",
      "path": [
        0
      ],
      "settings": {}
    },
    {
      "combinatorName": "Switch",
      "componentName": "App",
      "emits": {
        "identifier": "sweatch$",
        "notification": {
          "kind": "N",
          "value": true
        },
        "type": 0
      },
      "id": 1,
      "logType": "runtime",
      "path": [
        0,
        0
      ],
      "settings": {
        "as": "switchedOn",
        "on": "sweatch$",
        "sinkNames": [
          "DOM",
          "a",
          "b",
          "c"
        ]
      }
    },
    {
      "combinatorName": "Case",
      "componentName": "App",
      "emits": {
        "identifier": "sweatch$",
        "notification": {
          "kind": "N",
          "value": true
        },
        "type": 0
      },
      "id": 2,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ],
      "settings": {
        "as": "switchedOn",
        "on": "sweatch$",
        "sinkNames": [
          "DOM",
          "a",
          "b",
          "c"
        ],
        "when": ""
      }
    },
    {
      "combinatorName": "Case",
      "componentName": "App",
      "emits": {
        "identifier": "sweatch$",
        "notification": {
          "kind": "N",
          "value": true
        },
        "type": 0
      },
      "id": 3,
      "logType": "runtime",
      "path": [
        0,
        0,
        1
      ],
      "settings": {
        "as": "switchedOn",
        "on": "sweatch$",
        "sinkNames": [
          "DOM",
          "a",
          "b",
          "c"
        ],
        "when": "Y"
      }
    },
    {
      "combinatorName": "Case",
      "componentName": "App",
      "emits": {
        "identifier": "sweatch$",
        "notification": {
          "kind": "N",
          "value": true
        },
        "type": 0
      },
      "id": 4,
      "logType": "runtime",
      "path": [
        0,
        0,
        2
      ],
      "settings": {
        "as": "switchedOn",
        "on": "sweatch$",
        "sinkNames": [
          "DOM",
          "a",
          "b",
          "c"
        ],
        "when": 2
      }
    },
    {
      "combinatorName": "Case",
      "componentName": "App",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": null
        },
        "type": 1
      },
      "id": 5,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": "Case",
      "componentName": "App",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": null
        },
        "type": 1
      },
      "id": 6,
      "logType": "runtime",
      "path": [
        0,
        0,
        1
      ]
    },
    {
      "combinatorName": "Case",
      "componentName": "App",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": null
        },
        "type": 1
      },
      "id": 7,
      "logType": "runtime",
      "path": [
        0,
        0,
        2
      ]
    },
    {
      "combinatorName": "Switch",
      "componentName": "App",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div></div>"
        },
        "type": 1
      },
      "id": 8,
      "logType": "runtime",
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
          "value": "<div><div></div></div>"
        },
        "type": 1
      },
      "id": 9,
      "logType": "runtime",
      "path": [
        0
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "ROOT",
      "emits": {
        "identifier": "sweatch$",
        "notification": {
          "kind": "N",
          "value": false
        },
        "type": 0
      },
      "id": 10,
      "logType": "runtime",
      "path": [
        0
      ],
      "settings": {}
    },
    {
      "combinatorName": "Switch",
      "componentName": "App",
      "emits": {
        "identifier": "sweatch$",
        "notification": {
          "kind": "N",
          "value": false
        },
        "type": 0
      },
      "id": 11,
      "logType": "runtime",
      "path": [
        0,
        0
      ],
      "settings": {
        "as": "switchedOn",
        "on": "sweatch$",
        "sinkNames": [
          "DOM",
          "a",
          "b",
          "c"
        ]
      }
    },
    {
      "combinatorName": "Case",
      "componentName": "App",
      "emits": {
        "identifier": "sweatch$",
        "notification": {
          "kind": "N",
          "value": false
        },
        "type": 0
      },
      "id": 12,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ],
      "settings": {
        "as": "switchedOn",
        "on": "sweatch$",
        "sinkNames": [
          "DOM",
          "a",
          "b",
          "c"
        ],
        "when": ""
      }
    },
    {
      "combinatorName": "Case",
      "componentName": "App",
      "emits": {
        "identifier": "sweatch$",
        "notification": {
          "kind": "N",
          "value": false
        },
        "type": 0
      },
      "id": 13,
      "logType": "runtime",
      "path": [
        0,
        0,
        1
      ],
      "settings": {
        "as": "switchedOn",
        "on": "sweatch$",
        "sinkNames": [
          "DOM",
          "a",
          "b",
          "c"
        ],
        "when": "Y"
      }
    },
    {
      "combinatorName": "Case",
      "componentName": "App",
      "emits": {
        "identifier": "sweatch$",
        "notification": {
          "kind": "N",
          "value": false
        },
        "type": 0
      },
      "id": 14,
      "logType": "runtime",
      "path": [
        0,
        0,
        2
      ],
      "settings": {
        "as": "switchedOn",
        "on": "sweatch$",
        "sinkNames": [
          "DOM",
          "a",
          "b",
          "c"
        ],
        "when": 2
      }
    },
    {
      "combinatorName": "Case",
      "componentName": "App",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": null
        },
        "type": 1
      },
      "id": 15,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": "Case",
      "componentName": "App",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": null
        },
        "type": 1
      },
      "id": 16,
      "logType": "runtime",
      "path": [
        0,
        0,
        1
      ]
    },
    {
      "combinatorName": "Case",
      "componentName": "App",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": null
        },
        "type": 1
      },
      "id": 17,
      "logType": "runtime",
      "path": [
        0,
        0,
        2
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "ROOT",
      "emits": {
        "identifier": "sweatch$",
        "notification": {
          "kind": "N",
          "value": true
        },
        "type": 0
      },
      "id": 18,
      "logType": "runtime",
      "path": [
        0
      ],
      "settings": {}
    },
    {
      "combinatorName": "Switch",
      "componentName": "App",
      "emits": {
        "identifier": "sweatch$",
        "notification": {
          "kind": "N",
          "value": true
        },
        "type": 0
      },
      "id": 19,
      "logType": "runtime",
      "path": [
        0,
        0
      ],
      "settings": {
        "as": "switchedOn",
        "on": "sweatch$",
        "sinkNames": [
          "DOM",
          "a",
          "b",
          "c"
        ]
      }
    },
    {
      "combinatorName": "Case",
      "componentName": "App",
      "emits": {
        "identifier": "sweatch$",
        "notification": {
          "kind": "N",
          "value": true
        },
        "type": 0
      },
      "id": 20,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ],
      "settings": {
        "as": "switchedOn",
        "on": "sweatch$",
        "sinkNames": [
          "DOM",
          "a",
          "b",
          "c"
        ],
        "when": ""
      }
    },
    {
      "combinatorName": "Case",
      "componentName": "App",
      "emits": {
        "identifier": "sweatch$",
        "notification": {
          "kind": "N",
          "value": true
        },
        "type": 0
      },
      "id": 21,
      "logType": "runtime",
      "path": [
        0,
        0,
        1
      ],
      "settings": {
        "as": "switchedOn",
        "on": "sweatch$",
        "sinkNames": [
          "DOM",
          "a",
          "b",
          "c"
        ],
        "when": "Y"
      }
    },
    {
      "combinatorName": "Case",
      "componentName": "App",
      "emits": {
        "identifier": "sweatch$",
        "notification": {
          "kind": "N",
          "value": true
        },
        "type": 0
      },
      "id": 22,
      "logType": "runtime",
      "path": [
        0,
        0,
        2
      ],
      "settings": {
        "as": "switchedOn",
        "on": "sweatch$",
        "sinkNames": [
          "DOM",
          "a",
          "b",
          "c"
        ],
        "when": 2
      }
    },
    {
      "combinatorName": "Case",
      "componentName": "App",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": null
        },
        "type": 1
      },
      "id": 23,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": "Case",
      "componentName": "App",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": null
        },
        "type": 1
      },
      "id": 24,
      "logType": "runtime",
      "path": [
        0,
        0,
        1
      ]
    },
    {
      "combinatorName": "Case",
      "componentName": "App",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": null
        },
        "type": 1
      },
      "id": 25,
      "logType": "runtime",
      "path": [
        0,
        0,
        2
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "ROOT",
      "emits": {
        "identifier": "sweatch$",
        "notification": {
          "kind": "N",
          "value": true
        },
        "type": 0
      },
      "id": 26,
      "logType": "runtime",
      "path": [
        0
      ],
      "settings": {}
    },
    {
      "combinatorName": "Switch",
      "componentName": "App",
      "emits": {
        "identifier": "sweatch$",
        "notification": {
          "kind": "N",
          "value": true
        },
        "type": 0
      },
      "id": 27,
      "logType": "runtime",
      "path": [
        0,
        0
      ],
      "settings": {
        "as": "switchedOn",
        "on": "sweatch$",
        "sinkNames": [
          "DOM",
          "a",
          "b",
          "c"
        ]
      }
    },
    {
      "combinatorName": "Case",
      "componentName": "App",
      "emits": {
        "identifier": "sweatch$",
        "notification": {
          "kind": "N",
          "value": true
        },
        "type": 0
      },
      "id": 28,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ],
      "settings": {
        "as": "switchedOn",
        "on": "sweatch$",
        "sinkNames": [
          "DOM",
          "a",
          "b",
          "c"
        ],
        "when": ""
      }
    },
    {
      "combinatorName": "Case",
      "componentName": "App",
      "emits": {
        "identifier": "sweatch$",
        "notification": {
          "kind": "N",
          "value": true
        },
        "type": 0
      },
      "id": 29,
      "logType": "runtime",
      "path": [
        0,
        0,
        1
      ],
      "settings": {
        "as": "switchedOn",
        "on": "sweatch$",
        "sinkNames": [
          "DOM",
          "a",
          "b",
          "c"
        ],
        "when": "Y"
      }
    },
    {
      "combinatorName": "Case",
      "componentName": "App",
      "emits": {
        "identifier": "sweatch$",
        "notification": {
          "kind": "N",
          "value": true
        },
        "type": 0
      },
      "id": 30,
      "logType": "runtime",
      "path": [
        0,
        0,
        2
      ],
      "settings": {
        "as": "switchedOn",
        "on": "sweatch$",
        "sinkNames": [
          "DOM",
          "a",
          "b",
          "c"
        ],
        "when": 2
      }
    },
    {
      "combinatorName": "Case",
      "componentName": "App",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": null
        },
        "type": 1
      },
      "id": 31,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": "Case",
      "componentName": "App",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": null
        },
        "type": 1
      },
      "id": 32,
      "logType": "runtime",
      "path": [
        0,
        0,
        1
      ]
    },
    {
      "combinatorName": "Case",
      "componentName": "App",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": null
        },
        "type": 1
      },
      "id": 33,
      "logType": "runtime",
      "path": [
        0,
        0,
        2
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "ROOT",
      "emits": {
        "identifier": "sweatch$",
        "notification": {
          "kind": "N",
          "value": true
        },
        "type": 0
      },
      "id": 34,
      "logType": "runtime",
      "path": [
        0
      ],
      "settings": {}
    },
    {
      "combinatorName": "Switch",
      "componentName": "App",
      "emits": {
        "identifier": "sweatch$",
        "notification": {
          "kind": "N",
          "value": true
        },
        "type": 0
      },
      "id": 35,
      "logType": "runtime",
      "path": [
        0,
        0
      ],
      "settings": {
        "as": "switchedOn",
        "on": "sweatch$",
        "sinkNames": [
          "DOM",
          "a",
          "b",
          "c"
        ]
      }
    },
    {
      "combinatorName": "Case",
      "componentName": "App",
      "emits": {
        "identifier": "sweatch$",
        "notification": {
          "kind": "N",
          "value": true
        },
        "type": 0
      },
      "id": 36,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ],
      "settings": {
        "as": "switchedOn",
        "on": "sweatch$",
        "sinkNames": [
          "DOM",
          "a",
          "b",
          "c"
        ],
        "when": ""
      }
    },
    {
      "combinatorName": "Case",
      "componentName": "App",
      "emits": {
        "identifier": "sweatch$",
        "notification": {
          "kind": "N",
          "value": true
        },
        "type": 0
      },
      "id": 37,
      "logType": "runtime",
      "path": [
        0,
        0,
        1
      ],
      "settings": {
        "as": "switchedOn",
        "on": "sweatch$",
        "sinkNames": [
          "DOM",
          "a",
          "b",
          "c"
        ],
        "when": "Y"
      }
    },
    {
      "combinatorName": "Case",
      "componentName": "App",
      "emits": {
        "identifier": "sweatch$",
        "notification": {
          "kind": "N",
          "value": true
        },
        "type": 0
      },
      "id": 38,
      "logType": "runtime",
      "path": [
        0,
        0,
        2
      ],
      "settings": {
        "as": "switchedOn",
        "on": "sweatch$",
        "sinkNames": [
          "DOM",
          "a",
          "b",
          "c"
        ],
        "when": 2
      }
    },
    {
      "combinatorName": "Case",
      "componentName": "App",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": null
        },
        "type": 1
      },
      "id": 39,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": "Case",
      "componentName": "App",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": null
        },
        "type": 1
      },
      "id": 40,
      "logType": "runtime",
      "path": [
        0,
        0,
        1
      ]
    },
    {
      "combinatorName": "Case",
      "componentName": "App",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": null
        },
        "type": 1
      },
      "id": 41,
      "logType": "runtime",
      "path": [
        0,
        0,
        2
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "ROOT",
      "emits": {
        "identifier": "sweatch$",
        "notification": {
          "kind": "N",
          "value": true
        },
        "type": 0
      },
      "id": 42,
      "logType": "runtime",
      "path": [
        0
      ],
      "settings": {}
    },
    {
      "combinatorName": "Switch",
      "componentName": "App",
      "emits": {
        "identifier": "sweatch$",
        "notification": {
          "kind": "N",
          "value": true
        },
        "type": 0
      },
      "id": 43,
      "logType": "runtime",
      "path": [
        0,
        0
      ],
      "settings": {
        "as": "switchedOn",
        "on": "sweatch$",
        "sinkNames": [
          "DOM",
          "a",
          "b",
          "c"
        ]
      }
    },
    {
      "combinatorName": "Case",
      "componentName": "App",
      "emits": {
        "identifier": "sweatch$",
        "notification": {
          "kind": "N",
          "value": true
        },
        "type": 0
      },
      "id": 44,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ],
      "settings": {
        "as": "switchedOn",
        "on": "sweatch$",
        "sinkNames": [
          "DOM",
          "a",
          "b",
          "c"
        ],
        "when": ""
      }
    },
    {
      "combinatorName": "Case",
      "componentName": "App",
      "emits": {
        "identifier": "sweatch$",
        "notification": {
          "kind": "N",
          "value": true
        },
        "type": 0
      },
      "id": 45,
      "logType": "runtime",
      "path": [
        0,
        0,
        1
      ],
      "settings": {
        "as": "switchedOn",
        "on": "sweatch$",
        "sinkNames": [
          "DOM",
          "a",
          "b",
          "c"
        ],
        "when": "Y"
      }
    },
    {
      "combinatorName": "Case",
      "componentName": "App",
      "emits": {
        "identifier": "sweatch$",
        "notification": {
          "kind": "N",
          "value": true
        },
        "type": 0
      },
      "id": 46,
      "logType": "runtime",
      "path": [
        0,
        0,
        2
      ],
      "settings": {
        "as": "switchedOn",
        "on": "sweatch$",
        "sinkNames": [
          "DOM",
          "a",
          "b",
          "c"
        ],
        "when": 2
      }
    },
    {
      "combinatorName": "Case",
      "componentName": "App",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": null
        },
        "type": 1
      },
      "id": 47,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": "Case",
      "componentName": "App",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": null
        },
        "type": 1
      },
      "id": 48,
      "logType": "runtime",
      "path": [
        0,
        0,
        1
      ]
    },
    {
      "combinatorName": "Case",
      "componentName": "App",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": null
        },
        "type": 1
      },
      "id": 49,
      "logType": "runtime",
      "path": [
        0,
        0,
        2
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "ROOT",
      "emits": {
        "identifier": "sweatch$",
        "notification": {
          "kind": "N",
          "value": true
        },
        "type": 0
      },
      "id": 50,
      "logType": "runtime",
      "path": [
        0
      ],
      "settings": {}
    },
    {
      "combinatorName": "Switch",
      "componentName": "App",
      "emits": {
        "identifier": "sweatch$",
        "notification": {
          "kind": "N",
          "value": true
        },
        "type": 0
      },
      "id": 51,
      "logType": "runtime",
      "path": [
        0,
        0
      ],
      "settings": {
        "as": "switchedOn",
        "on": "sweatch$",
        "sinkNames": [
          "DOM",
          "a",
          "b",
          "c"
        ]
      }
    },
    {
      "combinatorName": "Case",
      "componentName": "App",
      "emits": {
        "identifier": "sweatch$",
        "notification": {
          "kind": "N",
          "value": true
        },
        "type": 0
      },
      "id": 52,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ],
      "settings": {
        "as": "switchedOn",
        "on": "sweatch$",
        "sinkNames": [
          "DOM",
          "a",
          "b",
          "c"
        ],
        "when": ""
      }
    },
    {
      "combinatorName": "Case",
      "componentName": "App",
      "emits": {
        "identifier": "sweatch$",
        "notification": {
          "kind": "N",
          "value": true
        },
        "type": 0
      },
      "id": 53,
      "logType": "runtime",
      "path": [
        0,
        0,
        1
      ],
      "settings": {
        "as": "switchedOn",
        "on": "sweatch$",
        "sinkNames": [
          "DOM",
          "a",
          "b",
          "c"
        ],
        "when": "Y"
      }
    },
    {
      "combinatorName": "Case",
      "componentName": "App",
      "emits": {
        "identifier": "sweatch$",
        "notification": {
          "kind": "N",
          "value": true
        },
        "type": 0
      },
      "id": 54,
      "logType": "runtime",
      "path": [
        0,
        0,
        2
      ],
      "settings": {
        "as": "switchedOn",
        "on": "sweatch$",
        "sinkNames": [
          "DOM",
          "a",
          "b",
          "c"
        ],
        "when": 2
      }
    },
    {
      "combinatorName": "Case",
      "componentName": "App",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": null
        },
        "type": 1
      },
      "id": 55,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": "Case",
      "componentName": "App",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": null
        },
        "type": 1
      },
      "id": 56,
      "logType": "runtime",
      "path": [
        0,
        0,
        1
      ]
    },
    {
      "combinatorName": "Case",
      "componentName": "App",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": null
        },
        "type": 1
      },
      "id": 57,
      "logType": "runtime",
      "path": [
        0,
        0,
        2
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "ROOT",
      "emits": {
        "identifier": "sweatch$",
        "notification": {
          "kind": "N",
          "value": false
        },
        "type": 0
      },
      "id": 58,
      "logType": "runtime",
      "path": [
        0
      ],
      "settings": {}
    },
    {
      "combinatorName": "Switch",
      "componentName": "App",
      "emits": {
        "identifier": "sweatch$",
        "notification": {
          "kind": "N",
          "value": false
        },
        "type": 0
      },
      "id": 59,
      "logType": "runtime",
      "path": [
        0,
        0
      ],
      "settings": {
        "as": "switchedOn",
        "on": "sweatch$",
        "sinkNames": [
          "DOM",
          "a",
          "b",
          "c"
        ]
      }
    },
    {
      "combinatorName": "Case",
      "componentName": "App",
      "emits": {
        "identifier": "sweatch$",
        "notification": {
          "kind": "N",
          "value": false
        },
        "type": 0
      },
      "id": 60,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ],
      "settings": {
        "as": "switchedOn",
        "on": "sweatch$",
        "sinkNames": [
          "DOM",
          "a",
          "b",
          "c"
        ],
        "when": ""
      }
    },
    {
      "combinatorName": "Case",
      "componentName": "App",
      "emits": {
        "identifier": "sweatch$",
        "notification": {
          "kind": "N",
          "value": false
        },
        "type": 0
      },
      "id": 61,
      "logType": "runtime",
      "path": [
        0,
        0,
        1
      ],
      "settings": {
        "as": "switchedOn",
        "on": "sweatch$",
        "sinkNames": [
          "DOM",
          "a",
          "b",
          "c"
        ],
        "when": "Y"
      }
    },
    {
      "combinatorName": "Case",
      "componentName": "App",
      "emits": {
        "identifier": "sweatch$",
        "notification": {
          "kind": "N",
          "value": false
        },
        "type": 0
      },
      "id": 62,
      "logType": "runtime",
      "path": [
        0,
        0,
        2
      ],
      "settings": {
        "as": "switchedOn",
        "on": "sweatch$",
        "sinkNames": [
          "DOM",
          "a",
          "b",
          "c"
        ],
        "when": 2
      }
    },
    {
      "combinatorName": "Case",
      "componentName": "App",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": null
        },
        "type": 1
      },
      "id": 63,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": "Case",
      "componentName": "App",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": null
        },
        "type": 1
      },
      "id": 64,
      "logType": "runtime",
      "path": [
        0,
        0,
        1
      ]
    },
    {
      "combinatorName": "Case",
      "componentName": "App",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": null
        },
        "type": 1
      },
      "id": 65,
      "logType": "runtime",
      "path": [
        0,
        0,
        2
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "ROOT",
      "emits": {
        "identifier": "sweatch$",
        "notification": {
          "kind": "N",
          "value": false
        },
        "type": 0
      },
      "id": 66,
      "logType": "runtime",
      "path": [
        0
      ],
      "settings": {}
    },
    {
      "combinatorName": "Switch",
      "componentName": "App",
      "emits": {
        "identifier": "sweatch$",
        "notification": {
          "kind": "N",
          "value": false
        },
        "type": 0
      },
      "id": 67,
      "logType": "runtime",
      "path": [
        0,
        0
      ],
      "settings": {
        "as": "switchedOn",
        "on": "sweatch$",
        "sinkNames": [
          "DOM",
          "a",
          "b",
          "c"
        ]
      }
    },
    {
      "combinatorName": "Case",
      "componentName": "App",
      "emits": {
        "identifier": "sweatch$",
        "notification": {
          "kind": "N",
          "value": false
        },
        "type": 0
      },
      "id": 68,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ],
      "settings": {
        "as": "switchedOn",
        "on": "sweatch$",
        "sinkNames": [
          "DOM",
          "a",
          "b",
          "c"
        ],
        "when": ""
      }
    },
    {
      "combinatorName": "Case",
      "componentName": "App",
      "emits": {
        "identifier": "sweatch$",
        "notification": {
          "kind": "N",
          "value": false
        },
        "type": 0
      },
      "id": 69,
      "logType": "runtime",
      "path": [
        0,
        0,
        1
      ],
      "settings": {
        "as": "switchedOn",
        "on": "sweatch$",
        "sinkNames": [
          "DOM",
          "a",
          "b",
          "c"
        ],
        "when": "Y"
      }
    },
    {
      "combinatorName": "Case",
      "componentName": "App",
      "emits": {
        "identifier": "sweatch$",
        "notification": {
          "kind": "N",
          "value": false
        },
        "type": 0
      },
      "id": 70,
      "logType": "runtime",
      "path": [
        0,
        0,
        2
      ],
      "settings": {
        "as": "switchedOn",
        "on": "sweatch$",
        "sinkNames": [
          "DOM",
          "a",
          "b",
          "c"
        ],
        "when": 2
      }
    },
    {
      "combinatorName": "Case",
      "componentName": "App",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": null
        },
        "type": 1
      },
      "id": 71,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": "Case",
      "componentName": "App",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": null
        },
        "type": 1
      },
      "id": 72,
      "logType": "runtime",
      "path": [
        0,
        0,
        1
      ]
    },
    {
      "combinatorName": "Case",
      "componentName": "App",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": null
        },
        "type": 1
      },
      "id": 73,
      "logType": "runtime",
      "path": [
        0,
        0,
        2
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "ROOT",
      "emits": {
        "identifier": "sweatch$",
        "notification": {
          "kind": "N",
          "value": true
        },
        "type": 0
      },
      "id": 74,
      "logType": "runtime",
      "path": [
        0
      ],
      "settings": {}
    },
    {
      "combinatorName": "Switch",
      "componentName": "App",
      "emits": {
        "identifier": "sweatch$",
        "notification": {
          "kind": "N",
          "value": true
        },
        "type": 0
      },
      "id": 75,
      "logType": "runtime",
      "path": [
        0,
        0
      ],
      "settings": {
        "as": "switchedOn",
        "on": "sweatch$",
        "sinkNames": [
          "DOM",
          "a",
          "b",
          "c"
        ]
      }
    },
    {
      "combinatorName": "Case",
      "componentName": "App",
      "emits": {
        "identifier": "sweatch$",
        "notification": {
          "kind": "N",
          "value": true
        },
        "type": 0
      },
      "id": 76,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ],
      "settings": {
        "as": "switchedOn",
        "on": "sweatch$",
        "sinkNames": [
          "DOM",
          "a",
          "b",
          "c"
        ],
        "when": ""
      }
    },
    {
      "combinatorName": "Case",
      "componentName": "App",
      "emits": {
        "identifier": "sweatch$",
        "notification": {
          "kind": "N",
          "value": true
        },
        "type": 0
      },
      "id": 77,
      "logType": "runtime",
      "path": [
        0,
        0,
        1
      ],
      "settings": {
        "as": "switchedOn",
        "on": "sweatch$",
        "sinkNames": [
          "DOM",
          "a",
          "b",
          "c"
        ],
        "when": "Y"
      }
    },
    {
      "combinatorName": "Case",
      "componentName": "App",
      "emits": {
        "identifier": "sweatch$",
        "notification": {
          "kind": "N",
          "value": true
        },
        "type": 0
      },
      "id": 78,
      "logType": "runtime",
      "path": [
        0,
        0,
        2
      ],
      "settings": {
        "as": "switchedOn",
        "on": "sweatch$",
        "sinkNames": [
          "DOM",
          "a",
          "b",
          "c"
        ],
        "when": 2
      }
    },
    {
      "combinatorName": "Case",
      "componentName": "App",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": null
        },
        "type": 1
      },
      "id": 79,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": "Case",
      "componentName": "App",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": null
        },
        "type": 1
      },
      "id": 80,
      "logType": "runtime",
      "path": [
        0,
        0,
        1
      ]
    },
    {
      "combinatorName": "Case",
      "componentName": "App",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": null
        },
        "type": 1
      },
      "id": 81,
      "logType": "runtime",
      "path": [
        0,
        0,
        2
      ]
    }
  ];
  const expectedGraph = [
    {
      "combinatorName": "Combine",
      "componentName": "ROOT",
      "id": 0,
      "isContainerComponent": false,
      "logType": "graph_structure",
      "path": [
        0
      ]
    },
    {
      "combinatorName": "Switch",
      "componentName": "App",
      "id": 1,
      "isContainerComponent": false,
      "logType": "graph_structure",
      "path": [
        0,
        0
      ]
    },
    {
      "combinatorName": "Case",
      "componentName": "App",
      "id": 2,
      "isContainerComponent": false,
      "logType": "graph_structure",
      "path": [
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": "Case",
      "componentName": "App",
      "id": 3,
      "isContainerComponent": false,
      "logType": "graph_structure",
      "path": [
        0,
        0,
        1
      ]
    },
    {
      "combinatorName": "Case",
      "componentName": "App",
      "id": 4,
      "isContainerComponent": false,
      "logType": "graph_structure",
      "path": [
        0,
        0,
        2
      ]
    }
  ];

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
      assert.deepEqual(
        removeWhenField(traces),
        expectedGraph.concat(expectedTraces),
        `Traces are produced as expected!`);
      done()
    });
});

QUnit.test("main cases - Switch - component tree depth 2 - 1 match, 3 cases", function exec_test(assert) {
  resetGraphCounter();
  const done = assert.async(5);
  const traces = [];

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
  const SWITCH_SOURCE = 'sweatch$';
  const SWITCH_AS = 'switchedOn';
  const switchSettings = {
    on: SWITCH_SOURCE,
    as: SWITCH_AS,
    sinkNames: [DOM_SINK, 'a', 'b', 'c']
  };

  const App = Switch(set(componentNameInSettings, APP_NAME, switchSettings), [
    Case({ when: false }, [childComponent3]),
    Case({ when: false }, [childComponent4]),
    Case({ when: true }, [childComponent1, childComponent2]),
  ]);
  const tracedApp = traceApp({
    _trace: {
      traceSpecs: {
        a: [traceEventSourceFn, traceEventSinkFn],
        b: [traceEventSourceFn, traceEventSinkFn],
        c: [traceEventSourceFn, traceEventSinkFn],
        DOM1: [traceEventSourceFn, traceEventSinkFn],
        DOM2: [traceEventSourceFn, traceEventSinkFn],
        userAction$: [traceEventSourceFn, traceEventSinkFn],
        [DOM_SINK]: [identity, traceDOMsinkFn]
      },

      defaultTraceSpecs: [traceEventSourceFn, traceEventSinkFn],
      sendMessage: msg => traces.push(msg)
    },
    _helpers: { getId: getId(0) }
  }, App);

  // TODO : check that non existing source do not error (for instance, only in sinkm not in source)

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
      'sweatch$': {
        //diagr: '-a--b--c--d--e--f--a',
        //diagr: '-a-b-c-d-e-f-abb-c-d',
        //userA: 'abc-b-ac--ab---c',
        diagram: '-t-f-tttttff-t', values: {
          t: true,
          f: false,
        }
      }
    }
  ];

  /** @type TestResults */
  const expectedMessages = {
    DOM: {
      outputs: [
        "<div><iframe id=\"devtool\" src=\"devtool.html\" style=\"width: 450px; height: 200px\"></iframe><div><div></div></div></div>",
        "<div><iframe id=\"devtool\" src=\"devtool.html\" style=\"width: 450px; height: 200px\"></iframe><div><div><div><span>Component 3 : c</span></div></div></div></div>",
        "<div><iframe id=\"devtool\" src=\"devtool.html\" style=\"width: 450px; height: 200px\"></iframe><div><div></div></div></div>",
        "<div><iframe id=\"devtool\" src=\"devtool.html\" style=\"width: 450px; height: 200px\"></iframe><div><div><div><span>Component 1 : c</span><span>Component 2 : d</span></div></div></div></div>",
        "<div><iframe id=\"devtool\" src=\"devtool.html\" style=\"width: 450px; height: 200px\"></iframe><div><div></div></div></div>",
        "<div><iframe id=\"devtool\" src=\"devtool.html\" style=\"width: 450px; height: 200px\"></iframe><div><div><div><span>Component 3 : f</span></div></div></div></div>",
        "<div><iframe id=\"devtool\" src=\"devtool.html\" style=\"width: 450px; height: 200px\"></iframe><div><div><div><span>Component 3 : a</span></div></div></div></div>",
        "<div><iframe id=\"devtool\" src=\"devtool.html\" style=\"width: 450px; height: 200px\"></iframe><div><div></div></div></div>",
        "<div><iframe id=\"devtool\" src=\"devtool.html\" style=\"width: 450px; height: 200px\"></iframe><div><div><div><span>Component 1 : f</span><span>Component 2 : b</span></div></div></div></div>",
        "<div><iframe id=\"devtool\" src=\"devtool.html\" style=\"width: 450px; height: 200px\"></iframe><div><div><div><span>Component 1 : f</span><span>Component 2 : c</span></div></div></div></div>",
        "<div><iframe id=\"devtool\" src=\"devtool.html\" style=\"width: 450px; height: 200px\"></iframe><div><div><div><span>Component 1 : a</span><span>Component 2 : c</span></div></div></div></div>",
        "<div><iframe id=\"devtool\" src=\"devtool.html\" style=\"width: 450px; height: 200px\"></iframe><div><div><div><span>Component 1 : a</span><span>Component 2 : d</span></div></div></div></div>"
      ],
      successMessage: 'sink DOM produces the expected values',
      // NOTE : I need to keep an eye on the html to check the good behaviour, cannot strip the tags
      transform: pipe(convertVNodesToHTML)
    },
    a: {
      outputs: [
        'Component1 - user action : hover',
        'Component1 - user action : click',
        'Component1 - user action : hover',
        'Component1 - user action : click',
        'Component1 - user action : hover',
      ],
      successMessage: 'sink a produces the expected values',
    },
    b: {
      outputs: [
        // basically all userAction after first value of switch$ is emitted
        "Component2 - user action : hover",
        "Component3 - user action : select",
        "Component2 - user action : click",
        "Component2 - user action : hover",
        "Component2 - user action : click",
        "Component3 - user action : select",
        "Component2 - user action : hover"
      ],
      successMessage: 'sink b produces the expected values',
    },
    c: {
      outputs: [
        "Component4 - user action : select",
        "Component4 - user action : select"
      ],
      successMessage: 'sink c produces the expected values',
    },
  };

  const expectedGraphs = [
    [
    {
      "combinatorName": "Combine",
      "componentName": "ROOT",
      "id": 0,
      "isContainerComponent": false,
      "logType": "graph_structure",
      "path": [
        0
      ]
    },
    {
      "combinatorName": "Switch",
      "componentName": "App",
      "id": 1,
      "isContainerComponent": false,
      "logType": "graph_structure",
      "path": [
        0,
        0
      ]
    },
    {
      "combinatorName": "Case",
      "componentName": "App",
      "id": 2,
      "isContainerComponent": false,
      "logType": "graph_structure",
      "path": [
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": "Case",
      "componentName": "App",
      "id": 3,
      "isContainerComponent": false,
      "logType": "graph_structure",
      "path": [
        0,
        0,
        1
      ]
    },
    {
      "combinatorName": "Case",
      "componentName": "App",
      "id": 4,
      "isContainerComponent": false,
      "logType": "graph_structure",
      "path": [
        0,
        0,
        2
      ]
    }
  ],
    [
      {
        "combinatorName": "Case|Inner",
        "componentName": "App",
        "id": 5,
        "isContainerComponent": false,
        "logType": "graph_structure",
        "path": [
          0,
          0,
          2
        ]
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent1",
        "id": 6,
        "isContainerComponent": false,
        "logType": "graph_structure",
        "path": [
          0,
          0,
          2,
          0
        ]
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent2",
        "id": 7,
        "isContainerComponent": false,
        "logType": "graph_structure",
        "path": [
          0,
          0,
          2,
          1
        ]
      }
    ],
    [
      {
        "combinatorName": "Case|Inner",
        "componentName": "App",
        "id": 8,
        "isContainerComponent": false,
        "logType": "graph_structure",
        "path": [
          0,
          0,
          0
        ]
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent3",
        "id": 9,
        "isContainerComponent": false,
        "logType": "graph_structure",
        "path": [
          0,
          0,
          0,
          0
        ]
      }
    ],
    [
      {
        "combinatorName": "Case|Inner",
        "componentName": "App",
        "id": 10,
        "isContainerComponent": false,
        "logType": "graph_structure",
        "path": [
          0,
          0,
          1
        ]
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent4",
        "id": 11,
        "isContainerComponent": false,
        "logType": "graph_structure",
        "path": [
          0,
          0,
          1,
          0
        ]
      }
    ],
    [
      {
        "combinatorName": "Case|Inner",
        "componentName": "App",
        "id": 12,
        "isContainerComponent": false,
        "logType": "graph_structure",
        "path": [
          0,
          0,
          2
        ]
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent1",
        "id": 13,
        "isContainerComponent": false,
        "logType": "graph_structure",
        "path": [
          0,
          0,
          2,
          0
        ]
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent2",
        "id": 14,
        "isContainerComponent": false,
        "logType": "graph_structure",
        "path": [
          0,
          0,
          2,
          1
        ]
      },
    ],
    [
      {
        "combinatorName": "Case|Inner",
        "componentName": "App",
        "id": 15,
        "isContainerComponent": false,
        "logType": "graph_structure",
        "path": [
          0,
          0,
          2
        ]
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent1",
        "id": 16,
        "isContainerComponent": false,
        "logType": "graph_structure",
        "path": [
          0,
          0,
          2,
          0
        ]
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent2",
        "id": 17,
        "isContainerComponent": false,
        "logType": "graph_structure",
        "path": [
          0,
          0,
          2,
          1
        ]
      },
    ],
    [
      {
      "combinatorName": "Case|Inner",
      "componentName": "App",
      "id": 18,
      "isContainerComponent": false,
      "logType": "graph_structure",
      "path": [
        0,
        0,
        2
      ]
    },
      {
        "combinatorName": undefined,
        "componentName": "childComponent1",
        "id": 19,
        "isContainerComponent": false,
        "logType": "graph_structure",
        "path": [
          0,
          0,
          2,
          0
        ]
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent2",
        "id": 20,
        "isContainerComponent": false,
        "logType": "graph_structure",
        "path": [
          0,
          0,
          2,
          1
        ]
      }
      ],
    [
      {
        "combinatorName": "Case|Inner",
        "componentName": "App",
        "id": 21,
        "isContainerComponent": false,
        "logType": "graph_structure",
        "path": [
          0,
          0,
          2
        ]
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent1",
        "id": 22,
        "isContainerComponent": false,
        "logType": "graph_structure",
        "path": [
          0,
          0,
          2,
          0
        ]
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent2",
        "id": 23,
        "isContainerComponent": false,
        "logType": "graph_structure",
        "path": [
          0,
          0,
          2,
          1
        ]
      },
    ],
    [
      {
        "combinatorName": "Case|Inner",
        "componentName": "App",
        "id": 24,
        "isContainerComponent": false,
        "logType": "graph_structure",
        "path": [
          0,
          0,
          2
        ]
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent1",
        "id": 25,
        "isContainerComponent": false,
        "logType": "graph_structure",
        "path": [
          0,
          0,
          2,
          0
        ]
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent2",
        "id": 26,
        "isContainerComponent": false,
        "logType": "graph_structure",
        "path": [
          0,
          0,
          2,
          1
        ]
      },
    ],
    [
      {
      "combinatorName": "Case|Inner",
      "componentName": "App",
      "id": 27,
      "isContainerComponent": false,
      "logType": "graph_structure",
      "path": [
        0,
        0,
        0
      ]
    },
      {
        "combinatorName": undefined,
        "componentName": "childComponent3",
        "id": 28,
        "isContainerComponent": false,
        "logType": "graph_structure",
        "path": [
          0,
          0,
          0,
          0
        ]
      },
    ],
    [
      {
        "combinatorName": "Case|Inner",
        "componentName": "App",
        "id": 29,
        "isContainerComponent": false,
        "logType": "graph_structure",
        "path": [
          0,
          0,
          1
        ]
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent4",
        "id": 30,
        "isContainerComponent": false,
        "logType": "graph_structure",
        "path": [
          0,
          0,
          1,
          0
        ]
      },
    ],
    [
      {
        "combinatorName": "Case|Inner",
        "componentName": "App",
        "id": 31,
        "isContainerComponent": false,
        "logType": "graph_structure",
        "path": [
          0,
          0,
          0
        ]
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent3",
        "id": 32,
        "isContainerComponent": false,
        "logType": "graph_structure",
        "path": [
          0,
          0,
          0,
          0
        ]
      },
    ],
    [
      {
        "combinatorName": "Case|Inner",
        "componentName": "App",
        "id": 33,
        "isContainerComponent": false,
        "logType": "graph_structure",
        "path": [
          0,
          0,
          1
        ]
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent4",
        "id": 34,
        "isContainerComponent": false,
        "logType": "graph_structure",
        "path": [
          0,
          0,
          1,
          0
        ]
      },
    ],
    [
      {
        "combinatorName": "Case|Inner",
        "componentName": "App",
        "id": 35,
        "isContainerComponent": false,
        "logType": "graph_structure",
        "path": [
          0,
          0,
          2
        ]
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent1",
        "id": 36,
        "isContainerComponent": false,
        "logType": "graph_structure",
        "path": [
          0,
          0,
          2,
          0
        ]
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent2",
        "id": 37,
        "isContainerComponent": false,
        "logType": "graph_structure",
        "path": [
          0,
          0,
          2,
          1
        ]
      },
    ]
  ];
  const expectedTraces = [
    [
    {
      "combinatorName": "Combine",
      "componentName": "ROOT",
      "emits": {
        "identifier": "sweatch$",
        "notification": {
          "kind": "N",
          "value": true
        },
        "type": 0
      },
      "id": 0,
      "logType": "runtime",
      "path": [
        0
      ],
      "settings": {}
    },
    {
      "combinatorName": "Switch",
      "componentName": "App",
      "emits": {
        "identifier": "sweatch$",
        "notification": {
          "kind": "N",
          "value": true
        },
        "type": 0
      },
      "id": 1,
      "logType": "runtime",
      "path": [
        0,
        0
      ],
      "settings": {
        "as": "switchedOn",
        "on": "sweatch$",
        "sinkNames": [
          "DOM",
          "a",
          "b",
          "c"
        ]
      }
    },
    {
      "combinatorName": "Case",
      "componentName": "App",
      "emits": {
        "identifier": "sweatch$",
        "notification": {
          "kind": "N",
          "value": true
        },
        "type": 0
      },
      "id": 2,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ],
      "settings": {
        "as": "switchedOn",
        "on": "sweatch$",
        "sinkNames": [
          "DOM",
          "a",
          "b",
          "c"
        ],
        "when": false
      }
    },
    {
      "combinatorName": "Case",
      "componentName": "App",
      "emits": {
        "identifier": "sweatch$",
        "notification": {
          "kind": "N",
          "value": true
        },
        "type": 0
      },
      "id": 3,
      "logType": "runtime",
      "path": [
        0,
        0,
        1
      ],
      "settings": {
        "as": "switchedOn",
        "on": "sweatch$",
        "sinkNames": [
          "DOM",
          "a",
          "b",
          "c"
        ],
        "when": false
      }
    },
    {
      "combinatorName": "Case",
      "componentName": "App",
      "emits": {
        "identifier": "sweatch$",
        "notification": {
          "kind": "N",
          "value": true
        },
        "type": 0
      },
      "id": 4,
      "logType": "runtime",
      "path": [
        0,
        0,
        2
      ],
      "settings": {
        "as": "switchedOn",
        "on": "sweatch$",
        "sinkNames": [
          "DOM",
          "a",
          "b",
          "c"
        ],
        "when": true
      }
    }
  ],
    [
      {
        "combinatorName": "Case",
        "componentName": "App",
        "emits": {
          "identifier": "DOM",
          "notification": {
            "kind": "N",
            "value": null
          },
          "type": 1
        },
        "id": 5,
        "logType": "runtime",
        "path": [
          0,
          0,
          0
        ]
      },
      {
        "combinatorName": "Case",
        "componentName": "App",
        "emits": {
          "identifier": "DOM",
          "notification": {
            "kind": "N",
            "value": null
          },
          "type": 1
        },
        "id": 6,
        "logType": "runtime",
        "path": [
          0,
          0,
          1
        ]
      },
      {
        "combinatorName": "Combine",
        "componentName": "ROOT",
        "emits": {
          "identifier": "userAction$",
          "notification": {
            "kind": "N",
            "value": "hover"
          },
          "type": 0
        },
        "id": 7,
        "logType": "runtime",
        "path": [
          0
        ],
        "settings": {}
      },
      {
        "combinatorName": "Switch",
        "componentName": "App",
        "emits": {
          "identifier": "userAction$",
          "notification": {
            "kind": "N",
            "value": "hover"
          },
          "type": 0
        },
        "id": 8,
        "logType": "runtime",
        "path": [
          0,
          0
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ]
        }
      },
      {
        "combinatorName": "Case",
        "componentName": "App",
        "emits": {
          "identifier": "userAction$",
          "notification": {
            "kind": "N",
            "value": "hover"
          },
          "type": 0
        },
        "id": 9,
        "logType": "runtime",
        "path": [
          0,
          0,
          2
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "when": true
        }
      },
      {
        "combinatorName": "Case|Inner",
        "componentName": "App",
        "emits": {
          "identifier": "userAction$",
          "notification": {
            "kind": "N",
            "value": "hover"
          },
          "type": 0
        },
        "id": 10,
        "logType": "runtime",
        "path": [
          0,
          0,
          2
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "switchedOn": true,

          "when": true
        }
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent1",
        "emits": {
          "identifier": "userAction$",
          "notification": {
            "kind": "N",
            "value": "hover"
          },
          "type": 0
        },
        "id": 11,
        "logType": "runtime",
        "path": [
          0,
          0,
          2,
          0
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "switchedOn": true,

          "when": true
        }
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent1",
        "emits": {
          "identifier": "a",
          "notification": {
            "kind": "N",
            "value": "Component1 - user action : hover"
          },
          "type": 1
        },
        "id": 12,
        "logType": "runtime",
        "path": [
          0,
          0,
          2,
          0
        ]
      },
      {
        "combinatorName": "Case|Inner",
        "componentName": "App",
        "emits": {
          "identifier": "a",
          "notification": {
            "kind": "N",
            "value": "Component1 - user action : hover"
          },
          "type": 1
        },
        "id": 13,
        "logType": "runtime",
        "path": [
          0,
          0,
          2
        ]
      },
      {
        "combinatorName": "Case",
        "componentName": "App",
        "emits": {
          "identifier": "a",
          "notification": {
            "kind": "N",
            "value": "Component1 - user action : hover"
          },
          "type": 1
        },
        "id": 14,
        "logType": "runtime",
        "path": [
          0,
          0,
          2
        ]
      },
      {
        "combinatorName": "Switch",
        "componentName": "App",
        "emits": {
          "identifier": "a",
          "notification": {
            "kind": "N",
            "value": "Component1 - user action : hover"
          },
          "type": 1
        },
        "id": 15,
        "logType": "runtime",
        "path": [
          0,
          0
        ]
      },
      {
        "combinatorName": "Combine",
        "componentName": "ROOT",
        "emits": {
          "identifier": "a",
          "notification": {
            "kind": "N",
            "value": "Component1 - user action : hover"
          },
          "type": 1
        },
        "id": 16,
        "logType": "runtime",
        "path": [
          0
        ]
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent2",
        "emits": {
          "identifier": "userAction$",
          "notification": {
            "kind": "N",
            "value": "hover"
          },
          "type": 0
        },
        "id": 17,
        "logType": "runtime",
        "path": [
          0,
          0,
          2,
          1
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "switchedOn": true,

          "when": true
        }
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent2",
        "emits": {
          "identifier": "b",
          "notification": {
            "kind": "N",
            "value": "Component2 - user action : hover"
          },
          "type": 1
        },
        "id": 18,
        "logType": "runtime",
        "path": [
          0,
          0,
          2,
          1
        ]
      },
      {
        "combinatorName": "Case|Inner",
        "componentName": "App",
        "emits": {
          "identifier": "b",
          "notification": {
            "kind": "N",
            "value": "Component2 - user action : hover"
          },
          "type": 1
        },
        "id": 19,
        "logType": "runtime",
        "path": [
          0,
          0,
          2
        ]
      },
      {
        "combinatorName": "Case",
        "componentName": "App",
        "emits": {
          "identifier": "b",
          "notification": {
            "kind": "N",
            "value": "Component2 - user action : hover"
          },
          "type": 1
        },
        "id": 20,
        "logType": "runtime",
        "path": [
          0,
          0,
          2
        ]
      },
      {
        "combinatorName": "Switch",
        "componentName": "App",
        "emits": {
          "identifier": "b",
          "notification": {
            "kind": "N",
            "value": "Component2 - user action : hover"
          },
          "type": 1
        },
        "id": 21,
        "logType": "runtime",
        "path": [
          0,
          0
        ]
      },
      {
        "combinatorName": "Combine",
        "componentName": "ROOT",
        "emits": {
          "identifier": "b",
          "notification": {
            "kind": "N",
            "value": "Component2 - user action : hover"
          },
          "type": 1
        },
        "id": 22,
        "logType": "runtime",
        "path": [
          0
        ]
      },
      {
        "combinatorName": "Combine",
        "componentName": "ROOT",
        "emits": {
          "identifier": "DOM2",
          "notification": {
            "kind": "N",
            "value": "b"
          },
          "type": 0
        },
        "id": 23,
        "logType": "runtime",
        "path": [
          0
        ],
        "settings": {}
      },
      {
        "combinatorName": "Switch",
        "componentName": "App",
        "emits": {
          "identifier": "DOM2",
          "notification": {
            "kind": "N",
            "value": "b"
          },
          "type": 0
        },
        "id": 24,
        "logType": "runtime",
        "path": [
          0,
          0
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ]
        }
      },
      {
        "combinatorName": "Case",
        "componentName": "App",
        "emits": {
          "identifier": "DOM2",
          "notification": {
            "kind": "N",
            "value": "b"
          },
          "type": 0
        },
        "id": 25,
        "logType": "runtime",
        "path": [
          0,
          0,
          2
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "when": true
        }
      },
      {
        "combinatorName": "Case|Inner",
        "componentName": "App",
        "emits": {
          "identifier": "DOM2",
          "notification": {
            "kind": "N",
            "value": "b"
          },
          "type": 0
        },
        "id": 26,
        "logType": "runtime",
        "path": [
          0,
          0,
          2
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "switchedOn": true,

          "when": true
        }
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent2",
        "emits": {
          "identifier": "DOM2",
          "notification": {
            "kind": "N",
            "value": "b"
          },
          "type": 0
        },
        "id": 27,
        "logType": "runtime",
        "path": [
          0,
          0,
          2,
          1
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "switchedOn": true,

          "when": true
        }
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent2",
        "emits": {
          "identifier": "DOM",
          "notification": {
            "kind": "N",
            "value": "<span>Component 2 : b</span>"
          },
          "type": 1
        },
        "id": 28,
        "logType": "runtime",
        "path": [
          0,
          0,
          2,
          1
        ]
      },
      {
        "combinatorName": "Combine",
        "componentName": "ROOT",
        "emits": {
          "identifier": "sweatch$",
          "notification": {
            "kind": "N",
            "value": false
          },
          "type": 0
        },
        "id": 29,
        "logType": "runtime",
        "path": [
          0
        ],
        "settings": {}
      },
      {
        "combinatorName": "Switch",
        "componentName": "App",
        "emits": {
          "identifier": "sweatch$",
          "notification": {
            "kind": "N",
            "value": false
          },
          "type": 0
        },
        "id": 30,
        "logType": "runtime",
        "path": [
          0,
          0
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ]
        }
      },
      {
        "combinatorName": "Case",
        "componentName": "App",
        "emits": {
          "identifier": "sweatch$",
          "notification": {
            "kind": "N",
            "value": false
          },
          "type": 0
        },
        "id": 31,
        "logType": "runtime",
        "path": [
          0,
          0,
          0
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "when": false
        }
      }
    ],
    [
      {
        "combinatorName": "Case",
        "componentName": "App",
        "emits": {
          "identifier": "sweatch$",
          "notification": {
            "kind": "N",
            "value": false
          },
          "type": 0
        },
        "id": 32,
        "logType": "runtime",
        "path": [
          0,
          0,
          1
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "when": false
        }
      },
    ],
    [
      {
        "combinatorName": "Case",
        "componentName": "App",
        "emits": {
          "identifier": "sweatch$",
          "notification": {
            "kind": "N",
            "value": false
          },
          "type": 0
        },
        "id": 33,
        "logType": "runtime",
        "path": [
          0,
          0,
          2
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "when": true
        }
      },
      {
        "combinatorName": "Case",
        "componentName": "App",
        "emits": {
          "identifier": "DOM",
          "notification": {
            "kind": "N",
            "value": null
          },
          "type": 1
        },
        "id": 34,
        "logType": "runtime",
        "path": [
          0,
          0,
          2
        ]
      },
      {
        "combinatorName": "Switch",
        "componentName": "App",
        "emits": {
          "identifier": "DOM",
          "notification": {
            "kind": "N",
            "value": "<div></div>"
          },
          "type": 1
        },
        "id": 35,
        "logType": "runtime",
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
            "value": "<div><div></div></div>"
          },
          "type": 1
        },
        "id": 36,
        "logType": "runtime",
        "path": [
          0
        ]
      },
      {
        "combinatorName": "Combine",
        "componentName": "ROOT",
        "emits": {
          "identifier": "DOM1",
          "notification": {
            "kind": "N",
            "value": "b"
          },
          "type": 0
        },
        "id": 37,
        "logType": "runtime",
        "path": [
          0
        ],
        "settings": {}
      },
      {
        "combinatorName": "Switch",
        "componentName": "App",
        "emits": {
          "identifier": "DOM1",
          "notification": {
            "kind": "N",
            "value": "b"
          },
          "type": 0
        },
        "id": 38,
        "logType": "runtime",
        "path": [
          0,
          0
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ]
        }
      },
      {
        "combinatorName": "Case",
        "componentName": "App",
        "emits": {
          "identifier": "DOM1",
          "notification": {
            "kind": "N",
            "value": "b"
          },
          "type": 0
        },
        "id": 39,
        "logType": "runtime",
        "path": [
          0,
          0,
          2
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "when": true
        }
      },
      {
        "combinatorName": "Case|Inner",
        "componentName": "App",
        "emits": {
          "identifier": "DOM1",
          "notification": {
            "kind": "N",
            "value": "b"
          },
          "type": 0
        },
        "id": 40,
        "logType": "runtime",
        "path": [
          0,
          0,
          2
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "switchedOn": true,

          "when": true
        }
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent1",
        "emits": {
          "identifier": "DOM1",
          "notification": {
            "kind": "N",
            "value": "b"
          },
          "type": 0
        },
        "id": 41,
        "logType": "runtime",
        "path": [
          0,
          0,
          2,
          0
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "switchedOn": true,

          "when": true
        }
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent1",
        "emits": {
          "identifier": "DOM",
          "notification": {
            "kind": "N",
            "value": "<span>Component 1 : b</span>"
          },
          "type": 1
        },
        "id": 42,
        "logType": "runtime",
        "path": [
          0,
          0,
          2,
          0
        ]
      },
      {
        "combinatorName": "Combine",
        "componentName": "ROOT",
        "emits": {
          "identifier": "userAction$",
          "notification": {
            "kind": "N",
            "value": "select"
          },
          "type": 0
        },
        "id": 43,
        "logType": "runtime",
        "path": [
          0
        ],
        "settings": {}
      },
      {
        "combinatorName": "Switch",
        "componentName": "App",
        "emits": {
          "identifier": "userAction$",
          "notification": {
            "kind": "N",
            "value": "select"
          },
          "type": 0
        },
        "id": 44,
        "logType": "runtime",
        "path": [
          0,
          0
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ]
        }
      },
      {
        "combinatorName": "Case",
        "componentName": "App",
        "emits": {
          "identifier": "userAction$",
          "notification": {
            "kind": "N",
            "value": "select"
          },
          "type": 0
        },
        "id": 45,
        "logType": "runtime",
        "path": [
          0,
          0,
          0
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "when": false
        }
      },
      {
        "combinatorName": "Case|Inner",
        "componentName": "App",
        "emits": {
          "identifier": "userAction$",
          "notification": {
            "kind": "N",
            "value": "select"
          },
          "type": 0
        },
        "id": 46,
        "logType": "runtime",
        "path": [
          0,
          0,
          0
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "switchedOn": false,

          "when": false
        }
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent3",
        "emits": {
          "identifier": "userAction$",
          "notification": {
            "kind": "N",
            "value": "select"
          },
          "type": 0
        },
        "id": 47,
        "logType": "runtime",
        "path": [
          0,
          0,
          0,
          0
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "switchedOn": false,

          "when": false
        }
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent3",
        "emits": {
          "identifier": "b",
          "notification": {
            "kind": "N",
            "value": "Component3 - user action : select"
          },
          "type": 1
        },
        "id": 48,
        "logType": "runtime",
        "path": [
          0,
          0,
          0,
          0
        ]
      },
      {
        "combinatorName": "Case|Inner",
        "componentName": "App",
        "emits": {
          "identifier": "b",
          "notification": {
            "kind": "N",
            "value": "Component3 - user action : select"
          },
          "type": 1
        },
        "id": 49,
        "logType": "runtime",
        "path": [
          0,
          0,
          0
        ]
      },
      {
        "combinatorName": "Case",
        "componentName": "App",
        "emits": {
          "identifier": "b",
          "notification": {
            "kind": "N",
            "value": "Component3 - user action : select"
          },
          "type": 1
        },
        "id": 50,
        "logType": "runtime",
        "path": [
          0,
          0,
          0
        ]
      },
      {
        "combinatorName": "Switch",
        "componentName": "App",
        "emits": {
          "identifier": "b",
          "notification": {
            "kind": "N",
            "value": "Component3 - user action : select"
          },
          "type": 1
        },
        "id": 51,
        "logType": "runtime",
        "path": [
          0,
          0
        ]
      },
      {
        "combinatorName": "Combine",
        "componentName": "ROOT",
        "emits": {
          "identifier": "b",
          "notification": {
            "kind": "N",
            "value": "Component3 - user action : select"
          },
          "type": 1
        },
        "id": 52,
        "logType": "runtime",
        "path": [
          0
        ]
      },
      {
        "combinatorName": "Case",
        "componentName": "App",
        "emits": {
          "identifier": "userAction$",
          "notification": {
            "kind": "N",
            "value": "select"
          },
          "type": 0
        },
        "id": 53,
        "logType": "runtime",
        "path": [
          0,
          0,
          1
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "when": false
        }
      },
      {
        "combinatorName": "Case|Inner",
        "componentName": "App",
        "emits": {
          "identifier": "userAction$",
          "notification": {
            "kind": "N",
            "value": "select"
          },
          "type": 0
        },
        "id": 54,
        "logType": "runtime",
        "path": [
          0,
          0,
          1
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "switchedOn": false,

          "when": false
        }
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent4",
        "emits": {
          "identifier": "userAction$",
          "notification": {
            "kind": "N",
            "value": "select"
          },
          "type": 0
        },
        "id": 55,
        "logType": "runtime",
        "path": [
          0,
          0,
          1,
          0
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "switchedOn": false,

          "when": false
        }
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent4",
        "emits": {
          "identifier": "c",
          "notification": {
            "kind": "N",
            "value": "Component4 - user action : select"
          },
          "type": 1
        },
        "id": 56,
        "logType": "runtime",
        "path": [
          0,
          0,
          1,
          0
        ]
      },
      {
        "combinatorName": "Case|Inner",
        "componentName": "App",
        "emits": {
          "identifier": "c",
          "notification": {
            "kind": "N",
            "value": "Component4 - user action : select"
          },
          "type": 1
        },
        "id": 57,
        "logType": "runtime",
        "path": [
          0,
          0,
          1
        ]
      },
      {
        "combinatorName": "Case",
        "componentName": "App",
        "emits": {
          "identifier": "c",
          "notification": {
            "kind": "N",
            "value": "Component4 - user action : select"
          },
          "type": 1
        },
        "id": 58,
        "logType": "runtime",
        "path": [
          0,
          0,
          1
        ]
      },
      {
        "combinatorName": "Switch",
        "componentName": "App",
        "emits": {
          "identifier": "c",
          "notification": {
            "kind": "N",
            "value": "Component4 - user action : select"
          },
          "type": 1
        },
        "id": 59,
        "logType": "runtime",
        "path": [
          0,
          0
        ]
      },
      {
        "combinatorName": "Combine",
        "componentName": "ROOT",
        "emits": {
          "identifier": "c",
          "notification": {
            "kind": "N",
            "value": "Component4 - user action : select"
          },
          "type": 1
        },
        "id": 60,
        "logType": "runtime",
        "path": [
          0
        ]
      },
      {
        "combinatorName": "Combine",
        "componentName": "ROOT",
        "emits": {
          "identifier": "DOM2",
          "notification": {
            "kind": "N",
            "value": "c"
          },
          "type": 0
        },
        "id": 61,
        "logType": "runtime",
        "path": [
          0
        ],
        "settings": {}
      },
      {
        "combinatorName": "Switch",
        "componentName": "App",
        "emits": {
          "identifier": "DOM2",
          "notification": {
            "kind": "N",
            "value": "c"
          },
          "type": 0
        },
        "id": 62,
        "logType": "runtime",
        "path": [
          0,
          0
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ]
        }
      },
      {
        "combinatorName": "Case",
        "componentName": "App",
        "emits": {
          "identifier": "DOM2",
          "notification": {
            "kind": "N",
            "value": "c"
          },
          "type": 0
        },
        "id": 63,
        "logType": "runtime",
        "path": [
          0,
          0,
          2
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "when": true
        }
      },
      {
        "combinatorName": "Case|Inner",
        "componentName": "App",
        "emits": {
          "identifier": "DOM2",
          "notification": {
            "kind": "N",
            "value": "c"
          },
          "type": 0
        },
        "id": 64,
        "logType": "runtime",
        "path": [
          0,
          0,
          2
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "switchedOn": true,

          "when": true
        }
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent2",
        "emits": {
          "identifier": "DOM2",
          "notification": {
            "kind": "N",
            "value": "c"
          },
          "type": 0
        },
        "id": 65,
        "logType": "runtime",
        "path": [
          0,
          0,
          2,
          1
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "switchedOn": true,

          "when": true
        }
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent2",
        "emits": {
          "identifier": "DOM",
          "notification": {
            "kind": "N",
            "value": "<span>Component 2 : c</span>"
          },
          "type": 1
        },
        "id": 66,
        "logType": "runtime",
        "path": [
          0,
          0,
          2,
          1
        ]
      },
      {
        "combinatorName": "Case",
        "componentName": "App",
        "emits": {
          "identifier": "DOM2",
          "notification": {
            "kind": "N",
            "value": "c"
          },
          "type": 0
        },
        "id": 67,
        "logType": "runtime",
        "path": [
          0,
          0,
          0
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "when": false
        }
      },
      {
        "combinatorName": "Case|Inner",
        "componentName": "App",
        "emits": {
          "identifier": "DOM2",
          "notification": {
            "kind": "N",
            "value": "c"
          },
          "type": 0
        },
        "id": 68,
        "logType": "runtime",
        "path": [
          0,
          0,
          0
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "switchedOn": false,

          "when": false
        }
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent3",
        "emits": {
          "identifier": "DOM2",
          "notification": {
            "kind": "N",
            "value": "c"
          },
          "type": 0
        },
        "id": 69,
        "logType": "runtime",
        "path": [
          0,
          0,
          0,
          0
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "switchedOn": false,

          "when": false
        }
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent3",
        "emits": {
          "identifier": "DOM",
          "notification": {
            "kind": "N",
            "value": "<span>Component 3 : c</span>"
          },
          "type": 1
        },
        "id": 70,
        "logType": "runtime",
        "path": [
          0,
          0,
          0,
          0
        ]
      },
      {
        "combinatorName": "Case|Inner",
        "componentName": "App",
        "emits": {
          "identifier": "DOM",
          "notification": {
            "kind": "N",
            "value": "<div><span>Component 3 : c</span></div>"
          },
          "type": 1
        },
        "id": 71,
        "logType": "runtime",
        "path": [
          0,
          0,
          0
        ]
      },
      {
        "combinatorName": "Case",
        "componentName": "App",
        "emits": {
          "identifier": "DOM",
          "notification": {
            "kind": "N",
            "value": "<div><span>Component 3 : c</span></div>"
          },
          "type": 1
        },
        "id": 72,
        "logType": "runtime",
        "path": [
          0,
          0,
          0
        ]
      },
      {
        "combinatorName": "Switch",
        "componentName": "App",
        "emits": {
          "identifier": "DOM",
          "notification": {
            "kind": "N",
            "value": "<div><div><span>Component 3 : c</span></div></div>"
          },
          "type": 1
        },
        "id": 73,
        "logType": "runtime",
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
            "value": "<div><div><div><span>Component 3 : c</span></div></div></div>"
          },
          "type": 1
        },
        "id": 74,
        "logType": "runtime",
        "path": [
          0
        ]
      },
      {
        "combinatorName": "Combine",
        "componentName": "ROOT",
        "emits": {
          "identifier": "sweatch$",
          "notification": {
            "kind": "N",
            "value": true
          },
          "type": 0
        },
        "id": 75,
        "logType": "runtime",
        "path": [
          0
        ],
        "settings": {}
      },
      {
        "combinatorName": "Switch",
        "componentName": "App",
        "emits": {
          "identifier": "sweatch$",
          "notification": {
            "kind": "N",
            "value": true
          },
          "type": 0
        },
        "id": 76,
        "logType": "runtime",
        "path": [
          0,
          0
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ]
        }
      },
      {
        "combinatorName": "Case",
        "componentName": "App",
        "emits": {
          "identifier": "sweatch$",
          "notification": {
            "kind": "N",
            "value": true
          },
          "type": 0
        },
        "id": 77,
        "logType": "runtime",
        "path": [
          0,
          0,
          0
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "when": false
        }
      },
      {
        "combinatorName": "Case",
        "componentName": "App",
        "emits": {
          "identifier": "sweatch$",
          "notification": {
            "kind": "N",
            "value": true
          },
          "type": 0
        },
        "id": 78,
        "logType": "runtime",
        "path": [
          0,
          0,
          1
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "when": false
        }
      },
      {
        "combinatorName": "Case",
        "componentName": "App",
        "emits": {
          "identifier": "sweatch$",
          "notification": {
            "kind": "N",
            "value": true
          },
          "type": 0
        },
        "id": 79,
        "logType": "runtime",
        "path": [
          0,
          0,
          2
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "when": true
        }
      },
    ],
    [
      {
        "combinatorName": "Case",
        "componentName": "App",
        "emits": {
          "identifier": "DOM",
          "notification": {
            "kind": "N",
            "value": null
          },
          "type": 1
        },
        "id": 80,
        "logType": "runtime",
        "path": [
          0,
          0,
          0
        ]
      },
      {
        "combinatorName": "Case",
        "componentName": "App",
        "emits": {
          "identifier": "DOM",
          "notification": {
            "kind": "N",
            "value": null
          },
          "type": 1
        },
        "id": 81,
        "logType": "runtime",
        "path": [
          0,
          0,
          1
        ]
      },
      {
        "combinatorName": "Switch",
        "componentName": "App",
        "emits": {
          "identifier": "DOM",
          "notification": {
            "kind": "N",
            "value": "<div></div>"
          },
          "type": 1
        },
        "id": 82,
        "logType": "runtime",
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
            "value": "<div><div></div></div>"
          },
          "type": 1
        },
        "id": 83,
        "logType": "runtime",
        "path": [
          0
        ]
      },
      {
        "combinatorName": "Combine",
        "componentName": "ROOT",
        "emits": {
          "identifier": "userAction$",
          "notification": {
            "kind": "N",
            "value": "click"
          },
          "type": 0
        },
        "id": 84,
        "logType": "runtime",
        "path": [
          0
        ],
        "settings": {}
      },
      {
        "combinatorName": "Switch",
        "componentName": "App",
        "emits": {
          "identifier": "userAction$",
          "notification": {
            "kind": "N",
            "value": "click"
          },
          "type": 0
        },
        "id": 85,
        "logType": "runtime",
        "path": [
          0,
          0
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ]
        }
      },
      {
        "combinatorName": "Case",
        "componentName": "App",
        "emits": {
          "identifier": "userAction$",
          "notification": {
            "kind": "N",
            "value": "click"
          },
          "type": 0
        },
        "id": 86,
        "logType": "runtime",
        "path": [
          0,
          0,
          2
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "when": true
        }
      },
      {
        "combinatorName": "Case|Inner",
        "componentName": "App",
        "emits": {
          "identifier": "userAction$",
          "notification": {
            "kind": "N",
            "value": "click"
          },
          "type": 0
        },
        "id": 87,
        "logType": "runtime",
        "path": [
          0,
          0,
          2
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "switchedOn": true,

          "when": true
        }
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent1",
        "emits": {
          "identifier": "userAction$",
          "notification": {
            "kind": "N",
            "value": "click"
          },
          "type": 0
        },
        "id": 88,
        "logType": "runtime",
        "path": [
          0,
          0,
          2,
          0
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "switchedOn": true,

          "when": true
        }
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent1",
        "emits": {
          "identifier": "a",
          "notification": {
            "kind": "N",
            "value": "Component1 - user action : click"
          },
          "type": 1
        },
        "id": 89,
        "logType": "runtime",
        "path": [
          0,
          0,
          2,
          0
        ]
      },
      {
        "combinatorName": "Case|Inner",
        "componentName": "App",
        "emits": {
          "identifier": "a",
          "notification": {
            "kind": "N",
            "value": "Component1 - user action : click"
          },
          "type": 1
        },
        "id": 90,
        "logType": "runtime",
        "path": [
          0,
          0,
          2
        ]
      },
      {
        "combinatorName": "Case",
        "componentName": "App",
        "emits": {
          "identifier": "a",
          "notification": {
            "kind": "N",
            "value": "Component1 - user action : click"
          },
          "type": 1
        },
        "id": 91,
        "logType": "runtime",
        "path": [
          0,
          0,
          2
        ]
      },
      {
        "combinatorName": "Switch",
        "componentName": "App",
        "emits": {
          "identifier": "a",
          "notification": {
            "kind": "N",
            "value": "Component1 - user action : click"
          },
          "type": 1
        },
        "id": 92,
        "logType": "runtime",
        "path": [
          0,
          0
        ]
      },
      {
        "combinatorName": "Combine",
        "componentName": "ROOT",
        "emits": {
          "identifier": "a",
          "notification": {
            "kind": "N",
            "value": "Component1 - user action : click"
          },
          "type": 1
        },
        "id": 93,
        "logType": "runtime",
        "path": [
          0
        ]
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent2",
        "emits": {
          "identifier": "userAction$",
          "notification": {
            "kind": "N",
            "value": "click"
          },
          "type": 0
        },
        "id": 94,
        "logType": "runtime",
        "path": [
          0,
          0,
          2,
          1
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "switchedOn": true,

          "when": true
        }
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent2",
        "emits": {
          "identifier": "b",
          "notification": {
            "kind": "N",
            "value": "Component2 - user action : click"
          },
          "type": 1
        },
        "id": 95,
        "logType": "runtime",
        "path": [
          0,
          0,
          2,
          1
        ]
      },
      {
        "combinatorName": "Case|Inner",
        "componentName": "App",
        "emits": {
          "identifier": "b",
          "notification": {
            "kind": "N",
            "value": "Component2 - user action : click"
          },
          "type": 1
        },
        "id": 96,
        "logType": "runtime",
        "path": [
          0,
          0,
          2
        ]
      },
      {
        "combinatorName": "Case",
        "componentName": "App",
        "emits": {
          "identifier": "b",
          "notification": {
            "kind": "N",
            "value": "Component2 - user action : click"
          },
          "type": 1
        },
        "id": 97,
        "logType": "runtime",
        "path": [
          0,
          0,
          2
        ]
      },
      {
        "combinatorName": "Switch",
        "componentName": "App",
        "emits": {
          "identifier": "b",
          "notification": {
            "kind": "N",
            "value": "Component2 - user action : click"
          },
          "type": 1
        },
        "id": 98,
        "logType": "runtime",
        "path": [
          0,
          0
        ]
      },
      {
        "combinatorName": "Combine",
        "componentName": "ROOT",
        "emits": {
          "identifier": "b",
          "notification": {
            "kind": "N",
            "value": "Component2 - user action : click"
          },
          "type": 1
        },
        "id": 99,
        "logType": "runtime",
        "path": [
          0
        ]
      },
      {
        "combinatorName": "Combine",
        "componentName": "ROOT",
        "emits": {
          "identifier": "sweatch$",
          "notification": {
            "kind": "N",
            "value": true
          },
          "type": 0
        },
        "id": 100,
        "logType": "runtime",
        "path": [
          0
        ],
        "settings": {}
      },
      {
        "combinatorName": "Switch",
        "componentName": "App",
        "emits": {
          "identifier": "sweatch$",
          "notification": {
            "kind": "N",
            "value": true
          },
          "type": 0
        },
        "id": 101,
        "logType": "runtime",
        "path": [
          0,
          0
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ]
        }
      },
      {
        "combinatorName": "Case",
        "componentName": "App",
        "emits": {
          "identifier": "sweatch$",
          "notification": {
            "kind": "N",
            "value": true
          },
          "type": 0
        },
        "id": 102,
        "logType": "runtime",
        "path": [
          0,
          0,
          0
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "when": false
        }
      },
      {
        "combinatorName": "Case",
        "componentName": "App",
        "emits": {
          "identifier": "sweatch$",
          "notification": {
            "kind": "N",
            "value": true
          },
          "type": 0
        },
        "id": 103,
        "logType": "runtime",
        "path": [
          0,
          0,
          1
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "when": false
        }
      },
      {
        "combinatorName": "Case",
        "componentName": "App",
        "emits": {
          "identifier": "sweatch$",
          "notification": {
            "kind": "N",
            "value": true
          },
          "type": 0
        },
        "id": 104,
        "logType": "runtime",
        "path": [
          0,
          0,
          2
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "when": true
        }
      }
    ],
    [
      {
        "combinatorName": "Case",
        "componentName": "App",
        "emits": {
          "identifier": "DOM",
          "notification": {
            "kind": "N",
            "value": null
          },
          "type": 1
        },
        "id": 105,
        "logType": "runtime",
        "path": [
          0,
          0,
          0
        ]
      },
      {
        "combinatorName": "Case",
        "componentName": "App",
        "emits": {
          "identifier": "DOM",
          "notification": {
            "kind": "N",
            "value": null
          },
          "type": 1
        },
        "id": 106,
        "logType": "runtime",
        "path": [
          0,
          0,
          1
        ]
      },
      {
        "combinatorName": "Combine",
        "componentName": "ROOT",
        "emits": {
          "identifier": "DOM1",
          "notification": {
            "kind": "N",
            "value": "c"
          },
          "type": 0
        },
        "id": 107,
        "logType": "runtime",
        "path": [
          0
        ],
        "settings": {}
      },
      {
        "combinatorName": "Switch",
        "componentName": "App",
        "emits": {
          "identifier": "DOM1",
          "notification": {
            "kind": "N",
            "value": "c"
          },
          "type": 0
        },
        "id": 108,
        "logType": "runtime",
        "path": [
          0,
          0
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ]
        }
      },
      {
        "combinatorName": "Case",
        "componentName": "App",
        "emits": {
          "identifier": "DOM1",
          "notification": {
            "kind": "N",
            "value": "c"
          },
          "type": 0
        },
        "id": 109,
        "logType": "runtime",
        "path": [
          0,
          0,
          2
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "when": true
        }
      },
      {
        "combinatorName": "Case|Inner",
        "componentName": "App",
        "emits": {
          "identifier": "DOM1",
          "notification": {
            "kind": "N",
            "value": "c"
          },
          "type": 0
        },
        "id": 110,
        "logType": "runtime",
        "path": [
          0,
          0,
          2
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "switchedOn": true,

          "when": true
        }
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent1",
        "emits": {
          "identifier": "DOM1",
          "notification": {
            "kind": "N",
            "value": "c"
          },
          "type": 0
        },
        "id": 111,
        "logType": "runtime",
        "path": [
          0,
          0,
          2,
          0
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "switchedOn": true,

          "when": true
        }
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent1",
        "emits": {
          "identifier": "DOM",
          "notification": {
            "kind": "N",
            "value": "<span>Component 1 : c</span>"
          },
          "type": 1
        },
        "id": 112,
        "logType": "runtime",
        "path": [
          0,
          0,
          2,
          0
        ]
      },
      {
        "combinatorName": "Case|Inner",
        "componentName": "App",
        "emits": {
          "identifier": "DOM1",
          "notification": {
            "kind": "N",
            "value": "c"
          },
          "type": 0
        },
        "id": 113,
        "logType": "runtime",
        "path": [
          0,
          0,
          2
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "switchedOn": true,

          "when": true
        }
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent1",
        "emits": {
          "identifier": "DOM1",
          "notification": {
            "kind": "N",
            "value": "c"
          },
          "type": 0
        },
        "id": 114,
        "logType": "runtime",
        "path": [
          0,
          0,
          2,
          0
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "switchedOn": true,

          "when": true
        }
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent1",
        "emits": {
          "identifier": "DOM",
          "notification": {
            "kind": "N",
            "value": "<span>Component 1 : c</span>"
          },
          "type": 1
        },
        "id": 115,
        "logType": "runtime",
        "path": [
          0,
          0,
          2,
          0
        ]
      },
      {
        "combinatorName": "Case|Inner",
        "componentName": "App",
        "emits": {
          "identifier": "DOM1",
          "notification": {
            "kind": "N",
            "value": "c"
          },
          "type": 0
        },
        "id": 116,
        "logType": "runtime",
        "path": [
          0,
          0,
          2
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "switchedOn": true,

          "when": true
        }
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent1",
        "emits": {
          "identifier": "DOM1",
          "notification": {
            "kind": "N",
            "value": "c"
          },
          "type": 0
        },
        "id": 117,
        "logType": "runtime",
        "path": [
          0,
          0,
          2,
          0
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "switchedOn": true,

          "when": true
        }
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent1",
        "emits": {
          "identifier": "DOM",
          "notification": {
            "kind": "N",
            "value": "<span>Component 1 : c</span>"
          },
          "type": 1
        },
        "id": 118,
        "logType": "runtime",
        "path": [
          0,
          0,
          2,
          0
        ]
      },
      {
        "combinatorName": "Combine",
        "componentName": "ROOT",
        "emits": {
          "identifier": "DOM2",
          "notification": {
            "kind": "N",
            "value": "d"
          },
          "type": 0
        },
        "id": 119,
        "logType": "runtime",
        "path": [
          0
        ],
        "settings": {}
      },
      {
        "combinatorName": "Switch",
        "componentName": "App",
        "emits": {
          "identifier": "DOM2",
          "notification": {
            "kind": "N",
            "value": "d"
          },
          "type": 0
        },
        "id": 120,
        "logType": "runtime",
        "path": [
          0,
          0
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ]
        }
      },
      {
        "combinatorName": "Case",
        "componentName": "App",
        "emits": {
          "identifier": "DOM2",
          "notification": {
            "kind": "N",
            "value": "d"
          },
          "type": 0
        },
        "id": 121,
        "logType": "runtime",
        "path": [
          0,
          0,
          2
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "when": true
        }
      },
      {
        "combinatorName": "Case|Inner",
        "componentName": "App",
        "emits": {
          "identifier": "DOM2",
          "notification": {
            "kind": "N",
            "value": "d"
          },
          "type": 0
        },
        "id": 122,
        "logType": "runtime",
        "path": [
          0,
          0,
          2
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "switchedOn": true,

          "when": true
        }
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent2",
        "emits": {
          "identifier": "DOM2",
          "notification": {
            "kind": "N",
            "value": "d"
          },
          "type": 0
        },
        "id": 123,
        "logType": "runtime",
        "path": [
          0,
          0,
          2,
          1
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "switchedOn": true,

          "when": true
        }
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent2",
        "emits": {
          "identifier": "DOM",
          "notification": {
            "kind": "N",
            "value": "<span>Component 2 : d</span>"
          },
          "type": 1
        },
        "id": 124,
        "logType": "runtime",
        "path": [
          0,
          0,
          2,
          1
        ]
      },
      {
        "combinatorName": "Case|Inner",
        "componentName": "App",
        "emits": {
          "identifier": "DOM2",
          "notification": {
            "kind": "N",
            "value": "d"
          },
          "type": 0
        },
        "id": 125,
        "logType": "runtime",
        "path": [
          0,
          0,
          2
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "switchedOn": true,

          "when": true
        }
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent2",
        "emits": {
          "identifier": "DOM2",
          "notification": {
            "kind": "N",
            "value": "d"
          },
          "type": 0
        },
        "id": 126,
        "logType": "runtime",
        "path": [
          0,
          0,
          2,
          1
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "switchedOn": true,

          "when": true
        }
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent2",
        "emits": {
          "identifier": "DOM",
          "notification": {
            "kind": "N",
            "value": "<span>Component 2 : d</span>"
          },
          "type": 1
        },
        "id": 127,
        "logType": "runtime",
        "path": [
          0,
          0,
          2,
          1
        ]
      },
      {
        "combinatorName": "Case|Inner",
        "componentName": "App",
        "emits": {
          "identifier": "DOM2",
          "notification": {
            "kind": "N",
            "value": "d"
          },
          "type": 0
        },
        "id": 128,
        "logType": "runtime",
        "path": [
          0,
          0,
          2
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "switchedOn": true,

          "when": true
        }
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent2",
        "emits": {
          "identifier": "DOM2",
          "notification": {
            "kind": "N",
            "value": "d"
          },
          "type": 0
        },
        "id": 129,
        "logType": "runtime",
        "path": [
          0,
          0,
          2,
          1
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "switchedOn": true,

          "when": true
        }
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent2",
        "emits": {
          "identifier": "DOM",
          "notification": {
            "kind": "N",
            "value": "<span>Component 2 : d</span>"
          },
          "type": 1
        },
        "id": 130,
        "logType": "runtime",
        "path": [
          0,
          0,
          2,
          1
        ]
      },
      {
        "combinatorName": "Case",
        "componentName": "App",
        "emits": {
          "identifier": "DOM2",
          "notification": {
            "kind": "N",
            "value": "d"
          },
          "type": 0
        },
        "id": 131,
        "logType": "runtime",
        "path": [
          0,
          0,
          0
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "when": false
        }
      },
      {
        "combinatorName": "Case|Inner",
        "componentName": "App",
        "emits": {
          "identifier": "DOM2",
          "notification": {
            "kind": "N",
            "value": "d"
          },
          "type": 0
        },
        "id": 132,
        "logType": "runtime",
        "path": [
          0,
          0,
          0
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "switchedOn": false,

          "when": false
        }
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent3",
        "emits": {
          "identifier": "DOM2",
          "notification": {
            "kind": "N",
            "value": "d"
          },
          "type": 0
        },
        "id": 133,
        "logType": "runtime",
        "path": [
          0,
          0,
          0,
          0
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "switchedOn": false,

          "when": false
        }
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent3",
        "emits": {
          "identifier": "DOM",
          "notification": {
            "kind": "N",
            "value": "<span>Component 3 : d</span>"
          },
          "type": 1
        },
        "id": 134,
        "logType": "runtime",
        "path": [
          0,
          0,
          0,
          0
        ]
      },
      {
        "combinatorName": "Case|Inner",
        "componentName": "App",
        "emits": {
          "identifier": "DOM",
          "notification": {
            "kind": "N",
            "value": "<div><span>Component 1 : c</span><span>Component 2 : d</span></div>"
          },
          "type": 1
        },
        "id": 135,
        "logType": "runtime",
        "path": [
          0,
          0,
          2
        ]
      },
      {
        "combinatorName": "Case",
        "componentName": "App",
        "emits": {
          "identifier": "DOM",
          "notification": {
            "kind": "N",
            "value": "<div><span>Component 1 : c</span><span>Component 2 : d</span></div>"
          },
          "type": 1
        },
        "id": 136,
        "logType": "runtime",
        "path": [
          0,
          0,
          2
        ]
      },
      {
        "combinatorName": "Combine",
        "componentName": "ROOT",
        "emits": {
          "identifier": "userAction$",
          "notification": {
            "kind": "N",
            "value": "hover"
          },
          "type": 0
        },
        "id": 137,
        "logType": "runtime",
        "path": [
          0
        ],
        "settings": {}
      },
      {
        "combinatorName": "Switch",
        "componentName": "App",
        "emits": {
          "identifier": "userAction$",
          "notification": {
            "kind": "N",
            "value": "hover"
          },
          "type": 0
        },
        "id": 138,
        "logType": "runtime",
        "path": [
          0,
          0
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ]
        }
      },
      {
        "combinatorName": "Case",
        "componentName": "App",
        "emits": {
          "identifier": "userAction$",
          "notification": {
            "kind": "N",
            "value": "hover"
          },
          "type": 0
        },
        "id": 139,
        "logType": "runtime",
        "path": [
          0,
          0,
          2
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "when": true
        }
      },
      {
        "combinatorName": "Case|Inner",
        "componentName": "App",
        "emits": {
          "identifier": "userAction$",
          "notification": {
            "kind": "N",
            "value": "hover"
          },
          "type": 0
        },
        "id": 140,
        "logType": "runtime",
        "path": [
          0,
          0,
          2
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "switchedOn": true,

          "when": true
        }
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent1",
        "emits": {
          "identifier": "userAction$",
          "notification": {
            "kind": "N",
            "value": "hover"
          },
          "type": 0
        },
        "id": 141,
        "logType": "runtime",
        "path": [
          0,
          0,
          2,
          0
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "switchedOn": true,

          "when": true
        }
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent1",
        "emits": {
          "identifier": "a",
          "notification": {
            "kind": "N",
            "value": "Component1 - user action : hover"
          },
          "type": 1
        },
        "id": 142,
        "logType": "runtime",
        "path": [
          0,
          0,
          2,
          0
        ]
      },
      {
        "combinatorName": "Case|Inner",
        "componentName": "App",
        "emits": {
          "identifier": "a",
          "notification": {
            "kind": "N",
            "value": "Component1 - user action : hover"
          },
          "type": 1
        },
        "id": 143,
        "logType": "runtime",
        "path": [
          0,
          0,
          2
        ]
      },
      {
        "combinatorName": "Case",
        "componentName": "App",
        "emits": {
          "identifier": "a",
          "notification": {
            "kind": "N",
            "value": "Component1 - user action : hover"
          },
          "type": 1
        },
        "id": 144,
        "logType": "runtime",
        "path": [
          0,
          0,
          2
        ]
      },
      {
        "combinatorName": "Switch",
        "componentName": "App",
        "emits": {
          "identifier": "a",
          "notification": {
            "kind": "N",
            "value": "Component1 - user action : hover"
          },
          "type": 1
        },
        "id": 145,
        "logType": "runtime",
        "path": [
          0,
          0
        ]
      },
      {
        "combinatorName": "Combine",
        "componentName": "ROOT",
        "emits": {
          "identifier": "a",
          "notification": {
            "kind": "N",
            "value": "Component1 - user action : hover"
          },
          "type": 1
        },
        "id": 146,
        "logType": "runtime",
        "path": [
          0
        ]
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent2",
        "emits": {
          "identifier": "userAction$",
          "notification": {
            "kind": "N",
            "value": "hover"
          },
          "type": 0
        },
        "id": 147,
        "logType": "runtime",
        "path": [
          0,
          0,
          2,
          1
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "switchedOn": true,

          "when": true
        }
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent2",
        "emits": {
          "identifier": "b",
          "notification": {
            "kind": "N",
            "value": "Component2 - user action : hover"
          },
          "type": 1
        },
        "id": 148,
        "logType": "runtime",
        "path": [
          0,
          0,
          2,
          1
        ]
      },
      {
        "combinatorName": "Case|Inner",
        "componentName": "App",
        "emits": {
          "identifier": "b",
          "notification": {
            "kind": "N",
            "value": "Component2 - user action : hover"
          },
          "type": 1
        },
        "id": 149,
        "logType": "runtime",
        "path": [
          0,
          0,
          2
        ]
      },
      {
        "combinatorName": "Case",
        "componentName": "App",
        "emits": {
          "identifier": "b",
          "notification": {
            "kind": "N",
            "value": "Component2 - user action : hover"
          },
          "type": 1
        },
        "id": 150,
        "logType": "runtime",
        "path": [
          0,
          0,
          2
        ]
      },
      {
        "combinatorName": "Switch",
        "componentName": "App",
        "emits": {
          "identifier": "b",
          "notification": {
            "kind": "N",
            "value": "Component2 - user action : hover"
          },
          "type": 1
        },
        "id": 151,
        "logType": "runtime",
        "path": [
          0,
          0
        ]
      },
      {
        "combinatorName": "Combine",
        "componentName": "ROOT",
        "emits": {
          "identifier": "b",
          "notification": {
            "kind": "N",
            "value": "Component2 - user action : hover"
          },
          "type": 1
        },
        "id": 152,
        "logType": "runtime",
        "path": [
          0
        ]
      },
      {
        "combinatorName": "Switch",
        "componentName": "App",
        "emits": {
          "identifier": "DOM",
          "notification": {
            "kind": "N",
            "value": "<div><div><span>Component 1 : c</span><span>Component 2 : d</span></div></div>"
          },
          "type": 1
        },
        "id": 153,
        "logType": "runtime",
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
            "value": "<div><div><div><span>Component 1 : c</span><span>Component 2 : d</span></div></div></div>"
          },
          "type": 1
        },
        "id": 154,
        "logType": "runtime",
        "path": [
          0
        ]
      },
      {
        "combinatorName": "Combine",
        "componentName": "ROOT",
        "emits": {
          "identifier": "sweatch$",
          "notification": {
            "kind": "N",
            "value": true
          },
          "type": 0
        },
        "id": 155,
        "logType": "runtime",
        "path": [
          0
        ],
        "settings": {}
      },
      {
        "combinatorName": "Switch",
        "componentName": "App",
        "emits": {
          "identifier": "sweatch$",
          "notification": {
            "kind": "N",
            "value": true
          },
          "type": 0
        },
        "id": 156,
        "logType": "runtime",
        "path": [
          0,
          0
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ]
        }
      },
      {
        "combinatorName": "Case",
        "componentName": "App",
        "emits": {
          "identifier": "sweatch$",
          "notification": {
            "kind": "N",
            "value": true
          },
          "type": 0
        },
        "id": 157,
        "logType": "runtime",
        "path": [
          0,
          0,
          0
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "when": false
        }
      },
      {
        "combinatorName": "Case",
        "componentName": "App",
        "emits": {
          "identifier": "sweatch$",
          "notification": {
            "kind": "N",
            "value": true
          },
          "type": 0
        },
        "id": 158,
        "logType": "runtime",
        "path": [
          0,
          0,
          1
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "when": false
        }
      },
      {
        "combinatorName": "Case",
        "componentName": "App",
        "emits": {
          "identifier": "sweatch$",
          "notification": {
            "kind": "N",
            "value": true
          },
          "type": 0
        },
        "id": 159,
        "logType": "runtime",
        "path": [
          0,
          0,
          2
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "when": true
        }
      }
    ],
    [
      {
        "combinatorName": "Case",
        "componentName": "App",
        "emits": {
          "identifier": "DOM",
          "notification": {
            "kind": "N",
            "value": null
          },
          "type": 1
        },
        "id": 160,
        "logType": "runtime",
        "path": [
          0,
          0,
          0
        ]
      },
      {
        "combinatorName": "Case",
        "componentName": "App",
        "emits": {
          "identifier": "DOM",
          "notification": {
            "kind": "N",
            "value": null
          },
          "type": 1
        },
        "id": 161,
        "logType": "runtime",
        "path": [
          0,
          0,
          1
        ]
      },
      {
        "combinatorName": "Combine",
        "componentName": "ROOT",
        "emits": {
          "identifier": "sweatch$",
          "notification": {
            "kind": "N",
            "value": true
          },
          "type": 0
        },
        "id": 162,
        "logType": "runtime",
        "path": [
          0
        ],
        "settings": {}
      },
      {
        "combinatorName": "Switch",
        "componentName": "App",
        "emits": {
          "identifier": "sweatch$",
          "notification": {
            "kind": "N",
            "value": true
          },
          "type": 0
        },
        "id": 163,
        "logType": "runtime",
        "path": [
          0,
          0
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ]
        }
      },
      {
        "combinatorName": "Case",
        "componentName": "App",
        "emits": {
          "identifier": "sweatch$",
          "notification": {
            "kind": "N",
            "value": true
          },
          "type": 0
        },
        "id": 164,
        "logType": "runtime",
        "path": [
          0,
          0,
          0
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "when": false
        }
      },
      {
        "combinatorName": "Case",
        "componentName": "App",
        "emits": {
          "identifier": "sweatch$",
          "notification": {
            "kind": "N",
            "value": true
          },
          "type": 0
        },
        "id": 165,
        "logType": "runtime",
        "path": [
          0,
          0,
          1
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "when": false
        }
      },
      {
        "combinatorName": "Case",
        "componentName": "App",
        "emits": {
          "identifier": "sweatch$",
          "notification": {
            "kind": "N",
            "value": true
          },
          "type": 0
        },
        "id": 166,
        "logType": "runtime",
        "path": [
          0,
          0,
          2
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "when": true
        }
      },
    ],
    [
      {
        "combinatorName": "Case",
        "componentName": "App",
        "emits": {
          "identifier": "DOM",
          "notification": {
            "kind": "N",
            "value": null
          },
          "type": 1
        },
        "id": 167,
        "logType": "runtime",
        "path": [
          0,
          0,
          0
        ]
      },
      {
        "combinatorName": "Case",
        "componentName": "App",
        "emits": {
          "identifier": "DOM",
          "notification": {
            "kind": "N",
            "value": null
          },
          "type": 1
        },
        "id": 168,
        "logType": "runtime",
        "path": [
          0,
          0,
          1
        ]
      },
      {
        "combinatorName": "Combine",
        "componentName": "ROOT",
        "emits": {
          "identifier": "DOM2",
          "notification": {
            "kind": "N",
            "value": "e"
          },
          "type": 0
        },
        "id": 169,
        "logType": "runtime",
        "path": [
          0
        ],
        "settings": {}
      },
      {
        "combinatorName": "Switch",
        "componentName": "App",
        "emits": {
          "identifier": "DOM2",
          "notification": {
            "kind": "N",
            "value": "e"
          },
          "type": 0
        },
        "id": 170,
        "logType": "runtime",
        "path": [
          0,
          0
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ]
        }
      },
      {
        "combinatorName": "Case",
        "componentName": "App",
        "emits": {
          "identifier": "DOM2",
          "notification": {
            "kind": "N",
            "value": "e"
          },
          "type": 0
        },
        "id": 171,
        "logType": "runtime",
        "path": [
          0,
          0,
          2
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "when": true
        }
      },
      {
        "combinatorName": "Case|Inner",
        "componentName": "App",
        "emits": {
          "identifier": "DOM2",
          "notification": {
            "kind": "N",
            "value": "e"
          },
          "type": 0
        },
        "id": 172,
        "logType": "runtime",
        "path": [
          0,
          0,
          2
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "switchedOn": true,

          "when": true
        }
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent2",
        "emits": {
          "identifier": "DOM2",
          "notification": {
            "kind": "N",
            "value": "e"
          },
          "type": 0
        },
        "id": 173,
        "logType": "runtime",
        "path": [
          0,
          0,
          2,
          1
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "switchedOn": true,

          "when": true
        }
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent2",
        "emits": {
          "identifier": "DOM",
          "notification": {
            "kind": "N",
            "value": "<span>Component 2 : e</span>"
          },
          "type": 1
        },
        "id": 174,
        "logType": "runtime",
        "path": [
          0,
          0,
          2,
          1
        ]
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent2",
        "emits": {
          "identifier": "DOM",
          "notification": {
            "error": undefined,
            "kind": "C"
          },
          "type": 1
        },
        "id": 175,
        "logType": "runtime",
        "path": [
          0,
          0,
          2,
          1
        ]
      },
      {
        "combinatorName": "Case|Inner",
        "componentName": "App",
        "emits": {
          "identifier": "DOM2",
          "notification": {
            "kind": "N",
            "value": "e"
          },
          "type": 0
        },
        "id": 176,
        "logType": "runtime",
        "path": [
          0,
          0,
          2
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "switchedOn": true,

          "when": true
        }
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent2",
        "emits": {
          "identifier": "DOM2",
          "notification": {
            "kind": "N",
            "value": "e"
          },
          "type": 0
        },
        "id": 177,
        "logType": "runtime",
        "path": [
          0,
          0,
          2,
          1
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "switchedOn": true,

          "when": true
        }
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent2",
        "emits": {
          "identifier": "DOM",
          "notification": {
            "kind": "N",
            "value": "<span>Component 2 : e</span>"
          },
          "type": 1
        },
        "id": 178,
        "logType": "runtime",
        "path": [
          0,
          0,
          2,
          1
        ]
      },
      {
        "combinatorName": "Case|Inner",
        "componentName": "App",
        "emits": {
          "identifier": "DOM2",
          "notification": {
            "kind": "N",
            "value": "e"
          },
          "type": 0
        },
        "id": 179,
        "logType": "runtime",
        "path": [
          0,
          0,
          2
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "switchedOn": true,

          "when": true
        }
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent2",
        "emits": {
          "identifier": "DOM2",
          "notification": {
            "kind": "N",
            "value": "e"
          },
          "type": 0
        },
        "id": 180,
        "logType": "runtime",
        "path": [
          0,
          0,
          2,
          1
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "switchedOn": true,

          "when": true
        }
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent2",
        "emits": {
          "identifier": "DOM",
          "notification": {
            "kind": "N",
            "value": "<span>Component 2 : e</span>"
          },
          "type": 1
        },
        "id": 181,
        "logType": "runtime",
        "path": [
          0,
          0,
          2,
          1
        ]
      },
      {
        "combinatorName": "Case|Inner",
        "componentName": "App",
        "emits": {
          "identifier": "DOM2",
          "notification": {
            "kind": "N",
            "value": "e"
          },
          "type": 0
        },
        "id": 182,
        "logType": "runtime",
        "path": [
          0,
          0,
          2
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "switchedOn": true,

          "when": true
        }
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent2",
        "emits": {
          "identifier": "DOM2",
          "notification": {
            "kind": "N",
            "value": "e"
          },
          "type": 0
        },
        "id": 183,
        "logType": "runtime",
        "path": [
          0,
          0,
          2,
          1
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "switchedOn": true,

          "when": true
        }
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent2",
        "emits": {
          "identifier": "DOM",
          "notification": {
            "kind": "N",
            "value": "<span>Component 2 : e</span>"
          },
          "type": 1
        },
        "id": 184,
        "logType": "runtime",
        "path": [
          0,
          0,
          2,
          1
        ]
      },
      {
        "combinatorName": "Case|Inner",
        "componentName": "App",
        "emits": {
          "identifier": "DOM2",
          "notification": {
            "kind": "N",
            "value": "e"
          },
          "type": 0
        },
        "id": 185,
        "logType": "runtime",
        "path": [
          0,
          0,
          2
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "switchedOn": true,

          "when": true
        }
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent2",
        "emits": {
          "identifier": "DOM2",
          "notification": {
            "kind": "N",
            "value": "e"
          },
          "type": 0
        },
        "id": 186,
        "logType": "runtime",
        "path": [
          0,
          0,
          2,
          1
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "switchedOn": true,

          "when": true
        }
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent2",
        "emits": {
          "identifier": "DOM",
          "notification": {
            "kind": "N",
            "value": "<span>Component 2 : e</span>"
          },
          "type": 1
        },
        "id": 187,
        "logType": "runtime",
        "path": [
          0,
          0,
          2,
          1
        ]
      },
      {
        "combinatorName": "Case",
        "componentName": "App",
        "emits": {
          "identifier": "DOM2",
          "notification": {
            "kind": "N",
            "value": "e"
          },
          "type": 0
        },
        "id": 188,
        "logType": "runtime",
        "path": [
          0,
          0,
          0
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "when": false
        }
      },
      {
        "combinatorName": "Case|Inner",
        "componentName": "App",
        "emits": {
          "identifier": "DOM2",
          "notification": {
            "kind": "N",
            "value": "e"
          },
          "type": 0
        },
        "id": 189,
        "logType": "runtime",
        "path": [
          0,
          0,
          0
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "switchedOn": false,

          "when": false
        }
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent3",
        "emits": {
          "identifier": "DOM2",
          "notification": {
            "kind": "N",
            "value": "e"
          },
          "type": 0
        },
        "id": 190,
        "logType": "runtime",
        "path": [
          0,
          0,
          0,
          0
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "switchedOn": false,

          "when": false
        }
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent3",
        "emits": {
          "identifier": "DOM",
          "notification": {
            "kind": "N",
            "value": "<span>Component 3 : e</span>"
          },
          "type": 1
        },
        "id": 191,
        "logType": "runtime",
        "path": [
          0,
          0,
          0,
          0
        ]
      },
      {
        "combinatorName": "Combine",
        "componentName": "ROOT",
        "emits": {
          "identifier": "sweatch$",
          "notification": {
            "kind": "N",
            "value": true
          },
          "type": 0
        },
        "id": 192,
        "logType": "runtime",
        "path": [
          0
        ],
        "settings": {}
      },
      {
        "combinatorName": "Switch",
        "componentName": "App",
        "emits": {
          "identifier": "sweatch$",
          "notification": {
            "kind": "N",
            "value": true
          },
          "type": 0
        },
        "id": 193,
        "logType": "runtime",
        "path": [
          0,
          0
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ]
        }
      },
      {
        "combinatorName": "Case",
        "componentName": "App",
        "emits": {
          "identifier": "sweatch$",
          "notification": {
            "kind": "N",
            "value": true
          },
          "type": 0
        },
        "id": 194,
        "logType": "runtime",
        "path": [
          0,
          0,
          0
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "when": false
        }
      },
      {
        "combinatorName": "Case",
        "componentName": "App",
        "emits": {
          "identifier": "sweatch$",
          "notification": {
            "kind": "N",
            "value": true
          },
          "type": 0
        },
        "id": 195,
        "logType": "runtime",
        "path": [
          0,
          0,
          1
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "when": false
        }
      },
      {
        "combinatorName": "Case",
        "componentName": "App",
        "emits": {
          "identifier": "sweatch$",
          "notification": {
            "kind": "N",
            "value": true
          },
          "type": 0
        },
        "id": 196,
        "logType": "runtime",
        "path": [
          0,
          0,
          2
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "when": true
        }
      },
    ],
    [
      {
        "combinatorName": "Case",
        "componentName": "App",
        "emits": {
          "identifier": "DOM",
          "notification": {
            "kind": "N",
            "value": null
          },
          "type": 1
        },
        "id": 197,
        "logType": "runtime",
        "path": [
          0,
          0,
          0
        ]
      },
      {
        "combinatorName": "Case",
        "componentName": "App",
        "emits": {
          "identifier": "DOM",
          "notification": {
            "kind": "N",
            "value": null
          },
          "type": 1
        },
        "id": 198,
        "logType": "runtime",
        "path": [
          0,
          0,
          1
        ]
      },
      {
        "combinatorName": "Combine",
        "componentName": "ROOT",
        "emits": {
          "identifier": "DOM1",
          "notification": {
            "kind": "N",
            "value": "d"
          },
          "type": 0
        },
        "id": 199,
        "logType": "runtime",
        "path": [
          0
        ],
        "settings": {}
      },
      {
        "combinatorName": "Switch",
        "componentName": "App",
        "emits": {
          "identifier": "DOM1",
          "notification": {
            "kind": "N",
            "value": "d"
          },
          "type": 0
        },
        "id": 200,
        "logType": "runtime",
        "path": [
          0,
          0
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ]
        }
      },
      {
        "combinatorName": "Case",
        "componentName": "App",
        "emits": {
          "identifier": "DOM1",
          "notification": {
            "kind": "N",
            "value": "d"
          },
          "type": 0
        },
        "id": 201,
        "logType": "runtime",
        "path": [
          0,
          0,
          2
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "when": true
        }
      },
      {
        "combinatorName": "Case|Inner",
        "componentName": "App",
        "emits": {
          "identifier": "DOM1",
          "notification": {
            "kind": "N",
            "value": "d"
          },
          "type": 0
        },
        "id": 202,
        "logType": "runtime",
        "path": [
          0,
          0,
          2
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "switchedOn": true,

          "when": true
        }
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent1",
        "emits": {
          "identifier": "DOM1",
          "notification": {
            "kind": "N",
            "value": "d"
          },
          "type": 0
        },
        "id": 203,
        "logType": "runtime",
        "path": [
          0,
          0,
          2,
          0
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "switchedOn": true,

          "when": true
        }
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent1",
        "emits": {
          "identifier": "DOM",
          "notification": {
            "kind": "N",
            "value": "<span>Component 1 : d</span>"
          },
          "type": 1
        },
        "id": 204,
        "logType": "runtime",
        "path": [
          0,
          0,
          2,
          0
        ]
      },
      {
        "combinatorName": "Case|Inner",
        "componentName": "App",
        "emits": {
          "identifier": "DOM1",
          "notification": {
            "kind": "N",
            "value": "d"
          },
          "type": 0
        },
        "id": 205,
        "logType": "runtime",
        "path": [
          0,
          0,
          2
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "switchedOn": true,

          "when": true
        }
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent1",
        "emits": {
          "identifier": "DOM1",
          "notification": {
            "kind": "N",
            "value": "d"
          },
          "type": 0
        },
        "id": 206,
        "logType": "runtime",
        "path": [
          0,
          0,
          2,
          0
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "switchedOn": true,

          "when": true
        }
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent1",
        "emits": {
          "identifier": "DOM",
          "notification": {
            "kind": "N",
            "value": "<span>Component 1 : d</span>"
          },
          "type": 1
        },
        "id": 207,
        "logType": "runtime",
        "path": [
          0,
          0,
          2,
          0
        ]
      },
      {
        "combinatorName": "Case|Inner",
        "componentName": "App",
        "emits": {
          "identifier": "DOM1",
          "notification": {
            "kind": "N",
            "value": "d"
          },
          "type": 0
        },
        "id": 208,
        "logType": "runtime",
        "path": [
          0,
          0,
          2
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "switchedOn": true,

          "when": true
        }
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent1",
        "emits": {
          "identifier": "DOM1",
          "notification": {
            "kind": "N",
            "value": "d"
          },
          "type": 0
        },
        "id": 209,
        "logType": "runtime",
        "path": [
          0,
          0,
          2,
          0
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "switchedOn": true,

          "when": true
        }
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent1",
        "emits": {
          "identifier": "DOM",
          "notification": {
            "kind": "N",
            "value": "<span>Component 1 : d</span>"
          },
          "type": 1
        },
        "id": 210,
        "logType": "runtime",
        "path": [
          0,
          0,
          2,
          0
        ]
      },
      {
        "combinatorName": "Case|Inner",
        "componentName": "App",
        "emits": {
          "identifier": "DOM1",
          "notification": {
            "kind": "N",
            "value": "d"
          },
          "type": 0
        },
        "id": 211,
        "logType": "runtime",
        "path": [
          0,
          0,
          2
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "switchedOn": true,

          "when": true
        }
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent1",
        "emits": {
          "identifier": "DOM1",
          "notification": {
            "kind": "N",
            "value": "d"
          },
          "type": 0
        },
        "id": 212,
        "logType": "runtime",
        "path": [
          0,
          0,
          2,
          0
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "switchedOn": true,

          "when": true
        }
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent1",
        "emits": {
          "identifier": "DOM",
          "notification": {
            "kind": "N",
            "value": "<span>Component 1 : d</span>"
          },
          "type": 1
        },
        "id": 213,
        "logType": "runtime",
        "path": [
          0,
          0,
          2,
          0
        ]
      },
      {
        "combinatorName": "Case|Inner",
        "componentName": "App",
        "emits": {
          "identifier": "DOM1",
          "notification": {
            "kind": "N",
            "value": "d"
          },
          "type": 0
        },
        "id": 214,
        "logType": "runtime",
        "path": [
          0,
          0,
          2
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "switchedOn": true,

          "when": true
        }
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent1",
        "emits": {
          "identifier": "DOM1",
          "notification": {
            "kind": "N",
            "value": "d"
          },
          "type": 0
        },
        "id": 215,
        "logType": "runtime",
        "path": [
          0,
          0,
          2,
          0
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "switchedOn": true,

          "when": true
        }
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent1",
        "emits": {
          "identifier": "DOM",
          "notification": {
            "kind": "N",
            "value": "<span>Component 1 : d</span>"
          },
          "type": 1
        },
        "id": 216,
        "logType": "runtime",
        "path": [
          0,
          0,
          2,
          0
        ]
      },
      {
        "combinatorName": "Case|Inner",
        "componentName": "App",
        "emits": {
          "identifier": "DOM1",
          "notification": {
            "kind": "N",
            "value": "d"
          },
          "type": 0
        },
        "id": 217,
        "logType": "runtime",
        "path": [
          0,
          0,
          2
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "switchedOn": true,

          "when": true
        }
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent1",
        "emits": {
          "identifier": "DOM1",
          "notification": {
            "kind": "N",
            "value": "d"
          },
          "type": 0
        },
        "id": 218,
        "logType": "runtime",
        "path": [
          0,
          0,
          2,
          0
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "switchedOn": true,

          "when": true
        }
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent1",
        "emits": {
          "identifier": "DOM",
          "notification": {
            "kind": "N",
            "value": "<span>Component 1 : d</span>"
          },
          "type": 1
        },
        "id": 219,
        "logType": "runtime",
        "path": [
          0,
          0,
          2,
          0
        ]
      },
      {
        "combinatorName": "Combine",
        "componentName": "ROOT",
        "emits": {
          "identifier": "userAction$",
          "notification": {
            "kind": "N",
            "value": "click"
          },
          "type": 0
        },
        "id": 220,
        "logType": "runtime",
        "path": [
          0
        ],
        "settings": {}
      },
      {
        "combinatorName": "Switch",
        "componentName": "App",
        "emits": {
          "identifier": "userAction$",
          "notification": {
            "kind": "N",
            "value": "click"
          },
          "type": 0
        },
        "id": 221,
        "logType": "runtime",
        "path": [
          0,
          0
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ]
        }
      },
      {
        "combinatorName": "Case",
        "componentName": "App",
        "emits": {
          "identifier": "userAction$",
          "notification": {
            "kind": "N",
            "value": "click"
          },
          "type": 0
        },
        "id": 222,
        "logType": "runtime",
        "path": [
          0,
          0,
          2
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "when": true
        }
      },
      {
        "combinatorName": "Case|Inner",
        "componentName": "App",
        "emits": {
          "identifier": "userAction$",
          "notification": {
            "kind": "N",
            "value": "click"
          },
          "type": 0
        },
        "id": 223,
        "logType": "runtime",
        "path": [
          0,
          0,
          2
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "switchedOn": true,

          "when": true
        }
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent1",
        "emits": {
          "identifier": "userAction$",
          "notification": {
            "kind": "N",
            "value": "click"
          },
          "type": 0
        },
        "id": 224,
        "logType": "runtime",
        "path": [
          0,
          0,
          2,
          0
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "switchedOn": true,

          "when": true
        }
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent1",
        "emits": {
          "identifier": "a",
          "notification": {
            "kind": "N",
            "value": "Component1 - user action : click"
          },
          "type": 1
        },
        "id": 225,
        "logType": "runtime",
        "path": [
          0,
          0,
          2,
          0
        ]
      },
      {
        "combinatorName": "Case|Inner",
        "componentName": "App",
        "emits": {
          "identifier": "a",
          "notification": {
            "kind": "N",
            "value": "Component1 - user action : click"
          },
          "type": 1
        },
        "id": 226,
        "logType": "runtime",
        "path": [
          0,
          0,
          2
        ]
      },
      {
        "combinatorName": "Case",
        "componentName": "App",
        "emits": {
          "identifier": "a",
          "notification": {
            "kind": "N",
            "value": "Component1 - user action : click"
          },
          "type": 1
        },
        "id": 227,
        "logType": "runtime",
        "path": [
          0,
          0,
          2
        ]
      },
      {
        "combinatorName": "Switch",
        "componentName": "App",
        "emits": {
          "identifier": "a",
          "notification": {
            "kind": "N",
            "value": "Component1 - user action : click"
          },
          "type": 1
        },
        "id": 228,
        "logType": "runtime",
        "path": [
          0,
          0
        ]
      },
      {
        "combinatorName": "Combine",
        "componentName": "ROOT",
        "emits": {
          "identifier": "a",
          "notification": {
            "kind": "N",
            "value": "Component1 - user action : click"
          },
          "type": 1
        },
        "id": 229,
        "logType": "runtime",
        "path": [
          0
        ]
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent2",
        "emits": {
          "identifier": "userAction$",
          "notification": {
            "kind": "N",
            "value": "click"
          },
          "type": 0
        },
        "id": 230,
        "logType": "runtime",
        "path": [
          0,
          0,
          2,
          1
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "switchedOn": true,

          "when": true
        }
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent2",
        "emits": {
          "identifier": "b",
          "notification": {
            "kind": "N",
            "value": "Component2 - user action : click"
          },
          "type": 1
        },
        "id": 231,
        "logType": "runtime",
        "path": [
          0,
          0,
          2,
          1
        ]
      },
      {
        "combinatorName": "Case|Inner",
        "componentName": "App",
        "emits": {
          "identifier": "b",
          "notification": {
            "kind": "N",
            "value": "Component2 - user action : click"
          },
          "type": 1
        },
        "id": 232,
        "logType": "runtime",
        "path": [
          0,
          0,
          2
        ]
      },
      {
        "combinatorName": "Case",
        "componentName": "App",
        "emits": {
          "identifier": "b",
          "notification": {
            "kind": "N",
            "value": "Component2 - user action : click"
          },
          "type": 1
        },
        "id": 233,
        "logType": "runtime",
        "path": [
          0,
          0,
          2
        ]
      },
      {
        "combinatorName": "Switch",
        "componentName": "App",
        "emits": {
          "identifier": "b",
          "notification": {
            "kind": "N",
            "value": "Component2 - user action : click"
          },
          "type": 1
        },
        "id": 234,
        "logType": "runtime",
        "path": [
          0,
          0
        ]
      },
      {
        "combinatorName": "Combine",
        "componentName": "ROOT",
        "emits": {
          "identifier": "b",
          "notification": {
            "kind": "N",
            "value": "Component2 - user action : click"
          },
          "type": 1
        },
        "id": 235,
        "logType": "runtime",
        "path": [
          0
        ]
      },
      {
        "combinatorName": "Combine",
        "componentName": "ROOT",
        "emits": {
          "identifier": "sweatch$",
          "notification": {
            "kind": "N",
            "value": false
          },
          "type": 0
        },
        "id": 236,
        "logType": "runtime",
        "path": [
          0
        ],
        "settings": {}
      },
      {
        "combinatorName": "Switch",
        "componentName": "App",
        "emits": {
          "identifier": "sweatch$",
          "notification": {
            "kind": "N",
            "value": false
          },
          "type": 0
        },
        "id": 237,
        "logType": "runtime",
        "path": [
          0,
          0
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ]
        }
      },
      {
        "combinatorName": "Case",
        "componentName": "App",
        "emits": {
          "identifier": "sweatch$",
          "notification": {
            "kind": "N",
            "value": false
          },
          "type": 0
        },
        "id": 238,
        "logType": "runtime",
        "path": [
          0,
          0,
          0
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "when": false
        }
      },
    ],
    [
      {
        "combinatorName": "Case",
        "componentName": "App",
        "emits": {
          "identifier": "sweatch$",
          "notification": {
            "kind": "N",
            "value": false
          },
          "type": 0
        },
        "id": 239,
        "logType": "runtime",
        "path": [
          0,
          0,
          1
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "when": false
        }
      },
    ],
    [
  {
    "combinatorName": "Case",
    "componentName": "App",
    "emits": {
      "identifier": "sweatch$",
      "notification": {
        "kind": "N",
        "value": false
      },
      "type": 0
    },
    "id": 240,
    "logType": "runtime",
    "path": [
      0,
      0,
      2
    ],
    "settings": {
      "as": "switchedOn",
      "on": "sweatch$",
      "sinkNames": [
        "DOM",
        "a",
        "b",
        "c"
      ],
      "when": true
    }
  },
  {
    "combinatorName": "Case",
    "componentName": "App",
    "emits": {
      "identifier": "DOM",
      "notification": {
        "kind": "N",
        "value": null
      },
      "type": 1
    },
    "id": 241,
    "logType": "runtime",
    "path": [
      0,
      0,
      2
    ]
  },
  {
    "combinatorName": "Switch",
    "componentName": "App",
    "emits": {
      "identifier": "DOM",
      "notification": {
        "kind": "N",
        "value": "<div></div>"
      },
      "type": 1
    },
    "id": 242,
    "logType": "runtime",
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
        "value": "<div><div></div></div>"
      },
      "type": 1
    },
    "id": 243,
    "logType": "runtime",
    "path": [
      0
    ]
  },
  {
    "combinatorName": "Combine",
    "componentName": "ROOT",
    "emits": {
      "identifier": "DOM2",
      "notification": {
        "kind": "N",
        "value": "f"
      },
      "type": 0
    },
    "id": 244,
    "logType": "runtime",
    "path": [
      0
    ],
    "settings": {}
  },
  {
    "combinatorName": "Switch",
    "componentName": "App",
    "emits": {
      "identifier": "DOM2",
      "notification": {
        "kind": "N",
        "value": "f"
      },
      "type": 0
    },
    "id": 245,
    "logType": "runtime",
    "path": [
      0,
      0
    ],
    "settings": {
      "as": "switchedOn",
      "on": "sweatch$",
      "sinkNames": [
        "DOM",
        "a",
        "b",
        "c"
      ]
    }
  },
  {
    "combinatorName": "Case",
    "componentName": "App",
    "emits": {
      "identifier": "DOM2",
      "notification": {
        "kind": "N",
        "value": "f"
      },
      "type": 0
    },
    "id": 246,
    "logType": "runtime",
    "path": [
      0,
      0,
      2
    ],
    "settings": {
      "as": "switchedOn",
      "on": "sweatch$",
      "sinkNames": [
        "DOM",
        "a",
        "b",
        "c"
      ],
      "when": true
    }
  },
  {
    "combinatorName": "Case|Inner",
    "componentName": "App",
    "emits": {
      "identifier": "DOM2",
      "notification": {
        "kind": "N",
        "value": "f"
      },
      "type": 0
    },
    "id": 247,
    "logType": "runtime",
    "path": [
      0,
      0,
      2
    ],
    "settings": {
      "as": "switchedOn",
      "on": "sweatch$",
      "sinkNames": [
        "DOM",
        "a",
        "b",
        "c"
      ],
      "switchedOn": true,

      "when": true
    }
  },
  {
    "combinatorName": undefined,
    "componentName": "childComponent2",
    "emits": {
      "identifier": "DOM2",
      "notification": {
        "kind": "N",
        "value": "f"
      },
      "type": 0
    },
    "id": 248,
    "logType": "runtime",
    "path": [
      0,
      0,
      2,
      1
    ],
    "settings": {
      "as": "switchedOn",
      "on": "sweatch$",
      "sinkNames": [
        "DOM",
        "a",
        "b",
        "c"
      ],
      "switchedOn": true,

      "when": true
    }
  },
  {
    "combinatorName": undefined,
    "componentName": "childComponent2",
    "emits": {
      "identifier": "DOM",
      "notification": {
        "kind": "N",
        "value": "<span>Component 2 : f</span>"
      },
      "type": 1
    },
    "id": 249,
    "logType": "runtime",
    "path": [
      0,
      0,
      2,
      1
    ]
  },
  {
    "combinatorName": "Case|Inner",
    "componentName": "App",
    "emits": {
      "identifier": "DOM2",
      "notification": {
        "kind": "N",
        "value": "f"
      },
      "type": 0
    },
    "id": 250,
    "logType": "runtime",
    "path": [
      0,
      0,
      2
    ],
    "settings": {
      "as": "switchedOn",
      "on": "sweatch$",
      "sinkNames": [
        "DOM",
        "a",
        "b",
        "c"
      ],
      "switchedOn": true,

      "when": true
    }
  },
  {
    "combinatorName": undefined,
    "componentName": "childComponent2",
    "emits": {
      "identifier": "DOM2",
      "notification": {
        "kind": "N",
        "value": "f"
      },
      "type": 0
    },
    "id": 251,
    "logType": "runtime",
    "path": [
      0,
      0,
      2,
      1
    ],
    "settings": {
      "as": "switchedOn",
      "on": "sweatch$",
      "sinkNames": [
        "DOM",
        "a",
        "b",
        "c"
      ],
      "switchedOn": true,

      "when": true
    }
  },
  {
    "combinatorName": undefined,
    "componentName": "childComponent2",
    "emits": {
      "identifier": "DOM",
      "notification": {
        "kind": "N",
        "value": "<span>Component 2 : f</span>"
      },
      "type": 1
    },
    "id": 252,
    "logType": "runtime",
    "path": [
      0,
      0,
      2,
      1
    ]
  },
  {
    "combinatorName": "Case|Inner",
    "componentName": "App",
    "emits": {
      "identifier": "DOM2",
      "notification": {
        "kind": "N",
        "value": "f"
      },
      "type": 0
    },
    "id": 253,
    "logType": "runtime",
    "path": [
      0,
      0,
      2
    ],
    "settings": {
      "as": "switchedOn",
      "on": "sweatch$",
      "sinkNames": [
        "DOM",
        "a",
        "b",
        "c"
      ],
      "switchedOn": true,

      "when": true
    }
  },
  {
    "combinatorName": undefined,
    "componentName": "childComponent2",
    "emits": {
      "identifier": "DOM2",
      "notification": {
        "kind": "N",
        "value": "f"
      },
      "type": 0
    },
    "id": 254,
    "logType": "runtime",
    "path": [
      0,
      0,
      2,
      1
    ],
    "settings": {
      "as": "switchedOn",
      "on": "sweatch$",
      "sinkNames": [
        "DOM",
        "a",
        "b",
        "c"
      ],
      "switchedOn": true,

      "when": true
    }
  },
  {
    "combinatorName": undefined,
    "componentName": "childComponent2",
    "emits": {
      "identifier": "DOM",
      "notification": {
        "kind": "N",
        "value": "<span>Component 2 : f</span>"
      },
      "type": 1
    },
    "id": 255,
    "logType": "runtime",
    "path": [
      0,
      0,
      2,
      1
    ]
  },
  {
    "combinatorName": "Case|Inner",
    "componentName": "App",
    "emits": {
      "identifier": "DOM2",
      "notification": {
        "kind": "N",
        "value": "f"
      },
      "type": 0
    },
    "id": 256,
    "logType": "runtime",
    "path": [
      0,
      0,
      2
    ],
    "settings": {
      "as": "switchedOn",
      "on": "sweatch$",
      "sinkNames": [
        "DOM",
        "a",
        "b",
        "c"
      ],
      "switchedOn": true,

      "when": true
    }
  },
  {
    "combinatorName": undefined,
    "componentName": "childComponent2",
    "emits": {
      "identifier": "DOM2",
      "notification": {
        "kind": "N",
        "value": "f"
      },
      "type": 0
    },
    "id": 257,
    "logType": "runtime",
    "path": [
      0,
      0,
      2,
      1
    ],
    "settings": {
      "as": "switchedOn",
      "on": "sweatch$",
      "sinkNames": [
        "DOM",
        "a",
        "b",
        "c"
      ],
      "switchedOn": true,

      "when": true
    }
  },
  {
    "combinatorName": undefined,
    "componentName": "childComponent2",
    "emits": {
      "identifier": "DOM",
      "notification": {
        "kind": "N",
        "value": "<span>Component 2 : f</span>"
      },
      "type": 1
    },
    "id": 258,
    "logType": "runtime",
    "path": [
      0,
      0,
      2,
      1
    ]
  },
  {
    "combinatorName": "Case|Inner",
    "componentName": "App",
    "emits": {
      "identifier": "DOM2",
      "notification": {
        "kind": "N",
        "value": "f"
      },
      "type": 0
    },
    "id": 259,
    "logType": "runtime",
    "path": [
      0,
      0,
      2
    ],
    "settings": {
      "as": "switchedOn",
      "on": "sweatch$",
      "sinkNames": [
        "DOM",
        "a",
        "b",
        "c"
      ],
      "switchedOn": true,

      "when": true
    }
  },
  {
    "combinatorName": undefined,
    "componentName": "childComponent2",
    "emits": {
      "identifier": "DOM2",
      "notification": {
        "kind": "N",
        "value": "f"
      },
      "type": 0
    },
    "id": 260,
    "logType": "runtime",
    "path": [
      0,
      0,
      2,
      1
    ],
    "settings": {
      "as": "switchedOn",
      "on": "sweatch$",
      "sinkNames": [
        "DOM",
        "a",
        "b",
        "c"
      ],
      "switchedOn": true,

      "when": true
    }
  },
  {
    "combinatorName": undefined,
    "componentName": "childComponent2",
    "emits": {
      "identifier": "DOM",
      "notification": {
        "kind": "N",
        "value": "<span>Component 2 : f</span>"
      },
      "type": 1
    },
    "id": 261,
    "logType": "runtime",
    "path": [
      0,
      0,
      2,
      1
    ]
  },
  {
    "combinatorName": "Case",
    "componentName": "App",
    "emits": {
      "identifier": "DOM2",
      "notification": {
        "kind": "N",
        "value": "f"
      },
      "type": 0
    },
    "id": 262,
    "logType": "runtime",
    "path": [
      0,
      0,
      0
    ],
    "settings": {
      "as": "switchedOn",
      "on": "sweatch$",
      "sinkNames": [
        "DOM",
        "a",
        "b",
        "c"
      ],
      "when": false
    }
  },
  {
    "combinatorName": "Case|Inner",
    "componentName": "App",
    "emits": {
      "identifier": "DOM2",
      "notification": {
        "kind": "N",
        "value": "f"
      },
      "type": 0
    },
    "id": 263,
    "logType": "runtime",
    "path": [
      0,
      0,
      0
    ],
    "settings": {
      "as": "switchedOn",
      "on": "sweatch$",
      "sinkNames": [
        "DOM",
        "a",
        "b",
        "c"
      ],
      "switchedOn": false,

      "when": false
    }
  },
  {
    "combinatorName": undefined,
    "componentName": "childComponent3",
    "emits": {
      "identifier": "DOM2",
      "notification": {
        "kind": "N",
        "value": "f"
      },
      "type": 0
    },
    "id": 264,
    "logType": "runtime",
    "path": [
      0,
      0,
      0,
      0
    ],
    "settings": {
      "as": "switchedOn",
      "on": "sweatch$",
      "sinkNames": [
        "DOM",
        "a",
        "b",
        "c"
      ],
      "switchedOn": false,

      "when": false
    }
  },
  {
    "combinatorName": undefined,
    "componentName": "childComponent3",
    "emits": {
      "identifier": "DOM",
      "notification": {
        "kind": "N",
        "value": "<span>Component 3 : f</span>"
      },
      "type": 1
    },
    "id": 265,
    "logType": "runtime",
    "path": [
      0,
      0,
      0,
      0
    ]
  },
  {
    "combinatorName": undefined,
    "componentName": "childComponent3",
    "emits": {
      "identifier": "DOM",
      "notification": {
        "error": undefined,
        "kind": "C"
      },
      "type": 1
    },
    "id": 266,
    "logType": "runtime",
    "path": [
      0,
      0,
      0,
      0
    ]
  },
  {
    "combinatorName": "Case|Inner",
    "componentName": "App",
    "emits": {
      "identifier": "DOM2",
      "notification": {
        "kind": "N",
        "value": "f"
      },
      "type": 0
    },
    "id": 267,
    "logType": "runtime",
    "path": [
      0,
      0,
      0
    ],
    "settings": {
      "as": "switchedOn",
      "on": "sweatch$",
      "sinkNames": [
        "DOM",
        "a",
        "b",
        "c"
      ],
      "switchedOn": false,

      "when": false
    }
  },
  {
    "combinatorName": undefined,
    "componentName": "childComponent3",
    "emits": {
      "identifier": "DOM2",
      "notification": {
        "kind": "N",
        "value": "f"
      },
      "type": 0
    },
    "id": 268,
    "logType": "runtime",
    "path": [
      0,
      0,
      0,
      0
    ],
    "settings": {
      "as": "switchedOn",
      "on": "sweatch$",
      "sinkNames": [
        "DOM",
        "a",
        "b",
        "c"
      ],
      "switchedOn": false,

      "when": false
    }
  },
  {
    "combinatorName": undefined,
    "componentName": "childComponent3",
    "emits": {
      "identifier": "DOM",
      "notification": {
        "kind": "N",
        "value": "<span>Component 3 : f</span>"
      },
      "type": 1
    },
    "id": 269,
    "logType": "runtime",
    "path": [
      0,
      0,
      0,
      0
    ]
  },
  {
    "combinatorName": "Case|Inner",
    "componentName": "App",
    "emits": {
      "identifier": "DOM",
      "notification": {
        "kind": "N",
        "value": "<div><span>Component 3 : f</span></div>"
      },
      "type": 1
    },
    "id": 270,
    "logType": "runtime",
    "path": [
      0,
      0,
      0
    ]
  },
  {
    "combinatorName": "Case",
    "componentName": "App",
    "emits": {
      "identifier": "DOM",
      "notification": {
        "kind": "N",
        "value": "<div><span>Component 3 : f</span></div>"
      },
      "type": 1
    },
    "id": 271,
    "logType": "runtime",
    "path": [
      0,
      0,
      0
    ]
  },
  {
    "combinatorName": "Combine",
    "componentName": "ROOT",
    "emits": {
      "identifier": "userAction$",
      "notification": {
        "kind": "N",
        "value": "select"
      },
      "type": 0
    },
    "id": 272,
    "logType": "runtime",
    "path": [
      0
    ],
    "settings": {}
  },
  {
    "combinatorName": "Switch",
    "componentName": "App",
    "emits": {
      "identifier": "userAction$",
      "notification": {
        "kind": "N",
        "value": "select"
      },
      "type": 0
    },
    "id": 273,
    "logType": "runtime",
    "path": [
      0,
      0
    ],
    "settings": {
      "as": "switchedOn",
      "on": "sweatch$",
      "sinkNames": [
        "DOM",
        "a",
        "b",
        "c"
      ]
    }
  },
  {
    "combinatorName": "Case",
    "componentName": "App",
    "emits": {
      "identifier": "userAction$",
      "notification": {
        "kind": "N",
        "value": "select"
      },
      "type": 0
    },
    "id": 274,
    "logType": "runtime",
    "path": [
      0,
      0,
      0
    ],
    "settings": {
      "as": "switchedOn",
      "on": "sweatch$",
      "sinkNames": [
        "DOM",
        "a",
        "b",
        "c"
      ],
      "when": false
    }
  },
  {
    "combinatorName": "Case|Inner",
    "componentName": "App",
    "emits": {
      "identifier": "userAction$",
      "notification": {
        "kind": "N",
        "value": "select"
      },
      "type": 0
    },
    "id": 275,
    "logType": "runtime",
    "path": [
      0,
      0,
      0
    ],
    "settings": {
      "as": "switchedOn",
      "on": "sweatch$",
      "sinkNames": [
        "DOM",
        "a",
        "b",
        "c"
      ],
      "switchedOn": false,

      "when": false
    }
  },
  {
    "combinatorName": undefined,
    "componentName": "childComponent3",
    "emits": {
      "identifier": "userAction$",
      "notification": {
        "kind": "N",
        "value": "select"
      },
      "type": 0
    },
    "id": 276,
    "logType": "runtime",
    "path": [
      0,
      0,
      0,
      0
    ],
    "settings": {
      "as": "switchedOn",
      "on": "sweatch$",
      "sinkNames": [
        "DOM",
        "a",
        "b",
        "c"
      ],
      "switchedOn": false,

      "when": false
    }
  },
  {
    "combinatorName": undefined,
    "componentName": "childComponent3",
    "emits": {
      "identifier": "b",
      "notification": {
        "kind": "N",
        "value": "Component3 - user action : select"
      },
      "type": 1
    },
    "id": 277,
    "logType": "runtime",
    "path": [
      0,
      0,
      0,
      0
    ]
  },
  {
    "combinatorName": "Case|Inner",
    "componentName": "App",
    "emits": {
      "identifier": "b",
      "notification": {
        "kind": "N",
        "value": "Component3 - user action : select"
      },
      "type": 1
    },
    "id": 278,
    "logType": "runtime",
    "path": [
      0,
      0,
      0
    ]
  },
  {
    "combinatorName": "Case",
    "componentName": "App",
    "emits": {
      "identifier": "b",
      "notification": {
        "kind": "N",
        "value": "Component3 - user action : select"
      },
      "type": 1
    },
    "id": 279,
    "logType": "runtime",
    "path": [
      0,
      0,
      0
    ]
  },
  {
    "combinatorName": "Switch",
    "componentName": "App",
    "emits": {
      "identifier": "b",
      "notification": {
        "kind": "N",
        "value": "Component3 - user action : select"
      },
      "type": 1
    },
    "id": 280,
    "logType": "runtime",
    "path": [
      0,
      0
    ]
  },
  {
    "combinatorName": "Combine",
    "componentName": "ROOT",
    "emits": {
      "identifier": "b",
      "notification": {
        "kind": "N",
        "value": "Component3 - user action : select"
      },
      "type": 1
    },
    "id": 281,
    "logType": "runtime",
    "path": [
      0
    ]
  },
  {
    "combinatorName": "Case",
    "componentName": "App",
    "emits": {
      "identifier": "userAction$",
      "notification": {
        "kind": "N",
        "value": "select"
      },
      "type": 0
    },
    "id": 282,
    "logType": "runtime",
    "path": [
      0,
      0,
      1
    ],
    "settings": {
      "as": "switchedOn",
      "on": "sweatch$",
      "sinkNames": [
        "DOM",
        "a",
        "b",
        "c"
      ],
      "when": false
    }
  },
  {
    "combinatorName": "Case|Inner",
    "componentName": "App",
    "emits": {
      "identifier": "userAction$",
      "notification": {
        "kind": "N",
        "value": "select"
      },
      "type": 0
    },
    "id": 283,
    "logType": "runtime",
    "path": [
      0,
      0,
      1
    ],
    "settings": {
      "as": "switchedOn",
      "on": "sweatch$",
      "sinkNames": [
        "DOM",
        "a",
        "b",
        "c"
      ],
      "switchedOn": false,

      "when": false
    }
  },
  {
    "combinatorName": undefined,
    "componentName": "childComponent4",
    "emits": {
      "identifier": "userAction$",
      "notification": {
        "kind": "N",
        "value": "select"
      },
      "type": 0
    },
    "id": 284,
    "logType": "runtime",
    "path": [
      0,
      0,
      1,
      0
    ],
    "settings": {
      "as": "switchedOn",
      "on": "sweatch$",
      "sinkNames": [
        "DOM",
        "a",
        "b",
        "c"
      ],
      "switchedOn": false,

      "when": false
    }
  },
  {
    "combinatorName": undefined,
    "componentName": "childComponent4",
    "emits": {
      "identifier": "c",
      "notification": {
        "kind": "N",
        "value": "Component4 - user action : select"
      },
      "type": 1
    },
    "id": 285,
    "logType": "runtime",
    "path": [
      0,
      0,
      1,
      0
    ]
  },
  {
    "combinatorName": "Case|Inner",
    "componentName": "App",
    "emits": {
      "identifier": "c",
      "notification": {
        "kind": "N",
        "value": "Component4 - user action : select"
      },
      "type": 1
    },
    "id": 286,
    "logType": "runtime",
    "path": [
      0,
      0,
      1
    ]
  },
  {
    "combinatorName": "Case",
    "componentName": "App",
    "emits": {
      "identifier": "c",
      "notification": {
        "kind": "N",
        "value": "Component4 - user action : select"
      },
      "type": 1
    },
    "id": 287,
    "logType": "runtime",
    "path": [
      0,
      0,
      1
    ]
  },
  {
    "combinatorName": "Switch",
    "componentName": "App",
    "emits": {
      "identifier": "c",
      "notification": {
        "kind": "N",
        "value": "Component4 - user action : select"
      },
      "type": 1
    },
    "id": 288,
    "logType": "runtime",
    "path": [
      0,
      0
    ]
  },
  {
    "combinatorName": "Combine",
    "componentName": "ROOT",
    "emits": {
      "identifier": "c",
      "notification": {
        "kind": "N",
        "value": "Component4 - user action : select"
      },
      "type": 1
    },
    "id": 289,
    "logType": "runtime",
    "path": [
      0
    ]
  },
  {
    "combinatorName": "Switch",
    "componentName": "App",
    "emits": {
      "identifier": "DOM",
      "notification": {
        "kind": "N",
        "value": "<div><div><span>Component 3 : f</span></div></div>"
      },
      "type": 1
    },
    "id": 290,
    "logType": "runtime",
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
        "value": "<div><div><div><span>Component 3 : f</span></div></div></div>"
      },
      "type": 1
    },
    "id": 291,
    "logType": "runtime",
    "path": [
      0
    ]
  },
  {
    "combinatorName": "Combine",
    "componentName": "ROOT",
    "emits": {
      "identifier": "sweatch$",
      "notification": {
        "kind": "N",
        "value": false
      },
      "type": 0
    },
    "id": 292,
    "logType": "runtime",
    "path": [
      0
    ],
    "settings": {}
  },
  {
    "combinatorName": "Switch",
    "componentName": "App",
    "emits": {
      "identifier": "sweatch$",
      "notification": {
        "kind": "N",
        "value": false
      },
      "type": 0
    },
    "id": 293,
    "logType": "runtime",
    "path": [
      0,
      0
    ],
    "settings": {
      "as": "switchedOn",
      "on": "sweatch$",
      "sinkNames": [
        "DOM",
        "a",
        "b",
        "c"
      ]
    }
  },
  {
    "combinatorName": "Case",
    "componentName": "App",
    "emits": {
      "identifier": "sweatch$",
      "notification": {
        "kind": "N",
        "value": false
      },
      "type": 0
    },
    "id": 294,
    "logType": "runtime",
    "path": [
      0,
      0,
      0
    ],
    "settings": {
      "as": "switchedOn",
      "on": "sweatch$",
      "sinkNames": [
        "DOM",
        "a",
        "b",
        "c"
      ],
      "when": false
    }
  }
],
    [
      {
        "combinatorName": "Case",
        "componentName": "App",
        "emits": {
          "identifier": "sweatch$",
          "notification": {
            "kind": "N",
            "value": false
          },
          "type": 0
        },
        "id": 295,
        "logType": "runtime",
        "path": [
          0,
          0,
          1
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "when": false
        }
      },
    ],
    [
      {
        "combinatorName": "Case",
        "componentName": "App",
        "emits": {
          "identifier": "sweatch$",
          "notification": {
            "kind": "N",
            "value": false
          },
          "type": 0
        },
        "id": 296,
        "logType": "runtime",
        "path": [
          0,
          0,
          2
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "when": true
        }
      },
      {
        "combinatorName": "Case",
        "componentName": "App",
        "emits": {
          "identifier": "DOM",
          "notification": {
            "kind": "N",
            "value": null
          },
          "type": 1
        },
        "id": 297,
        "logType": "runtime",
        "path": [
          0,
          0,
          2
        ]
      },
      {
        "combinatorName": "Combine",
        "componentName": "ROOT",
        "emits": {
          "identifier": "DOM1",
          "notification": {
            "kind": "N",
            "value": "e"
          },
          "type": 0
        },
        "id": 298,
        "logType": "runtime",
        "path": [
          0
        ],
        "settings": {}
      },
      {
        "combinatorName": "Switch",
        "componentName": "App",
        "emits": {
          "identifier": "DOM1",
          "notification": {
            "kind": "N",
            "value": "e"
          },
          "type": 0
        },
        "id": 299,
        "logType": "runtime",
        "path": [
          0,
          0
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ]
        }
      },
      {
        "combinatorName": "Case",
        "componentName": "App",
        "emits": {
          "identifier": "DOM1",
          "notification": {
            "kind": "N",
            "value": "e"
          },
          "type": 0
        },
        "id": 300,
        "logType": "runtime",
        "path": [
          0,
          0,
          2
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "when": true
        }
      },
      {
        "combinatorName": "Case|Inner",
        "componentName": "App",
        "emits": {
          "identifier": "DOM1",
          "notification": {
            "kind": "N",
            "value": "e"
          },
          "type": 0
        },
        "id": 301,
        "logType": "runtime",
        "path": [
          0,
          0,
          2
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "switchedOn": true,

          "when": true
        }
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent1",
        "emits": {
          "identifier": "DOM1",
          "notification": {
            "kind": "N",
            "value": "e"
          },
          "type": 0
        },
        "id": 302,
        "logType": "runtime",
        "path": [
          0,
          0,
          2,
          0
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "switchedOn": true,

          "when": true
        }
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent1",
        "emits": {
          "identifier": "DOM",
          "notification": {
            "kind": "N",
            "value": "<span>Component 1 : e</span>"
          },
          "type": 1
        },
        "id": 303,
        "logType": "runtime",
        "path": [
          0,
          0,
          2,
          0
        ]
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent1",
        "emits": {
          "identifier": "DOM",
          "notification": {
            "error": undefined,
            "kind": "C"
          },
          "type": 1
        },
        "id": 304,
        "logType": "runtime",
        "path": [
          0,
          0,
          2,
          0
        ]
      },
      {
        "combinatorName": "Case|Inner",
        "componentName": "App",
        "emits": {
          "identifier": "DOM1",
          "notification": {
            "kind": "N",
            "value": "e"
          },
          "type": 0
        },
        "id": 305,
        "logType": "runtime",
        "path": [
          0,
          0,
          2
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "switchedOn": true,

          "when": true
        }
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent1",
        "emits": {
          "identifier": "DOM1",
          "notification": {
            "kind": "N",
            "value": "e"
          },
          "type": 0
        },
        "id": 306,
        "logType": "runtime",
        "path": [
          0,
          0,
          2,
          0
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "switchedOn": true,

          "when": true
        }
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent1",
        "emits": {
          "identifier": "DOM",
          "notification": {
            "kind": "N",
            "value": "<span>Component 1 : e</span>"
          },
          "type": 1
        },
        "id": 307,
        "logType": "runtime",
        "path": [
          0,
          0,
          2,
          0
        ]
      },
      {
        "combinatorName": "Case|Inner",
        "componentName": "App",
        "emits": {
          "identifier": "DOM1",
          "notification": {
            "kind": "N",
            "value": "e"
          },
          "type": 0
        },
        "id": 308,
        "logType": "runtime",
        "path": [
          0,
          0,
          2
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "switchedOn": true,

          "when": true
        }
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent1",
        "emits": {
          "identifier": "DOM1",
          "notification": {
            "kind": "N",
            "value": "e"
          },
          "type": 0
        },
        "id": 309,
        "logType": "runtime",
        "path": [
          0,
          0,
          2,
          0
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "switchedOn": true,

          "when": true
        }
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent1",
        "emits": {
          "identifier": "DOM",
          "notification": {
            "kind": "N",
            "value": "<span>Component 1 : e</span>"
          },
          "type": 1
        },
        "id": 310,
        "logType": "runtime",
        "path": [
          0,
          0,
          2,
          0
        ]
      },
      {
        "combinatorName": "Case|Inner",
        "componentName": "App",
        "emits": {
          "identifier": "DOM1",
          "notification": {
            "kind": "N",
            "value": "e"
          },
          "type": 0
        },
        "id": 311,
        "logType": "runtime",
        "path": [
          0,
          0,
          2
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "switchedOn": true,

          "when": true
        }
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent1",
        "emits": {
          "identifier": "DOM1",
          "notification": {
            "kind": "N",
            "value": "e"
          },
          "type": 0
        },
        "id": 312,
        "logType": "runtime",
        "path": [
          0,
          0,
          2,
          0
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "switchedOn": true,

          "when": true
        }
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent1",
        "emits": {
          "identifier": "DOM",
          "notification": {
            "kind": "N",
            "value": "<span>Component 1 : e</span>"
          },
          "type": 1
        },
        "id": 313,
        "logType": "runtime",
        "path": [
          0,
          0,
          2,
          0
        ]
      },
      {
        "combinatorName": "Case|Inner",
        "componentName": "App",
        "emits": {
          "identifier": "DOM1",
          "notification": {
            "kind": "N",
            "value": "e"
          },
          "type": 0
        },
        "id": 314,
        "logType": "runtime",
        "path": [
          0,
          0,
          2
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "switchedOn": true,

          "when": true
        }
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent1",
        "emits": {
          "identifier": "DOM1",
          "notification": {
            "kind": "N",
            "value": "e"
          },
          "type": 0
        },
        "id": 315,
        "logType": "runtime",
        "path": [
          0,
          0,
          2,
          0
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "switchedOn": true,

          "when": true
        }
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent1",
        "emits": {
          "identifier": "DOM",
          "notification": {
            "kind": "N",
            "value": "<span>Component 1 : e</span>"
          },
          "type": 1
        },
        "id": 316,
        "logType": "runtime",
        "path": [
          0,
          0,
          2,
          0
        ]
      },
      {
        "combinatorName": "Case|Inner",
        "componentName": "App",
        "emits": {
          "identifier": "DOM1",
          "notification": {
            "kind": "N",
            "value": "e"
          },
          "type": 0
        },
        "id": 317,
        "logType": "runtime",
        "path": [
          0,
          0,
          2
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "switchedOn": true,

          "when": true
        }
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent1",
        "emits": {
          "identifier": "DOM1",
          "notification": {
            "kind": "N",
            "value": "e"
          },
          "type": 0
        },
        "id": 318,
        "logType": "runtime",
        "path": [
          0,
          0,
          2,
          0
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "switchedOn": true,

          "when": true
        }
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent1",
        "emits": {
          "identifier": "DOM",
          "notification": {
            "kind": "N",
            "value": "<span>Component 1 : e</span>"
          },
          "type": 1
        },
        "id": 319,
        "logType": "runtime",
        "path": [
          0,
          0,
          2,
          0
        ]
      },
      {
        "combinatorName": "Combine",
        "componentName": "ROOT",
        "emits": {
          "identifier": "DOM2",
          "notification": {
            "kind": "N",
            "value": "a"
          },
          "type": 0
        },
        "id": 320,
        "logType": "runtime",
        "path": [
          0
        ],
        "settings": {}
      },
      {
        "combinatorName": "Switch",
        "componentName": "App",
        "emits": {
          "identifier": "DOM2",
          "notification": {
            "kind": "N",
            "value": "a"
          },
          "type": 0
        },
        "id": 321,
        "logType": "runtime",
        "path": [
          0,
          0
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ]
        }
      },
      {
        "combinatorName": "Case",
        "componentName": "App",
        "emits": {
          "identifier": "DOM2",
          "notification": {
            "kind": "N",
            "value": "a"
          },
          "type": 0
        },
        "id": 322,
        "logType": "runtime",
        "path": [
          0,
          0,
          2
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "when": true
        }
      },
      {
        "combinatorName": "Case|Inner",
        "componentName": "App",
        "emits": {
          "identifier": "DOM2",
          "notification": {
            "kind": "N",
            "value": "a"
          },
          "type": 0
        },
        "id": 323,
        "logType": "runtime",
        "path": [
          0,
          0,
          2
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "switchedOn": true,

          "when": true
        }
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent2",
        "emits": {
          "identifier": "DOM2",
          "notification": {
            "kind": "N",
            "value": "a"
          },
          "type": 0
        },
        "id": 324,
        "logType": "runtime",
        "path": [
          0,
          0,
          2,
          1
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "switchedOn": true,

          "when": true
        }
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent2",
        "emits": {
          "identifier": "DOM",
          "notification": {
            "kind": "N",
            "value": "<span>Component 2 : a</span>"
          },
          "type": 1
        },
        "id": 325,
        "logType": "runtime",
        "path": [
          0,
          0,
          2,
          1
        ]
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent2",
        "emits": {
          "identifier": "DOM",
          "notification": {
            "error": undefined,
            "kind": "C"
          },
          "type": 1
        },
        "id": 326,
        "logType": "runtime",
        "path": [
          0,
          0,
          2,
          1
        ]
      },
      {
        "combinatorName": "Case|Inner",
        "componentName": "App",
        "emits": {
          "identifier": "DOM2",
          "notification": {
            "kind": "N",
            "value": "a"
          },
          "type": 0
        },
        "id": 327,
        "logType": "runtime",
        "path": [
          0,
          0,
          2
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "switchedOn": true,

          "when": true
        }
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent2",
        "emits": {
          "identifier": "DOM2",
          "notification": {
            "kind": "N",
            "value": "a"
          },
          "type": 0
        },
        "id": 328,
        "logType": "runtime",
        "path": [
          0,
          0,
          2,
          1
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "switchedOn": true,

          "when": true
        }
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent2",
        "emits": {
          "identifier": "DOM",
          "notification": {
            "kind": "N",
            "value": "<span>Component 2 : a</span>"
          },
          "type": 1
        },
        "id": 329,
        "logType": "runtime",
        "path": [
          0,
          0,
          2,
          1
        ]
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent2",
        "emits": {
          "identifier": "DOM",
          "notification": {
            "error": undefined,
            "kind": "C"
          },
          "type": 1
        },
        "id": 330,
        "logType": "runtime",
        "path": [
          0,
          0,
          2,
          1
        ]
      },
      {
        "combinatorName": "Case|Inner",
        "componentName": "App",
        "emits": {
          "identifier": "DOM2",
          "notification": {
            "kind": "N",
            "value": "a"
          },
          "type": 0
        },
        "id": 331,
        "logType": "runtime",
        "path": [
          0,
          0,
          2
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "switchedOn": true,

          "when": true
        }
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent2",
        "emits": {
          "identifier": "DOM2",
          "notification": {
            "kind": "N",
            "value": "a"
          },
          "type": 0
        },
        "id": 332,
        "logType": "runtime",
        "path": [
          0,
          0,
          2,
          1
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "switchedOn": true,

          "when": true
        }
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent2",
        "emits": {
          "identifier": "DOM",
          "notification": {
            "kind": "N",
            "value": "<span>Component 2 : a</span>"
          },
          "type": 1
        },
        "id": 333,
        "logType": "runtime",
        "path": [
          0,
          0,
          2,
          1
        ]
      },
      {
        "combinatorName": "Case|Inner",
        "componentName": "App",
        "emits": {
          "identifier": "DOM2",
          "notification": {
            "kind": "N",
            "value": "a"
          },
          "type": 0
        },
        "id": 334,
        "logType": "runtime",
        "path": [
          0,
          0,
          2
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "switchedOn": true,

          "when": true
        }
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent2",
        "emits": {
          "identifier": "DOM2",
          "notification": {
            "kind": "N",
            "value": "a"
          },
          "type": 0
        },
        "id": 335,
        "logType": "runtime",
        "path": [
          0,
          0,
          2,
          1
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "switchedOn": true,

          "when": true
        }
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent2",
        "emits": {
          "identifier": "DOM",
          "notification": {
            "kind": "N",
            "value": "<span>Component 2 : a</span>"
          },
          "type": 1
        },
        "id": 336,
        "logType": "runtime",
        "path": [
          0,
          0,
          2,
          1
        ]
      },
      {
        "combinatorName": "Case|Inner",
        "componentName": "App",
        "emits": {
          "identifier": "DOM2",
          "notification": {
            "kind": "N",
            "value": "a"
          },
          "type": 0
        },
        "id": 337,
        "logType": "runtime",
        "path": [
          0,
          0,
          2
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "switchedOn": true,

          "when": true
        }
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent2",
        "emits": {
          "identifier": "DOM2",
          "notification": {
            "kind": "N",
            "value": "a"
          },
          "type": 0
        },
        "id": 338,
        "logType": "runtime",
        "path": [
          0,
          0,
          2,
          1
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "switchedOn": true,

          "when": true
        }
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent2",
        "emits": {
          "identifier": "DOM",
          "notification": {
            "kind": "N",
            "value": "<span>Component 2 : a</span>"
          },
          "type": 1
        },
        "id": 339,
        "logType": "runtime",
        "path": [
          0,
          0,
          2,
          1
        ]
      },
      {
        "combinatorName": "Case",
        "componentName": "App",
        "emits": {
          "identifier": "DOM2",
          "notification": {
            "kind": "N",
            "value": "a"
          },
          "type": 0
        },
        "id": 340,
        "logType": "runtime",
        "path": [
          0,
          0,
          0
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "when": false
        }
      },
      {
        "combinatorName": "Case|Inner",
        "componentName": "App",
        "emits": {
          "identifier": "DOM2",
          "notification": {
            "kind": "N",
            "value": "a"
          },
          "type": 0
        },
        "id": 341,
        "logType": "runtime",
        "path": [
          0,
          0,
          0
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "switchedOn": false,

          "when": false
        }
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent3",
        "emits": {
          "identifier": "DOM2",
          "notification": {
            "kind": "N",
            "value": "a"
          },
          "type": 0
        },
        "id": 342,
        "logType": "runtime",
        "path": [
          0,
          0,
          0,
          0
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "switchedOn": false,

          "when": false
        }
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent3",
        "emits": {
          "identifier": "DOM",
          "notification": {
            "kind": "N",
            "value": "<span>Component 3 : a</span>"
          },
          "type": 1
        },
        "id": 343,
        "logType": "runtime",
        "path": [
          0,
          0,
          0,
          0
        ]
      },
      {
        "combinatorName": "Case|Inner",
        "componentName": "App",
        "emits": {
          "identifier": "DOM2",
          "notification": {
            "kind": "N",
            "value": "a"
          },
          "type": 0
        },
        "id": 344,
        "logType": "runtime",
        "path": [
          0,
          0,
          0
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "switchedOn": false,

          "when": false
        }
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent3",
        "emits": {
          "identifier": "DOM2",
          "notification": {
            "kind": "N",
            "value": "a"
          },
          "type": 0
        },
        "id": 345,
        "logType": "runtime",
        "path": [
          0,
          0,
          0,
          0
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "switchedOn": false,

          "when": false
        }
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent3",
        "emits": {
          "identifier": "DOM",
          "notification": {
            "kind": "N",
            "value": "<span>Component 3 : a</span>"
          },
          "type": 1
        },
        "id": 346,
        "logType": "runtime",
        "path": [
          0,
          0,
          0,
          0
        ]
      },
      {
        "combinatorName": "Case|Inner",
        "componentName": "App",
        "emits": {
          "identifier": "DOM",
          "notification": {
            "kind": "N",
            "value": "<div><span>Component 3 : a</span></div>"
          },
          "type": 1
        },
        "id": 347,
        "logType": "runtime",
        "path": [
          0,
          0,
          0
        ]
      },
      {
        "combinatorName": "Case",
        "componentName": "App",
        "emits": {
          "identifier": "DOM",
          "notification": {
            "kind": "N",
            "value": "<div><span>Component 3 : a</span></div>"
          },
          "type": 1
        },
        "id": 348,
        "logType": "runtime",
        "path": [
          0,
          0,
          0
        ]
      },
      {
        "combinatorName": "Switch",
        "componentName": "App",
        "emits": {
          "identifier": "DOM",
          "notification": {
            "kind": "N",
            "value": "<div><div><span>Component 3 : a</span></div></div>"
          },
          "type": 1
        },
        "id": 349,
        "logType": "runtime",
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
            "value": "<div><div><div><span>Component 3 : a</span></div></div></div>"
          },
          "type": 1
        },
        "id": 350,
        "logType": "runtime",
        "path": [
          0
        ]
      },
      {
        "combinatorName": "Combine",
        "componentName": "ROOT",
        "emits": {
          "identifier": "sweatch$",
          "notification": {
            "kind": "N",
            "value": true
          },
          "type": 0
        },
        "id": 351,
        "logType": "runtime",
        "path": [
          0
        ],
        "settings": {}
      },
      {
        "combinatorName": "Switch",
        "componentName": "App",
        "emits": {
          "identifier": "sweatch$",
          "notification": {
            "kind": "N",
            "value": true
          },
          "type": 0
        },
        "id": 352,
        "logType": "runtime",
        "path": [
          0,
          0
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ]
        }
      },
      {
        "combinatorName": "Case",
        "componentName": "App",
        "emits": {
          "identifier": "sweatch$",
          "notification": {
            "kind": "N",
            "value": true
          },
          "type": 0
        },
        "id": 353,
        "logType": "runtime",
        "path": [
          0,
          0,
          0
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "when": false
        }
      },
      {
        "combinatorName": "Case",
        "componentName": "App",
        "emits": {
          "identifier": "sweatch$",
          "notification": {
            "kind": "N",
            "value": true
          },
          "type": 0
        },
        "id": 354,
        "logType": "runtime",
        "path": [
          0,
          0,
          1
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "when": false
        }
      },
      {
        "combinatorName": "Case",
        "componentName": "App",
        "emits": {
          "identifier": "sweatch$",
          "notification": {
            "kind": "N",
            "value": true
          },
          "type": 0
        },
        "id": 355,
        "logType": "runtime",
        "path": [
          0,
          0,
          2
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "when": true
        }
      },
    ],
    [
      {
        "combinatorName": "Case",
        "componentName": "App",
        "emits": {
          "identifier": "DOM",
          "notification": {
            "kind": "N",
            "value": null
          },
          "type": 1
        },
        "id": 356,
        "logType": "runtime",
        "path": [
          0,
          0,
          0
        ]
      },
      {
        "combinatorName": "Case",
        "componentName": "App",
        "emits": {
          "identifier": "DOM",
          "notification": {
            "kind": "N",
            "value": null
          },
          "type": 1
        },
        "id": 357,
        "logType": "runtime",
        "path": [
          0,
          0,
          1
        ]
      },
      {
        "combinatorName": "Switch",
        "componentName": "App",
        "emits": {
          "identifier": "DOM",
          "notification": {
            "kind": "N",
            "value": "<div></div>"
          },
          "type": 1
        },
        "id": 358,
        "logType": "runtime",
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
            "value": "<div><div></div></div>"
          },
          "type": 1
        },
        "id": 359,
        "logType": "runtime",
        "path": [
          0
        ]
      },
      {
        "combinatorName": "Combine",
        "componentName": "ROOT",
        "emits": {
          "identifier": "DOM2",
          "notification": {
            "kind": "N",
            "value": "b"
          },
          "type": 0
        },
        "id": 360,
        "logType": "runtime",
        "path": [
          0
        ],
        "settings": {}
      },
      {
        "combinatorName": "Switch",
        "componentName": "App",
        "emits": {
          "identifier": "DOM2",
          "notification": {
            "kind": "N",
            "value": "b"
          },
          "type": 0
        },
        "id": 361,
        "logType": "runtime",
        "path": [
          0,
          0
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ]
        }
      },
      {
        "combinatorName": "Case",
        "componentName": "App",
        "emits": {
          "identifier": "DOM2",
          "notification": {
            "kind": "N",
            "value": "b"
          },
          "type": 0
        },
        "id": 362,
        "logType": "runtime",
        "path": [
          0,
          0,
          2
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "when": true
        }
      },
      {
        "combinatorName": "Case|Inner",
        "componentName": "App",
        "emits": {
          "identifier": "DOM2",
          "notification": {
            "kind": "N",
            "value": "b"
          },
          "type": 0
        },
        "id": 363,
        "logType": "runtime",
        "path": [
          0,
          0,
          2
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "switchedOn": true,

          "when": true
        }
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent2",
        "emits": {
          "identifier": "DOM2",
          "notification": {
            "kind": "N",
            "value": "b"
          },
          "type": 0
        },
        "id": 364,
        "logType": "runtime",
        "path": [
          0,
          0,
          2,
          1
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "switchedOn": true,

          "when": true
        }
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent2",
        "emits": {
          "identifier": "DOM",
          "notification": {
            "kind": "N",
            "value": "<span>Component 2 : b</span>"
          },
          "type": 1
        },
        "id": 365,
        "logType": "runtime",
        "path": [
          0,
          0,
          2,
          1
        ]
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent2",
        "emits": {
          "identifier": "DOM",
          "notification": {
            "error": undefined,
            "kind": "C"
          },
          "type": 1
        },
        "id": 366,
        "logType": "runtime",
        "path": [
          0,
          0,
          2,
          1
        ]
      },
      {
        "combinatorName": "Case|Inner",
        "componentName": "App",
        "emits": {
          "identifier": "DOM2",
          "notification": {
            "kind": "N",
            "value": "b"
          },
          "type": 0
        },
        "id": 367,
        "logType": "runtime",
        "path": [
          0,
          0,
          2
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "switchedOn": true,

          "when": true
        }
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent2",
        "emits": {
          "identifier": "DOM2",
          "notification": {
            "kind": "N",
            "value": "b"
          },
          "type": 0
        },
        "id": 368,
        "logType": "runtime",
        "path": [
          0,
          0,
          2,
          1
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "switchedOn": true,

          "when": true
        }
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent2",
        "emits": {
          "identifier": "DOM",
          "notification": {
            "kind": "N",
            "value": "<span>Component 2 : b</span>"
          },
          "type": 1
        },
        "id": 369,
        "logType": "runtime",
        "path": [
          0,
          0,
          2,
          1
        ]
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent2",
        "emits": {
          "identifier": "DOM",
          "notification": {
            "error": undefined,
            "kind": "C"
          },
          "type": 1
        },
        "id": 370,
        "logType": "runtime",
        "path": [
          0,
          0,
          2,
          1
        ]
      },
      {
        "combinatorName": "Case|Inner",
        "componentName": "App",
        "emits": {
          "identifier": "DOM2",
          "notification": {
            "kind": "N",
            "value": "b"
          },
          "type": 0
        },
        "id": 371,
        "logType": "runtime",
        "path": [
          0,
          0,
          2
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "switchedOn": true,

          "when": true
        }
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent2",
        "emits": {
          "identifier": "DOM2",
          "notification": {
            "kind": "N",
            "value": "b"
          },
          "type": 0
        },
        "id": 372,
        "logType": "runtime",
        "path": [
          0,
          0,
          2,
          1
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "switchedOn": true,

          "when": true
        }
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent2",
        "emits": {
          "identifier": "DOM",
          "notification": {
            "kind": "N",
            "value": "<span>Component 2 : b</span>"
          },
          "type": 1
        },
        "id": 373,
        "logType": "runtime",
        "path": [
          0,
          0,
          2,
          1
        ]
      },
      {
        "combinatorName": "Case|Inner",
        "componentName": "App",
        "emits": {
          "identifier": "DOM2",
          "notification": {
            "kind": "N",
            "value": "b"
          },
          "type": 0
        },
        "id": 374,
        "logType": "runtime",
        "path": [
          0,
          0,
          2
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "switchedOn": true,

          "when": true
        }
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent2",
        "emits": {
          "identifier": "DOM2",
          "notification": {
            "kind": "N",
            "value": "b"
          },
          "type": 0
        },
        "id": 375,
        "logType": "runtime",
        "path": [
          0,
          0,
          2,
          1
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "switchedOn": true,

          "when": true
        }
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent2",
        "emits": {
          "identifier": "DOM",
          "notification": {
            "kind": "N",
            "value": "<span>Component 2 : b</span>"
          },
          "type": 1
        },
        "id": 376,
        "logType": "runtime",
        "path": [
          0,
          0,
          2,
          1
        ]
      },
      {
        "combinatorName": "Case",
        "componentName": "App",
        "emits": {
          "identifier": "DOM2",
          "notification": {
            "kind": "N",
            "value": "b"
          },
          "type": 0
        },
        "id": 377,
        "logType": "runtime",
        "path": [
          0,
          0,
          0
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "when": false
        }
      },
      {
        "combinatorName": "Case|Inner",
        "componentName": "App",
        "emits": {
          "identifier": "DOM2",
          "notification": {
            "kind": "N",
            "value": "b"
          },
          "type": 0
        },
        "id": 378,
        "logType": "runtime",
        "path": [
          0,
          0,
          0
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "switchedOn": false,

          "when": false
        }
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent3",
        "emits": {
          "identifier": "DOM2",
          "notification": {
            "kind": "N",
            "value": "b"
          },
          "type": 0
        },
        "id": 379,
        "logType": "runtime",
        "path": [
          0,
          0,
          0,
          0
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "switchedOn": false,

          "when": false
        }
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent3",
        "emits": {
          "identifier": "DOM",
          "notification": {
            "kind": "N",
            "value": "<span>Component 3 : b</span>"
          },
          "type": 1
        },
        "id": 380,
        "logType": "runtime",
        "path": [
          0,
          0,
          0,
          0
        ]
      },
      {
        "combinatorName": "Case|Inner",
        "componentName": "App",
        "emits": {
          "identifier": "DOM2",
          "notification": {
            "kind": "N",
            "value": "b"
          },
          "type": 0
        },
        "id": 381,
        "logType": "runtime",
        "path": [
          0,
          0,
          0
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "switchedOn": false,

          "when": false
        }
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent3",
        "emits": {
          "identifier": "DOM2",
          "notification": {
            "kind": "N",
            "value": "b"
          },
          "type": 0
        },
        "id": 382,
        "logType": "runtime",
        "path": [
          0,
          0,
          0,
          0
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "switchedOn": false,

          "when": false
        }
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent3",
        "emits": {
          "identifier": "DOM",
          "notification": {
            "kind": "N",
            "value": "<span>Component 3 : b</span>"
          },
          "type": 1
        },
        "id": 383,
        "logType": "runtime",
        "path": [
          0,
          0,
          0,
          0
        ]
      },
      {
        "combinatorName": "Combine",
        "componentName": "ROOT",
        "emits": {
          "identifier": "DOM2",
          "notification": {
            "kind": "N",
            "value": "b"
          },
          "type": 0
        },
        "id": 384,
        "logType": "runtime",
        "path": [
          0
        ],
        "settings": {}
      },
      {
        "combinatorName": "Switch",
        "componentName": "App",
        "emits": {
          "identifier": "DOM2",
          "notification": {
            "kind": "N",
            "value": "b"
          },
          "type": 0
        },
        "id": 385,
        "logType": "runtime",
        "path": [
          0,
          0
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ]
        }
      },
      {
        "combinatorName": "Case",
        "componentName": "App",
        "emits": {
          "identifier": "DOM2",
          "notification": {
            "kind": "N",
            "value": "b"
          },
          "type": 0
        },
        "id": 386,
        "logType": "runtime",
        "path": [
          0,
          0,
          2
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "when": true
        }
      },
      {
        "combinatorName": "Case|Inner",
        "componentName": "App",
        "emits": {
          "identifier": "DOM2",
          "notification": {
            "kind": "N",
            "value": "b"
          },
          "type": 0
        },
        "id": 387,
        "logType": "runtime",
        "path": [
          0,
          0,
          2
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "switchedOn": true,

          "when": true
        }
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent2",
        "emits": {
          "identifier": "DOM2",
          "notification": {
            "kind": "N",
            "value": "b"
          },
          "type": 0
        },
        "id": 388,
        "logType": "runtime",
        "path": [
          0,
          0,
          2,
          1
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "switchedOn": true,

          "when": true
        }
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent2",
        "emits": {
          "identifier": "DOM",
          "notification": {
            "kind": "N",
            "value": "<span>Component 2 : b</span>"
          },
          "type": 1
        },
        "id": 389,
        "logType": "runtime",
        "path": [
          0,
          0,
          2,
          1
        ]
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent2",
        "emits": {
          "identifier": "DOM",
          "notification": {
            "error": undefined,
            "kind": "C"
          },
          "type": 1
        },
        "id": 390,
        "logType": "runtime",
        "path": [
          0,
          0,
          2,
          1
        ]
      },
      {
        "combinatorName": "Case|Inner",
        "componentName": "App",
        "emits": {
          "identifier": "DOM2",
          "notification": {
            "kind": "N",
            "value": "b"
          },
          "type": 0
        },
        "id": 391,
        "logType": "runtime",
        "path": [
          0,
          0,
          2
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "switchedOn": true,

          "when": true
        }
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent2",
        "emits": {
          "identifier": "DOM2",
          "notification": {
            "kind": "N",
            "value": "b"
          },
          "type": 0
        },
        "id": 392,
        "logType": "runtime",
        "path": [
          0,
          0,
          2,
          1
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "switchedOn": true,

          "when": true
        }
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent2",
        "emits": {
          "identifier": "DOM",
          "notification": {
            "kind": "N",
            "value": "<span>Component 2 : b</span>"
          },
          "type": 1
        },
        "id": 393,
        "logType": "runtime",
        "path": [
          0,
          0,
          2,
          1
        ]
      },
      {
        "combinatorName": "Case",
        "componentName": "App",
        "emits": {
          "identifier": "DOM2",
          "notification": {
            "kind": "N",
            "value": "b"
          },
          "type": 0
        },
        "id": 394,
        "logType": "runtime",
        "path": [
          0,
          0,
          0
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "when": false
        }
      },
      {
        "combinatorName": "Case|Inner",
        "componentName": "App",
        "emits": {
          "identifier": "DOM2",
          "notification": {
            "kind": "N",
            "value": "b"
          },
          "type": 0
        },
        "id": 395,
        "logType": "runtime",
        "path": [
          0,
          0,
          0
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "switchedOn": false,

          "when": false
        }
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent3",
        "emits": {
          "identifier": "DOM2",
          "notification": {
            "kind": "N",
            "value": "b"
          },
          "type": 0
        },
        "id": 396,
        "logType": "runtime",
        "path": [
          0,
          0,
          0,
          0
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "switchedOn": false,

          "when": false
        }
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent3",
        "emits": {
          "identifier": "DOM",
          "notification": {
            "kind": "N",
            "value": "<span>Component 3 : b</span>"
          },
          "type": 1
        },
        "id": 397,
        "logType": "runtime",
        "path": [
          0,
          0,
          0,
          0
        ]
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent3",
        "emits": {
          "identifier": "DOM",
          "notification": {
            "error": undefined,
            "kind": "C"
          },
          "type": 1
        },
        "id": 398,
        "logType": "runtime",
        "path": [
          0,
          0,
          0,
          0
        ]
      },
      {
        "combinatorName": "Case|Inner",
        "componentName": "App",
        "emits": {
          "identifier": "DOM2",
          "notification": {
            "kind": "N",
            "value": "b"
          },
          "type": 0
        },
        "id": 399,
        "logType": "runtime",
        "path": [
          0,
          0,
          0
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "switchedOn": false,

          "when": false
        }
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent3",
        "emits": {
          "identifier": "DOM2",
          "notification": {
            "kind": "N",
            "value": "b"
          },
          "type": 0
        },
        "id": 400,
        "logType": "runtime",
        "path": [
          0,
          0,
          0,
          0
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "switchedOn": false,

          "when": false
        }
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent3",
        "emits": {
          "identifier": "DOM",
          "notification": {
            "kind": "N",
            "value": "<span>Component 3 : b</span>"
          },
          "type": 1
        },
        "id": 401,
        "logType": "runtime",
        "path": [
          0,
          0,
          0,
          0
        ]
      },
      {
        "combinatorName": "Combine",
        "componentName": "ROOT",
        "emits": {
          "identifier": "userAction$",
          "notification": {
            "kind": "N",
            "value": "hover"
          },
          "type": 0
        },
        "id": 402,
        "logType": "runtime",
        "path": [
          0
        ],
        "settings": {}
      },
      {
        "combinatorName": "Switch",
        "componentName": "App",
        "emits": {
          "identifier": "userAction$",
          "notification": {
            "kind": "N",
            "value": "hover"
          },
          "type": 0
        },
        "id": 403,
        "logType": "runtime",
        "path": [
          0,
          0
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ]
        }
      },
      {
        "combinatorName": "Case",
        "componentName": "App",
        "emits": {
          "identifier": "userAction$",
          "notification": {
            "kind": "N",
            "value": "hover"
          },
          "type": 0
        },
        "id": 404,
        "logType": "runtime",
        "path": [
          0,
          0,
          2
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "when": true
        }
      },
      {
        "combinatorName": "Case|Inner",
        "componentName": "App",
        "emits": {
          "identifier": "userAction$",
          "notification": {
            "kind": "N",
            "value": "hover"
          },
          "type": 0
        },
        "id": 405,
        "logType": "runtime",
        "path": [
          0,
          0,
          2
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "switchedOn": true,

          "when": true
        }
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent1",
        "emits": {
          "identifier": "userAction$",
          "notification": {
            "kind": "N",
            "value": "hover"
          },
          "type": 0
        },
        "id": 406,
        "logType": "runtime",
        "path": [
          0,
          0,
          2,
          0
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "switchedOn": true,

          "when": true
        }
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent1",
        "emits": {
          "identifier": "a",
          "notification": {
            "kind": "N",
            "value": "Component1 - user action : hover"
          },
          "type": 1
        },
        "id": 407,
        "logType": "runtime",
        "path": [
          0,
          0,
          2,
          0
        ]
      },
      {
        "combinatorName": "Case|Inner",
        "componentName": "App",
        "emits": {
          "identifier": "a",
          "notification": {
            "kind": "N",
            "value": "Component1 - user action : hover"
          },
          "type": 1
        },
        "id": 408,
        "logType": "runtime",
        "path": [
          0,
          0,
          2
        ]
      },
      {
        "combinatorName": "Case",
        "componentName": "App",
        "emits": {
          "identifier": "a",
          "notification": {
            "kind": "N",
            "value": "Component1 - user action : hover"
          },
          "type": 1
        },
        "id": 409,
        "logType": "runtime",
        "path": [
          0,
          0,
          2
        ]
      },
      {
        "combinatorName": "Switch",
        "componentName": "App",
        "emits": {
          "identifier": "a",
          "notification": {
            "kind": "N",
            "value": "Component1 - user action : hover"
          },
          "type": 1
        },
        "id": 410,
        "logType": "runtime",
        "path": [
          0,
          0
        ]
      },
      {
        "combinatorName": "Combine",
        "componentName": "ROOT",
        "emits": {
          "identifier": "a",
          "notification": {
            "kind": "N",
            "value": "Component1 - user action : hover"
          },
          "type": 1
        },
        "id": 411,
        "logType": "runtime",
        "path": [
          0
        ]
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent2",
        "emits": {
          "identifier": "userAction$",
          "notification": {
            "kind": "N",
            "value": "hover"
          },
          "type": 0
        },
        "id": 412,
        "logType": "runtime",
        "path": [
          0,
          0,
          2,
          1
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "switchedOn": true,

          "when": true
        }
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent2",
        "emits": {
          "identifier": "b",
          "notification": {
            "kind": "N",
            "value": "Component2 - user action : hover"
          },
          "type": 1
        },
        "id": 413,
        "logType": "runtime",
        "path": [
          0,
          0,
          2,
          1
        ]
      },
      {
        "combinatorName": "Case|Inner",
        "componentName": "App",
        "emits": {
          "identifier": "b",
          "notification": {
            "kind": "N",
            "value": "Component2 - user action : hover"
          },
          "type": 1
        },
        "id": 414,
        "logType": "runtime",
        "path": [
          0,
          0,
          2
        ]
      },
      {
        "combinatorName": "Case",
        "componentName": "App",
        "emits": {
          "identifier": "b",
          "notification": {
            "kind": "N",
            "value": "Component2 - user action : hover"
          },
          "type": 1
        },
        "id": 415,
        "logType": "runtime",
        "path": [
          0,
          0,
          2
        ]
      },
      {
        "combinatorName": "Switch",
        "componentName": "App",
        "emits": {
          "identifier": "b",
          "notification": {
            "kind": "N",
            "value": "Component2 - user action : hover"
          },
          "type": 1
        },
        "id": 416,
        "logType": "runtime",
        "path": [
          0,
          0
        ]
      },
      {
        "combinatorName": "Combine",
        "componentName": "ROOT",
        "emits": {
          "identifier": "b",
          "notification": {
            "kind": "N",
            "value": "Component2 - user action : hover"
          },
          "type": 1
        },
        "id": 417,
        "logType": "runtime",
        "path": [
          0
        ]
      },
      {
        "combinatorName": "Combine",
        "componentName": "ROOT",
        "emits": {
          "identifier": "DOM1",
          "notification": {
            "kind": "N",
            "value": "f"
          },
          "type": 0
        },
        "id": 418,
        "logType": "runtime",
        "path": [
          0
        ],
        "settings": {}
      },
      {
        "combinatorName": "Switch",
        "componentName": "App",
        "emits": {
          "identifier": "DOM1",
          "notification": {
            "kind": "N",
            "value": "f"
          },
          "type": 0
        },
        "id": 419,
        "logType": "runtime",
        "path": [
          0,
          0
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ]
        }
      },
      {
        "combinatorName": "Case",
        "componentName": "App",
        "emits": {
          "identifier": "DOM1",
          "notification": {
            "kind": "N",
            "value": "f"
          },
          "type": 0
        },
        "id": 420,
        "logType": "runtime",
        "path": [
          0,
          0,
          2
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "when": true
        }
      },
      {
        "combinatorName": "Case|Inner",
        "componentName": "App",
        "emits": {
          "identifier": "DOM1",
          "notification": {
            "kind": "N",
            "value": "f"
          },
          "type": 0
        },
        "id": 421,
        "logType": "runtime",
        "path": [
          0,
          0,
          2
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "switchedOn": true,

          "when": true
        }
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent1",
        "emits": {
          "identifier": "DOM1",
          "notification": {
            "kind": "N",
            "value": "f"
          },
          "type": 0
        },
        "id": 422,
        "logType": "runtime",
        "path": [
          0,
          0,
          2,
          0
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "switchedOn": true,

          "when": true
        }
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent1",
        "emits": {
          "identifier": "DOM",
          "notification": {
            "kind": "N",
            "value": "<span>Component 1 : f</span>"
          },
          "type": 1
        },
        "id": 423,
        "logType": "runtime",
        "path": [
          0,
          0,
          2,
          0
        ]
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent1",
        "emits": {
          "identifier": "DOM",
          "notification": {
            "error": undefined,
            "kind": "C"
          },
          "type": 1
        },
        "id": 424,
        "logType": "runtime",
        "path": [
          0,
          0,
          2,
          0
        ]
      },
      {
        "combinatorName": "Case|Inner",
        "componentName": "App",
        "emits": {
          "identifier": "DOM1",
          "notification": {
            "kind": "N",
            "value": "f"
          },
          "type": 0
        },
        "id": 425,
        "logType": "runtime",
        "path": [
          0,
          0,
          2
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "switchedOn": true,

          "when": true
        }
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent1",
        "emits": {
          "identifier": "DOM1",
          "notification": {
            "kind": "N",
            "value": "f"
          },
          "type": 0
        },
        "id": 426,
        "logType": "runtime",
        "path": [
          0,
          0,
          2,
          0
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "switchedOn": true,

          "when": true
        }
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent1",
        "emits": {
          "identifier": "DOM",
          "notification": {
            "kind": "N",
            "value": "<span>Component 1 : f</span>"
          },
          "type": 1
        },
        "id": 427,
        "logType": "runtime",
        "path": [
          0,
          0,
          2,
          0
        ]
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent1",
        "emits": {
          "identifier": "DOM",
          "notification": {
            "error": undefined,
            "kind": "C"
          },
          "type": 1
        },
        "id": 428,
        "logType": "runtime",
        "path": [
          0,
          0,
          2,
          0
        ]
      },
      {
        "combinatorName": "Case|Inner",
        "componentName": "App",
        "emits": {
          "identifier": "DOM1",
          "notification": {
            "kind": "N",
            "value": "f"
          },
          "type": 0
        },
        "id": 429,
        "logType": "runtime",
        "path": [
          0,
          0,
          2
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "switchedOn": true,

          "when": true
        }
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent1",
        "emits": {
          "identifier": "DOM1",
          "notification": {
            "kind": "N",
            "value": "f"
          },
          "type": 0
        },
        "id": 430,
        "logType": "runtime",
        "path": [
          0,
          0,
          2,
          0
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "switchedOn": true,

          "when": true
        }
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent1",
        "emits": {
          "identifier": "DOM",
          "notification": {
            "kind": "N",
            "value": "<span>Component 1 : f</span>"
          },
          "type": 1
        },
        "id": 431,
        "logType": "runtime",
        "path": [
          0,
          0,
          2,
          0
        ]
      },
      {
        "combinatorName": "Case|Inner",
        "componentName": "App",
        "emits": {
          "identifier": "DOM1",
          "notification": {
            "kind": "N",
            "value": "f"
          },
          "type": 0
        },
        "id": 432,
        "logType": "runtime",
        "path": [
          0,
          0,
          2
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "switchedOn": true,

          "when": true
        }
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent1",
        "emits": {
          "identifier": "DOM1",
          "notification": {
            "kind": "N",
            "value": "f"
          },
          "type": 0
        },
        "id": 433,
        "logType": "runtime",
        "path": [
          0,
          0,
          2,
          0
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "switchedOn": true,

          "when": true
        }
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent1",
        "emits": {
          "identifier": "DOM",
          "notification": {
            "kind": "N",
            "value": "<span>Component 1 : f</span>"
          },
          "type": 1
        },
        "id": 434,
        "logType": "runtime",
        "path": [
          0,
          0,
          2,
          0
        ]
      },
      {
        "combinatorName": "Case|Inner",
        "componentName": "App",
        "emits": {
          "identifier": "DOM1",
          "notification": {
            "kind": "N",
            "value": "f"
          },
          "type": 0
        },
        "id": 435,
        "logType": "runtime",
        "path": [
          0,
          0,
          2
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "switchedOn": true,

          "when": true
        }
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent1",
        "emits": {
          "identifier": "DOM1",
          "notification": {
            "kind": "N",
            "value": "f"
          },
          "type": 0
        },
        "id": 436,
        "logType": "runtime",
        "path": [
          0,
          0,
          2,
          0
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "switchedOn": true,

          "when": true
        }
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent1",
        "emits": {
          "identifier": "DOM",
          "notification": {
            "kind": "N",
            "value": "<span>Component 1 : f</span>"
          },
          "type": 1
        },
        "id": 437,
        "logType": "runtime",
        "path": [
          0,
          0,
          2,
          0
        ]
      },
      {
        "combinatorName": "Case|Inner",
        "componentName": "App",
        "emits": {
          "identifier": "DOM1",
          "notification": {
            "kind": "N",
            "value": "f"
          },
          "type": 0
        },
        "id": 438,
        "logType": "runtime",
        "path": [
          0,
          0,
          2
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "switchedOn": true,

          "when": true
        }
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent1",
        "emits": {
          "identifier": "DOM1",
          "notification": {
            "kind": "N",
            "value": "f"
          },
          "type": 0
        },
        "id": 439,
        "logType": "runtime",
        "path": [
          0,
          0,
          2,
          0
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "switchedOn": true,

          "when": true
        }
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent1",
        "emits": {
          "identifier": "DOM",
          "notification": {
            "kind": "N",
            "value": "<span>Component 1 : f</span>"
          },
          "type": 1
        },
        "id": 440,
        "logType": "runtime",
        "path": [
          0,
          0,
          2,
          0
        ]
      },
      {
        "combinatorName": "Case|Inner",
        "componentName": "App",
        "emits": {
          "identifier": "DOM",
          "notification": {
            "kind": "N",
            "value": "<div><span>Component 1 : f</span><span>Component 2 : b</span></div>"
          },
          "type": 1
        },
        "id": 441,
        "logType": "runtime",
        "path": [
          0,
          0,
          2
        ]
      },
      {
        "combinatorName": "Case",
        "componentName": "App",
        "emits": {
          "identifier": "DOM",
          "notification": {
            "kind": "N",
            "value": "<div><span>Component 1 : f</span><span>Component 2 : b</span></div>"
          },
          "type": 1
        },
        "id": 442,
        "logType": "runtime",
        "path": [
          0,
          0,
          2
        ]
      },
      {
        "combinatorName": "Switch",
        "componentName": "App",
        "emits": {
          "identifier": "DOM",
          "notification": {
            "kind": "N",
            "value": "<div><div><span>Component 1 : f</span><span>Component 2 : b</span></div></div>"
          },
          "type": 1
        },
        "id": 443,
        "logType": "runtime",
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
            "value": "<div><div><div><span>Component 1 : f</span><span>Component 2 : b</span></div></div></div>"
          },
          "type": 1
        },
        "id": 444,
        "logType": "runtime",
        "path": [
          0
        ]
      },
      {
        "combinatorName": "Combine",
        "componentName": "ROOT",
        "emits": {
          "identifier": "DOM2",
          "notification": {
            "kind": "N",
            "value": "c"
          },
          "type": 0
        },
        "id": 445,
        "logType": "runtime",
        "path": [
          0
        ],
        "settings": {}
      },
      {
        "combinatorName": "Switch",
        "componentName": "App",
        "emits": {
          "identifier": "DOM2",
          "notification": {
            "kind": "N",
            "value": "c"
          },
          "type": 0
        },
        "id": 446,
        "logType": "runtime",
        "path": [
          0,
          0
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ]
        }
      },
      {
        "combinatorName": "Case",
        "componentName": "App",
        "emits": {
          "identifier": "DOM2",
          "notification": {
            "kind": "N",
            "value": "c"
          },
          "type": 0
        },
        "id": 447,
        "logType": "runtime",
        "path": [
          0,
          0,
          2
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "when": true
        }
      },
      {
        "combinatorName": "Case|Inner",
        "componentName": "App",
        "emits": {
          "identifier": "DOM2",
          "notification": {
            "kind": "N",
            "value": "c"
          },
          "type": 0
        },
        "id": 448,
        "logType": "runtime",
        "path": [
          0,
          0,
          2
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "switchedOn": true,

          "when": true
        }
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent2",
        "emits": {
          "identifier": "DOM2",
          "notification": {
            "kind": "N",
            "value": "c"
          },
          "type": 0
        },
        "id": 449,
        "logType": "runtime",
        "path": [
          0,
          0,
          2,
          1
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "switchedOn": true,

          "when": true
        }
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent2",
        "emits": {
          "identifier": "DOM",
          "notification": {
            "kind": "N",
            "value": "<span>Component 2 : c</span>"
          },
          "type": 1
        },
        "id": 450,
        "logType": "runtime",
        "path": [
          0,
          0,
          2,
          1
        ]
      },
      {
        "combinatorName": "Case",
        "componentName": "App",
        "emits": {
          "identifier": "DOM2",
          "notification": {
            "kind": "N",
            "value": "c"
          },
          "type": 0
        },
        "id": 451,
        "logType": "runtime",
        "path": [
          0,
          0,
          0
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "when": false
        }
      },
      {
        "combinatorName": "Case|Inner",
        "componentName": "App",
        "emits": {
          "identifier": "DOM2",
          "notification": {
            "kind": "N",
            "value": "c"
          },
          "type": 0
        },
        "id": 452,
        "logType": "runtime",
        "path": [
          0,
          0,
          0
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "switchedOn": false,

          "when": false
        }
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent3",
        "emits": {
          "identifier": "DOM2",
          "notification": {
            "kind": "N",
            "value": "c"
          },
          "type": 0
        },
        "id": 453,
        "logType": "runtime",
        "path": [
          0,
          0,
          0,
          0
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "switchedOn": false,

          "when": false
        }
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent3",
        "emits": {
          "identifier": "DOM",
          "notification": {
            "kind": "N",
            "value": "<span>Component 3 : c</span>"
          },
          "type": 1
        },
        "id": 454,
        "logType": "runtime",
        "path": [
          0,
          0,
          0,
          0
        ]
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent3",
        "emits": {
          "identifier": "DOM",
          "notification": {
            "error": undefined,
            "kind": "C"
          },
          "type": 1
        },
        "id": 455,
        "logType": "runtime",
        "path": [
          0,
          0,
          0,
          0
        ]
      },
      {
        "combinatorName": "Case|Inner",
        "componentName": "App",
        "emits": {
          "identifier": "DOM",
          "notification": {
            "kind": "N",
            "value": "<div><span>Component 1 : f</span><span>Component 2 : c</span></div>"
          },
          "type": 1
        },
        "id": 456,
        "logType": "runtime",
        "path": [
          0,
          0,
          2
        ]
      },
      {
        "combinatorName": "Case",
        "componentName": "App",
        "emits": {
          "identifier": "DOM",
          "notification": {
            "kind": "N",
            "value": "<div><span>Component 1 : f</span><span>Component 2 : c</span></div>"
          },
          "type": 1
        },
        "id": 457,
        "logType": "runtime",
        "path": [
          0,
          0,
          2
        ]
      },
      {
        "combinatorName": "Switch",
        "componentName": "App",
        "emits": {
          "identifier": "DOM",
          "notification": {
            "kind": "N",
            "value": "<div><div><span>Component 1 : f</span><span>Component 2 : c</span></div></div>"
          },
          "type": 1
        },
        "id": 458,
        "logType": "runtime",
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
            "value": "<div><div><div><span>Component 1 : f</span><span>Component 2 : c</span></div></div></div>"
          },
          "type": 1
        },
        "id": 459,
        "logType": "runtime",
        "path": [
          0
        ]
      },
      {
        "combinatorName": "Combine",
        "componentName": "ROOT",
        "emits": {
          "identifier": "DOM1",
          "notification": {
            "kind": "N",
            "value": "a"
          },
          "type": 0
        },
        "id": 460,
        "logType": "runtime",
        "path": [
          0
        ],
        "settings": {}
      },
      {
        "combinatorName": "Switch",
        "componentName": "App",
        "emits": {
          "identifier": "DOM1",
          "notification": {
            "kind": "N",
            "value": "a"
          },
          "type": 0
        },
        "id": 461,
        "logType": "runtime",
        "path": [
          0,
          0
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ]
        }
      },
      {
        "combinatorName": "Case",
        "componentName": "App",
        "emits": {
          "identifier": "DOM1",
          "notification": {
            "kind": "N",
            "value": "a"
          },
          "type": 0
        },
        "id": 462,
        "logType": "runtime",
        "path": [
          0,
          0,
          2
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "when": true
        }
      },
      {
        "combinatorName": "Case|Inner",
        "componentName": "App",
        "emits": {
          "identifier": "DOM1",
          "notification": {
            "kind": "N",
            "value": "a"
          },
          "type": 0
        },
        "id": 463,
        "logType": "runtime",
        "path": [
          0,
          0,
          2
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "switchedOn": true,

          "when": true
        }
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent1",
        "emits": {
          "identifier": "DOM1",
          "notification": {
            "kind": "N",
            "value": "a"
          },
          "type": 0
        },
        "id": 464,
        "logType": "runtime",
        "path": [
          0,
          0,
          2,
          0
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "switchedOn": true,

          "when": true
        }
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent1",
        "emits": {
          "identifier": "DOM",
          "notification": {
            "kind": "N",
            "value": "<span>Component 1 : a</span>"
          },
          "type": 1
        },
        "id": 465,
        "logType": "runtime",
        "path": [
          0,
          0,
          2,
          0
        ]
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent1",
        "emits": {
          "identifier": "DOM",
          "notification": {
            "error": undefined,
            "kind": "C"
          },
          "type": 1
        },
        "id": 466,
        "logType": "runtime",
        "path": [
          0,
          0,
          2,
          0
        ]
      },
      {
        "combinatorName": "Case|Inner",
        "componentName": "App",
        "emits": {
          "identifier": "DOM1",
          "notification": {
            "kind": "N",
            "value": "a"
          },
          "type": 0
        },
        "id": 467,
        "logType": "runtime",
        "path": [
          0,
          0,
          2
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "switchedOn": true,

          "when": true
        }
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent1",
        "emits": {
          "identifier": "DOM1",
          "notification": {
            "kind": "N",
            "value": "a"
          },
          "type": 0
        },
        "id": 468,
        "logType": "runtime",
        "path": [
          0,
          0,
          2,
          0
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "switchedOn": true,

          "when": true
        }
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent1",
        "emits": {
          "identifier": "DOM",
          "notification": {
            "kind": "N",
            "value": "<span>Component 1 : a</span>"
          },
          "type": 1
        },
        "id": 469,
        "logType": "runtime",
        "path": [
          0,
          0,
          2,
          0
        ]
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent1",
        "emits": {
          "identifier": "DOM",
          "notification": {
            "error": undefined,
            "kind": "C"
          },
          "type": 1
        },
        "id": 470,
        "logType": "runtime",
        "path": [
          0,
          0,
          2,
          0
        ]
      },
      {
        "combinatorName": "Case|Inner",
        "componentName": "App",
        "emits": {
          "identifier": "DOM1",
          "notification": {
            "kind": "N",
            "value": "a"
          },
          "type": 0
        },
        "id": 471,
        "logType": "runtime",
        "path": [
          0,
          0,
          2
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "switchedOn": true,

          "when": true
        }
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent1",
        "emits": {
          "identifier": "DOM1",
          "notification": {
            "kind": "N",
            "value": "a"
          },
          "type": 0
        },
        "id": 472,
        "logType": "runtime",
        "path": [
          0,
          0,
          2,
          0
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "switchedOn": true,

          "when": true
        }
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent1",
        "emits": {
          "identifier": "DOM",
          "notification": {
            "kind": "N",
            "value": "<span>Component 1 : a</span>"
          },
          "type": 1
        },
        "id": 473,
        "logType": "runtime",
        "path": [
          0,
          0,
          2,
          0
        ]
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent1",
        "emits": {
          "identifier": "DOM",
          "notification": {
            "error": undefined,
            "kind": "C"
          },
          "type": 1
        },
        "id": 474,
        "logType": "runtime",
        "path": [
          0,
          0,
          2,
          0
        ]
      },
      {
        "combinatorName": "Case|Inner",
        "componentName": "App",
        "emits": {
          "identifier": "DOM1",
          "notification": {
            "kind": "N",
            "value": "a"
          },
          "type": 0
        },
        "id": 475,
        "logType": "runtime",
        "path": [
          0,
          0,
          2
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "switchedOn": true,

          "when": true
        }
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent1",
        "emits": {
          "identifier": "DOM1",
          "notification": {
            "kind": "N",
            "value": "a"
          },
          "type": 0
        },
        "id": 476,
        "logType": "runtime",
        "path": [
          0,
          0,
          2,
          0
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "switchedOn": true,

          "when": true
        }
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent1",
        "emits": {
          "identifier": "DOM",
          "notification": {
            "kind": "N",
            "value": "<span>Component 1 : a</span>"
          },
          "type": 1
        },
        "id": 477,
        "logType": "runtime",
        "path": [
          0,
          0,
          2,
          0
        ]
      },
      {
        "combinatorName": "Case|Inner",
        "componentName": "App",
        "emits": {
          "identifier": "DOM",
          "notification": {
            "kind": "N",
            "value": "<div><span>Component 1 : a</span><span>Component 2 : c</span></div>"
          },
          "type": 1
        },
        "id": 478,
        "logType": "runtime",
        "path": [
          0,
          0,
          2
        ]
      },
      {
        "combinatorName": "Case",
        "componentName": "App",
        "emits": {
          "identifier": "DOM",
          "notification": {
            "kind": "N",
            "value": "<div><span>Component 1 : a</span><span>Component 2 : c</span></div>"
          },
          "type": 1
        },
        "id": 479,
        "logType": "runtime",
        "path": [
          0,
          0,
          2
        ]
      },
      {
        "combinatorName": "Combine",
        "componentName": "ROOT",
        "emits": {
          "identifier": "DOM2",
          "notification": {
            "kind": "N",
            "value": "d"
          },
          "type": 0
        },
        "id": 480,
        "logType": "runtime",
        "path": [
          0
        ],
        "settings": {}
      },
      {
        "combinatorName": "Switch",
        "componentName": "App",
        "emits": {
          "identifier": "DOM2",
          "notification": {
            "kind": "N",
            "value": "d"
          },
          "type": 0
        },
        "id": 481,
        "logType": "runtime",
        "path": [
          0,
          0
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ]
        }
      },
      {
        "combinatorName": "Case",
        "componentName": "App",
        "emits": {
          "identifier": "DOM2",
          "notification": {
            "kind": "N",
            "value": "d"
          },
          "type": 0
        },
        "id": 482,
        "logType": "runtime",
        "path": [
          0,
          0,
          2
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "when": true
        }
      },
      {
        "combinatorName": "Case|Inner",
        "componentName": "App",
        "emits": {
          "identifier": "DOM2",
          "notification": {
            "kind": "N",
            "value": "d"
          },
          "type": 0
        },
        "id": 483,
        "logType": "runtime",
        "path": [
          0,
          0,
          2
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "switchedOn": true,

          "when": true
        }
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent2",
        "emits": {
          "identifier": "DOM2",
          "notification": {
            "kind": "N",
            "value": "d"
          },
          "type": 0
        },
        "id": 484,
        "logType": "runtime",
        "path": [
          0,
          0,
          2,
          1
        ],
        "settings": {
          "as": "switchedOn",
          "on": "sweatch$",
          "sinkNames": [
            "DOM",
            "a",
            "b",
            "c"
          ],
          "switchedOn": true,

          "when": true
        }
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent2",
        "emits": {
          "identifier": "DOM",
          "notification": {
            "kind": "N",
            "value": "<span>Component 2 : d</span>"
          },
          "type": 1
        },
        "id": 485,
        "logType": "runtime",
        "path": [
          0,
          0,
          2,
          1
        ]
      },
      {
        "combinatorName": undefined,
        "componentName": "childComponent2",
        "emits": {
          "identifier": "DOM",
          "notification": {
            "error": undefined,
            "kind": "C"
          },
          "type": 1
        },
        "id": 486,
        "logType": "runtime",
        "path": [
          0,
          0,
          2,
          1
        ]
      },
      {
        "combinatorName": "Switch",
        "componentName": "App",
        "emits": {
          "identifier": "DOM",
          "notification": {
            "kind": "N",
            "value": "<div><div><span>Component 1 : a</span><span>Component 2 : c</span></div></div>"
          },
          "type": 1
        },
        "id": 487,
        "logType": "runtime",
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
            "value": "<div><div><div><span>Component 1 : a</span><span>Component 2 : c</span></div></div></div>"
          },
          "type": 1
        },
        "id": 488,
        "logType": "runtime",
        "path": [
          0
        ]
      },
      {
        "combinatorName": "Case|Inner",
        "componentName": "App",
        "emits": {
          "identifier": "DOM",
          "notification": {
            "kind": "N",
            "value": "<div><span>Component 1 : a</span><span>Component 2 : d</span></div>"
          },
          "type": 1
        },
        "id": 489,
        "logType": "runtime",
        "path": [
          0,
          0,
          2
        ]
      },
      {
        "combinatorName": "Case",
        "componentName": "App",
        "emits": {
          "identifier": "DOM",
          "notification": {
            "kind": "N",
            "value": "<div><span>Component 1 : a</span><span>Component 2 : d</span></div>"
          },
          "type": 1
        },
        "id": 490,
        "logType": "runtime",
        "path": [
          0,
          0,
          2
        ]
      },
      {
        "combinatorName": "Switch",
        "componentName": "App",
        "emits": {
          "identifier": "DOM",
          "notification": {
            "kind": "N",
            "value": "<div><div><span>Component 1 : a</span><span>Component 2 : d</span></div></div>"
          },
          "type": 1
        },
        "id": 491,
        "logType": "runtime",
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
            "value": "<div><div><div><span>Component 1 : a</span><span>Component 2 : d</span></div></div></div>"
          },
          "type": 1
        },
        "id": 492,
        "logType": "runtime",
        "path": [
          0
        ]
      }
    ]
  ];

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
      assert.deepEqual(
        removeWhenField(traces),
        expectedGraphs.reduce((acc, expectedGraph, index ) => {
          return acc.concat(expectedGraph, expectedTraces[index])
        }, []),
        `Traces are produced as expected!`);
      done()
    });
});


// TODO : inject sources, try to use default function for unknown sources
// use defaultTraceSpecs : [source, sink] for this one, so I test it
// then think about how to declare behaviour and event in a more friendly way

// TODO : change computeSinks signature to directly pass componentTree, then adjust examples... and doc... so have
// versioned doc too...
// TODO : ListOf remove listActionsFromChildrenSinks : signature has changd, and anyways it is obslete deprecated
// TODO : document that mergeSinks in this version can have null as parentSinks
// TODO : in the log analysis, be careful that path is duplicated (which is good) but messages also are
// so Foreach content -> Foreach|Inner same content but new id
// TODO : in the draw of graph, I can desambiguate in and out trace with the path
// ForEach graph structure several times will ahve the same lines..
// we know about recreation of branchs of the tree when a graph structure appears after a runtime portion, path
// gives the location of the branch
// TODO : also test for error occuring in the component tree
// component do not complete per se, so hard to test
