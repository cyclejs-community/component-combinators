import * as QUnit from "qunitjs"
import * as Rx from 'rx'
import { runTestScenario } from '../testing/src/runTestScenario'
import { convertVNodesToHTML } from "../utils/src/index"
import { flatten, identity, omit, pipe, set } from 'ramda'
import { addPrefix, DOM_SINK, format, vLift } from "../utils/src"
import { resetGraphCounter, traceApp } from "../tracing/src"
import { componentNameInSettings, traceDOMsinkFn, traceEventSinkFn, traceEventSourceFn } from "../tracing/src/helpers"
import { div, h } from 'cycle-snabbdom'
import { Combine } from "../src/components/Combine"
import { OnRoute } from "../src/components/Router/Router"
import { ROUTE_PARAMS } from "../src/components/Router/properties"

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

const NON_DOM_SINK = 'a';
const ANOTHER_NON_DOM_SINK = 'b';
const A_SOURCE = 'DOM1';
const ANOTHER_SOURCE = 'DOM2';
const ROUTE_LOG_SINK = 'ROUTE_LOG';
const ROUTE_SOURCE = 'route$';

function makeTestHelperComponent(header, sourceName, routeCfg) {
  return function makeTestHelperComponent(sources, settings) {
    return {
      // NOTE : that DOM example is a bit fictitious as DOM should ALWAYS have a starting value...
      // We keep it like this though for testing purposes
      [DOM_SINK]: sources[sourceName].map(x => h('span', {},
        `${header} on route '${routeCfg}' > ${ROUTE_PARAMS} - ${sourceName}: ${format(settings[ROUTE_PARAMS])} - ${x}`)),
      // NOTE : x here will be the route remainder vs. current match
      [ROUTE_LOG_SINK]: sources[ROUTE_SOURCE]
        .map(x => `${header} on route '${routeCfg}' > ${ROUTE_PARAMS} - route remainder : `
          + format(settings[ROUTE_PARAMS]) + ' - ' + x),
      [NON_DOM_SINK]: sources.userAction$
        .map(x => `${header} on route '${routeCfg}' > ${NON_DOM_SINK} > user action : `
          + format(x))
    }
  }
}

function makeOtherTestHelperComponent(header, sourceName, routeCfg) {
  return function makeOtherTestHelperComponent(sources, settings) {
    return {
      // NOTE : that DOM example is a bit fictitious as DOM should ALWAYS have a starting value...
      // We keep it like this though for testing purposes
      [DOM_SINK]: sources[sourceName].map(x => h('span', {},
        `${header} on route '${routeCfg}' > ${ROUTE_PARAMS} - ${sourceName}: ${format(settings[ROUTE_PARAMS])} - ${x}`)),
      // NOTE : x here will be the route remainder vs. current match
      [ROUTE_LOG_SINK]: sources[ROUTE_SOURCE]
        .map(x => `${header} on route '${routeCfg}' > ${ROUTE_PARAMS} - route remainder : `
          + format(settings[ROUTE_PARAMS]) + ' - ' + x),
      [NON_DOM_SINK]: sources.userAction$
        .map(x => `${header} on route '${routeCfg}' > ${NON_DOM_SINK} > user action : `
          + format(x))
    }
  }
}

function getHelperComponentOutput(header, sourceName, routeCfg, routeParams, x) {
  return {
    [DOM_SINK]: `<span>${header} on route '${routeCfg}' > ${ROUTE_PARAMS} - ${sourceName}: ${format(routeParams)} - ${x}</span>`,
    [NON_DOM_SINK]: `${header} on route '${routeCfg}' > ${NON_DOM_SINK} > user action : ${format(x)}`,
    [ROUTE_LOG_SINK]: `${header} on route '${routeCfg}' > ${ROUTE_PARAMS} - route remainder : ${format(routeParams)} - ${x}`
  }
}

function divwrap(str) {
  return str ? `<div>${str}</div>` : ''
}

