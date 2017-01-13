// let Qunit = require('qunitjs');
import * as QUnit from "qunitjs"
import { map, reduce, always, clone, curry, identity, flatten, match, T, F, __ } from "ramda"
import * as jsonpatch from "fast-json-patch"
import * as Rx from "rx"
import { makeErrorMessage } from "../src/utils"
import { runTestScenario } from "../src/runTestScenario"
import {
  EV_GUARD_NONE, ACTION_REQUEST_NONE, ACTION_GUARD_NONE, DRIVER_PREFIX, INIT_EVENT_NAME, INIT_STATE,
  CONTRACT_SATISFIED_GUARD_PER_ACTION_RESPONSE, CONTRACT_MODEL_UPDATE_FN_RETURN_VALUE
} from "../src/components/properties"
import { makeFSM } from "../src/components/FSM"

let $ = Rx.Observable;

// Fixtures
const EV_PREFIX = 'ev_';
const INIT_TRANSITION = 'T_INIT';
const FIRST_STATE = 'S_FIRST';
const SECOND_STATE = 'S_SECOND';
const THIRD_STATE = 'S_THIRD';
const testEvent = 'dummyEvent';
const dummyValue = 'dummy';
const dummyValue1 = 'dummy1';
const dummyValue2 = 'dummy2';
// NOTE : a function as a value is used here to test against json patching
// library
const dummyValue3 = function dummyFunction() {
  return 'dummy3'
};
const dummySinkA3Values = ['dummySinkA1', 'dummySinkA2', 'dummySinkA3'];
const dummySinkB2Values = ['dummySinkB1', 'dummySinkB2'];
const dummySinkC1Value = ['dummySinkC1'];
const initialModel = {
  dummyKey1InitModel: dummyValue1,
  dummyKey2InitModel: dummyValue2,
};
const opsOnInitialModel = [
  { op: "add", path: '/dummyKey3InitModel', value: dummyValue3 },
  { op: "replace", path: '/dummyKey1InitModel', value: dummyValue2 },
  { op: "remove", path: '/dummyKey2InitModel' },
];
const opsOnUpdatedModel = [
  { op: "add", path: '/dummyKey1UpdatedModel', value: dummyValue1 },
];
let updatedModel = clone(initialModel);
// NOTE: !! modifies in place so function does not return anything
jsonpatch.apply(/*OUT*/updatedModel, opsOnInitialModel);
const initEventData = {
  dummyKeyEvInit: dummyValue
};
const dummyEventData = {
  dummyKeyEv: EV_PREFIX + dummyValue
};
const dummyEventData1 = {
  dummyKeyEv1: EV_PREFIX + dummyValue1
};
const dummyEventData2 = {
  dummyKeyEv2: EV_PREFIX + dummyValue2
};
const dummyDriver = DRIVER_PREFIX + '_dummy';
const dummyDriverActionResponse = { responseKey: 'responseValue' };
const dummyDriverActionResponse2 = { responseKey2: 'responseValue2' };
const dummyCommand = 'dummyCommand';
const dummyPayload = { dummyKeyPayload: 'dummyValuePayload' };
const dummyRequest = { command: dummyCommand, payload: dummyPayload };

const sinkNames = ['sinkA', 'sinkB', 'sinkC', 'modelSink', dummyDriver];

function modelUpdateIdentity(x){
  return [];
}

function dummyComponent1Sink(sources, settings) {
  const { model } = settings;

  return {
    sinkA: sources.sinkA.take(3),
    sinkB: sources.sinkB.take(2),
    modelSink: $.just(model)
  }
}
//TODO : have a source ca;;ed sampler which emits anything at regular interval so I control
// timing of emission of component sinks
function dummyComponent2Sink(sources, settings) {
  const { model } = settings;
  const prefix = 'dummyComponent2_';

  return {
    sinkA: sources.sinkA.take(1).map(x => prefix + x),
    modelSink: $.just(model),
  }
}

function generateValuesWithInterval(arrayValues, timeInterval) {
  return $.generateWithAbsoluteTime(
    0,
    index => index < arrayValues.length,
    index => index + 1,
    index => arrayValues[index],
    index => index ? timeInterval : 1 // emit first value sooner
  )
}

QUnit.module("makeFSM :: Events -> Transitions -> StateEntryComponents -> FSM_Settings -> Component", {});

QUnit.test(
  "Initialization of state machine - INIT event (no event guard)",
  function exec_test(assert) {
    let done = assert.async(5);

    function modelUpdateInitTransition(model, eventData, actionResponse) {
      assert.deepEqual(model, initialModel,
        'The INIT event triggers a call to the configured update' +
        ' model function, whose first parameter is the initial' +
        ' model');
      assert.deepEqual(eventData, initEventData,
        'The INIT event triggers a call to the configured update' +
        ' model function, whose second parameter is the ' +
        ' event data for the INIT event');
      assert.deepEqual(actionResponse, null,
        'The INIT event triggers a call to the configured update' +
        ' model function, whose third parameter is the ' +
        ' response for the action corresponding to the transition');

      return opsOnInitialModel
    }

    const events = {};

    const transitions = {
      T_INIT: {
        origin_state: INIT_STATE,
        event: INIT_EVENT_NAME,
        target_states: [
          {
            event_guard: EV_GUARD_NONE,
            action_request: ACTION_REQUEST_NONE,
            transition_evaluation: [
              {
                action_guard: ACTION_GUARD_NONE,
                target_state: 'First',
                model_update: modelUpdateInitTransition
              }
            ]
          }
        ]
      }
    };

    const entryComponents = {
      First: function (model) {
        return curry(dummyComponent1Sink)(__, { model })
      }
    };

    const fsmSettings = {
      initial_model: initialModel,
      init_event_data: initEventData,
      sinkNames: sinkNames
    };

    const fsmComponent = makeFSM(events, transitions, entryComponents, fsmSettings);

    const inputs = [
      { eventSource: { diagram: '---a-|', values: { a: dummyEventData } } },
      { [dummyDriver]: { diagram: '----a|', values: { a: dummyDriverActionResponse } } },
      { sinkA: { diagram: '012---012|', values: dummySinkA3Values } },
      { sinkB: { diagram: '01----01-|', values: dummySinkB2Values } },
    ];

    function analyzeTestResults(actual, expected, message) {
      assert.deepEqual(actual, expected, message);
      done()
    }

    let updatedModel = clone(initialModel);
    // NOTE: !! modifies in place so function does not return anything
    jsonpatch.apply(/*OUT*/updatedModel, opsOnInitialModel);

    /** @type TestResults */
    const testResults = {
      sinkA: {
        outputs: dummySinkA3Values,
        successMessage: 'sink sinkA produces the expected values',
        analyzeTestResults: analyzeTestResults,
      },
      sinkB: {
        outputs: dummySinkB2Values,
        successMessage: 'sink sinkB produces the expected values',
        analyzeTestResults: analyzeTestResults,
      },
      modelSink: {
        outputs: [updatedModel],
        successMessage: 'sink modelSink produces the expected values',
        analyzeTestResults: analyzeTestResults,
      },
      [dummyDriver]: {
        outputs: [],
        successMessage: 'sink drivers_dummy produces no values as expected',
        analyzeTestResults: analyzeTestResults,
      },
      sinkC: {
        outputs: [],
        successMessage: 'sink sinkC produces no values as expected',
        analyzeTestResults: analyzeTestResults,
      },
    };

    runTestScenario(inputs, testResults, fsmComponent, {
      tickDuration: 5,
      // We put a large value here as there is no inputs, so this allows to
      // wait for the tested component to produce all its sink values
      waitForFinishDelay: 50
    })

  });

QUnit.test(
  "Event triggers a transition with an action request - default passing event guard - " +
  " passing action guard",
  function exec_test(assert) {
    let done = assert.async(5);
    const testEvent = 'dummy';

    function modelUpdateInitTransition(model, eventData, actionResponse) {
      assert.deepEqual(model, initialModel,
        `On receiving an action response, the model update function is called 
        with the model's current value as its first parameter`);
      assert.deepEqual(eventData, dummyEventData,
        `On receiving an action response, the model update function is called 
        with the current triggering event's data as its second parameter`);
      assert.deepEqual(actionResponse, dummyDriverActionResponse,
        `On receiving an action response, the model update function is called 
        with the action response as its third parameter`);

      return opsOnInitialModel
    }

    const dummyActionRequest = {
      driver: dummyDriver,
      request: (model, eventData) => {
        assert.deepEqual(model, initialModel,
          `The request factory function is called with first parameter being 
          the model's current value`);
        assert.deepEqual(eventData, dummyEventData,
          `The request factory function is called with second parameter being 
          the data for the event triggering the action request`);

        return dummyRequest
      }
    };

    const events = {
      [testEvent]: sources => sources.eventSource.take(1)
    };

    const transitions = {
      [INIT_TRANSITION]: {
        origin_state: INIT_STATE,
        event: INIT_EVENT_NAME,
        target_states: [
          {
            event_guard: EV_GUARD_NONE,
            action_request: ACTION_REQUEST_NONE,
            transition_evaluation: [
              {
                action_guard: ACTION_GUARD_NONE,
                target_state: FIRST_STATE,
                model_update: modelUpdateIdentity
              }
            ]
          }
        ]
      },
      T1: {
        origin_state: FIRST_STATE,
        event: testEvent,
        target_states: [
          {
            event_guard: EV_GUARD_NONE,
            action_request: dummyActionRequest,
            transition_evaluation: [
              {
                action_guard: T,
                target_state: SECOND_STATE,
                model_update: modelUpdateInitTransition
              }
            ]
          }
        ]
      }
    };

    const entryComponents = {
      [FIRST_STATE]: function firstState(model) {
        return curry(dummyComponent2Sink)(__, { model })
      },
      [SECOND_STATE]: function secondState(model) {
        return curry(dummyComponent1Sink)(__, { model })
      },
    };

    const fsmSettings = {
      initial_model: initialModel,
      init_event_data: initEventData,
      sinkNames: sinkNames
    };

    const fsmComponent = makeFSM(events, transitions, entryComponents, fsmSettings);

    const inputs = [
//      { [dummyDriver]: { diagram: '-----------a|', values: { a: dummyDriverActionResponse } } }
      { eventSource: { diagram: '---a-|', values: { a: dummyEventData } } },
      { [dummyDriver]: { diagram: '----a|', values: { a: dummyDriverActionResponse } } },
      { sinkA: { diagram: '012---012|', values: dummySinkA3Values } },
      { sinkB: { diagram: '01----01-|', values: dummySinkB2Values } },
    ];

    function analyzeTestResults(actual, expected, message) {
      assert.deepEqual(actual, expected, message);
      done()
    }

    let updatedModel = clone(initialModel);
    // NOTE: !! modifies in place so function does not return anything
    jsonpatch.apply(/*OUT*/updatedModel, opsOnInitialModel);

    /** @type TestResults */
    const testResults = {
      sinkA: {
        outputs: flatten(['dummyComponent2_dummySinkA1', dummySinkA3Values]),
        successMessage: 'sink sinkA produces the expected values',
        analyzeTestResults: analyzeTestResults,
      },
      sinkB: {
        outputs: dummySinkB2Values,
        successMessage: 'sink sinkB produces the expected values',
        analyzeTestResults: analyzeTestResults,
      },
      modelSink: {
        outputs: [initialModel, updatedModel],
        successMessage: 'sink modelSink produces the expected values',
        analyzeTestResults: analyzeTestResults,
      },
      [dummyDriver]: {
        outputs: [dummyRequest],
        successMessage: 'sink dummyDriver produces the expected values',
        analyzeTestResults: analyzeTestResults,
      },
      sinkC: {
        outputs: [],
        successMessage: 'sink sinkC produces no values as expected',
        analyzeTestResults: analyzeTestResults,
      },
    };

    runTestScenario(inputs, testResults, fsmComponent, {
      tickDuration: 10,
      // We put a large value here as there is no inputs, so this allows to
      // wait for the tested component to produce all its sink values
      waitForFinishDelay: 200
    })

  });

