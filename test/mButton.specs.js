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
// - Settings = BadSettings | GoodSettings
//   - GoodSettings = CustomSettings | DOMSettings | CustomAndDomSettings
//     - CustomSettings = 1 custom | >1 custom (T2)
//     - DOMSettings = 1 DOM | >1 DOM same event | >1 DOM different events (T2)
//     - CustomAndDomSettings = 1 custom & 1 DOM | >1 custom & >1 DOM (T2)
//       - Note : 1DOM, >1 custom and >1 DOM, 1 custom excluded from the space (T3 - >1 & >1
//   - BadSettings : we only test 5 conditions (T4):
//     - no events property in settings, custom event factory not a function, selector not a
// string
//     - children sink name conflict with new event name
//     - new DOM event name conflict with custom event name
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
//     - |BadSettings| = 3 + 2
// - |Test Space| = |GoodSettings| x |ChildrenComponents| + |BadSettings| (T3, T1 - BadSettings
// independent from ChildrenComponents)
// - |Test Space| = 8 x 3 + 3 + 2 = 29
//
// We hence have 29 tests to write, which is still a lot. We could further reduce the number of
// tests by 'diagnoalizing' `Ai x Bj` into `(Ai,Bi)` (testing against A) | (Aj,Bj) (testing
// against `B`) and picking up `Ai, Aj, Bi, Bj` such that `i <> j` implies `Bi <> Bj`.
// This obviously makes sense when one has the confidence that A and B space are
// relatively orthogonal and that the |A| x |B| - (|A| + |B|) untested values have little weight
// (T4, T3). We would then have |Test Space| = 8 + 3 + 3 + 2 = 16, i.e. half the number of tests.
//
// We will however choose to go for the previous reduction of the test space to 29. As a matter of
// fact, reducing by half the test space forces to choose well the (Ai) and (Bj), which makes
// the test itself less maintenable - unless the test construction is properly documented.
// We think it is simpler, less error prone, and also more automatizable to do a cartesian
// product of the test subspaces. The hope is we can use some relationship between some `f(ai,bi)`
// so as to deduce some test results from previous test results, possibly reducing the effort by
// more than half.

import * as QUnit from "qunitjs"
import * as Rx from "rx"
import { values } from "ramda"
import { mEventFactory } from "../src/components/mEventFactory"
import { addPrefix, noop } from "../utils/utils/src/index"
import { convertVNodesToHTML, format } from "../utils/debug/src/index"
import { runTestScenario } from "../src/runTestScenario"
import { span } from "cycle-snabbdom"
import { makeMockDOMSource } from "../utils/testing/mocks/mockDOM"
// Bad settings - children sink name conflict with new event name TODO and move back to BAD up
// Bad settings - new DOM event name conflict with custom event name TODO and move back to BAD up
// TODO : here will have to use APIs for DOM select of runTestScenario... so could use as a
// demonstration of how to use this APIs = to put in runTestScenario.md
// TODO: move analyzeTestResults to a settings like tickDuration, review all runTestScenario
// test, harmonize with FSM-example, review by default value or make mandatory! and update
// documentation, and harmonize in FSM-example if necessary
// also harmonize utils for FSM-example
///////
// mButtonFactory.specs
import { mButton } from "../src/components/mButton"

const SEP = ':';
const NOT_A_FUNCTION = 42;
const NOT_A_STRING = 42;
const SOME_EVENT_NAME = 'some_event_name';
const ANOTHER_EVENT_NAME = 'another_event_name';
const SOME_DOM_EVENT_NAME = 'click';
const ANOTHER_DOM_EVENT_NAME = 'mouseover';
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
      .tap(print(`comp1DOM1NonDOMEvSource12 > DOM > ${EVENT_SOURCE1}`))
    ,
    [NON_DOM_SINK]: sources[EVENT_SOURCE2]
      .tap(print(`comp1DOM1NonDOMEvSource12 > NON-DOM > ${EVENT_SOURCE2}`))
      .map(addPrefix(`${settings.SEP} ${NON_DOM_SINK}-`)),
  }
}

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

// Initialization
QUnit.module("mButton(mButtonSettings, childrenComponents)", {});

const A_CLASS = 'a_class';
const ANOTHER_CLASS = 'another_class';

