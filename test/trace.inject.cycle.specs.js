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
// - processFn throws
// - processFn passes an error notification

// NOTE: There should be no way to test for the extra state/source event, i.e. runTestScenario won't work

import { componentNameInSettings, traceDOMsinkFn, traceEventSinkFn, traceEventSourceFn } from "../tracing/src/helpers"
import { Combine } from "../src/components/Combine"
import { addPrefix, convertVNodesToHTML, DOM_SINK, vLift } from "../utils/src"
import * as QUnit from "qunitjs"
import { resetGraphCounter, traceApp } from "../tracing/src"
import { runTestScenario } from "../testing/src/runTestScenario"
import { InjectCircularSources } from "../src/components/Inject/InjectLocalState"
import {set, identity} from 'ramda'
import { div } from "cycle-snabbdom"
import Rx from 'rx'

const $ = Rx.Observable;
const A_DRIVER = 'a_driver';
const A_CIRCULAR_BEHAVIOR_SOURCE = 'a_circular_behavior_source';
  const A_CIRCULAR_EVENT_SOURCE = 'a_circular_event_source';
const INITIAL_STATE = {key:'value'};
const A_RESPONSE = 'a_response';

function getId(start) {
  let counter = start;
  return function () {
    return counter++
  }
}

function commandProcessingFn(command) {
  return $.of({
    request : command,
    response : A_RESPONSE
  })
}

function behaviourUpdatingComponent(sources, settings){
  return [

  ]
}

function commandRequestComponent(sources, settings){

}

function sinkUpdatingComponent(sources, settings){

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
  const done = assert.async(X);
  const traces = [];
  /** @type InjectLocalStateSettings*/
  const injectSettings = {
    behaviour : [A_CIRCULAR_BEHAVIOR_SOURCE, INITIAL_STATE],
    event : [A_CIRCULAR_EVENT_SOURCE, commandProcessingFn]
  };

  // TODO : pass the settings, but removing the settings specific to inject...  be fine actually
  const App = InjectCircularSources(set(componentNameInSettings, 'Extra', injectSettings), [
    Combine({}, [
      behaviourUpdatingComponent,
      commandRequestComponent,
      sinkUpdatingComponent
    ])
  ]);
  const tracedApp = traceApp({
    _trace: {
      traceSpecs: {
        [A_DRIVER]: [traceEventSourceFn, traceEventSinkFn],
        [DOM_SINK]: [identity, traceDOMsinkFn]
      },
      sendMessage: msg => traces.push(msg)
    },
    _helpers: { getId: getId(0) }
  }, App);

  const inputs = [
    { [A_DRIVER]: { diagram: '-a--b--' } },
    { [ANOTHER_DRIVER]: { diagram: '-A--B--' } },
  ];

  const expectedMessages = {
    [A_DRIVER]: {
      outputs: inputs[0][A_DRIVER].diagram.replace(/-/g, '').split('').map(x => `driver1 emits: ${x}`),
      successMessage: `sink ${A_DRIVER} produces the expected values`
    },
    [DOM_SINK]: {
      outputs: [],
      successMessage: `sink ${DOM_SINK} produces the expected values`,
      transform: pipe(convertVNodesToHTML)
    },
  };

  const expectedGraph = [];
  const expectedTraces = [];

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