QUnit.test(
  "Event triggers a transition with an action request - default passing event guard -" +
  " failing action guard : ERROR!",
  function exec_test(assert) {
    let done = assert.async(5);
    const testEvent = 'dummy';

    function modelUpdateInitTransition(model, eventData, actionResponse) {
      assert.deepEqual(model, initialModel,
        `On receiving an action response, the model update function is called 
        with the model's current value as its first parameter`);
      assert.deepEqual(eventData, dummyEventData,
        `On receiving an action response, the model update function is called 
        with the current triggering event's data as its second parameter`);
      assert.deepEqual(actionResponse, dummyDriverActionResponse,
        `On receiving an action response, the model update function is called 
        with the action response as its third parameter`);

      return opsOnInitialModel
    }

    const dummyActionRequest = {
      driver: dummyDriver,
      request: (model, eventData) => {
        assert.deepEqual(model, initialModel,
          `The request factory function is called with first parameter being 
          the model's current value`);
        assert.deepEqual(eventData, dummyEventData,
          `The request factory function is called with second parameter being 
          the data for the event triggering the action request`);

        return dummyRequest
      }
    };

    const events = {
      [testEvent]: sources => sources.eventSource.take(1)
    };

    const transitions = {
      [INIT_TRANSITION]: {
        origin_state: INIT_STATE,
        event: INIT_EVENT_NAME,
        target_states: [
          {
            event_guard: EV_GUARD_NONE,
            action_request: ACTION_REQUEST_NONE,
            transition_evaluation: [
              {
                action_guard: ACTION_GUARD_NONE,
                target_state: FIRST_STATE,
                model_update: modelUpdateIdentity
              }
            ]
          }
        ]
      },
      T1: {
        origin_state: FIRST_STATE,
        event: testEvent,
        target_states: [
          {
            event_guard: EV_GUARD_NONE,
            action_request: dummyActionRequest,
            transition_evaluation: [
              {
                action_guard: F,
                target_state: SECOND_STATE,
                model_update: modelUpdateInitTransition
              }
            ]
          }
        ]
      }
    };

    const entryComponents = {
      [FIRST_STATE]: function (model) {
        return curry(dummyComponent2Sink)(__, { model })
      },
      [SECOND_STATE]: function (model) {
        return curry(dummyComponent1Sink)(__, { model })
      },
    };

    const fsmSettings = {
      initial_model: initialModel,
      init_event_data: initEventData,
      sinkNames: sinkNames
    };

    const fsmComponent = makeFSM(events, transitions, entryComponents, fsmSettings);

    const inputs = [
      { [dummyDriver]: { diagram: '----a|', values: { a: dummyDriverActionResponse } } },
      { eventSource: { diagram: '---a-|', values: { a: dummyEventData } } },
      {
        sinkA: {
          diagram: 'ABC|',
          values: { A: dummySinkA3Values[0], B: dummySinkA3Values[1], C: dummySinkA3Values[2] }
        }
      }
    ];

    function analyzeTestResults(actual, expected, message) {
      assert.deepEqual(actual, expected, message);
      done()
    }

    let updatedModel = clone(initialModel);
    // NOTE: !! modifies in place so function does not return anything
    jsonpatch.apply(/*OUT*/updatedModel, opsOnInitialModel);

    /** @type TestResults */
    const testResults = {
      sinkA: {
        outputs: ['dummyComponent2_dummySinkA1', makeErrorMessage(CONTRACT_SATISFIED_GUARD_PER_ACTION_RESPONSE)],
        successMessage: 'sink sinkA produces the expected values',
        analyzeTestResults: analyzeTestResults,
      },
      sinkB: {
        outputs: [makeErrorMessage(CONTRACT_SATISFIED_GUARD_PER_ACTION_RESPONSE)],
        successMessage: 'sink sinkB produces the expected values',
        analyzeTestResults: analyzeTestResults,
      },
      modelSink: {
        outputs: [initialModel, makeErrorMessage(CONTRACT_SATISFIED_GUARD_PER_ACTION_RESPONSE)],
        successMessage: 'sink modelSink produces the expected values',
        analyzeTestResults: analyzeTestResults,
      },
      [dummyDriver]: {
        outputs: [dummyRequest, makeErrorMessage(CONTRACT_SATISFIED_GUARD_PER_ACTION_RESPONSE)],
        successMessage: 'sink dummyDriver produces the expected values',
        analyzeTestResults: analyzeTestResults,
      },
      sinkC: {
        outputs: [makeErrorMessage(CONTRACT_SATISFIED_GUARD_PER_ACTION_RESPONSE)],
        successMessage: 'sink sinkC produces no values as expected',
        analyzeTestResults: analyzeTestResults,
      },
    };

    runTestScenario(inputs, testResults, fsmComponent, {
      tickDuration: 5,
      // We put a large value here as there is no inputs, so this allows to
      // wait for the tested component to produce all its sink values
      waitForFinishDelay: 200
    })

  });

QUnit.test(
  "Event triggers a transition with an action request - fulfilled event guard - default passing" +
  " action guard",
  function exec_test(assert) {
    let done = assert.async(5);
    const testEvent = 'dummy';

    function modelUpdateInitTransition(model, eventData, actionResponse) {
      assert.deepEqual(model, initialModel,
        `On receiving an action response, the model update function is called 
        with the model's current value as its first parameter`);
      assert.deepEqual(eventData, dummyEventData,
        `On receiving an action response, the model update function is called 
        with the current triggering event's data as its second parameter`);
      assert.deepEqual(actionResponse, dummyDriverActionResponse,
        `On receiving an action response, the model update function is called 
        with the action response as its third parameter`);

      return opsOnInitialModel
    }

    const dummyActionRequest = {
      driver: dummyDriver,
      request: (model, eventData) => {
        assert.deepEqual(model, initialModel,
          `The request factory function is called with first parameter being 
          the model's current value`);
        assert.deepEqual(eventData, dummyEventData,
          `The request factory function is called with second parameter being 
          the data for the event triggering the action request`);

        return dummyRequest
      }
    };

    const events = {
      [testEvent]: sources => sources.eventSource.take(1)
    };

    const transitions = {
      [INIT_TRANSITION]: {
        origin_state: INIT_STATE,
        event: INIT_EVENT_NAME,
        target_states: [
          {
            event_guard: EV_GUARD_NONE,
            action_request: ACTION_REQUEST_NONE,
            transition_evaluation: [
              {
                action_guard: ACTION_GUARD_NONE,
                target_state: FIRST_STATE,
                model_update: modelUpdateIdentity
              }
            ]
          }
        ]
      },
      T1: {
        origin_state: FIRST_STATE,
        event: testEvent,
        target_states: [
          {
            event_guard: T,
            action_request: dummyActionRequest,
            transition_evaluation: [
              {
                action_guard: ACTION_GUARD_NONE,
                target_state: SECOND_STATE,
                model_update: modelUpdateInitTransition
              }
            ]
          }
        ]
      }
    };

    const entryComponents = {
      [FIRST_STATE]: function (model) {
        return curry(dummyComponent2Sink)(__, { model })
      },
      [SECOND_STATE]: function (model) {
        return curry(dummyComponent1Sink)(__, { model })
      },
    };

    const fsmSettings = {
      initial_model: initialModel,
      init_event_data: initEventData,
      sinkNames: sinkNames
    };

    const fsmComponent = makeFSM(events, transitions, entryComponents, fsmSettings);

    const inputs = [
      { eventSource: { diagram: '---a-|', values: { a: dummyEventData } } },
      { [dummyDriver]: { diagram: '----a|', values: { a: dummyDriverActionResponse } } },
      { sinkA: { diagram: '012---012|', values: dummySinkA3Values } },
      { sinkB: { diagram: '01----01-|', values: dummySinkB2Values } },
    ];

    function analyzeTestResults(actual, expected, message) {
      assert.deepEqual(actual, expected, message);
      done()
    }

    let updatedModel = clone(initialModel);
    // NOTE: !! modifies in place so function does not return anything
    jsonpatch.apply(/*OUT*/updatedModel, opsOnInitialModel);

    /** @type TestResults */
    const testResults = {
      sinkA: {
        outputs: flatten(['dummyComponent2_dummySinkA1', dummySinkA3Values]),
        successMessage: 'sink sinkA produces the expected values',
        analyzeTestResults: analyzeTestResults,
      },
      sinkB: {
        outputs: dummySinkB2Values,
        successMessage: 'sink sinkB produces the expected values',
        analyzeTestResults: analyzeTestResults,
      },
      modelSink: {
        outputs: [initialModel, updatedModel],
        successMessage: 'sink modelSink produces the expected values',
        analyzeTestResults: analyzeTestResults,
      },
      [dummyDriver]: {
        outputs: [dummyRequest],
        successMessage: 'sink dummyDriver produces the expected values',
        analyzeTestResults: analyzeTestResults,
      },
      sinkC: {
        outputs: [],
        successMessage: 'sink sinkC produces no values as expected',
        analyzeTestResults: analyzeTestResults,
      },
    };

    runTestScenario(inputs, testResults, fsmComponent, {
      tickDuration: 5,
      // We put a large value here as there is no inputs, so this allows to
      // wait for the tested component to produce all its sink values
      waitForFinishDelay: 200
    })

  });

QUnit.test(
  "Event triggers a transition with an action request - fulfilled event guard - 1 passing, 1" +
  " failing action guard in that order",
  function exec_test(assert) {
    let done = assert.async(5);
    const testEvent = 'dummy';

    function modelUpdateInitTransition(model, eventData, actionResponse) {
      assert.deepEqual(model, initialModel,
        `On receiving an action response, the model update function is called 
        with the model's current value as its first parameter`);
      assert.deepEqual(eventData, dummyEventData,
        `On receiving an action response, the model update function is called 
        with the current triggering event's data as its second parameter`);
      assert.deepEqual(actionResponse, dummyDriverActionResponse,
        `On receiving an action response, the model update function is called 
        with the action response as its third parameter`);

      return opsOnInitialModel
    }

    const dummyActionRequest = {
      driver: dummyDriver,
      request: (model, eventData) => {
        assert.deepEqual(model, initialModel,
          `The request factory function is called with first parameter being 
          the model's current value`);
        assert.deepEqual(eventData, dummyEventData,
          `The request factory function is called with second parameter being 
          the data for the event triggering the action request`);

        return dummyRequest
      }
    };

    const events = {
      [testEvent]: sources => sources.eventSource.take(1)
    };

    const transitions = {
      [INIT_TRANSITION]: {
        origin_state: INIT_STATE,
        event: INIT_EVENT_NAME,
        target_states: [
          {
            event_guard: EV_GUARD_NONE,
            action_request: ACTION_REQUEST_NONE,
            transition_evaluation: [
              {
                action_guard: F,
                target_state: FIRST_STATE,
                model_update: modelUpdateIdentity,
              },
            ]
          }
        ]
      },
      T1: {
        origin_state: FIRST_STATE,
        event: testEvent,
        target_states: [
          {
            event_guard: T,
            action_request: dummyActionRequest,
            transition_evaluation: [
              {
                action_guard: F,
                target_state: SECOND_STATE,
                model_update: identity
              },
              {
                action_guard: T,
                target_state: SECOND_STATE,
                model_update: modelUpdateInitTransition
              }
            ]
          }
        ]
      }
    };

    const entryComponents = {
      [FIRST_STATE]: function (model) {
        return curry(dummyComponent2Sink)(__, { model })
      },
      [SECOND_STATE]: function (model) {
        return curry(dummyComponent1Sink)(__, { model })
      },
    };

    const fsmSettings = {
      initial_model: initialModel,
      init_event_data: initEventData,
      sinkNames: sinkNames
    };

    const fsmComponent = makeFSM(events, transitions, entryComponents, fsmSettings);

    const inputs = [
      { eventSource: { diagram: '---a-|', values: { a: dummyEventData } } },
      { [dummyDriver]: { diagram: '----a|', values: { a: dummyDriverActionResponse } } },
      { sinkA: { diagram: '012---012|', values: dummySinkA3Values } },
      { sinkB: { diagram: '01----01-|', values: dummySinkB2Values } },
    ];

    function analyzeTestResults(actual, expected, message) {
      assert.deepEqual(actual, expected, message);
      done()
    }

    let updatedModel = clone(initialModel);
    // NOTE: !! modifies in place so function does not return anything
    jsonpatch.apply(/*OUT*/updatedModel, opsOnInitialModel);

    /** @type TestResults */
    const testResults = {
      sinkA: {
        outputs: flatten(['dummyComponent2_dummySinkA1', dummySinkA3Values]),
        successMessage: 'sink sinkA produces the expected values',
        analyzeTestResults: analyzeTestResults,
      },
      sinkB: {
        outputs: dummySinkB2Values,
        successMessage: 'sink sinkB produces the expected values',
        analyzeTestResults: analyzeTestResults,
      },
      modelSink: {
        outputs: [initialModel, updatedModel],
        successMessage: 'sink modelSink produces the expected values',
        analyzeTestResults: analyzeTestResults,
      },
      [dummyDriver]: {
        outputs: [dummyRequest],
        successMessage: 'sink dummyDriver produces the expected values',
        analyzeTestResults: analyzeTestResults,
      },
      sinkC: {
        outputs: [],
        successMessage: 'sink sinkC produces no values as expected',
        analyzeTestResults: analyzeTestResults,
      },
    };

    runTestScenario(inputs, testResults, fsmComponent, {
      tickDuration: 5,
      // We put a large value here as there is no inputs, so this allows to
      // wait for the tested component to produce all its sink values
      waitForFinishDelay: 200
    })

  });

