// let Qunit = require('qunitjs');
import * as QUnit from 'qunitjs';
import { always, clone, flatten } from 'ramda';
import * as Rx from 'rx';
import h from 'snabbdom/h';
import { div } from 'cycle-snabbdom';
import {
  getSlotHoles, m, mergeChildrenIntoParentDOM, rankChildrenBySlot
} from '../src/components/m/m';
import { makeDivVNode, projectSinksOn } from "../utils/helpers/src/index"
import { runTestScenario } from '../utils/testing/src/runTestScenario';

let $ = Rx.Observable;


// Fixtures
const PROVIDERS = {
  google: 'google',
  facebook: 'facebook',
};

QUnit.module("Testing m(component_def, settings, children)", {});

// NOTE
// skipping more edge cases where arguments are of the wrong type
// there are too many of them and they do not add so much value
// As much as possible, the helper is written so it fails early with a
// reasonably descriptive error message when it detects invalid arguments
QUnit.test("edge cases - no arguments", function exec_test(assert) {
  assert.throws(function () {
      m()
    }, /fails/,
    'it throws an exception if it is called with an invalid ' +
    'combination of arguments')

});

// NOTE
// skipping also a number of main cases corresponding to combination of inputs
// which are deem to be tested
// Inputs : component_def x settings x children
// - component_def: 7 classes of values for properties
// - settings: two classes of values (null, {...})
// - children: three classes of values ([], [component], [component, component])
// That makes for 7x2x3 = 42 tests
// We assume that those inputs are 'independent', so the number of cases
// gets down to 7 + 2 + 3 = 12
// We assume that case children : [component, component] takes care of [component]
// and we test several conditions in the same test case
// which brings down the number of tests to 4
QUnit.test(
  "main cases - only children components",
  function exec_test(assert) {
    let done = assert.async(4);

    // Test case 2
    // 2 children: [component (sink DOM, a, c), component(sink DOM, a, d)], settings : {...}, no
    // component_def, no local sources + sources : DOM, a, b, c, d, e + output.sinks = children
    // component sinks merged with default values of the component_def + i.e. sinkNames = [DOM,
    // auth, route, queue], DOM is merged with default, auth is merged with both, queue, route
    // merged with 1 + settings are taken into account (have all of the sinks depend on settings
    // differently)
    const testSettings = { main: 'parent settings' };

    const childComponent1 = function childComponent1(sources, settings) {
      return {
        DOM: $.combineLatest(sources.a, user => h('div', {}, [
          h('span', { style: { fontWeight: 'bold' } }, settings.main),
        ])),
        a: sources.b.map(x => 'child1-a-' + x),
        c: sources.c.map(x => 'child1-c-' + x),
      }
    };
    const childComponent2 = function childComponent1(sources, settings) {
      return {
        DOM: $.combineLatest(sources.a, user => h('div', {}, [
          h('span', { style: { fontWeight: 'italic' } }, settings.local),
        ])),
        a: sources.d.map(x => 'child2-a-' + x),
        d: sources.e.map(x => 'child2-e-' + x),
      }
    };

    const mComponent = m({
      makeLocalSettings: settings => ({ local: 'local setting' }),
    }, testSettings, [childComponent1, childComponent2])

    const inputs = [
      { a: { diagram: 'ab|', values: { a: 'a-0', b: 'a-1' } } },
      { b: { diagram: 'abc|', values: { a: 'b-0', b: 'b-1', c: 'b-2' } } },
      { c: { diagram: 'abc|', values: { a: 'c-0', b: 'c-1', c: 'c-2' } } },
      { d: { diagram: 'a-b|', values: { a: 'd-0', b: 'd-2' } } },
      { e: { diagram: 'a|', values: { a: 'e-0' } } }
    ];

    const vNodes = [
      // 1
      div([
        h('div', {}, [
          h('span', { style: { fontWeight: 'bold' } }, testSettings.main),
        ]),
        h('div', {}, [
          h('span', { style: { fontWeight: 'italic' } }, 'local setting'),
        ]),
      ]),
      // 2
      div([
        h('div', {}, [
          h('span', { style: { fontWeight: 'bold' } }, testSettings.main),
        ]),
        h('div', {}, [
          h('span', { style: { fontWeight: 'italic' } }, 'local setting'),
        ]),
      ]),// 3
      div([
        h('div', {}, [
          h('span', { style: { fontWeight: 'bold' } }, testSettings.main),
        ]),
        h('div', {}, [
          h('span', { style: { fontWeight: 'italic' } }, 'local setting'),
        ]),
      ]),
    ];

    function analyzeTestResults(actual, expected, message) {
      assert.deepEqual(actual, expected, message);
      done()
    }

    /** @type TestResults */
    const testResults = {
      DOM: {
        outputs: vNodes,
        successMessage: 'sink DOM produces the expected values',
        analyzeTestResults: analyzeTestResults,
        transformFn: undefined,
      },
      a: {
        outputs: [
          "child1-a-b-0",
          "child2-a-d-0",
          "child1-a-b-1",
          "child1-a-b-2",
          "child2-a-d-2"
        ],
        successMessage: 'sink a produces the expected values',
        analyzeTestResults: analyzeTestResults,
      },
      c: {
        outputs: ["child1-c-c-0", "child1-c-c-1", "child1-c-c-2"],
        successMessage: 'sink c produces the expected values',
        analyzeTestResults: analyzeTestResults,
        transformFn: undefined,
      },
      d: {
        outputs: ["child2-e-e-0"],
        successMessage: 'sink d produces the expected values',
        analyzeTestResults: analyzeTestResults,
        transformFn: undefined,
      },
    };

    const testFn = mComponent;

    runTestScenario(inputs, testResults, testFn, {
      tickDuration: 5,
      waitForFinishDelay: 10
    })

  });

