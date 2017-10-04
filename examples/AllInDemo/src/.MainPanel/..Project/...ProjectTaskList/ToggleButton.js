import { ListOf } from "../../../../../../src/components/ListOf/ListOf"
import { ForEach } from "../../../../../../src/components/ForEach/ForEach"
import { InSlot} from "../../../../../../src/components/InSlot"
import { InjectSources } from "../../../../../../src/components/Inject/InjectSources"
import { InjectSourcesAndSettings } from "../../../../../../src/components/Inject/InjectSourcesAndSettings"
import { DOM_SINK, EmptyComponent, DummyComponent, format, Div, Nav, vLift, preventDefault, getInputValue } from "../../../../../../src/utils"
import { pipe, values, keys, always, filter, path, map } from 'ramda'
import { a, p, div, img, nav, strong, h2, ul, li, button, input } from "cycle-snabbdom"
import { m } from "../../../../../../src/components/m/m"
import { ROUTE_PARAMS } from "../../../../../../src/components/Router/properties"
import { TASK_TAB_BUTTON_GROUP_STATE, PATCH } from "../../../../src/inMemoryStore"
import { TASKS, ADD_NEW_TASK, ACTIVITIES, LOG_NEW_ACTIVITY, taskFactory, activityFactory } from "../../../../src/domain"
import {filterTasks, isButtonActive, makeButtonGroupSelector, computeTasksButtonGroupClasses} from './helpers'
import {tasksButtonGroupSettings} from './properties'
import {tasksButtonGroupStateChange$} from './state'

const $ = Rx.Observable;

function ButtonFromGroup(sources, settings) {
  const {buttonGroupState, label, listIndex, buttonGroup : {labels, namespace, buttonClasses}} = settings;
  // NOTE : need to update non-persisted app state (task tab state more precisely)
  // This is related but distinct from the state carried by tasksButtonGroupState$
  // The state of the button group is part of the non-persisted app state, the same as the
  // button group is part of the tab which is part of the application
  // NOTE : once we used a ForEach on an EVENT source, we cannot reuse that source anymore, the
  // event will already have been emitted!! This is a VERY common source of annoying bugs
  const classes = ['']
    .concat(buttonClasses(buttonGroupState, label))
    .join('.') + makeButtonGroupSelector({label, index:listIndex, namespace});
  const updateTaskTabButtonGroupStateAction = {
    context : TASK_TAB_BUTTON_GROUP_STATE,
    command : PATCH,
    payload : [
      { op: "add", path: '/filter', value: label },
    ]
  };

  return {
    [DOM_SINK] : $.of(
      button(classes,label)
    ),
    // NOTE : this is state synchronization through state change events :
    // click -> button group state -> in-memory store. Source of truth here is button group state
    // The best option is to have the in-memory store as a source of truth, and update that
    // first, and have all the rest expressed as a function of the in-memory store state
    // This is left here as a showcase that this is also a possible technique
    storeUpdate$: isButtonActive (buttonGroupState, label)
      ? $.of(updateTaskTabButtonGroupStateAction)
      : $.empty()
  }
}

export const ToggleButton =
  // NOTE : this is an example in which we add an EVENT source, not a behaviour source as usual
  InjectSourcesAndSettings({sourceFactory: tasksButtonGroupStateChange$, settings : tasksButtonGroupSettings}, [
    ForEach({from : 'buttonGroupStateChange$', as : 'buttonGroupState'}, [
      ListOf({list : 'buttonGroup.labels', as : 'label'}, [
        EmptyComponent,
        ButtonFromGroup
      ])
    ])
  ]);

