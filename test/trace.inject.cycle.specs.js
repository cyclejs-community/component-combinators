// Test plan
// Main cases
// GIVEN an application with :
// - inject one behaviour and one event source
// - also an extra source to check if it is passed down stream correctly
//   - that extra source combines event response, behaviour source in its sink
// - a component which :
//   - emits a command request to the event sink, with a processing fn which produces a response
//   - emits a json patch state modifying
// - trace without any default trace functions for the extra sources
// GIVEN the extra source emits one value
// THEN :
// - output is correctly traced (id, order, materialized messages, termination of components, path remains correct
// even with dynamic creation/completion of components, etc.)
// - processingFn response is passed to source
// - behaviour source is correctly updated

// Edge cases
// - error in the event sink
// - error in the behaviour sink
// - processFn throws
// - processFn passes an error notification (same as throwing)
// - processFn returns a stream which throws

import {
  componentNameInSettings, traceBehaviourSinkFn, traceBehaviourSourceFn, traceEventSinkFn, traceEventSourceFn
} from "../tracing/src/helpers"
import { Combine } from "../src/components/Combine"
import { addPrefix, convertVNodesToHTML, DOM_SINK, makeErrorMessage } from "../utils/src"
import * as QUnit from "qunitjs"
import { resetGraphCounter, traceApp } from "../tracing/src"
import { runTestScenario } from "../testing/src/runTestScenario"
import { InjectCircularSources } from "../src/components/Inject/InjectLocalState"
import { set, pipe, omit } from 'ramda'
import Rx from 'rx'
import { markAsBehavior, markAsEvent } from "../src"

const $ = Rx.Observable;
const AN_ERROR = `AN_ERROR`;
const APP_NAME = 'App';
const A_DRIVER = 'a_driver';
const ANOTHER_DRIVER = 'another_driver';
const YET_ANOTHER_DRIVER = 'yet_another_driver';
const A_CIRCULAR_BEHAVIOR_SOURCE = 'a_circular_behavior_source';
const A_CIRCULAR_EVENT_SOURCE = 'a_circular_event_source';
const INITIAL_STATE = { key: 'value' };
const A_RESPONSE = 'a_response';
const A_COMMAND = 'a_command';
const dummyValue = 'dummy';
const dummyValue1 = 'dummy1';
const dummyValue2 = 'dummy2';
// NOTE : a function as a value is used here to test against json patching
// library
const dummyValue3 = 'dummy3';

const opsOnInitialModel = [
  { op: "add", path: '/dummyKey3InitModel', value: dummyValue3 },
  { op: "replace", path: '/dummyKey1InitModel', value: dummyValue2 },
  { op: "remove", path: '/dummyKey2InitModel' },
];

function getId(start) {
  let counter = start;
  return function () {
    return counter++
  }
}

function commandProcessingFn(command) {
  return $.of({
    request: command,
    response: A_RESPONSE
  })
}

function commandProcessingFnWithError(command) {
  throw AN_ERROR
}

function commandProcessingFnWithThrowingStream(command) {
  return $.throw(AN_ERROR)
}

function behaviourUpdatingComponent(sources, settings) {
  return {
    [A_CIRCULAR_BEHAVIOR_SOURCE]: markAsEvent(
      sources[A_DRIVER].map(_ => opsOnInitialModel)
    )
  }
}

function behaviourUpdatingComponentWithError(sources, settings) {
  return {
    [A_CIRCULAR_BEHAVIOR_SOURCE]: markAsEvent(
      sources[A_DRIVER].map(_ => {throw AN_ERROR})
    )
  }
}

function commandRequestComponent(sources, settings) {
  return {
    [A_CIRCULAR_EVENT_SOURCE]: markAsEvent(
      sources[A_DRIVER]
        .map(_ => ({
          context: null,
          command: A_COMMAND,
          params: _
        }))
    )
  }
}

function commandRequestComponentWithError(sources, settings) {
  return {
    [A_CIRCULAR_EVENT_SOURCE]: markAsEvent(
      sources[A_DRIVER]
        .map(_ => {throw AN_ERROR})
    )
  }
}

function sinkUpdatingComponent(sources, settings) {
  return {
    [A_DRIVER]: sources[A_DRIVER].map(addPrefix(`driver1 emits: `)),
    [ANOTHER_DRIVER]: sources[A_CIRCULAR_EVENT_SOURCE].map(x => `circular event source emits: ${JSON.stringify(x)}`),
    [YET_ANOTHER_DRIVER] : sources[A_CIRCULAR_BEHAVIOR_SOURCE].map(x => `circular behaviour emits: ${JSON.stringify(x)}`),
  }
}

function analyzeTestResults(assert, done) {
  return function analyzeTestResults(actual, expected, message) {
    assert.deepEqual(actual, expected, message);
    done()
  }
}

function removeWhenField(traces) {
  return traces.map(trace => omit(['when'], trace))
}

