import * as QUnit from "qunitjs"
import { runTestScenario } from "../src/runTestScenario"
import * as Rx from "rx"
import { makeDomainQuerySource } from "../utils/testing/mocks/mockDomainQuery"
import { addPrefix } from "../utils/utils/src/index"
import { LIVE_QUERY_TOKEN } from "../drivers/src"

let $ = Rx.Observable;

const A_SOURCE = 'a_source';
const ANOTHER_SOURCE = 'another_source';
const A_ENTITY = 'a_entity';
const ANOTHER_ENTITY = 'another_entity';
const PREFIX = 'A';
const ANOTHER_PREFIX = 'B';
const YET_ANOTHER_PREFIX = 'C';
const A_JSON_PARAM = {};
const ANYTHING = 'ANYTHING';
const SOMETHING = 'SOMETHING';
const A_STRING = 'A_STRING';
const A_NUMBER = 2;

function analyzeTestResults(assert, done) {
  return function analyzeTestResults(actual, expected, message) {
    assert.deepEqual(actual, expected, message);
    done()
  }
}

function subjectFactory() {
  return new Rx.Subject()
}

function replaySubjectFactory() {
  return new Rx.ReplaySubject(1)
}

function componentWithDomainQuery(sources, settings) {
  const { domainQuery, sync } = sources;

  // NOTE: both domainQuery.getCurrent(A_ENTITY) should return the same entity in case of live query
  // once query will return two different streams

  // Live query : ANOTHER_SOURCE should never come to concat sync! subject never completes
  // Once query : values before sync except the first should be skipped. Only first value after
  // sync should pass

  return {
    [A_SOURCE]: domainQuery.getCurrent(A_ENTITY, A_JSON_PARAM).map(addPrefix(`${PREFIX}-`)),
    [ANOTHER_SOURCE]: domainQuery.getCurrent(A_ENTITY, A_JSON_PARAM).map(addPrefix(`${ANOTHER_PREFIX}-`))
      .concat(sync.take(1))
      .concat(domainQuery.getCurrent(A_ENTITY, A_JSON_PARAM).map(addPrefix(`${YET_ANOTHER_PREFIX}-`)))
  }
}

QUnit.module("mockDomainQuery", {});


QUnit.test("with live query", function exec_test(assert) {
  let done = assert.async(2);

  const inputs = [
    { sync: { diagram: '---s-', values: { s: ANYTHING } } },
    {
      [`domainQuery!${JSON.stringify(A_JSON_PARAM)}@${LIVE_QUERY_TOKEN}${A_ENTITY}`]: {
        diagram: 'u-v-w', values: { u: null, v: A_STRING, w: A_NUMBER }
      }
    },
  ];

  const testResults = {
    [A_SOURCE]: {
      outputs:
        [
          "A-null",
          `A-${A_STRING}`,
          `A-${A_NUMBER}`
        ],
      successMessage: 'the live query emits continously its values',
    },
    [ANOTHER_SOURCE]: {
      outputs: [
        "B-null",
        `B-${A_STRING}`,
        `B-${A_NUMBER}`
      ],
      successMessage: 'the live query emits continously its values',
    },
  };

  runTestScenario(inputs, testResults, componentWithDomainQuery, {
    tickDuration: 5,
    waitForFinishDelay: 20,
    analyzeTestResults: analyzeTestResults(assert, done),
    mocks: {
      domainQuery: makeDomainQuerySource
    },
    sourceFactory: {
      [`domainQuery!${JSON.stringify(A_JSON_PARAM)}@${LIVE_QUERY_TOKEN}${A_ENTITY}`]: replaySubjectFactory,
    },
    errorHandler: function (err) {
      done(err)
    }
  });

});

QUnit.test("with once query", function exec_test(assert) {
  let done = assert.async(2);

  const inputs = [
    { sync: { diagram: '---s-', values: { s: ANYTHING } } },
    {
      [`domainQuery!${JSON.stringify(A_JSON_PARAM)}@${A_ENTITY}`]: {
        diagram: 'u-v-w', values: { u: null, v: A_STRING, w: A_NUMBER }
      }
    },
  ];

  const testResults = {
    [A_SOURCE]: {
      outputs:
        [
          "A-null",
        ],
      successMessage: 'once query will return only once',
    },
    [ANOTHER_SOURCE]: {
      outputs: [
        `${ANOTHER_PREFIX}-null`,
        `${ANYTHING}`,
        `${YET_ANOTHER_PREFIX}-${A_NUMBER}`
      ],
      successMessage: 'the live query emits continously its values',
    },
  };

  runTestScenario(inputs, testResults, componentWithDomainQuery, {
    tickDuration: 5,
    waitForFinishDelay: 20,
    analyzeTestResults: analyzeTestResults(assert, done),
    mocks: {
      domainQuery: makeDomainQuerySource
    },
    sourceFactory: {
      [`domainQuery!${JSON.stringify(A_JSON_PARAM)}@${A_ENTITY}`]: replaySubjectFactory,
    },
    errorHandler: function (err) {
      done(err)
    }
  });

});

