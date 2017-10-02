import * as Rx from "rx";
import { OnRoute} from "../../../../../../src/components/Router/Router"
import { ForEach } from "../../../../../../src/components/ForEach/ForEach"
import { ListOf } from "../../../../../../src/components/ListOf/ListOf"
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

const $ = Rx.Observable;

export function filterTasks(tasks, taskFilter){
  return tasks
    ? tasks.filter((task) => {
      if (taskFilter === 'all') {
        return true;
      } else if (taskFilter === 'open') {
        return !task.done;
      } else {
        return task.done;
      }
    })
    : []
}

export function isButtonActive (buttonGroupState, label){
  return label === buttonGroupState.label
}

export function makeButtonGroupSelector({label, index, namespace}){
  return `.${namespace}.${[label, index].join('-')}`
}

export function computeTasksButtonGroupClasses(buttonGroupState, label){
  const staticClasses = ['button', 'button--toggle'];
  const buttonClasses = isButtonActive (buttonGroupState, label) ? staticClasses.concat(['button--active']) : staticClasses

  return buttonClasses
}