const buttonTestSpace = {
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
    },
    EmphasisSetting: {
      caseEmphasisAndOneChild: {
        settings: { emphasis: 'secondary' },
        childrenComponents: [comp1DOM1NonDOMEvSource12]
      }
    },
    BasicSetting: {
      caseBasicAndOneChild: {
        settings: { basic: true },
        childrenComponents: [comp1DOM1NonDOMEvSource12]
      }
    },
    AnimatedSetting: {
      caseTrueAndOneChild: {
        settings: { animated: true },
        childrenComponents: [comp1DOM1NonDOMEvSource12]
      },
      caseStringAndOneChild: {
        settings: { animated: 'fade' },
        childrenComponents: [comp1DOM1NonDOMEvSource12]
      }
    },
    LabelSetting: {
      caseTrueAndOneChild: {
        settings: { label: { position: 'left' } },
        childrenComponents: [comp1DOM1NonDOMEvSource12]
      },
    },
    IconSetting: {
      caseTrueAndOneChild: {
        settings: { icon: true },
        childrenComponents: [comp1DOM1NonDOMEvSource12]
      },
    },
    VisualStateSetting: {
      caseActiveAndOneChild: {
        settings: { visualState: 'active' },
        childrenComponents: [comp1DOM1NonDOMEvSource12]
      },
    },
    SocialSetting: {
      caseFacebookAndOneChild: {
        settings: { social: 'facebook' },
        childrenComponents: [comp1DOM1NonDOMEvSource12]
      },
    },
    SizeSetting: {
      caseMassiveAndOneChild: {
        settings: { size: 'massive' },
        childrenComponents: [comp1DOM1NonDOMEvSource12]
      },
    },
    ShapeSetting: {
      caseCircularAndOneChild: {
        settings: { shape: 'circular' },
        childrenComponents: [comp1DOM1NonDOMEvSource12]
      },
    },
    LayoutSetting: {
      caseTopAttachedAndOneChild: {
        settings: { layout: 'top attached' },
        childrenComponents: [comp1DOM1NonDOMEvSource12]
      },
    },
    ListenToSetting: {
      caseClickAndOneChild: {
        settings: {
          listenOn: SOME_SELECTOR,
          listenTo: [SOME_DOM_EVENT_NAME, ANOTHER_DOM_EVENT_NAME]
        },
        childrenComponents: [comp1DOM1NonDOMEvSource12]
      },
    },
  }
}

function makeButtonComponent(testData, settings) {
  return function makeButtonComponent_(sources) {
    return mButton(testData.settings, testData.childrenComponents)(sources, settings);
  }
}

