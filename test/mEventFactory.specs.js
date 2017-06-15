// mEventFactory(EventFactorySettings, childrenComponents)
// # Test space = Settings x ChildrenComponents
//
// # Testing strategy
// Given the large size (infinite) of the domain of the function under test, the following
// hypothesis based on the knowledge of the implementation (gray-box testing) will be used :
// T1. Testing against A | B is sufficient to guarantee behaviour on A x B (independence of A and B)
// T2. when we have to test against a set of possible values, we will only test the limit
// conditions, assuming that passing those tests implies a correct behaviour for the other
// values.
// T3. When we are confident that a smaller test set is sufficient to imply the expected
// behaviour for the whole set, we will test only against that smaller test.
// T4. In some cases we simply renounce to test against some values of the test space (80-20
// approach). This may happen when the values to be tested against have a sufficient low
// probability of occuring, or an impact that we are willing to absorb.
//
// ## Testing for Settings
// - Settings = BadSettings | GoodSettings (T3 - instead of BadSettings x GoodSettings)
//   - GoodSettings = CustomSettings | DOMSettings | CustomAndDomSettings
//     - CustomSettings = 1 custom | >1 custom (T2)
//     - DOMSettings = 1 DOM | >1 DOM same event | >1 DOM different events (T2)
//     - CustomAndDomSettings = 1 custom & 1 DOM | >1 custom & >1 DOM (T2)
//       - Note : 1DOM, >1 custom and >1 DOM, 1 custom excluded from the space (T3 - >1 & >1
//   - BadSettings : we only test three conditions (T4):
//     - no events property in settings, custom event factory not a function, selector not a
// string
//
// ## Testing for ChildrenComponents
// - childrenComponents : 0 child | 1 child | > 1 child (T2)
//
// Here for every child component, we need to have at least one DOM sink and one non-DOM sink to
// test for the children sink merging performed by the factory component, as it merges DOM sinks
// differently from non-DOM sinks. By virtue of T3, we will test only for components with one DOM
// sink AND one non-DOM sink.
//
// # Test space size
// - |Test Space| = |Settings| x |ChildrenComponents|
//   - |ChildrenComponents| = |0 child| +  |1 child| + |> 1 child| = 3
//   - |Settings| = |BadSettings| + |GoodSettings| (T1 - BadSettings independent from GoodSettings)
//     - |GoodSettings| = |CustomSettings| + |DOMSettings| + |CustomAndDomSettings| +
// |EmptySettings|
//       - |CustomSettings| = 2
//       - |DOMSettings| = 3
//       - |CustomAndDomSettings| = 2
//       - |EmptySettings| = 1
//       - -> |GoodSettings| = 2 + 3 + 2 + 1 = 8
//     - |BadSettings| = 3
// - |Test Space| = |GoodSettings| x |ChildrenComponents| + |BadSettings| (T3, T1 - BadSettings
// independent from ChildrenComponents)
// - |Test Space| = 8 x 3 + 3 = 27
//
// We hence have 27 tests to write, which is still a lot. We could further reduce the number of
// tests by 'diagnoalizing' `Ai x Bj` into `(Ai,Bi)` (testing against A) | (Aj,Bj) (testing
// against `B`) and picking up `Ai, Aj, Bi, Bj` such that `i <> j` implies `Bi <> Bj`.
// This obviously makes sense when one has the confidence that A and B space are
// relatively orthogonal and that the |A| x |B| - (|A| + |B|) untested values have little weight
// (T4, T3). We would then have |Test Space| = 8 + 3 + 3 = 14, i.e. half the number of tests.
//
// We will however choose to go for the previous reduction of the test space to 30. As a matter of
// fact, reducing by half the test space forces to choose well the (Ai) and (Bj), which makes
// the test itself less maintenable - unless the test construction is properly documented.
// We think it is simpler, less error prone, and also more automatizable to do a cartesian
// product of the test subspaces. The hope is we can use some relationship between some `f(ai,bi)`
// so as to deduce some test results from previous test results, possibly reducing the effort by
// more than half.
// TODO : add throw error in the case of children sinks with the same sink name as event sinks

