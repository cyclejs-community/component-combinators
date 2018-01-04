import {computeTaskFilterTabClasses} from './helpers'
import { TASKS_INIT_FILTER } from "../../../../src/properties"

// BUG : if "#title_input.enter-task__title-input" is replaced by
// BUG : ".enter-task__title-input#title_input", then input tag appears as <input.enter-tas...>!!
export const taskEnterInputSelector = "#title_input.enter-task__title-input";
export const taskEnterButtonSelector = ".button.enter-task__l-box-b";
export const TaskListContainerSelector = `.task-list__l-box-c`;
export const TaskListScrollBarSelector = `.task-list__scrollbar`;
export const SCROLL_INCREMENT = 3;
export const INITIAL_SHOWN_TASK_COUNT = 3;

export const tasksButtonGroupInitialState = {label : TASKS_INIT_FILTER};
export const tasksButtonGroupSettings = {
  buttonGroup:{
    labels : ['all', 'open', 'done'],
    buttonClasses : computeTaskFilterTabClasses,
    namespace:'tasksButtonGroup'
  }
}