QUnit.test("main cases - parent - no children", function exec_test(assert) {
  let done = assert.async(5);

  // Test input 4
  // No children, settings : ?, full component def(sink DOM, auth,
  //   queue, extra source user$) using the extra sources created
  const vNode = {
    "children": [
      {
        "children": undefined,
        "data": {
          "style": {
            "fontWeight": "bold"
          }
        },
        "elm": undefined,
        "key": undefined,
        "sel": "span",
        "text": "parent settings"
      },
      {
        "children": undefined,
        "data": undefined,
        "elm": undefined,
        "key": undefined,
        "sel": undefined,
        "text": " and this is local settings"
      },
      {
        "children": undefined,
        "data": {
          "style": {
            "fontWeight": "italic"
          }
        },
        "elm": undefined,
        "key": undefined,
        "sel": "span",
        "text": "local setting"
      }
    ],
    "data": {},
    "elm": undefined,
    "key": undefined,
    "sel": "div#container.two.classes",
    "text": undefined
  };

  const testSettings = { key: 'parent settings' };
  const ParentComponent = function (sources, settings) {
    return {
      DOM: $.combineLatest(sources.user$, user => h('div#container.two.classes', {}, [
        h('span', { style: { fontWeight: 'bold' } }, user.key),
        ' and this is local settings',
        h('span', { style: { fontWeight: 'italic' } }, settings.localSetting),
      ])),
      auth$: sources.auth$.startWith(PROVIDERS.google),
    }
  }

  const mComponent = m({
    makeLocalSources: (sources, settings) => {
      return {
        user$: $.of(settings),
      }
    },
    makeLocalSettings: settings => ({ localSetting: 'local setting' }),
    mergeSinks: (parentSinks, childrenSinks, settings) => ({
      DOM: parentSinks.DOM,
      auth$: parentSinks.auth$,
      user$: parentSinks.user$,
      childrenSinks$: $.of(childrenSinks),
      settings$: $.of(settings),
    }),
    checkPostConditions: function checkMSinksContracts() {
      return true
    }
  }, null, [ParentComponent, []]);

  const inputs = [
    { auth$: { diagram: '-a|', values: { a: PROVIDERS.facebook } } },
  ];


  function analyzeTestResults(actual, expected, message) {
    assert.deepEqual(actual, expected, message);
    done();
  }

  /** @type TestResults */
  const testResults = {
    DOM: {
      outputs: [vNode],
      successMessage: 'sink DOM produces the expected values',
      analyzeTestResults: analyzeTestResults,
      transformFn: undefined,
    },
    auth$: {
      outputs: ['google', 'facebook'],
      successMessage: 'sink auth produces the expected values',
      analyzeTestResults: analyzeTestResults,
    },
    user$: {
      outputs: [],
      successMessage: 'sink user produces the expected values',
      analyzeTestResults: analyzeTestResults,
      transformFn: undefined,
    },
    childrenSinks$: {
      outputs: [[]],
      successMessage: 'sink childrenSinks produces the expected values',
      analyzeTestResults: analyzeTestResults,
      transformFn: undefined,
    },
    settings$: {
      outputs: [{
        "key": "parent settings",
        "localSetting": "local setting"
      }],
      successMessage: 'sink settings produces the expected values',
      analyzeTestResults: analyzeTestResults,
      transformFn: undefined,
    },
  };

  const testFn = function mComponentTestFn(settings) {
    return function _mComponentTestFn(sources) {
      return mComponent(sources, settings)
    }
  };

  runTestScenario(inputs, testResults, testFn(testSettings), {
    tickDuration: 5,
    waitForFinishDelay: 10
  })
});

