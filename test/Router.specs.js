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
// to the children via `matched` property, and the purning of `route` source. I will incorporate
// that in the tests without talking about it.

import * as QUnit from "qunitjs"
import { onRoute } from '../src/components/Router/Router'
import { m } from '../src/components/m'
import * as Rx from 'rx'
import { h } from 'cycle-snabbdom'
import { runTestScenario } from '../src/runTestScenario'
import { convertVNodesToHTML, DOM_SINK, format } from '../src/utils'
import { pipe } from 'ramda'
import { ROUTE_PARAMS, ROUTE_SOURCE } from "../src/components/Router/properties"

const $ = Rx.Observable;

function analyzeTestResults(assert, done) {
  return function analyzeTestResults(actual, expected, message) {
    assert.deepEqual(actual, expected, message);
    done()
  }
}

const NON_DOM_SINK = 'a';
const A_SOURCE = 'DOM1';
const ANOTHER_SOURCE = 'DOM2';
const ROUTE_LOG_SINK = 'ROUTE_LOG';

function makeTestHelperComponent(header, sourceName, routeCfg) {
  return function (sources, settings) {
    return {
      [DOM_SINK]: sources[sourceName].map(x => h('span', {},
        `${header} for route '${routeCfg}' > ${ROUTE_PARAMS} - ${sourceName}: ${format(settings[ROUTE_PARAMS])} - ${x}`)),
      [ROUTE_LOG_SINK]: sources[ROUTE_SOURCE]
        .map(x => `${header} asociated to route '${routeCfg}' > ${ROUTE_PARAMS} - ${ROUTE_LOG_SINK}`
          + format(settings[ROUTE_PARAMS]) + ' - ' + x),
      [NON_DOM_SINK]: sources.userAction$
        .map(x => `${header} asociated to route '${routeCfg}' > ${NON_DOM_SINK} > user action : `
          + format(x))
    }
  }
}

QUnit.module("Testing Router component", {});

// A. with no nesting (only first should match and /anything should be configured but not the rest)
// - / -> /group -> /other -> /anything/else/there -> /
QUnit.test("nest level 0 - transitions", function exec_test(assert) {
  const done = assert.async(3);
  const sinkNames = [DOM_SINK, NON_DOM_SINK, ROUTE_LOG_SINK];
//TODO : add routeLog or better name to check the route in the children
  // TODO : reunderstand and document the null emissions : DOM when starts, and when finises
  // so when match -> no match and no match -> match
  const routerComponent = m({}, { sinkNames: sinkNames }, [
    onRoute({ route: 'group' }, [
      makeTestHelperComponent('Component 1', A_SOURCE, 'group'),
      makeTestHelperComponent('Component 2', ANOTHER_SOURCE, 'group'),
    ]),
    onRoute({ route: 'anything' }, [
      makeTestHelperComponent('Component 1', A_SOURCE, 'anything'),
      makeTestHelperComponent('Component 2', ANOTHER_SOURCE, 'anything'),
    ]),
  ]);

  const inputs = [
    {DOM1: {diagram: '-a--b--c--d--e--f--a--b--c--d-'}},
    {DOM2: {diagram: '-a-b-c-d-e-f-abb-c-d-e-f-'}},
    {
      userAction$: {
        diagram: 'a---b-ac--ab---c',
        values: {a: 'click', b: 'select', c: 'hover',}
      }
    },
    {
      route$: {
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
      outputs: [],
      successMessage: `sink ${DOM_SINK} produces the expected values`,
      transform: pipe(convertVNodesToHTML),
    },
    [NON_DOM_SINK]: {
      outputs: [],
      successMessage: `sink ${NON_DOM_SINK} produces the expected values`,
    },
    [ROUTE_LOG_SINK]: {
      outputs: [],
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
// - / -> /master -> /master/ -> /master/detail?name=ferret&color=purple -> /master/ -> /master-> /
// - / -> /master/detail?name=ferret&color=purple -> /master/detail?name=ferret&color=red -> /
// - /master/detail?name=ferret&color=purple -> /other/page?name=ferret&color=red -> /
// C. with two nesting to test (TODO)
// /guru -> /guru?:guruparams/master?:masterparams ->
// /guru?:guruparams/master?:masterparams/detail?:detailparams ->
// /guru?:guruparams/master?:masterparams -> /guru
// D. non-repetition of computation (nesting level of two)
// - /guru -> /guru -> /guru/master/detail -> /guru/master/detail -> /guru/master -> /guru/master

