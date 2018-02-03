// Example
// OnRoute({route: 'group/:groupId'}, [
//   showGroupCore,
//   OnRoute({route: 'user/:userId'}, [
//     showUsersCore,
//     showUserDetails
//   ])
// ]);
// Test plan
// - Test Universe = Settings x ChildrenComponents x SequenceOfRoutes
// Note that the first two sets correspond to the specification of the Router component factory,
// while the remaining sets correspond to the specification of the Router component itself.
// We will discard testing for Settings and ChildrenComponents by assuming independence and good
// behaviour (T1, T4).
// We further reduce the universe under test by observing that the component behaviour should
// deoend on the route transitions (T2) and there are only a few types of such transitions within
// which the behaviour should be homogeneous (T3). The absence of recomputation for two
// similar route partial match will tested independently of the rest (T1). As the
// nesting level is also an important part of the routing specification, we will test up to a
// nesting level of 2, which should cover practical cases (T4). The test universe is in summary
// reduced to the following :
// - Test Universe = TransitionTypes x NestingLevel x ParameterParsing x NoopWhenRepeatRoute
// We will test ParameterParsing along the way (T1) and NoopWhenRepeatRoute separately and
// independently (T1). We then have :
// - Test Universe = TransitionTypes x NestingLevel + NoopWhenRepeatRoute
// NOTE : In all rigour, I should add also the requirements described in behaviour in the
// documentation, and relating to sink merging of children components, the parameter passing
// to the children via `matched` property, and the pruning of `route` source. I will incorporate
// that in the tests without talking about it.

import * as QUnit from "qunitjs"
import { OnRoute } from '../src/components/Router/Router'
import { m } from '../src/components/m/m'
import * as Rx from 'rx'
import { h } from 'cycle-snabbdom'
import { runTestScenario } from '../testing/src/runTestScenario'
import { convertVNodesToHTML, format } from "../utils/src/index"
import { DOM_SINK } from "../utils/src/index"
import { pipe } from 'ramda'
import { ROUTE_PARAMS } from "../src/components/Router/properties"

const $ = Rx.Observable;

function analyzeTestResults(assert, done) {
  return function analyzeTestResults(actual, expected, message) {
    assert.deepEqual(actual, expected, message);
    done()
  }
}

const NON_DOM_SINK = 'a';
const ANOTHER_NON_DOM_SINK = 'b';
const A_SOURCE = 'DOM1';
const ANOTHER_SOURCE = 'DOM2';
const ROUTE_LOG_SINK = 'ROUTE_LOG';
const ROUTE_SOURCE = 'route$';

