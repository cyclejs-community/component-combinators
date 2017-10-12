import * as Rx from "rx";
import { ForEach } from "../../../../../../src/components/ForEach/ForEach"
import { ListOf } from "../../../../../../src/components/ListOf/ListOf"
import { InSlot} from "../../../../../../src/components/InSlot"
import { InjectSources } from "../../../../../../src/components/Inject/InjectSources"
import { InjectSourcesAndSettings } from "../../../../../../src/components/Inject/InjectSourcesAndSettings"
import { DOM_SINK, EmptyComponent, DummyComponent, format, Div, Nav, vLift, preventDefault } from "../../../../../../src/utils"
import { pipe, values, keys, always, filter, path, map } from 'ramda'
import { a, p, div, img, nav, h2, ul, li, button, input, strong } from "cycle-snabbdom"
import { UPDATE_TASK_COMPLETION_STATUS, TASKS, DELETE_TASK, ACTIVITIES, LOG_NEW_ACTIVITY, activityFactory, taskFactory } from "../../../../src/domain"
import {computeTaskCheckedActions, computeSaveUpdatedTaskActions, calendarTime, formatEfforts} from './helpers'
import {taskEnterButtonSelector, taskEnterInputSelector} from './properties'
import {taskListStateFactory} from './state'
import {CheckBox} from '../../../UI/CheckBox'
import {Editor} from '../../../UI/Editor'
import { InjectStateInSinks } from "../../../../../../src/components/Inject/InjectStateInSinks"
import {TaskInfo} from './TaskInfo'
import { ROUTE_PARAMS } from "../../../../../../src/components/Router/properties"

const $ = Rx.Observable;

// Helpers
const taskDeleteSelector = listIndex => `.task__delete.task__delete_${listIndex}`;

const TaskListContainer = vLift(
  div('.task-list__l-box-c', [
    div('.task-list__tasks', {slot: 'task'}, [])
  ])
);

function  TaskContainer (sources, settings){
  const {filteredTask : {done, title}, listIndex} = settings;
  const coreVnodes =   div('.task', [
    div(".task__l-box-a", {slot : 'checkbox'}, []),
    div(".task__l-box-b", [
      div(".task__title", {slot : 'editor'}, []),
      button(taskDeleteSelector(listIndex)),
      div('.task-infos', {slot : 'task-infos'}, []),
      div({slot: 'task-link'}, []),
    ])
  ]);

  return {
    [DOM_SINK] : $.of(
      done
        ?  div(`.task--done`, [coreVnodes])
        : coreVnodes
    )
  }
}

const TaskLink = DummyComponent;

// NOTE : Because Editor and CheckBox are reusable UI component, they are unaware of any domain
// model, and can only be parameterized through settings. `InjectSourcesAndSettings` is used to
// compute the necessary settings for those components
const Task = InjectSourcesAndSettings({
  settings : function(settings){
    const {filteredTask : {done, title}, listIndex} = settings;

    return {
      checkBox : { isChecked : !!done, namespace : [TASKS, listIndex].join('_'), label : undefined },
      editor : {showControls : true, initialEditMode : false, initialContent : title}
    }
  }
}, [TaskContainer, [
  InSlot('checkbox', [
    InjectStateInSinks({ isChecked$ : {as : 'isChecked', inject : {projectFb$ : 'projectFb'}}}, CheckBox)
  ]),
  InSlot('editor', [
    InjectStateInSinks({ save$ : {as : 'save', inject : {projectFb$ : 'projectFb', user$:'user'}}}, Editor)
  ]),
  TaskInfo,
    TaskDelete,
  // TODO : I AM here soon, refactor
  TaskLink
]]);

function TaskDelete(sources, settings){
  const {[DOM_SINK]: DOM, projectFb$, user$} = sources;
  const {[ROUTE_PARAMS]: { projectId }, filteredTasks, listIndex} = settings;
  const filteredTask = filteredTasks[listIndex];
  const {title} = filteredTask;

  const events = {
    taskDelete : DOM.select(taskDeleteSelector(listIndex)).events('click').do(preventDefault)
  };

  // TODO : also add log ot activity service
  // TODO : make sure activity service is also set when updating
  return {
    domainAction$ : events.taskDelete.withLatestFrom(projectFb$, user$, (_, {fbIndex, project}, user) => {

      return $.from([{
        context : TASKS,
        command : DELETE_TASK,
        payload : {projectFbIndex : fbIndex, tasks : project.tasks, filteredTask}
      },
        {
          context: ACTIVITIES,
          command: LOG_NEW_ACTIVITY,
          payload: activityFactory({
            user,
            time: +Date.now(),
            subject: projectId,
            category: 'tasks',
            title: 'A task was deleted',
            message: `The task "${title}" was deleted from #${projectId}.`
          })
        }
        ])
    })
        .switch()
  }
}

export const TaskList = InjectSources({filteredTasks$: taskListStateFactory}, [TaskListContainer,  [
  InSlot('task', [
    ForEach({from : 'filteredTasks$', as : 'filteredTasks'}, [
      ListOf({list : 'filteredTasks', as : 'filteredTask', buildActionsFromChildrenSinks : {
        isChecked$: computeTaskCheckedActions,
        save$ : computeSaveUpdatedTaskActions
      }, actionsMap : {'isChecked$' : 'domainAction$', 'save$' : 'domainAction$'}}, [
        EmptyComponent,
        Task
      ])])
  ])]]);

// TODO : not done, infinite scroll and draggable... and tags : DO THE TAGS dont know about scroll
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

