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
import {filterTasks, isButtonActive, makeButtonGroupSelector, computeTasksButtonGroupClasses} from './helpers'

const $ = Rx.Observable;

// BUG : if "#title_input.enter-task__title-input" is replaced by
// BUG : ".enter-task__title-input#title_input", then input tag appears as <input.enter-tas...>!!
export const taskEnterInputSelector = "#title_input.enter-task__title-input";
export const taskEnterButtonSelector = ".button.enter-task__l-box-b";

export const tasksButtonGroupInitialState = {label : 'all'};
export const tasksButtonGroupSettings = {
  buttonGroup:{
    labels : ['all', 'open', 'done'],
    buttonClasses : computeTasksButtonGroupClasses,
    namespace:'tasksButtonGroup'
  }
}