QUnit.test("main case - InjectCircularSources - behaviour, event, other", function exec_test(assert) {
  resetGraphCounter();
  const done = assert.async(5);
  const traces = [];
  /** @type InjectLocalStateSettings*/
  const injectSettings = {
    behaviour: [A_CIRCULAR_BEHAVIOR_SOURCE, INITIAL_STATE],
    event: [A_CIRCULAR_EVENT_SOURCE, commandProcessingFn]
  };

  const App = InjectCircularSources(set(componentNameInSettings, APP_NAME, injectSettings), [
    Combine(set(componentNameInSettings, 'Inner App', {}), [
      behaviourUpdatingComponent,
      commandRequestComponent,
      sinkUpdatingComponent
    ])
  ]);
  const tracedApp = traceApp({
    _trace: {
      traceSpecs: {
        [A_DRIVER]: [traceEventSourceFn, traceEventSinkFn],
        [ANOTHER_DRIVER]: [traceEventSourceFn, traceEventSinkFn],
        [YET_ANOTHER_DRIVER]: [traceEventSourceFn, traceEventSinkFn],
        // NOTE : the source is a behaviour but the sink is an event!
        [A_CIRCULAR_BEHAVIOR_SOURCE]: [traceBehaviourSourceFn, traceEventSinkFn],
        [A_CIRCULAR_EVENT_SOURCE]: [traceEventSourceFn, traceEventSinkFn],
//        [DOM_SINK]: [identity, traceDOMsinkFn]
      },
      sendMessage: msg => traces.push(msg)
    },
    _helpers: { getId: getId(0) }
  }, App);

  const inputs = [
    { [A_DRIVER]: { diagram: '-a--b--' } },
  ];

  const expectedMessages = {
    [A_DRIVER]: {
      outputs: inputs[0][A_DRIVER].diagram.replace(/-/g, '').split('').map(x => `driver1 emits: ${x}`),
      successMessage: `sink ${A_DRIVER} produces the expected values`
    },
    [ANOTHER_DRIVER]: {
      outputs: ["circular event source emits: {\"request\":{\"context\":null,\"command\":\"a_command\",\"params\":\"a\"},\"response\":\"a_response\"}"],
      successMessage: `sink ${ANOTHER_DRIVER} produces the expected values`
    },
    [YET_ANOTHER_DRIVER]: {
      outputs: [
        "circular behaviour emits: {\"key\":\"value\"}",
        "circular behaviour emits: {\"key\":\"value\",\"dummyKey3InitModel\":\"dummy3\",\"dummyKey1InitModel\":\"dummy2\"}",
        "circular behaviour emits: {\"key\":\"value\",\"dummyKey3InitModel\":\"dummy3\",\"dummyKey1InitModel\":\"dummy2\"}"
      ],
      successMessage: `sink ${YET_ANOTHER_DRIVER} produces the expected values`
    },
    // I have to keep it, because the iframe is always there...
    [DOM_SINK]: {
      outputs: ["<div><iframe id=\"devtool\" src=\"devtool.html\" style=\"width: 450px; height: 200px\"></iframe></div>"],
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
      "combinatorName": "InjectLocalState",
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
      "combinatorName": "InjectLocalState|Inner",
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
      "combinatorName": "Combine",
      "componentName": "Inner App",
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
      "componentName": "behaviourUpdatingComponent",
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
      "combinatorName": undefined,
      "componentName": "commandRequestComponent",
      "id": 5,
      "isContainerComponent": false,
      "logType": "graph_structure",
      "path": [
        0,
        0,
        0,
        1
      ]
    },
    {
      "combinatorName": undefined,
      "componentName": "sinkUpdatingComponent",
      "id": 6,
      "isContainerComponent": false,
      "logType": "graph_structure",
      "path": [
        0,
        0,
        0,
        2
      ]
    },
  ];
  const expectedTraces = [
    {
      "combinatorName": "InjectLocalState",
      "componentName": "App",
      "emits": {
        "identifier": "a_circular_behavior_source",
        "notification": {
          "kind": "N",
          "value": {
            "key": "value"
          }
        },
        "type": 0
      },
      "id": 0,
      "logType": "runtime",
      "path": [
        0,
        0
      ],
      "settings": {}
    },
    {
      "combinatorName": "InjectLocalState|Inner",
      "componentName": "App",
      "emits": {
        "identifier": "a_circular_behavior_source",
        "notification": {
          "kind": "N",
          "value": {
            "key": "value"
          }
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
      "combinatorName": "Combine",
      "componentName": "Inner App",
      "emits": {
        "identifier": "a_circular_behavior_source",
        "notification": {
          "kind": "N",
          "value": {
            "key": "value"
          }
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
      "settings": {}
    },
    {
      "combinatorName": undefined,
      "componentName": "sinkUpdatingComponent",
      "emits": {
        "identifier": "a_circular_behavior_source",
        "notification": {
          "kind": "N",
          "value": {
            "key": "value"
          }
        },
        "type": 0
      },
      "id": 3,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        2
      ],
      "settings": {}
    },
    {
      "combinatorName": undefined,
      "componentName": "sinkUpdatingComponent",
      "emits": {
        "identifier": "yet_another_driver",
        "notification": {
          "kind": "N",
          "value": "circular behaviour emits: {\"key\":\"value\"}"
        },
        "type": 1
      },
      "id": 4,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        2
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "Inner App",
      "emits": {
        "identifier": "yet_another_driver",
        "notification": {
          "kind": "N",
          "value": "circular behaviour emits: {\"key\":\"value\"}"
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
      "combinatorName": "InjectLocalState|Inner",
      "componentName": "App",
      "emits": {
        "identifier": "yet_another_driver",
        "notification": {
          "kind": "N",
          "value": "circular behaviour emits: {\"key\":\"value\"}"
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
      "combinatorName": "InjectLocalState",
      "componentName": "App",
      "emits": {
        "identifier": "yet_another_driver",
        "notification": {
          "kind": "N",
          "value": "circular behaviour emits: {\"key\":\"value\"}"
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
        "identifier": "yet_another_driver",
        "notification": {
          "kind": "N",
          "value": "circular behaviour emits: {\"key\":\"value\"}"
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
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "a"
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
      "combinatorName": "InjectLocalState",
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
        0
      ],
      "settings": {}
    },
    {
      "combinatorName": "InjectLocalState|Inner",
      "componentName": "App",
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
        0
      ],
      "settings": {}
    },
    {
      "combinatorName": "Combine",
      "componentName": "Inner App",
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
        0
      ],
      "settings": {}
    },
    {
      "combinatorName": undefined,
      "componentName": "behaviourUpdatingComponent",
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
        0,
        0
      ],
      "settings": {}
    },
    {
      "combinatorName": undefined,
      "componentName": "behaviourUpdatingComponent",
      "emits": {
        "identifier": "a_circular_behavior_source",
        "notification": {
          "kind": "N",
          "value": [
            {
              "op": "add",
              "path": "/dummyKey3InitModel",
              "value": "dummy3"
            },
            {
              "op": "replace",
              "path": "/dummyKey1InitModel",
              "value": "dummy2"
            },
            {
              "op": "remove",
              "path": "/dummyKey2InitModel"
            }
          ]
        },
        "type": 1
      },
      "id": 14,
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
      "componentName": "Inner App",
      "emits": {
        "identifier": "a_circular_behavior_source",
        "notification": {
          "kind": "N",
          "value": [
            {
              "op": "add",
              "path": "/dummyKey3InitModel",
              "value": "dummy3"
            },
            {
              "op": "replace",
              "path": "/dummyKey1InitModel",
              "value": "dummy2"
            },
            {
              "op": "remove",
              "path": "/dummyKey2InitModel"
            }
          ]
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
      "combinatorName": "InjectLocalState|Inner",
      "componentName": "App",
      "emits": {
        "identifier": "a_circular_behavior_source",
        "notification": {
          "kind": "N",
          "value": [
            {
              "op": "add",
              "path": "/dummyKey3InitModel",
              "value": "dummy3"
            },
            {
              "op": "replace",
              "path": "/dummyKey1InitModel",
              "value": "dummy2"
            },
            {
              "op": "remove",
              "path": "/dummyKey2InitModel"
            }
          ]
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
      "combinatorName": "InjectLocalState",
      "componentName": "App",
      "emits": {
        "identifier": "a_circular_behavior_source",
        "notification": {
          "kind": "N",
          "value": {
            "dummyKey1InitModel": "dummy2",
            "dummyKey3InitModel": "dummy3",
            "key": "value"
          }
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
      "combinatorName": "InjectLocalState|Inner",
      "componentName": "App",
      "emits": {
        "identifier": "a_circular_behavior_source",
        "notification": {
          "kind": "N",
          "value": {
            "dummyKey1InitModel": "dummy2",
            "dummyKey3InitModel": "dummy3",
            "key": "value"
          }
        },
        "type": 0
      },
      "id": 18,
      "logType": "runtime",
      "path": [
        0,
        0
      ],
      "settings": {}
    },
    {
      "combinatorName": "Combine",
      "componentName": "Inner App",
      "emits": {
        "identifier": "a_circular_behavior_source",
        "notification": {
          "kind": "N",
          "value": {
            "dummyKey1InitModel": "dummy2",
            "dummyKey3InitModel": "dummy3",
            "key": "value"
          }
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
      "settings": {}
    },
    {
      "combinatorName": undefined,
      "componentName": "sinkUpdatingComponent",
      "emits": {
        "identifier": "a_circular_behavior_source",
        "notification": {
          "kind": "N",
          "value": {
            "dummyKey1InitModel": "dummy2",
            "dummyKey3InitModel": "dummy3",
            "key": "value"
          }
        },
        "type": 0
      },
      "id": 20,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        2
      ],
      "settings": {}
    },
    {
      "combinatorName": undefined,
      "componentName": "sinkUpdatingComponent",
      "emits": {
        "identifier": "yet_another_driver",
        "notification": {
          "kind": "N",
          "value": "circular behaviour emits: {\"key\":\"value\",\"dummyKey3InitModel\":\"dummy3\",\"dummyKey1InitModel\":\"dummy2\"}"
        },
        "type": 1
      },
      "id": 21,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        2
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "Inner App",
      "emits": {
        "identifier": "yet_another_driver",
        "notification": {
          "kind": "N",
          "value": "circular behaviour emits: {\"key\":\"value\",\"dummyKey3InitModel\":\"dummy3\",\"dummyKey1InitModel\":\"dummy2\"}"
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
      "combinatorName": "InjectLocalState|Inner",
      "componentName": "App",
      "emits": {
        "identifier": "yet_another_driver",
        "notification": {
          "kind": "N",
          "value": "circular behaviour emits: {\"key\":\"value\",\"dummyKey3InitModel\":\"dummy3\",\"dummyKey1InitModel\":\"dummy2\"}"
        },
        "type": 1
      },
      "id": 23,
      "logType": "runtime",
      "path": [
        0,
        0
      ]
    },
    {
      "combinatorName": "InjectLocalState",
      "componentName": "App",
      "emits": {
        "identifier": "yet_another_driver",
        "notification": {
          "kind": "N",
          "value": "circular behaviour emits: {\"key\":\"value\",\"dummyKey3InitModel\":\"dummy3\",\"dummyKey1InitModel\":\"dummy2\"}"
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
        "identifier": "yet_another_driver",
        "notification": {
          "kind": "N",
          "value": "circular behaviour emits: {\"key\":\"value\",\"dummyKey3InitModel\":\"dummy3\",\"dummyKey1InitModel\":\"dummy2\"}"
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
      "combinatorName": undefined,
      "componentName": "commandRequestComponent",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "a"
        },
        "type": 0
      },
      "id": 26,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        1
      ],
      "settings": {}
    },
    {
      "combinatorName": undefined,
      "componentName": "commandRequestComponent",
      "emits": {
        "identifier": "a_circular_event_source",
        "notification": {
          "kind": "N",
          "value": {
            "command": "a_command",
            "context": null,
            "params": "a"
          }
        },
        "type": 1
      },
      "id": 27,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        1
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "Inner App",
      "emits": {
        "identifier": "a_circular_event_source",
        "notification": {
          "kind": "N",
          "value": {
            "command": "a_command",
            "context": null,
            "params": "a"
          }
        },
        "type": 1
      },
      "id": 28,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": "InjectLocalState|Inner",
      "componentName": "App",
      "emits": {
        "identifier": "a_circular_event_source",
        "notification": {
          "kind": "N",
          "value": {
            "command": "a_command",
            "context": null,
            "params": "a"
          }
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
      "combinatorName": "InjectLocalState",
      "componentName": "App",
      "emits": {
        "identifier": "a_circular_event_source",
        "notification": {
          "kind": "N",
          "value": {
            "request": {
              "command": "a_command",
              "context": null,
              "params": "a"
            },
            "response": "a_response"
          }
        },
        "type": 0
      },
      "id": 30,
      "logType": "runtime",
      "path": [
        0,
        0
      ],
      "settings": {}
    },
    {
      "combinatorName": "InjectLocalState|Inner",
      "componentName": "App",
      "emits": {
        "identifier": "a_circular_event_source",
        "notification": {
          "kind": "N",
          "value": {
            "request": {
              "command": "a_command",
              "context": null,
              "params": "a"
            },
            "response": "a_response"
          }
        },
        "type": 0
      },
      "id": 31,
      "logType": "runtime",
      "path": [
        0,
        0
      ],
      "settings": {}
    },
    {
      "combinatorName": "Combine",
      "componentName": "Inner App",
      "emits": {
        "identifier": "a_circular_event_source",
        "notification": {
          "kind": "N",
          "value": {
            "request": {
              "command": "a_command",
              "context": null,
              "params": "a"
            },
            "response": "a_response"
          }
        },
        "type": 0
      },
      "id": 32,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ],
      "settings": {}
    },
    {
      "combinatorName": undefined,
      "componentName": "sinkUpdatingComponent",
      "emits": {
        "identifier": "a_circular_event_source",
        "notification": {
          "kind": "N",
          "value": {
            "request": {
              "command": "a_command",
              "context": null,
              "params": "a"
            },
            "response": "a_response"
          }
        },
        "type": 0
      },
      "id": 33,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        2
      ],
      "settings": {}
    },
    {
      "combinatorName": undefined,
      "componentName": "sinkUpdatingComponent",
      "emits": {
        "identifier": "another_driver",
        "notification": {
          "kind": "N",
          "value": "circular event source emits: {\"request\":{\"context\":null,\"command\":\"a_command\",\"params\":\"a\"},\"response\":\"a_response\"}"
        },
        "type": 1
      },
      "id": 34,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        2
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "Inner App",
      "emits": {
        "identifier": "another_driver",
        "notification": {
          "kind": "N",
          "value": "circular event source emits: {\"request\":{\"context\":null,\"command\":\"a_command\",\"params\":\"a\"},\"response\":\"a_response\"}"
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
      "combinatorName": "InjectLocalState|Inner",
      "componentName": "App",
      "emits": {
        "identifier": "another_driver",
        "notification": {
          "kind": "N",
          "value": "circular event source emits: {\"request\":{\"context\":null,\"command\":\"a_command\",\"params\":\"a\"},\"response\":\"a_response\"}"
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
      "combinatorName": "InjectLocalState",
      "componentName": "App",
      "emits": {
        "identifier": "another_driver",
        "notification": {
          "kind": "N",
          "value": "circular event source emits: {\"request\":{\"context\":null,\"command\":\"a_command\",\"params\":\"a\"},\"response\":\"a_response\"}"
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
      "combinatorName": "Combine",
      "componentName": "ROOT",
      "emits": {
        "identifier": "another_driver",
        "notification": {
          "kind": "N",
          "value": "circular event source emits: {\"request\":{\"context\":null,\"command\":\"a_command\",\"params\":\"a\"},\"response\":\"a_response\"}"
        },
        "type": 1
      },
      "id": 38,
      "logType": "runtime",
      "path": [
        0
      ]
    },
    {
      "combinatorName": "InjectLocalState",
      "componentName": "App",
      "emits": {
        "identifier": "a_circular_event_source",
        "notification": {
          "error": undefined,
          "kind": "C"
        },
        "type": 0
      },
      "id": 39,
      "logType": "runtime",
      "path": [
        0,
        0
      ],
      "settings": {}
    },
    {
      "combinatorName": "InjectLocalState|Inner",
      "componentName": "App",
      "emits": {
        "identifier": "a_circular_event_source",
        "notification": {
          "error": undefined,
          "kind": "C"
        },
        "type": 0
      },
      "id": 40,
      "logType": "runtime",
      "path": [
        0,
        0
      ],
      "settings": {}
    },
    {
      "combinatorName": "Combine",
      "componentName": "Inner App",
      "emits": {
        "identifier": "a_circular_event_source",
        "notification": {
          "error": undefined,
          "kind": "C"
        },
        "type": 0
      },
      "id": 41,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ],
      "settings": {}
    },
    {
      "combinatorName": undefined,
      "componentName": "sinkUpdatingComponent",
      "emits": {
        "identifier": "a_circular_event_source",
        "notification": {
          "error": undefined,
          "kind": "C"
        },
        "type": 0
      },
      "id": 42,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        2
      ],
      "settings": {}
    },
    {
      "combinatorName": undefined,
      "componentName": "sinkUpdatingComponent",
      "emits": {
        "identifier": "another_driver",
        "notification": {
          "error": undefined,
          "kind": "C"
        },
        "type": 1
      },
      "id": 43,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        2
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "Inner App",
      "emits": {
        "identifier": "another_driver",
        "notification": {
          "error": undefined,
          "kind": "C"
        },
        "type": 1
      },
      "id": 44,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": "InjectLocalState|Inner",
      "componentName": "App",
      "emits": {
        "identifier": "another_driver",
        "notification": {
          "error": undefined,
          "kind": "C"
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
      "combinatorName": "InjectLocalState",
      "componentName": "App",
      "emits": {
        "identifier": "another_driver",
        "notification": {
          "error": undefined,
          "kind": "C"
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
        "identifier": "another_driver",
        "notification": {
          "error": undefined,
          "kind": "C"
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
      "combinatorName": undefined,
      "componentName": "sinkUpdatingComponent",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "a"
        },
        "type": 0
      },
      "id": 48,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        2
      ],
      "settings": {}
    },
    {
      "combinatorName": undefined,
      "componentName": "sinkUpdatingComponent",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "driver1 emits: a"
        },
        "type": 1
      },
      "id": 49,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        2
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "Inner App",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "driver1 emits: a"
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
      "combinatorName": "InjectLocalState|Inner",
      "componentName": "App",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "driver1 emits: a"
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
      "combinatorName": "InjectLocalState",
      "componentName": "App",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "driver1 emits: a"
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
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "driver1 emits: a"
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
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "b"
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
      "combinatorName": "InjectLocalState",
      "componentName": "App",
      "emits": {
        "identifier": "a_driver",
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
        0
      ],
      "settings": {}
    },
    {
      "combinatorName": "InjectLocalState|Inner",
      "componentName": "App",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "b"
        },
        "type": 0
      },
      "id": 56,
      "logType": "runtime",
      "path": [
        0,
        0
      ],
      "settings": {}
    },
    {
      "combinatorName": "Combine",
      "componentName": "Inner App",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "b"
        },
        "type": 0
      },
      "id": 57,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ],
      "settings": {}
    },
    {
      "combinatorName": undefined,
      "componentName": "behaviourUpdatingComponent",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "b"
        },
        "type": 0
      },
      "id": 58,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        0
      ],
      "settings": {}
    },
    {
      "combinatorName": undefined,
      "componentName": "behaviourUpdatingComponent",
      "emits": {
        "identifier": "a_circular_behavior_source",
        "notification": {
          "kind": "N",
          "value": [
            {
              "op": "add",
              "path": "/dummyKey3InitModel",
              "value": "dummy3"
            },
            {
              "op": "replace",
              "path": "/dummyKey1InitModel",
              "value": "dummy2"
            },
            {
              "op": "remove",
              "path": "/dummyKey2InitModel"
            }
          ]
        },
        "type": 1
      },
      "id": 59,
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
      "componentName": "Inner App",
      "emits": {
        "identifier": "a_circular_behavior_source",
        "notification": {
          "kind": "N",
          "value": [
            {
              "op": "add",
              "path": "/dummyKey3InitModel",
              "value": "dummy3"
            },
            {
              "op": "replace",
              "path": "/dummyKey1InitModel",
              "value": "dummy2"
            },
            {
              "op": "remove",
              "path": "/dummyKey2InitModel"
            }
          ]
        },
        "type": 1
      },
      "id": 60,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": "InjectLocalState|Inner",
      "componentName": "App",
      "emits": {
        "identifier": "a_circular_behavior_source",
        "notification": {
          "kind": "N",
          "value": [
            {
              "op": "add",
              "path": "/dummyKey3InitModel",
              "value": "dummy3"
            },
            {
              "op": "replace",
              "path": "/dummyKey1InitModel",
              "value": "dummy2"
            },
            {
              "op": "remove",
              "path": "/dummyKey2InitModel"
            }
          ]
        },
        "type": 1
      },
      "id": 61,
      "logType": "runtime",
      "path": [
        0,
        0
      ]
    },
    {
      "combinatorName": "InjectLocalState",
      "componentName": "App",
      "emits": {
        "identifier": "a_circular_behavior_source",
        "notification": {
          "kind": "N",
          "value": {
            "dummyKey1InitModel": "dummy2",
            "dummyKey3InitModel": "dummy3",
            "key": "value"
          }
        },
        "type": 0
      },
      "id": 62,
      "logType": "runtime",
      "path": [
        0,
        0
      ],
      "settings": {}
    },
    {
      "combinatorName": "InjectLocalState|Inner",
      "componentName": "App",
      "emits": {
        "identifier": "a_circular_behavior_source",
        "notification": {
          "kind": "N",
          "value": {
            "dummyKey1InitModel": "dummy2",
            "dummyKey3InitModel": "dummy3",
            "key": "value"
          }
        },
        "type": 0
      },
      "id": 63,
      "logType": "runtime",
      "path": [
        0,
        0
      ],
      "settings": {}
    },
    {
      "combinatorName": "Combine",
      "componentName": "Inner App",
      "emits": {
        "identifier": "a_circular_behavior_source",
        "notification": {
          "kind": "N",
          "value": {
            "dummyKey1InitModel": "dummy2",
            "dummyKey3InitModel": "dummy3",
            "key": "value"
          }
        },
        "type": 0
      },
      "id": 64,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ],
      "settings": {}
    },
    {
      "combinatorName": undefined,
      "componentName": "sinkUpdatingComponent",
      "emits": {
        "identifier": "a_circular_behavior_source",
        "notification": {
          "kind": "N",
          "value": {
            "dummyKey1InitModel": "dummy2",
            "dummyKey3InitModel": "dummy3",
            "key": "value"
          }
        },
        "type": 0
      },
      "id": 65,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        2
      ],
      "settings": {}
    },
    {
      "combinatorName": undefined,
      "componentName": "sinkUpdatingComponent",
      "emits": {
        "identifier": "yet_another_driver",
        "notification": {
          "kind": "N",
          "value": "circular behaviour emits: {\"key\":\"value\",\"dummyKey3InitModel\":\"dummy3\",\"dummyKey1InitModel\":\"dummy2\"}"
        },
        "type": 1
      },
      "id": 66,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        2
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "Inner App",
      "emits": {
        "identifier": "yet_another_driver",
        "notification": {
          "kind": "N",
          "value": "circular behaviour emits: {\"key\":\"value\",\"dummyKey3InitModel\":\"dummy3\",\"dummyKey1InitModel\":\"dummy2\"}"
        },
        "type": 1
      },
      "id": 67,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": "InjectLocalState|Inner",
      "componentName": "App",
      "emits": {
        "identifier": "yet_another_driver",
        "notification": {
          "kind": "N",
          "value": "circular behaviour emits: {\"key\":\"value\",\"dummyKey3InitModel\":\"dummy3\",\"dummyKey1InitModel\":\"dummy2\"}"
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
      "combinatorName": "InjectLocalState",
      "componentName": "App",
      "emits": {
        "identifier": "yet_another_driver",
        "notification": {
          "kind": "N",
          "value": "circular behaviour emits: {\"key\":\"value\",\"dummyKey3InitModel\":\"dummy3\",\"dummyKey1InitModel\":\"dummy2\"}"
        },
        "type": 1
      },
      "id": 69,
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
        "identifier": "yet_another_driver",
        "notification": {
          "kind": "N",
          "value": "circular behaviour emits: {\"key\":\"value\",\"dummyKey3InitModel\":\"dummy3\",\"dummyKey1InitModel\":\"dummy2\"}"
        },
        "type": 1
      },
      "id": 70,
      "logType": "runtime",
      "path": [
        0
      ]
    },
    {
      "combinatorName": undefined,
      "componentName": "commandRequestComponent",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "b"
        },
        "type": 0
      },
      "id": 71,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        1
      ],
      "settings": {}
    },
    {
      "combinatorName": undefined,
      "componentName": "commandRequestComponent",
      "emits": {
        "identifier": "a_circular_event_source",
        "notification": {
          "kind": "N",
          "value": {
            "command": "a_command",
            "context": null,
            "params": "b"
          }
        },
        "type": 1
      },
      "id": 72,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        1
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "Inner App",
      "emits": {
        "identifier": "a_circular_event_source",
        "notification": {
          "kind": "N",
          "value": {
            "command": "a_command",
            "context": null,
            "params": "b"
          }
        },
        "type": 1
      },
      "id": 73,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": "InjectLocalState|Inner",
      "componentName": "App",
      "emits": {
        "identifier": "a_circular_event_source",
        "notification": {
          "kind": "N",
          "value": {
            "command": "a_command",
            "context": null,
            "params": "b"
          }
        },
        "type": 1
      },
      "id": 74,
      "logType": "runtime",
      "path": [
        0,
        0
      ]
    },
    {
      "combinatorName": undefined,
      "componentName": "sinkUpdatingComponent",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "b"
        },
        "type": 0
      },
      "id": 75,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        2
      ],
      "settings": {}
    },
    {
      "combinatorName": undefined,
      "componentName": "sinkUpdatingComponent",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "driver1 emits: b"
        },
        "type": 1
      },
      "id": 76,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        2
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "Inner App",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "driver1 emits: b"
        },
        "type": 1
      },
      "id": 77,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": "InjectLocalState|Inner",
      "componentName": "App",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "driver1 emits: b"
        },
        "type": 1
      },
      "id": 78,
      "logType": "runtime",
      "path": [
        0,
        0
      ]
    },
    {
      "combinatorName": "InjectLocalState",
      "componentName": "App",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "driver1 emits: b"
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
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "driver1 emits: b"
        },
        "type": 1
      },
      "id": 80,
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