QUnit.test(
  "main cases - children components and parent component - default merge",
  function exec_test(assert) {
    let done = assert.async(5);

    // Test case 4
    // 4 children: [component, component], settings : {...}, full component def (DOM, queue, auth,
    // action)
    const testSettings = null;

    const childComponent1 = function childComponent1(sources, settings) {
      return {
        DOM: $.combineLatest(sources.a, a => h('div', {}, [
          h('span', { style: { fontWeight: 'bold' } }, 'child1-' + a),
        ])),
        a: sources.b.map(x => 'child1-a-' + x),
        c: sources.c.map(x => 'child1-c-' + x),
      }
    };
    const childComponent2 = function childComponent2(sources, settings) {
      return {
        DOM: $.combineLatest(sources.a, a => h('div', {}, [
          h('span', { style: { fontWeight: 'italic' } }, 'child2-' + a),
        ])),
        a: sources.d.map(x => 'child2-a-' + x),
        d: sources.e.map(x => 'child2-e-' + x),
      }
    };
    const ParentComponent = function (sources, settings) {
      return {
        DOM: $.of(div('.parent')),
        auth$: sources.auth$.startWith(PROVIDERS.google),
      }
    }

    const mComponent = m({
      makeLocalSources: (sources, settings) => {
        return {
          user$: $.of(settings),
        }
      },
      checkPostConditions: function checkMSinksContracts() {
        return true
      }
    }, testSettings, [ParentComponent, [childComponent1, childComponent2]]);

    const vNodes = [
      div('.parent', [
        h('div', {}, [
          h('span', { style: { fontWeight: 'bold' } }, 'child1-a-0'),
        ]),
        h('div', {}, [
          h('span', { style: { fontWeight: 'italic' } }, 'child2-a-0'),
        ]),
      ]),
      div('.parent', [
        h('div', {}, [
          h('span', { style: { fontWeight: 'bold' } }, 'child1-a-1'),
        ]),
        h('div', {}, [
          h('span', { style: { fontWeight: 'italic' } }, 'child2-a-0'),
        ]),
      ]),
      div('.parent', [
        h('div', {}, [
          h('span', { style: { fontWeight: 'bold' } }, 'child1-a-1'),
        ]),
        h('div', {}, [
          h('span', { style: { fontWeight: 'italic' } }, 'child2-a-1'),
        ]),
      ]),
    ];

    function analyzeTestResults(actual, expected, message) {
      assert.deepEqual(actual, expected, message);
      done()
    }

    const inputs = [
      { auth$: { diagram: 'a|', values: { a: 'auth-0' } } },
      { a: { diagram: 'ab|', values: { a: 'a-0', b: 'a-1' } } },
      { b: { diagram: 'abc|', values: { a: 'b-0', b: 'b-1', c: 'b-2' } } },
      { c: { diagram: 'abc|', values: { a: 'c-0', b: 'c-1', c: 'c-2' } } },
      { d: { diagram: 'a-b|', values: { a: 'd-0', b: 'd-2' } } },
      { e: { diagram: 'a|', values: { a: 'e-0' } } },
    ];

    /** @type TestResults */
    const
      TestResults = {
        DOM: {
          outputs: vNodes,
          successMessage: 'sink DOM produces the expected values',
          analyzeTestResults: analyzeTestResults,
          transformFn: undefined,
        },
        auth$: {
          outputs: ["google", "auth-0"],
          successMessage: 'sink auth$ produces the expected values',
          analyzeTestResults: analyzeTestResults,
          transformFn: undefined,
        },
        a: {
          outputs: [
            "child1-a-b-0",
            "child2-a-d-0",
            "child1-a-b-1",
            "child1-a-b-2",
            "child2-a-d-2"
          ],
          successMessage: 'sink a produces the expected values',
          analyzeTestResults: analyzeTestResults,
        },
        c: {
          outputs: ["child1-c-c-0", "child1-c-c-1", "child1-c-c-2"],
          successMessage: 'sink c produces the expected values',
          analyzeTestResults: analyzeTestResults,
          transformFn: undefined,
        },
        d: {
          outputs: ["child2-e-e-0"],
          successMessage: 'sink d produces the expected values',
          analyzeTestResults: analyzeTestResults,
          transformFn: undefined,
        },
      };

    const testFn = mComponent;

    runTestScenario(inputs, TestResults, testFn, {
      tickDuration: 5,
      waitForFinishDelay: 10
    })

  });

