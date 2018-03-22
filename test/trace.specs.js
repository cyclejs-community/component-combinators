import * as QUnit from "qunitjs"
import * as Rx from 'rx'
import { runTestScenario } from '../testing/src/runTestScenario'
import { convertVNodesToHTML } from "../utils/src/index"
import { flatten, identity, omit, pipe, set } from 'ramda'
import { addPrefix, DOM_SINK, EmptyComponent, format, vLift } from "../utils/src"
import { resetGraphCounter, traceApp } from "../tracing/src"
import { componentNameInSettings, traceDOMsinkFn, traceEventSinkFn, traceEventSourceFn } from "../tracing/src/helpers"
import { div, h, span } from 'cycle-snabbdom'
import { iframeId, iframeSource, TRACE_BOOTSTRAP_NAME } from "../tracing/src/properties"
import { Combine } from "../src/components/Combine"
import { InjectSourcesAndSettings } from "../src"
import { ForEach } from "../src/components/ForEach"
import { ListOf } from "../src/components/ListOf/ListOf"
import { Pipe } from "../src/components/Pipe/Pipe"

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
// - built with a mix of different combinators (InSlot, Pipe, ForEach/Switch, InjectSourcesAndSettings in particular to
// check against)
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

function wrapInTraceIframe(arrHtml) {
  return arrHtml.map(html => ([
    `<div>`,
    `<iframe id=\"devtool\" src=\"devtool.html\" style=\"width: 450px; height: 200px\"></iframe>`,
    `<div>`,
    html,
    `</div>`,
    `</div>`
  ].join('')))
}

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

QUnit.test("main case - ListOf - component tree depth 1 - no items", function exec_test(assert) {
  resetGraphCounter();
  const done = assert.async(2);
  const traces = [];
  const listOfSettings = {
    list: 'items',
    as: 'item',
    items: [],
  };

  const childComponent = function childComponent1(sources, settings) {
    return {
      [DOM_SINK]: sources.DOM1
        .tap(console.warn.bind(console, `DOM for list component ${settings.listIndex}: `))
        .map(
          x => h('span', {}, `List Component ${settings.listIndex} : ${format(settings.item)} - ${x}`)),
      a: sources.userAction$.map(x => `Component ${settings.listIndex} - user action : ${x}`)
    }
  };
  const listOfComponent = ListOf(set(componentNameInSettings, APP_NAME, listOfSettings), [
    EmptyComponent,
    childComponent,
  ]);
  const tracedApp = traceApp({
    _trace: {
      traceSpecs: {
        [A_DRIVER]: [traceEventSourceFn, traceEventSinkFn],
        [ANOTHER_DRIVER]: [traceEventSourceFn, traceEventSinkFn],
        // NOTE : no need to trace the DOM source here as `AtomicComponentApp` does not use DOM source
        [DOM_SINK]: [identity, traceDOMsinkFn]
      },
      defaultTraceSpecs: [traceEventSourceFn, traceEventSinkFn],
      sendMessage: msg => traces.push(msg)
    },
    _helpers: { getId: getId(0) }
  }, listOfComponent);

  const inputs = [
    { DOM1: { diagram: '-a--b--c-----------' } },
    {
      userAction$: {
        diagram: 'abc-b-ac--ab---c',
        values: { a: 'click', b: 'select', c: 'hover', }
      }
    },
  ];

  /** @type TestResults */
    // First <div/> is the empty component, surrounding div is the ListOf wrapper, same as if
    // there would be x > 0 items in the list
  const expectedMessages = {
      DOM: {
        outputs: [
          "<div><iframe id=\"devtool\" src=\"devtool.html\" style=\"width: 450px; height: 200px\"></iframe><div><div><div></div></div></div></div>"
        ],
        successMessage: 'sink DOM produces the expected values',
        transform: pipe(convertVNodesToHTML)
      },
    }

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
      "combinatorName": "ListOf",
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
      "combinatorName": "ListOf|Inner",
      "componentName": "App",
      "id": 2,
      "isContainerComponent": false,
      "logType": "graph_structure",
      "path": [
        0,
        0
      ]
    },
    {
      "combinatorName": undefined,
      "componentName": "EmptyComponent",
      "id": 3,
      "isContainerComponent": false,
      "logType": "graph_structure",
      "path": [
        0,
        0,
        0
      ]
    }
  ];
  const expectedTraces1 = [
    {
      "combinatorName": undefined,
      "componentName": "EmptyComponent",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div></div>"
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
      "combinatorName": "ListOf|Inner",
      "componentName": "App",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div><div></div></div>"
        },
        "type": 1
      },
      "id": 1,
      "logType": "runtime",
      "path": [
        0,
        0
      ]
    },
    {
      "combinatorName": undefined,
      "componentName": "EmptyComponent",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "error": undefined,
          "kind": "C"
        },
        "type": 1
      },
      "id": 2,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": "ListOf|Inner",
      "componentName": "App",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "error": undefined,
          "kind": "C"
        },
        "type": 1
      },
      "id": 3,
      "logType": "runtime",
      "path": [
        0,
        0
      ]
    },
    {
      "combinatorName": "ListOf",
      "componentName": "App",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div><div></div></div>"
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
          "value": "<div><div><div></div></div></div>"
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
      "combinatorName": "ListOf",
      "componentName": "App",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "error": undefined,
          "kind": "C"
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
          "error": undefined,
          "kind": "C"
        },
        "type": 1
      },
      "id": 7,
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
//         flatten([expectedGraph1, expectedTraces1, expectedGraph2, expectedTraces2, expectedGraph3, expectedTraces3]),
        flatten([expectedGraph1, expectedTraces1]),
        `Traces are produced as expected!`);
      done()
    });
});