QUnit.test("main case - OnRoute - non-nested routing - transitions - initial state", function exec_test(assert) {
  resetGraphCounter();
  const traces = [];
  const done = assert.async(4);
  const sinkNames = [DOM_SINK, NON_DOM_SINK, ROUTE_LOG_SINK];
  const routerComponent = Combine({ sinkNames: sinkNames, routeSource: ROUTE_SOURCE }, [
    OnRoute({ route: 'group' }, [
      makeTestHelperComponent('Component 1', A_SOURCE, 'group'),
      makeTestHelperComponent('Component 2', ANOTHER_SOURCE, 'group'),
    ]),
  ]);
  const tracedApp = traceApp({
    _trace: {
      traceSpecs: {
        [DOM_SINK]: [identity, traceDOMsinkFn]
      },
      defaultTraceSpecs: [traceEventSourceFn, traceEventSinkFn],
      sendMessage: msg => traces.push(msg)
    },
    _helpers: { getId: getId(0) }
  }, routerComponent);

  const inputs = [
    { DOM1: { diagram: '-------------------------' } },
    { DOM2: { diagram: '------------------------' } },
    {
      userAction$: {
        diagram: 'a---b-ac--ab---c',
        values: { a: 'click', b: 'select', c: 'hover', }
      }
    },
    {
      route$: {
        diagram: '-------a----', values: {
          a: 'D',
          b: 'group',
          c: 'other',
          d: 'anything/else/there',
        }
      }
    }
  ];

  const expectedMessages = {
    [DOM_SINK]: {
      outputs: [
        "<div><iframe id=\"devtool\" src=\"devtool.html\" style=\"width: 450px; height: 200px\"></iframe></div>"
      ],
      successMessage: `sink ${DOM_SINK} produces only null : transition match -> non-match immediately produces null on DOM sink as first value AND initial state counts as match (starting the router)`,
      transform: pipe(convertVNodesToHTML),
    },
    [NON_DOM_SINK]: {
      outputs: [],
      successMessage: `sink ${NON_DOM_SINK} produces the expected values`,
    },
    [ROUTE_LOG_SINK]: {
      outputs: [],
      successMessage: `sink ${ROUTE_LOG_SINK} produces no values as expected! There was no match`,
    },
  };

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
      "componentName": "ROOT",
      "id": 1,
      "isContainerComponent": false,
      "logType": "graph_structure",
      "path": [
        0,
        0
      ]
    },
    {
      "combinatorName": "OnRoute",
      "componentName": "ROOT",
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
  const expectedTraces1 = [

    {
      "combinatorName": "Combine",
      "componentName": "ROOT",
      "emits": {
        "identifier": "route$",
        "notification": {
          "kind": "N",
          "value": "D"
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
      "componentName": "ROOT",
      "emits": {
        "identifier": "route$",
        "notification": {
          "kind": "N",
          "value": "D"
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
        "routeSource": "route$",
        "sinkNames": [
          "DOM",
          "a",
          "ROUTE_LOG"
        ]
      }
    },
    {
      "combinatorName": "OnRoute",
      "componentName": "ROOT",
      "emits": {
        "identifier": "route$",
        "notification": {
          "kind": "N",
          "value": "D"
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
        "route": "group",
        "routeSource": "route$",
        "sinkNames": [
          "DOM",
          "a",
          "ROUTE_LOG"
        ]
      }
    },
    {
      "combinatorName": "OnRoute",
      "componentName": "ROOT",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": null
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
      "componentName": "ROOT",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": null
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
          "value": null
        },
        "type": 1
      },
      "id": 5,
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

QUnit.test("main case - OnRoute - non-nested routing - transitions no match -> match", function exec_test(assert) {
  resetGraphCounter();
  const traces = [];
  const done = assert.async(4);
  const sinkNames = [DOM_SINK, NON_DOM_SINK, ROUTE_LOG_SINK];
  const routerComponent = Combine(set(componentNameInSettings, APP_NAME, {
    sinkNames: sinkNames,
    routeSource: ROUTE_SOURCE
  }), [
    OnRoute({ route: 'group' }, [
      makeTestHelperComponent('Component 1', A_SOURCE, 'group'),
      // NOTE : to force the function to another name for tracing clarity purposes
      makeOtherTestHelperComponent('Component 2', ANOTHER_SOURCE, 'group'),
    ]),
  ]);
  const tracedApp = traceApp({
    _trace: {
      traceSpecs: {
        [DOM_SINK]: [identity, traceDOMsinkFn]
      },
      defaultTraceSpecs: [traceEventSourceFn, traceEventSinkFn],
      sendMessage: msg => traces.push(msg)
    },
    _helpers: { getId: getId(0) }
  }, routerComponent);

  const inputs = [
    { DOM1: { diagram: '-a--b--c------------------' } },
    { DOM2: { diagram: '-a-b-c-d-----------------' } },
    {
      userAction$: {
        diagram: '----------------',
        values: { a: 'click', b: 'select', c: 'hover', }
      }
    },
    {
      route$: {
        // DOM1: '-a--b--c--d--e--f--a--b--c--d-'}},
        // DOM2: '-a-b-c-d-e-f-abb-c-d-e-f-'}},
        diagram: '-----b------', values: {
          a: '',
          b: 'group',
          c: 'other',
          d: 'anything/else/there',
        }
      }
    }
  ];

  const expectedMessages = {
    [DOM_SINK]: {
      outputs: [
        "<div><iframe id=\"devtool\" src=\"devtool.html\" style=\"width: 450px; height: 200px\"></iframe></div>",
        "<div><iframe id=\"devtool\" src=\"devtool.html\" style=\"width: 450px; height: 200px\"></iframe><div><div><div><span>Component 1 on route 'group' > routeParams - DOM1: <empty object> - c</span><span>Component 2 on route 'group' > routeParams - DOM2: <empty object> - d</span></div></div></div></div>"
      ],
      successMessage: `sink ${DOM_SINK} : transition any -> match produces a null value as the first value of the DOM sink, then the regular DOM sinks as computed from the component`,
      transform: pipe(convertVNodesToHTML),
    },
    [NON_DOM_SINK]: {
      outputs: [],
      successMessage: `sink ${NON_DOM_SINK} produces the expected values`,
    },
    [ROUTE_LOG_SINK]: {
      outputs: [
        `${getHelperComponentOutput('Component 1', A_SOURCE, 'group', {}, undefined)[ROUTE_LOG_SINK]}`,
        `${getHelperComponentOutput('Component 2', ANOTHER_SOURCE, 'group', {}, undefined)[ROUTE_LOG_SINK]}`
      ],
      successMessage: `sink ${ROUTE_LOG_SINK} produces the expected values`,
    },
  };
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
      "combinatorName": "OnRoute",
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
  ];
  const expectedGraph2 = [
    {
      "combinatorName": "OnRoute|Inner",
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
      "componentName": "makeTestHelperComponent",
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
      "componentName": "makeOtherTestHelperComponent",
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
  ];
  const expectedTraces1 = [
    {
      "combinatorName": "Combine",
      "componentName": "ROOT",
      "emits": {
        "identifier": "route$",
        "notification": {
          "kind": "N",
          "value": "group"
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
        "identifier": "route$",
        "notification": {
          "kind": "N",
          "value": "group"
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
        "routeSource": "route$",
        "sinkNames": [
          "DOM",
          "a",
          "ROUTE_LOG"
        ]
      }
    },
    {
      "combinatorName": "OnRoute",
      "componentName": "App",
      "emits": {
        "identifier": "route$",
        "notification": {
          "kind": "N",
          "value": "group"
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
        "route": "group",
        "routeSource": "route$",
        "sinkNames": [
          "DOM",
          "a",
          "ROUTE_LOG"
        ]
      }
    },
  ];
  const expectedTraces2 = [
    {
      "combinatorName": "OnRoute",
      "componentName": "App",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": null
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
      "componentName": "App",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": null
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
          "value": null
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
      "combinatorName": "OnRoute|Inner",
      "componentName": "App",
      "emits": {
        "identifier": "route$",
        "notification": {
          "kind": "N",
          "value": undefined
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
        "route": "group",
        "routeParams": {},
        "routeSource": "route$",
        "sinkNames": [
          "DOM",
          "a",
          "ROUTE_LOG"
        ]
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "makeTestHelperComponent",
      "emits": {
        "identifier": "route$",
        "notification": {
          "kind": "N",
          "value": undefined
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
        "route": "group",
        "routeParams": {},
        "routeSource": "route$",
        "sinkNames": [
          "DOM",
          "a",
          "ROUTE_LOG"
        ]
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "makeTestHelperComponent",
      "emits": {
        "identifier": "ROUTE_LOG",
        "notification": {
          "kind": "N",
          "value": "Component 1 on route 'group' > routeParams - route remainder : <empty object> - undefined"
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
      "combinatorName": "OnRoute|Inner",
      "componentName": "App",
      "emits": {
        "identifier": "ROUTE_LOG",
        "notification": {
          "kind": "N",
          "value": "Component 1 on route 'group' > routeParams - route remainder : <empty object> - undefined"
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
      "combinatorName": "OnRoute",
      "componentName": "App",
      "emits": {
        "identifier": "ROUTE_LOG",
        "notification": {
          "kind": "N",
          "value": "Component 1 on route 'group' > routeParams - route remainder : <empty object> - undefined"
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
        "identifier": "ROUTE_LOG",
        "notification": {
          "kind": "N",
          "value": "Component 1 on route 'group' > routeParams - route remainder : <empty object> - undefined"
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
        "identifier": "ROUTE_LOG",
        "notification": {
          "kind": "N",
          "value": "Component 1 on route 'group' > routeParams - route remainder : <empty object> - undefined"
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
      "combinatorName": undefined,
      "componentName": "makeOtherTestHelperComponent",
      "emits": {
        "identifier": "route$",
        "notification": {
          "kind": "N",
          "value": undefined
        },
        "type": 0
      },
      "id": 13,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        1
      ],
      "settings": {
        "route": "group",
        "routeParams": {},
        "routeSource": "route$",
        "sinkNames": [
          "DOM",
          "a",
          "ROUTE_LOG"
        ]
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "makeOtherTestHelperComponent",
      "emits": {
        "identifier": "ROUTE_LOG",
        "notification": {
          "kind": "N",
          "value": "Component 2 on route 'group' > routeParams - route remainder : <empty object> - undefined"
        },
        "type": 1
      },
      "id": 14,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        1
      ]
    },
    {
      "combinatorName": "OnRoute|Inner",
      "componentName": "App",
      "emits": {
        "identifier": "ROUTE_LOG",
        "notification": {
          "kind": "N",
          "value": "Component 2 on route 'group' > routeParams - route remainder : <empty object> - undefined"
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
      "combinatorName": "OnRoute",
      "componentName": "App",
      "emits": {
        "identifier": "ROUTE_LOG",
        "notification": {
          "kind": "N",
          "value": "Component 2 on route 'group' > routeParams - route remainder : <empty object> - undefined"
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
      "combinatorName": "Combine",
      "componentName": "App",
      "emits": {
        "identifier": "ROUTE_LOG",
        "notification": {
          "kind": "N",
          "value": "Component 2 on route 'group' > routeParams - route remainder : <empty object> - undefined"
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
      "combinatorName": "Combine",
      "componentName": "ROOT",
      "emits": {
        "identifier": "ROUTE_LOG",
        "notification": {
          "kind": "N",
          "value": "Component 2 on route 'group' > routeParams - route remainder : <empty object> - undefined"
        },
        "type": 1
      },
      "id": 18,
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
      "id": 19,
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
        "identifier": "DOM1",
        "notification": {
          "kind": "N",
          "value": "c"
        },
        "type": 0
      },
      "id": 20,
      "logType": "runtime",
      "path": [
        0,
        0
      ],
      "settings": {
        "routeSource": "route$",
        "sinkNames": [
          "DOM",
          "a",
          "ROUTE_LOG"
        ]
      }
    },
    {
      "combinatorName": "OnRoute",
      "componentName": "App",
      "emits": {
        "identifier": "DOM1",
        "notification": {
          "kind": "N",
          "value": "c"
        },
        "type": 0
      },
      "id": 21,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ],
      "settings": {
        "route": "group",
        "routeSource": "route$",
        "sinkNames": [
          "DOM",
          "a",
          "ROUTE_LOG"
        ]
      }
    },
    {
      "combinatorName": "OnRoute|Inner",
      "componentName": "App",
      "emits": {
        "identifier": "DOM1",
        "notification": {
          "kind": "N",
          "value": "c"
        },
        "type": 0
      },
      "id": 22,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ],
      "settings": {
        "route": "group",
        "routeParams": {},
        "routeSource": "route$",
        "sinkNames": [
          "DOM",
          "a",
          "ROUTE_LOG"
        ]
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "makeTestHelperComponent",
      "emits": {
        "identifier": "DOM1",
        "notification": {
          "kind": "N",
          "value": "c"
        },
        "type": 0
      },
      "id": 23,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        0
      ],
      "settings": {
        "route": "group",
        "routeParams": {},
        "routeSource": "route$",
        "sinkNames": [
          "DOM",
          "a",
          "ROUTE_LOG"
        ]
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "makeTestHelperComponent",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<span>Component 1 on route 'group' > routeParams - DOM1: <empty object> - c</span>"
        },
        "type": 1
      },
      "id": 24,
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
          "value": "d"
        },
        "type": 0
      },
      "id": 25,
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
        "identifier": "DOM2",
        "notification": {
          "kind": "N",
          "value": "d"
        },
        "type": 0
      },
      "id": 26,
      "logType": "runtime",
      "path": [
        0,
        0
      ],
      "settings": {
        "routeSource": "route$",
        "sinkNames": [
          "DOM",
          "a",
          "ROUTE_LOG"
        ]
      }
    },
    {
      "combinatorName": "OnRoute",
      "componentName": "App",
      "emits": {
        "identifier": "DOM2",
        "notification": {
          "kind": "N",
          "value": "d"
        },
        "type": 0
      },
      "id": 27,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ],
      "settings": {
        "route": "group",
        "routeSource": "route$",
        "sinkNames": [
          "DOM",
          "a",
          "ROUTE_LOG"
        ]
      }
    },
    {
      "combinatorName": "OnRoute|Inner",
      "componentName": "App",
      "emits": {
        "identifier": "DOM2",
        "notification": {
          "kind": "N",
          "value": "d"
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
        "route": "group",
        "routeParams": {},
        "routeSource": "route$",
        "sinkNames": [
          "DOM",
          "a",
          "ROUTE_LOG"
        ]
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "makeOtherTestHelperComponent",
      "emits": {
        "identifier": "DOM2",
        "notification": {
          "kind": "N",
          "value": "d"
        },
        "type": 0
      },
      "id": 29,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        1
      ],
      "settings": {
        "route": "group",
        "routeParams": {},
        "routeSource": "route$",
        "sinkNames": [
          "DOM",
          "a",
          "ROUTE_LOG"
        ]
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "makeOtherTestHelperComponent",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<span>Component 2 on route 'group' > routeParams - DOM2: <empty object> - d</span>"
        },
        "type": 1
      },
      "id": 30,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        1
      ]
    },
    {
      "combinatorName": "OnRoute|Inner",
      "componentName": "App",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div><span>Component 1 on route 'group' > routeParams - DOM1: <empty object> - c</span><span>Component 2 on route 'group' > routeParams - DOM2: <empty object> - d</span></div>"
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
      "combinatorName": "OnRoute",
      "componentName": "App",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div><span>Component 1 on route 'group' > routeParams - DOM1: <empty object> - c</span><span>Component 2 on route 'group' > routeParams - DOM2: <empty object> - d</span></div>"
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
      "combinatorName": "Combine",
      "componentName": "App",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div><div><span>Component 1 on route 'group' > routeParams - DOM1: <empty object> - c</span><span>Component 2 on route 'group' > routeParams - DOM2: <empty object> - d</span></div></div>"
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
      "combinatorName": "Combine",
      "componentName": "ROOT",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div><div><div><span>Component 1 on route 'group' > routeParams - DOM1: <empty object> - c</span><span>Component 2 on route 'group' > routeParams - DOM2: <empty object> - d</span></div></div></div>"
        },
        "type": 1
      },
      "id": 34,
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
//        flatten([expectedGraph1, expectedTraces1, expectedGraph2, expectedTraces2, expectedGraph3, expectedTraces3]),
        flatten([expectedGraph1, expectedTraces1, expectedGraph2, expectedTraces2]),
        `Traces are produced as expected!`);
      done()
    });

});