QUnit.test(
  "main cases - children components and parent component - customized merge",
  function exec_test(assert) {
    let done = assert.async(5);

    const testSettings = null;

    const childComponent1 = function childComponent1(sources, settings) {
      return {
        DOM: $.combineLatest(sources.a, a => h('div', {}, [
          h('span', { style: { fontWeight: 'bold' } }, 'child1-' + a),
        ])),
        a: sources.b.map(x => 'child1-a-' + x),
        c: sources.c.map(x => 'child1-c-' + x),
      }
    };
    const childComponent2 = function childComponent1(sources, settings) {
      return {
        DOM: $.combineLatest(sources.a, a => h('div', {}, [
          h('span', { style: { fontWeight: 'italic' } }, 'child2-' + a),
        ])),
        a: sources.d.map(x => 'child2-a-' + x),
        d: sources.e.map(x => 'child2-e-' + x),
      }
    };
    const ParentComponent = function (sources, settings) {
      return {
        DOM: $.of(div('.parent')),
        auth$: sources.auth$.startWith(PROVIDERS.google),
      }
    };

    const mComponent = m({
      makeLocalSources: (sources, settings) => {
        return {
          user$: $.of(settings),
        }
      },
      mergeSinks: (parentSinks, childrenSinks, settings) => ({
        DOM: parentSinks.DOM,
        auth$: parentSinks.auth$,
        user$: parentSinks.user$,
        childrenSinks$: $.merge(projectSinksOn('DOM', childrenSinks)),
        settings$: $.of(settings),
      }),
      checkPostConditions: function checkMSinksContracts() {
        return true
      }

    }, testSettings, [ParentComponent, [childComponent1, childComponent2]]);

    const inputs = [
      { auth$: { diagram: 'a|', values: { a: 'auth-0' } } },
      { a: { diagram: 'ab|', values: { a: 'a-0', b: 'a-1' } } },
      { b: { diagram: 'abc|', values: { a: 'b-0', b: 'b-1', c: 'b-2' } } },
      { c: { diagram: 'abc|', values: { a: 'c-0', b: 'c-1', c: 'c-2' } } },
      { d: { diagram: 'a-b|', values: { a: 'd-0', b: 'd-2' } } },
      { e: { diagram: 'a|', values: { a: 'e-0' } } }
    ];

    const vNodes = [
      {
        "children": undefined,
        "data": {},
        "elm": undefined,
        "key": undefined,
        "sel": "div.parent",
        "text": undefined
      }
    ];

    function analyzeTestResults(actual, expected, message) {
      assert.deepEqual(actual, expected, message);
      done()
    }

    /** @type TestResults */
    const testResults = {
      DOM: {
        outputs: vNodes,
        successMessage: 'sink DOM produces the expected values',
        analyzeTestResults: analyzeTestResults,
        transformFn: undefined,
      },
      user$: {
        outputs: [],
        successMessage: 'sink user produces the expected values',
        analyzeTestResults: analyzeTestResults,
        transformFn: undefined,
      },
      childrenSinks$: {
        outputs: [
          h('div', {}, [
            h('span', { style: { fontWeight: 'bold' } }, 'child1-a-0'),
          ]),
          h('div', {}, [
            h('span', { style: { fontWeight: 'italic' } }, 'child2-a-0'),
          ]),
          h('div', {}, [
            h('span', { style: { fontWeight: 'bold' } }, 'child1-a-1'),
          ]),
          h('div', {}, [
            h('span', { style: { fontWeight: 'italic' } }, 'child2-a-1'),
          ]),
        ],
        successMessage: 'sink childrenSinks produces the expected values',
        analyzeTestResults: analyzeTestResults,
        transformFn: undefined,
      },
      settings$: {
        outputs: [{}], // When there is no settings, it sets settings to {}
        successMessage: 'sink settings produces the expected values',
        analyzeTestResults: analyzeTestResults,
        transformFn: undefined,
      },
      auth$: {
        outputs: ["google", "auth-0"],
        successMessage: 'sink auth$ produces the expected values',
        analyzeTestResults: analyzeTestResults,
        transformFn: undefined,
      },
      a: {
        outputs: [
          "child1-a-b-0",
          "child2-a-d-0",
          "child1-a-b-1",
          "child1-a-b-2",
          "child2-a-d-2"
        ],
        successMessage: 'sink a produces the expected values',
        analyzeTestResults: analyzeTestResults,
      },
      c: {
        outputs: ["child1-c-c-0", "child1-c-c-1", "child1-c-c-2"],
        successMessage: 'sink c produces the expected values',
        analyzeTestResults: analyzeTestResults,
        transformFn: undefined,
      },
      d: {
        outputs: ["child2-e-e-0"],
        successMessage: 'sink d produces the expected values',
        analyzeTestResults: analyzeTestResults,
        transformFn: undefined,
      },
    };

    const testFn = mComponent;

    runTestScenario(inputs, testResults, testFn, {
      tickDuration: 5,
      waitForFinishDelay: 10
    })

  });