import * as QUnit from "qunitjs"
import * as Rx from "rx"
import { values } from "ramda"
import { mEventFactory, makeEventNameFromSelectorAndEvent } from "../src/components/mEventFactory"
import { addPrefix, convertVNodesToHTML, format, noop } from "../src/utils"
import { runTestScenario } from "../src/runTestScenario"
import { span } from "cycle-snabbdom"
import { makeMockDOMSource } from "../src/mockDOM"

const SEP = ':';
const NOT_A_FUNCTION = 42;
const NOT_A_STRING = 42;
const SOME_EVENT_NAME = 'some_event_name';
const ANOTHER_EVENT_NAME = 'another_event_name';
const SOME_DOM_EVENT_NAME = 'click';
const ANOTHER_DOM_EVENT_NAME = 'hover';
const EVENT_SOURCE1 = 'eventSource1';
const EVENT_SOURCE2 = 'eventSource2';
const NON_DOM_SINK = 'non_dom_sink';
const DOM_SINK = 'DOM';
const SOME_SELECTOR_ID = '#some_selector_id';
const eventSourcesTestValues = {
  a: 'a', b: 'b', c: 'c', d: 'd', e: 'e', f: 'f',
  A: 'A', B: 'B', C: 'C', D: 'D', E: 'E', F: 'F'
};
const DOMeventsTestValues = {
  x: makeDummyClickEvent(`${SOME_SELECTOR_ID}@${SOME_DOM_EVENT_NAME} ${SEP} click #1`),
  y: makeDummyClickEvent(`${SOME_SELECTOR_ID}@${SOME_DOM_EVENT_NAME} ${SEP} click #2`),
  z: makeDummyClickEvent(`${SOME_SELECTOR_ID}@${SOME_DOM_EVENT_NAME} ${SEP} click #3`),
};

function subjectFactory() {
  return new Rx.Subject()
}

function print(label) {
  return function (x) {
    console.debug(`${label} : ${format(x)}`)
  }
}

function analyzeTestResults(assert, done) {
  return function analyzeTestResults(actual, expected, message) {
    assert.deepEqual(actual, expected, message);
    done()
  }
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
    preventDefault: noop,
    value: value
  }
}

function eventFactoryComponent(testData, settings) {
  return function eventFactoryComponent(sources) {
    return mEventFactory(testData.eventFactorySettings, testData.childrenComponents)(sources, settings);
  }
}

function someEventGeneratingFnFromEvSource1(sources, settings) {
  return sources[EVENT_SOURCE1].map(addPrefix(`${SOME_EVENT_NAME} ${settings.SEP} `))
}

function someEventGeneratingFnFromEvSource2(sources, settings) {
  return sources[EVENT_SOURCE2].map(addPrefix(`${ANOTHER_EVENT_NAME} ${settings.SEP} `))
}

function comp1DOM1NonDOMEvSource11(sources, settings) {
  return {
    DOM: sources[EVENT_SOURCE1]
      .map(x => span(`${DOM_SINK} ${settings.SEP} ${x}`))
      .tap(print(`comp1DOM1NonDOMEvSource11 > DOM > ${EVENT_SOURCE1}`))
    ,
    [NON_DOM_SINK]: sources[EVENT_SOURCE1]
      .map(addPrefix(`${settings.SEP} ${NON_DOM_SINK}-`))
      .tap(print(`comp1DOM1NonDOMEvSource11 > ${NON_DOM_SINK} > ${EVENT_SOURCE1}`))
    ,
  }
}

function comp1DOM1NonDOMEvSource12(sources, settings) {
  return {
    DOM: sources[EVENT_SOURCE1]
      .map(x => span(`${DOM_SINK} ${settings.SEP} ${x}`))
      .tap(print(`DOM > ${EVENT_SOURCE1}`))
    ,
    [NON_DOM_SINK]: sources[EVENT_SOURCE2]
      .tap(print(`NON-DOM > ${EVENT_SOURCE2}`))
      .map(addPrefix(`${settings.SEP} ${NON_DOM_SINK}-`)),
  }
}

