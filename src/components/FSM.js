// Patch library : https://github.com/Starcounter-Jack/JSON-Patch
import {map as mapR, reduce as reduceR, always} from 'ramda';
// NOTE1 : dont use observe functionality for generating patches
// it uses JSON stringify which makes it impossible to have functions in the
// model object
// NOTE2 : patches are applied IN PLACE
import * as jsonpatch from 'fast-json-patch';

export const EV_GUARD_NONE = null;
export const ACTION_REQUEST_NONE = null;
export const ACTION_GUARD_NONE = always(true);

export function makeFSM(events, transitions, entryComponents, fsmSettings){
  // TODO
  // TODO : dont forget - clone initial model
  // TODO : dont forget - apply patch in place inside the fsm
  // TODO : but pass the model cloned THEN deep-frozen to any function who consumes it
  // function/event

  merge(labelledEvents.startWith(init))
    .scan ((init, no pending, no action request, init model, orig. event data), (fsmInternalState, event) => {
    if pending action :
      if event not corresponding/expected action response (from label)
    discard/maybe warning
    else :
    update internal model cf. transition success/error -MUST synchronous
    log operations on model somewhere (external fsm driver??) - MAY async., MUST SUCCEED
    set internal state to transition success/error target state
    emit component configured in transition
    else new action request :
      if configured in transition
        pending : YES, action request : targetDriver (label), state, model is same
    orig event data = action request event data
    emit : {targetDriver : ..} according to transition
    else FATAL ERROR : must be configured in fsm
  }).
  switchMap({state, pending, action request, model, orig event data} => {
    if pending :
    emit : {targetDriver : ..} according to transition
  else :
    emit component configured in transition
  })
  !! this is a switch on component!!
    means no more events are processed while executing actions (GOOD!)
    - behaviours if processed with combineLatest keep their values (DOM)

  }