QUnit.test(
  "main cases - great children components - default merge - settings",
  function exec_test(assert) {
    let done = assert.async(4);

    function childMakeOwnSinks(sources, settings) {
      return {
        DOM: sources.DOM1.map(makeDivVNode),
        childSettings$: sources.DOM1.map(always(settings))
      }
    }

    const child = {
      makeLocalSettings: function makeLocalSettings(settings) {
        return {
          childKey1: '.settingInMOverloaded'
        }
      }
    };

    function greatCMakeOwnSinks(sources, settings) {
      return {
        DOM: sources.DOM2.map(makeDivVNode),
        gCSettings$: sources.DOM2.map(always(settings))
      }
    }

    function parentMakeOwnSinks(sources, settings) {
      return {
        DOM: sources.DOMp.map(makeDivVNode),
        parentSettings$: sources.DOMp.map(always(settings))
      }
    }

    const component = m({}, {
        parentKey1: 'MOverloaded',
        parentKey2: 'settingInM',
        parentKey3: { parent: 1 }
      }, [
        parentMakeOwnSinks, [
          m(child, {
            childKey1: '.settingInM',
            parentKey2: 'parentSettingOverloadByChild',
            parentKey3: { child: 2 }
          }, [
            childMakeOwnSinks, [
              m({}, {
                greatChildKey: '..settingInM',
                parentKey3: { greatChild: 3 }
              }, [
                greatCMakeOwnSinks, []
              ])
            ]])
        ]]
    );

    const inputs = [
      { DOMp: { diagram: '-a---b--' } },
      { DOM1: { diagram: '-a--b--c--' } },
      { DOM2: { diagram: '-a-b-c-d-e-' } },
    ];

    function makeTestVNode(p, c, gc) {
      // p: parent, c: child, gc: greatchild
      return {
        "children": [
          {
            "children": [],
            "data": {},
            "elm": undefined,
            "key": undefined,
            "sel": undefined,
            "text": p
          },
          {
            "children": [
              {
                "children": [],
                "data": {},
                "elm": undefined,
                "key": undefined,
                "sel": undefined,
                "text": c
              },
              {
                "children": [],
                "data": {},
                "elm": undefined,
                "key": undefined,
                "sel": "div",
                "text": gc
              }
            ],
            "data": {},
            "elm": undefined,
            "key": undefined,
            "sel": "div",
            "text": undefined
          }
        ],
        "data": {},
        "elm": undefined,
        "key": undefined,
        "sel": "div",
        "text": undefined
      }
    }

    const vNodes = [
      makeTestVNode('a', 'a', 'a'),
      makeTestVNode('a', 'a', 'b'),
      makeTestVNode('a', 'b', 'b'),
      makeTestVNode('b', 'b', 'b'),
      makeTestVNode('b', 'b', 'c'),
      makeTestVNode('b', 'c', 'c'),
      makeTestVNode('b', 'c', 'd'),
      makeTestVNode('b', 'c', 'e'),
    ];

    function analyzeTestResults(actual, expected, message) {
      assert.deepEqual(actual, expected, message);
      done()
    }

    /** @type TestResults */
    const testResults = {
      DOM: {
        outputs: vNodes,
        successMessage: 'sink DOM produces the expected values',
        analyzeTestResults: analyzeTestResults,
        transformFn: undefined,
      },
      parentSettings$: {
        outputs: [
          {
            "parentKey1": "MOverloaded",
            "parentKey2": "settingInM",
            "parentKey3": {
              "parent": 1
            }
          },
          {
            "parentKey1": "MOverloaded",
            "parentKey2": "settingInM",
            "parentKey3": {
              "parent": 1
            }
          }
        ],
        successMessage: 'Component settings are the resulting merge of :\n' +
        '1. settings passed through `m` helper, \n' +
        '2. settings passed when calling the component which is a result of the `m` helper,\n' +
        '3. settings resulting from `makeLocalSettings`\n' +
        'in decreasing precedency order.',
        analyzeTestResults: analyzeTestResults,
        transformFn: undefined,
      },
      childSettings$: {
        outputs: [
          {
            "childKey1": ".settingInM",
            "parentKey1": "MOverloaded",
            "parentKey2": "parentSettingOverloadByChild",
            "parentKey3": {
              "child": 2,
              "parent": 1
            }
          },
          {
            "childKey1": ".settingInM",
            "parentKey1": "MOverloaded",
            "parentKey2": "parentSettingOverloadByChild",
            "parentKey3": {
              "child": 2,
              "parent": 1
            }
          },
          {
            "childKey1": ".settingInM",
            "parentKey1": "MOverloaded",
            "parentKey2": "parentSettingOverloadByChild",
            "parentKey3": {
              "child": 2,
              "parent": 1
            }
          }
        ],
        successMessage: 'Children settings are computed like any component ' +
        'settings, but also merge with the settings from the parent.\n' +
        ' In case of conflict with the parent, the children settings ' +
        'have higher precedency.',
        analyzeTestResults: analyzeTestResults,
        transformFn: undefined,
      },
      gCSettings$: {
        outputs: [
          {
            "childKey1": ".settingInM",
            "greatChildKey": "..settingInM",
            "parentKey1": "MOverloaded",
            "parentKey2": "parentSettingOverloadByChild",
            "parentKey3": {
              "child": 2,
              "greatChild": 3,
              "parent": 1
            }
          },
          {
            "childKey1": ".settingInM",
            "greatChildKey": "..settingInM",
            "parentKey1": "MOverloaded",
            "parentKey2": "parentSettingOverloadByChild",
            "parentKey3": {
              "child": 2,
              "greatChild": 3,
              "parent": 1
            }
          },
          {
            "childKey1": ".settingInM",
            "greatChildKey": "..settingInM",
            "parentKey1": "MOverloaded",
            "parentKey2": "parentSettingOverloadByChild",
            "parentKey3": {
              "child": 2,
              "greatChild": 3,
              "parent": 1
            }
          },
          {
            "childKey1": ".settingInM",
            "greatChildKey": "..settingInM",
            "parentKey1": "MOverloaded",
            "parentKey2": "parentSettingOverloadByChild",
            "parentKey3": {
              "child": 2,
              "greatChild": 3,
              "parent": 1
            }
          },
          {
            "childKey1": ".settingInM",
            "greatChildKey": "..settingInM",
            "parentKey1": "MOverloaded",
            "parentKey2": "parentSettingOverloadByChild",
            "parentKey3": {
              "child": 2,
              "greatChild": 3,
              "parent": 1
            }
          }
        ],
        successMessage: 'Each child has its own setting object, ' +
        'i.e settings are passed down the component tree by value, ' +
        'not by reference',
        analyzeTestResults: analyzeTestResults,
        transformFn: undefined,
      },
    };

    const testFn = function (sources, settings) {
      return component(sources, { parentKey1: 'settingOut' })
    };

    runTestScenario(inputs, testResults, testFn, {
      tickDuration: 5,
      waitForFinishDelay: 10
    })

  });

QUnit.module("Testing getSlotHoles(vNode) : Array.<{parent:Array, index:Number}>", {});

const A_SLOT = 'a slot';
const ANOTHER_SLOT = 'another slot';
const YET_ANOTHER_SLOT = 'yet another slot';
const YET_YET_ANOTHER_SLOT = 'yet yet another slot';
const A_SELECTOR = 'a_div_selector';
const ANOTHER_SELECTOR = 'another_div_selector';
const YET_ANOTHER_SELECTOR = 'yet_another_div_selector';
const YET_YET_ANOTHER_SELECTOR = 'yet_yet_another_div_selector';

