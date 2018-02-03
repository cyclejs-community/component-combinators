import * as Rx from "rx";
import { ForEach, InjectSourcesAndSettings, InSlot, ListOf, Pipe } from "@rxcc/components"
import { DOM_SINK, EmptyComponent, vLift } from "@rxcc/utils"
import { button, div } from "cycle-snabbdom"
import { TASKS } from "../../../../src/domain"
import { ComputeCheckBoxActions, ComputeEditorActions } from './helpers'
import { taskListStateFactory } from './state'
import { CheckBox } from '../../../UI/CheckBox'
import { Editor } from '../../../UI/Editor'
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
    Pipe({}, [
      CheckBox,
      ComputeCheckBoxActions
    ]),
  ]),
  InSlot('editor', [
    Pipe({}, [
      Editor,
      ComputeEditorActions
    ]),
  ]),
  InSlot('task-infos', [
    TaskInfo,
  ]),
  TaskDelete,
  InSlot('task-link', [
    TaskLink
  ]),
]]);

export const TaskList = InjectSourcesAndSettings({ sourceFactory: taskListStateFactory }, [TaskListContainer, [
  InSlot('task', [
    ForEach({ from: 'filteredTasks$', as: 'filteredTasks' }, [
      ListOf({ list: 'filteredTasks', as: 'filteredTask' }, [
        EmptyComponent,
        Task
      ])
    ])
  ])
]]);