QUnit.test(
  "Event triggers a transition with an action request - fulfilled event guard - 2 passing action" +
  " guards : only first one is executed",
  function exec_test(assert) {
    let done = assert.async(5);
    const testEvent = 'dummy';

    function modelUpdateInitTransition(model, eventData, actionResponse) {
      assert.deepEqual(model, initialModel,
        `On receiving an action response, the model update function is called 
        with the model's current value as its first parameter`);
      assert.deepEqual(eventData, dummyEventData,
        `On receiving an action response, the model update function is called 
        with the current triggering event's data as its second parameter`);
      assert.deepEqual(actionResponse, dummyDriverActionResponse,
        `On receiving an action response, the model update function is called 
        with the action response as its third parameter`);

      return opsOnInitialModel
    }

    function modelUpdateInitTransitionNotCalled(model, eventData, actionResponse) {
      assert.throws(() => {
        throw "error"
      }, `This function should not be called!`);

      return opsOnInitialModel
    }

    const dummyActionRequest = {
      driver: dummyDriver,
      request: (model, eventData) => {
        assert.deepEqual(model, initialModel,
          `The request factory function is called with first parameter being 
          the model's current value`);
        assert.deepEqual(eventData, dummyEventData,
          `The request factory function is called with second parameter being 
          the data for the event triggering the action request`);

        return dummyRequest
      }
    };

    const events = {
      [testEvent]: sources => sources.eventSource.take(1)
    };

    const transitions = {
      [INIT_TRANSITION]: {
        origin_state: INIT_STATE,
        event: INIT_EVENT_NAME,
        target_states: [
          {
            event_guard: EV_GUARD_NONE,
            action_request: ACTION_REQUEST_NONE,
            transition_evaluation: [
              {
                action_guard: F,
                target_state: FIRST_STATE,
                model_update: modelUpdateIdentity,
              },
            ]
          }
        ]
      },
      T1: {
        origin_state: FIRST_STATE,
        event: testEvent,
        target_states: [
          {
            event_guard: T,
            action_request: dummyActionRequest,
            transition_evaluation: [
              {
                action_guard: T,
                target_state: SECOND_STATE,
                model_update: modelUpdateInitTransition
              },
              {
                action_guard: T,
                target_state: THIRD_STATE,
                model_update: modelUpdateInitTransitionNotCalled
              }
            ]
          }
        ]
      }
    };

    const entryComponents = {
      [FIRST_STATE]: function (model) {
        return curry(dummyComponent2Sink)(__, { model })
      },
      [SECOND_STATE]: function (model) {
        return curry(dummyComponent1Sink)(__, { model })
      },
      [THIRD_STATE]: function (model) {
        return curry(dummyComponent1Sink)(__, { model })
      },
    };

    const fsmSettings = {
      initial_model: initialModel,
      init_event_data: initEventData,
      sinkNames: sinkNames
    };

    const fsmComponent = makeFSM(events, transitions, entryComponents, fsmSettings);

    const inputs = [
      { eventSource: { diagram: '---a-|', values: { a: dummyEventData } } },
      { [dummyDriver]: { diagram: '----a|', values: { a: dummyDriverActionResponse } } },
      { sinkA: { diagram: '012---012|', values: dummySinkA3Values } },
      { sinkB: { diagram: '01----01-|', values: dummySinkB2Values } },
    ];

    function analyzeTestResults(actual, expected, message) {
      assert.deepEqual(actual, expected, message);
      done()
    }

    let updatedModel = clone(initialModel);
    // NOTE: !! modifies in place so function does not return anything
    jsonpatch.apply(/*OUT*/updatedModel, opsOnInitialModel);

    /** @type TestResults */
    const testResults = {
      sinkA: {
        outputs: flatten(['dummyComponent2_dummySinkA1', dummySinkA3Values]),
        successMessage: 'sink sinkA produces the expected values',
        analyzeTestResults: analyzeTestResults,
      },
      sinkB: {
        outputs: dummySinkB2Values,
        successMessage: 'sink sinkB produces the expected values',
        analyzeTestResults: analyzeTestResults,
      },
      modelSink: {
        outputs: [initialModel, updatedModel],
        successMessage: 'sink modelSink produces the expected values',
        analyzeTestResults: analyzeTestResults,
      },
      [dummyDriver]: {
        outputs: [dummyRequest],
        successMessage: 'sink dummyDriver produces the expected values',
        analyzeTestResults: analyzeTestResults,
      },
      sinkC: {
        outputs: [],
        successMessage: 'sink sinkC produces no values as expected',
        analyzeTestResults: analyzeTestResults,
      },
    };

    runTestScenario(inputs, testResults, fsmComponent, {
      tickDuration: 5,
      // We put a large value here as there is no inputs, so this allows to
      // wait for the tested component to produce all its sink values
      waitForFinishDelay: 200
    })

  });

QUnit.test(
  "Event triggers a transition with an action request - failing event guard - default action" +
  " guard",
  function exec_test(assert) {
    let done = assert.async(5);
    const testEvent = 'dummy';

    function modelUpdateInitTransition(model, eventData, actionResponse) {
      assert.deepEqual(model, initialModel,
        `On receiving an action response, the model update function is called 
        with the model's current value as its first parameter`);
      assert.deepEqual(eventData, dummyEventData,
        `On receiving an action response, the model update function is called 
        with the current triggering event's data as its second parameter`);
      assert.deepEqual(actionResponse, dummyDriverActionResponse,
        `On receiving an action response, the model update function is called 
        with the action response as its third parameter`);

      return opsOnInitialModel
    }

    const dummyActionRequest = {
      driver: dummyDriver,
      request: (model, eventData) => {
        assert.deepEqual(model, initialModel,
          `The request factory function is called with first parameter being 
          the model's current value`);
        assert.deepEqual(eventData, dummyEventData,
          `The request factory function is called with second parameter being 
          the data for the event triggering the action request`);

        return dummyRequest
      }
    };

    const events = {
      [testEvent]: sources => sources.eventSource.take(1)
    };

    const transitions = {
      [INIT_TRANSITION]: {
        origin_state: INIT_STATE,
        event: INIT_EVENT_NAME,
        target_states: [
          {
            event_guard: EV_GUARD_NONE,
            action_request: ACTION_REQUEST_NONE,
            transition_evaluation: [
              {
                action_guard: ACTION_GUARD_NONE,
                target_state: FIRST_STATE,
                model_update: modelUpdateIdentity
              }
            ]
          }
        ]
      },
      T1: {
        origin_state: FIRST_STATE,
        event: testEvent,
        target_states: [
          {
            event_guard: F,
            action_request: dummyActionRequest,
            transition_evaluation: [
              {
                action_guard: ACTION_GUARD_NONE,
                target_state: SECOND_STATE,
                model_update: modelUpdateInitTransition
              }
            ]
          }
        ]
      }
    };

    const entryComponents = {
      [FIRST_STATE]: function (model) {
        return curry(dummyComponent2Sink)(__, { model })
      },
      [SECOND_STATE]: function (model) {
        return curry(dummyComponent1Sink)(__, { model })
      },
    };

    const fsmSettings = {
      initial_model: initialModel,
      init_event_data: initEventData,
      sinkNames: sinkNames
    };

    const fsmComponent = makeFSM(events, transitions, entryComponents, fsmSettings);

    const inputs = [
      { eventSource: { diagram: '---a-|', values: { a: dummyEventData } } },
      { [dummyDriver]: { diagram: '----a|', values: { a: dummyDriverActionResponse } } },
      { sinkA: { diagram: '012---012|', values: dummySinkA3Values } },
      { sinkB: { diagram: '01----01-|', values: dummySinkB2Values } },
    ];

    function analyzeTestResults(actual, expected, message) {
      assert.deepEqual(actual, expected, message);
      done()
    }

    let updatedModel = clone(initialModel);
    // NOTE: !! modifies in place so function does not return anything
    jsonpatch.apply(/*OUT*/updatedModel, opsOnInitialModel);

    /** @type TestResults */
    const testResults = {
      sinkA: {
        outputs: ['dummyComponent2_dummySinkA1'],
        successMessage: 'sink sinkA produces the expected values',
        analyzeTestResults: analyzeTestResults,
      },
      sinkB: {
        outputs: [],
        successMessage: 'sink sinkB produces the expected values',
        analyzeTestResults: analyzeTestResults,
      },
      modelSink: {
        outputs: [initialModel],
        successMessage: 'sink modelSink produces the expected values',
        analyzeTestResults: analyzeTestResults,
      },
      [dummyDriver]: {
        outputs: [],
        successMessage: 'sink dummyDriver produces the expected values',
        analyzeTestResults: analyzeTestResults,
      },
      sinkC: {
        outputs: [],
        successMessage: 'sink sinkC produces no values as expected',
        analyzeTestResults: analyzeTestResults,
      },
    };

    runTestScenario(inputs, testResults, fsmComponent, {
      tickDuration: 5,
      // We put a large value here as there is no inputs, so this allows to
      // wait for the tested component to produce all its sink values
      waitForFinishDelay: 200
    })

  });