const testSpace = {
  BadSettings: {
    NoEventPropertyInSettings: {
      eventFactorySettings: {
        notEvents: {
          anything: true
        }
      },
      childrenComponents: [] // should not matter
    },
    EventFactoryNotAFunction: {
      eventFactorySettings: {
        events: {
          custom: {
            someEventName: NOT_A_FUNCTION
          }
        }
      },
      childrenComponents: []
    },
    SelectorNotAString: {
      eventFactorySettings: {
        events: {
          DOM: {
            someEventName: {
              someSelectorDesc: NOT_A_STRING
            }
          }
        }
      },
      childrenComponents: []
    },
  },
  GoodSettings: {
    CustomSettings: {
      caseOneCustomAndNoChildren: {
        eventFactorySettings: {
          events: {
            custom: {
              [SOME_EVENT_NAME]: someEventGeneratingFnFromEvSource1
            }
          }
        },
        childrenComponents: []
      },
      caseOneCustomAndOneChild: {
        eventFactorySettings: {
          events: {
            custom: {
              [SOME_EVENT_NAME]: someEventGeneratingFnFromEvSource1
            }
          }
        },
        childrenComponents: [comp1DOM1NonDOMEvSource12]
      },
      caseOneCustomAndTwoChildren: {
        eventFactorySettings: {
          events: {
            custom: {
              [SOME_EVENT_NAME]: someEventGeneratingFnFromEvSource1
            }
          }
        },
        childrenComponents: [comp1DOM1NonDOMEvSource11, comp1DOM1NonDOMEvSource12]
      },
      caseTwoCustomAndNoChildren: {
        eventFactorySettings: {
          events: {
            custom: {
              [SOME_EVENT_NAME]: someEventGeneratingFnFromEvSource1,
              [ANOTHER_EVENT_NAME]: someEventGeneratingFnFromEvSource2,
            }
          }
        },
        childrenComponents: []
      },
      caseTwoCustomAndOneChild: {
        eventFactorySettings: {
          events: {
            custom: {
              [SOME_EVENT_NAME]: someEventGeneratingFnFromEvSource1,
              [ANOTHER_EVENT_NAME]: someEventGeneratingFnFromEvSource2,
            }
          }
        },
        childrenComponents: [comp1DOM1NonDOMEvSource12]
      },
      caseTwoCustomAndTwoChildren: {
        eventFactorySettings: {
          events: {
            custom: {
              [SOME_EVENT_NAME]: someEventGeneratingFnFromEvSource1,
              [ANOTHER_EVENT_NAME]: someEventGeneratingFnFromEvSource2,
            }
          }
        },
        childrenComponents: [comp1DOM1NonDOMEvSource11, comp1DOM1NonDOMEvSource12]
      },
    },
    DOMSettings: {
      caseDOMSettingsAndNoChildren: {
        eventFactorySettings: {
          events: {
            DOM: {
              click: {
                [SOME_DOM_EVENT_NAME]: `${SOME_SELECTOR_ID}`
              }
            }
          }
        },
        childrenComponents: []
      },
      caseDOMSettingsAndOneChild: {
        eventFactorySettings: {
          events : {}
        },
        childrenComponents: {}
      },
      caseDOMSettingsAndTwoChildren: {
        eventFactorySettings: {
          events : {}
        },
        childrenComponents: {}
      }
    },
    CustomAndDomSettings: {
      eventFactorySettings: {},
      childrenComponents: []
    },
    EmptySettings: {
      caseEmpmtyAndNoChildren: {
        eventFactorySettings: {
          events: {}
        },
        childrenComponents: []
      },
      caseEmpmtyAndOneChild: {
        eventFactorySettings: {
          events: {}
        },
        childrenComponents: [comp1DOM1NonDOMEvSource12]
      },
      caseEmpmtyAndTwoChildren: {
        eventFactorySettings: {
          events: {}
        },
        childrenComponents: [comp1DOM1NonDOMEvSource11, comp1DOM1NonDOMEvSource12]
      }
    }
  }
}

// Initialization
QUnit.module("Testing mEventFactory(eventFactorySettings, childrenComponents)", {});

//////////////
// BadSettings

// no events property in settings
QUnit.test("Bad settings : no events property in settings", function exec_test(assert) {
  const testData = testSpace.BadSettings.NoEventPropertyInSettings;
  const eventFactoryComponent = mEventFactory(testData.eventFactorySettings, testData.childrenComponents);

  assert.throws(function () {
      eventFactoryComponent({}, {})
    }, /fails/,
    'WHEN called with a settings object without an event property, it throws')
});