const parentVNodeSlotAtRoot = {
  children: [],
  data: { slot: A_SLOT },
  elm: undefined,
  key: undefined,
  sel: A_SELECTOR,
  text: undefined
};
const childrenVNodeWithASlot = {
  children: [],
  data: { slot: A_SLOT },
  elm: undefined,
  key: undefined,
  sel: A_SELECTOR,
  text: undefined
};
const childrenVNodeWithAnotherSlot = {
  children: [],
  data: { slot: ANOTHER_SLOT },
  elm: undefined,
  key: undefined,
  sel: ANOTHER_SELECTOR,
  text: undefined
}
const childrenVNodeWithNoSlotAndNoChildren = {
  children: [],
  data: {},
  elm: undefined,
  key: undefined,
  sel: undefined,
  text: 'this is childrenVNodeWithNoSlotAndNoChildren'
}
const childrenVNodeWithNoSlotAndChildWithAnotherSlot = {
  children: [
    childrenVNodeWithNoSlotAndNoChildren,
    childrenVNodeWithAnotherSlot,
  ],
  data: {},
  elm: undefined,
  key: undefined,
  sel: ANOTHER_SELECTOR,
  text: undefined
}

function getVNodeWithOnlyText(text) {
  return {
    children: [],
    data: {},
    elm: undefined,
    key: undefined,
    sel: undefined,
    text: text
  }
}


function getVNodeWithUndefinedSlot(selector) {
  return {
    children: [],
    data: { slot: undefined },
    elm: undefined,
    key: undefined,
    sel: selector,
    text: undefined
  }
}

function getVNodeWithNoSlot(selector) {
  return {
    children: [],
    data: {},
    elm: undefined,
    key: undefined,
    sel: selector,
    text: undefined
  }
}

const PARENT_DOM_SINK_NOT_NULL = 'anything';
const ParentVNode_0_0_0 = getVNodeWithOnlyText('ParentVNode_0_0_0');
const ParentVNode_0_0_1 = {
  "children": [],
  "data": { slot: YET_YET_ANOTHER_SLOT },
  "elm": undefined,
  "key": undefined,
  "sel": YET_YET_ANOTHER_SELECTOR,
  "text": ""
};
const ParentVNode_0_0 = {
  "children": [ParentVNode_0_0_0, ParentVNode_0_0_1],
  "data": { slot: ANOTHER_SLOT },
  "elm": undefined,
  "key": undefined,
  "sel": ANOTHER_SELECTOR,
  "text": ""
};
const ParentVNode_0_1 = getVNodeWithOnlyText('ParentVNode_0_1');
const ParentVNode_0_2 = {
  "children": [],
  "data": { slot: YET_ANOTHER_SLOT },
  "elm": undefined,
  "key": undefined,
  "sel": ANOTHER_SELECTOR,
  "text": ""
};
const ParentVNode_0_3 = getVNodeWithUndefinedSlot(YET_ANOTHER_SELECTOR);
const ParentVNode_0 = {
  "children": [
    ParentVNode_0_0, ParentVNode_0_1, ParentVNode_0_2, ParentVNode_0_3
  ],
  "data": { slot: A_SLOT },
  "elm": undefined,
  "key": undefined,
  "sel": A_SELECTOR,
  "text": ""
};
const ParentVNode_0_default_slot = {
  "children": [
    ParentVNode_0_0, ParentVNode_0_1, ParentVNode_0_2
  ],
  "data": { slot: A_SLOT },
  "elm": undefined,
  "key": undefined,
  "sel": A_SELECTOR,
  "text": ""
};

const ChildVNode_0_0 = {
  "children": [],
  "data": { slot: ANOTHER_SLOT },
  "elm": undefined,
  "key": undefined,
  "sel": ANOTHER_SELECTOR + '.child',
  "text": "ChildVNode_0_0"
};
const ChildVNode_0 = {
  "children": [],
  "data": { slot: A_SLOT },
  "elm": undefined,
  "key": undefined,
  "sel": A_SELECTOR + '.child',
  "text": "ChildVNode_0"
};
// NOTE : these **MUST** be two diffrent objects, because the snabdom modifies these object in
// place and so do we.
const ChildWithNoSlotA = getVNodeWithNoSlot(A_SELECTOR + '.noslot.A');
const ChildWithNoSlotB = getVNodeWithNoSlot(A_SELECTOR + '.noslot.B');
const ChildWithNoSlotC = getVNodeWithNoSlot(A_SELECTOR + '.noslot.C');
const ChildVNode_0_0_1 = {
  "children": [],
  "data": { slot: YET_YET_ANOTHER_SLOT },
  "elm": undefined,
  "key": undefined,
  "sel": YET_YET_ANOTHER_SELECTOR + '.child',
  "text": "ChildVNode_0_0_1"
};
const ChildVNode_0_2 = {
  "children": [],
  "data": { slot: YET_ANOTHER_SLOT },
  "elm": undefined,
  "key": undefined,
  "sel": ANOTHER_SELECTOR + '.child',
  "text": "ChildVNode_0_2"
};