QUnit.test(
  "Event triggers a transition with an action request - failing, and fulfilled event guard in" +
  " that order - default action guard",
  function exec_test(assert) {
    let done = assert.async(5);
    const testEvent = 'dummy';

    function modelUpdateInitTransition(model, eventData, actionResponse) {
      assert.deepEqual(model, initialModel,
        `On receiving an action response, the model update function is called 
        with the model's current value as its first parameter`);
      assert.deepEqual(eventData, dummyEventData,
        `On receiving an action response, the model update function is called 
        with the current triggering event's data as its second parameter`);
      assert.deepEqual(actionResponse, dummyDriverActionResponse,
        `On receiving an action response, the model update function is called 
        with the action response as its third parameter`);

      return opsOnInitialModel
    }

    const dummyActionRequest = {
      driver: dummyDriver,
      request: (model, eventData) => {
        assert.deepEqual(model, initialModel,
          `The request factory function is called with first parameter being 
          the model's current value`);
        assert.deepEqual(eventData, dummyEventData,
          `The request factory function is called with second parameter being 
          the data for the event triggering the action request`);

        return dummyRequest
      }
    };

    const events = {
      [testEvent]: sources => sources.eventSource.take(1)
    };

    const transitions = {
      [INIT_TRANSITION]: {
        origin_state: INIT_STATE,
        event: INIT_EVENT_NAME,
        target_states: [
          {
            event_guard: EV_GUARD_NONE,
            action_request: ACTION_REQUEST_NONE,
            transition_evaluation: [
              {
                action_guard: ACTION_GUARD_NONE,
                target_state: FIRST_STATE,
                model_update: modelUpdateIdentity
              }
            ]
          }
        ]
      },
      T1: {
        origin_state: FIRST_STATE,
        event: testEvent,
        target_states: [
          {
            event_guard: F,
            action_request: dummyActionRequest,
            transition_evaluation: [
              {
                action_guard: T,
                target_state: THIRD_STATE,
                model_update: identity
              }
            ]
          },
          {
            event_guard: T,
            action_request: dummyActionRequest,
            transition_evaluation: [
              {
                action_guard: ACTION_GUARD_NONE,
                target_state: SECOND_STATE,
                model_update: modelUpdateInitTransition
              }
            ]
          }
        ]
      }
    };

    const entryComponents = {
      [FIRST_STATE]: function (model) {
        return curry(dummyComponent2Sink)(__, { model })
      },
      [SECOND_STATE]: function (model) {
        return curry(dummyComponent1Sink)(__, { model })
      },
      [THIRD_STATE]: function (model) {
        return curry(dummyComponent1Sink)(__, { model })
      },
    };

    const fsmSettings = {
      initial_model: initialModel,
      init_event_data: initEventData,
      sinkNames: sinkNames
    };

    const fsmComponent = makeFSM(events, transitions, entryComponents, fsmSettings);

    const inputs = [
      { eventSource: { diagram: '---a-|', values: { a: dummyEventData } } },
      { [dummyDriver]: { diagram: '----a|', values: { a: dummyDriverActionResponse } } },
      { sinkA: { diagram: '012---012|', values: dummySinkA3Values } },
      { sinkB: { diagram: '01----01-|', values: dummySinkB2Values } },
    ];

    function analyzeTestResults(actual, expected, message) {
      assert.deepEqual(actual, expected, message);
      done()
    }

    let updatedModel = clone(initialModel);
    // NOTE: !! modifies in place so function does not return anything
    jsonpatch.apply(/*OUT*/updatedModel, opsOnInitialModel);

    /** @type TestResults */
    const testResults = {
      sinkA: {
        outputs: flatten(['dummyComponent2_dummySinkA1', dummySinkA3Values]),
        successMessage: 'sink sinkA produces the expected values',
        analyzeTestResults: analyzeTestResults,
      },
      sinkB: {
        outputs: dummySinkB2Values,
        successMessage: 'sink sinkB produces the expected values',
        analyzeTestResults: analyzeTestResults,
      },
      modelSink: {
        outputs: [initialModel, updatedModel],
        successMessage: 'sink modelSink produces the expected values',
        analyzeTestResults: analyzeTestResults,
      },
      [dummyDriver]: {
        outputs: [dummyRequest],
        successMessage: 'sink dummyDriver produces the expected values',
        analyzeTestResults: analyzeTestResults,
      },
      sinkC: {
        outputs: [],
        successMessage: 'sink sinkC produces no values as expected',
        analyzeTestResults: analyzeTestResults,
      },
    };

    runTestScenario(inputs, testResults, fsmComponent, {
      tickDuration: 5,
      // We put a large value here as there is no inputs, so this allows to
      // wait for the tested component to produce all its sink values
      waitForFinishDelay: 200
    })

  });

QUnit.test(
  "Event triggers a transition with an action request - fulfilled, and failing event guard in" +
  " that order - default action guard",
  function exec_test(assert) {
    let done = assert.async(5);
    const testEvent = 'dummy';

    function modelUpdateInitTransition(model, eventData, actionResponse) {
      assert.deepEqual(model, initialModel,
        `On receiving an action response, the model update function is called 
        with the model's current value as its first parameter`);
      assert.deepEqual(eventData, dummyEventData,
        `On receiving an action response, the model update function is called 
        with the current triggering event's data as its second parameter`);
      assert.deepEqual(actionResponse, dummyDriverActionResponse,
        `On receiving an action response, the model update function is called 
        with the action response as its third parameter`);

      return opsOnInitialModel
    }

    const dummyActionRequest = {
      driver: dummyDriver,
      request: (model, eventData) => {
        assert.deepEqual(model, initialModel,
          `The request factory function is called with first parameter being 
          the model's current value`);
        assert.deepEqual(eventData, dummyEventData,
          `The request factory function is called with second parameter being 
          the data for the event triggering the action request`);

        return dummyRequest
      }
    };

    const events = {
      [testEvent]: sources => sources.eventSource.take(1)
    };

    const transitions = {
      [INIT_TRANSITION]: {
        origin_state: INIT_STATE,
        event: INIT_EVENT_NAME,
        target_states: [
          {
            event_guard: EV_GUARD_NONE,
            action_request: ACTION_REQUEST_NONE,
            transition_evaluation: [
              {
                action_guard: ACTION_GUARD_NONE,
                target_state: FIRST_STATE,
                model_update: modelUpdateIdentity
              }
            ]
          }
        ]
      },
      T1: {
        origin_state: FIRST_STATE,
        event: testEvent,
        target_states: [
          {
            event_guard: T,
            action_request: dummyActionRequest,
            transition_evaluation: [
              {
                action_guard: T,
                target_state: SECOND_STATE,
                model_update: modelUpdateInitTransition
              }
            ]
          },
          {
            event_guard: F,
            action_request: dummyActionRequest,
            transition_evaluation: [
              {
                action_guard: ACTION_GUARD_NONE,
                target_state: THIRD_STATE,
                model_update: identity
              }
            ]
          }
        ]
      }
    };

    const entryComponents = {
      [FIRST_STATE]: function (model) {
        return curry(dummyComponent2Sink)(__, { model })
      },
      [SECOND_STATE]: function (model) {
        return curry(dummyComponent1Sink)(__, { model })
      },
      [THIRD_STATE]: function (model) {
        return curry(dummyComponent1Sink)(__, { model })
      },
    };

    const fsmSettings = {
      initial_model: initialModel,
      init_event_data: initEventData,
      sinkNames: sinkNames
    };

    const fsmComponent = makeFSM(events, transitions, entryComponents, fsmSettings);

    const inputs = [
      { eventSource: { diagram: '---a-|', values: { a: dummyEventData } } },
      { [dummyDriver]: { diagram: '----a|', values: { a: dummyDriverActionResponse } } },
      { sinkA: { diagram: '012---012|', values: dummySinkA3Values } },
      { sinkB: { diagram: '01----01-|', values: dummySinkB2Values } },
    ];

    function analyzeTestResults(actual, expected, message) {
      assert.deepEqual(actual, expected, message);
      done()
    }

    let updatedModel = clone(initialModel);
    // NOTE: !! modifies in place so function does not return anything
    jsonpatch.apply(/*OUT*/updatedModel, opsOnInitialModel);

    /** @type TestResults */
    const testResults = {
      sinkA: {
        outputs: flatten(['dummyComponent2_dummySinkA1', dummySinkA3Values]),
        successMessage: 'sink sinkA produces the expected values',
        analyzeTestResults: analyzeTestResults,
      },
      sinkB: {
        outputs: dummySinkB2Values,
        successMessage: 'sink sinkB produces the expected values',
        analyzeTestResults: analyzeTestResults,
      },
      modelSink: {
        outputs: [initialModel, updatedModel],
        successMessage: 'sink modelSink produces the expected values',
        analyzeTestResults: analyzeTestResults,
      },
      [dummyDriver]: {
        outputs: [dummyRequest],
        successMessage: 'sink dummyDriver produces the expected values',
        analyzeTestResults: analyzeTestResults,
      },
      sinkC: {
        outputs: [],
        successMessage: 'sink sinkC produces no values as expected',
        analyzeTestResults: analyzeTestResults,
      },
    };

    runTestScenario(inputs, testResults, fsmComponent, {
      tickDuration: 5,
      // We put a large value here as there is no inputs, so this allows to
      // wait for the tested component to produce all its sink values
      waitForFinishDelay: 200
    })

  });

QUnit.test(
  "Event triggers a transition with an action request - 2 fulfilled event guards - default" +
  " action guard : first guard's transition is taken",
  function exec_test(assert) {
    let done = assert.async(5);
    const testEvent = 'dummy';

    function modelUpdateInitTransition(model, eventData, actionResponse) {
      assert.deepEqual(model, initialModel,
        `On receiving an action response, the model update function is called 
        with the model's current value as its first parameter`);
      assert.deepEqual(eventData, dummyEventData,
        `On receiving an action response, the model update function is called 
        with the current triggering event's data as its second parameter`);
      assert.deepEqual(actionResponse, dummyDriverActionResponse,
        `On receiving an action response, the model update function is called 
        with the action response as its third parameter`);

      return opsOnInitialModel
    }

    const dummyActionRequest = {
      driver: dummyDriver,
      request: (model, eventData) => {
        assert.deepEqual(model, initialModel,
          `The request factory function is called with first parameter being 
          the model's current value`);
        assert.deepEqual(eventData, dummyEventData,
          `The request factory function is called with second parameter being 
          the data for the event triggering the action request`);

        return dummyRequest
      }
    };

    const events = {
      [testEvent]: sources => sources.eventSource.take(1)
    };

    const transitions = {
      [INIT_TRANSITION]: {
        origin_state: INIT_STATE,
        event: INIT_EVENT_NAME,
        target_states: [
          {
            event_guard: EV_GUARD_NONE,
            action_request: ACTION_REQUEST_NONE,
            transition_evaluation: [
              {
                action_guard: ACTION_GUARD_NONE,
                target_state: FIRST_STATE,
                model_update: modelUpdateIdentity
              }
            ]
          }
        ]
      },
      T1: {
        origin_state: FIRST_STATE,
        event: testEvent,
        target_states: [
          {
            event_guard: T,
            action_request: dummyActionRequest,
            transition_evaluation: [
              {
                action_guard: T,
                target_state: SECOND_STATE,
                model_update: modelUpdateInitTransition
              }
            ]
          },
          {
            event_guard: T,
            action_request: dummyActionRequest,
            transition_evaluation: [
              {
                action_guard: ACTION_GUARD_NONE,
                target_state: THIRD_STATE,
                model_update: identity
              }
            ]
          }
        ]
      }
    };

    const entryComponents = {
      [FIRST_STATE]: function (model) {
        return curry(dummyComponent2Sink)(__, { model })
      },
      [SECOND_STATE]: function (model) {
        return curry(dummyComponent1Sink)(__, { model })
      },
      [THIRD_STATE]: function (model) {
        return curry(dummyComponent1Sink)(__, { model })
      },
    };

    const fsmSettings = {
      initial_model: initialModel,
      init_event_data: initEventData,
      sinkNames: sinkNames
    };

    const fsmComponent = makeFSM(events, transitions, entryComponents, fsmSettings);

    const inputs = [
      { eventSource: { diagram: '---a-|', values: { a: dummyEventData } } },
      { [dummyDriver]: { diagram: '----a|', values: { a: dummyDriverActionResponse } } },
      { sinkA: { diagram: '012---012|', values: dummySinkA3Values } },
      { sinkB: { diagram: '01----01-|', values: dummySinkB2Values } },
    ];

    function analyzeTestResults(actual, expected, message) {
      assert.deepEqual(actual, expected, message);
      done()
    }

    let updatedModel = clone(initialModel);
    // NOTE: !! modifies in place so function does not return anything
    jsonpatch.apply(/*OUT*/updatedModel, opsOnInitialModel);

    /** @type TestResults */
    const testResults = {
      sinkA: {
        outputs: flatten(['dummyComponent2_dummySinkA1', dummySinkA3Values]),
        successMessage: 'sink sinkA produces the expected values',
        analyzeTestResults: analyzeTestResults,
      },
      sinkB: {
        outputs: dummySinkB2Values,
        successMessage: 'sink sinkB produces the expected values',
        analyzeTestResults: analyzeTestResults,
      },
      modelSink: {
        outputs: [initialModel, updatedModel],
        successMessage: 'sink modelSink produces the expected values',
        analyzeTestResults: analyzeTestResults,
      },
      [dummyDriver]: {
        outputs: [dummyRequest],
        successMessage: 'sink dummyDriver produces the expected values',
        analyzeTestResults: analyzeTestResults,
      },
      sinkC: {
        outputs: [],
        successMessage: 'sink sinkC produces no values as expected',
        analyzeTestResults: analyzeTestResults,
      },
    };

    runTestScenario(inputs, testResults, fsmComponent, {
      tickDuration: 5,
      // We put a large value here as there is no inputs, so this allows to
      // wait for the tested component to produce all its sink values
      waitForFinishDelay: 200
    })

  });