// custom event factory not a function
QUnit.test("Bad settings : custom event factory not a function", function exec_test(assert) {
  const testData = testSpace.BadSettings.EventFactoryNotAFunction;

  const eventFactoryComponent = mEventFactory(testData.eventFactorySettings, testData.childrenComponents);

  assert.throws(function () {
      eventFactoryComponent({}, {})
    }, /fails/,
    'WHEN called with a settings object, with an event property and a custom event factory' +
    ' which is not a function, it throws')
});

// selector not a string
QUnit.test("Bad settings : selector not a string", function exec_test(assert) {
  const testData = testSpace.BadSettings.SelectorNotAString;

  const eventFactoryComponent = mEventFactory(testData.eventFactorySettings, testData.childrenComponents);

  assert.throws(function () {
      eventFactoryComponent({}, {})
    }, /fails/,
    'WHEN called with a settings object, with a DOM event associated to a selector which is not' +
    ' a string, it throws')
});

//////////////
// GoodSettings

// empty settings - no children components
QUnit.test("Good settings > empty settings : no children components", function exec_test(assert) {
  const testData = testSpace.GoodSettings.EmptySettings.caseEmpmtyAndNoChildren;

  const emptyEventFactoryComponent = mEventFactory(testData.eventFactorySettings, testData.childrenComponents);

  const sinks = emptyEventFactoryComponent({}, {});
  assert.deepEqual(sinks, {}, `WHEN called with empty settings, and no children components, it returns empty sinks`)
});

// empty settings - 1 child component
QUnit.test("Good settings > empty settings : 1 child component", function exec_test(assert) {
  const done = assert.async(2);

  const testData = testSpace.GoodSettings.EmptySettings.caseEmpmtyAndOneChild;

  const inputs = [
    { [EVENT_SOURCE1]: { diagram: 'a-b-c|', values: eventSourcesTestValues } },
    { [EVENT_SOURCE2]: { diagram: '-A-B-C|', values: eventSourcesTestValues } },
  ];

  const testResults = {
    [NON_DOM_SINK]: {
      outputs: [`${SEP} ${NON_DOM_SINK}-A`, `${SEP} ${NON_DOM_SINK}-B`, `${SEP} ${NON_DOM_SINK}-C`],
      successMessage: `sink ${NON_DOM_SINK} produces the expected values`,
      analyzeTestResults: analyzeTestResults(assert, done),
    },
    [DOM_SINK]: {
      outputs: [
        `<div><span>${DOM_SINK} ${SEP} a</span></div>`,
        `<div><span>${DOM_SINK} ${SEP} b</span></div>`,
        `<div><span>${DOM_SINK} ${SEP} c</span></div>`
      ],
      transformFn: convertVNodesToHTML,
      successMessage: `sink ${DOM_SINK} produces the expected values`,
      analyzeTestResults: analyzeTestResults(assert, done),
    },
  };

  runTestScenario(inputs, testResults, eventFactoryComponent(testData, { SEP: `${SEP}` }), {
    tickDuration: 5,
    waitForFinishDelay: 50
  })
});

