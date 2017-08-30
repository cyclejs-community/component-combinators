import * as QUnit from "qunitjs"
import * as Rx from 'rx'
import { h } from 'cycle-snabbdom'
import { runTestScenario } from '../src/runTestScenario'
import { convertVNodesToHTML, DOM_SINK, format } from '../src/utils'
import { pipe } from 'ramda'
import { ForEach } from "../src/components/ForEach/ForEach"
import { ListOf } from "../src/components/ListOf/ListOf"

const $ = Rx.Observable;

function analyzeTestResults(assert, done) {
  return function analyzeTestResults(actual, expected, message) {
    assert.deepEqual(actual, expected, message);
    done()
  }
}

QUnit.module("Testing ListOf component", {})

// ListOf({list : 'items', as : 'cardInfo', buildActionsFromChildrenSinks:...,
// actionsMap:{'clickIntent$':'router'}},}, [Component],

// Test plan
// Conditions under test
// check items is read correctly
// check children are passed the item as cardInfo and an index
// check that the merge is happenning correctly when buildActionsFromChildrenSinks  Y/N
// check behaviour with actionsMap, and without
// Test universe
// - buildActionsFromChildrenSinks (Y | N) x actionsMap (Y|N) x component (final | derived)
// reduced to, by independence hypothesis
// - buildActionsFromChildrenSinks (Y | N) + actionsMap (Y|N) + component (final | derived)
// Test cases
// - always three items
// - 2 cases enough : N + N + final ; Y + Y + derived, for instance

const item1 = 'ITEM1';
const item2 = 'ITEM2';
const item3 = 'ITEM3';

QUnit.test("main case - each child generates its actions unhinged", function exec_test(assert) {
  const done = assert.async(2);

  // TODO
  const childComponent = function childComponent1(sources, settings) {
    return {
      [DOM_SINK]: sources.DOM1
        .tap(console.warn.bind(console, `DOM for list component ${settings.listIndex}: `))
        .map(x => h('span', {}, `List Component ${settings.listIndex} : ${format(settings.item)} - ${x}`)),
      a: sources.userAction$.map(x => `Component ${settings.listIndex} - user action : ${x}`)
    }
  };

  const listOfComponent = ListOf({
    list: 'items',
    as: 'item',
    items : [item1, item2, item3],
    trace : 'listOfComponent'
  }, [
    childComponent,
  ]);

  const inputs = [
    { DOM1: { diagram: '-a--b--c-----------' } },
//    { DOM2: { diagram: '-a-b-c-d-e-f-abb-c-d' } },
    {
      userAction$: {
        diagram: 'abc-b-ac--ab---c',
        values: { a: 'click', b: 'select', c: 'hover', }
      }
    },
  ];

  /** @type TestResults */
  const expected = {
    DOM: {
      // NOTE : one can see here the `combineLatest` in action : a-a-a ; b-a-a; b-b-a; b-b-b
      outputs: [
        "<div><span>List Component 0 : ITEM1 - a</span><span>List Component 1 : ITEM2 - a</span><span>List Component 2 : ITEM3 - a</span></div>",
        "<div><span>List Component 0 : ITEM1 - b</span><span>List Component 1 : ITEM2 - a</span><span>List Component 2 : ITEM3 - a</span></div>",
        "<div><span>List Component 0 : ITEM1 - b</span><span>List Component 1 : ITEM2 - b</span><span>List Component 2 : ITEM3 - a</span></div>",
        "<div><span>List Component 0 : ITEM1 - b</span><span>List Component 1 : ITEM2 - b</span><span>List Component 2 : ITEM3 - b</span></div>",
        "<div><span>List Component 0 : ITEM1 - c</span><span>List Component 1 : ITEM2 - b</span><span>List Component 2 : ITEM3 - b</span></div>",
        "<div><span>List Component 0 : ITEM1 - c</span><span>List Component 1 : ITEM2 - c</span><span>List Component 2 : ITEM3 - b</span></div>",
        "<div><span>List Component 0 : ITEM1 - c</span><span>List Component 1 : ITEM2 - c</span><span>List Component 2 : ITEM3 - c</span></div>"
      ],
      successMessage: 'sink DOM produces the expected values',
      // NOTE : I need to keep an eye on the html to check the good behaviour, cannot strip the tags
      transform: pipe(convertVNodesToHTML)
    },
    a: {
      outputs: [
        "Component 0 - user action : click",
        "Component 1 - user action : click",
        "Component 2 - user action : click",
        "Component 0 - user action : select",
        "Component 1 - user action : select",
        "Component 2 - user action : select",
        "Component 0 - user action : hover",
        "Component 1 - user action : hover",
        "Component 2 - user action : hover",
        "Component 0 - user action : select",
        "Component 1 - user action : select",
        "Component 2 - user action : select",
        "Component 0 - user action : click",
        "Component 1 - user action : click",
        "Component 2 - user action : click",
        "Component 0 - user action : hover",
        "Component 1 - user action : hover",
        "Component 2 - user action : hover",
        "Component 0 - user action : click",
        "Component 1 - user action : click",
        "Component 2 - user action : click",
        "Component 0 - user action : select",
        "Component 1 - user action : select",
        "Component 2 - user action : select",
        "Component 0 - user action : hover",
        "Component 1 - user action : hover",
        "Component 2 - user action : hover"
      ],
      successMessage: 'sink a produces the expected values',
    },
  }

    runTestScenario(inputs, expected, listOfComponent, {
      tickDuration: 3,
      waitForFinishDelay: 10,
      analyzeTestResults: analyzeTestResults(assert, done),
      errorHandler: function (err) {
        done(err)
      }
    })
});