QUnit.test(
  "Event triggers a transition - action request - receiving response from another driver" +
  " not mentioned in an action request : same as if no response received",
  function exec_test(assert) {
    let done = assert.async(5);
    const testEvent = 'dummy';

    function modelUpdateInitTransition(model, eventData, actionResponse) {
      assert.deepEqual(model, initialModel,
        `On receiving an action response, the model update function is called 
        with the model's current value as its first parameter`);
      assert.deepEqual(eventData, dummyEventData,
        `On receiving an action response, the model update function is called 
        with the current triggering event's data as its second parameter`);
      assert.deepEqual(actionResponse, dummyDriverActionResponse,
        `On receiving an action response, the model update function is called 
        with the action response as its third parameter`);

      return opsOnInitialModel
    }

    const dummyActionRequest = {
      driver: dummyDriver,
      request: (model, eventData) => {
        assert.deepEqual(model, initialModel,
          `The request factory function is called with first parameter being 
          the model's current value`);
        assert.deepEqual(eventData, dummyEventData,
          `The request factory function is called with second parameter being 
          the data for the event triggering the action request`);

        return dummyRequest
      }
    };

    const events = {
      [testEvent]: sources => sources.eventSource.take(1)
    };

    const transitions = {
      [INIT_TRANSITION]: {
        origin_state: INIT_STATE,
        event: INIT_EVENT_NAME,
        target_states: [
          {
            event_guard: EV_GUARD_NONE,
            action_request: ACTION_REQUEST_NONE,
            transition_evaluation: [
              {
                action_guard: ACTION_GUARD_NONE,
                target_state: FIRST_STATE,
                model_update: modelUpdateIdentity
              }
            ]
          }
        ]
      },
      T1: {
        origin_state: FIRST_STATE,
        event: testEvent,
        target_states: [
          {
            event_guard: EV_GUARD_NONE,
            action_request: dummyActionRequest,
            transition_evaluation: [
              {
                action_guard: T,
                target_state: SECOND_STATE,
                model_update: modelUpdateInitTransition
              }
            ]
          }
        ]
      }
    };

    const entryComponents = {
      [FIRST_STATE]: function (model) {
        return curry(dummyComponent2Sink)(__, { model })
      },
      [SECOND_STATE]: function (model) {
        return curry(dummyComponent1Sink)(__, { model })
      },
      [THIRD_STATE]: function (model) {
        return curry(dummyComponent1Sink)(__, { model })
      },
    };

    const fsmSettings = {
      initial_model: initialModel,
      init_event_data: initEventData,
      sinkNames: sinkNames
    };

    const fsmComponent = makeFSM(events, transitions, entryComponents, fsmSettings);

    const inputs = [
      { eventSource: { diagram: '---a-|', values: { a: dummyEventData } } },
      { [dummyDriver]: { diagram: '-----a|', values: { a: dummyDriverActionResponse } } },
      { sinkA: { diagram: '012---012|', values: dummySinkA3Values } },
      { sinkB: { diagram: '01----01-|', values: dummySinkB2Values } },
      { [dummyDriver + '2']: { diagram: '----a|', values: { a: dummyDriverActionResponse } } }
    ];

    function analyzeTestResults(actual, expected, message) {
      assert.deepEqual(actual, expected, message);
      done()
    }

    let updatedModel = clone(initialModel);
    // NOTE: !! modifies in place so function does not return anything
    jsonpatch.apply(/*OUT*/updatedModel, opsOnInitialModel);

    /** @type TestResults */
    const testResults = {
      sinkA: {
        outputs: flatten(['dummyComponent2_dummySinkA1', dummySinkA3Values]),
        successMessage: 'sink sinkA produces the expected values',
        analyzeTestResults: analyzeTestResults,
      },
      sinkB: {
        outputs: dummySinkB2Values,
        successMessage: 'sink sinkB produces the expected values',
        analyzeTestResults: analyzeTestResults,
      },
      modelSink: {
        outputs: [initialModel, updatedModel],
        successMessage: 'sink modelSink produces the expected values',
        analyzeTestResults: analyzeTestResults,
      },
      [dummyDriver]: {
        outputs: [dummyRequest],
        successMessage: 'sink dummyDriver produces the expected values',
        analyzeTestResults: analyzeTestResults,
      },
      sinkC: {
        outputs: [],
        successMessage: 'sink sinkC produces no values as expected',
        analyzeTestResults: analyzeTestResults,
      },
    };

    runTestScenario(inputs, testResults, fsmComponent, {
      tickDuration: 5,
      // We put a large value here as there is no inputs, so this allows to
      // wait for the tested component to produce all its sink values
      waitForFinishDelay: 200
    })

  });

QUnit.test(
  "Event triggers a transition - action request - receiving response from another driver" +
  " than the expected one : same as if no response received, but warning is issued",
  function exec_test(assert) {
    let done = assert.async(5);
    const testEvent = 'dummy';

    function modelUpdateInitTransition(model, eventData, actionResponse) {
      assert.deepEqual(model, initialModel,
        `On receiving init event, the model update function is called 
        with the model's current value as its first parameter`);
      assert.deepEqual(eventData, initEventData,
        `On receiving init event, the model update function is called 
        with the current triggering event's data as its second parameter`);
      assert.deepEqual(actionResponse, null,
        `On receiving init event, the model update function is called 
        with the action response as its third parameter`);

      return opsOnInitialModel
    }

    function modelUpdateDummyEventTransition(model, eventData, actionResponse) {
      assert.deepEqual(model, updatedModel,
        `On receiving an action response, the model update function is called 
        with the model's current value as its first parameter`);
      assert.deepEqual(eventData, dummyEventData,
        `On receiving an action response, the model update function is called 
        with the current triggering event's data as its second parameter`);
      assert.deepEqual(actionResponse, dummyDriverActionResponse,
        `On receiving an action response, the model update function is called 
        with the action response as its third parameter`);

      return opsOnUpdatedModel
    }

    const dummyActionRequest = {
      driver: dummyDriver,
      request: (model, eventData) => {
        assert.deepEqual(model, updatedModel,
          `The request factory function is called with first parameter being 
          the model's current value`);
        assert.deepEqual(eventData, dummyEventData,
          `The request factory function is called with second parameter being 
          the data for the event triggering the action request`);

        return dummyRequest
      }
    };
    const dummyActionRequest2 = {
      driver: dummyDriver + '2',
      request: (model, eventData) => {
        assert.deepEqual(model, initialModel,
          `The request factory function is called with first parameter being 
          the model's current value`);
        assert.deepEqual(eventData, dummyEventData,
          `The request factory function is called with second parameter being 
          the data for the event triggering the action request`);

        return dummyRequest
      }
    };

    const events = {
      [testEvent]: sources => sources.eventSource.take(1)
    };

    const transitions = {
      [INIT_TRANSITION]: {
        origin_state: INIT_STATE,
        event: INIT_EVENT_NAME,
        target_states: [
          {
            event_guard: EV_GUARD_NONE,
            action_request: ACTION_REQUEST_NONE,
            transition_evaluation: [
              {
                action_guard: ACTION_GUARD_NONE,
                target_state: FIRST_STATE,
                model_update: modelUpdateInitTransition
              }
            ]
          }
        ]
      },
      T1: {
        origin_state: FIRST_STATE,
        event: testEvent,
        target_states: [
          {
            event_guard: T,
            action_request: dummyActionRequest,
            transition_evaluation: [
              {
                action_guard: T,
                target_state: SECOND_STATE,
                model_update: modelUpdateDummyEventTransition
              }
            ]
          },
          {
            event_guard: F,
            action_request: dummyActionRequest2,
            transition_evaluation: [
              {
                action_guard: T,
                target_state: THIRD_STATE,
                model_update: modelUpdateIdentity
              }
            ]
          }
        ]
      }
    };

    const entryComponents = {
      [FIRST_STATE]: function (model) {
        return curry(dummyComponent2Sink)(__, { model })
      },
      [SECOND_STATE]: function (model) {
        return curry(dummyComponent1Sink)(__, { model })
      },
      [THIRD_STATE]: function (model) {
        return curry(dummyComponent1Sink)(__, { model })
      },
    };

    const fsmSettings = {
      initial_model: initialModel,
      init_event_data: initEventData,
      sinkNames: sinkNames
    };

    const fsmComponent = makeFSM(events, transitions, entryComponents, fsmSettings);

    const inputs = [
      { eventSource: { diagram: '---a-|', values: { a: dummyEventData } } },
      { [dummyDriver]: { diagram: '-----a|', values: { a: dummyDriverActionResponse } } },
      { sinkA: { diagram: '012---012|', values: dummySinkA3Values } },
      { sinkB: { diagram: '01----01-|', values: dummySinkB2Values } },
      { [dummyDriver + '2']: { diagram: '----a|', values: { a: dummyDriverActionResponse2 } } }
    ];

    function analyzeTestResults(actual, expected, message) {
      assert.deepEqual(actual, expected, message);
      done()
    }

    let updatedModel = clone(initialModel);
    // NOTE: !! modifies in place so function does not return anything
    jsonpatch.apply(/*OUT*/updatedModel, opsOnInitialModel);
    let updatedTwiceModel = clone(updatedModel);
    jsonpatch.apply(/*OUT*/updatedTwiceModel, opsOnUpdatedModel);

    /** @type TestResults */
    const testResults = {
      sinkA: {
        outputs: flatten(['dummyComponent2_dummySinkA1', dummySinkA3Values]),
        successMessage: 'sink sinkA produces the expected values',
        analyzeTestResults: analyzeTestResults,
      },
      sinkB: {
        outputs: dummySinkB2Values,
        successMessage: 'sink sinkB produces the expected values',
        analyzeTestResults: analyzeTestResults,
      },
      modelSink: {
        outputs: [updatedModel, updatedTwiceModel],
        successMessage: 'sink modelSink produces the expected values',
        analyzeTestResults: analyzeTestResults,
      },
      [dummyDriver]: {
        outputs: [dummyRequest],
        successMessage: 'sink dummyDriver produces the expected values',
        analyzeTestResults: analyzeTestResults,
      },
      sinkC: {
        outputs: [],
        successMessage: 'sink sinkC produces no values as expected',
        analyzeTestResults: analyzeTestResults,
      },
    };

    runTestScenario(inputs, testResults, fsmComponent, {
      tickDuration: 10,
      // We put a large value here as there is no inputs, so this allows to
      // wait for the tested component to produce all its sink values
      waitForFinishDelay: 200
    })

  });

QUnit.module("makeFSM :: Events -> Transitions -> StateEntryComponents -> FSM_Settings ->" +
  " Component :: Error handling and edge cases", {});