// empty settings - two children components
QUnit.test("Good settings > empty settings : 2 children components", function exec_test(assert) {
  const done = assert.async(2);

  const testData = testSpace.GoodSettings.EmptySettings.caseEmpmtyAndTwoChildren;

  const inputs = [
    { [EVENT_SOURCE1]: { diagram: 'a-b-c|', values: eventSourcesTestValues } },
    { [EVENT_SOURCE2]: { diagram: '-A-B-C|', values: eventSourcesTestValues } },
  ];

  const testResults = {
    [NON_DOM_SINK]: {
      outputs: [
        `${SEP} ${NON_DOM_SINK}-a`, `${SEP} ${NON_DOM_SINK}-A`,
        `${SEP} ${NON_DOM_SINK}-b`, `${SEP} ${NON_DOM_SINK}-B`,
        `${SEP} ${NON_DOM_SINK}-c`, `${SEP} ${NON_DOM_SINK}-C`,
      ],
      successMessage: `sink ${NON_DOM_SINK} produces the expected values`,
      analyzeTestResults: analyzeTestResults(assert, done),
    },
    [DOM_SINK]: {
      outputs: [
        `<div><span>${DOM_SINK} ${SEP} a</span><span>${DOM_SINK} ${SEP} a</span></div>`,
        `<div><span>${DOM_SINK} ${SEP} b</span><span>${DOM_SINK} ${SEP} a</span></div>`,
        `<div><span>${DOM_SINK} ${SEP} b</span><span>${DOM_SINK} ${SEP} b</span></div>`,
        `<div><span>${DOM_SINK} ${SEP} c</span><span>${DOM_SINK} ${SEP} b</span></div>`,
        `<div><span>${DOM_SINK} ${SEP} c</span><span>${DOM_SINK} ${SEP} c</span></div>`,
      ],
      transformFn: convertVNodesToHTML,
      successMessage: `sink ${DOM_SINK} produces the expected values`,
      analyzeTestResults: analyzeTestResults(assert, done),
    },
  };

  runTestScenario(inputs, testResults, eventFactoryComponent(testData, { SEP: `${SEP}` }), {
    tickDuration: 5,
    waitForFinishDelay: 50
  })
});

//////////////
// CustomSettings

// custom settings - 1 custom x no children components
QUnit.test("Good settings > custom settings : 1 custom x no children components", function exec_test(assert) {
  const done = assert.async(1);
  const testData = testSpace.GoodSettings.CustomSettings.caseOneCustomAndNoChildren;

  const inputs = [
    { [EVENT_SOURCE1]: { diagram: 'a-b-c|', values: eventSourcesTestValues } },
    { [EVENT_SOURCE2]: { diagram: '-A-B-C|', values: eventSourcesTestValues } },
  ];

  const testResults = {
    [SOME_EVENT_NAME]: {
      outputs: [
        `${SOME_EVENT_NAME} ${SEP} a`,
        `${SOME_EVENT_NAME} ${SEP} b`,
        `${SOME_EVENT_NAME} ${SEP} c`
      ],
      successMessage: `sink ${SOME_EVENT_NAME} produces the expected values`,
      analyzeTestResults: analyzeTestResults(assert, done),
    },
  };

  runTestScenario(inputs, testResults, eventFactoryComponent(testData, { SEP: `${SEP}` }), {
    tickDuration: 5,
    waitForFinishDelay: 50
  })
});

// custom settings - 1 custom x one child component
QUnit.test("Good settings > custom settings : 1 custom x one child component", function exec_test(assert) {
  const done = assert.async(3);
  const testData = testSpace.GoodSettings.CustomSettings.caseOneCustomAndOneChild;

  const inputs = [
    { [EVENT_SOURCE1]: { diagram: 'a-b-c|', values: eventSourcesTestValues } },
    { [EVENT_SOURCE2]: { diagram: '-A-B-C|', values: eventSourcesTestValues } },
  ];

  const testResults = {
    [SOME_EVENT_NAME]: {
      outputs: [
        `${SOME_EVENT_NAME} ${SEP} a`,
        `${SOME_EVENT_NAME} ${SEP} b`,
        `${SOME_EVENT_NAME} ${SEP} c`
      ],
      successMessage: `sink ${SOME_EVENT_NAME} produces the expected values`,
      analyzeTestResults: analyzeTestResults(assert, done),
    },
    [DOM_SINK]: {
      outputs: [
        `<div><span>${DOM_SINK} ${SEP} a</span></div>`,
        `<div><span>${DOM_SINK} ${SEP} b</span></div>`,
        `<div><span>${DOM_SINK} ${SEP} c</span></div>`
      ],
      transformFn: convertVNodesToHTML,
      successMessage: `sink ${DOM_SINK} produces the expected values`,
      analyzeTestResults: analyzeTestResults(assert, done),
    },
    [NON_DOM_SINK]: {
      outputs: [`${SEP} ${NON_DOM_SINK}-A`, `${SEP} ${NON_DOM_SINK}-B`, `${SEP} ${NON_DOM_SINK}-C`],
      successMessage: `sink ${NON_DOM_SINK} produces the expected values`,
      analyzeTestResults: analyzeTestResults(assert, done),
    },
  };

  runTestScenario(inputs, testResults, eventFactoryComponent(testData, { SEP: `${SEP}` }), {
    tickDuration: 5,
    waitForFinishDelay: 50
  })
});