QUnit.test("main case - ListOf - component tree depth 1 - 1 items", function exec_test(assert) {
  resetGraphCounter();
  const done = assert.async(3);
  const traces = [];
  const item1 = 'ITEM1';
  const listOfSettings = {
    list: 'items',
    as: 'item',
    items: [item1],
  };

  const childComponent = function childComponent1(sources, settings) {
    return {
      [DOM_SINK]: sources.DOM1
        .tap(console.warn.bind(console, `DOM for list component ${settings.listIndex}: `))
        .map(
          x => h('span', {}, `List Component ${settings.listIndex} : ${format(settings.item)} - ${x}`)),
      a: sources.userAction$.map(x => `Component ${settings.listIndex} - user action : ${x}`)
    }
  };
  const listOfComponent = ListOf(set(componentNameInSettings, APP_NAME, listOfSettings), [
    EmptyComponent,
    childComponent,
  ]);
  const tracedApp = traceApp({
    _trace: {
      traceSpecs: {
        [A_DRIVER]: [traceEventSourceFn, traceEventSinkFn],
        [ANOTHER_DRIVER]: [traceEventSourceFn, traceEventSinkFn],
        // NOTE : no need to trace the DOM source here as `AtomicComponentApp` does not use DOM source
        [DOM_SINK]: [identity, traceDOMsinkFn]
      },
      defaultTraceSpecs: [traceEventSourceFn, traceEventSinkFn],
      sendMessage: msg => traces.push(msg)
    },
    _helpers: { getId: getId(0) }
  }, listOfComponent);

  const inputs = [
    { DOM1: { diagram: '-a--b--------------' } },
    {
      userAction$: {
        diagram: 'ab--------------',
        values: { a: 'click', b: 'select', c: 'hover', }
      }
    },
  ];

  /** @type TestResults */
  const expectedMessages = {
    DOM: {
      // NOTE : one can see here the `combineLatest` in action : a-a-a ; b-a-a; b-b-a; b-b-b
      outputs: [
        "<div><iframe id=\"devtool\" src=\"devtool.html\" style=\"width: 450px; height: 200px\"></iframe><div><div><span>List Component 0 : ITEM1 - a</span></div></div></div>",
        "<div><iframe id=\"devtool\" src=\"devtool.html\" style=\"width: 450px; height: 200px\"></iframe><div><div><span>List Component 0 : ITEM1 - b</span></div></div></div>"
      ],
      successMessage: 'sink DOM produces the expected values',
      // NOTE : I need to keep an eye on the html to check the good behaviour, cannot strip the tags
      transform: pipe(convertVNodesToHTML)
    },
    a: {
      outputs: [
        "Component 0 - user action : click",
        "Component 0 - user action : select"],
      successMessage: 'sink a produces the expected values',
    },
  }

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
      "combinatorName": "ListOf",
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
      "combinatorName": "ListOf|Inner",
      "componentName": "App",
      "id": 2,
      "isContainerComponent": false,
      "logType": "graph_structure",
      "path": [
        0,
        0
      ]
    },
    {
      "combinatorName": "ListOf|Inner|Indexed",
      "componentName": "App",
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
      "componentName": "childComponent1",
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
  const expectedTraces1 = [
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
      "id": 0,
      "logType": "runtime",
      "path": [
        0
      ],
      "settings": {}
    },
    {
      "combinatorName": "ListOf",
      "componentName": "App",
      "emits": {
        "identifier": "userAction$",
        "notification": {
          "kind": "N",
          "value": "click"
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
        "as": "item",
        "items": [
          "ITEM1"
        ],
        "list": "items"
      }
    },
    {
      "combinatorName": "ListOf|Inner",
      "componentName": "App",
      "emits": {
        "identifier": "userAction$",
        "notification": {
          "kind": "N",
          "value": "click"
        },
        "type": 0
      },
      "id": 2,
      "logType": "runtime",
      "path": [
        0,
        0
      ],
      "settings": {
        "as": "item",
        "items": [
          "ITEM1"
        ],
        "list": "items"
      }
    },
    {
      "combinatorName": "ListOf|Inner|Indexed",
      "componentName": "App",
      "emits": {
        "identifier": "userAction$",
        "notification": {
          "kind": "N",
          "value": "click"
        },
        "type": 0
      },
      "id": 3,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ],
      "settings": {
        "as": "item",
        "item": "ITEM1",
        "items": [
          "ITEM1"
        ],
        "list": "items",
        "listIndex": 0
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
      "id": 4,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        0
      ],
      "settings": {
        "as": "item",
        "item": "ITEM1",
        "items": [
          "ITEM1"
        ],
        "list": "items",
        "listIndex": 0
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "childComponent1",
      "emits": {
        "identifier": "a",
        "notification": {
          "kind": "N",
          "value": "Component 0 - user action : click"
        },
        "type": 1
      },
      "id": 5,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": "ListOf|Inner|Indexed",
      "componentName": "App",
      "emits": {
        "identifier": "a",
        "notification": {
          "kind": "N",
          "value": "Component 0 - user action : click"
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
      "combinatorName": "ListOf|Inner",
      "componentName": "App",
      "emits": {
        "identifier": "a",
        "notification": {
          "kind": "N",
          "value": "Component 0 - user action : click"
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
      "combinatorName": "ListOf",
      "componentName": "App",
      "emits": {
        "identifier": "a",
        "notification": {
          "kind": "N",
          "value": "Component 0 - user action : click"
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
        "identifier": "a",
        "notification": {
          "kind": "N",
          "value": "Component 0 - user action : click"
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
        "identifier": "DOM1",
        "notification": {
          "kind": "N",
          "value": "a"
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
      "combinatorName": "ListOf",
      "componentName": "App",
      "emits": {
        "identifier": "DOM1",
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
        0
      ],
      "settings": {
        "as": "item",
        "items": [
          "ITEM1"
        ],
        "list": "items"
      }
    },
    {
      "combinatorName": "ListOf|Inner",
      "componentName": "App",
      "emits": {
        "identifier": "DOM1",
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
        0
      ],
      "settings": {
        "as": "item",
        "items": [
          "ITEM1"
        ],
        "list": "items"
      }
    },
    {
      "combinatorName": "ListOf|Inner|Indexed",
      "componentName": "App",
      "emits": {
        "identifier": "DOM1",
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
        0
      ],
      "settings": {
        "as": "item",
        "item": "ITEM1",
        "items": [
          "ITEM1"
        ],
        "list": "items",
        "listIndex": 0
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
      "id": 14,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        0
      ],
      "settings": {
        "as": "item",
        "item": "ITEM1",
        "items": [
          "ITEM1"
        ],
        "list": "items",
        "listIndex": 0
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "childComponent1",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<span>List Component 0 : ITEM1 - a</span>"
        },
        "type": 1
      },
      "id": 15,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": "ListOf|Inner|Indexed",
      "componentName": "App",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<span>List Component 0 : ITEM1 - a</span>"
        },
        "type": 1
      },
      "id": 16,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": "ListOf|Inner",
      "componentName": "App",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div><span>List Component 0 : ITEM1 - a</span></div>"
        },
        "type": 1
      },
      "id": 17,
      "logType": "runtime",
      "path": [
        0,
        0
      ]
    },
    {
      "combinatorName": "ListOf",
      "componentName": "App",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div><span>List Component 0 : ITEM1 - a</span></div>"
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
          "value": "<div><div><span>List Component 0 : ITEM1 - a</span></div></div>"
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
      "id": 20,
      "logType": "runtime",
      "path": [
        0
      ],
      "settings": {}
    },
    {
      "combinatorName": "ListOf",
      "componentName": "App",
      "emits": {
        "identifier": "userAction$",
        "notification": {
          "kind": "N",
          "value": "select"
        },
        "type": 0
      },
      "id": 21,
      "logType": "runtime",
      "path": [
        0,
        0
      ],
      "settings": {
        "as": "item",
        "items": [
          "ITEM1"
        ],
        "list": "items"
      }
    },
    {
      "combinatorName": "ListOf|Inner",
      "componentName": "App",
      "emits": {
        "identifier": "userAction$",
        "notification": {
          "kind": "N",
          "value": "select"
        },
        "type": 0
      },
      "id": 22,
      "logType": "runtime",
      "path": [
        0,
        0
      ],
      "settings": {
        "as": "item",
        "items": [
          "ITEM1"
        ],
        "list": "items"
      }
    },
    {
      "combinatorName": "ListOf|Inner|Indexed",
      "componentName": "App",
      "emits": {
        "identifier": "userAction$",
        "notification": {
          "kind": "N",
          "value": "select"
        },
        "type": 0
      },
      "id": 23,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ],
      "settings": {
        "as": "item",
        "item": "ITEM1",
        "items": [
          "ITEM1"
        ],
        "list": "items",
        "listIndex": 0
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "childComponent1",
      "emits": {
        "identifier": "userAction$",
        "notification": {
          "kind": "N",
          "value": "select"
        },
        "type": 0
      },
      "id": 24,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        0
      ],
      "settings": {
        "as": "item",
        "item": "ITEM1",
        "items": [
          "ITEM1"
        ],
        "list": "items",
        "listIndex": 0
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "childComponent1",
      "emits": {
        "identifier": "a",
        "notification": {
          "kind": "N",
          "value": "Component 0 - user action : select"
        },
        "type": 1
      },
      "id": 25,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": "ListOf|Inner|Indexed",
      "componentName": "App",
      "emits": {
        "identifier": "a",
        "notification": {
          "kind": "N",
          "value": "Component 0 - user action : select"
        },
        "type": 1
      },
      "id": 26,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": "ListOf|Inner",
      "componentName": "App",
      "emits": {
        "identifier": "a",
        "notification": {
          "kind": "N",
          "value": "Component 0 - user action : select"
        },
        "type": 1
      },
      "id": 27,
      "logType": "runtime",
      "path": [
        0,
        0
      ]
    },
    {
      "combinatorName": "ListOf",
      "componentName": "App",
      "emits": {
        "identifier": "a",
        "notification": {
          "kind": "N",
          "value": "Component 0 - user action : select"
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
        "identifier": "a",
        "notification": {
          "kind": "N",
          "value": "Component 0 - user action : select"
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
      "id": 30,
      "logType": "runtime",
      "path": [
        0
      ],
      "settings": {}
    },
    {
      "combinatorName": "ListOf",
      "componentName": "App",
      "emits": {
        "identifier": "DOM1",
        "notification": {
          "kind": "N",
          "value": "b"
        },
        "type": 0
      },
      "id": 31,
      "logType": "runtime",
      "path": [
        0,
        0
      ],
      "settings": {
        "as": "item",
        "items": [
          "ITEM1"
        ],
        "list": "items"
      }
    },
    {
      "combinatorName": "ListOf|Inner",
      "componentName": "App",
      "emits": {
        "identifier": "DOM1",
        "notification": {
          "kind": "N",
          "value": "b"
        },
        "type": 0
      },
      "id": 32,
      "logType": "runtime",
      "path": [
        0,
        0
      ],
      "settings": {
        "as": "item",
        "items": [
          "ITEM1"
        ],
        "list": "items"
      }
    },
    {
      "combinatorName": "ListOf|Inner|Indexed",
      "componentName": "App",
      "emits": {
        "identifier": "DOM1",
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
        0
      ],
      "settings": {
        "as": "item",
        "item": "ITEM1",
        "items": [
          "ITEM1"
        ],
        "list": "items",
        "listIndex": 0
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
      "id": 34,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        0
      ],
      "settings": {
        "as": "item",
        "item": "ITEM1",
        "items": [
          "ITEM1"
        ],
        "list": "items",
        "listIndex": 0
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "childComponent1",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<span>List Component 0 : ITEM1 - b</span>"
        },
        "type": 1
      },
      "id": 35,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": "ListOf|Inner|Indexed",
      "componentName": "App",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<span>List Component 0 : ITEM1 - b</span>"
        },
        "type": 1
      },
      "id": 36,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": "ListOf|Inner",
      "componentName": "App",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div><span>List Component 0 : ITEM1 - b</span></div>"
        },
        "type": 1
      },
      "id": 37,
      "logType": "runtime",
      "path": [
        0,
        0
      ]
    },
    {
      "combinatorName": "ListOf",
      "componentName": "App",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div><span>List Component 0 : ITEM1 - b</span></div>"
        },
        "type": 1
      },
      "id": 38,
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
          "value": "<div><div><span>List Component 0 : ITEM1 - b</span></div></div>"
        },
        "type": 1
      },
      "id": 39,
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
//         flatten([expectedGraph1, expectedTraces1, expectedGraph2, expectedTraces2, expectedGraph3, expectedTraces3]),
        flatten([expectedGraph1, expectedTraces1]),
        `Traces are produced as expected!`);
      done()
    });
});