QUnit.test(
  "Empty event object : init event should fire, and lead to the corresponding configured state",
  function exec_test(assert) {
    let done = assert.async(5);

    function modelUpdateInitTransition(model, eventData, actionResponse) {
      assert.deepEqual(model, initialModel,
        'The INIT event triggers a call to the configured update' +
        ' model function, whose first parameter is the initial' +
        ' model');
      assert.deepEqual(eventData, initEventData,
        'The INIT event triggers a call to the configured update' +
        ' model function, whose second parameter is the ' +
        ' event data for the INIT event');
      assert.deepEqual(actionResponse, null,
        'The INIT event triggers a call to the configured update' +
        ' model function, whose third parameter is the ' +
        ' response for the action corresponding to the transition');

      return opsOnInitialModel
    }

    const events = {};

    const transitions = {
      T_INIT: {
        origin_state: INIT_STATE,
        event: INIT_EVENT_NAME,
        target_states: [
          {
            event_guard: EV_GUARD_NONE,
            action_request: ACTION_REQUEST_NONE,
            transition_evaluation: [
              {
                action_guard: ACTION_GUARD_NONE,
                target_state: 'First',
                model_update: modelUpdateInitTransition
              }
            ]
          }
        ]
      }
    };

    const entryComponents = {
      First: function (model) {
        return curry(dummyComponent1Sink)(__, { model })
      }
    };

    const fsmSettings = {
      initial_model: initialModel,
      init_event_data: initEventData,
      sinkNames: sinkNames
    };

    const fsmComponent = makeFSM(events, transitions, entryComponents, fsmSettings);

    const inputs = [
      { eventSource: { diagram: '---a-|', values: { a: dummyEventData } } },
      { [dummyDriver]: { diagram: '----a|', values: { a: dummyDriverActionResponse } } },
      { sinkA: { diagram: '012---012|', values: dummySinkA3Values } },
      { sinkB: { diagram: '01----01-|', values: dummySinkB2Values } },
    ];

    function analyzeTestResults(actual, expected, message) {
      assert.deepEqual(actual, expected, message);
      done()
    }

    let updatedModel = clone(initialModel);
    // NOTE: !! modifies in place so function does not return anything
    jsonpatch.apply(/*OUT*/updatedModel, opsOnInitialModel);

    /** @type TestResults */
    const testResults = {
      sinkA: {
        outputs: dummySinkA3Values,
        successMessage: 'sink sinkA produces the expected values',
        analyzeTestResults: analyzeTestResults,
      },
      sinkB: {
        outputs: dummySinkB2Values,
        successMessage: 'sink sinkB produces the expected values',
        analyzeTestResults: analyzeTestResults,
      },
      modelSink: {
        outputs: [updatedModel],
        successMessage: 'sink modelSink produces the expected values',
        analyzeTestResults: analyzeTestResults,
      },
      [dummyDriver]: {
        outputs: [],
        successMessage: 'sink drivers_dummy produces no values as expected',
        analyzeTestResults: analyzeTestResults,
      },
      sinkC: {
        outputs: [],
        successMessage: 'sink sinkC produces no values as expected',
        analyzeTestResults: analyzeTestResults,
      },
    };

    runTestScenario(inputs, testResults, fsmComponent, {
      tickDuration: 5,
      // We put a large value here as there is no inputs, so this allows to
      // wait for the tested component to produce all its sink values
      waitForFinishDelay: 200
    })

  });

// Dependent contracts
QUnit.test(
  "Empty transition object : Error! There has to be at least one configured transition which" +
  " involves the initial event",
  function exec_test(assert) {
    function modelUpdateInitTransition(model, eventData, actionResponse) {
      assert.deepEqual(model, initialModel,
        'The INIT event triggers a call to the configured update' +
        ' model function, whose first parameter is the initial' +
        ' model');
      assert.deepEqual(eventData, initEventData,
        'The INIT event triggers a call to the configured update' +
        ' model function, whose second parameter is the ' +
        ' event data for the INIT event');
      assert.deepEqual(actionResponse, null,
        'The INIT event triggers a call to the configured update' +
        ' model function, whose third parameter is the ' +
        ' response for the action corresponding to the transition');

      return opsOnInitialModel
    }

    const events = {
      [testEvent]: sources => sources.eventSource.take(1)
    };

    const transitions1 = {};
    const transitions2 = {
      T_INIT: {
        origin_state: INIT_STATE,
        event: INIT_EVENT_NAME + 'dummy',
        target_states: [
          {
            event_guard: EV_GUARD_NONE,
            action_request: ACTION_REQUEST_NONE,
            transition_evaluation: [
              {
                action_guard: ACTION_GUARD_NONE,
                target_state: 'First',
                model_update: modelUpdateInitTransition
              }
            ]
          }
        ]
      }
    };

    const entryComponents = {
      First: function (model) {
        return curry(dummyComponent1Sink)(__, { model })
      }
    };

    const fsmSettings = {
      initial_model: initialModel,
      init_event_data: initEventData,
      sinkNames: sinkNames
    };

    assert.throws(
      () => makeFSM(events, transitions1, entryComponents, fsmSettings),
      "Error! There has to be at least one configured transition!"
    );

    assert.throws(
      () => makeFSM(events, transitions2, entryComponents, fsmSettings),
      "Error! There has to be at least one configured transition including the initial event!"
    );

  });

QUnit.test(
  "Invalid state object : Error! 1. Mapping state-component cannot be empty \n 2. All target" +
  " states of configured transitions must be mapped to a component function",
  function exec_test(assert) {
    function modelUpdateInitTransition(model, eventData, actionResponse) {
      assert.deepEqual(model, initialModel,
        'The INIT event triggers a call to the configured update' +
        ' model function, whose first parameter is the initial' +
        ' model');
      assert.deepEqual(eventData, initEventData,
        'The INIT event triggers a call to the configured update' +
        ' model function, whose second parameter is the ' +
        ' event data for the INIT event');
      assert.deepEqual(actionResponse, null,
        'The INIT event triggers a call to the configured update' +
        ' model function, whose third parameter is the ' +
        ' response for the action corresponding to the transition');

      return opsOnInitialModel
    }

    const events = {
      [testEvent]: sources => sources.eventSource.take(1)
    };

    const transitions = {
      T_INIT: {
        origin_state: INIT_STATE,
        event: INIT_EVENT_NAME,
        target_states: [
          {
            event_guard: EV_GUARD_NONE,
            action_request: ACTION_REQUEST_NONE,
            transition_evaluation: [
              {
                action_guard: ACTION_GUARD_NONE,
                target_state: 'First',
                model_update: modelUpdateInitTransition
              }
            ]
          }
        ]
      }
    };

    const entryComponents1 = {};
    const entryComponents2 = {
      Second: function (model) {
        return curry(dummyComponent1Sink)(__, { model })
      }
    };

    const fsmSettings = {
      initial_model: initialModel,
      init_event_data: initEventData,
      sinkNames: sinkNames
    };

    assert.throws(
      () => makeFSM(events, transitions, entryComponents1, fsmSettings),
      /empty/,
      "Error! entryComponents cannot be empty!"
    );

    assert.throws(
      () => makeFSM(events, transitions, entryComponents2, fsmSettings),
      /state/,
      "Error! entryComponents must define any state involved in a possible transition!"
    );

  });

QUnit.test(
  "FSM_Settings.initial_model is falsy : Error! mandatory setting",
  function exec_test(assert) {
    const testEvent = 'dummy';

    function modelUpdateInitTransition(model, eventData, actionResponse) {
      assert.deepEqual(model, initialModel,
        `On receiving an action response, the model update function is called 
        with the model's current value as its first parameter`);
      assert.deepEqual(eventData, dummyEventData,
        `On receiving an action response, the model update function is called 
        with the current triggering event's data as its second parameter`);
      assert.deepEqual(actionResponse, dummyDriverActionResponse,
        `On receiving an action response, the model update function is called 
        with the action response as its third parameter`);

      return opsOnInitialModel
    }

    const dummyActionRequest = {
      driver: dummyDriver,
      request: (model, eventData) => {
        assert.deepEqual(model, initialModel,
          `The request factory function is called with first parameter being 
          the model's current value`);
        assert.deepEqual(eventData, dummyEventData,
          `The request factory function is called with second parameter being 
          the data for the event triggering the action request`);

        return dummyRequest
      }
    };

    const events = {
      [testEvent]: sources => sources.eventSource.take(1)
    };

    const transitions = {
      [INIT_TRANSITION]: {
        origin_state: INIT_STATE,
        event: INIT_EVENT_NAME,
        target_states: [
          {
            event_guard: EV_GUARD_NONE,
            action_request: ACTION_REQUEST_NONE,
            transition_evaluation: [
              {
                action_guard: ACTION_GUARD_NONE,
                target_state: FIRST_STATE,
                model_update: identity
              }
            ]
          }
        ]
      },
      T1: {
        origin_state: FIRST_STATE,
        event: testEvent,
        target_states: [
          {
            event_guard: EV_GUARD_NONE,
            action_request: dummyActionRequest,
            transition_evaluation: [
              {
                action_guard: T,
                target_state: SECOND_STATE,
                model_update: modelUpdateInitTransition
              }
            ]
          }
        ]
      }
    };

    const entryComponents = {
      [FIRST_STATE]: function firstState(model) {
        return curry(dummyComponent2Sink)(__, { model })
      },
      [SECOND_STATE]: function secondState(model) {
        return curry(dummyComponent1Sink)(__, { model })
      },
    };

    const fsmSettings = {
//      initial_model: initialModel,
      init_event_data: initEventData,
      sinkNames: sinkNames
    };

    assert.throws(
      () => makeFSM(events, transitions, entryComponents, fsmSettings),
      /settings/,
      "Error! settings.initial_model is mandatory!"
    );
  });

QUnit.test(
  "FSM_Settings.init_event_data is falsy : No worry honey",
  function exec_test(assert) {
    let done = assert.async(5);
    const testEvent = 'dummy';

    function modelUpdateInitTransition(model, eventData, actionResponse) {
      assert.deepEqual(model, initialModel,
        `On receiving an action response, the model update function is called 
        with the model's current value as its first parameter`);
      assert.deepEqual(eventData, dummyEventData,
        `On receiving an action response, the model update function is called 
        with the current triggering event's data as its second parameter`);
      assert.deepEqual(actionResponse, dummyDriverActionResponse,
        `On receiving an action response, the model update function is called 
        with the action response as its third parameter`);

      return opsOnInitialModel
    }

    const dummyActionRequest = {
      driver: dummyDriver,
      request: (model, eventData) => {
        assert.deepEqual(model, initialModel,
          `The request factory function is called with first parameter being 
          the model's current value`);
        assert.deepEqual(eventData, dummyEventData,
          `The request factory function is called with second parameter being 
          the data for the event triggering the action request`);

        return dummyRequest
      }
    };

    const events = {
      [testEvent]: sources => sources.eventSource.take(1)
    };

    const transitions = {
      [INIT_TRANSITION]: {
        origin_state: INIT_STATE,
        event: INIT_EVENT_NAME,
        target_states: [
          {
            event_guard: EV_GUARD_NONE,
            action_request: ACTION_REQUEST_NONE,
            transition_evaluation: [
              {
                action_guard: ACTION_GUARD_NONE,
                target_state: FIRST_STATE,
                model_update: modelUpdateIdentity
              }
            ]
          }
        ]
      },
      T1: {
        origin_state: FIRST_STATE,
        event: testEvent,
        target_states: [
          {
            event_guard: EV_GUARD_NONE,
            action_request: dummyActionRequest,
            transition_evaluation: [
              {
                action_guard: T,
                target_state: SECOND_STATE,
                model_update: modelUpdateInitTransition
              }
            ]
          }
        ]
      }
    };

    const entryComponents = {
      [FIRST_STATE]: function firstState(model) {
        return curry(dummyComponent2Sink)(__, { model })
      },
      [SECOND_STATE]: function secondState(model) {
        return curry(dummyComponent1Sink)(__, { model })
      },
    };

    const fsmSettings = {
      initial_model: initialModel,
//      init_event_data: initEventData,
      sinkNames: sinkNames
    };

    const fsmComponent = makeFSM(events, transitions, entryComponents, fsmSettings);

    const inputs = [
      { eventSource: { diagram: '---a-|', values: { a: dummyEventData } } },
      { [dummyDriver]: { diagram: '----a|', values: { a: dummyDriverActionResponse } } },
      { sinkA: { diagram: '012---012|', values: dummySinkA3Values } },
      { sinkB: { diagram: '01----01-|', values: dummySinkB2Values } },
    ];

    function analyzeTestResults(actual, expected, message) {
      assert.deepEqual(actual, expected, message);
      done()
    }

    let updatedModel = clone(initialModel);
    // NOTE: !! modifies in place so function does not return anything
    jsonpatch.apply(/*OUT*/updatedModel, opsOnInitialModel);

    /** @type TestResults */
    const testResults = {
      sinkA: {
        outputs: flatten(['dummyComponent2_dummySinkA1', dummySinkA3Values]),
        successMessage: 'sink sinkA produces the expected values',
        analyzeTestResults: analyzeTestResults,
      },
      sinkB: {
        outputs: dummySinkB2Values,
        successMessage: 'sink sinkB produces the expected values',
        analyzeTestResults: analyzeTestResults,
      },
      modelSink: {
        outputs: [initialModel, updatedModel],
        successMessage: 'sink modelSink produces the expected values',
        analyzeTestResults: analyzeTestResults,
      },
      [dummyDriver]: {
        outputs: [dummyRequest],
        successMessage: 'sink dummyDriver produces the expected values',
        analyzeTestResults: analyzeTestResults,
      },
      sinkC: {
        outputs: [],
        successMessage: 'sink sinkC produces no values as expected',
        analyzeTestResults: analyzeTestResults,
      },
    };

    runTestScenario(inputs, testResults, fsmComponent, {
      tickDuration: 10,
      // We put a large value here as there is no inputs, so this allows to
      // wait for the tested component to produce all its sink values
      waitForFinishDelay: 200
    })

  });

