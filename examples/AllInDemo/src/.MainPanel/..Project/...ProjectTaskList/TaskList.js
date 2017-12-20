import * as Rx from "rx";
import { ForEach } from "../../../../../../src/components/ForEach/ForEach"
import { ListOf } from "../../../../../../src/components/ListOf/ListOf"
import { InSlot } from "../../../../../../src/components/InSlot"
import { InjectSourcesAndSettings } from "../../../../../../src/components/Inject/InjectSourcesAndSettings"
import { DOM_SINK, EmptyComponent, vLift } from "../../../../../../src/utils"
import { button, div } from "cycle-snabbdom"
import { TASKS } from "../../../../src/domain"
import { computeSaveUpdatedTaskActions, computeTaskCheckedActions } from './helpers'
import { taskListStateFactory } from './state'
import { CheckBox } from '../../../UI/CheckBox'
import { Editor } from '../../../UI/Editor'
import { InjectStateInSinks } from "../../../../../../src/components/Inject/InjectStateInSinks"
import { TaskInfo } from './TaskInfo'
import { TaskDelete, taskDeleteSelector } from './TaskDelete'
import { TaskLink } from './TaskLink'
import { TaskListContainerSelector } from './properties'

const $ = Rx.Observable;

// Helpers
const TaskListContainer = vLift(
  div(TaskListContainerSelector, [
    div('.task-list__tasks', { slot: 'task' }, [])
  ])
);

function TaskContainer(sources, settings) {
  const { filteredTask: { done, title }, listIndex } = settings;
  const coreVnodes = div('.task', [
    div(".task__l-box-a", { slot: 'checkbox' }, []),
    div(".task__l-box-b", [
      div(".task__title", { slot: 'editor' }, []),
      button(taskDeleteSelector(listIndex)),
      div('.task-infos', { slot: 'task-infos' }, []),
      div({ slot: 'task-link' }, []),
    ])
  ]);

  return {
    [DOM_SINK]: $.of(
      done
        ? div(`.task--done`, [coreVnodes])
        : coreVnodes
    )
  }
}

// NOTE : Because Editor and CheckBox are reusable UI component, they are unaware of any domain
// model, and can only be parameterized through settings. `InjectSourcesAndSettings` is used to
// compute the necessary settings for those components
const Task = InjectSourcesAndSettings({
  settings: function (settings) {
    const { filteredTask: { done, title }, listIndex } = settings;

    return {
      checkBox: { isChecked: !!done, namespace: [TASKS, listIndex].join('_'), label: undefined },
      editor: { showControls: true, initialEditMode: false, initialContent: title }
    }
  }
}, [TaskContainer, [
  InSlot('checkbox', [
    InjectStateInSinks({
      isChecked$: {
        as: 'isChecked',
        inject: { projectFb$: 'projectFb' }
      }
    }, CheckBox)
  ]),
  InSlot('editor', [
    InjectStateInSinks({
      save$: {
        as: 'save',
        inject: { projectFb$: 'projectFb', user$: 'user' }
      }
    }, Editor)
  ]),
  InSlot('task-infos', [
    TaskInfo,
  ]),
  TaskDelete,
  InSlot('task-link', [
    TaskLink
  ]),
]]);

// TODO : blog on the progresse of app, example here before scroll/after scroll show incremental dev
// how easy vs. angular
export const TaskList = InjectSourcesAndSettings({ sourceFactory: taskListStateFactory }, [TaskListContainer, [
  InSlot('task', [
    ForEach({ from: 'filteredTasks$', as: 'filteredTasks' }, [
      ListOf({
        list: 'filteredTasks', as: 'filteredTask', buildActionsFromChildrenSinks: {
          isChecked$: computeTaskCheckedActions,
          save$: computeSaveUpdatedTaskActions
        }, actionsMap: { 'isChecked$': 'domainAction$', 'save$': 'domainAction$' }
      }, [
        EmptyComponent,
        Task
      ])])
  ])]]);

// TODO : not done, draggable... and tags : DO THE TAGS dont know about scroll
// TODO : do the drag and drop : good exercise, useful in the general case, example of reusable
// component
// TODO : need to read more about the scroll but could be interesting to do
// TODO:  in order : draggable first
// TODO : understand the plugin thing (used for task info)
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