QUnit.test("edge case - InjectCircularSources - error in event sink", function exec_test(assert) {
  // What happens here is that `commandRequestComponentWithError` will produce an error, and hence will no longer emit
  // However, other components (i.e. branches of the tree) will continue as usual, in so far as they do not require
  // of the now dead event source. For instance, here, ANOTHER_DRIVER sink emits nothing
  resetGraphCounter();
  const done = assert.async(5);
  const traces = [];
  /** @type InjectLocalStateSettings*/
  const injectSettings = {
    behaviour: [A_CIRCULAR_BEHAVIOR_SOURCE, INITIAL_STATE],
    event: [A_CIRCULAR_EVENT_SOURCE, commandProcessingFn]
  };

  const App = InjectCircularSources(set(componentNameInSettings, APP_NAME, injectSettings), [
    Combine(set(componentNameInSettings, 'Inner App', {}), [
      behaviourUpdatingComponent,
      commandRequestComponentWithError,
      sinkUpdatingComponent
    ])
  ]);
  const tracedApp = traceApp({
    _trace: {
      traceSpecs: {
        [A_DRIVER]: [traceEventSourceFn, traceEventSinkFn],
        [ANOTHER_DRIVER]: [traceEventSourceFn, traceEventSinkFn],
        [YET_ANOTHER_DRIVER]: [traceEventSourceFn, traceEventSinkFn],
        // NOTE : the source is a behaviour but the sink is an event!
        [A_CIRCULAR_BEHAVIOR_SOURCE]: [traceBehaviourSourceFn, traceEventSinkFn],
        [A_CIRCULAR_EVENT_SOURCE]: [traceEventSourceFn, traceEventSinkFn],
//        [DOM_SINK]: [identity, traceDOMsinkFn]
      },
      sendMessage: msg => traces.push(msg)
    },
    _helpers: { getId: getId(0) }
  }, App);

  const inputs = [
    { [A_DRIVER]: { diagram: '-a--b--' } },
  ];

  const expectedMessages = {
    [A_DRIVER]: {
      outputs: inputs[0][A_DRIVER].diagram.replace(/-/g, '').split('').map(x => `driver1 emits: ${x}`),
      successMessage: `sink ${A_DRIVER} produces the expected values`
    },
    [ANOTHER_DRIVER]: {
      outputs: [],
      successMessage: `sink ${ANOTHER_DRIVER} produces the expected values`
    },
    [YET_ANOTHER_DRIVER]: {
      outputs: [
        "circular behaviour emits: {\"key\":\"value\"}",
        "circular behaviour emits: {\"key\":\"value\",\"dummyKey3InitModel\":\"dummy3\",\"dummyKey1InitModel\":\"dummy2\"}",
        "circular behaviour emits: {\"key\":\"value\",\"dummyKey3InitModel\":\"dummy3\",\"dummyKey1InitModel\":\"dummy2\"}"
      ],
      successMessage: `sink ${YET_ANOTHER_DRIVER} produces the expected values`
    },
    // I have to keep it, because the iframe is always there...
    [DOM_SINK]: {
      outputs: ["<div><iframe id=\"devtool\" src=\"devtool.html\" style=\"width: 450px; height: 200px\"></iframe></div>"],
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
      "combinatorName": "InjectLocalState",
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
      "combinatorName": "InjectLocalState|Inner",
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
      "combinatorName": "Combine",
      "componentName": "Inner App",
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
      "componentName": "behaviourUpdatingComponent",
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
      "combinatorName": undefined,
      "componentName": "commandRequestComponentWithError",
      "id": 5,
      "isContainerComponent": false,
      "logType": "graph_structure",
      "path": [
        0,
        0,
        0,
        1
      ]
    },
    {
      "combinatorName": undefined,
      "componentName": "sinkUpdatingComponent",
      "id": 6,
      "isContainerComponent": false,
      "logType": "graph_structure",
      "path": [
        0,
        0,
        0,
        2
      ]
    },
  ];
  const expectedTraces = [
    {
      "combinatorName": "InjectLocalState",
      "componentName": "App",
      "emits": {
        "identifier": "a_circular_behavior_source",
        "notification": {
          "kind": "N",
          "value": {
            "key": "value"
          }
        },
        "type": 0
      },
      "id": 0,
      "logType": "runtime",
      "path": [
        0,
        0
      ],
      "settings": {}
    },
    {
      "combinatorName": "InjectLocalState|Inner",
      "componentName": "App",
      "emits": {
        "identifier": "a_circular_behavior_source",
        "notification": {
          "kind": "N",
          "value": {
            "key": "value"
          }
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
      "combinatorName": "Combine",
      "componentName": "Inner App",
      "emits": {
        "identifier": "a_circular_behavior_source",
        "notification": {
          "kind": "N",
          "value": {
            "key": "value"
          }
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
      "settings": {}
    },
    {
      "combinatorName": undefined,
      "componentName": "sinkUpdatingComponent",
      "emits": {
        "identifier": "a_circular_behavior_source",
        "notification": {
          "kind": "N",
          "value": {
            "key": "value"
          }
        },
        "type": 0
      },
      "id": 3,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        2
      ],
      "settings": {}
    },
    {
      "combinatorName": undefined,
      "componentName": "sinkUpdatingComponent",
      "emits": {
        "identifier": "yet_another_driver",
        "notification": {
          "kind": "N",
          "value": "circular behaviour emits: {\"key\":\"value\"}"
        },
        "type": 1
      },
      "id": 4,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        2
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "Inner App",
      "emits": {
        "identifier": "yet_another_driver",
        "notification": {
          "kind": "N",
          "value": "circular behaviour emits: {\"key\":\"value\"}"
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
      "combinatorName": "InjectLocalState|Inner",
      "componentName": "App",
      "emits": {
        "identifier": "yet_another_driver",
        "notification": {
          "kind": "N",
          "value": "circular behaviour emits: {\"key\":\"value\"}"
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
      "combinatorName": "InjectLocalState",
      "componentName": "App",
      "emits": {
        "identifier": "yet_another_driver",
        "notification": {
          "kind": "N",
          "value": "circular behaviour emits: {\"key\":\"value\"}"
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
        "identifier": "yet_another_driver",
        "notification": {
          "kind": "N",
          "value": "circular behaviour emits: {\"key\":\"value\"}"
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
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "a"
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
      "combinatorName": "InjectLocalState",
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
        0
      ],
      "settings": {}
    },
    {
      "combinatorName": "InjectLocalState|Inner",
      "componentName": "App",
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
        0
      ],
      "settings": {}
    },
    {
      "combinatorName": "Combine",
      "componentName": "Inner App",
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
        0
      ],
      "settings": {}
    },
    {
      "combinatorName": undefined,
      "componentName": "behaviourUpdatingComponent",
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
        0,
        0
      ],
      "settings": {}
    },
    {
      "combinatorName": undefined,
      "componentName": "behaviourUpdatingComponent",
      "emits": {
        "identifier": "a_circular_behavior_source",
        "notification": {
          "kind": "N",
          "value": [
            {
              "op": "add",
              "path": "/dummyKey3InitModel",
              "value": "dummy3"
            },
            {
              "op": "replace",
              "path": "/dummyKey1InitModel",
              "value": "dummy2"
            },
            {
              "op": "remove",
              "path": "/dummyKey2InitModel"
            }
          ]
        },
        "type": 1
      },
      "id": 14,
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
      "componentName": "Inner App",
      "emits": {
        "identifier": "a_circular_behavior_source",
        "notification": {
          "kind": "N",
          "value": [
            {
              "op": "add",
              "path": "/dummyKey3InitModel",
              "value": "dummy3"
            },
            {
              "op": "replace",
              "path": "/dummyKey1InitModel",
              "value": "dummy2"
            },
            {
              "op": "remove",
              "path": "/dummyKey2InitModel"
            }
          ]
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
      "combinatorName": "InjectLocalState|Inner",
      "componentName": "App",
      "emits": {
        "identifier": "a_circular_behavior_source",
        "notification": {
          "kind": "N",
          "value": [
            {
              "op": "add",
              "path": "/dummyKey3InitModel",
              "value": "dummy3"
            },
            {
              "op": "replace",
              "path": "/dummyKey1InitModel",
              "value": "dummy2"
            },
            {
              "op": "remove",
              "path": "/dummyKey2InitModel"
            }
          ]
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
      "combinatorName": "InjectLocalState",
      "componentName": "App",
      "emits": {
        "identifier": "a_circular_behavior_source",
        "notification": {
          "kind": "N",
          "value": {
            "dummyKey1InitModel": "dummy2",
            "dummyKey3InitModel": "dummy3",
            "key": "value"
          }
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
      "combinatorName": "InjectLocalState|Inner",
      "componentName": "App",
      "emits": {
        "identifier": "a_circular_behavior_source",
        "notification": {
          "kind": "N",
          "value": {
            "dummyKey1InitModel": "dummy2",
            "dummyKey3InitModel": "dummy3",
            "key": "value"
          }
        },
        "type": 0
      },
      "id": 18,
      "logType": "runtime",
      "path": [
        0,
        0
      ],
      "settings": {}
    },
    {
      "combinatorName": "Combine",
      "componentName": "Inner App",
      "emits": {
        "identifier": "a_circular_behavior_source",
        "notification": {
          "kind": "N",
          "value": {
            "dummyKey1InitModel": "dummy2",
            "dummyKey3InitModel": "dummy3",
            "key": "value"
          }
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
      "settings": {}
    },
    {
      "combinatorName": undefined,
      "componentName": "sinkUpdatingComponent",
      "emits": {
        "identifier": "a_circular_behavior_source",
        "notification": {
          "kind": "N",
          "value": {
            "dummyKey1InitModel": "dummy2",
            "dummyKey3InitModel": "dummy3",
            "key": "value"
          }
        },
        "type": 0
      },
      "id": 20,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        2
      ],
      "settings": {}
    },
    {
      "combinatorName": undefined,
      "componentName": "sinkUpdatingComponent",
      "emits": {
        "identifier": "yet_another_driver",
        "notification": {
          "kind": "N",
          "value": "circular behaviour emits: {\"key\":\"value\",\"dummyKey3InitModel\":\"dummy3\",\"dummyKey1InitModel\":\"dummy2\"}"
        },
        "type": 1
      },
      "id": 21,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        2
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "Inner App",
      "emits": {
        "identifier": "yet_another_driver",
        "notification": {
          "kind": "N",
          "value": "circular behaviour emits: {\"key\":\"value\",\"dummyKey3InitModel\":\"dummy3\",\"dummyKey1InitModel\":\"dummy2\"}"
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
      "combinatorName": "InjectLocalState|Inner",
      "componentName": "App",
      "emits": {
        "identifier": "yet_another_driver",
        "notification": {
          "kind": "N",
          "value": "circular behaviour emits: {\"key\":\"value\",\"dummyKey3InitModel\":\"dummy3\",\"dummyKey1InitModel\":\"dummy2\"}"
        },
        "type": 1
      },
      "id": 23,
      "logType": "runtime",
      "path": [
        0,
        0
      ]
    },
    {
      "combinatorName": "InjectLocalState",
      "componentName": "App",
      "emits": {
        "identifier": "yet_another_driver",
        "notification": {
          "kind": "N",
          "value": "circular behaviour emits: {\"key\":\"value\",\"dummyKey3InitModel\":\"dummy3\",\"dummyKey1InitModel\":\"dummy2\"}"
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
        "identifier": "yet_another_driver",
        "notification": {
          "kind": "N",
          "value": "circular behaviour emits: {\"key\":\"value\",\"dummyKey3InitModel\":\"dummy3\",\"dummyKey1InitModel\":\"dummy2\"}"
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
      "combinatorName": undefined,
      "componentName": "commandRequestComponentWithError",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "a"
        },
        "type": 0
      },
      "id": 26,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        1
      ],
      "settings": {}
    },
    {
      "combinatorName": undefined,
      "componentName": "commandRequestComponentWithError",
      "emits": {
        "identifier": "a_circular_event_source",
        "notification": {
          "error": "AN_ERROR",
          "kind": "E"
        },
        "type": 1
      },
      "id": 27,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        1
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "Inner App",
      "emits": {
        "identifier": "a_circular_event_source",
        "notification": {
          "error": "AN_ERROR",
          "kind": "E"
        },
        "type": 1
      },
      "id": 28,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": "InjectLocalState|Inner",
      "componentName": "App",
      "emits": {
        "identifier": "a_circular_event_source",
        "notification": {
          "error": "AN_ERROR",
          "kind": "E"
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
      "combinatorName": undefined,
      "componentName": "sinkUpdatingComponent",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "a"
        },
        "type": 0
      },
      "id": 30,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        2
      ],
      "settings": {}
    },
    {
      "combinatorName": undefined,
      "componentName": "sinkUpdatingComponent",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "driver1 emits: a"
        },
        "type": 1
      },
      "id": 31,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        2
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "Inner App",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "driver1 emits: a"
        },
        "type": 1
      },
      "id": 32,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": "InjectLocalState|Inner",
      "componentName": "App",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "driver1 emits: a"
        },
        "type": 1
      },
      "id": 33,
      "logType": "runtime",
      "path": [
        0,
        0
      ]
    },
    {
      "combinatorName": "InjectLocalState",
      "componentName": "App",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "driver1 emits: a"
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
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "driver1 emits: a"
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
      "combinatorName": "InjectLocalState",
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
      "settings": {}
    },
    {
      "combinatorName": "InjectLocalState|Inner",
      "componentName": "App",
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
        0
      ],
      "settings": {}
    },
    {
      "combinatorName": "Combine",
      "componentName": "Inner App",
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
        0
      ],
      "settings": {}
    },
    {
      "combinatorName": undefined,
      "componentName": "behaviourUpdatingComponent",
      "emits": {
        "identifier": "a_driver",
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
        0,
        0
      ],
      "settings": {}
    },
    {
      "combinatorName": undefined,
      "componentName": "behaviourUpdatingComponent",
      "emits": {
        "identifier": "a_circular_behavior_source",
        "notification": {
          "kind": "N",
          "value": [
            {
              "op": "add",
              "path": "/dummyKey3InitModel",
              "value": "dummy3"
            },
            {
              "op": "replace",
              "path": "/dummyKey1InitModel",
              "value": "dummy2"
            },
            {
              "op": "remove",
              "path": "/dummyKey2InitModel"
            }
          ]
        },
        "type": 1
      },
      "id": 41,
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
      "componentName": "Inner App",
      "emits": {
        "identifier": "a_circular_behavior_source",
        "notification": {
          "kind": "N",
          "value": [
            {
              "op": "add",
              "path": "/dummyKey3InitModel",
              "value": "dummy3"
            },
            {
              "op": "replace",
              "path": "/dummyKey1InitModel",
              "value": "dummy2"
            },
            {
              "op": "remove",
              "path": "/dummyKey2InitModel"
            }
          ]
        },
        "type": 1
      },
      "id": 42,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": "InjectLocalState|Inner",
      "componentName": "App",
      "emits": {
        "identifier": "a_circular_behavior_source",
        "notification": {
          "kind": "N",
          "value": [
            {
              "op": "add",
              "path": "/dummyKey3InitModel",
              "value": "dummy3"
            },
            {
              "op": "replace",
              "path": "/dummyKey1InitModel",
              "value": "dummy2"
            },
            {
              "op": "remove",
              "path": "/dummyKey2InitModel"
            }
          ]
        },
        "type": 1
      },
      "id": 43,
      "logType": "runtime",
      "path": [
        0,
        0
      ]
    },
    {
      "combinatorName": "InjectLocalState",
      "componentName": "App",
      "emits": {
        "identifier": "a_circular_behavior_source",
        "notification": {
          "kind": "N",
          "value": {
            "dummyKey1InitModel": "dummy2",
            "dummyKey3InitModel": "dummy3",
            "key": "value"
          }
        },
        "type": 0
      },
      "id": 44,
      "logType": "runtime",
      "path": [
        0,
        0
      ],
      "settings": {}
    },
    {
      "combinatorName": "InjectLocalState|Inner",
      "componentName": "App",
      "emits": {
        "identifier": "a_circular_behavior_source",
        "notification": {
          "kind": "N",
          "value": {
            "dummyKey1InitModel": "dummy2",
            "dummyKey3InitModel": "dummy3",
            "key": "value"
          }
        },
        "type": 0
      },
      "id": 45,
      "logType": "runtime",
      "path": [
        0,
        0
      ],
      "settings": {}
    },
    {
      "combinatorName": "Combine",
      "componentName": "Inner App",
      "emits": {
        "identifier": "a_circular_behavior_source",
        "notification": {
          "kind": "N",
          "value": {
            "dummyKey1InitModel": "dummy2",
            "dummyKey3InitModel": "dummy3",
            "key": "value"
          }
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
      "settings": {}
    },
    {
      "combinatorName": undefined,
      "componentName": "sinkUpdatingComponent",
      "emits": {
        "identifier": "a_circular_behavior_source",
        "notification": {
          "kind": "N",
          "value": {
            "dummyKey1InitModel": "dummy2",
            "dummyKey3InitModel": "dummy3",
            "key": "value"
          }
        },
        "type": 0
      },
      "id": 47,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        2
      ],
      "settings": {}
    },
    {
      "combinatorName": undefined,
      "componentName": "sinkUpdatingComponent",
      "emits": {
        "identifier": "yet_another_driver",
        "notification": {
          "kind": "N",
          "value": "circular behaviour emits: {\"key\":\"value\",\"dummyKey3InitModel\":\"dummy3\",\"dummyKey1InitModel\":\"dummy2\"}"
        },
        "type": 1
      },
      "id": 48,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        2
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "Inner App",
      "emits": {
        "identifier": "yet_another_driver",
        "notification": {
          "kind": "N",
          "value": "circular behaviour emits: {\"key\":\"value\",\"dummyKey3InitModel\":\"dummy3\",\"dummyKey1InitModel\":\"dummy2\"}"
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
      "combinatorName": "InjectLocalState|Inner",
      "componentName": "App",
      "emits": {
        "identifier": "yet_another_driver",
        "notification": {
          "kind": "N",
          "value": "circular behaviour emits: {\"key\":\"value\",\"dummyKey3InitModel\":\"dummy3\",\"dummyKey1InitModel\":\"dummy2\"}"
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
      "combinatorName": "InjectLocalState",
      "componentName": "App",
      "emits": {
        "identifier": "yet_another_driver",
        "notification": {
          "kind": "N",
          "value": "circular behaviour emits: {\"key\":\"value\",\"dummyKey3InitModel\":\"dummy3\",\"dummyKey1InitModel\":\"dummy2\"}"
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
        "identifier": "yet_another_driver",
        "notification": {
          "kind": "N",
          "value": "circular behaviour emits: {\"key\":\"value\",\"dummyKey3InitModel\":\"dummy3\",\"dummyKey1InitModel\":\"dummy2\"}"
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
      "combinatorName": undefined,
      "componentName": "sinkUpdatingComponent",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "b"
        },
        "type": 0
      },
      "id": 53,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        2
      ],
      "settings": {}
    },
    {
      "combinatorName": undefined,
      "componentName": "sinkUpdatingComponent",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "driver1 emits: b"
        },
        "type": 1
      },
      "id": 54,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        2
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "Inner App",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "driver1 emits: b"
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
      "combinatorName": "InjectLocalState|Inner",
      "componentName": "App",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "driver1 emits: b"
        },
        "type": 1
      },
      "id": 56,
      "logType": "runtime",
      "path": [
        0,
        0
      ]
    },
    {
      "combinatorName": "InjectLocalState",
      "componentName": "App",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "driver1 emits: b"
        },
        "type": 1
      },
      "id": 57,
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
      "id": 58,
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

QUnit.test("edge case - InjectCircularSources - error in behaviour sink", function exec_test(assert) {
  // What happens here is that `commandRequestComponentWithError` will produce an error, and hence will no longer emit
  // However, other components (i.e. branches of the tree) will continue as usual, in so far as they do not require
  // of the now dead event source. For instance, here, ANOTHER_DRIVER sink emits nothing
  resetGraphCounter();
  const done = assert.async(5);
  const traces = [];
  /** @type InjectLocalStateSettings*/
  const injectSettings = {
    behaviour: [A_CIRCULAR_BEHAVIOR_SOURCE, INITIAL_STATE],
    event: [A_CIRCULAR_EVENT_SOURCE, commandProcessingFn]
  };

  const App = InjectCircularSources(set(componentNameInSettings, APP_NAME, injectSettings), [
    Combine(set(componentNameInSettings, 'Inner App', {}), [
      behaviourUpdatingComponentWithError,
      commandRequestComponent,
      sinkUpdatingComponent
    ])
  ]);
  const tracedApp = traceApp({
    _trace: {
      traceSpecs: {
        [A_DRIVER]: [traceEventSourceFn, traceEventSinkFn],
        [ANOTHER_DRIVER]: [traceEventSourceFn, traceEventSinkFn],
        [YET_ANOTHER_DRIVER]: [traceEventSourceFn, traceEventSinkFn],
        // NOTE : the source is a behaviour but the sink is an event!
        [A_CIRCULAR_BEHAVIOR_SOURCE]: [traceBehaviourSourceFn, traceEventSinkFn],
        [A_CIRCULAR_EVENT_SOURCE]: [traceEventSourceFn, traceEventSinkFn],
//        [DOM_SINK]: [identity, traceDOMsinkFn]
      },
      sendMessage: msg => traces.push(msg)
    },
    _helpers: { getId: getId(0) }
  }, App);

  const inputs = [
    { [A_DRIVER]: { diagram: '-a--b--' } },
  ];

  const expectedMessages = {
    [A_DRIVER]: {
      outputs: inputs[0][A_DRIVER].diagram.replace(/-/g, '').split('').map(x => `driver1 emits: ${x}`),
      successMessage: `sink ${A_DRIVER} produces the expected values`
    },
    [ANOTHER_DRIVER]: {
      outputs: [
        "circular event source emits: {\"request\":{\"context\":null,\"command\":\"a_command\",\"params\":\"a\"},\"response\":\"a_response\"}"
      ],
      successMessage: `sink ${ANOTHER_DRIVER} produces the expected values`
    },
    [YET_ANOTHER_DRIVER]: {
      outputs: [
        "circular behaviour emits: {\"key\":\"value\"}",
      ],
      successMessage: `sink ${YET_ANOTHER_DRIVER} produces the expected values`
    },
    // I have to keep it, because the iframe is always there...
    [DOM_SINK]: {
      outputs: ["<div><iframe id=\"devtool\" src=\"devtool.html\" style=\"width: 450px; height: 200px\"></iframe></div>"],
      successMessage: `sink ${DOM_SINK} produces the expected values`,
      transform: pipe(convertVNodesToHTML)
    },
  };

  const expectedGraph =[
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
      "combinatorName": "InjectLocalState",
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
      "combinatorName": "InjectLocalState|Inner",
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
      "combinatorName": "Combine",
      "componentName": "Inner App",
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
      "componentName": "behaviourUpdatingComponentWithError",
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
      "combinatorName": undefined,
      "componentName": "commandRequestComponent",
      "id": 5,
      "isContainerComponent": false,
      "logType": "graph_structure",
      "path": [
        0,
        0,
        0,
        1
      ]
    },
    {
      "combinatorName": undefined,
      "componentName": "sinkUpdatingComponent",
      "id": 6,
      "isContainerComponent": false,
      "logType": "graph_structure",
      "path": [
        0,
        0,
        0,
        2
      ]
    },
  ];
  const expectedTraces = [
    {
      "combinatorName": "InjectLocalState",
      "componentName": "App",
      "emits": {
        "identifier": "a_circular_behavior_source",
        "notification": {
          "kind": "N",
          "value": {
            "key": "value"
          }
        },
        "type": 0
      },
      "id": 0,
      "logType": "runtime",
      "path": [
        0,
        0
      ],
      "settings": {}
    },
    {
      "combinatorName": "InjectLocalState|Inner",
      "componentName": "App",
      "emits": {
        "identifier": "a_circular_behavior_source",
        "notification": {
          "kind": "N",
          "value": {
            "key": "value"
          }
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
      "combinatorName": "Combine",
      "componentName": "Inner App",
      "emits": {
        "identifier": "a_circular_behavior_source",
        "notification": {
          "kind": "N",
          "value": {
            "key": "value"
          }
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
      "settings": {}
    },
    {
      "combinatorName": undefined,
      "componentName": "sinkUpdatingComponent",
      "emits": {
        "identifier": "a_circular_behavior_source",
        "notification": {
          "kind": "N",
          "value": {
            "key": "value"
          }
        },
        "type": 0
      },
      "id": 3,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        2
      ],
      "settings": {}
    },
    {
      "combinatorName": undefined,
      "componentName": "sinkUpdatingComponent",
      "emits": {
        "identifier": "yet_another_driver",
        "notification": {
          "kind": "N",
          "value": "circular behaviour emits: {\"key\":\"value\"}"
        },
        "type": 1
      },
      "id": 4,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        2
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "Inner App",
      "emits": {
        "identifier": "yet_another_driver",
        "notification": {
          "kind": "N",
          "value": "circular behaviour emits: {\"key\":\"value\"}"
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
      "combinatorName": "InjectLocalState|Inner",
      "componentName": "App",
      "emits": {
        "identifier": "yet_another_driver",
        "notification": {
          "kind": "N",
          "value": "circular behaviour emits: {\"key\":\"value\"}"
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
      "combinatorName": "InjectLocalState",
      "componentName": "App",
      "emits": {
        "identifier": "yet_another_driver",
        "notification": {
          "kind": "N",
          "value": "circular behaviour emits: {\"key\":\"value\"}"
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
        "identifier": "yet_another_driver",
        "notification": {
          "kind": "N",
          "value": "circular behaviour emits: {\"key\":\"value\"}"
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
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "a"
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
      "combinatorName": "InjectLocalState",
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
        0
      ],
      "settings": {}
    },
    {
      "combinatorName": "InjectLocalState|Inner",
      "componentName": "App",
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
        0
      ],
      "settings": {}
    },
    {
      "combinatorName": "Combine",
      "componentName": "Inner App",
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
        0
      ],
      "settings": {}
    },
    {
      "combinatorName": undefined,
      "componentName": "behaviourUpdatingComponentWithError",
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
        0,
        0
      ],
      "settings": {}
    },
    {
      "combinatorName": undefined,
      "componentName": "behaviourUpdatingComponentWithError",
      "emits": {
        "identifier": "a_circular_behavior_source",
        "notification": {
          "error": "AN_ERROR",
          "kind": "E"
        },
        "type": 1
      },
      "id": 14,
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
      "componentName": "Inner App",
      "emits": {
        "identifier": "a_circular_behavior_source",
        "notification": {
          "error": "AN_ERROR",
          "kind": "E"
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
      "combinatorName": "InjectLocalState|Inner",
      "componentName": "App",
      "emits": {
        "identifier": "a_circular_behavior_source",
        "notification": {
          "error": "AN_ERROR",
          "kind": "E"
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
      "combinatorName": undefined,
      "componentName": "commandRequestComponent",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "a"
        },
        "type": 0
      },
      "id": 17,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        1
      ],
      "settings": {}
    },
    {
      "combinatorName": undefined,
      "componentName": "commandRequestComponent",
      "emits": {
        "identifier": "a_circular_event_source",
        "notification": {
          "kind": "N",
          "value": {
            "command": "a_command",
            "context": null,
            "params": "a"
          }
        },
        "type": 1
      },
      "id": 18,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        1
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "Inner App",
      "emits": {
        "identifier": "a_circular_event_source",
        "notification": {
          "kind": "N",
          "value": {
            "command": "a_command",
            "context": null,
            "params": "a"
          }
        },
        "type": 1
      },
      "id": 19,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": "InjectLocalState|Inner",
      "componentName": "App",
      "emits": {
        "identifier": "a_circular_event_source",
        "notification": {
          "kind": "N",
          "value": {
            "command": "a_command",
            "context": null,
            "params": "a"
          }
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
      "combinatorName": "InjectLocalState",
      "componentName": "App",
      "emits": {
        "identifier": "a_circular_event_source",
        "notification": {
          "kind": "N",
          "value": {
            "request": {
              "command": "a_command",
              "context": null,
              "params": "a"
            },
            "response": "a_response"
          }
        },
        "type": 0
      },
      "id": 21,
      "logType": "runtime",
      "path": [
        0,
        0
      ],
      "settings": {}
    },
    {
      "combinatorName": "InjectLocalState|Inner",
      "componentName": "App",
      "emits": {
        "identifier": "a_circular_event_source",
        "notification": {
          "kind": "N",
          "value": {
            "request": {
              "command": "a_command",
              "context": null,
              "params": "a"
            },
            "response": "a_response"
          }
        },
        "type": 0
      },
      "id": 22,
      "logType": "runtime",
      "path": [
        0,
        0
      ],
      "settings": {}
    },
    {
      "combinatorName": "Combine",
      "componentName": "Inner App",
      "emits": {
        "identifier": "a_circular_event_source",
        "notification": {
          "kind": "N",
          "value": {
            "request": {
              "command": "a_command",
              "context": null,
              "params": "a"
            },
            "response": "a_response"
          }
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
      "settings": {}
    },
    {
      "combinatorName": undefined,
      "componentName": "sinkUpdatingComponent",
      "emits": {
        "identifier": "a_circular_event_source",
        "notification": {
          "kind": "N",
          "value": {
            "request": {
              "command": "a_command",
              "context": null,
              "params": "a"
            },
            "response": "a_response"
          }
        },
        "type": 0
      },
      "id": 24,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        2
      ],
      "settings": {}
    },
    {
      "combinatorName": undefined,
      "componentName": "sinkUpdatingComponent",
      "emits": {
        "identifier": "another_driver",
        "notification": {
          "kind": "N",
          "value": "circular event source emits: {\"request\":{\"context\":null,\"command\":\"a_command\",\"params\":\"a\"},\"response\":\"a_response\"}"
        },
        "type": 1
      },
      "id": 25,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        2
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "Inner App",
      "emits": {
        "identifier": "another_driver",
        "notification": {
          "kind": "N",
          "value": "circular event source emits: {\"request\":{\"context\":null,\"command\":\"a_command\",\"params\":\"a\"},\"response\":\"a_response\"}"
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
      "combinatorName": "InjectLocalState|Inner",
      "componentName": "App",
      "emits": {
        "identifier": "another_driver",
        "notification": {
          "kind": "N",
          "value": "circular event source emits: {\"request\":{\"context\":null,\"command\":\"a_command\",\"params\":\"a\"},\"response\":\"a_response\"}"
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
      "combinatorName": "InjectLocalState",
      "componentName": "App",
      "emits": {
        "identifier": "another_driver",
        "notification": {
          "kind": "N",
          "value": "circular event source emits: {\"request\":{\"context\":null,\"command\":\"a_command\",\"params\":\"a\"},\"response\":\"a_response\"}"
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
        "identifier": "another_driver",
        "notification": {
          "kind": "N",
          "value": "circular event source emits: {\"request\":{\"context\":null,\"command\":\"a_command\",\"params\":\"a\"},\"response\":\"a_response\"}"
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
      "combinatorName": "InjectLocalState",
      "componentName": "App",
      "emits": {
        "identifier": "a_circular_event_source",
        "notification": {
          "error": undefined,
          "kind": "C"
        },
        "type": 0
      },
      "id": 30,
      "logType": "runtime",
      "path": [
        0,
        0
      ],
      "settings": {}
    },
    {
      "combinatorName": "InjectLocalState|Inner",
      "componentName": "App",
      "emits": {
        "identifier": "a_circular_event_source",
        "notification": {
          "error": undefined,
          "kind": "C"
        },
        "type": 0
      },
      "id": 31,
      "logType": "runtime",
      "path": [
        0,
        0
      ],
      "settings": {}
    },
    {
      "combinatorName": "Combine",
      "componentName": "Inner App",
      "emits": {
        "identifier": "a_circular_event_source",
        "notification": {
          "error": undefined,
          "kind": "C"
        },
        "type": 0
      },
      "id": 32,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ],
      "settings": {}
    },
    {
      "combinatorName": undefined,
      "componentName": "sinkUpdatingComponent",
      "emits": {
        "identifier": "a_circular_event_source",
        "notification": {
          "error": undefined,
          "kind": "C"
        },
        "type": 0
      },
      "id": 33,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        2
      ],
      "settings": {}
    },
    {
      "combinatorName": undefined,
      "componentName": "sinkUpdatingComponent",
      "emits": {
        "identifier": "another_driver",
        "notification": {
          "error": undefined,
          "kind": "C"
        },
        "type": 1
      },
      "id": 34,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        2
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "Inner App",
      "emits": {
        "identifier": "another_driver",
        "notification": {
          "error": undefined,
          "kind": "C"
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
      "combinatorName": "InjectLocalState|Inner",
      "componentName": "App",
      "emits": {
        "identifier": "another_driver",
        "notification": {
          "error": undefined,
          "kind": "C"
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
      "combinatorName": "InjectLocalState",
      "componentName": "App",
      "emits": {
        "identifier": "another_driver",
        "notification": {
          "error": undefined,
          "kind": "C"
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
      "combinatorName": "Combine",
      "componentName": "ROOT",
      "emits": {
        "identifier": "another_driver",
        "notification": {
          "error": undefined,
          "kind": "C"
        },
        "type": 1
      },
      "id": 38,
      "logType": "runtime",
      "path": [
        0
      ]
    },
    {
      "combinatorName": undefined,
      "componentName": "sinkUpdatingComponent",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "a"
        },
        "type": 0
      },
      "id": 39,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        2
      ],
      "settings": {}
    },
    {
      "combinatorName": undefined,
      "componentName": "sinkUpdatingComponent",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "driver1 emits: a"
        },
        "type": 1
      },
      "id": 40,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        2
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "Inner App",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "driver1 emits: a"
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
      "combinatorName": "InjectLocalState|Inner",
      "componentName": "App",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "driver1 emits: a"
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
      "combinatorName": "InjectLocalState",
      "componentName": "App",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "driver1 emits: a"
        },
        "type": 1
      },
      "id": 43,
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
      "id": 44,
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
      "id": 45,
      "logType": "runtime",
      "path": [
        0
      ],
      "settings": {}
    },
    {
      "combinatorName": "InjectLocalState",
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
        0
      ],
      "settings": {}
    },
    {
      "combinatorName": "InjectLocalState|Inner",
      "componentName": "App",
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
        0
      ],
      "settings": {}
    },
    {
      "combinatorName": "Combine",
      "componentName": "Inner App",
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
        0
      ],
      "settings": {}
    },
    {
      "combinatorName": undefined,
      "componentName": "commandRequestComponent",
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
        0,
        1
      ],
      "settings": {}
    },
    {
      "combinatorName": undefined,
      "componentName": "commandRequestComponent",
      "emits": {
        "identifier": "a_circular_event_source",
        "notification": {
          "kind": "N",
          "value": {
            "command": "a_command",
            "context": null,
            "params": "b"
          }
        },
        "type": 1
      },
      "id": 50,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        1
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "Inner App",
      "emits": {
        "identifier": "a_circular_event_source",
        "notification": {
          "kind": "N",
          "value": {
            "command": "a_command",
            "context": null,
            "params": "b"
          }
        },
        "type": 1
      },
      "id": 51,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": "InjectLocalState|Inner",
      "componentName": "App",
      "emits": {
        "identifier": "a_circular_event_source",
        "notification": {
          "kind": "N",
          "value": {
            "command": "a_command",
            "context": null,
            "params": "b"
          }
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
      "combinatorName": undefined,
      "componentName": "sinkUpdatingComponent",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "b"
        },
        "type": 0
      },
      "id": 53,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        2
      ],
      "settings": {}
    },
    {
      "combinatorName": undefined,
      "componentName": "sinkUpdatingComponent",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "driver1 emits: b"
        },
        "type": 1
      },
      "id": 54,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        2
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "Inner App",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "driver1 emits: b"
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
      "combinatorName": "InjectLocalState|Inner",
      "componentName": "App",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "driver1 emits: b"
        },
        "type": 1
      },
      "id": 56,
      "logType": "runtime",
      "path": [
        0,
        0
      ]
    },
    {
      "combinatorName": "InjectLocalState",
      "componentName": "App",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "driver1 emits: b"
        },
        "type": 1
      },
      "id": 57,
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
      "id": 58,
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

QUnit.test("main case - InjectCircularSources - processFn throws", function exec_test(assert) {
  resetGraphCounter();
  const done = assert.async(5);
  const traces = [];
  /** @type InjectLocalStateSettings*/
  const injectSettings = {
    behaviour: [A_CIRCULAR_BEHAVIOR_SOURCE, INITIAL_STATE],
    event: [A_CIRCULAR_EVENT_SOURCE, commandProcessingFnWithError]
  };

  const App = InjectCircularSources(set(componentNameInSettings, APP_NAME, injectSettings), [
    Combine(set(componentNameInSettings, 'Inner App', {}), [
      behaviourUpdatingComponent,
      commandRequestComponent,
      sinkUpdatingComponent
    ])
  ]);
  const tracedApp = traceApp({
    _trace: {
      traceSpecs: {
        [A_DRIVER]: [traceEventSourceFn, traceEventSinkFn],
        [ANOTHER_DRIVER]: [traceEventSourceFn, traceEventSinkFn],
        [YET_ANOTHER_DRIVER]: [traceEventSourceFn, traceEventSinkFn],
        // NOTE : the source is a behaviour but the sink is an event!
        [A_CIRCULAR_BEHAVIOR_SOURCE]: [traceBehaviourSourceFn, traceEventSinkFn],
        [A_CIRCULAR_EVENT_SOURCE]: [traceEventSourceFn, traceEventSinkFn],
//        [DOM_SINK]: [identity, traceDOMsinkFn]
      },
      sendMessage: msg => traces.push(msg)
    },
    _helpers: { getId: getId(0) }
  }, App);

  const inputs = [
    { [A_DRIVER]: { diagram: '-a--b--' } },
  ];

  const expectedMessages = {
    [A_DRIVER]: {
      outputs: inputs[0][A_DRIVER].diagram.replace(/-/g, '').split('').map(x => `driver1 emits: ${x}`),
      successMessage: `sink ${A_DRIVER} produces the expected values`
    },
    [ANOTHER_DRIVER]: {
      outputs: [
        makeErrorMessage(AN_ERROR)
      ],
      successMessage: `sink ${ANOTHER_DRIVER} produces the expected values`
    },
    [YET_ANOTHER_DRIVER]: {
      outputs: [
        "circular behaviour emits: {\"key\":\"value\"}",
        "circular behaviour emits: {\"key\":\"value\",\"dummyKey3InitModel\":\"dummy3\",\"dummyKey1InitModel\":\"dummy2\"}",
        "circular behaviour emits: {\"key\":\"value\",\"dummyKey3InitModel\":\"dummy3\",\"dummyKey1InitModel\":\"dummy2\"}"
      ],
      successMessage: `sink ${YET_ANOTHER_DRIVER} produces the expected values`
    },
    // I have to keep it, because the iframe is always there...
    [DOM_SINK]: {
      outputs: ["<div><iframe id=\"devtool\" src=\"devtool.html\" style=\"width: 450px; height: 200px\"></iframe></div>"],
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
      "combinatorName": "InjectLocalState",
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
      "combinatorName": "InjectLocalState|Inner",
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
      "combinatorName": "Combine",
      "componentName": "Inner App",
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
      "componentName": "behaviourUpdatingComponent",
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
      "combinatorName": undefined,
      "componentName": "commandRequestComponent",
      "id": 5,
      "isContainerComponent": false,
      "logType": "graph_structure",
      "path": [
        0,
        0,
        0,
        1
      ]
    },
    {
      "combinatorName": undefined,
      "componentName": "sinkUpdatingComponent",
      "id": 6,
      "isContainerComponent": false,
      "logType": "graph_structure",
      "path": [
        0,
        0,
        0,
        2
      ]
    },
  ];
  const expectedTraces = [
    {
      "combinatorName": "InjectLocalState",
      "componentName": "App",
      "emits": {
        "identifier": "a_circular_behavior_source",
        "notification": {
          "kind": "N",
          "value": {
            "key": "value"
          }
        },
        "type": 0
      },
      "id": 0,
      "logType": "runtime",
      "path": [
        0,
        0
      ],
      "settings": {}
    },
    {
      "combinatorName": "InjectLocalState|Inner",
      "componentName": "App",
      "emits": {
        "identifier": "a_circular_behavior_source",
        "notification": {
          "kind": "N",
          "value": {
            "key": "value"
          }
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
      "combinatorName": "Combine",
      "componentName": "Inner App",
      "emits": {
        "identifier": "a_circular_behavior_source",
        "notification": {
          "kind": "N",
          "value": {
            "key": "value"
          }
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
      "settings": {}
    },
    {
      "combinatorName": undefined,
      "componentName": "sinkUpdatingComponent",
      "emits": {
        "identifier": "a_circular_behavior_source",
        "notification": {
          "kind": "N",
          "value": {
            "key": "value"
          }
        },
        "type": 0
      },
      "id": 3,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        2
      ],
      "settings": {}
    },
    {
      "combinatorName": undefined,
      "componentName": "sinkUpdatingComponent",
      "emits": {
        "identifier": "yet_another_driver",
        "notification": {
          "kind": "N",
          "value": "circular behaviour emits: {\"key\":\"value\"}"
        },
        "type": 1
      },
      "id": 4,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        2
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "Inner App",
      "emits": {
        "identifier": "yet_another_driver",
        "notification": {
          "kind": "N",
          "value": "circular behaviour emits: {\"key\":\"value\"}"
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
      "combinatorName": "InjectLocalState|Inner",
      "componentName": "App",
      "emits": {
        "identifier": "yet_another_driver",
        "notification": {
          "kind": "N",
          "value": "circular behaviour emits: {\"key\":\"value\"}"
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
      "combinatorName": "InjectLocalState",
      "componentName": "App",
      "emits": {
        "identifier": "yet_another_driver",
        "notification": {
          "kind": "N",
          "value": "circular behaviour emits: {\"key\":\"value\"}"
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
        "identifier": "yet_another_driver",
        "notification": {
          "kind": "N",
          "value": "circular behaviour emits: {\"key\":\"value\"}"
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
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "a"
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
      "combinatorName": "InjectLocalState",
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
        0
      ],
      "settings": {}
    },
    {
      "combinatorName": "InjectLocalState|Inner",
      "componentName": "App",
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
        0
      ],
      "settings": {}
    },
    {
      "combinatorName": "Combine",
      "componentName": "Inner App",
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
        0
      ],
      "settings": {}
    },
    {
      "combinatorName": undefined,
      "componentName": "behaviourUpdatingComponent",
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
        0,
        0
      ],
      "settings": {}
    },
    {
      "combinatorName": undefined,
      "componentName": "behaviourUpdatingComponent",
      "emits": {
        "identifier": "a_circular_behavior_source",
        "notification": {
          "kind": "N",
          "value": [
            {
              "op": "add",
              "path": "/dummyKey3InitModel",
              "value": "dummy3"
            },
            {
              "op": "replace",
              "path": "/dummyKey1InitModel",
              "value": "dummy2"
            },
            {
              "op": "remove",
              "path": "/dummyKey2InitModel"
            }
          ]
        },
        "type": 1
      },
      "id": 14,
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
      "componentName": "Inner App",
      "emits": {
        "identifier": "a_circular_behavior_source",
        "notification": {
          "kind": "N",
          "value": [
            {
              "op": "add",
              "path": "/dummyKey3InitModel",
              "value": "dummy3"
            },
            {
              "op": "replace",
              "path": "/dummyKey1InitModel",
              "value": "dummy2"
            },
            {
              "op": "remove",
              "path": "/dummyKey2InitModel"
            }
          ]
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
      "combinatorName": "InjectLocalState|Inner",
      "componentName": "App",
      "emits": {
        "identifier": "a_circular_behavior_source",
        "notification": {
          "kind": "N",
          "value": [
            {
              "op": "add",
              "path": "/dummyKey3InitModel",
              "value": "dummy3"
            },
            {
              "op": "replace",
              "path": "/dummyKey1InitModel",
              "value": "dummy2"
            },
            {
              "op": "remove",
              "path": "/dummyKey2InitModel"
            }
          ]
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
      "combinatorName": "InjectLocalState",
      "componentName": "App",
      "emits": {
        "identifier": "a_circular_behavior_source",
        "notification": {
          "kind": "N",
          "value": {
            "dummyKey1InitModel": "dummy2",
            "dummyKey3InitModel": "dummy3",
            "key": "value"
          }
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
      "combinatorName": "InjectLocalState|Inner",
      "componentName": "App",
      "emits": {
        "identifier": "a_circular_behavior_source",
        "notification": {
          "kind": "N",
          "value": {
            "dummyKey1InitModel": "dummy2",
            "dummyKey3InitModel": "dummy3",
            "key": "value"
          }
        },
        "type": 0
      },
      "id": 18,
      "logType": "runtime",
      "path": [
        0,
        0
      ],
      "settings": {}
    },
    {
      "combinatorName": "Combine",
      "componentName": "Inner App",
      "emits": {
        "identifier": "a_circular_behavior_source",
        "notification": {
          "kind": "N",
          "value": {
            "dummyKey1InitModel": "dummy2",
            "dummyKey3InitModel": "dummy3",
            "key": "value"
          }
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
      "settings": {}
    },
    {
      "combinatorName": undefined,
      "componentName": "sinkUpdatingComponent",
      "emits": {
        "identifier": "a_circular_behavior_source",
        "notification": {
          "kind": "N",
          "value": {
            "dummyKey1InitModel": "dummy2",
            "dummyKey3InitModel": "dummy3",
            "key": "value"
          }
        },
        "type": 0
      },
      "id": 20,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        2
      ],
      "settings": {}
    },
    {
      "combinatorName": undefined,
      "componentName": "sinkUpdatingComponent",
      "emits": {
        "identifier": "yet_another_driver",
        "notification": {
          "kind": "N",
          "value": "circular behaviour emits: {\"key\":\"value\",\"dummyKey3InitModel\":\"dummy3\",\"dummyKey1InitModel\":\"dummy2\"}"
        },
        "type": 1
      },
      "id": 21,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        2
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "Inner App",
      "emits": {
        "identifier": "yet_another_driver",
        "notification": {
          "kind": "N",
          "value": "circular behaviour emits: {\"key\":\"value\",\"dummyKey3InitModel\":\"dummy3\",\"dummyKey1InitModel\":\"dummy2\"}"
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
      "combinatorName": "InjectLocalState|Inner",
      "componentName": "App",
      "emits": {
        "identifier": "yet_another_driver",
        "notification": {
          "kind": "N",
          "value": "circular behaviour emits: {\"key\":\"value\",\"dummyKey3InitModel\":\"dummy3\",\"dummyKey1InitModel\":\"dummy2\"}"
        },
        "type": 1
      },
      "id": 23,
      "logType": "runtime",
      "path": [
        0,
        0
      ]
    },
    {
      "combinatorName": "InjectLocalState",
      "componentName": "App",
      "emits": {
        "identifier": "yet_another_driver",
        "notification": {
          "kind": "N",
          "value": "circular behaviour emits: {\"key\":\"value\",\"dummyKey3InitModel\":\"dummy3\",\"dummyKey1InitModel\":\"dummy2\"}"
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
        "identifier": "yet_another_driver",
        "notification": {
          "kind": "N",
          "value": "circular behaviour emits: {\"key\":\"value\",\"dummyKey3InitModel\":\"dummy3\",\"dummyKey1InitModel\":\"dummy2\"}"
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
      "combinatorName": undefined,
      "componentName": "commandRequestComponent",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "a"
        },
        "type": 0
      },
      "id": 26,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        1
      ],
      "settings": {}
    },
    {
      "combinatorName": undefined,
      "componentName": "commandRequestComponent",
      "emits": {
        "identifier": "a_circular_event_source",
        "notification": {
          "kind": "N",
          "value": {
            "command": "a_command",
            "context": null,
            "params": "a"
          }
        },
        "type": 1
      },
      "id": 27,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        1
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "Inner App",
      "emits": {
        "identifier": "a_circular_event_source",
        "notification": {
          "kind": "N",
          "value": {
            "command": "a_command",
            "context": null,
            "params": "a"
          }
        },
        "type": 1
      },
      "id": 28,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": "InjectLocalState|Inner",
      "componentName": "App",
      "emits": {
        "identifier": "a_circular_event_source",
        "notification": {
          "kind": "N",
          "value": {
            "command": "a_command",
            "context": null,
            "params": "a"
          }
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
      "combinatorName": "InjectLocalState",
      "componentName": "App",
      "emits": {
        "identifier": "a_circular_event_source",
        "notification": {
          "error": "AN_ERROR",
          "kind": "E"
        },
        "type": 0
      },
      "id": 30,
      "logType": "runtime",
      "path": [
        0,
        0
      ],
      "settings": {}
    },
    {
      "combinatorName": "InjectLocalState|Inner",
      "componentName": "App",
      "emits": {
        "identifier": "a_circular_event_source",
        "notification": {
          "error": "AN_ERROR",
          "kind": "E"
        },
        "type": 0
      },
      "id": 31,
      "logType": "runtime",
      "path": [
        0,
        0
      ],
      "settings": {}
    },
    {
      "combinatorName": "Combine",
      "componentName": "Inner App",
      "emits": {
        "identifier": "a_circular_event_source",
        "notification": {
          "error": "AN_ERROR",
          "kind": "E"
        },
        "type": 0
      },
      "id": 32,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ],
      "settings": {}
    },
    {
      "combinatorName": undefined,
      "componentName": "sinkUpdatingComponent",
      "emits": {
        "identifier": "a_circular_event_source",
        "notification": {
          "error": "AN_ERROR",
          "kind": "E"
        },
        "type": 0
      },
      "id": 33,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        2
      ],
      "settings": {}
    },
    {
      "combinatorName": undefined,
      "componentName": "sinkUpdatingComponent",
      "emits": {
        "identifier": "another_driver",
        "notification": {
          "error": "AN_ERROR",
          "kind": "E"
        },
        "type": 1
      },
      "id": 34,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        2
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "Inner App",
      "emits": {
        "identifier": "another_driver",
        "notification": {
          "error": "AN_ERROR",
          "kind": "E"
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
      "combinatorName": "InjectLocalState|Inner",
      "componentName": "App",
      "emits": {
        "identifier": "another_driver",
        "notification": {
          "error": "AN_ERROR",
          "kind": "E"
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
      "combinatorName": "InjectLocalState",
      "componentName": "App",
      "emits": {
        "identifier": "another_driver",
        "notification": {
          "error": "AN_ERROR",
          "kind": "E"
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
      "combinatorName": "Combine",
      "componentName": "ROOT",
      "emits": {
        "identifier": "another_driver",
        "notification": {
          "error": "AN_ERROR",
          "kind": "E"
        },
        "type": 1
      },
      "id": 38,
      "logType": "runtime",
      "path": [
        0
      ]
    },
    {
      "combinatorName": undefined,
      "componentName": "sinkUpdatingComponent",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "a"
        },
        "type": 0
      },
      "id": 39,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        2
      ],
      "settings": {}
    },
    {
      "combinatorName": undefined,
      "componentName": "sinkUpdatingComponent",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "driver1 emits: a"
        },
        "type": 1
      },
      "id": 40,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        2
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "Inner App",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "driver1 emits: a"
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
      "combinatorName": "InjectLocalState|Inner",
      "componentName": "App",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "driver1 emits: a"
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
      "combinatorName": "InjectLocalState",
      "componentName": "App",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "driver1 emits: a"
        },
        "type": 1
      },
      "id": 43,
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
      "id": 44,
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
      "id": 45,
      "logType": "runtime",
      "path": [
        0
      ],
      "settings": {}
    },
    {
      "combinatorName": "InjectLocalState",
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
        0
      ],
      "settings": {}
    },
    {
      "combinatorName": "InjectLocalState|Inner",
      "componentName": "App",
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
        0
      ],
      "settings": {}
    },
    {
      "combinatorName": "Combine",
      "componentName": "Inner App",
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
        0
      ],
      "settings": {}
    },
    {
      "combinatorName": undefined,
      "componentName": "behaviourUpdatingComponent",
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
        0,
        0
      ],
      "settings": {}
    },
    {
      "combinatorName": undefined,
      "componentName": "behaviourUpdatingComponent",
      "emits": {
        "identifier": "a_circular_behavior_source",
        "notification": {
          "kind": "N",
          "value": [
            {
              "op": "add",
              "path": "/dummyKey3InitModel",
              "value": "dummy3"
            },
            {
              "op": "replace",
              "path": "/dummyKey1InitModel",
              "value": "dummy2"
            },
            {
              "op": "remove",
              "path": "/dummyKey2InitModel"
            }
          ]
        },
        "type": 1
      },
      "id": 50,
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
      "componentName": "Inner App",
      "emits": {
        "identifier": "a_circular_behavior_source",
        "notification": {
          "kind": "N",
          "value": [
            {
              "op": "add",
              "path": "/dummyKey3InitModel",
              "value": "dummy3"
            },
            {
              "op": "replace",
              "path": "/dummyKey1InitModel",
              "value": "dummy2"
            },
            {
              "op": "remove",
              "path": "/dummyKey2InitModel"
            }
          ]
        },
        "type": 1
      },
      "id": 51,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": "InjectLocalState|Inner",
      "componentName": "App",
      "emits": {
        "identifier": "a_circular_behavior_source",
        "notification": {
          "kind": "N",
          "value": [
            {
              "op": "add",
              "path": "/dummyKey3InitModel",
              "value": "dummy3"
            },
            {
              "op": "replace",
              "path": "/dummyKey1InitModel",
              "value": "dummy2"
            },
            {
              "op": "remove",
              "path": "/dummyKey2InitModel"
            }
          ]
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
      "combinatorName": "InjectLocalState",
      "componentName": "App",
      "emits": {
        "identifier": "a_circular_behavior_source",
        "notification": {
          "kind": "N",
          "value": {
            "dummyKey1InitModel": "dummy2",
            "dummyKey3InitModel": "dummy3",
            "key": "value"
          }
        },
        "type": 0
      },
      "id": 53,
      "logType": "runtime",
      "path": [
        0,
        0
      ],
      "settings": {}
    },
    {
      "combinatorName": "InjectLocalState|Inner",
      "componentName": "App",
      "emits": {
        "identifier": "a_circular_behavior_source",
        "notification": {
          "kind": "N",
          "value": {
            "dummyKey1InitModel": "dummy2",
            "dummyKey3InitModel": "dummy3",
            "key": "value"
          }
        },
        "type": 0
      },
      "id": 54,
      "logType": "runtime",
      "path": [
        0,
        0
      ],
      "settings": {}
    },
    {
      "combinatorName": "Combine",
      "componentName": "Inner App",
      "emits": {
        "identifier": "a_circular_behavior_source",
        "notification": {
          "kind": "N",
          "value": {
            "dummyKey1InitModel": "dummy2",
            "dummyKey3InitModel": "dummy3",
            "key": "value"
          }
        },
        "type": 0
      },
      "id": 55,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ],
      "settings": {}
    },
    {
      "combinatorName": undefined,
      "componentName": "sinkUpdatingComponent",
      "emits": {
        "identifier": "a_circular_behavior_source",
        "notification": {
          "kind": "N",
          "value": {
            "dummyKey1InitModel": "dummy2",
            "dummyKey3InitModel": "dummy3",
            "key": "value"
          }
        },
        "type": 0
      },
      "id": 56,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        2
      ],
      "settings": {}
    },
    {
      "combinatorName": undefined,
      "componentName": "sinkUpdatingComponent",
      "emits": {
        "identifier": "yet_another_driver",
        "notification": {
          "kind": "N",
          "value": "circular behaviour emits: {\"key\":\"value\",\"dummyKey3InitModel\":\"dummy3\",\"dummyKey1InitModel\":\"dummy2\"}"
        },
        "type": 1
      },
      "id": 57,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        2
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "Inner App",
      "emits": {
        "identifier": "yet_another_driver",
        "notification": {
          "kind": "N",
          "value": "circular behaviour emits: {\"key\":\"value\",\"dummyKey3InitModel\":\"dummy3\",\"dummyKey1InitModel\":\"dummy2\"}"
        },
        "type": 1
      },
      "id": 58,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": "InjectLocalState|Inner",
      "componentName": "App",
      "emits": {
        "identifier": "yet_another_driver",
        "notification": {
          "kind": "N",
          "value": "circular behaviour emits: {\"key\":\"value\",\"dummyKey3InitModel\":\"dummy3\",\"dummyKey1InitModel\":\"dummy2\"}"
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
      "combinatorName": "InjectLocalState",
      "componentName": "App",
      "emits": {
        "identifier": "yet_another_driver",
        "notification": {
          "kind": "N",
          "value": "circular behaviour emits: {\"key\":\"value\",\"dummyKey3InitModel\":\"dummy3\",\"dummyKey1InitModel\":\"dummy2\"}"
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
        "identifier": "yet_another_driver",
        "notification": {
          "kind": "N",
          "value": "circular behaviour emits: {\"key\":\"value\",\"dummyKey3InitModel\":\"dummy3\",\"dummyKey1InitModel\":\"dummy2\"}"
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
      "combinatorName": undefined,
      "componentName": "commandRequestComponent",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "b"
        },
        "type": 0
      },
      "id": 62,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        1
      ],
      "settings": {}
    },
    {
      "combinatorName": undefined,
      "componentName": "commandRequestComponent",
      "emits": {
        "identifier": "a_circular_event_source",
        "notification": {
          "kind": "N",
          "value": {
            "command": "a_command",
            "context": null,
            "params": "b"
          }
        },
        "type": 1
      },
      "id": 63,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        1
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "Inner App",
      "emits": {
        "identifier": "a_circular_event_source",
        "notification": {
          "kind": "N",
          "value": {
            "command": "a_command",
            "context": null,
            "params": "b"
          }
        },
        "type": 1
      },
      "id": 64,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": "InjectLocalState|Inner",
      "componentName": "App",
      "emits": {
        "identifier": "a_circular_event_source",
        "notification": {
          "kind": "N",
          "value": {
            "command": "a_command",
            "context": null,
            "params": "b"
          }
        },
        "type": 1
      },
      "id": 65,
      "logType": "runtime",
      "path": [
        0,
        0
      ]
    },
    {
      "combinatorName": undefined,
      "componentName": "sinkUpdatingComponent",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "b"
        },
        "type": 0
      },
      "id": 66,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        2
      ],
      "settings": {}
    },
    {
      "combinatorName": undefined,
      "componentName": "sinkUpdatingComponent",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "driver1 emits: b"
        },
        "type": 1
      },
      "id": 67,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        2
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "Inner App",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "driver1 emits: b"
        },
        "type": 1
      },
      "id": 68,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": "InjectLocalState|Inner",
      "componentName": "App",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "driver1 emits: b"
        },
        "type": 1
      },
      "id": 69,
      "logType": "runtime",
      "path": [
        0,
        0
      ]
    },
    {
      "combinatorName": "InjectLocalState",
      "componentName": "App",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "driver1 emits: b"
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
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "driver1 emits: b"
        },
        "type": 1
      },
      "id": 71,
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

QUnit.test("main case - InjectCircularSources - processFn returns stream which throws", function exec_test(assert) {
  resetGraphCounter();
  const done = assert.async(5);
  const traces = [];
  /** @type InjectLocalStateSettings*/
  const injectSettings = {
    behaviour: [A_CIRCULAR_BEHAVIOR_SOURCE, INITIAL_STATE],
    event: [A_CIRCULAR_EVENT_SOURCE, commandProcessingFnWithThrowingStream]
  };

  const App = InjectCircularSources(set(componentNameInSettings, APP_NAME, injectSettings), [
    Combine(set(componentNameInSettings, 'Inner App', {}), [
      behaviourUpdatingComponent,
      commandRequestComponent,
      sinkUpdatingComponent
    ])
  ]);
  const tracedApp = traceApp({
    _trace: {
      traceSpecs: {
        [A_DRIVER]: [traceEventSourceFn, traceEventSinkFn],
        [ANOTHER_DRIVER]: [traceEventSourceFn, traceEventSinkFn],
        [YET_ANOTHER_DRIVER]: [traceEventSourceFn, traceEventSinkFn],
        // NOTE : the source is a behaviour but the sink is an event!
        [A_CIRCULAR_BEHAVIOR_SOURCE]: [traceBehaviourSourceFn, traceEventSinkFn],
        [A_CIRCULAR_EVENT_SOURCE]: [traceEventSourceFn, traceEventSinkFn],
//        [DOM_SINK]: [identity, traceDOMsinkFn]
      },
      sendMessage: msg => traces.push(msg)
    },
    _helpers: { getId: getId(0) }
  }, App);

  const inputs = [
    { [A_DRIVER]: { diagram: '-a--b--' } },
  ];

  const expectedMessages = {
    [A_DRIVER]: {
      outputs: inputs[0][A_DRIVER].diagram.replace(/-/g, '').split('').map(x => `driver1 emits: ${x}`),
      successMessage: `sink ${A_DRIVER} produces the expected values`
    },
    [ANOTHER_DRIVER]: {
      outputs: [
        makeErrorMessage(AN_ERROR)
      ],
      successMessage: `sink ${ANOTHER_DRIVER} produces the expected values`
    },
    [YET_ANOTHER_DRIVER]: {
      outputs: [
        "circular behaviour emits: {\"key\":\"value\"}",
        "circular behaviour emits: {\"key\":\"value\",\"dummyKey3InitModel\":\"dummy3\",\"dummyKey1InitModel\":\"dummy2\"}",
        "circular behaviour emits: {\"key\":\"value\",\"dummyKey3InitModel\":\"dummy3\",\"dummyKey1InitModel\":\"dummy2\"}"
      ],
      successMessage: `sink ${YET_ANOTHER_DRIVER} produces the expected values`
    },
    // I have to keep it, because the iframe is always there...
    [DOM_SINK]: {
      outputs: ["<div><iframe id=\"devtool\" src=\"devtool.html\" style=\"width: 450px; height: 200px\"></iframe></div>"],
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
      "combinatorName": "InjectLocalState",
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
      "combinatorName": "InjectLocalState|Inner",
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
      "combinatorName": "Combine",
      "componentName": "Inner App",
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
      "componentName": "behaviourUpdatingComponent",
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
      "combinatorName": undefined,
      "componentName": "commandRequestComponent",
      "id": 5,
      "isContainerComponent": false,
      "logType": "graph_structure",
      "path": [
        0,
        0,
        0,
        1
      ]
    },
    {
      "combinatorName": undefined,
      "componentName": "sinkUpdatingComponent",
      "id": 6,
      "isContainerComponent": false,
      "logType": "graph_structure",
      "path": [
        0,
        0,
        0,
        2
      ]
    },
  ];
  const expectedTraces = [
    {
      "combinatorName": "InjectLocalState",
      "componentName": "App",
      "emits": {
        "identifier": "a_circular_behavior_source",
        "notification": {
          "kind": "N",
          "value": {
            "key": "value"
          }
        },
        "type": 0
      },
      "id": 0,
      "logType": "runtime",
      "path": [
        0,
        0
      ],
      "settings": {}
    },
    {
      "combinatorName": "InjectLocalState|Inner",
      "componentName": "App",
      "emits": {
        "identifier": "a_circular_behavior_source",
        "notification": {
          "kind": "N",
          "value": {
            "key": "value"
          }
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
      "combinatorName": "Combine",
      "componentName": "Inner App",
      "emits": {
        "identifier": "a_circular_behavior_source",
        "notification": {
          "kind": "N",
          "value": {
            "key": "value"
          }
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
      "settings": {}
    },
    {
      "combinatorName": undefined,
      "componentName": "sinkUpdatingComponent",
      "emits": {
        "identifier": "a_circular_behavior_source",
        "notification": {
          "kind": "N",
          "value": {
            "key": "value"
          }
        },
        "type": 0
      },
      "id": 3,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        2
      ],
      "settings": {}
    },
    {
      "combinatorName": undefined,
      "componentName": "sinkUpdatingComponent",
      "emits": {
        "identifier": "yet_another_driver",
        "notification": {
          "kind": "N",
          "value": "circular behaviour emits: {\"key\":\"value\"}"
        },
        "type": 1
      },
      "id": 4,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        2
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "Inner App",
      "emits": {
        "identifier": "yet_another_driver",
        "notification": {
          "kind": "N",
          "value": "circular behaviour emits: {\"key\":\"value\"}"
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
      "combinatorName": "InjectLocalState|Inner",
      "componentName": "App",
      "emits": {
        "identifier": "yet_another_driver",
        "notification": {
          "kind": "N",
          "value": "circular behaviour emits: {\"key\":\"value\"}"
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
      "combinatorName": "InjectLocalState",
      "componentName": "App",
      "emits": {
        "identifier": "yet_another_driver",
        "notification": {
          "kind": "N",
          "value": "circular behaviour emits: {\"key\":\"value\"}"
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
        "identifier": "yet_another_driver",
        "notification": {
          "kind": "N",
          "value": "circular behaviour emits: {\"key\":\"value\"}"
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
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "a"
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
      "combinatorName": "InjectLocalState",
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
        0
      ],
      "settings": {}
    },
    {
      "combinatorName": "InjectLocalState|Inner",
      "componentName": "App",
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
        0
      ],
      "settings": {}
    },
    {
      "combinatorName": "Combine",
      "componentName": "Inner App",
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
        0
      ],
      "settings": {}
    },
    {
      "combinatorName": undefined,
      "componentName": "behaviourUpdatingComponent",
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
        0,
        0
      ],
      "settings": {}
    },
    {
      "combinatorName": undefined,
      "componentName": "behaviourUpdatingComponent",
      "emits": {
        "identifier": "a_circular_behavior_source",
        "notification": {
          "kind": "N",
          "value": [
            {
              "op": "add",
              "path": "/dummyKey3InitModel",
              "value": "dummy3"
            },
            {
              "op": "replace",
              "path": "/dummyKey1InitModel",
              "value": "dummy2"
            },
            {
              "op": "remove",
              "path": "/dummyKey2InitModel"
            }
          ]
        },
        "type": 1
      },
      "id": 14,
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
      "componentName": "Inner App",
      "emits": {
        "identifier": "a_circular_behavior_source",
        "notification": {
          "kind": "N",
          "value": [
            {
              "op": "add",
              "path": "/dummyKey3InitModel",
              "value": "dummy3"
            },
            {
              "op": "replace",
              "path": "/dummyKey1InitModel",
              "value": "dummy2"
            },
            {
              "op": "remove",
              "path": "/dummyKey2InitModel"
            }
          ]
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
      "combinatorName": "InjectLocalState|Inner",
      "componentName": "App",
      "emits": {
        "identifier": "a_circular_behavior_source",
        "notification": {
          "kind": "N",
          "value": [
            {
              "op": "add",
              "path": "/dummyKey3InitModel",
              "value": "dummy3"
            },
            {
              "op": "replace",
              "path": "/dummyKey1InitModel",
              "value": "dummy2"
            },
            {
              "op": "remove",
              "path": "/dummyKey2InitModel"
            }
          ]
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
      "combinatorName": "InjectLocalState",
      "componentName": "App",
      "emits": {
        "identifier": "a_circular_behavior_source",
        "notification": {
          "kind": "N",
          "value": {
            "dummyKey1InitModel": "dummy2",
            "dummyKey3InitModel": "dummy3",
            "key": "value"
          }
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
      "combinatorName": "InjectLocalState|Inner",
      "componentName": "App",
      "emits": {
        "identifier": "a_circular_behavior_source",
        "notification": {
          "kind": "N",
          "value": {
            "dummyKey1InitModel": "dummy2",
            "dummyKey3InitModel": "dummy3",
            "key": "value"
          }
        },
        "type": 0
      },
      "id": 18,
      "logType": "runtime",
      "path": [
        0,
        0
      ],
      "settings": {}
    },
    {
      "combinatorName": "Combine",
      "componentName": "Inner App",
      "emits": {
        "identifier": "a_circular_behavior_source",
        "notification": {
          "kind": "N",
          "value": {
            "dummyKey1InitModel": "dummy2",
            "dummyKey3InitModel": "dummy3",
            "key": "value"
          }
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
      "settings": {}
    },
    {
      "combinatorName": undefined,
      "componentName": "sinkUpdatingComponent",
      "emits": {
        "identifier": "a_circular_behavior_source",
        "notification": {
          "kind": "N",
          "value": {
            "dummyKey1InitModel": "dummy2",
            "dummyKey3InitModel": "dummy3",
            "key": "value"
          }
        },
        "type": 0
      },
      "id": 20,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        2
      ],
      "settings": {}
    },
    {
      "combinatorName": undefined,
      "componentName": "sinkUpdatingComponent",
      "emits": {
        "identifier": "yet_another_driver",
        "notification": {
          "kind": "N",
          "value": "circular behaviour emits: {\"key\":\"value\",\"dummyKey3InitModel\":\"dummy3\",\"dummyKey1InitModel\":\"dummy2\"}"
        },
        "type": 1
      },
      "id": 21,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        2
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "Inner App",
      "emits": {
        "identifier": "yet_another_driver",
        "notification": {
          "kind": "N",
          "value": "circular behaviour emits: {\"key\":\"value\",\"dummyKey3InitModel\":\"dummy3\",\"dummyKey1InitModel\":\"dummy2\"}"
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
      "combinatorName": "InjectLocalState|Inner",
      "componentName": "App",
      "emits": {
        "identifier": "yet_another_driver",
        "notification": {
          "kind": "N",
          "value": "circular behaviour emits: {\"key\":\"value\",\"dummyKey3InitModel\":\"dummy3\",\"dummyKey1InitModel\":\"dummy2\"}"
        },
        "type": 1
      },
      "id": 23,
      "logType": "runtime",
      "path": [
        0,
        0
      ]
    },
    {
      "combinatorName": "InjectLocalState",
      "componentName": "App",
      "emits": {
        "identifier": "yet_another_driver",
        "notification": {
          "kind": "N",
          "value": "circular behaviour emits: {\"key\":\"value\",\"dummyKey3InitModel\":\"dummy3\",\"dummyKey1InitModel\":\"dummy2\"}"
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
        "identifier": "yet_another_driver",
        "notification": {
          "kind": "N",
          "value": "circular behaviour emits: {\"key\":\"value\",\"dummyKey3InitModel\":\"dummy3\",\"dummyKey1InitModel\":\"dummy2\"}"
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
      "combinatorName": undefined,
      "componentName": "commandRequestComponent",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "a"
        },
        "type": 0
      },
      "id": 26,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        1
      ],
      "settings": {}
    },
    {
      "combinatorName": undefined,
      "componentName": "commandRequestComponent",
      "emits": {
        "identifier": "a_circular_event_source",
        "notification": {
          "kind": "N",
          "value": {
            "command": "a_command",
            "context": null,
            "params": "a"
          }
        },
        "type": 1
      },
      "id": 27,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        1
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "Inner App",
      "emits": {
        "identifier": "a_circular_event_source",
        "notification": {
          "kind": "N",
          "value": {
            "command": "a_command",
            "context": null,
            "params": "a"
          }
        },
        "type": 1
      },
      "id": 28,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": "InjectLocalState|Inner",
      "componentName": "App",
      "emits": {
        "identifier": "a_circular_event_source",
        "notification": {
          "kind": "N",
          "value": {
            "command": "a_command",
            "context": null,
            "params": "a"
          }
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
      "combinatorName": "InjectLocalState",
      "componentName": "App",
      "emits": {
        "identifier": "a_circular_event_source",
        "notification": {
          "error": "AN_ERROR",
          "kind": "E"
        },
        "type": 0
      },
      "id": 30,
      "logType": "runtime",
      "path": [
        0,
        0
      ],
      "settings": {}
    },
    {
      "combinatorName": "InjectLocalState|Inner",
      "componentName": "App",
      "emits": {
        "identifier": "a_circular_event_source",
        "notification": {
          "error": "AN_ERROR",
          "kind": "E"
        },
        "type": 0
      },
      "id": 31,
      "logType": "runtime",
      "path": [
        0,
        0
      ],
      "settings": {}
    },
    {
      "combinatorName": "Combine",
      "componentName": "Inner App",
      "emits": {
        "identifier": "a_circular_event_source",
        "notification": {
          "error": "AN_ERROR",
          "kind": "E"
        },
        "type": 0
      },
      "id": 32,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ],
      "settings": {}
    },
    {
      "combinatorName": undefined,
      "componentName": "sinkUpdatingComponent",
      "emits": {
        "identifier": "a_circular_event_source",
        "notification": {
          "error": "AN_ERROR",
          "kind": "E"
        },
        "type": 0
      },
      "id": 33,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        2
      ],
      "settings": {}
    },
    {
      "combinatorName": undefined,
      "componentName": "sinkUpdatingComponent",
      "emits": {
        "identifier": "another_driver",
        "notification": {
          "error": "AN_ERROR",
          "kind": "E"
        },
        "type": 1
      },
      "id": 34,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        2
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "Inner App",
      "emits": {
        "identifier": "another_driver",
        "notification": {
          "error": "AN_ERROR",
          "kind": "E"
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
      "combinatorName": "InjectLocalState|Inner",
      "componentName": "App",
      "emits": {
        "identifier": "another_driver",
        "notification": {
          "error": "AN_ERROR",
          "kind": "E"
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
      "combinatorName": "InjectLocalState",
      "componentName": "App",
      "emits": {
        "identifier": "another_driver",
        "notification": {
          "error": "AN_ERROR",
          "kind": "E"
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
      "combinatorName": "Combine",
      "componentName": "ROOT",
      "emits": {
        "identifier": "another_driver",
        "notification": {
          "error": "AN_ERROR",
          "kind": "E"
        },
        "type": 1
      },
      "id": 38,
      "logType": "runtime",
      "path": [
        0
      ]
    },
    {
      "combinatorName": undefined,
      "componentName": "sinkUpdatingComponent",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "a"
        },
        "type": 0
      },
      "id": 39,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        2
      ],
      "settings": {}
    },
    {
      "combinatorName": undefined,
      "componentName": "sinkUpdatingComponent",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "driver1 emits: a"
        },
        "type": 1
      },
      "id": 40,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        2
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "Inner App",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "driver1 emits: a"
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
      "combinatorName": "InjectLocalState|Inner",
      "componentName": "App",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "driver1 emits: a"
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
      "combinatorName": "InjectLocalState",
      "componentName": "App",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "driver1 emits: a"
        },
        "type": 1
      },
      "id": 43,
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
      "id": 44,
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
      "id": 45,
      "logType": "runtime",
      "path": [
        0
      ],
      "settings": {}
    },
    {
      "combinatorName": "InjectLocalState",
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
        0
      ],
      "settings": {}
    },
    {
      "combinatorName": "InjectLocalState|Inner",
      "componentName": "App",
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
        0
      ],
      "settings": {}
    },
    {
      "combinatorName": "Combine",
      "componentName": "Inner App",
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
        0
      ],
      "settings": {}
    },
    {
      "combinatorName": undefined,
      "componentName": "behaviourUpdatingComponent",
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
        0,
        0
      ],
      "settings": {}
    },
    {
      "combinatorName": undefined,
      "componentName": "behaviourUpdatingComponent",
      "emits": {
        "identifier": "a_circular_behavior_source",
        "notification": {
          "kind": "N",
          "value": [
            {
              "op": "add",
              "path": "/dummyKey3InitModel",
              "value": "dummy3"
            },
            {
              "op": "replace",
              "path": "/dummyKey1InitModel",
              "value": "dummy2"
            },
            {
              "op": "remove",
              "path": "/dummyKey2InitModel"
            }
          ]
        },
        "type": 1
      },
      "id": 50,
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
      "componentName": "Inner App",
      "emits": {
        "identifier": "a_circular_behavior_source",
        "notification": {
          "kind": "N",
          "value": [
            {
              "op": "add",
              "path": "/dummyKey3InitModel",
              "value": "dummy3"
            },
            {
              "op": "replace",
              "path": "/dummyKey1InitModel",
              "value": "dummy2"
            },
            {
              "op": "remove",
              "path": "/dummyKey2InitModel"
            }
          ]
        },
        "type": 1
      },
      "id": 51,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": "InjectLocalState|Inner",
      "componentName": "App",
      "emits": {
        "identifier": "a_circular_behavior_source",
        "notification": {
          "kind": "N",
          "value": [
            {
              "op": "add",
              "path": "/dummyKey3InitModel",
              "value": "dummy3"
            },
            {
              "op": "replace",
              "path": "/dummyKey1InitModel",
              "value": "dummy2"
            },
            {
              "op": "remove",
              "path": "/dummyKey2InitModel"
            }
          ]
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
      "combinatorName": "InjectLocalState",
      "componentName": "App",
      "emits": {
        "identifier": "a_circular_behavior_source",
        "notification": {
          "kind": "N",
          "value": {
            "dummyKey1InitModel": "dummy2",
            "dummyKey3InitModel": "dummy3",
            "key": "value"
          }
        },
        "type": 0
      },
      "id": 53,
      "logType": "runtime",
      "path": [
        0,
        0
      ],
      "settings": {}
    },
    {
      "combinatorName": "InjectLocalState|Inner",
      "componentName": "App",
      "emits": {
        "identifier": "a_circular_behavior_source",
        "notification": {
          "kind": "N",
          "value": {
            "dummyKey1InitModel": "dummy2",
            "dummyKey3InitModel": "dummy3",
            "key": "value"
          }
        },
        "type": 0
      },
      "id": 54,
      "logType": "runtime",
      "path": [
        0,
        0
      ],
      "settings": {}
    },
    {
      "combinatorName": "Combine",
      "componentName": "Inner App",
      "emits": {
        "identifier": "a_circular_behavior_source",
        "notification": {
          "kind": "N",
          "value": {
            "dummyKey1InitModel": "dummy2",
            "dummyKey3InitModel": "dummy3",
            "key": "value"
          }
        },
        "type": 0
      },
      "id": 55,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ],
      "settings": {}
    },
    {
      "combinatorName": undefined,
      "componentName": "sinkUpdatingComponent",
      "emits": {
        "identifier": "a_circular_behavior_source",
        "notification": {
          "kind": "N",
          "value": {
            "dummyKey1InitModel": "dummy2",
            "dummyKey3InitModel": "dummy3",
            "key": "value"
          }
        },
        "type": 0
      },
      "id": 56,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        2
      ],
      "settings": {}
    },
    {
      "combinatorName": undefined,
      "componentName": "sinkUpdatingComponent",
      "emits": {
        "identifier": "yet_another_driver",
        "notification": {
          "kind": "N",
          "value": "circular behaviour emits: {\"key\":\"value\",\"dummyKey3InitModel\":\"dummy3\",\"dummyKey1InitModel\":\"dummy2\"}"
        },
        "type": 1
      },
      "id": 57,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        2
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "Inner App",
      "emits": {
        "identifier": "yet_another_driver",
        "notification": {
          "kind": "N",
          "value": "circular behaviour emits: {\"key\":\"value\",\"dummyKey3InitModel\":\"dummy3\",\"dummyKey1InitModel\":\"dummy2\"}"
        },
        "type": 1
      },
      "id": 58,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": "InjectLocalState|Inner",
      "componentName": "App",
      "emits": {
        "identifier": "yet_another_driver",
        "notification": {
          "kind": "N",
          "value": "circular behaviour emits: {\"key\":\"value\",\"dummyKey3InitModel\":\"dummy3\",\"dummyKey1InitModel\":\"dummy2\"}"
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
      "combinatorName": "InjectLocalState",
      "componentName": "App",
      "emits": {
        "identifier": "yet_another_driver",
        "notification": {
          "kind": "N",
          "value": "circular behaviour emits: {\"key\":\"value\",\"dummyKey3InitModel\":\"dummy3\",\"dummyKey1InitModel\":\"dummy2\"}"
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
        "identifier": "yet_another_driver",
        "notification": {
          "kind": "N",
          "value": "circular behaviour emits: {\"key\":\"value\",\"dummyKey3InitModel\":\"dummy3\",\"dummyKey1InitModel\":\"dummy2\"}"
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
      "combinatorName": undefined,
      "componentName": "commandRequestComponent",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "b"
        },
        "type": 0
      },
      "id": 62,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        1
      ],
      "settings": {}
    },
    {
      "combinatorName": undefined,
      "componentName": "commandRequestComponent",
      "emits": {
        "identifier": "a_circular_event_source",
        "notification": {
          "kind": "N",
          "value": {
            "command": "a_command",
            "context": null,
            "params": "b"
          }
        },
        "type": 1
      },
      "id": 63,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        1
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "Inner App",
      "emits": {
        "identifier": "a_circular_event_source",
        "notification": {
          "kind": "N",
          "value": {
            "command": "a_command",
            "context": null,
            "params": "b"
          }
        },
        "type": 1
      },
      "id": 64,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": "InjectLocalState|Inner",
      "componentName": "App",
      "emits": {
        "identifier": "a_circular_event_source",
        "notification": {
          "kind": "N",
          "value": {
            "command": "a_command",
            "context": null,
            "params": "b"
          }
        },
        "type": 1
      },
      "id": 65,
      "logType": "runtime",
      "path": [
        0,
        0
      ]
    },
    {
      "combinatorName": undefined,
      "componentName": "sinkUpdatingComponent",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "b"
        },
        "type": 0
      },
      "id": 66,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        2
      ],
      "settings": {}
    },
    {
      "combinatorName": undefined,
      "componentName": "sinkUpdatingComponent",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "driver1 emits: b"
        },
        "type": 1
      },
      "id": 67,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        2
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "Inner App",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "driver1 emits: b"
        },
        "type": 1
      },
      "id": 68,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": "InjectLocalState|Inner",
      "componentName": "App",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "driver1 emits: b"
        },
        "type": 1
      },
      "id": 69,
      "logType": "runtime",
      "path": [
        0,
        0
      ]
    },
    {
      "combinatorName": "InjectLocalState",
      "componentName": "App",
      "emits": {
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "driver1 emits: b"
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
        "identifier": "a_driver",
        "notification": {
          "kind": "N",
          "value": "driver1 emits: b"
        },
        "type": 1
      },
      "id": 71,
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