QUnit.test(
  "FSM_Settings.sinkNames is empty array : No worry honey, there wont be any sinks",
  function exec_test(assert) {
    const testEvent = 'dummy';

    function modelUpdateInitTransition(model, eventData, actionResponse) {
      assert.deepEqual(model, initialModel,
        `On receiving an action response, the model update function is called 
        with the model's current value as its first parameter`);
      assert.deepEqual(eventData, dummyEventData,
        `On receiving an action response, the model update function is called 
        with the current triggering event's data as its second parameter`);
      assert.deepEqual(actionResponse, dummyDriverActionResponse,
        `On receiving an action response, the model update function is called 
        with the action response as its third parameter`);

      return opsOnInitialModel
    }

    const dummyActionRequest = {
      driver: dummyDriver,
      request: (model, eventData) => {
        assert.deepEqual(model, initialModel,
          `The request factory function is called with first parameter being 
          the model's current value`);
        assert.deepEqual(eventData, dummyEventData,
          `The request factory function is called with second parameter being 
          the data for the event triggering the action request`);

        return dummyRequest
      }
    };

    const events = {
      [testEvent]: sources => sources.eventSource.take(1)
    };

    const transitions = {
      [INIT_TRANSITION]: {
        origin_state: INIT_STATE,
        event: INIT_EVENT_NAME,
        target_states: [
          {
            event_guard: EV_GUARD_NONE,
            action_request: ACTION_REQUEST_NONE,
            transition_evaluation: [
              {
                action_guard: ACTION_GUARD_NONE,
                target_state: FIRST_STATE,
                model_update: identity
              }
            ]
          }
        ]
      },
      T1: {
        origin_state: FIRST_STATE,
        event: testEvent,
        target_states: [
          {
            event_guard: EV_GUARD_NONE,
            action_request: dummyActionRequest,
            transition_evaluation: [
              {
                action_guard: T,
                target_state: SECOND_STATE,
                model_update: modelUpdateInitTransition
              }
            ]
          }
        ]
      }
    };

    const entryComponents = {
      [FIRST_STATE]: function firstState(model) {
        return curry(dummyComponent2Sink)(__, { model })
      },
      [SECOND_STATE]: function secondState(model) {
        return curry(dummyComponent1Sink)(__, { model })
      },
    };

    const fsmSettings = {
      initial_model: initialModel,
      init_event_data: initEventData,
      sinkNames: []
    };

    const fsmComponent = makeFSM(events, transitions, entryComponents, fsmSettings);

    const inputs = [
      { eventSource: { diagram: '---a-|', values: { a: dummyEventData } } },
      { [dummyDriver]: { diagram: '----a|', values: { a: dummyDriverActionResponse } } },
      { sinkA: { diagram: '012---012|', values: dummySinkA3Values } },
      { sinkB: { diagram: '01----01-|', values: dummySinkB2Values } },
    ];

    function analyzeTestResults(actual, expected, message) {
      assert.deepEqual(actual, expected, message);
      done();
    }

    let updatedModel = clone(initialModel);
    // NOTE: !! modifies in place so function does not return anything
    jsonpatch.apply(/*OUT*/updatedModel, opsOnInitialModel);

    /** @type TestResults */
    const testResults = {
      sinkA: {
        outputs: flatten(['dummyComponent2_dummySinkA1', dummySinkA3Values]),
        successMessage: 'sink sinkA produces the expected values',
        analyzeTestResults: analyzeTestResults,
      },
      sinkB: {
        outputs: dummySinkB2Values,
        successMessage: 'sink sinkB produces the expected values',
        analyzeTestResults: analyzeTestResults,
      },
      modelSink: {
        outputs: [initialModel, updatedModel],
        successMessage: 'sink modelSink produces the expected values',
        analyzeTestResults: analyzeTestResults,
      },
      [dummyDriver]: {
        outputs: [dummyRequest],
        successMessage: 'sink dummyDriver produces the expected values',
        analyzeTestResults: analyzeTestResults,
      },
      sinkC: {
        outputs: [],
        successMessage: 'sink sinkC produces no values as expected',
        analyzeTestResults: analyzeTestResults,
      },
    };

    assert.throws(
      function () {
        runTestScenario(inputs, testResults, fsmComponent, {
          tickDuration: 10,
          // We put a large value here as there is no inputs, so this allows to
          // wait for the tested component to produce all its sink values
          waitForFinishDelay: 200
        });
      },
      /output/,
      'State machine component does not return any sinks if sinkNames is an empty array'
    );
  });

QUnit.test(
  "FSM_Settings.sinkNames is falsy : Error! mandatory settings",
  function exec_test(assert) {
    const testEvent = 'dummy';

    function modelUpdateInitTransition(model, eventData, actionResponse) {
      assert.deepEqual(model, initialModel,
        `On receiving an action response, the model update function is called 
        with the model's current value as its first parameter`);
      assert.deepEqual(eventData, dummyEventData,
        `On receiving an action response, the model update function is called 
        with the current triggering event's data as its second parameter`);
      assert.deepEqual(actionResponse, dummyDriverActionResponse,
        `On receiving an action response, the model update function is called 
        with the action response as its third parameter`);

      return opsOnInitialModel
    }

    const dummyActionRequest = {
      driver: dummyDriver,
      request: (model, eventData) => {
        assert.deepEqual(model, initialModel,
          `The request factory function is called with first parameter being 
          the model's current value`);
        assert.deepEqual(eventData, dummyEventData,
          `The request factory function is called with second parameter being 
          the data for the event triggering the action request`);

        return dummyRequest
      }
    };

    const events = {
      [testEvent]: sources => sources.eventSource.take(1)
    };

    const transitions = {
      [INIT_TRANSITION]: {
        origin_state: INIT_STATE,
        event: INIT_EVENT_NAME,
        target_states: [
          {
            event_guard: EV_GUARD_NONE,
            action_request: ACTION_REQUEST_NONE,
            transition_evaluation: [
              {
                action_guard: ACTION_GUARD_NONE,
                target_state: FIRST_STATE,
                model_update: identity
              }
            ]
          }
        ]
      },
      T1: {
        origin_state: FIRST_STATE,
        event: testEvent,
        target_states: [
          {
            event_guard: EV_GUARD_NONE,
            action_request: dummyActionRequest,
            transition_evaluation: [
              {
                action_guard: T,
                target_state: SECOND_STATE,
                model_update: modelUpdateInitTransition
              }
            ]
          }
        ]
      }
    };

    const entryComponents = {
      [FIRST_STATE]: function firstState(model) {
        return curry(dummyComponent2Sink)(__, { model })
      },
      [SECOND_STATE]: function secondState(model) {
        return curry(dummyComponent1Sink)(__, { model })
      },
    };

    const fsmSettings = {
      initial_model: initialModel,
      init_event_data: initEventData,
      sinkNames: null
    };

    assert.throws(
      () => makeFSM(events, transitions, entryComponents, fsmSettings),
      /settings/,
      "Error! settings.sinkNames is mandatory!"
    );
  });

// Events
QUnit.test(
  "events with event who is function but does not return an observable - ERROR! Must return an" +
  " observable",
  function exec_test(assert) {
    const testEvent = 'dummy';

    function modelUpdateInitTransition(model, eventData, actionResponse) {
      assert.deepEqual(model, initialModel,
        `On receiving an action response, the model update function is called 
        with the model's current value as its first parameter`);
      assert.deepEqual(eventData, dummyEventData,
        `On receiving an action response, the model update function is called 
        with the current triggering event's data as its second parameter`);
      assert.deepEqual(actionResponse, dummyDriverActionResponse,
        `On receiving an action response, the model update function is called 
        with the action response as its third parameter`);

      return opsOnInitialModel
    }

    const dummyActionRequest = {
      driver: dummyDriver,
      request: (model, eventData) => {
        assert.deepEqual(model, initialModel,
          `The request factory function is called with first parameter being 
          the model's current value`);
        assert.deepEqual(eventData, dummyEventData,
          `The request factory function is called with second parameter being 
          the data for the event triggering the action request`);

        return dummyRequest
      }
    };

    const events = {
      [testEvent]: sources => dummyValue
    };

    const transitions = {
      [INIT_TRANSITION]: {
        origin_state: INIT_STATE,
        event: INIT_EVENT_NAME,
        target_states: [
          {
            event_guard: EV_GUARD_NONE,
            action_request: ACTION_REQUEST_NONE,
            transition_evaluation: [
              {
                action_guard: ACTION_GUARD_NONE,
                target_state: FIRST_STATE,
                model_update: identity
              }
            ]
          }
        ]
      },
      T1: {
        origin_state: FIRST_STATE,
        event: testEvent,
        target_states: [
          {
            event_guard: EV_GUARD_NONE,
            action_request: dummyActionRequest,
            transition_evaluation: [
              {
                action_guard: T,
                target_state: SECOND_STATE,
                model_update: modelUpdateInitTransition
              }
            ]
          }
        ]
      }
    };

    const entryComponents = {
      [FIRST_STATE]: function firstState(model) {
        return curry(dummyComponent2Sink)(__, { model })
      },
      [SECOND_STATE]: function secondState(model) {
        return curry(dummyComponent1Sink)(__, { model })
      },
    };

    const fsmSettings = {
      initial_model: initialModel,
      init_event_data: initEventData,
      sinkNames: sinkNames
    };

    const fsmComponent = makeFSM(events, transitions, entryComponents, fsmSettings);

    const inputs = [
      { eventSource: { diagram: '---a-|', values: { a: dummyEventData } } },
      { [dummyDriver]: { diagram: '----a|', values: { a: dummyDriverActionResponse } } },
      { sinkA: { diagram: '012---012|', values: dummySinkA3Values } },
      { sinkB: { diagram: '01----01-|', values: dummySinkB2Values } },
    ];

    function analyzeTestResults(actual, expected, message) {
      assert.deepEqual(actual, expected, message);
      done()
    }

    let updatedModel = clone(initialModel);
    // NOTE: !! modifies in place so function does not return anything
    jsonpatch.apply(/*OUT*/updatedModel, opsOnInitialModel);

    /** @type TestResults */
    const testResults = {
      sinkA: {
        outputs: flatten(['dummyComponent2_dummySinkA1', dummySinkA3Values]),
        successMessage: 'sink sinkA produces the expected values',
        analyzeTestResults: analyzeTestResults,
      },
      sinkB: {
        outputs: dummySinkB2Values,
        successMessage: 'sink sinkB produces the expected values',
        analyzeTestResults: analyzeTestResults,
      },
      modelSink: {
        outputs: [initialModel, updatedModel],
        successMessage: 'sink modelSink produces the expected values',
        analyzeTestResults: analyzeTestResults,
      },
      [dummyDriver]: {
        outputs: [dummyRequest],
        successMessage: 'sink dummyDriver produces the expected values',
        analyzeTestResults: analyzeTestResults,
      }
    };

    assert.throws(function () {
        runTestScenario(inputs, testResults, fsmComponent, {
          tickDuration: 10,
          // We put a large value here as there is no inputs, so this allows to
          // wait for the tested component to produce all its sink values
          waitForFinishDelay: 200
        })
      },
      /observable/,
      'Event factory functions must return an observable!'
    )

  });

