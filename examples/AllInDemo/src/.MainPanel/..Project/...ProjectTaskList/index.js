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
import { TASK_TAB_BUTTON_GROUP_STATE, PATCH } from "../../../../src/inMemoryStore/index"

const $ = Rx.Observable;

const tasksButtonGroupSettings = {
  labels : ['all', 'open', 'done'],
  buttonClasses : computeTasksButtonGroupClasses,
  namespace:'tasksButtonGroup'
}
const tasksButtonGroupInitialState = {label : 'all'};

function isButtonActive (buttonGroupState, label){
  return label === buttonGroupState.label
}

function makeButtonGroupSelector({label, index, namespace}){
  return `.${namespace}.${[label,index].join('-')}`
}

function tasksButtonGroupState$(sources, settings){
  // NOTE : we skip the basic assertions for this demo
  // - labels MUST be non-empty array (logically should even be more than one element)
  const {buttonGroup : {labels, namespace}} = settings;

  return $.merge(labels.map((label, index) => {
    return sources[DOM_SINK].select(makeButtonGroupSelector({label, index, namespace})).events('click')
      .do(preventDefault)
      .map(ev => ({label, index}))
      .startWith(tasksButtonGroupInitialState)
  }))
    // those are events
    .share()
}

function computeTasksButtonGroupClasses(buttonGroupState, label){
  const staticClasses = ['button', 'button--toggle'];
  const buttonClasses = isButtonActive (buttonGroupState, label) ? staticClasses.concat(['button--active']) : staticClasses

  return buttonClasses
}

function ButtonFromGroup(sources, settings) {
  const {buttonGroupState, label, buttonClasses} = settings;
  // NOTE : need to update non-persisted app state (task tab state more precisely)
  // This is related but distinct from the state carried by tasksButtonGroupState$
  // The state of the button group is part of the non-persisted app state, the same as the
  // button group is part of the tab which is part of the application
  // NOTE : once we used a ForEach on an EVENT source, we cannot reuse that source anymore, the
  // event will already have been emitted!! This is a VERY common source of annoying bugs
  const classes = buttonClasses(buttonGroupState, label).join(' ');

  return {
    [DOM_SINK] : $.of(
      button(classes, {}, label)
    ),
    storeUpdate$: isButtonActive (buttonGroupState, label)
      ? $.of({
      context : TASK_TAB_BUTTON_GROUP_STATE,
      command : PATCH,
      payload : [
        { op: "add", path: '/filter', value: label },
      ]
    })
      : $.empty()
  }
}

// Kind of states
// - Persisted
//   - Persisted locally
//     - copy of remote data
//     - original data, whose scope of use is only local
//       - app state
//       - session state?
//     - ui state
//     - route
//   - Persisted remotely
// - Not persisted
//   - transient, disappear when some object become out of scope, cannot be recovered

/*
<button class="button button--toggle"
*ngFor="let button of buttonList"
  [class.button--active]="button === selectedButton"
(click)="onButtonActivate(button)">{{button}}</button>
*/
const ToggleButton =
  InjectSourcesAndSettings({buttonGroupState$: tasksButtonGroupState$, settings : tasksButtonGroupSettings}, [
    ForEach({from : 'buttonGroupState$', as : 'buttonGroupState'}, [
      ListOf({list : 'labels', as : 'label'}, [
        EmptyComponent,
        ButtonFromGroup
      ])
    ])
  ]);

const EnterTask = DummyComponent;
const TaskList = DummyComponent;

const ProjectTaskListContainer = vLift(
  div('.task-list.task-list__l-container', {slot: 'tab'}, [
    div('.task-list__l-box-a', {slot: 'toggle'}, []),
    div('.task-list__l-box-b', {slot : 'enter-task'},[]),
    div('.task-list__l-box-c', [
      div('.task-list__tasks', {slot : 'tasks'}, [])
    ])
]));

/*
<ngc-task-list [tasks]="project.tasks"
  [activitySubject]="project"
(tasksUpdated)="updateTasks($event)"></ngc-task-list>
*/
export const ProjectTaskList =
  m({},{},[ProjectTaskListContainer, [
  InSlot('toggle', ToggleButton),
    InSlot('enter-task', EnterTask),
    InSlot('tasks', TaskList)
]]);

// TODO : InSlot combinator which only adds a slot on a vNode

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

