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
import {taskEnterButtonSelector, taskEnterInputSelector} from './properties'
import {taskListStateFactory} from './state'
import {CheckBox} from '../../../UI/CheckBox'
import {Editor} from '../../../UI/Editor'

const $ = Rx.Observable;

const TaskListContainer = vLift(
  div('.task-list__l-box-c', [
    div('.task-list__tasks', {slot: 'task'}, [])
  ])
);

const TaskContainer = vLift(
  div('.task', [
    div(".task__l-box-a", {slot : 'checkbox'}, []),
    div(".task__l-box-b", [
      div(".task__title", [
        div('.editor', {slot : 'editor'}, [])
      ]),
      button(".task__delete"),
      div('.task-infos', {slot : 'task-infos'}, []),
      div({slot: 'task-link'}, []),
    ])
  ])
);

const TaskLink = DummyComponent;
const TaskInfo = DummyComponent;

const Task = m({},{}, [TaskContainer, [
  // TODO : I AM here, do the checkbox first it is easy
  // dont forget they are all indexed and I can use actionMap to map the actions
  // do use it so there is one example
  CheckBox, // actionsmap if I can
  Editor,
  TaskInfo,
  TaskLink
]]);

export const TaskList = InjectSourcesAndSettings({sourceFactory: taskListStateFactory}, [TaskListContainer,  [
  InSlot('task', [
    ForEach({from : 'filteredTasks$', as : 'filteredTasks'}, [
      ListOf({list : 'filteredTasks', as : 'filteredTask'}, [
        EmptyComponent,
        Task
      ])])
  ])]]);

/*
<div class="task-list__l-box-c">
  <div class="task-list__tasks">
    <ngc-task *ngcInfiniteScroll="let task of filteredTasks" [task]="task"
     (taskUpdated)="onTaskUpdated(task, $event)"
     (taskDeleted)="onTaskDeleted(task)"
     draggable
     draggableType="task"
     [draggableData]="task"
     draggableDropZone
     dropAcceptType="task"
     (dropDraggable)="onTaskDrop($event, task)"></ngc-task>
  </div>
</div>
*/