// custom settings - 1 custom x two children components
QUnit.test("Good settings > custom settings : 1 custom x two children components", function exec_test(assert) {
  const done = assert.async(3);
  const testData = testSpace.GoodSettings.CustomSettings.caseOneCustomAndTwoChildren;

  const inputs = [
    { [EVENT_SOURCE1]: { diagram: 'a-b-c|', values: eventSourcesTestValues } },
    { [EVENT_SOURCE2]: { diagram: '-A-B-C|', values: eventSourcesTestValues } },
  ];

  const testResults = {
    [SOME_EVENT_NAME]: {
      outputs: [
        `${SOME_EVENT_NAME} ${SEP} a`,
        `${SOME_EVENT_NAME} ${SEP} b`,
        `${SOME_EVENT_NAME} ${SEP} c`
      ],
      successMessage: `sink ${SOME_EVENT_NAME} produces the expected values`,
      analyzeTestResults: analyzeTestResults(assert, done),
    },
    [NON_DOM_SINK]: {
      outputs: [
        `${SEP} ${NON_DOM_SINK}-a`, `${SEP} ${NON_DOM_SINK}-A`,
        `${SEP} ${NON_DOM_SINK}-b`, `${SEP} ${NON_DOM_SINK}-B`,
        `${SEP} ${NON_DOM_SINK}-c`, `${SEP} ${NON_DOM_SINK}-C`,
      ],
      successMessage: `sink ${NON_DOM_SINK} produces the expected values`,
      analyzeTestResults: analyzeTestResults(assert, done),
    },
    [DOM_SINK]: {
      outputs: [
        `<div><span>${DOM_SINK} ${SEP} a</span><span>${DOM_SINK} ${SEP} a</span></div>`,
        `<div><span>${DOM_SINK} ${SEP} b</span><span>${DOM_SINK} ${SEP} a</span></div>`,
        `<div><span>${DOM_SINK} ${SEP} b</span><span>${DOM_SINK} ${SEP} b</span></div>`,
        `<div><span>${DOM_SINK} ${SEP} c</span><span>${DOM_SINK} ${SEP} b</span></div>`,
        `<div><span>${DOM_SINK} ${SEP} c</span><span>${DOM_SINK} ${SEP} c</span></div>`,
      ],
      transformFn: convertVNodesToHTML,
      successMessage: `sink ${DOM_SINK} produces the expected values`,
      analyzeTestResults: analyzeTestResults(assert, done),
    },
  };

  runTestScenario(inputs, testResults, eventFactoryComponent(testData, { SEP: `${SEP}` }), {
    tickDuration: 5,
    waitForFinishDelay: 50
  })
});

// custom settings - 2 custom x no children components
QUnit.test("Good settings > custom settings : 2 custom x no children components", function exec_test(assert) {
  const done = assert.async(2);
  const testData = testSpace.GoodSettings.CustomSettings.caseTwoCustomAndNoChildren;

  const inputs = [
    { [EVENT_SOURCE1]: { diagram: 'a-b-c|', values: eventSourcesTestValues } },
    { [EVENT_SOURCE2]: { diagram: '-A-B-C|', values: eventSourcesTestValues } },
  ];

  const testResults = {
    [SOME_EVENT_NAME]: {
      outputs: [
        `${SOME_EVENT_NAME} ${SEP} a`,
        `${SOME_EVENT_NAME} ${SEP} b`,
        `${SOME_EVENT_NAME} ${SEP} c`
      ],
      successMessage: `sink ${SOME_EVENT_NAME} produces the expected values`,
      analyzeTestResults: analyzeTestResults(assert, done),
    },
    [ANOTHER_EVENT_NAME]: {
      outputs: [
        `${ANOTHER_EVENT_NAME} ${SEP} A`,
        `${ANOTHER_EVENT_NAME} ${SEP} B`,
        `${ANOTHER_EVENT_NAME} ${SEP} C`
      ],
      successMessage: `sink ${SOME_EVENT_NAME} produces the expected values`,
      analyzeTestResults: analyzeTestResults(assert, done),
    },
  };

  runTestScenario(inputs, testResults, eventFactoryComponent(testData, { SEP: `${SEP}` }), {
    tickDuration: 5,
    waitForFinishDelay: 50
  })
});

