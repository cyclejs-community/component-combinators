import * as Rx from "rx";
import { OnRoute} from "../../../../../../src/components/Router/Router"
import { ForEach } from "../../../../../../src/components/ForEach/ForEach"
import { ListOf } from "../../../../../../src/components/ListOf/ListOf"
import { InjectSources } from "../../../../../../src/components/Inject/InjectSources"
import { InjectSourcesAndSettings } from "../../../../../../src/components/Inject/InjectSourcesAndSettings"
import { DOM_SINK, EmptyComponent, DummyComponent, format, Div, Nav, vLift,firebaseListToArray, preventDefault } from "../../../../../../src/utils"
import { pipe, values, always, filter, map } from 'ramda'
import { a, p, div, img, nav, strong, h2, ul, li, button } from "cycle-snabbdom"
import { m } from "../../../../../../src/components/m/m"
import { ROUTE_PARAMS } from "../../../../../../src/components/Router/properties"
import { ROUTE_SOURCE } from "../../../../src/properties"

const ToggleButton = DummyComponent;
const EnterTask = DummyComponent;
const TaskList = DummyComponent;

const ProjectTaskListContainer = vLift(
  div('.task-list.task-list__l-container', {slot: 'tab'}, [
  div('.task-list__l-box-a', {slot: 'toggle'}, []),
    div('.task-list__l-box-b', {slot : 'enter-task'},[]),
    div('.task-list__l-box-c', [
      div('.task-list__tasks', {slot : 'task'}, [])
    ])
]));

/*
<ngc-task-list [tasks]="project.tasks"
  [activitySubject]="project"
(tasksUpdated)="updateTasks($event)"></ngc-task-list>
*/
export const ProjectTaskList = m({},{},[ProjectTaskListContainer, [
  ToggleButton,
  EnterTask,
  TaskList
]
]);

  /*
  <div class="task-list__l-box-a">
    <ngc-toggle [buttonList]="taskFilterList" [selectedButton]="selectedTaskFilter"
  (selectedButtonChange)="taskFilterChange($event)">
    </ngc-toggle>
  </div>
  */
/*
  <div class="task-list__l-box-b">
<ngc-enter-task (taskEntered)="addTask($event)"></ngc-enter-task>
  </div>
*/
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