// Settings = {}
QUnit.test("Good settings : empty settings", function exec_test(assert) {
  const done = assert.async(2);

  const testData = buttonTestSpace.GoodSettings.EmptySettings.caseEmpmtyAndTwoChildren;

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
  const ATTRS = 'tabindex="0"';

  const testResults = {
    [NON_DOM_SINK]: {
      outputs: [
        `${SEP} ${NON_DOM_SINK}-a`, `${SEP} ${NON_DOM_SINK}-A`,
        `${SEP} ${NON_DOM_SINK}-b`, `${SEP} ${NON_DOM_SINK}-B`,
        `${SEP} ${NON_DOM_SINK}-c`, `${SEP} ${NON_DOM_SINK}-C`,
      ],
      successMessage: `sink ${NON_DOM_SINK} produces the expected values`,
    },
    [DOM_SINK]: {
      outputs: [
        `<div class=\"ui button\" ${ATTRS}><span>${DOM_SINK} ${SEP} a</span><span>${DOM_SINK} ${SEP} a</span></div>`,
        `<div class=\"ui button\" ${ATTRS}><span>${DOM_SINK} ${SEP} b</span><span>${DOM_SINK} ${SEP} a</span></div>`,
        `<div class=\"ui button\" ${ATTRS}><span>${DOM_SINK} ${SEP} b</span><span>${DOM_SINK} ${SEP} b</span></div>`,
        `<div class=\"ui button\" ${ATTRS}><span>${DOM_SINK} ${SEP} c</span><span>${DOM_SINK} ${SEP} b</span></div>`,
        `<div class=\"ui button\" ${ATTRS}><span>${DOM_SINK} ${SEP} c</span><span>${DOM_SINK} ${SEP} c</span></div>`,
      ],
      transform: convertVNodesToHTML,
      successMessage: `sink ${DOM_SINK} produces the expected values`,
    },
  };

  runTestScenario(inputs, testResults, makeButtonComponent(testData, { SEP: SEP }), {
    tickDuration: 5,
    waitForFinishDelay: 50,
    analyzeTestResults: analyzeTestResults(assert, done),
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

  const testData = buttonTestSpace.GoodSettings.ClassesSettings.caseClassesAndTwoChildren;

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
  const ATTRS = 'tabindex="0"';

  const testResults = {
    [NON_DOM_SINK]: {
      outputs: [
        `${SEP} ${NON_DOM_SINK}-a`, `${SEP} ${NON_DOM_SINK}-A`,
        `${SEP} ${NON_DOM_SINK}-b`, `${SEP} ${NON_DOM_SINK}-B`,
        `${SEP} ${NON_DOM_SINK}-c`, `${SEP} ${NON_DOM_SINK}-C`,
      ],
      successMessage: `sink ${NON_DOM_SINK} produces the expected values`,
    },
    [DOM_SINK]: {
      outputs: [
        `<div class=\"ui button\ ${A_CLASS} ${ANOTHER_CLASS}\" ${ATTRS}><span>${DOM_SINK} ${SEP} a</span><span>${DOM_SINK} ${SEP} a</span></div>`,
        `<div class=\"ui button\ ${A_CLASS} ${ANOTHER_CLASS}\" ${ATTRS}><span>${DOM_SINK} ${SEP} b</span><span>${DOM_SINK} ${SEP} a</span></div>`,
        `<div class=\"ui button\ ${A_CLASS} ${ANOTHER_CLASS}\" ${ATTRS}><span>${DOM_SINK} ${SEP} b</span><span>${DOM_SINK} ${SEP} b</span></div>`,
        `<div class=\"ui button\ ${A_CLASS} ${ANOTHER_CLASS}\" ${ATTRS}><span>${DOM_SINK} ${SEP} c</span><span>${DOM_SINK} ${SEP} b</span></div>`,
        `<div class=\"ui button\ ${A_CLASS} ${ANOTHER_CLASS}\" ${ATTRS}><span>${DOM_SINK} ${SEP} c</span><span>${DOM_SINK} ${SEP} c</span></div>`,
      ],
      transform: convertVNodesToHTML,
      successMessage: `sink ${DOM_SINK} produces the expected values`,
    },
  };

  runTestScenario(inputs, testResults, makeButtonComponent(testData, { SEP: `${SEP}` }), {
    tickDuration: 5,
    waitForFinishDelay: 50,
    analyzeTestResults: analyzeTestResults(assert, done),
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
QUnit.test("Good settings : emphasis", function exec_test(assert) {
  const done = assert.async(2);

  const testData = buttonTestSpace.GoodSettings.EmphasisSetting.caseEmphasisAndOneChild;

  const inputs = [
    { [EVENT_SOURCE1]: { diagram: 'a-b-c|', values: eventSourcesTestValues } },
    { [EVENT_SOURCE2]: { diagram: '-A-B-C|', values: eventSourcesTestValues } },
    {
      ['DOM!' + SOME_SELECTOR + '@' + SOME_DOM_EVENT_NAME]: {
        diagram: 'x-y-z', values: DOMeventsTestValuesSomeSelector
      }
    },
  ];
  const classes = ['ui', 'button', testData.settings.emphasis].join(' ');
  const ATTRS = 'tabindex="0"';
  const testResults = {
    [DOM_SINK]: {
      outputs: [
        `<div class=\"${classes}\" ${ATTRS}><span>${DOM_SINK} ${SEP} a</span></div>`,
        `<div class=\"${classes}\" ${ATTRS}><span>${DOM_SINK} ${SEP} b</span></div>`,
        `<div class=\"${classes}\" ${ATTRS}><span>${DOM_SINK} ${SEP} c</span></div>`,
      ],
      transform: convertVNodesToHTML,
      successMessage: `sink ${DOM_SINK} produces the expected values`,
    },
    [NON_DOM_SINK]: {
      outputs: [
        `${SEP} ${NON_DOM_SINK}-A`,
        `${SEP} ${NON_DOM_SINK}-B`,
        `${SEP} ${NON_DOM_SINK}-C`,
      ],
      successMessage: `sink ${NON_DOM_SINK} produces the expected values`,
    },
  };

  runTestScenario(inputs, testResults, makeButtonComponent(testData, { SEP: SEP }), {
    tickDuration: 5,
    waitForFinishDelay: 50,
    analyzeTestResults: analyzeTestResults(assert, done),
    mocks: {
      DOM: makeMockDOMSource
    },
    sourceFactory: {
      ['DOM!' + SOME_SELECTOR + '@' + SOME_DOM_EVENT_NAME]: subjectFactory,
      ['DOM!' + SOME_SELECTOR + '@' + ANOTHER_DOM_EVENT_NAME]: subjectFactory,
    },
    errorHandler: function (err) {
      done(err)
    }
  });
});

// Settings = {basic} - one
QUnit.test("Good settings : basic", function exec_test(assert) {
  const done = assert.async(2);

  const testData = buttonTestSpace.GoodSettings.BasicSetting.caseBasicAndOneChild;

  const inputs = [
    { [EVENT_SOURCE1]: { diagram: 'a-b-c|', values: eventSourcesTestValues } },
    { [EVENT_SOURCE2]: { diagram: '-A-B-C|', values: eventSourcesTestValues } },
    {
      ['DOM!' + SOME_SELECTOR + '@' + SOME_DOM_EVENT_NAME]: {
        diagram: 'x-y-z', values: DOMeventsTestValuesSomeSelector
      }
    },
  ];
  const classes = ['ui', 'button', testData.settings.basic ? 'basic' : ''].join(' ');
  const ATTRS = 'tabindex="0"';
  const testResults = {
    [DOM_SINK]: {
      outputs: [
        `<div class=\"${classes}\" ${ATTRS}><span>${DOM_SINK} ${SEP} a</span></div>`,
        `<div class=\"${classes}\" ${ATTRS}><span>${DOM_SINK} ${SEP} b</span></div>`,
        `<div class=\"${classes}\" ${ATTRS}><span>${DOM_SINK} ${SEP} c</span></div>`,
      ],
      transform: convertVNodesToHTML,
      successMessage: `sink ${DOM_SINK} produces the expected values`,
    },
    [NON_DOM_SINK]: {
      outputs: [
        `${SEP} ${NON_DOM_SINK}-A`,
        `${SEP} ${NON_DOM_SINK}-B`,
        `${SEP} ${NON_DOM_SINK}-C`,
      ],
      successMessage: `sink ${NON_DOM_SINK} produces the expected values`,
    },
  };

  runTestScenario(inputs, testResults, makeButtonComponent(testData, { SEP: SEP }), {
    tickDuration: 5,
    waitForFinishDelay: 50,
    analyzeTestResults: analyzeTestResults(assert, done),
    mocks: {
      DOM: makeMockDOMSource
    },
    sourceFactory: {
      ['DOM!' + SOME_SELECTOR + '@' + SOME_DOM_EVENT_NAME]: subjectFactory,
      ['DOM!' + SOME_SELECTOR + '@' + ANOTHER_DOM_EVENT_NAME]: subjectFactory,
    },
    errorHandler: function (err) {
      done(err)
    }
  });
});

// Settings = {animated} - one
QUnit.test("Good settings : animated - boolean", function exec_test(assert) {
  const done = assert.async(2);

  const testData = buttonTestSpace.GoodSettings.AnimatedSetting.caseTrueAndOneChild;

  const inputs = [
    { [EVENT_SOURCE1]: { diagram: 'a-b-c|', values: eventSourcesTestValues } },
    { [EVENT_SOURCE2]: { diagram: '-A-B-C|', values: eventSourcesTestValues } },
    {
      ['DOM!' + SOME_SELECTOR + '@' + SOME_DOM_EVENT_NAME]: {
        diagram: 'x-y-z', values: DOMeventsTestValuesSomeSelector
      }
    },
  ];
  const classes = ['ui', 'button', testData.settings.animated ? 'animated' : ''].join(' ');
  const ATTRS = 'tabindex="0"';
  const testResults = {
    [DOM_SINK]: {
      outputs: [
        `<div class=\"${classes}\" ${ATTRS}><span>${DOM_SINK} ${SEP} a</span></div>`,
        `<div class=\"${classes}\" ${ATTRS}><span>${DOM_SINK} ${SEP} b</span></div>`,
        `<div class=\"${classes}\" ${ATTRS}><span>${DOM_SINK} ${SEP} c</span></div>`,
      ],
      transform: convertVNodesToHTML,
      successMessage: `sink ${DOM_SINK} produces the expected values`,
      analyzeTestResults: analyzeTestResults(assert, done),
    },
    [NON_DOM_SINK]: {
      outputs: [
        `${SEP} ${NON_DOM_SINK}-A`,
        `${SEP} ${NON_DOM_SINK}-B`,
        `${SEP} ${NON_DOM_SINK}-C`,
      ],
      successMessage: `sink ${NON_DOM_SINK} produces the expected values`,
      analyzeTestResults: analyzeTestResults(assert, done),
    },
  };

  runTestScenario(inputs, testResults, makeButtonComponent(testData, { SEP: SEP }), {
    tickDuration: 5,
    waitForFinishDelay: 50,
    mocks: {
      DOM: makeMockDOMSource
    },
    sourceFactory: {
      ['DOM!' + SOME_SELECTOR + '@' + SOME_DOM_EVENT_NAME]: subjectFactory,
      ['DOM!' + SOME_SELECTOR + '@' + ANOTHER_DOM_EVENT_NAME]: subjectFactory,
    },
    errorHandler: function (err) {
      done(err)
    }
  });
});

QUnit.test("Good settings : animated - string", function exec_test(assert) {
  const done = assert.async(2);

  const testData = buttonTestSpace.GoodSettings.AnimatedSetting.caseStringAndOneChild;
  const animated = testData.settings.animated;

  const inputs = [
    { [EVENT_SOURCE1]: { diagram: 'a-b-c|', values: eventSourcesTestValues } },
    { [EVENT_SOURCE2]: { diagram: '-A-B-C|', values: eventSourcesTestValues } },
    {
      ['DOM!' + SOME_SELECTOR + '@' + SOME_DOM_EVENT_NAME]: {
        diagram: 'x-y-z', values: DOMeventsTestValuesSomeSelector
      }
    },
  ];
  const classes = ['ui', 'button', animated ? 'animated ' + animated : ''].join(' ');
  const ATTRS = 'tabindex="0"';
  const testResults = {
    [DOM_SINK]: {
      outputs: [
        `<div class=\"${classes}\" ${ATTRS}><span>${DOM_SINK} ${SEP} a</span></div>`,
        `<div class=\"${classes}\" ${ATTRS}><span>${DOM_SINK} ${SEP} b</span></div>`,
        `<div class=\"${classes}\" ${ATTRS}><span>${DOM_SINK} ${SEP} c</span></div>`,
      ],
      transform: convertVNodesToHTML,
      successMessage: `sink ${DOM_SINK} produces the expected values`,
      analyzeTestResults: analyzeTestResults(assert, done),
    },
    [NON_DOM_SINK]: {
      outputs: [
        `${SEP} ${NON_DOM_SINK}-A`,
        `${SEP} ${NON_DOM_SINK}-B`,
        `${SEP} ${NON_DOM_SINK}-C`,
      ],
      successMessage: `sink ${NON_DOM_SINK} produces the expected values`,
      analyzeTestResults: analyzeTestResults(assert, done),
    },
  };

  runTestScenario(inputs, testResults, makeButtonComponent(testData, { SEP: SEP }), {
    tickDuration: 5,
    waitForFinishDelay: 50,
    mocks: {
      DOM: makeMockDOMSource
    },
    sourceFactory: {
      ['DOM!' + SOME_SELECTOR + '@' + SOME_DOM_EVENT_NAME]: subjectFactory,
      ['DOM!' + SOME_SELECTOR + '@' + ANOTHER_DOM_EVENT_NAME]: subjectFactory,
    },
    errorHandler: function (err) {
      done(err)
    }
  });
});

// Settings = {label} - one
QUnit.test("Good settings : label", function exec_test(assert) {
  const done = assert.async(2);

  const testData = buttonTestSpace.GoodSettings.LabelSetting.caseTrueAndOneChild;
  const label = testData.settings.label;

  const inputs = [
    { [EVENT_SOURCE1]: { diagram: 'a-b-c|', values: eventSourcesTestValues } },
    { [EVENT_SOURCE2]: { diagram: '-A-B-C|', values: eventSourcesTestValues } },
    {
      ['DOM!' + SOME_SELECTOR + '@' + SOME_DOM_EVENT_NAME]: {
        diagram: 'x-y-z', values: DOMeventsTestValuesSomeSelector
      }
    },
  ];
  const classes = ['ui', 'button', label ? `labeled ${label.position}` : ''].join(' ');
  const ATTRS = 'tabindex="0"';
  const testResults = {
    [DOM_SINK]: {
      outputs: [
        `<div class=\"${classes}\" ${ATTRS}><span>${DOM_SINK} ${SEP} a</span></div>`,
        `<div class=\"${classes}\" ${ATTRS}><span>${DOM_SINK} ${SEP} b</span></div>`,
        `<div class=\"${classes}\" ${ATTRS}><span>${DOM_SINK} ${SEP} c</span></div>`,
      ],
      transform: convertVNodesToHTML,
      successMessage: `sink ${DOM_SINK} produces the expected values`,
      analyzeTestResults: analyzeTestResults(assert, done),
    },
    [NON_DOM_SINK]: {
      outputs: [
        `${SEP} ${NON_DOM_SINK}-A`,
        `${SEP} ${NON_DOM_SINK}-B`,
        `${SEP} ${NON_DOM_SINK}-C`,
      ],
      successMessage: `sink ${NON_DOM_SINK} produces the expected values`,
      analyzeTestResults: analyzeTestResults(assert, done),
    },
  };

  runTestScenario(inputs, testResults, makeButtonComponent(testData, { SEP: SEP }), {
    tickDuration: 5,
    waitForFinishDelay: 50,
    mocks: {
      DOM: makeMockDOMSource
    },
    sourceFactory: {
      ['DOM!' + SOME_SELECTOR + '@' + SOME_DOM_EVENT_NAME]: subjectFactory,
      ['DOM!' + SOME_SELECTOR + '@' + ANOTHER_DOM_EVENT_NAME]: subjectFactory,
    },
    errorHandler: function (err) {
      done(err)
    }
  });
});

// Settings = {icon} - one
QUnit.test("Good settings : icon", function exec_test(assert) {
  const done = assert.async(2);

  const testData = buttonTestSpace.GoodSettings.IconSetting.caseTrueAndOneChild;

  const inputs = [
    { [EVENT_SOURCE1]: { diagram: 'a-b-c|', values: eventSourcesTestValues } },
    { [EVENT_SOURCE2]: { diagram: '-A-B-C|', values: eventSourcesTestValues } },
    {
      ['DOM!' + SOME_SELECTOR + '@' + SOME_DOM_EVENT_NAME]: {
        diagram: 'x-y-z', values: DOMeventsTestValuesSomeSelector
      }
    },
  ];
  const classes = ['ui', 'button', testData.settings.icon ? 'icon' : ''].join(' ');
  const ATTRS = 'tabindex="0"';
  const testResults = {
    [DOM_SINK]: {
      outputs: [
        `<div class=\"${classes}\" ${ATTRS}><span>${DOM_SINK} ${SEP} a</span></div>`,
        `<div class=\"${classes}\" ${ATTRS}><span>${DOM_SINK} ${SEP} b</span></div>`,
        `<div class=\"${classes}\" ${ATTRS}><span>${DOM_SINK} ${SEP} c</span></div>`,
      ],
      transform: convertVNodesToHTML,
      successMessage: `sink ${DOM_SINK} produces the expected values`,
      analyzeTestResults: analyzeTestResults(assert, done),
    },
    [NON_DOM_SINK]: {
      outputs: [
        `${SEP} ${NON_DOM_SINK}-A`,
        `${SEP} ${NON_DOM_SINK}-B`,
        `${SEP} ${NON_DOM_SINK}-C`,
      ],
      successMessage: `sink ${NON_DOM_SINK} produces the expected values`,
      analyzeTestResults: analyzeTestResults(assert, done),
    },
  };

  runTestScenario(inputs, testResults, makeButtonComponent(testData, { SEP: SEP }), {
    tickDuration: 5,
    waitForFinishDelay: 50,
    mocks: {
      DOM: makeMockDOMSource
    },
    sourceFactory: {
      ['DOM!' + SOME_SELECTOR + '@' + SOME_DOM_EVENT_NAME]: subjectFactory,
      ['DOM!' + SOME_SELECTOR + '@' + ANOTHER_DOM_EVENT_NAME]: subjectFactory,
    },
    errorHandler: function (err) {
      done(err)
    }
  });
});

// Settings = {visualState} - one
QUnit.test("Good settings : visualState", function exec_test(assert) {
  const done = assert.async(2);

  const testData = buttonTestSpace.GoodSettings.VisualStateSetting.caseActiveAndOneChild;
  const visualState = testData.settings.visualState;

  const inputs = [
    { [EVENT_SOURCE1]: { diagram: 'a-b-c|', values: eventSourcesTestValues } },
    { [EVENT_SOURCE2]: { diagram: '-A-B-C|', values: eventSourcesTestValues } },
    {
      ['DOM!' + SOME_SELECTOR + '@' + SOME_DOM_EVENT_NAME]: {
        diagram: 'x-y-z', values: DOMeventsTestValuesSomeSelector
      }
    },
  ];
  const classes = ['ui', 'button', visualState ? visualState : ''].join(' ');
  const ATTRS = 'tabindex="0"';
  const testResults = {
    [DOM_SINK]: {
      outputs: [
        `<div class=\"${classes}\" ${ATTRS}><span>${DOM_SINK} ${SEP} a</span></div>`,
        `<div class=\"${classes}\" ${ATTRS}><span>${DOM_SINK} ${SEP} b</span></div>`,
        `<div class=\"${classes}\" ${ATTRS}><span>${DOM_SINK} ${SEP} c</span></div>`,
      ],
      transform: convertVNodesToHTML,
      successMessage: `sink ${DOM_SINK} produces the expected values`,
      analyzeTestResults: analyzeTestResults(assert, done),
    },
    [NON_DOM_SINK]: {
      outputs: [
        `${SEP} ${NON_DOM_SINK}-A`,
        `${SEP} ${NON_DOM_SINK}-B`,
        `${SEP} ${NON_DOM_SINK}-C`,
      ],
      successMessage: `sink ${NON_DOM_SINK} produces the expected values`,
      analyzeTestResults: analyzeTestResults(assert, done),
    },
  };

  runTestScenario(inputs, testResults, makeButtonComponent(testData, { SEP: SEP }), {
    tickDuration: 5,
    waitForFinishDelay: 50,
    mocks: {
      DOM: makeMockDOMSource
    },
    sourceFactory: {
      ['DOM!' + SOME_SELECTOR + '@' + SOME_DOM_EVENT_NAME]: subjectFactory,
      ['DOM!' + SOME_SELECTOR + '@' + ANOTHER_DOM_EVENT_NAME]: subjectFactory,
    },
    errorHandler: function (err) {
      done(err)
    }
  });
});

// Settings = {social} - one
QUnit.test("Good settings : social", function exec_test(assert) {
  const done = assert.async(2);

  const testData = buttonTestSpace.GoodSettings.SocialSetting.caseFacebookAndOneChild;
  const social = testData.settings.social;

  const inputs = [
    { [EVENT_SOURCE1]: { diagram: 'a-b-c|', values: eventSourcesTestValues } },
    { [EVENT_SOURCE2]: { diagram: '-A-B-C|', values: eventSourcesTestValues } },
    {
      ['DOM!' + SOME_SELECTOR + '@' + SOME_DOM_EVENT_NAME]: {
        diagram: 'x-y-z', values: DOMeventsTestValuesSomeSelector
      }
    },
  ];
  const classes = ['ui', 'button', social ? social : ''].join(' ');
  const ATTRS = 'tabindex="0"';
  const testResults = {
    [DOM_SINK]: {
      outputs: [
        `<div class=\"${classes}\" ${ATTRS}><span>${DOM_SINK} ${SEP} a</span></div>`,
        `<div class=\"${classes}\" ${ATTRS}><span>${DOM_SINK} ${SEP} b</span></div>`,
        `<div class=\"${classes}\" ${ATTRS}><span>${DOM_SINK} ${SEP} c</span></div>`,
      ],
      transform: convertVNodesToHTML,
      successMessage: `sink ${DOM_SINK} produces the expected values`,
      analyzeTestResults: analyzeTestResults(assert, done),
    },
    [NON_DOM_SINK]: {
      outputs: [
        `${SEP} ${NON_DOM_SINK}-A`,
        `${SEP} ${NON_DOM_SINK}-B`,
        `${SEP} ${NON_DOM_SINK}-C`,
      ],
      successMessage: `sink ${NON_DOM_SINK} produces the expected values`,
      analyzeTestResults: analyzeTestResults(assert, done),
    },
  };

  runTestScenario(inputs, testResults, makeButtonComponent(testData, { SEP: SEP }), {
    tickDuration: 5,
    waitForFinishDelay: 50,
    mocks: {
      DOM: makeMockDOMSource
    },
    sourceFactory: {
      ['DOM!' + SOME_SELECTOR + '@' + SOME_DOM_EVENT_NAME]: subjectFactory,
      ['DOM!' + SOME_SELECTOR + '@' + ANOTHER_DOM_EVENT_NAME]: subjectFactory,
    },
    errorHandler: function (err) {
      done(err)
    }
  });
});

// Settings = {size} - one
QUnit.test("Good settings : size", function exec_test(assert) {
  const done = assert.async(2);

  const testData = buttonTestSpace.GoodSettings.SizeSetting.caseMassiveAndOneChild;
  const size = testData.settings.size;

  const inputs = [
    { [EVENT_SOURCE1]: { diagram: 'a-b-c|', values: eventSourcesTestValues } },
    { [EVENT_SOURCE2]: { diagram: '-A-B-C|', values: eventSourcesTestValues } },
    {
      ['DOM!' + SOME_SELECTOR + '@' + SOME_DOM_EVENT_NAME]: {
        diagram: 'x-y-z', values: DOMeventsTestValuesSomeSelector
      }
    },
  ];
  const classes = ['ui', 'button', size ? size : ''].join(' ');
  const ATTRS = 'tabindex="0"';
  const testResults = {
    [DOM_SINK]: {
      outputs: [
        `<div class=\"${classes}\" ${ATTRS}><span>${DOM_SINK} ${SEP} a</span></div>`,
        `<div class=\"${classes}\" ${ATTRS}><span>${DOM_SINK} ${SEP} b</span></div>`,
        `<div class=\"${classes}\" ${ATTRS}><span>${DOM_SINK} ${SEP} c</span></div>`,
      ],
      transform: convertVNodesToHTML,
      successMessage: `sink ${DOM_SINK} produces the expected values`,
      analyzeTestResults: analyzeTestResults(assert, done),
    },
    [NON_DOM_SINK]: {
      outputs: [
        `${SEP} ${NON_DOM_SINK}-A`,
        `${SEP} ${NON_DOM_SINK}-B`,
        `${SEP} ${NON_DOM_SINK}-C`,
      ],
      successMessage: `sink ${NON_DOM_SINK} produces the expected values`,
      analyzeTestResults: analyzeTestResults(assert, done),
    },
  };

  runTestScenario(inputs, testResults, makeButtonComponent(testData, { SEP: SEP }), {
    tickDuration: 5,
    waitForFinishDelay: 50,
    mocks: {
      DOM: makeMockDOMSource
    },
    sourceFactory: {
      ['DOM!' + SOME_SELECTOR + '@' + SOME_DOM_EVENT_NAME]: subjectFactory,
      ['DOM!' + SOME_SELECTOR + '@' + ANOTHER_DOM_EVENT_NAME]: subjectFactory,
    },
    errorHandler: function (err) {
      done(err)
    }
  });
});

// Settings = {shape} - one
QUnit.test("Good settings : shape", function exec_test(assert) {
  const done = assert.async(2);

  const testData = buttonTestSpace.GoodSettings.ShapeSetting.caseCircularAndOneChild;
  const shape = testData.settings.shape;

  const inputs = [
    { [EVENT_SOURCE1]: { diagram: 'a-b-c|', values: eventSourcesTestValues } },
    { [EVENT_SOURCE2]: { diagram: '-A-B-C|', values: eventSourcesTestValues } },
    {
      ['DOM!' + SOME_SELECTOR + '@' + SOME_DOM_EVENT_NAME]: {
        diagram: 'x-y-z', values: DOMeventsTestValuesSomeSelector
      }
    },
  ];
  const classes = ['ui', 'button', shape ? shape : ''].join(' ');
  const ATTRS = 'tabindex="0"';
  const testResults = {
    [DOM_SINK]: {
      outputs: [
        `<div class=\"${classes}\" ${ATTRS}><span>${DOM_SINK} ${SEP} a</span></div>`,
        `<div class=\"${classes}\" ${ATTRS}><span>${DOM_SINK} ${SEP} b</span></div>`,
        `<div class=\"${classes}\" ${ATTRS}><span>${DOM_SINK} ${SEP} c</span></div>`,
      ],
      transform: convertVNodesToHTML,
      successMessage: `sink ${DOM_SINK} produces the expected values`,
      analyzeTestResults: analyzeTestResults(assert, done),
    },
    [NON_DOM_SINK]: {
      outputs: [
        `${SEP} ${NON_DOM_SINK}-A`,
        `${SEP} ${NON_DOM_SINK}-B`,
        `${SEP} ${NON_DOM_SINK}-C`,
      ],
      successMessage: `sink ${NON_DOM_SINK} produces the expected values`,
      analyzeTestResults: analyzeTestResults(assert, done),
    },
  };

  runTestScenario(inputs, testResults, makeButtonComponent(testData, { SEP: SEP }), {
    tickDuration: 5,
    waitForFinishDelay: 50,
    mocks: {
      DOM: makeMockDOMSource
    },
    sourceFactory: {
      ['DOM!' + SOME_SELECTOR + '@' + SOME_DOM_EVENT_NAME]: subjectFactory,
      ['DOM!' + SOME_SELECTOR + '@' + ANOTHER_DOM_EVENT_NAME]: subjectFactory,
    },
    errorHandler: function (err) {
      done(err)
    }
  });
});

// Settings = {layout} - one
QUnit.test("Good settings : layout", function exec_test(assert) {
  const done = assert.async(2);

  const testData = buttonTestSpace.GoodSettings.LayoutSetting.caseTopAttachedAndOneChild;
  const layout = testData.settings.layout;

  const inputs = [
    { [EVENT_SOURCE1]: { diagram: 'a-b-c|', values: eventSourcesTestValues } },
    { [EVENT_SOURCE2]: { diagram: '-A-B-C|', values: eventSourcesTestValues } },
    {
      ['DOM!' + SOME_SELECTOR + '@' + SOME_DOM_EVENT_NAME]: {
        diagram: 'x-y-z', values: DOMeventsTestValuesSomeSelector
      }
    },
  ];
  const classes = ['ui', 'button', layout ? layout : ''].join(' ');
  const ATTRS = 'tabindex="0"';
  const testResults = {
    [DOM_SINK]: {
      outputs: [
        `<div class=\"${classes}\" ${ATTRS}><span>${DOM_SINK} ${SEP} a</span></div>`,
        `<div class=\"${classes}\" ${ATTRS}><span>${DOM_SINK} ${SEP} b</span></div>`,
        `<div class=\"${classes}\" ${ATTRS}><span>${DOM_SINK} ${SEP} c</span></div>`,
      ],
      transform: convertVNodesToHTML,
      successMessage: `sink ${DOM_SINK} produces the expected values`,
      analyzeTestResults: analyzeTestResults(assert, done),
    },
    [NON_DOM_SINK]: {
      outputs: [
        `${SEP} ${NON_DOM_SINK}-A`,
        `${SEP} ${NON_DOM_SINK}-B`,
        `${SEP} ${NON_DOM_SINK}-C`,
      ],
      successMessage: `sink ${NON_DOM_SINK} produces the expected values`,
      analyzeTestResults: analyzeTestResults(assert, done),
    },
  };

  runTestScenario(inputs, testResults, makeButtonComponent(testData, { SEP: SEP }), {
    tickDuration: 5,
    waitForFinishDelay: 50,
    mocks: {
      DOM: makeMockDOMSource
    },
    sourceFactory: {
      ['DOM!' + SOME_SELECTOR + '@' + SOME_DOM_EVENT_NAME]: subjectFactory,
      ['DOM!' + SOME_SELECTOR + '@' + ANOTHER_DOM_EVENT_NAME]: subjectFactory,
    },
    errorHandler: function (err) {
      done(err)
    }
  });
});

// Settings = {listenOn} - one
// Settings = {listenTo} - one
QUnit.test("Good settings : listenTo, listenOn", function exec_test(assert) {
  const done = assert.async(4);

  const testData = buttonTestSpace.GoodSettings.ListenToSetting.caseClickAndOneChild;
  const listenTo = testData.settings.listenTo;
  const listenOn = testData.settings.listenOn;

  const inputs = [
    { [EVENT_SOURCE1]: { diagram: 'a-b-c|', values: eventSourcesTestValues } },
    { [EVENT_SOURCE2]: { diagram: '-A-B-C|', values: eventSourcesTestValues } },
    {
      [`DOM!${SOME_SELECTOR}@${SOME_DOM_EVENT_NAME}`]: {
        diagram: 'x-y-z', values: DOMeventsTestValuesSomeSelector
      }
    },
    {
      [`DOM!${SOME_SELECTOR}@${ANOTHER_DOM_EVENT_NAME}`]: {
        diagram: '-x-y-z', values: DOMeventsTestValuesSomeSelector
      }
    },
  ];
  const classes = ['ui', 'button'].join(' ');
  const ATTRS = 'tabindex="0"';
  const testResults = {
    [DOM_SINK]: {
      outputs: [
        `<div class=\"${classes}\" ${ATTRS}><span>${DOM_SINK} ${SEP} a</span></div>`,
        `<div class=\"${classes}\" ${ATTRS}><span>${DOM_SINK} ${SEP} b</span></div>`,
        `<div class=\"${classes}\" ${ATTRS}><span>${DOM_SINK} ${SEP} c</span></div>`,
      ],
      transform: convertVNodesToHTML,
      successMessage: `sink ${DOM_SINK} produces the expected values`,
      analyzeTestResults: analyzeTestResults(assert, done),
    },
    [NON_DOM_SINK]: {
      outputs: [
        `${SEP} ${NON_DOM_SINK}-A`,
        `${SEP} ${NON_DOM_SINK}-B`,
        `${SEP} ${NON_DOM_SINK}-C`,
      ],
      successMessage: `sink ${NON_DOM_SINK} produces the expected values`,
      analyzeTestResults: analyzeTestResults(assert, done),
    },
    [SOME_DOM_EVENT_NAME]: {
      outputs: values(DOMeventsTestValuesSomeSelector),
      successMessage: `sink ${SOME_DOM_EVENT_NAME} produces the expected values`,
      analyzeTestResults: analyzeTestResults(assert, done),
    },
    [ANOTHER_DOM_EVENT_NAME]: {
      outputs: values(DOMeventsTestValuesSomeSelector),
      successMessage: `sink ${ANOTHER_DOM_EVENT_NAME} produces the expected values`,
      analyzeTestResults: analyzeTestResults(assert, done),
    },
  };

  runTestScenario(inputs, testResults, makeButtonComponent(testData, { SEP: SEP }), {
    tickDuration: 5,
    waitForFinishDelay: 50,
    mocks: {
      DOM: makeMockDOMSource
    },
    sourceFactory: {
      ['DOM!' + SOME_SELECTOR + '@' + SOME_DOM_EVENT_NAME]: subjectFactory,
      ['DOM!' + SOME_SELECTOR + '@' + ANOTHER_DOM_EVENT_NAME]: subjectFactory,
    },
    errorHandler: function (err) {
      done(err)
    }
  });
});
