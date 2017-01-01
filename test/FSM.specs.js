// let Qunit = require('qunitjs');
import * as QUnit from "qunitjs"
import { map, reduce, always, clone, curry, identity, flatten, T, F, __ } from "ramda"
import * as jsonpatch from "fast-json-patch"
import * as Rx from "rx"
import { makeErrorMessage } from "../src/utils"
import { runTestScenario } from "../src/runTestScenario"
import {
  EV_GUARD_NONE,
  ACTION_REQUEST_NONE,
  ACTION_GUARD_NONE,
  DRIVER_PREFIX,
  INIT_EVENT_NAME,
  INIT_STATE,
  CONTRACT_SATISFIED_GUARD_PER_ACTION_RESPONSE
} from "../src/components/properties"
import { makeFSM } from "../src/components/FSM"

let $ = Rx.Observable;

// Fixtures
const EV_PREFIX = 'ev_';
const INIT_TRANSITION = 'T_INIT';
const FIRST_STATE = 'S_FIRST';
const SECOND_STATE = 'S_SECOND';
const THIRD_STATE = 'S_THIRD';
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

//// Init event
///  - Also testing EV_GUARD_NONE, ACTION_REQUEST_NONE, ACTION_GUARD_NONE
// - GIVEN : FSM `Model, SinkNames`,  transition `Ev.INIT -> evG(none) -> S.Init -> T -> Ar(none) -> Ag(none) -> U`, `init: Model -> Component(_, model)`
// - GIVEN : Component emits two values on two sinks in SinkNames
// - WHEN state machine is initialized THEN :
//   - Update U is called with right parameters (i.e. Ev.INIT is triggered)
// - init state component factory function is called with the right parameters
// - FSM emits component sinks as expected
QUnit.test(
  "Initialization of state machine - INIT event (no event guard)",
  function exec_test(assert) {
    let done = assert.async(3);

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
    // Transitions :: HashMap TransitionName TransitionOptions
    // TransitionOptions :: Record {
    //   origin_state :: State, event :: EventName, target_states ::
    // [Transition]
    // }
    // Transition :: Record {
    //   event_guard :: EventGuard, action_request :: ActionRequest,
    //   transition_evaluation :: [TransEval]
    // }
    // ActionRequest : Record {
    //   driver :: SinkName | ZeroDriver,
    //   request :: (FSM_Model -> EventData) -> Request
    // }
    // TransEval :: Record {
    //   action_guard :: ActionGuard
    //   target_state :: State
    //   model_update :: FSM_Model -> EventData -> ActionResponse ->
    //                                                       UpdateOperations
    // }
    // StateEntryComponents :: HashMap State StateEntryComponent
    // StateEntryComponent :: FSM_Model -> Component
    // FSM_Settings :: Record {
    //  initial_model :: FSM_Model
    //  init_event_data :: Event_Data
    //  sinkNames :: [SinkName]
    // }

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
    };

    runTestScenario(inputs, testResults, fsmComponent, {
      tickDuration: 5,
      // We put a large value here as there is no inputs, so this allows to
      // wait for the tested component to produce all its sink values
      waitForFinishDelay: 200
    })

  });

QUnit.test(
  "Event triggers a transition with an action request - no action guard (means passing)",
  function exec_test(assert) {
    let done = assert.async(4);
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
      }
    };

    runTestScenario(inputs, testResults, fsmComponent, {
      tickDuration: 10,
      // We put a large value here as there is no inputs, so this allows to
      // wait for the tested component to produce all its sink values
      waitForFinishDelay: 200
    })

  });

QUnit.test(
  "Event triggers a transition with an action request - no passing action guard",
  function exec_test(assert) {
    let done = assert.async(4);
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
      }
    };

    runTestScenario(inputs, testResults, fsmComponent, {
      tickDuration: 5,
      // We put a large value here as there is no inputs, so this allows to
      // wait for the tested component to produce all its sink values
      waitForFinishDelay: 200
    })

  });

QUnit.test(
  "fulfilled event guard - no action request guard",
  function exec_test(assert) {
    let done = assert.async(4);
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
      }
    };

    runTestScenario(inputs, testResults, fsmComponent, {
      tickDuration: 5,
      // We put a large value here as there is no inputs, so this allows to
      // wait for the tested component to produce all its sink values
      waitForFinishDelay: 200
    })

  });

QUnit.test(
  "failing event guard - no action request guard",
  function exec_test(assert) {
    let done = assert.async(4);
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
      }
    };

    runTestScenario(inputs, testResults, fsmComponent, {
      tickDuration: 5,
      // We put a large value here as there is no inputs, so this allows to
      // wait for the tested component to produce all its sink values
      waitForFinishDelay: 200
    })

  });

QUnit.test(
  "failing, and fulfilled event guard in that order - no action request guard",
  function exec_test(assert) {
    let done = assert.async(4);
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

    runTestScenario(inputs, testResults, fsmComponent, {
      tickDuration: 5,
      // We put a large value here as there is no inputs, so this allows to
      // wait for the tested component to produce all its sink values
      waitForFinishDelay: 200
    })

  });

QUnit.test(
  "fulfilled, and failing event guard in that order - no action request guard",
  function exec_test(assert) {
    let done = assert.async(4);
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

    runTestScenario(inputs, testResults, fsmComponent, {
      tickDuration: 5,
      // We put a large value here as there is no inputs, so this allows to
      // wait for the tested component to produce all its sink values
      waitForFinishDelay: 200
    })

  });

QUnit.test(
  "2 fulfilled event guards - no action request guard : first guard's transition is taken",
  function exec_test(assert) {
    let done = assert.async(4);
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

    runTestScenario(inputs, testResults, fsmComponent, {
      tickDuration: 5,
      // We put a large value here as there is no inputs, so this allows to
      // wait for the tested component to produce all its sink values
      waitForFinishDelay: 200
    })

  });

QUnit.test(
  "Event triggers a transition with an action request - receiving response from another driver" +
  " not mentioned in an action request : same as if no response received",
  function exec_test(assert) {
    let done = assert.async(4);
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
      }
    };

    runTestScenario(inputs, testResults, fsmComponent, {
      tickDuration: 5,
      // We put a large value here as there is no inputs, so this allows to
      // wait for the tested component to produce all its sink values
      waitForFinishDelay: 200
    })

  });

QUnit.test(
  "Event triggers a transition with an action request - receiving response from another driver" +
  " than the expected one : same as if no response received, but warning is issued",
  function exec_test(assert) {
    let done = assert.async(4);
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
      }
    };

    runTestScenario(inputs, testResults, fsmComponent, {
      tickDuration: 10,
      // We put a large value here as there is no inputs, so this allows to
      // wait for the tested component to produce all its sink values
      waitForFinishDelay: 200
    })

  });

// Action request, and while expecting response, receiving event for which a transition is
// configured

// Awaiting event, and receiving event for which a transition is
// NOT configured

// Awaiting event, and receiving action response for which a transition is
// NOT configured

// Awaiting event, and receiving action response for which a transition is
// configured