QUnit.test("main cases - parent slot hole at root level", function exec_test(assert) {
  assert.deepEqual(getSlotHoles(parentVNodeSlotAtRoot),
    [parentVNodeSlotAtRoot], `error`);
});
// TODO : rethink the whole logic to have slot with default content for if the slot is not
// found, that expands the test space...

QUnit.test(`main cases - holes at parent and children levels - 3 different slots - 1x1 + 1x2 + 1 content`,
  function exec_test(assert) {
    const parentVNodeSlotAt2ChildrenLevelsAndParentLevel = {
      children: [
        childrenVNodeWithASlot,
        childrenVNodeWithNoSlotAndNoChildren,
        childrenVNodeWithNoSlotAndChildWithAnotherSlot
      ],
      data: { slot: YET_ANOTHER_SLOT },
      elm: undefined,
      key: undefined,
      sel: A_SELECTOR,
      text: undefined
    }
    assert.deepEqual(getSlotHoles(parentVNodeSlotAt2ChildrenLevelsAndParentLevel),
      [
        parentVNodeSlotAt2ChildrenLevelsAndParentLevel,
        childrenVNodeWithASlot,
        childrenVNodeWithAnotherSlot,
      ],
      `error`);

  });

QUnit.test(`edge cases - parent slot hole at children level - 2 same slots - 1 + 1 content`,
  function exec_test(assert) {
    const testData = {
      children: [
        childrenVNodeWithASlot,
        childrenVNodeWithASlot,
      ],
      data: {},
      elm: undefined,
      key: undefined,
      sel: A_SELECTOR,
      text: undefined
    }
    assert.throws(function () {getSlotHoles(testData)},
      /getSlotHoles/, `Contract : slot name must correspond to a unique location!`);
  });

QUnit.test(`main cases - parent slot hole at children level - 2 different slots at same level - 1x2 + 1 content`,
  function exec_test(assert) {
    const testData = {
      children: [
        childrenVNodeWithASlot,
        childrenVNodeWithAnotherSlot,
      ],
      data: {},
      elm: undefined,
      key: undefined,
      sel: A_SELECTOR,
      text: undefined
    }
    assert.deepEqual(getSlotHoles(testData),
      [
        childrenVNodeWithASlot,
        childrenVNodeWithAnotherSlot,
      ],
      `error`);
  });

QUnit.module("Testing rankChildrenBySlot(childrenVNode) : Object.<string, Array.<VNode>>", {});

QUnit.test(`main cases - holes at parent and children levels - 3 different slots - 1x1 + 1x2 + 1 content`,
  function exec_test(assert) {
    const yetAnotherSlotChild1 = {
      children: [
        childrenVNodeWithASlot,
        childrenVNodeWithNoSlotAndNoChildren,
        childrenVNodeWithNoSlotAndChildWithAnotherSlot
      ],
      data: { slot: YET_ANOTHER_SLOT },
      elm: undefined,
      key: undefined,
      sel: A_SELECTOR,
      text: undefined
    };
    const yetAnotherSlotChild2 = {
      children: [
        childrenVNodeWithASlot,
        childrenVNodeWithNoSlotAndNoChildren,
      ],
      data: { slot: YET_ANOTHER_SLOT },
      elm: undefined,
      key: undefined,
      sel: A_SELECTOR,
      text: undefined
    };
    const aSlotChild = {
      children: [
        childrenVNodeWithNoSlotAndNoChildren,
        childrenVNodeWithNoSlotAndChildWithAnotherSlot
      ],
      data: { slot: A_SLOT },
      elm: undefined,
      key: undefined,
      sel: A_SELECTOR,
      text: undefined
    };
    const noSlotChild = {
      children: [
        childrenVNodeWithNoSlotAndNoChildren,
      ],
      data: {},
      elm: undefined,
      key: undefined,
      sel: A_SELECTOR,
      text: undefined
    };
    const testData = [yetAnotherSlotChild1, yetAnotherSlotChild2, aSlotChild, noSlotChild];
    assert.deepEqual(rankChildrenBySlot(testData),
      {
        [A_SLOT]: [aSlotChild],
        [YET_ANOTHER_SLOT]: [yetAnotherSlotChild1, yetAnotherSlotChild2],
        "undefined": [
          {
            "children": [
              {
                "children": [],
                "data": {},
                "elm": undefined,
                "key": undefined,
                "sel": undefined,
                "text": "this is childrenVNodeWithNoSlotAndNoChildren"
              }
            ],
            "data": {},
            "elm": undefined,
            "key": undefined,
            "sel": "a_div_selector",
            "text": undefined
          }
        ],
      },
      `error`);
  });

QUnit.module("Testing mergeChildrenIntoParentDOM(parentDOMSink)(arrayVNode) : VNode", {});

// Parent: 0a, 0.0b, 0.0.1c, 0.2d: slot ; 0.3: undefined ; 0.1, 0.0.0: no slot
// 1. Children: [b, -, a, c, d] // testing override, should only remain a,
// 2. Children: [-, -, b, c, d] // testing default and override, should remain b and d, - -
// in 0.3
// 3. Children: [-, -, -, c, d] // testing default, override deeper level, should remain
// 0.0.0, c and d
QUnit.test(`main cases - testing parent root slot (override) - undefined slot`,
  function exec_test(assert) {
    const childrenDOMs = [
      ChildVNode_0_0, ChildWithNoSlotA, ChildVNode_0, ChildVNode_0_0_1, ChildVNode_0_2
    ];
    const arrayVNode = flatten([ParentVNode_0, childrenDOMs]);

    let result = clone(ParentVNode_0);
    result.children = [clone(ChildVNode_0)];

    assert.deepEqual(mergeChildrenIntoParentDOM(PARENT_DOM_SINK_NOT_NULL)(arrayVNode),
      result,
      ``);
  });

