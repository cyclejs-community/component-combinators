// mButton(mButtonSettings, childrenComponents)
// # Test space = Settings x ChildrenComponents
// # Testing strategy
// cf. document
// - By the independence hypothesis, we will test separately
//   - Test space = Settings + ChildrenComponents
//     - this means we will test for children components while testing for settings
// ChildrenComponents
// ## Testing for Settings
// - Settings = BadSettings | GoodSettings
//   - Per the HC/LB faith hypothesis, we simply won't test against bad settings.
//   - SettingsList = [classes, listenOn, emphasis, basic, focusable, animated, label, icon,
// visualState, social, size, shape, layout, listenTo] - GoodSettings = Combinatorial(SettingsList)
// -> too big - By and the independance hypothesis, we will only test separately for each setting
// property in SettingsList - By the generating set hypothesis, we will only test for one/a minimum
// of non-trivial value(s) of a given setting property - By the HC/LB faith hypothesis, we won't
// test for trivial values of a given settings property - GoodSettings =
// RepresentativeValue(s)Of(SettingsList) ## Testing for ChildrenComponents - childrenComponents :
// 0 child | 1 child | > 1 child (generating set hypothesis) - as mentioned before, we will test
// for children components while testing for settings

import * as QUnit from "qunitjs"
import * as Rx from "rx"
import { addPrefix, convertVNodesToHTML, noop } from "../src/utils"
import { runTestScenario } from "../src/runTestScenario"
import { span } from "cycle-snabbdom"
import { makeMockDOMSource } from "../src/mockDOM"
import { mButton } from "../src/components/mButton"

const SEP = ':';
const NOT_A_FUNCTION = 42;
const NOT_A_STRING = 42;
const SOME_EVENT_NAME = 'some_event_name';
const ANOTHER_EVENT_NAME = 'another_event_name';
const SOME_DOM_EVENT_NAME = 'click';
const ANOTHER_DOM_EVENT_NAME = 'hover';
const SOME_PREFIXED_DOM_EVENT_NAME_1 = SOME_DOM_EVENT_NAME + 'Button';
const SOME_PREFIXED_DOM_EVENT_NAME_2 = SOME_DOM_EVENT_NAME + 'Input';
const ANOTHER_PREFIXED_DOM_EVENT_NAME_1 = ANOTHER_DOM_EVENT_NAME + 'Button';
const ANOTHER_PREFIXED_DOM_EVENT_NAME_2 = ANOTHER_DOM_EVENT_NAME + 'Input';
const EVENT_SOURCE1 = 'eventSource1';
const EVENT_SOURCE2 = 'eventSource2';
const NON_DOM_SINK = 'non_dom_sink';
const DOM_SINK = 'DOM';
const SOME_SELECTOR = '#some_selector_id';
const ANOTHER_SELECTOR = '.some_class';
const A_CLASS = 'a_class';
const ANOTHER_CLASS = 'another_class';
const eventSourcesTestValues = {
  a: 'a', b: 'b', c: 'c', d: 'd', e: 'e', f: 'f',
  A: 'A', B: 'B', C: 'C', D: 'D', E: 'E', F: 'F'
};
const DOMeventsTestValuesSomeSelector = {
  x: makeDummyClickEvent(`${SOME_SELECTOR}@${SOME_DOM_EVENT_NAME} ${SEP} #1`),
  y: makeDummyClickEvent(`${SOME_SELECTOR}@${SOME_DOM_EVENT_NAME} ${SEP} #2`),
  z: makeDummyClickEvent(`${SOME_SELECTOR}@${SOME_DOM_EVENT_NAME} ${SEP} #3`),
};
const DOMeventsTestValuesAnotherSelector = {
  x: makeDummyClickEvent(`${ANOTHER_SELECTOR}@${SOME_DOM_EVENT_NAME} ${SEP} #1`),
  y: makeDummyClickEvent(`${ANOTHER_SELECTOR}@${SOME_DOM_EVENT_NAME} ${SEP} #2`),
  z: makeDummyClickEvent(`${ANOTHER_SELECTOR}@${SOME_DOM_EVENT_NAME} ${SEP} #3`),
};

function subjectFactory() {
  return new Rx.Subject()
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

function makeButtonComponent(testData, settings) {
  return function makeButtonComponent_(sources) {
    return mButton(testData.settings, testData.childrenComponents)(sources, settings);
  }
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
      .tap(print(`comp1DOM1NonDOMEvSource12 > DOM > ${EVENT_SOURCE1}`))
    ,
    [NON_DOM_SINK]: sources[EVENT_SOURCE2]
      .tap(print(`comp1DOM1NonDOMEvSource12 > NON-DOM > ${EVENT_SOURCE2}`))
      .map(addPrefix(`${settings.SEP} ${NON_DOM_SINK}-`)),
  }
}

const testSpace = {
  BadSettings: {},
  GoodSettings: {
    EmptySettings: {
      caseEmpmtyAndTwoChildren: {
        settings: {},
        childrenComponents: [comp1DOM1NonDOMEvSource11, comp1DOM1NonDOMEvSource12]
      }
    },
    ClassesSettings: {
      caseClassesAndTwoChildren: {
        settings: {
          classes: [A_CLASS, ANOTHER_CLASS]
        },
        childrenComponents: [comp1DOM1NonDOMEvSource11, comp1DOM1NonDOMEvSource12]
      }
    }
  }
}

// Initialization
QUnit.module("mButton(mButtonSettings, childrenComponents)", {});