// Transitions
QUnit.test(
  "transitions with transition whose origin state is not defined in StateEntryComponents" +
  " parameter  - ERROR!",
  function exec_test(assert) {
    const testEvent = 'dummy';

    function modelUpdateInitTransition(model, eventData, actionResponse) {
      assert.deepEqual(model, initialModel,
        `On receiving an action response, the model update function is called 
        with the model's current value as its first parameter`);
      assert.deepEqual(eventData, dummyEventData,
        `On receiving an action response, the model update function is called 
        with the current triggering event's data as its second parameter`);
      assert.deepEqual(actionResponse, dummyDriverActionResponse,
        `On receiving an action response, the model update function is called 
        with the action response as its third parameter`);

      return opsOnInitialModel
    }

    const dummyActionRequest = {
      driver: dummyDriver,
      request: (model, eventData) => {
        assert.deepEqual(model, initialModel,
          `The request factory function is called with first parameter being 
          the model's current value`);
        assert.deepEqual(eventData, dummyEventData,
          `The request factory function is called with second parameter being 
          the data for the event triggering the action request`);

        return dummyRequest
      }
    };

    const events = {
      [testEvent]: sources => sources.eventSource.take(1)
    };

    const transitions = {
      [INIT_TRANSITION]: {
        origin_state: INIT_STATE,
        event: INIT_EVENT_NAME,
        target_states: [
          {
            event_guard: EV_GUARD_NONE,
            action_request: ACTION_REQUEST_NONE,
            transition_evaluation: [
              {
                action_guard: ACTION_GUARD_NONE,
                target_state: SECOND_STATE,
                model_update: identity
              }
            ]
          }
        ]
      },
      T1: {
        origin_state: FIRST_STATE,
        event: testEvent,
        target_states: [
          {
            event_guard: EV_GUARD_NONE,
            action_request: dummyActionRequest,
            transition_evaluation: [
              {
                action_guard: T,
                target_state: SECOND_STATE,
                model_update: modelUpdateInitTransition
              }
            ]
          }
        ]
      }
    };

    const entryComponents = {
      [SECOND_STATE]: function secondState(model) {
        return curry(dummyComponent1Sink)(__, { model })
      },
    };

    const fsmSettings = {
      initial_model: initialModel,
      init_event_data: initEventData,
      sinkNames: sinkNames
    };

    assert.throws(
      () => makeFSM(events, transitions, entryComponents, fsmSettings),
      /transitions/,
      `Error! Any origin state (except the initial state) which is referred to in the transitions 
      parameter must be associated to a component via the entryComponents parameter!`
    );
  });

QUnit.test(
  "transitions with transition with an event name which is not defined in Events " +
  " parameter  - ERROR!",
  function exec_test(assert) {
    const testEvent = 'dummy';

    function modelUpdateInitTransition(model, eventData, actionResponse) {
      assert.deepEqual(model, initialModel,
        `On receiving an action response, the model update function is called 
        with the model's current value as its first parameter`);
      assert.deepEqual(eventData, dummyEventData,
        `On receiving an action response, the model update function is called 
        with the current triggering event's data as its second parameter`);
      assert.deepEqual(actionResponse, dummyDriverActionResponse,
        `On receiving an action response, the model update function is called 
        with the action response as its third parameter`);

      return opsOnInitialModel
    }

    const dummyActionRequest = {
      driver: dummyDriver,
      request: (model, eventData) => {
        assert.deepEqual(model, initialModel,
          `The request factory function is called with first parameter being 
          the model's current value`);
        assert.deepEqual(eventData, dummyEventData,
          `The request factory function is called with second parameter being 
          the data for the event triggering the action request`);

        return dummyRequest
      }
    };

    const events = {
      [testEvent]: sources => sources.eventSource.take(1)
    };

    const transitions = {
      [INIT_TRANSITION]: {
        origin_state: INIT_STATE,
        event: INIT_EVENT_NAME,
        target_states: [
          {
            event_guard: EV_GUARD_NONE,
            action_request: ACTION_REQUEST_NONE,
            transition_evaluation: [
              {
                action_guard: ACTION_GUARD_NONE,
                target_state: FIRST_STATE,
                model_update: identity
              }
            ]
          }
        ]
      },
      T1: {
        origin_state: FIRST_STATE,
        event: testEvent + 'dummy',
        target_states: [
          {
            event_guard: EV_GUARD_NONE,
            action_request: dummyActionRequest,
            transition_evaluation: [
              {
                action_guard: T,
                target_state: SECOND_STATE,
                model_update: modelUpdateInitTransition
              }
            ]
          }
        ]
      }
    };

    const entryComponents = {
      [FIRST_STATE]: function firstState(model) {
        return curry(dummyComponent2Sink)(__, { model })
      },
      [SECOND_STATE]: function secondState(model) {
        return curry(dummyComponent1Sink)(__, { model })
      },
    };

    const fsmSettings = {
      initial_model: initialModel,
      init_event_data: initEventData,
      sinkNames: sinkNames
    };

    assert.throws(
      () => makeFSM(events, transitions, entryComponents, fsmSettings),
      /event/,
      `Error! Any event (except the initial event) which is referred to in the' +
    ' transitions parameter must be associated to a event factory function via the' +
    ' events parameter!`
    );
  });

QUnit.test(
  "transitions with  model update does not return array of updates : error",
  function exec_test(assert) {
    function modelUpdateReturnsNotArrayUpdates1(model, eventData, actionResponse) {
      return { key: 'value' }
    }

    function modelUpdateReturnsNotArrayUpdates2(model, eventData, actionResponse) {
      return undefined
    }

    function modelUpdateReturnsNotArrayUpdates3(model, eventData, actionResponse) {
      return []
    }

    function modelUpdateReturnsNotArrayUpdates4(model, eventData, actionResponse) {
      return [{key : 'value'}]
    }

    const events = {};

    const transitions1 = {
      T_INIT: {
        origin_state: INIT_STATE,
        event: INIT_EVENT_NAME,
        target_states: [
          {
            event_guard: EV_GUARD_NONE,
            action_request: ACTION_REQUEST_NONE,
            transition_evaluation: [
              {
                action_guard: ACTION_GUARD_NONE,
                target_state: 'First',
                model_update: modelUpdateReturnsNotArrayUpdates1
              }
            ]
          }
        ]
      }
    };
    const transitions2 = {
      T_INIT: {
        origin_state: INIT_STATE,
        event: INIT_EVENT_NAME,
        target_states: [
          {
            event_guard: EV_GUARD_NONE,
            action_request: ACTION_REQUEST_NONE,
            transition_evaluation: [
              {
                action_guard: ACTION_GUARD_NONE,
                target_state: 'First',
                model_update: modelUpdateReturnsNotArrayUpdates2
              }
            ]
          }
        ]
      }
    };
    const transitions4 = {
      T_INIT: {
        origin_state: INIT_STATE,
        event: INIT_EVENT_NAME,
        target_states: [
          {
            event_guard: EV_GUARD_NONE,
            action_request: ACTION_REQUEST_NONE,
            transition_evaluation: [
              {
                action_guard: ACTION_GUARD_NONE,
                target_state: 'First',
                model_update: modelUpdateReturnsNotArrayUpdates4
              }
            ]
          }
        ]
      }
    };

    const entryComponents = {
      First: function (model) {
        return curry(dummyComponent1Sink)(__, { model })
      }
    };

    const fsmSettings = {
      initial_model: initialModel,
      init_event_data: initEventData,
      sinkNames: sinkNames
    };

    const fsmComponent = curry(makeFSM)(events, __, entryComponents, fsmSettings);

    const inputs = [
      { eventSource: { diagram: '---a-|', values: { a: dummyEventData } } },
      { [dummyDriver]: { diagram: '----a|', values: { a: dummyDriverActionResponse } } },
      { sinkA: { diagram: '012---012|', values: dummySinkA3Values } },
      { sinkB: { diagram: '01----01-|', values: dummySinkB2Values } },
    ];

    function analyzeTestResults(actual, expected, message) {
      assert.deepEqual(actual, expected, message);
      done()
    }

    let updatedModel = clone(initialModel);
    // NOTE: !! modifies in place so function does not return anything
    jsonpatch.apply(/*OUT*/updatedModel, opsOnInitialModel);

    /** @type TestResults */
    const testResults = {
      sinkA: {
        outputs: [[CONTRACT_MODEL_UPDATE_FN_RETURN_VALUE]],
        successMessage: 'Error! Model update functions must return an array of valid update operations!',
        transformFn : match(new RegExp(CONTRACT_MODEL_UPDATE_FN_RETURN_VALUE, 'g')),
        analyzeTestResults: analyzeTestResults,
      },
      sinkB: {
        outputs: [[CONTRACT_MODEL_UPDATE_FN_RETURN_VALUE]],
        successMessage: 'sink sinkB produces the expected values',
        transformFn : match(new RegExp(CONTRACT_MODEL_UPDATE_FN_RETURN_VALUE, 'g')),
        analyzeTestResults: analyzeTestResults,
      },
      modelSink: {
        outputs: [[CONTRACT_MODEL_UPDATE_FN_RETURN_VALUE]],
        successMessage: 'sink modelSink produces the expected values',
        analyzeTestResults: analyzeTestResults,
      },
      [dummyDriver]: {
        outputs: [[CONTRACT_MODEL_UPDATE_FN_RETURN_VALUE]],
        successMessage: 'sink drivers_dummy produces no values as expected',
        analyzeTestResults: analyzeTestResults,
      },
      sinkC: {
        outputs: [[CONTRACT_MODEL_UPDATE_FN_RETURN_VALUE]],
        successMessage: 'sink sinkC produces no values as expected',
        analyzeTestResults: analyzeTestResults,
      },
    };

    runTestScenario(inputs, testResults, fsmComponent(transitions1), {
      tickDuration: 5,
      // We put a large value here as there is no inputs, so this allows to
      // wait for the tested component to produce all its sink values
      waitForFinishDelay: 50
    });
    runTestScenario(inputs, testResults, fsmComponent(transitions2), {
      tickDuration: 5,
      // We put a large value here as there is no inputs, so this allows to
      // wait for the tested component to produce all its sink values
      waitForFinishDelay: 50
    });
    runTestScenario(inputs, testResults, fsmComponent(transitions4), {
      tickDuration: 5,
      // We put a large value here as there is no inputs, so this allows to
      // wait for the tested component to produce all its sink values
      waitForFinishDelay: 50
    });

    assert.expect(0);
  });

// Event guard, action guards also CHECK must return boolean (synchronous) AND NOT throw
// TODO : tryCatch them and have ad-hoc error message
// TODO : same for action request factories

// state entry components
// not object -> Error
// is empty object -> Error : must have at least one state - >DONE BEFORE
// has entry which is no a function -> Error
// TODO : has entry which is a function which does not return component or null -> Error
// TODO : also - cannot throw

// TODO: write the cases :
// INIT
// arq=(ev, evG, acG) + ars(when) + ev(when)
// avec ev : 1, evG : {Def, T, F, [T,F], [T, T]}, acG = {Def, T, F, [T,F], [T,T]}
// ars:when :: unexpected event, response from registered driver but not expected now, unexpected
// response,
// response expected with registered driver and the expected one
// ev:when :: same for event

// Action request, and while expecting response, receiving event for which a transition is
// configured

// Awaiting event, and receiving event for which a transition is
// NOT configured

// Awaiting event, and receiving action response for which a transition is
// NOT configured

// Awaiting event, and receiving action response for which a transition is
// configured

// Add specs :
// - cloning model
// - error when settings are not correct or coherent
// - basically cf. contracts

// TODO : add contracts checks for all the things that cannot be checked ahead of time
// example type of function parameters, and function return values
// but only test the return values of the function introduced by the user in config
// the internally used function should be tested and not needing further type checking

// TODO : impplement Op_None (i.e. test json patch on it)

// TODO : automatic events i.e. event for which there is no guard, will have to be defined in
// auto property of event object -> change all relevant types, and maybe mapping?

// TODO : runTestScenario bug, if an error occur, then it does not seem to check the other sinks
// cf. transitions with  model update does not return array of updates : error