// custom settings - 2 custom x one child component
QUnit.test("Good settings > custom settings : 2 custom x one child component", function exec_test(assert) {
  const done = assert.async(4);
  const testData = testSpace.GoodSettings.CustomSettings.caseTwoCustomAndOneChild;

  const inputs = [
    { [EVENT_SOURCE1]: { diagram: 'a-b-c|', values: eventSourcesTestValues } },
    { [EVENT_SOURCE2]: { diagram: '-A-B-C|', values: eventSourcesTestValues } },
  ];

  const testResults = {
    [SOME_EVENT_NAME]: {
      outputs: [
        `${SOME_EVENT_NAME} ${SEP} a`,
        `${SOME_EVENT_NAME} ${SEP} b`,
        `${SOME_EVENT_NAME} ${SEP} c`
      ],
      successMessage: `sink ${SOME_EVENT_NAME} produces the expected values`,
      analyzeTestResults: analyzeTestResults(assert, done),
    },
    [ANOTHER_EVENT_NAME]: {
      outputs: [
        `${ANOTHER_EVENT_NAME} ${SEP} A`,
        `${ANOTHER_EVENT_NAME} ${SEP} B`,
        `${ANOTHER_EVENT_NAME} ${SEP} C`
      ],
      successMessage: `sink ${SOME_EVENT_NAME} produces the expected values`,
      analyzeTestResults: analyzeTestResults(assert, done),
    },
    [DOM_SINK]: {
      outputs: [
        `<div><span>${DOM_SINK} ${SEP} a</span></div>`,
        `<div><span>${DOM_SINK} ${SEP} b</span></div>`,
        `<div><span>${DOM_SINK} ${SEP} c</span></div>`
      ],
      transformFn: convertVNodesToHTML,
      successMessage: `sink ${DOM_SINK} produces the expected values`,
      analyzeTestResults: analyzeTestResults(assert, done),
    },
    [NON_DOM_SINK]: {
      outputs: [`${SEP} ${NON_DOM_SINK}-A`, `${SEP} ${NON_DOM_SINK}-B`, `${SEP} ${NON_DOM_SINK}-C`],
      successMessage: `sink ${NON_DOM_SINK} produces the expected values`,
      analyzeTestResults: analyzeTestResults(assert, done),
    },
  };

  runTestScenario(inputs, testResults, eventFactoryComponent(testData, { SEP: `${SEP}` }), {
    tickDuration: 5,
    waitForFinishDelay: 50
  })
});

