import {
  evolve, map as mapR, reduce as reduceR, mapObjIndexed, uniq, flatten, values, find, equals, clone,
  keys, filter, pick, curry, defaultTo, findIndex, allPass, pipe, both, isEmpty, all, either, isNil,
  tryCatch, T, flip, identity, cond, always, prop
} from "ramda"
import {
  checkSignature, assertContract, handleError, isBoolean, decorateWith,
  assertFunctionContractDecoratorSpecs, logFnTrace, isFunction
} from "../../utils"
import {
  isDefaultActionResponseHandlerConfig, isActionGuardDomain, isActionGuardCodomain,
  isModelUpdateDomain, isModelUpdateCodomain, isEventGuardDomain, isEventGuardCodomain,
  isActionRequestDomain, isActionRequestCodomain, isEventFactoryDomain, isEventFactoryCodomain,
  isFsmModel
} from "./types"

export function modelUpdateIdentity() {
  return []
}

// Allows to compose model update functions (a la monad chain operation)
export function chainModelUpdates(arrayModelUpdateFn) {
  return function chainedModelUpdates(model, eventData, actionResponse, settings) {
    return flatten(mapR(
      modelUpdateFn => modelUpdateFn(model, eventData, actionResponse, settings),
      arrayModelUpdateFn)
    )
  }
}

// Shortcut to avoid defining over and over the same action response (success, error) logic
export function makeDefaultActionResponseProcessing(config) {
  assertContract(isDefaultActionResponseHandlerConfig, [config],
    'Configuration for action response handling must be of the shape :: {' +
    '  success : {target_state : <state>, udpate_model : <model update fn>,' +
    '  error : {target_state : <state>, udpate_model : <model update fn>}'
  );

  const {
    success : { target_state : successTargetState, model_update : successModelUpdate },
    error: { target_state: errorTargetState, model_update: errorModelUpdate }
  } = config;

  return [
    {
      action_guard: checkActionResponseIsSuccess,
      target_state: successTargetState,
      model_update: successModelUpdate
    },
    {
      action_guard: T,
      target_state: errorTargetState,
      model_update: errorModelUpdate
    }
  ]
}

export function checkActionResponseIsSuccess(model, actionResponse) {
  void model;
  const { err } = actionResponse;
  return !err;
}

// Decorators to add log, contract checking, and tracing capabilities to fsm functions
export const tapEventStreamOutput = eventName => ({
  after: result => result.tap(console.warn.bind(console, `Incoming user event! ${eventName}: `))
});

export const decorateStateEntryWithLog = mapObjIndexed((stateEntryComponent, state) => stateEntryComponent
  ? decorateWith([
    assertFunctionContractDecoratorSpecs({
      checkDomain: isEntryComponentDomain,
      checkCodomain: isEntryComponentCodomain
    }),
    logFnTrace(`.STATE. ${state}`, ['model']),
  ], stateEntryComponent)
  : null
);

export const isEntryComponentDomain = isFsmModel;
export const isEntryComponentCodomain = isFunction;

export const decorateEventsWithLog = mapObjIndexed((eventFactory, eventName) =>
  decorateWith([
    assertFunctionContractDecoratorSpecs({
      checkDomain: isEventFactoryDomain,
      checkCodomain: isEventFactoryCodomain
    }),
    logFnTrace('Event factory', ['sources', 'settings']),
    tapEventStreamOutput(eventName)
  ], eventFactory)
);

export const decorateEventGuard = decorateWith([
  assertFunctionContractDecoratorSpecs({
    checkDomain: isEventGuardDomain,
    checkCodomain: isEventGuardCodomain
  }),
  logFnTrace('Event guard', ['FSM_Model', 'EventData']),
]);

export const decorateActionRequest = decorateWith([
  assertFunctionContractDecoratorSpecs({
    checkDomain: isActionRequestDomain,
    checkCodomain: isActionRequestCodomain
  }),
  logFnTrace('action request', ['FSM_Model', 'EventData']),
]);

const decorateActionGuard = decorateWith([
  assertFunctionContractDecoratorSpecs({
    checkDomain: isActionGuardDomain,
    checkCodomain: isActionGuardCodomain
  }),
  logFnTrace('action guard', ['model', 'actionResponse']),
]);

const decorateModelUpdate = decorateWith([
  assertFunctionContractDecoratorSpecs({
    checkDomain: isModelUpdateDomain,
    checkCodomain: isModelUpdateCodomain
  }),
  logFnTrace('model update', ['FSM_Model', 'EventData', 'ActionResponse', 'Settings']),
]);

const decorateTransEval = evolve({
  target_state: identity,
  action_guard: cond([[isNil, always(null)], [T, decorateActionGuard]]),
  model_update: decorateModelUpdate
});

const decorateTransition = evolve({
  re_entry: identity,
  transition_evaluation: mapR(decorateTransEval),
  event_guard: cond([[isNil, always(null)], [T, decorateEventGuard]]),
  action_request: cond([[isNil, always(null)], [T, evolve({
    driver: identity,
    request: decorateActionRequest
  })]]),
});

export const decorateTransitionsWithLog = mapObjIndexed(evolve({
  origin_state: identity,
  event: identity,
  target_states: mapR(decorateTransition)
}));