// Settings = {}
QUnit.test("Good settings : empty settings", function exec_test(assert) {
  const done = assert.async(2);

  const testData = testSpace.GoodSettings.EmptySettings.caseEmpmtyAndTwoChildren;

  const inputs = [
    { [EVENT_SOURCE1]: { diagram: 'a-b-c|', values: eventSourcesTestValues } },
    { [EVENT_SOURCE2]: { diagram: '-A-B-C|', values: eventSourcesTestValues } },
    {
      [`DOM!${SOME_SELECTOR}@${SOME_DOM_EVENT_NAME}`]: {
        diagram: 'x-y-z', values: DOMeventsTestValuesSomeSelector
      }
    },
    {
      [`DOM!${ANOTHER_SELECTOR}@${ANOTHER_DOM_EVENT_NAME}`]: {
        diagram: '-x-y-z', values: DOMeventsTestValuesAnotherSelector
      }
    },
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
        `<div class=\"ui button\"><span>${DOM_SINK} ${SEP} a</span><span>${DOM_SINK} ${SEP} a</span></div>`,
        `<div class=\"ui button\"><span>${DOM_SINK} ${SEP} b</span><span>${DOM_SINK} ${SEP} a</span></div>`,
        `<div class=\"ui button\"><span>${DOM_SINK} ${SEP} b</span><span>${DOM_SINK} ${SEP} b</span></div>`,
        `<div class=\"ui button\"><span>${DOM_SINK} ${SEP} c</span><span>${DOM_SINK} ${SEP} b</span></div>`,
        `<div class=\"ui button\"><span>${DOM_SINK} ${SEP} c</span><span>${DOM_SINK} ${SEP} c</span></div>`,
      ],
      transformFn: convertVNodesToHTML,
      successMessage: `sink ${DOM_SINK} produces the expected values`,
      analyzeTestResults: analyzeTestResults(assert, done),
    },
  };

  runTestScenario(inputs, testResults, makeButtonComponent(testData, { SEP: `${SEP}` }), {
    tickDuration: 5,
    waitForFinishDelay: 50,
    mocks: {
      DOM: makeMockDOMSource
    },
    sourceFactory: {
      [`DOM!${SOME_SELECTOR}@${SOME_DOM_EVENT_NAME}`]: subjectFactory,
      [`DOM!${SOME_SELECTOR}@${ANOTHER_DOM_EVENT_NAME}`]: subjectFactory,
    },
    errorHandler: function (err) {
      done(err)
    }
  })


});

// Settings = {classes} - several classes
QUnit.test("Good settings : classes - several classes", function exec_test(assert) {
  const done = assert.async(2);

  const testData = testSpace.GoodSettings.ClassesSettings.caseClassesAndTwoChildren;

  const inputs = [
    { [EVENT_SOURCE1]: { diagram: 'a-b-c|', values: eventSourcesTestValues } },
    { [EVENT_SOURCE2]: { diagram: '-A-B-C|', values: eventSourcesTestValues } },
    {
      [`DOM!${SOME_SELECTOR}@${SOME_DOM_EVENT_NAME}`]: {
        diagram: 'x-y-z', values: DOMeventsTestValuesSomeSelector
      }
    },
    {
      [`DOM!${ANOTHER_SELECTOR}@${ANOTHER_DOM_EVENT_NAME}`]: {
        diagram: '-x-y-z', values: DOMeventsTestValuesAnotherSelector
      }
    },
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
        `<div class=\"ui button\ ${A_CLASS} ${ANOTHER_CLASS}\"><span>${DOM_SINK} ${SEP} a</span><span>${DOM_SINK} ${SEP} a</span></div>`,
        `<div class=\"ui button\ ${A_CLASS} ${ANOTHER_CLASS}\"><span>${DOM_SINK} ${SEP} b</span><span>${DOM_SINK} ${SEP} a</span></div>`,
        `<div class=\"ui button\ ${A_CLASS} ${ANOTHER_CLASS}\"><span>${DOM_SINK} ${SEP} b</span><span>${DOM_SINK} ${SEP} b</span></div>`,
        `<div class=\"ui button\ ${A_CLASS} ${ANOTHER_CLASS}\"><span>${DOM_SINK} ${SEP} c</span><span>${DOM_SINK} ${SEP} b</span></div>`,
        `<div class=\"ui button\ ${A_CLASS} ${ANOTHER_CLASS}\"><span>${DOM_SINK} ${SEP} c</span><span>${DOM_SINK} ${SEP} c</span></div>`,
      ],
      transformFn: convertVNodesToHTML,
      successMessage: `sink ${DOM_SINK} produces the expected values`,
      analyzeTestResults: analyzeTestResults(assert, done),
    },
  };

  runTestScenario(inputs, testResults, makeButtonComponent(testData, { SEP: `${SEP}` }), {
    tickDuration: 5,
    waitForFinishDelay: 50,
    mocks: {
      DOM: makeMockDOMSource
    },
    sourceFactory: {
      [`DOM!${SOME_SELECTOR}@${SOME_DOM_EVENT_NAME}`]: subjectFactory,
      [`DOM!${SOME_SELECTOR}@${ANOTHER_DOM_EVENT_NAME}`]: subjectFactory,
    },
    errorHandler: function (err) {
      done(err)
    }
  })


});

// Settings = {emphasis} - one
// Settings = {basic} - one
// Settings = {focusable} - one
// Settings = {animated} - one
// Settings = {label} - one
// Settings = {icon} - one
// Settings = {visualState} - one
// Settings = {social} - one
// Settings = {size} - one
// Settings = {shape} - one
// Settings = {layout} - one
// Settings = {id} - one
// Settings = {listenTo} - one