// custom settings - 2 custom x two children components
QUnit.test("Good settings > custom settings : 2 custom x two children components", function exec_test(assert) {
  const done = assert.async(4);
  const testData = testSpace.GoodSettings.CustomSettings.caseTwoCustomAndTwoChildren;

  const inputs = [
    { [EVENT_SOURCE1]: { diagram: 'a-b-c|', values: eventSourcesTestValues } },
    { [EVENT_SOURCE2]: { diagram: '-A-B-C|', values: eventSourcesTestValues } },
  ];

  const testResults = {
    [SOME_EVENT_NAME]: {
      outputs: [
        `${SOME_EVENT_NAME} ${SEP} a`,
        `${SOME_EVENT_NAME} ${SEP} b`,
        `${SOME_EVENT_NAME} ${SEP} c`
      ],
      successMessage: `sink ${SOME_EVENT_NAME} produces the expected values`,
      analyzeTestResults: analyzeTestResults(assert, done),
    },
    [ANOTHER_EVENT_NAME]: {
      outputs: [
        `${ANOTHER_EVENT_NAME} ${SEP} A`,
        `${ANOTHER_EVENT_NAME} ${SEP} B`,
        `${ANOTHER_EVENT_NAME} ${SEP} C`
      ],
      successMessage: `sink ${SOME_EVENT_NAME} produces the expected values`,
      analyzeTestResults: analyzeTestResults(assert, done),
    },
    [NON_DOM_SINK]: {
      outputs: [
        `${SEP} ${NON_DOM_SINK}-a`, `${SEP} ${NON_DOM_SINK}-A`,
        `${SEP} ${NON_DOM_SINK}-b`, `${SEP} ${NON_DOM_SINK}-B`,
        `${SEP} ${NON_DOM_SINK}-c`, `${SEP} ${NON_DOM_SINK}-C`,
      ],
      successMessage: `sink ${NON_DOM_SINK} produces the expected values`,
      analyzeTestResults: analyzeTestResults(assert, done),
    },
    [DOM_SINK]: {
      outputs: [
        `<div><span>${DOM_SINK} ${SEP} a</span><span>${DOM_SINK} ${SEP} a</span></div>`,
        `<div><span>${DOM_SINK} ${SEP} b</span><span>${DOM_SINK} ${SEP} a</span></div>`,
        `<div><span>${DOM_SINK} ${SEP} b</span><span>${DOM_SINK} ${SEP} b</span></div>`,
        `<div><span>${DOM_SINK} ${SEP} c</span><span>${DOM_SINK} ${SEP} b</span></div>`,
        `<div><span>${DOM_SINK} ${SEP} c</span><span>${DOM_SINK} ${SEP} c</span></div>`,
      ],
      transformFn: convertVNodesToHTML,
      successMessage: `sink ${DOM_SINK} produces the expected values`,
      analyzeTestResults: analyzeTestResults(assert, done),
    },
  };

  runTestScenario(inputs, testResults, eventFactoryComponent(testData, { SEP: `${SEP}` }), {
    tickDuration: 5,
    waitForFinishDelay: 50
  })
});

//////////////
// DOMSettings

// DOM Settings - 1 DOM x no children components
// TODO : here will have to use APIs for DOM select of runTestScenario... so could use as a
// demonstration of how to use this APIs = to put in runTestScenario.md
QUnit.test("Good settings > DOM settings : 1 custom x no children components", function exec_test(assert) {
  const done = assert.async(1);
  const testData = testSpace.GoodSettings.DOMSettings.caseDOMSettingsAndNoChildren;

  const inputs = [
    { [EVENT_SOURCE1]: { diagram: 'a-b-c|', values: eventSourcesTestValues } },
    { [EVENT_SOURCE2]: { diagram: '-A-B-C|', values: eventSourcesTestValues } },
    {
      [`DOM!${SOME_SELECTOR_ID}@${SOME_DOM_EVENT_NAME}`]: {
        diagram: '-x-y-z', values: DOMeventsTestValues
      }
    },
  ];

  const testResults = {
    [makeEventNameFromSelectorAndEvent(SOME_SELECTOR_ID, SOME_DOM_EVENT_NAME)]: {
      outputs: values(DOMeventsTestValues),
      successMessage: `sink ${SOME_DOM_EVENT_NAME} produces the expected values`,
      analyzeTestResults: analyzeTestResults(assert, done),
    },
  };

  runTestScenario(inputs, testResults, eventFactoryComponent(testData, { SEP: `${SEP}` }), {
    tickDuration: 5,
    waitForFinishDelay: 50,
    mocks: {
      DOM: makeMockDOMSource
    },
    sourceFactory: {
      [`DOM!${SOME_SELECTOR_ID}@${SOME_DOM_EVENT_NAME}`]: subjectFactory,
      [`DOM!${SOME_SELECTOR_ID}@${ANOTHER_DOM_EVENT_NAME}`]: subjectFactory,
    },
    errorHandler: function (err) {
      done(err)
    }
  })
});

// DOM Settings - 1 DOM x one child component

// DOM Settings - 1 DOM x two children components

// DOM Settings - >1 DOM same event x no children components

// DOM Settings - >1 DOM same event x one child component

// DOM Settings - >1 DOM same event x two children components

// DOM Settings - >1 DOM different events x no children components

// DOM Settings - >1 DOM different events x one child component

// DOM Settings - >1 DOM different events x two children components

// TODO: move analyzeTestResults to a settings like tickDuration, review all runTestScenario
// test, harmonize with FSM-example, review by default value or make mandatory! and update
// documentation, and harmonize in FSM-example if necessary
// also harmonize utils for FSM-example