function makeTestHelperComponent(header, sourceName, routeCfg) {
  return function (sources, settings) {
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

QUnit.module("Testing Router component", {});

// A. with no nesting (only first should match and /anything should be configured but not the rest)
// - / -> /group -> /other -> /anything/else/there -> /
QUnit.test("non-nested routing - transitions - initial state", function exec_test(assert) {
  const done = assert.async(3);
  const sinkNames = [DOM_SINK, NON_DOM_SINK, ROUTE_LOG_SINK];
  const routerComponent = m({}, { sinkNames: sinkNames, routeSource: ROUTE_SOURCE }, [
    OnRoute({ route: 'group' }, [
      makeTestHelperComponent('Component 1', A_SOURCE, 'group'),
      makeTestHelperComponent('Component 2', ANOTHER_SOURCE, 'group'),
    ]),
  ]);

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

  const expected = {
    [DOM_SINK]: {
      outputs: [null],
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

  runTestScenario(inputs, expected, routerComponent, {
    tickDuration: 3,
    waitForFinishDelay: 10,
    analyzeTestResults: analyzeTestResults(assert, done),
    errorHandler: function (err) {
      done(err)
    }
  });


});

QUnit.test("non-nested routing - transitions no match -> match", function exec_test(assert) {
  const done = assert.async(3);
  const sinkNames = [DOM_SINK, NON_DOM_SINK, ROUTE_LOG_SINK];

  const routerComponent = m({}, { sinkNames: sinkNames, routeSource: ROUTE_SOURCE }, [
    OnRoute({ route: 'group' }, [
      makeTestHelperComponent('Component 1', A_SOURCE, 'group'),
      makeTestHelperComponent('Component 2', ANOTHER_SOURCE, 'group'),
    ]),
  ]);

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

  const expected = {
    [DOM_SINK]: {
      outputs: [
        null,
        divwrap(divwrap(`${getHelperComponentOutput('Component 1', A_SOURCE, 'group', {}, 'c')[DOM_SINK]}${getHelperComponentOutput('Component 2', ANOTHER_SOURCE, 'group', {}, 'd')[DOM_SINK]}`))
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

  runTestScenario(inputs, expected, routerComponent, {
    tickDuration: 3,
    waitForFinishDelay: 10,
    analyzeTestResults: analyzeTestResults(assert, done),
    errorHandler: function (err) {
      done(err)
    }
  });


});

QUnit.test("non-nested routing - transitions match -> no match, also testing param parsing", function exec_test(assert) {
  const done = assert.async(3);
  const sinkNames = [DOM_SINK, NON_DOM_SINK, ROUTE_LOG_SINK];

  const routerComponent = m({}, { sinkNames: sinkNames, routeSource: ROUTE_SOURCE }, [
    OnRoute({ route: 'group:param' }, [
      makeTestHelperComponent('Component 1', A_SOURCE, 'group:param'),
      makeTestHelperComponent('Component 2', ANOTHER_SOURCE, 'group:param'),
    ]),
  ]);

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
        diagram: '-----b--c---', values: {
          a: '',
          b: 'group?paramKey=paramValue',
          c: 'other',
          d: 'anything/else/there',
        }
      }
    }
  ];

  const expected = {
    [DOM_SINK]: {
      outputs: [
        null,
        divwrap(divwrap(`${getHelperComponentOutput('Component 1', A_SOURCE, 'group:param', { param: '?paramKey=paramValue' }, 'c')[DOM_SINK]}${getHelperComponentOutput('Component 2', ANOTHER_SOURCE, 'group:param', { param: '?paramKey=paramValue' }, 'd')[DOM_SINK]}`)),
        // NOTE : extra null triggered by transition match -> no match
        null
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
        `${getHelperComponentOutput('Component 1', A_SOURCE, 'group:param', { param: '?paramKey=paramValue' }, undefined)[ROUTE_LOG_SINK]}`,
        `${getHelperComponentOutput('Component 2', ANOTHER_SOURCE, 'group:param', { param: '?paramKey=paramValue' }, undefined)[ROUTE_LOG_SINK]}`
      ],
      successMessage: `sink ${ROUTE_LOG_SINK} produces the expected values`,
    },
  };

  runTestScenario(inputs, expected, routerComponent, {
    tickDuration: 3,
    waitForFinishDelay: 10,
    analyzeTestResults: analyzeTestResults(assert, done),
    errorHandler: function (err) {
      done(err)
    }
  });


});

QUnit.test("non-nested routing - transitions", function exec_test(assert) {
  const done = assert.async(3);
  const sinkNames = [DOM_SINK, NON_DOM_SINK, ROUTE_LOG_SINK];

  const routerComponent = m({}, { sinkNames: sinkNames, routeSource: ROUTE_SOURCE }, [
    OnRoute({ route: 'group' }, [
      makeTestHelperComponent('Component 1', A_SOURCE, 'group'),
      makeTestHelperComponent('Component 2', ANOTHER_SOURCE, 'group'),
    ]),
    OnRoute({ route: 'anything' }, [
      makeTestHelperComponent('Component 1', A_SOURCE, 'anything'),
      makeTestHelperComponent('Component 2', ANOTHER_SOURCE, 'anything'),
    ]),
  ]);

  const inputs = [
    { DOM1: { diagram: '-a--b--c--d--e------------' } },
    { DOM2: { diagram: '-a-b-c-d-e-f--------' } },
    {
      userAction$: {
        diagram: 'a---b-ac--ab---c',
        values: { a: 'click', b: 'select', c: 'hover', }
      }
    },
    {
      route$: {
        // DOM1: '-a--b--c--d--e------------'}},
        // DOM2: '-a-b-c-d-e-f--------'}},
        // user: 'a---b-ac--ab---c', { a: 'click', b: 'select', c: 'hover', }
        diagram: '-a---b--cd--', values: {
          a: '',
          b: 'group',
          c: 'other',
          d: 'anything/else/there',
        }
      }
    }
  ];

  const expected = {
    [DOM_SINK]: {
      outputs: [
        null, // transition init -> no match
        null, // match starts with null
        divwrap(divwrap(`${getHelperComponentOutput('Component 1', A_SOURCE, 'group', {}, 'c')[DOM_SINK]}${getHelperComponentOutput('Component 2', ANOTHER_SOURCE, 'group', {}, 'd')[DOM_SINK]}`)),
        null, // transition match -> no match
        null, // match starts with null
        divwrap(divwrap(`${getHelperComponentOutput('Component 1', A_SOURCE, 'anything', {}, 'd')[DOM_SINK]}${getHelperComponentOutput('Component 2', ANOTHER_SOURCE, 'anything', {}, 'f')[DOM_SINK]}`)),
        divwrap(divwrap(`${getHelperComponentOutput('Component 1', A_SOURCE, 'anything', {}, 'e')[DOM_SINK]}${getHelperComponentOutput('Component 2', ANOTHER_SOURCE, 'anything', {}, 'f')[DOM_SINK]}`)),
      ],
      successMessage: `sink ${DOM_SINK} produces the expected values`,
      transform: pipe(convertVNodesToHTML),
    },
    [NON_DOM_SINK]: {
      outputs: [
        `${getHelperComponentOutput('Component 1', A_SOURCE, 'group', {}, 'click')[NON_DOM_SINK]}`,
        `${getHelperComponentOutput('Component 2', ANOTHER_SOURCE, 'group', {}, 'click')[NON_DOM_SINK]}`,
        `${getHelperComponentOutput('Component 1', A_SOURCE, 'group', {}, 'hover')[NON_DOM_SINK]}`,
        `${getHelperComponentOutput('Component 2', ANOTHER_SOURCE, 'group', {}, 'hover')[NON_DOM_SINK]}`,
        `${getHelperComponentOutput('Component 1', A_SOURCE, 'anything', {}, 'click')[NON_DOM_SINK]}`,
        `${getHelperComponentOutput('Component 2', ANOTHER_SOURCE, 'anything', {}, 'click')[NON_DOM_SINK]}`,
        `${getHelperComponentOutput('Component 1', A_SOURCE, 'anything', {}, 'select')[NON_DOM_SINK]}`,
        `${getHelperComponentOutput('Component 2', ANOTHER_SOURCE, 'anything', {}, 'select')[NON_DOM_SINK]}`,
        `${getHelperComponentOutput('Component 1', A_SOURCE, 'anything', {}, 'hover')[NON_DOM_SINK]}`,
        `${getHelperComponentOutput('Component 2', ANOTHER_SOURCE, 'anything', {}, 'hover')[NON_DOM_SINK]}`,
      ],
      successMessage: `sink ${NON_DOM_SINK} produces the expected values`,
    },
    [ROUTE_LOG_SINK]: {
      outputs: [
        `${getHelperComponentOutput('Component 1', A_SOURCE, 'group', {}, undefined)[ROUTE_LOG_SINK]}`,
        `${getHelperComponentOutput('Component 2', ANOTHER_SOURCE, 'group', {}, undefined)[ROUTE_LOG_SINK]}`,
        `${getHelperComponentOutput('Component 1', A_SOURCE, 'anything', {}, 'else/there')[ROUTE_LOG_SINK]}`,
        `${getHelperComponentOutput('Component 2', ANOTHER_SOURCE, 'anything', {}, 'else/there')[ROUTE_LOG_SINK]}`,
      ],
      successMessage: `sink ${ROUTE_LOG_SINK} produces the expected values`,
    },
  };

  runTestScenario(inputs, expected, routerComponent, {
    tickDuration: 3,
    waitForFinishDelay: 10,
    analyzeTestResults: analyzeTestResults(assert, done),
    errorHandler: function (err) {
      done(err)
    }
  });
});

// B. with one nesting to test (group and other configured, then page:... configured)
// Transitions
// NOTE : A = 'anything', Parent = 'master', Child = 'Detail'
// 1. x -> Parent,
// 2. x -> Parent, Child,
// 3. x-> x,
// 4. Parent -> Parent, Child,
// 5. Parent -> Parent;
// 6. Parent, Child -> Parent, Child ;
// 7. Parent, Child -> Parent ;
// 8. Parent, Child -> x
// 9. x -> A,
// 10. A -> A,
// 11. A -> x
// 12. A -> Parent,
// 13. A -> Parent, Child ;
// 14. Parent, Child -> A,
// 15. Parent -> A
// - / -> /master -> /master/ -> /master/detail?name=ferret&color=purple -> /master/ -> /master-> /
// - / -> /master/detail?name=ferret&color=purple -> /master/detail?name=ferret&color=red -> /
// - /master/detail?name=ferret&color=purple -> /other/page?name=ferret&color=red -> /
QUnit.test("nested routing depth 1 - transitions", function exec_test(assert) {
  const done = assert.async(3);
  const sinkNames = [DOM_SINK, NON_DOM_SINK, ROUTE_LOG_SINK];

  const routerComponent = m({}, { sinkNames: sinkNames, routeSource: ROUTE_SOURCE }, [
    OnRoute({ route: 'master:qs' }, [
      makeTestHelperComponent('Master component', A_SOURCE, 'master'),
      OnRoute({ route: 'detail:qs' }, [
        makeTestHelperComponent('Detail component', ANOTHER_SOURCE, 'detail:qs'),
      ])
    ]),
    OnRoute({ route: 'anything' }, [
      makeTestHelperComponent('Component 1', A_SOURCE, 'anything'),
      makeTestHelperComponent('Component 2', ANOTHER_SOURCE, 'anything'),
    ]),
  ]);

  const inputs = [
    { DOM1: { diagram: '-a--b--c--d--e--f--g--h--i--j--k--l--m' } },
    { DOM2: { diagram: '-a-b-c-d-e-f-g-h-i-j-k-l-m-n-o-p-q-r-s' } },
    {
      userAction$: {
        diagram: 'a---b-ac--ab---c-b-c-aab---c--a-b',
        values: { a: 'click', b: 'select', c: 'hover', }
      }
    },
    {
      route$: {
        // DOM1: '-a--b--c--d--e--f--g--h--i--j--k--l--m'}},
        // DOM2: '-a-b-c-d-e-f-g-h-i-j-k-l-m-n-o-p-q-r-s'}},
        // user: 'a---b-ac--ab---c-b-c-aab---c--a-b', { a: 'click', b: 'select', c: 'hover', }
        diagram: '-a-g--b-d--e-c--b-f-f-d-f-a-f-b-g-d', values: {
          // transition ab, bd, de, ec, cb, bf, ff, fd, df, fa, af, fb, ba, gd,
          // a=g, b=c, d=e, that results in the following diagram
          // a-g-b-d-e-c-b-f-f-d-f-a-f-b-g-d
          a: '',
          b: 'master',
          c: 'master?queryStringMaster',
          d: 'master/detail?queryStringDetail1',
          e: 'master/detail?queryStringDetail2/extrasection',
          f: 'anything',
          g: 'nomatch'
        }
      }
    }
  ];

  const expected = {
    [DOM_SINK]: {
      outputs: [
        null, // init -> no match
        // no match -> no match = nothing
        null, // match starts with null
        divwrap(divwrap(`${getHelperComponentOutput('Master component', A_SOURCE, 'master', { qs: '' }, 'c')[DOM_SINK]}`)),
        // match -> match same section = repeats?
        divwrap(divwrap(`${getHelperComponentOutput('Master component', A_SOURCE, 'master', { qs: '' }, 'c')[DOM_SINK]}`)),
        divwrap(divwrap(`${getHelperComponentOutput('Master component', A_SOURCE, 'master', { qs: '' }, 'c')[DOM_SINK]}${divwrap(getHelperComponentOutput('Detail component', ANOTHER_SOURCE, 'detail:qs', { qs: '?queryStringDetail1' }, 'e')[DOM_SINK])}`)),
        divwrap(divwrap(`${getHelperComponentOutput('Master component', A_SOURCE, 'master', { qs: '' }, 'd')[DOM_SINK]}${divwrap(getHelperComponentOutput('Detail component', ANOTHER_SOURCE, 'detail:qs', { qs: '?queryStringDetail1' }, 'e')[DOM_SINK])}`)),
        divwrap(divwrap(`${getHelperComponentOutput('Master component', A_SOURCE, 'master', { qs: '' }, 'd')[DOM_SINK]}${divwrap(getHelperComponentOutput('Detail component', ANOTHER_SOURCE, 'detail:qs', { qs: '?queryStringDetail1' }, 'f')[DOM_SINK])}`)),
        // match -< match on child, child DOM will starts with null, so parent will be repeating
        // former value = d
        divwrap(divwrap(`${getHelperComponentOutput('Master component', A_SOURCE, 'master', { qs: '' }, 'd')[DOM_SINK]}`)),
        divwrap(divwrap(`${getHelperComponentOutput('Master component', A_SOURCE, 'master', { qs: '' }, 'e')[DOM_SINK]}`)),
        divwrap(divwrap(`${getHelperComponentOutput('Master component', A_SOURCE, 'master', { qs: '' }, 'e')[DOM_SINK]}${divwrap(getHelperComponentOutput('Detail component', ANOTHER_SOURCE, 'detail:qs', { qs: '?queryStringDetail2' }, 'g')[DOM_SINK])}`)),
        null, // master vs. master?xx are different sections -> resets to null
        divwrap(divwrap(`${getHelperComponentOutput('Master component', A_SOURCE, 'master', { qs: '?queryStringMaster' }, 'f')[DOM_SINK]}`)),
        null,// // master vs. master?xx are different sections -> resets to null
        // master vs. anything -> null, null.
        // 1. null to finish master, combinedLatest with null on anything branch (never was
        // nothing but null so far)
        // 2. then null to start anything branch, combinedLatest with null on master branch
        null,
        null,
        divwrap(divwrap(`${getHelperComponentOutput('Component 1', A_SOURCE, 'anything', {}, 'g')[DOM_SINK]}${getHelperComponentOutput('Component 2', ANOTHER_SOURCE, 'anything', {}, 'j')[DOM_SINK]}`)),
        divwrap(divwrap(`${getHelperComponentOutput('Component 1', A_SOURCE, 'anything', {}, 'g')[DOM_SINK]}${getHelperComponentOutput('Component 2', ANOTHER_SOURCE, 'anything', {}, 'k')[DOM_SINK]}`)),
        divwrap(divwrap(`${getHelperComponentOutput('Component 1', A_SOURCE, 'anything', {}, 'h')[DOM_SINK]}${getHelperComponentOutput('Component 2', ANOTHER_SOURCE, 'anything', {}, 'k')[DOM_SINK]}`)),
        // d => match on master branch -> null there combinedLAtest with anything branch -> repeats
        divwrap(divwrap(`${getHelperComponentOutput('Component 1', A_SOURCE, 'anything', {}, 'h')[DOM_SINK]}${getHelperComponentOutput('Component 2', ANOTHER_SOURCE, 'anything', {}, 'k')[DOM_SINK]}`)),
        // then anything branch no match -> null (if anything branch was before master branch
        // would not happen i.e. this is subscription-order dependent) but eventually all is well
        null,
        // then l on child does not produce anything (have nothing in parent so nothing emited
        // by combineLatest)
        // then moving back to anything reproduces double null by the same reasoning as before
        null,
        null,
        divwrap(divwrap(`${getHelperComponentOutput('Component 1', A_SOURCE, 'anything', {}, 'i')[DOM_SINK]}${getHelperComponentOutput('Component 2', ANOTHER_SOURCE, 'anything', {}, 'm')[DOM_SINK]}`)),
        null,
        null, // because of transition a -> f
        null, // double null because of f-> b
        null,
        divwrap(divwrap(`${getHelperComponentOutput('Master component', A_SOURCE, 'master', { qs: '' }, 'k')[DOM_SINK]}`)),
        null,
        null,
        divwrap(divwrap(`${getHelperComponentOutput('Master component', A_SOURCE, 'master', { qs: '' }, 'm')[DOM_SINK]}${divwrap(getHelperComponentOutput('Detail component', ANOTHER_SOURCE, 'detail:qs', { qs: '?queryStringDetail1' }, 'r')[DOM_SINK])}`)),
        divwrap(divwrap(`${getHelperComponentOutput('Master component', A_SOURCE, 'master', { qs: '' }, 'm')[DOM_SINK]}${divwrap(getHelperComponentOutput('Detail component', ANOTHER_SOURCE, 'detail:qs', { qs: '?queryStringDetail1' }, 's')[DOM_SINK])}`)),
      ],
      successMessage: `sink ${DOM_SINK} produces the expected values`,
      transform: pipe(convertVNodesToHTML),
    },
    [NON_DOM_SINK]: {
      outputs: [
        `${getHelperComponentOutput('Master component', A_SOURCE, 'master', {}, 'hover')[NON_DOM_SINK]}`,
        `${getHelperComponentOutput('Master component', A_SOURCE, 'master', {}, 'click')[NON_DOM_SINK]}`,
        `${getHelperComponentOutput('Detail component', A_SOURCE, 'detail:qs', {}, 'click')[NON_DOM_SINK]}`,
        `${getHelperComponentOutput('Master component', A_SOURCE, 'master', {}, 'select')[NON_DOM_SINK]}`,
        `${getHelperComponentOutput('Detail component', A_SOURCE, 'detail:qs', {}, 'select')[NON_DOM_SINK]}`,
        `${getHelperComponentOutput('Master component', A_SOURCE, 'master', {}, 'hover')[NON_DOM_SINK]}`,
        `${getHelperComponentOutput('Master component', A_SOURCE, 'master', {}, 'select')[NON_DOM_SINK]}`,
        `${getHelperComponentOutput('Component 1', A_SOURCE, 'anything', {}, 'hover')[NON_DOM_SINK]}`,
        `${getHelperComponentOutput('Component 2', ANOTHER_SOURCE, 'anything', {}, 'hover')[NON_DOM_SINK]}`,
        `${getHelperComponentOutput('Component 1', A_SOURCE, 'anything', {}, 'click')[NON_DOM_SINK]}`,
        `${getHelperComponentOutput('Component 2', ANOTHER_SOURCE, 'anything', {}, 'click')[NON_DOM_SINK]}`,
        `${getHelperComponentOutput('Component 1', A_SOURCE, 'anything', {}, 'click')[NON_DOM_SINK]}`,
        `${getHelperComponentOutput('Component 2', ANOTHER_SOURCE, 'anything', {}, 'click')[NON_DOM_SINK]}`,
        `${getHelperComponentOutput('Master component', A_SOURCE, 'master', {}, 'select')[NON_DOM_SINK]}`,
        `${getHelperComponentOutput('Detail component', A_SOURCE, 'detail:qs', {}, 'select')[NON_DOM_SINK]}`,
        `${getHelperComponentOutput('Component 1', A_SOURCE, 'anything', {}, 'click')[NON_DOM_SINK]}`,
        `${getHelperComponentOutput('Component 2', ANOTHER_SOURCE, 'anything', {}, 'click')[NON_DOM_SINK]}`,
        `${getHelperComponentOutput('Master component', A_SOURCE, 'master', {}, 'select')[NON_DOM_SINK]}`,
      ],
      successMessage: `sink ${NON_DOM_SINK} produces the expected values`,
    },
    [ROUTE_LOG_SINK]: {
      outputs: [
        `${getHelperComponentOutput('Master component', A_SOURCE, 'master', { qs: '' }, undefined)[ROUTE_LOG_SINK]}`,
        `${getHelperComponentOutput('Master component', A_SOURCE, 'master', { qs: '' }, 'detail?queryStringDetail1')[ROUTE_LOG_SINK]}`,
        `${getHelperComponentOutput('Detail component', ANOTHER_SOURCE, 'detail:qs', { qs: '?queryStringDetail1' }, undefined)[ROUTE_LOG_SINK]}`,
        `${getHelperComponentOutput('Master component', A_SOURCE, 'master', { qs: '' }, 'detail?queryStringDetail2/extrasection')[ROUTE_LOG_SINK]}`,
        `${getHelperComponentOutput('Detail component', ANOTHER_SOURCE, 'detail:qs', { qs: '?queryStringDetail2' }, 'extrasection')[ROUTE_LOG_SINK]}`,
        `${getHelperComponentOutput('Master component', A_SOURCE, 'master', { qs: '?queryStringMaster' }, undefined)[ROUTE_LOG_SINK]}`,
        `${getHelperComponentOutput('Master component', A_SOURCE, 'master', { qs: '' }, undefined)[ROUTE_LOG_SINK]}`,
        `${getHelperComponentOutput('Component 1', A_SOURCE, 'anything', {}, undefined)[ROUTE_LOG_SINK]}`,
        `${getHelperComponentOutput('Component 2', ANOTHER_SOURCE, 'anything', {}, undefined)[ROUTE_LOG_SINK]}`,
        `${getHelperComponentOutput('Component 1', A_SOURCE, 'anything', {}, undefined)[ROUTE_LOG_SINK]}`,
        `${getHelperComponentOutput('Component 2', ANOTHER_SOURCE, 'anything', {}, undefined)[ROUTE_LOG_SINK]}`,
        `${getHelperComponentOutput('Master component', A_SOURCE, 'master', { qs: '' }, 'detail?queryStringDetail1')[ROUTE_LOG_SINK]}`,
        `${getHelperComponentOutput('Detail component', ANOTHER_SOURCE, 'detail:qs', { qs: '?queryStringDetail1' }, undefined)[ROUTE_LOG_SINK]}`,
        `${getHelperComponentOutput('Component 1', A_SOURCE, 'anything', {}, undefined)[ROUTE_LOG_SINK]}`,
        `${getHelperComponentOutput('Component 2', ANOTHER_SOURCE, 'anything', {}, undefined)[ROUTE_LOG_SINK]}`,
        `${getHelperComponentOutput('Component 1', A_SOURCE, 'anything', {}, undefined)[ROUTE_LOG_SINK]}`,
        `${getHelperComponentOutput('Component 2', ANOTHER_SOURCE, 'anything', {}, undefined)[ROUTE_LOG_SINK]}`,
        `${getHelperComponentOutput('Master component', A_SOURCE, 'master', { qs: '' }, undefined)[ROUTE_LOG_SINK]}`,
        `${getHelperComponentOutput('Master component', A_SOURCE, 'master', { qs: '' }, 'detail?queryStringDetail1')[ROUTE_LOG_SINK]}`,
        `${getHelperComponentOutput('Detail component', ANOTHER_SOURCE, 'detail:qs', { qs: '?queryStringDetail1' }, undefined)[ROUTE_LOG_SINK]}`,
      ],
      successMessage: `sink ${ROUTE_LOG_SINK} produces the expected values`,
    },
  };

  runTestScenario(inputs, expected, routerComponent, {
    tickDuration: 3,
    waitForFinishDelay: 10,
    analyzeTestResults: analyzeTestResults(assert, done),
    errorHandler: function (err) {
      done(err)
    }
  });
});

// C. with two nesting to test (TODO)
// /guru -> /guru:guruparams/master:masterparams ->
// /guru:guruparams/master:masterparams/detail:detailparams ->
// /guru:guruparams/master:masterparams -> /guru
// D. non-repetition of computation (nesting level of two)
// - /guru -> /guru -> /guru/master/detail -> /guru/master/detail -> /guru/master -> /guru/master