QUnit.test(`main cases - testing default and override - undefined slot`,
  function exec_test(assert) {
    const childrenDOMs = [
      ChildWithNoSlotB, ChildWithNoSlotA, ChildVNode_0_0, ChildVNode_0_0_1, ChildVNode_0_2
    ];
    /*
        const childrenDOMs = [
          ChildWithNoSlotB, ChildWithNoSlotA, ChildWithNoSlotC, ChildVNode_0_0_1, ChildVNode_0_2
        ];
    */

    const arrayVNode = flatten([ParentVNode_0, childrenDOMs]);

    let result = clone(ParentVNode_0);
    result.children[0].children = [ChildVNode_0_0];
    result.children[2].children = [ChildVNode_0_2];
    result.children[3].children = [ChildWithNoSlotB, ChildWithNoSlotA];

    assert.deepEqual(mergeChildrenIntoParentDOM(PARENT_DOM_SINK_NOT_NULL)(arrayVNode),
      result,
      ``);
  });

QUnit.test(`main cases - testing default, and override deeper level - undefined slot`,
  function exec_test(assert) {
    const childrenDOMs = [
      ChildWithNoSlotB, ChildWithNoSlotA, ChildWithNoSlotC, ChildVNode_0_0_1, ChildVNode_0_2
    ];

    const arrayVNode = flatten([ParentVNode_0, childrenDOMs]);

    let result = clone(ParentVNode_0);
    result.children[0].children[1].children = [ChildVNode_0_0_1];
    result.children[2].children = [ChildVNode_0_2];
    result.children[3].children = [ChildWithNoSlotB, ChildWithNoSlotA, ChildWithNoSlotC];

    assert.deepEqual(mergeChildrenIntoParentDOM(PARENT_DOM_SINK_NOT_NULL)(arrayVNode),
      result,
      ``);
  });

// Same with Parent: 0, 0.0b, 0.0.1c, 0.2d: slot ; 0.1, 0.0.0: no slot
// 1. Children: [b, -, a, c, d] // testing override, should only remain a,
QUnit.test(`main cases - testing parent root slot (override) - default slot`,
  function exec_test(assert) {
    const childrenDOMs = [
      ChildVNode_0_0, ChildWithNoSlotA, ChildVNode_0, ChildVNode_0_0_1, ChildVNode_0_2
    ];
    const arrayVNode = flatten([ParentVNode_0_default_slot, childrenDOMs]);

    let result = clone(ParentVNode_0_default_slot);
    result.children = [ChildVNode_0];
    result.children.push(ChildWithNoSlotA);

    assert.deepEqual(mergeChildrenIntoParentDOM(PARENT_DOM_SINK_NOT_NULL)(arrayVNode),
      result,
      ``);
  });

// Same with Parent: 0, 0.0b, 0.0.1c, 0.2d: slot ; 0.1, 0.0.0: no slot
// 2. Children: [-, -, b, c, d] // testing default and override, should remain b and d, - -
QUnit.test(`main cases - testing default and override - default slot`,
  function exec_test(assert) {
    const childrenDOMs = [
      ChildWithNoSlotB, ChildWithNoSlotA, ChildVNode_0_0, ChildVNode_0_0_1, ChildVNode_0_2
    ];
    const arrayVNode = flatten([ParentVNode_0_default_slot, childrenDOMs]);

    let result = clone(ParentVNode_0_default_slot);
    result.children[0].children = [ChildVNode_0_0];
    result.children[2].children = [ChildVNode_0_2];
    result.children.push(ChildWithNoSlotB, ChildWithNoSlotA);

    assert.deepEqual(mergeChildrenIntoParentDOM(PARENT_DOM_SINK_NOT_NULL)(arrayVNode),
      result,
      ``);
  });

// Same with Parent: 0, 0.0b, 0.0.1c, 0.2d: slot ; 0.1, 0.0.0: no slot
// 3. Children: [-, -, -, c, d] // testing default, override deeper level, should remain
// 0.0.0, c and d
QUnit.test(`main cases - testing default, and override deeper level - default slot`,
  function exec_test(assert) {
    const childrenDOMs = [
      ChildWithNoSlotB, ChildWithNoSlotA, ChildWithNoSlotC, ChildVNode_0_0_1, ChildVNode_0_2
    ];

    const arrayVNode = flatten([ParentVNode_0_default_slot, childrenDOMs]);

    let result = clone(ParentVNode_0_default_slot);
    result.children[0].children[1].children = [ChildVNode_0_0_1];
    result.children[2].children = [ChildVNode_0_2];
    result.children.push(ChildWithNoSlotB, ChildWithNoSlotA, ChildWithNoSlotC);

    assert.deepEqual(mergeChildrenIntoParentDOM(PARENT_DOM_SINK_NOT_NULL)(arrayVNode),
      result,
      ``);
  });