QUnit.test("main case - ListOf - component tree depth 1 - 2 items", function exec_test(assert) {
  resetGraphCounter();
  const done = assert.async(3);
  const traces = [];
  const item1 = 'ITEM1';
  const listOfSettings = {
    list: 'items',
    as: 'item',
    items: [item1, 'kk'],
  };

  const childComponent = function childComponent1(sources, settings) {
    return {
      [DOM_SINK]: sources.DOM1
        .tap(console.warn.bind(console, `DOM for list component ${settings.listIndex}: `))
        .map(
          x => h('span', {}, `List Component ${settings.listIndex} : ${format(settings.item)} - ${x}`)),
      a: sources.userAction$.map(x => `Component ${settings.listIndex} - user action : ${x}`)
    }
  };
  const listOfComponent = ListOf(set(componentNameInSettings, APP_NAME, listOfSettings), [
    EmptyComponent,
    childComponent,
  ]);
  const tracedApp = traceApp({
    _trace: {
      traceSpecs: {
        [A_DRIVER]: [traceEventSourceFn, traceEventSinkFn],
        [ANOTHER_DRIVER]: [traceEventSourceFn, traceEventSinkFn],
        // NOTE : no need to trace the DOM source here as `AtomicComponentApp` does not use DOM source
        [DOM_SINK]: [identity, traceDOMsinkFn]
      },
      defaultTraceSpecs: [traceEventSourceFn, traceEventSinkFn],
      sendMessage: msg => traces.push(msg)
    },
    _helpers: { getId: getId(0) }
  }, listOfComponent);

  const inputs = [
    { DOM1: { diagram: '-a--b--------------' } },
    {
      userAction$: {
        diagram: 'ab--------------',
        values: { a: 'click', b: 'select', c: 'hover', }
      }
    },
  ];

  /** @type TestResults */
  const expectedMessages = {
    DOM: {
      // NOTE : one can see here the `combineLatest` in action : a-a-a ; b-a-a; b-b-a; b-b-b
      outputs: [
        "<div><iframe id=\"devtool\" src=\"devtool.html\" style=\"width: 450px; height: 200px\"></iframe><div><div><span>List Component 0 : ITEM1 - a</span><span>List Component 1 : kk - a</span></div></div></div>",
        "<div><iframe id=\"devtool\" src=\"devtool.html\" style=\"width: 450px; height: 200px\"></iframe><div><div><span>List Component 0 : ITEM1 - b</span><span>List Component 1 : kk - a</span></div></div></div>",
        "<div><iframe id=\"devtool\" src=\"devtool.html\" style=\"width: 450px; height: 200px\"></iframe><div><div><span>List Component 0 : ITEM1 - b</span><span>List Component 1 : kk - b</span></div></div></div>"
      ],
      successMessage: 'sink DOM produces the expected values',
      // NOTE : I need to keep an eye on the html to check the good behaviour, cannot strip the tags
      transform: pipe(convertVNodesToHTML)
    },
    a: {
      outputs: [
        "Component 0 - user action : click",
        "Component 1 - user action : click",
        "Component 0 - user action : select",
        "Component 1 - user action : select"],
      successMessage: 'sink a produces the expected values',
    },
  }

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
      "combinatorName": "ListOf",
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
      "combinatorName": "ListOf|Inner",
      "componentName": "App",
      "id": 2,
      "isContainerComponent": false,
      "logType": "graph_structure",
      "path": [
        0,
        0
      ]
    },
    {
      "combinatorName": "ListOf|Inner|Indexed",
      "componentName": "App",
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
      "componentName": "childComponent1",
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
    {
      "combinatorName": "ListOf|Inner|Indexed",
      "componentName": "App",
      "id": 5,
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
      "componentName": "childComponent1",
      "id": 6,
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
  const expectedTraces1 = [
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
      "id": 0,
      "logType": "runtime",
      "path": [
        0
      ],
      "settings": {}
    },
    {
      "combinatorName": "ListOf",
      "componentName": "App",
      "emits": {
        "identifier": "userAction$",
        "notification": {
          "kind": "N",
          "value": "click"
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
        "as": "item",
        "items": [
          "ITEM1",
          "kk"
        ],
        "list": "items"
      }
    },
    {
      "combinatorName": "ListOf|Inner",
      "componentName": "App",
      "emits": {
        "identifier": "userAction$",
        "notification": {
          "kind": "N",
          "value": "click"
        },
        "type": 0
      },
      "id": 2,
      "logType": "runtime",
      "path": [
        0,
        0
      ],
      "settings": {
        "as": "item",
        "items": [
          "ITEM1",
          "kk"
        ],
        "list": "items"
      }
    },
    {
      "combinatorName": "ListOf|Inner|Indexed",
      "componentName": "App",
      "emits": {
        "identifier": "userAction$",
        "notification": {
          "kind": "N",
          "value": "click"
        },
        "type": 0
      },
      "id": 3,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ],
      "settings": {
        "as": "item",
        "item": "ITEM1",
        "items": [
          "ITEM1",
          "kk"
        ],
        "list": "items",
        "listIndex": 0
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
      "id": 4,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        0
      ],
      "settings": {
        "as": "item",
        "item": "ITEM1",
        "items": [
          "ITEM1",
          "kk"
        ],
        "list": "items",
        "listIndex": 0
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "childComponent1",
      "emits": {
        "identifier": "a",
        "notification": {
          "kind": "N",
          "value": "Component 0 - user action : click"
        },
        "type": 1
      },
      "id": 5,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": "ListOf|Inner|Indexed",
      "componentName": "App",
      "emits": {
        "identifier": "a",
        "notification": {
          "kind": "N",
          "value": "Component 0 - user action : click"
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
      "combinatorName": "ListOf|Inner",
      "componentName": "App",
      "emits": {
        "identifier": "a",
        "notification": {
          "kind": "N",
          "value": "Component 0 - user action : click"
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
      "combinatorName": "ListOf",
      "componentName": "App",
      "emits": {
        "identifier": "a",
        "notification": {
          "kind": "N",
          "value": "Component 0 - user action : click"
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
        "identifier": "a",
        "notification": {
          "kind": "N",
          "value": "Component 0 - user action : click"
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
      "combinatorName": "ListOf|Inner|Indexed",
      "componentName": "App",
      "emits": {
        "identifier": "userAction$",
        "notification": {
          "kind": "N",
          "value": "click"
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
        "as": "item",
        "item": "kk",
        "items": [
          "ITEM1",
          "kk"
        ],
        "list": "items",
        "listIndex": 1
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
      "id": 11,
      "logType": "runtime",
      "path": [
        0,
        0,
        1,
        0
      ],
      "settings": {
        "as": "item",
        "item": "kk",
        "items": [
          "ITEM1",
          "kk"
        ],
        "list": "items",
        "listIndex": 1
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "childComponent1",
      "emits": {
        "identifier": "a",
        "notification": {
          "kind": "N",
          "value": "Component 1 - user action : click"
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
      "combinatorName": "ListOf|Inner|Indexed",
      "componentName": "App",
      "emits": {
        "identifier": "a",
        "notification": {
          "kind": "N",
          "value": "Component 1 - user action : click"
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
      "combinatorName": "ListOf|Inner",
      "componentName": "App",
      "emits": {
        "identifier": "a",
        "notification": {
          "kind": "N",
          "value": "Component 1 - user action : click"
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
      "combinatorName": "ListOf",
      "componentName": "App",
      "emits": {
        "identifier": "a",
        "notification": {
          "kind": "N",
          "value": "Component 1 - user action : click"
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
          "value": "Component 1 - user action : click"
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
        "identifier": "DOM1",
        "notification": {
          "kind": "N",
          "value": "a"
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
      "combinatorName": "ListOf",
      "componentName": "App",
      "emits": {
        "identifier": "DOM1",
        "notification": {
          "kind": "N",
          "value": "a"
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
        "as": "item",
        "items": [
          "ITEM1",
          "kk"
        ],
        "list": "items"
      }
    },
    {
      "combinatorName": "ListOf|Inner",
      "componentName": "App",
      "emits": {
        "identifier": "DOM1",
        "notification": {
          "kind": "N",
          "value": "a"
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
        "as": "item",
        "items": [
          "ITEM1",
          "kk"
        ],
        "list": "items"
      }
    },
    {
      "combinatorName": "ListOf|Inner|Indexed",
      "componentName": "App",
      "emits": {
        "identifier": "DOM1",
        "notification": {
          "kind": "N",
          "value": "a"
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
        "as": "item",
        "item": "ITEM1",
        "items": [
          "ITEM1",
          "kk"
        ],
        "list": "items",
        "listIndex": 0
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
      "id": 21,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        0
      ],
      "settings": {
        "as": "item",
        "item": "ITEM1",
        "items": [
          "ITEM1",
          "kk"
        ],
        "list": "items",
        "listIndex": 0
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "childComponent1",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<span>List Component 0 : ITEM1 - a</span>"
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
      "combinatorName": "ListOf|Inner|Indexed",
      "componentName": "App",
      "emits": {
        "identifier": "DOM1",
        "notification": {
          "kind": "N",
          "value": "a"
        },
        "type": 0
      },
      "id": 23,
      "logType": "runtime",
      "path": [
        0,
        0,
        1
      ],
      "settings": {
        "as": "item",
        "item": "kk",
        "items": [
          "ITEM1",
          "kk"
        ],
        "list": "items",
        "listIndex": 1
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
      "id": 24,
      "logType": "runtime",
      "path": [
        0,
        0,
        1,
        0
      ],
      "settings": {
        "as": "item",
        "item": "kk",
        "items": [
          "ITEM1",
          "kk"
        ],
        "list": "items",
        "listIndex": 1
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "childComponent1",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<span>List Component 1 : kk - a</span>"
        },
        "type": 1
      },
      "id": 25,
      "logType": "runtime",
      "path": [
        0,
        0,
        1,
        0
      ]
    },
    {
      "combinatorName": "ListOf|Inner|Indexed",
      "componentName": "App",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<span>List Component 0 : ITEM1 - a</span>"
        },
        "type": 1
      },
      "id": 26,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": "ListOf|Inner|Indexed",
      "componentName": "App",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<span>List Component 1 : kk - a</span>"
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
      "combinatorName": "ListOf|Inner",
      "componentName": "App",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div><span>List Component 0 : ITEM1 - a</span><span>List Component 1 : kk - a</span></div>"
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
      "combinatorName": "ListOf",
      "componentName": "App",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div><span>List Component 0 : ITEM1 - a</span><span>List Component 1 : kk - a</span></div>"
        },
        "type": 1
      },
      "id": 29,
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
          "value": "<div><div><span>List Component 0 : ITEM1 - a</span><span>List Component 1 : kk - a</span></div></div>"
        },
        "type": 1
      },
      "id": 30,
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
          "value": "select"
        },
        "type": 0
      },
      "id": 31,
      "logType": "runtime",
      "path": [
        0
      ],
      "settings": {}
    },
    {
      "combinatorName": "ListOf",
      "componentName": "App",
      "emits": {
        "identifier": "userAction$",
        "notification": {
          "kind": "N",
          "value": "select"
        },
        "type": 0
      },
      "id": 32,
      "logType": "runtime",
      "path": [
        0,
        0
      ],
      "settings": {
        "as": "item",
        "items": [
          "ITEM1",
          "kk"
        ],
        "list": "items"
      }
    },
    {
      "combinatorName": "ListOf|Inner",
      "componentName": "App",
      "emits": {
        "identifier": "userAction$",
        "notification": {
          "kind": "N",
          "value": "select"
        },
        "type": 0
      },
      "id": 33,
      "logType": "runtime",
      "path": [
        0,
        0
      ],
      "settings": {
        "as": "item",
        "items": [
          "ITEM1",
          "kk"
        ],
        "list": "items"
      }
    },
    {
      "combinatorName": "ListOf|Inner|Indexed",
      "componentName": "App",
      "emits": {
        "identifier": "userAction$",
        "notification": {
          "kind": "N",
          "value": "select"
        },
        "type": 0
      },
      "id": 34,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ],
      "settings": {
        "as": "item",
        "item": "ITEM1",
        "items": [
          "ITEM1",
          "kk"
        ],
        "list": "items",
        "listIndex": 0
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "childComponent1",
      "emits": {
        "identifier": "userAction$",
        "notification": {
          "kind": "N",
          "value": "select"
        },
        "type": 0
      },
      "id": 35,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        0
      ],
      "settings": {
        "as": "item",
        "item": "ITEM1",
        "items": [
          "ITEM1",
          "kk"
        ],
        "list": "items",
        "listIndex": 0
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "childComponent1",
      "emits": {
        "identifier": "a",
        "notification": {
          "kind": "N",
          "value": "Component 0 - user action : select"
        },
        "type": 1
      },
      "id": 36,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": "ListOf|Inner|Indexed",
      "componentName": "App",
      "emits": {
        "identifier": "a",
        "notification": {
          "kind": "N",
          "value": "Component 0 - user action : select"
        },
        "type": 1
      },
      "id": 37,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": "ListOf|Inner",
      "componentName": "App",
      "emits": {
        "identifier": "a",
        "notification": {
          "kind": "N",
          "value": "Component 0 - user action : select"
        },
        "type": 1
      },
      "id": 38,
      "logType": "runtime",
      "path": [
        0,
        0
      ]
    },
    {
      "combinatorName": "ListOf",
      "componentName": "App",
      "emits": {
        "identifier": "a",
        "notification": {
          "kind": "N",
          "value": "Component 0 - user action : select"
        },
        "type": 1
      },
      "id": 39,
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
          "value": "Component 0 - user action : select"
        },
        "type": 1
      },
      "id": 40,
      "logType": "runtime",
      "path": [
        0
      ]
    },
    {
      "combinatorName": "ListOf|Inner|Indexed",
      "componentName": "App",
      "emits": {
        "identifier": "userAction$",
        "notification": {
          "kind": "N",
          "value": "select"
        },
        "type": 0
      },
      "id": 41,
      "logType": "runtime",
      "path": [
        0,
        0,
        1
      ],
      "settings": {
        "as": "item",
        "item": "kk",
        "items": [
          "ITEM1",
          "kk"
        ],
        "list": "items",
        "listIndex": 1
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "childComponent1",
      "emits": {
        "identifier": "userAction$",
        "notification": {
          "kind": "N",
          "value": "select"
        },
        "type": 0
      },
      "id": 42,
      "logType": "runtime",
      "path": [
        0,
        0,
        1,
        0
      ],
      "settings": {
        "as": "item",
        "item": "kk",
        "items": [
          "ITEM1",
          "kk"
        ],
        "list": "items",
        "listIndex": 1
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "childComponent1",
      "emits": {
        "identifier": "a",
        "notification": {
          "kind": "N",
          "value": "Component 1 - user action : select"
        },
        "type": 1
      },
      "id": 43,
      "logType": "runtime",
      "path": [
        0,
        0,
        1,
        0
      ]
    },
    {
      "combinatorName": "ListOf|Inner|Indexed",
      "componentName": "App",
      "emits": {
        "identifier": "a",
        "notification": {
          "kind": "N",
          "value": "Component 1 - user action : select"
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
      "combinatorName": "ListOf|Inner",
      "componentName": "App",
      "emits": {
        "identifier": "a",
        "notification": {
          "kind": "N",
          "value": "Component 1 - user action : select"
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
      "combinatorName": "ListOf",
      "componentName": "App",
      "emits": {
        "identifier": "a",
        "notification": {
          "kind": "N",
          "value": "Component 1 - user action : select"
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
        "identifier": "a",
        "notification": {
          "kind": "N",
          "value": "Component 1 - user action : select"
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
      "componentName": "ROOT",
      "emits": {
        "identifier": "DOM1",
        "notification": {
          "kind": "N",
          "value": "b"
        },
        "type": 0
      },
      "id": 48,
      "logType": "runtime",
      "path": [
        0
      ],
      "settings": {}
    },
    {
      "combinatorName": "ListOf",
      "componentName": "App",
      "emits": {
        "identifier": "DOM1",
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
        0
      ],
      "settings": {
        "as": "item",
        "items": [
          "ITEM1",
          "kk"
        ],
        "list": "items"
      }
    },
    {
      "combinatorName": "ListOf|Inner",
      "componentName": "App",
      "emits": {
        "identifier": "DOM1",
        "notification": {
          "kind": "N",
          "value": "b"
        },
        "type": 0
      },
      "id": 50,
      "logType": "runtime",
      "path": [
        0,
        0
      ],
      "settings": {
        "as": "item",
        "items": [
          "ITEM1",
          "kk"
        ],
        "list": "items"
      }
    },
    {
      "combinatorName": "ListOf|Inner|Indexed",
      "componentName": "App",
      "emits": {
        "identifier": "DOM1",
        "notification": {
          "kind": "N",
          "value": "b"
        },
        "type": 0
      },
      "id": 51,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ],
      "settings": {
        "as": "item",
        "item": "ITEM1",
        "items": [
          "ITEM1",
          "kk"
        ],
        "list": "items",
        "listIndex": 0
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
      "id": 52,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        0
      ],
      "settings": {
        "as": "item",
        "item": "ITEM1",
        "items": [
          "ITEM1",
          "kk"
        ],
        "list": "items",
        "listIndex": 0
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "childComponent1",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<span>List Component 0 : ITEM1 - b</span>"
        },
        "type": 1
      },
      "id": 53,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": "ListOf|Inner|Indexed",
      "componentName": "App",
      "emits": {
        "identifier": "DOM1",
        "notification": {
          "kind": "N",
          "value": "b"
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
        "as": "item",
        "item": "kk",
        "items": [
          "ITEM1",
          "kk"
        ],
        "list": "items",
        "listIndex": 1
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
      "id": 55,
      "logType": "runtime",
      "path": [
        0,
        0,
        1,
        0
      ],
      "settings": {
        "as": "item",
        "item": "kk",
        "items": [
          "ITEM1",
          "kk"
        ],
        "list": "items",
        "listIndex": 1
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "childComponent1",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<span>List Component 1 : kk - b</span>"
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
      "combinatorName": "ListOf|Inner|Indexed",
      "componentName": "App",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<span>List Component 0 : ITEM1 - b</span>"
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
      "combinatorName": "ListOf|Inner",
      "componentName": "App",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div><span>List Component 0 : ITEM1 - b</span><span>List Component 1 : kk - a</span></div>"
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
      "combinatorName": "ListOf",
      "componentName": "App",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div><span>List Component 0 : ITEM1 - b</span><span>List Component 1 : kk - a</span></div>"
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
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div><div><span>List Component 0 : ITEM1 - b</span><span>List Component 1 : kk - a</span></div></div>"
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
      "combinatorName": "ListOf|Inner|Indexed",
      "componentName": "App",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<span>List Component 1 : kk - b</span>"
        },
        "type": 1
      },
      "id": 61,
      "logType": "runtime",
      "path": [
        0,
        0,
        1
      ]
    },
    {
      "combinatorName": "ListOf|Inner",
      "componentName": "App",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div><span>List Component 0 : ITEM1 - b</span><span>List Component 1 : kk - b</span></div>"
        },
        "type": 1
      },
      "id": 62,
      "logType": "runtime",
      "path": [
        0,
        0
      ]
    },
    {
      "combinatorName": "ListOf",
      "componentName": "App",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div><span>List Component 0 : ITEM1 - b</span><span>List Component 1 : kk - b</span></div>"
        },
        "type": 1
      },
      "id": 63,
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
          "value": "<div><div><span>List Component 0 : ITEM1 - b</span><span>List Component 1 : kk - b</span></div></div>"
        },
        "type": 1
      },
      "id": 64,
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
//         flatten([expectedGraph1, expectedTraces1, expectedGraph2, expectedTraces2, expectedGraph3, expectedTraces3]),
        flatten([expectedGraph1, expectedTraces1]),
        `Traces are produced as expected!`);
      done()
    });
});

QUnit.test("main case - Pipe - sources not colliding with sinks, with throwIfSinkSourceConflict false", function exec_test(assert) {
  resetGraphCounter();
  const traces = [];
  const pipeSettings = { Pipe: { throwIfSinkSourceConflict: false, } };
  const done = assert.async(3);
  const pipedComponent = Pipe(set(componentNameInSettings, APP_NAME, pipeSettings), [Events, Intents, Actions,]);
  const tracedApp = traceApp({
    _trace: {
      traceSpecs: {
        [A_DRIVER]: [traceEventSourceFn, traceEventSinkFn],
        [ANOTHER_DRIVER]: [traceEventSourceFn, traceEventSinkFn],
        // NOTE : no need to trace the DOM source here as `AtomicComponentApp` does not use DOM source
        [DOM_SINK]: [identity, traceDOMsinkFn]
      },
      defaultTraceSpecs: [traceEventSourceFn, traceEventSinkFn],
      sendMessage: msg => traces.push(msg)
    },
    _helpers: { getId: getId(0) }
  }, pipedComponent);

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
  const expectedMessages = {
    DOM: {
      outputs: wrapInTraceIframe([
        "<span>A-Intents : I-Events - click : a</span>",
        "<span>A-Intents : I-Events - click : b</span>",
        "<span>A-Intents : I-Events - click : c</span>",
        "<span>A-Intents : I-Events - click : d</span>"
      ]),
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
      "combinatorName": "Pipe",
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
      "combinatorName": undefined,
      "componentName": "events",
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
      "componentName": "intents",
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
      "combinatorName": undefined,
      "componentName": "actions",
      "id": 4,
      "isContainerComponent": false,
      "logType": "graph_structure",
      "path": [
        0,
        0,
        2
      ]
    },
  ];
  const expectedTraces1 = [
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
      "id": 0,
      "logType": "runtime",
      "path": [
        0
      ],
      "settings": {}
    },
    {
      "combinatorName": "Pipe",
      "componentName": "App",
      "emits": {
        "identifier": "userAction$",
        "notification": {
          "kind": "N",
          "value": "click"
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
        "Pipe": {
          "throwIfSinkSourceConflict": false
        }
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "actions",
      "emits": {
        "identifier": "userAction$",
        "notification": {
          "kind": "N",
          "value": "click"
        },
        "type": 0
      },
      "id": 2,
      "logType": "runtime",
      "path": [
        0,
        0,
        2
      ],
      "settings": {
        "Pipe": {
          "throwIfSinkSourceConflict": false
        }
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "actions",
      "emits": {
        "identifier": "used",
        "notification": {
          "kind": "N",
          "value": "Actions - user action : click"
        },
        "type": 1
      },
      "id": 3,
      "logType": "runtime",
      "path": [
        0,
        0,
        2
      ]
    },
    {
      "combinatorName": "Pipe",
      "componentName": "App",
      "emits": {
        "identifier": "used",
        "notification": {
          "kind": "N",
          "value": "Actions - user action : click"
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
        "identifier": "used",
        "notification": {
          "kind": "N",
          "value": "Actions - user action : click"
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
        "identifier": "DOM1",
        "notification": {
          "kind": "N",
          "value": "a"
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
      "combinatorName": "Pipe",
      "componentName": "App",
      "emits": {
        "identifier": "DOM1",
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
        0
      ],
      "settings": {
        "Pipe": {
          "throwIfSinkSourceConflict": false
        }
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "events",
      "emits": {
        "identifier": "DOM1",
        "notification": {
          "kind": "N",
          "value": "a"
        },
        "type": 0
      },
      "id": 8,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ],
      "settings": {
        "Pipe": {
          "throwIfSinkSourceConflict": false
        }
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "events",
      "emits": {
        "identifier": "click",
        "notification": {
          "kind": "N",
          "value": "Events - click : a"
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
      "combinatorName": undefined,
      "componentName": "intents",
      "emits": {
        "identifier": "click",
        "notification": {
          "kind": "N",
          "value": "Events - click : a"
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
        "Pipe": {
          "throwIfSinkSourceConflict": false
        }
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "intents",
      "emits": {
        "identifier": "myIntent",
        "notification": {
          "kind": "N",
          "value": "Intents : I-Events - click : a"
        },
        "type": 1
      },
      "id": 11,
      "logType": "runtime",
      "path": [
        0,
        0,
        1
      ]
    },
    {
      "combinatorName": undefined,
      "componentName": "actions",
      "emits": {
        "identifier": "myIntent",
        "notification": {
          "kind": "N",
          "value": "Intents : I-Events - click : a"
        },
        "type": 0
      },
      "id": 12,
      "logType": "runtime",
      "path": [
        0,
        0,
        2
      ],
      "settings": {
        "Pipe": {
          "throwIfSinkSourceConflict": false
        }
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "actions",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<span>A-Intents : I-Events - click : a</span>"
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
      "combinatorName": "Pipe",
      "componentName": "App",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<span>A-Intents : I-Events - click : a</span>"
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
          "value": "<div><span>A-Intents : I-Events - click : a</span></div>"
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
        "identifier": "userAction$",
        "notification": {
          "kind": "N",
          "value": "select"
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
      "combinatorName": "Pipe",
      "componentName": "App",
      "emits": {
        "identifier": "userAction$",
        "notification": {
          "kind": "N",
          "value": "select"
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
        "Pipe": {
          "throwIfSinkSourceConflict": false
        }
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "actions",
      "emits": {
        "identifier": "userAction$",
        "notification": {
          "kind": "N",
          "value": "select"
        },
        "type": 0
      },
      "id": 18,
      "logType": "runtime",
      "path": [
        0,
        0,
        2
      ],
      "settings": {
        "Pipe": {
          "throwIfSinkSourceConflict": false
        }
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "actions",
      "emits": {
        "identifier": "used",
        "notification": {
          "kind": "N",
          "value": "Actions - user action : select"
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
      "combinatorName": "Pipe",
      "componentName": "App",
      "emits": {
        "identifier": "used",
        "notification": {
          "kind": "N",
          "value": "Actions - user action : select"
        },
        "type": 1
      },
      "id": 20,
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
        "identifier": "used",
        "notification": {
          "kind": "N",
          "value": "Actions - user action : select"
        },
        "type": 1
      },
      "id": 21,
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
          "value": "hover"
        },
        "type": 0
      },
      "id": 22,
      "logType": "runtime",
      "path": [
        0
      ],
      "settings": {}
    },
    {
      "combinatorName": "Pipe",
      "componentName": "App",
      "emits": {
        "identifier": "userAction$",
        "notification": {
          "kind": "N",
          "value": "hover"
        },
        "type": 0
      },
      "id": 23,
      "logType": "runtime",
      "path": [
        0,
        0
      ],
      "settings": {
        "Pipe": {
          "throwIfSinkSourceConflict": false
        }
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "actions",
      "emits": {
        "identifier": "userAction$",
        "notification": {
          "kind": "N",
          "value": "hover"
        },
        "type": 0
      },
      "id": 24,
      "logType": "runtime",
      "path": [
        0,
        0,
        2
      ],
      "settings": {
        "Pipe": {
          "throwIfSinkSourceConflict": false
        }
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "actions",
      "emits": {
        "identifier": "used",
        "notification": {
          "kind": "N",
          "value": "Actions - user action : hover"
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
      "combinatorName": "Pipe",
      "componentName": "App",
      "emits": {
        "identifier": "used",
        "notification": {
          "kind": "N",
          "value": "Actions - user action : hover"
        },
        "type": 1
      },
      "id": 26,
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
        "identifier": "used",
        "notification": {
          "kind": "N",
          "value": "Actions - user action : hover"
        },
        "type": 1
      },
      "id": 27,
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
      "id": 28,
      "logType": "runtime",
      "path": [
        0
      ],
      "settings": {}
    },
    {
      "combinatorName": "Pipe",
      "componentName": "App",
      "emits": {
        "identifier": "DOM1",
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
        0
      ],
      "settings": {
        "Pipe": {
          "throwIfSinkSourceConflict": false
        }
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "events",
      "emits": {
        "identifier": "DOM1",
        "notification": {
          "kind": "N",
          "value": "b"
        },
        "type": 0
      },
      "id": 30,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ],
      "settings": {
        "Pipe": {
          "throwIfSinkSourceConflict": false
        }
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "events",
      "emits": {
        "identifier": "click",
        "notification": {
          "kind": "N",
          "value": "Events - click : b"
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
      "combinatorName": undefined,
      "componentName": "intents",
      "emits": {
        "identifier": "click",
        "notification": {
          "kind": "N",
          "value": "Events - click : b"
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
        "Pipe": {
          "throwIfSinkSourceConflict": false
        }
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "intents",
      "emits": {
        "identifier": "myIntent",
        "notification": {
          "kind": "N",
          "value": "Intents : I-Events - click : b"
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
      "combinatorName": undefined,
      "componentName": "actions",
      "emits": {
        "identifier": "myIntent",
        "notification": {
          "kind": "N",
          "value": "Intents : I-Events - click : b"
        },
        "type": 0
      },
      "id": 34,
      "logType": "runtime",
      "path": [
        0,
        0,
        2
      ],
      "settings": {
        "Pipe": {
          "throwIfSinkSourceConflict": false
        }
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "actions",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<span>A-Intents : I-Events - click : b</span>"
        },
        "type": 1
      },
      "id": 35,
      "logType": "runtime",
      "path": [
        0,
        0,
        2
      ]
    },
    {
      "combinatorName": "Pipe",
      "componentName": "App",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<span>A-Intents : I-Events - click : b</span>"
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
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div><span>A-Intents : I-Events - click : b</span></div>"
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
        "identifier": "userAction$",
        "notification": {
          "kind": "N",
          "value": "select"
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
      "combinatorName": "Pipe",
      "componentName": "App",
      "emits": {
        "identifier": "userAction$",
        "notification": {
          "kind": "N",
          "value": "select"
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
        "Pipe": {
          "throwIfSinkSourceConflict": false
        }
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "actions",
      "emits": {
        "identifier": "userAction$",
        "notification": {
          "kind": "N",
          "value": "select"
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
        "Pipe": {
          "throwIfSinkSourceConflict": false
        }
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "actions",
      "emits": {
        "identifier": "used",
        "notification": {
          "kind": "N",
          "value": "Actions - user action : select"
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
      "combinatorName": "Pipe",
      "componentName": "App",
      "emits": {
        "identifier": "used",
        "notification": {
          "kind": "N",
          "value": "Actions - user action : select"
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
        "identifier": "used",
        "notification": {
          "kind": "N",
          "value": "Actions - user action : select"
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
      "id": 44,
      "logType": "runtime",
      "path": [
        0
      ],
      "settings": {}
    },
    {
      "combinatorName": "Pipe",
      "componentName": "App",
      "emits": {
        "identifier": "userAction$",
        "notification": {
          "kind": "N",
          "value": "click"
        },
        "type": 0
      },
      "id": 45,
      "logType": "runtime",
      "path": [
        0,
        0
      ],
      "settings": {
        "Pipe": {
          "throwIfSinkSourceConflict": false
        }
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "actions",
      "emits": {
        "identifier": "userAction$",
        "notification": {
          "kind": "N",
          "value": "click"
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
        "Pipe": {
          "throwIfSinkSourceConflict": false
        }
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "actions",
      "emits": {
        "identifier": "used",
        "notification": {
          "kind": "N",
          "value": "Actions - user action : click"
        },
        "type": 1
      },
      "id": 47,
      "logType": "runtime",
      "path": [
        0,
        0,
        2
      ]
    },
    {
      "combinatorName": "Pipe",
      "componentName": "App",
      "emits": {
        "identifier": "used",
        "notification": {
          "kind": "N",
          "value": "Actions - user action : click"
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
        "identifier": "used",
        "notification": {
          "kind": "N",
          "value": "Actions - user action : click"
        },
        "type": 1
      },
      "id": 49,
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
          "value": "c"
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
      "combinatorName": "Pipe",
      "componentName": "App",
      "emits": {
        "identifier": "DOM1",
        "notification": {
          "kind": "N",
          "value": "c"
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
        "Pipe": {
          "throwIfSinkSourceConflict": false
        }
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "events",
      "emits": {
        "identifier": "DOM1",
        "notification": {
          "kind": "N",
          "value": "c"
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
        "Pipe": {
          "throwIfSinkSourceConflict": false
        }
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "events",
      "emits": {
        "identifier": "click",
        "notification": {
          "kind": "N",
          "value": "Events - click : c"
        },
        "type": 1
      },
      "id": 53,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": undefined,
      "componentName": "intents",
      "emits": {
        "identifier": "click",
        "notification": {
          "kind": "N",
          "value": "Events - click : c"
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
        "Pipe": {
          "throwIfSinkSourceConflict": false
        }
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "intents",
      "emits": {
        "identifier": "myIntent",
        "notification": {
          "kind": "N",
          "value": "Intents : I-Events - click : c"
        },
        "type": 1
      },
      "id": 55,
      "logType": "runtime",
      "path": [
        0,
        0,
        1
      ]
    },
    {
      "combinatorName": undefined,
      "componentName": "actions",
      "emits": {
        "identifier": "myIntent",
        "notification": {
          "kind": "N",
          "value": "Intents : I-Events - click : c"
        },
        "type": 0
      },
      "id": 56,
      "logType": "runtime",
      "path": [
        0,
        0,
        2
      ],
      "settings": {
        "Pipe": {
          "throwIfSinkSourceConflict": false
        }
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "actions",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<span>A-Intents : I-Events - click : c</span>"
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
      "combinatorName": "Pipe",
      "componentName": "App",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<span>A-Intents : I-Events - click : c</span>"
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
          "value": "<div><span>A-Intents : I-Events - click : c</span></div>"
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
      "componentName": "ROOT",
      "emits": {
        "identifier": "userAction$",
        "notification": {
          "kind": "N",
          "value": "hover"
        },
        "type": 0
      },
      "id": 60,
      "logType": "runtime",
      "path": [
        0
      ],
      "settings": {}
    },
    {
      "combinatorName": "Pipe",
      "componentName": "App",
      "emits": {
        "identifier": "userAction$",
        "notification": {
          "kind": "N",
          "value": "hover"
        },
        "type": 0
      },
      "id": 61,
      "logType": "runtime",
      "path": [
        0,
        0
      ],
      "settings": {
        "Pipe": {
          "throwIfSinkSourceConflict": false
        }
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "actions",
      "emits": {
        "identifier": "userAction$",
        "notification": {
          "kind": "N",
          "value": "hover"
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
        "Pipe": {
          "throwIfSinkSourceConflict": false
        }
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "actions",
      "emits": {
        "identifier": "used",
        "notification": {
          "kind": "N",
          "value": "Actions - user action : hover"
        },
        "type": 1
      },
      "id": 63,
      "logType": "runtime",
      "path": [
        0,
        0,
        2
      ]
    },
    {
      "combinatorName": "Pipe",
      "componentName": "App",
      "emits": {
        "identifier": "used",
        "notification": {
          "kind": "N",
          "value": "Actions - user action : hover"
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
        "identifier": "used",
        "notification": {
          "kind": "N",
          "value": "Actions - user action : hover"
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
      "id": 66,
      "logType": "runtime",
      "path": [
        0
      ],
      "settings": {}
    },
    {
      "combinatorName": "Pipe",
      "componentName": "App",
      "emits": {
        "identifier": "DOM1",
        "notification": {
          "kind": "N",
          "value": "d"
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
        "Pipe": {
          "throwIfSinkSourceConflict": false
        }
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "events",
      "emits": {
        "identifier": "DOM1",
        "notification": {
          "kind": "N",
          "value": "d"
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
        "Pipe": {
          "throwIfSinkSourceConflict": false
        }
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "events",
      "emits": {
        "identifier": "click",
        "notification": {
          "kind": "N",
          "value": "Events - click : d"
        },
        "type": 1
      },
      "id": 69,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": undefined,
      "componentName": "intents",
      "emits": {
        "identifier": "click",
        "notification": {
          "kind": "N",
          "value": "Events - click : d"
        },
        "type": 0
      },
      "id": 70,
      "logType": "runtime",
      "path": [
        0,
        0,
        1
      ],
      "settings": {
        "Pipe": {
          "throwIfSinkSourceConflict": false
        }
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "intents",
      "emits": {
        "identifier": "myIntent",
        "notification": {
          "kind": "N",
          "value": "Intents : I-Events - click : d"
        },
        "type": 1
      },
      "id": 71,
      "logType": "runtime",
      "path": [
        0,
        0,
        1
      ]
    },
    {
      "combinatorName": undefined,
      "componentName": "actions",
      "emits": {
        "identifier": "myIntent",
        "notification": {
          "kind": "N",
          "value": "Intents : I-Events - click : d"
        },
        "type": 0
      },
      "id": 72,
      "logType": "runtime",
      "path": [
        0,
        0,
        2
      ],
      "settings": {
        "Pipe": {
          "throwIfSinkSourceConflict": false
        }
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "actions",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<span>A-Intents : I-Events - click : d</span>"
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
      "combinatorName": undefined,
      "componentName": "events",
      "emits": {
        "identifier": "click",
        "notification": {
          "error": undefined,
          "kind": "C"
        },
        "type": 1
      },
      "id": 74,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": undefined,
      "componentName": "intents",
      "emits": {
        "identifier": "click",
        "notification": {
          "error": undefined,
          "kind": "C"
        },
        "type": 0
      },
      "id": 75,
      "logType": "runtime",
      "path": [
        0,
        0,
        1
      ],
      "settings": {
        "Pipe": {
          "throwIfSinkSourceConflict": false
        }
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "intents",
      "emits": {
        "identifier": "myIntent",
        "notification": {
          "error": undefined,
          "kind": "C"
        },
        "type": 1
      },
      "id": 76,
      "logType": "runtime",
      "path": [
        0,
        0,
        1
      ]
    },
    {
      "combinatorName": undefined,
      "componentName": "actions",
      "emits": {
        "identifier": "myIntent",
        "notification": {
          "error": undefined,
          "kind": "C"
        },
        "type": 0
      },
      "id": 77,
      "logType": "runtime",
      "path": [
        0,
        0,
        2
      ],
      "settings": {
        "Pipe": {
          "throwIfSinkSourceConflict": false
        }
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "actions",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "error": undefined,
          "kind": "C"
        },
        "type": 1
      },
      "id": 78,
      "logType": "runtime",
      "path": [
        0,
        0,
        2
      ]
    },
    {
      "combinatorName": "Pipe",
      "componentName": "App",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<span>A-Intents : I-Events - click : d</span>"
        },
        "type": 1
      },
      "id": 79,
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
          "value": "<div><span>A-Intents : I-Events - click : d</span></div>"
        },
        "type": 1
      },
      "id": 80,
      "logType": "runtime",
      "path": [
        0
      ]
    },
    {
      "combinatorName": "Pipe",
      "componentName": "App",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "error": undefined,
          "kind": "C"
        },
        "type": 1
      },
      "id": 81,
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
        "identifier": "userAction$",
        "notification": {
          "kind": "N",
          "value": "click"
        },
        "type": 0
      },
      "id": 82,
      "logType": "runtime",
      "path": [
        0
      ],
      "settings": {}
    },
    {
      "combinatorName": "Pipe",
      "componentName": "App",
      "emits": {
        "identifier": "userAction$",
        "notification": {
          "kind": "N",
          "value": "click"
        },
        "type": 0
      },
      "id": 83,
      "logType": "runtime",
      "path": [
        0,
        0
      ],
      "settings": {
        "Pipe": {
          "throwIfSinkSourceConflict": false
        }
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "actions",
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
        0,
        0,
        2
      ],
      "settings": {
        "Pipe": {
          "throwIfSinkSourceConflict": false
        }
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "actions",
      "emits": {
        "identifier": "used",
        "notification": {
          "kind": "N",
          "value": "Actions - user action : click"
        },
        "type": 1
      },
      "id": 85,
      "logType": "runtime",
      "path": [
        0,
        0,
        2
      ]
    },
    {
      "combinatorName": "Pipe",
      "componentName": "App",
      "emits": {
        "identifier": "used",
        "notification": {
          "kind": "N",
          "value": "Actions - user action : click"
        },
        "type": 1
      },
      "id": 86,
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
        "identifier": "used",
        "notification": {
          "kind": "N",
          "value": "Actions - user action : click"
        },
        "type": 1
      },
      "id": 87,
      "logType": "runtime",
      "path": [
        0
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "ROOT",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "error": undefined,
          "kind": "C"
        },
        "type": 1
      },
      "id": 88,
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
          "value": "select"
        },
        "type": 0
      },
      "id": 89,
      "logType": "runtime",
      "path": [
        0
      ],
      "settings": {}
    },
    {
      "combinatorName": "Pipe",
      "componentName": "App",
      "emits": {
        "identifier": "userAction$",
        "notification": {
          "kind": "N",
          "value": "select"
        },
        "type": 0
      },
      "id": 90,
      "logType": "runtime",
      "path": [
        0,
        0
      ],
      "settings": {
        "Pipe": {
          "throwIfSinkSourceConflict": false
        }
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "actions",
      "emits": {
        "identifier": "userAction$",
        "notification": {
          "kind": "N",
          "value": "select"
        },
        "type": 0
      },
      "id": 91,
      "logType": "runtime",
      "path": [
        0,
        0,
        2
      ],
      "settings": {
        "Pipe": {
          "throwIfSinkSourceConflict": false
        }
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "actions",
      "emits": {
        "identifier": "used",
        "notification": {
          "kind": "N",
          "value": "Actions - user action : select"
        },
        "type": 1
      },
      "id": 92,
      "logType": "runtime",
      "path": [
        0,
        0,
        2
      ]
    },
    {
      "combinatorName": "Pipe",
      "componentName": "App",
      "emits": {
        "identifier": "used",
        "notification": {
          "kind": "N",
          "value": "Actions - user action : select"
        },
        "type": 1
      },
      "id": 93,
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
        "identifier": "used",
        "notification": {
          "kind": "N",
          "value": "Actions - user action : select"
        },
        "type": 1
      },
      "id": 94,
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
          "value": "hover"
        },
        "type": 0
      },
      "id": 95,
      "logType": "runtime",
      "path": [
        0
      ],
      "settings": {}
    },
    {
      "combinatorName": "Pipe",
      "componentName": "App",
      "emits": {
        "identifier": "userAction$",
        "notification": {
          "kind": "N",
          "value": "hover"
        },
        "type": 0
      },
      "id": 96,
      "logType": "runtime",
      "path": [
        0,
        0
      ],
      "settings": {
        "Pipe": {
          "throwIfSinkSourceConflict": false
        }
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "actions",
      "emits": {
        "identifier": "userAction$",
        "notification": {
          "kind": "N",
          "value": "hover"
        },
        "type": 0
      },
      "id": 97,
      "logType": "runtime",
      "path": [
        0,
        0,
        2
      ],
      "settings": {
        "Pipe": {
          "throwIfSinkSourceConflict": false
        }
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "actions",
      "emits": {
        "identifier": "used",
        "notification": {
          "kind": "N",
          "value": "Actions - user action : hover"
        },
        "type": 1
      },
      "id": 98,
      "logType": "runtime",
      "path": [
        0,
        0,
        2
      ]
    },
    {
      "combinatorName": "Pipe",
      "componentName": "App",
      "emits": {
        "identifier": "used",
        "notification": {
          "kind": "N",
          "value": "Actions - user action : hover"
        },
        "type": 1
      },
      "id": 99,
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
        "identifier": "used",
        "notification": {
          "kind": "N",
          "value": "Actions - user action : hover"
        },
        "type": 1
      },
      "id": 100,
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
//         flatten([expectedGraph1, expectedTraces1, expectedGraph2, expectedTraces2, expectedGraph3, expectedTraces3]),
        flatten([expectedGraph1, expectedTraces1]),
        `Traces are produced as expected!`);
      done()
    });
});

// TODO : test also Switch with container having slot!!!
// TODO :edge case traceSinks... if sink is null
// TODO : test InSlot, Pipe
// TODO : also test for error occuring in the component tree
// component do not complete per se, so hard to test
