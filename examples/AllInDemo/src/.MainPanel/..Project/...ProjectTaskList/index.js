import * as Rx from "rx";
import { OnRoute} from "../../../../../../src/components/Router/Router"
import { ForEach } from "../../../../../../src/components/ForEach/ForEach"
import { ListOf } from "../../../../../../src/components/ListOf/ListOf"
import { InSlot} from "../../../../../../src/components/InSlot"
import { InjectSources } from "../../../../../../src/components/Inject/InjectSources"
import { InjectSourcesAndSettings } from "../../../../../../src/components/Inject/InjectSourcesAndSettings"
import { DOM_SINK, EmptyComponent, DummyComponent, format, Div, Nav, vLift, preventDefault } from "../../../../../../src/utils"
import { pipe, values, keys, always, filter, map } from 'ramda'
import { a, p, div, img, nav, strong, h2, ul, li, button, input } from "cycle-snabbdom"
import { m } from "../../../../../../src/components/m/m"
import { ROUTE_PARAMS } from "../../../../../../src/components/Router/properties"
import { ROUTE_SOURCE } from "../../../../src/properties"
import { TASK_TAB_BUTTON_GROUP_STATE, PATCH } from "../../../../src/inMemoryStore"
import { TASKS, ADD_NEW_TASK } from "../../../../src/domain"

const $ = Rx.Observable;

// NOTE : Here we present a case of optimistic update for local state. This is fundamented in
// the fact that local state update cannot fail, that is the key difference vs. remotely persisted
// state.
// So: user clicks on a tab from the tab group, that updates the local state for the tab group,
// the ui updates, and then that local state is translated into a state update action for
// the corresponding app level piece of state (i.e. task filter)
// Note again that we have two semantically distinct concepts, which belong to two distinct
// layers :
// - which button of the button group is clicked
//   - that is UI state corresponding to the UI layer
//    - that state is not visible out of the specific portion of the UI it is declared in
// - what is the current filter for the tasks
//   - that is non-persisted local app state corresponding to the domain layer
//   - that is visible by the whole app

const tasksButtonGroupSettings = {
  buttonGroup:{
  labels : ['all', 'open', 'done'],
  buttonClasses : computeTasksButtonGroupClasses,
  namespace:'tasksButtonGroup'
}
}
const tasksButtonGroupInitialState = {label : 'all'};

function isButtonActive (buttonGroupState, label){
  return label === buttonGroupState.label
}

function makeButtonGroupSelector({label, index, namespace}){
  return `.${namespace}.${[label, index].join('-')}`
}

function tasksButtonGroupState$(sources, settings){
  // NOTE : we skip the basic assertions for this demo
  // - labels MUST be non-empty array (logically should even be more than one element)
  const {buttonGroup : {labels, namespace}} = settings;

  return {
    buttonGroupState$ : $.merge(labels.map((label, index) => {
    return sources[DOM_SINK].select(makeButtonGroupSelector({label, index, namespace})).events('click')
      .do(preventDefault)
      .map(ev => ({label, index}))
  }))
    .startWith(tasksButtonGroupInitialState)
    // those are events
    .share()
  }
}

function computeTasksButtonGroupClasses(buttonGroupState, label){
  const staticClasses = ['button', 'button--toggle'];
  const buttonClasses = isButtonActive (buttonGroupState, label) ? staticClasses.concat(['button--active']) : staticClasses

  return buttonClasses
}

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
    storeUpdate$: isButtonActive (buttonGroupState, label)
      ? $.of(updateTaskTabButtonGroupStateAction)
      : $.empty()
  }
}

/*
<button class="button button--toggle"
*ngFor="let button of buttonList"
  [class.button--active]="button === selectedButton"
(click)="onButtonActivate(button)">{{button}}</button>
*/
const ToggleButton =
  InjectSourcesAndSettings({sourceFactory: tasksButtonGroupState$, settings : tasksButtonGroupSettings}, [
    ForEach({from : 'buttonGroupState$', as : 'buttonGroupState'}, [
      ListOf({list : 'buttonGroup.labels', as : 'label'}, [
        DummyComponent,
        ButtonFromGroup
      ])
    ])
  ]);

const taskEnterInputSelector = ".enter-task__title-input#titleinput";
const taskEnterButtonSelector = ".enter-task__title-input#titleinput";

function EnterTask (sources, settings){
  const {projectsFb$} = sources;
  // TODO : get the value of the input
  const taskEnterDescription = sources.document.querySelector(taskEnterInputSelector);
  const taskEnterButtonClick$ = sources[DOM_SINK].select(taskEnterButtonSelector).event('click');
  const {[ROUTE_PARAMS] : {projectId}} = settings;

  return {
    [DOM_SINK] : $.merge($.of(false), taskEnterButtonClick$).map(isSecondRender => {
      const inputSettings = isSecondRender
        ? {
          // erase content of input
        "props": {
          value : ''
        },
          "attrs": {
            "type": "text",
            "placeholder": "Enter new task title...",
          }
        }
        : {
        "attrs": {
            "type": "text",
            "placeholder": "Enter new task title...",
          }
        }

      return div('.enter-task', [
      div(".enter-task__l-container", [
        div(".enter-task__l-box-a", [
          input(`${taskEnterButtonSelector}`, inputSettings, [])
        ]),
        div(".enter-task__l-box-b", [
          button(".button", [`Add Task`])
        ])
      ])
    ])}
    ),
    domainAction$: taskEnterButtonClick$
      .do(preventDefault)
      // In a normal case, I would have to do both update, remote state and duplicated local state
      // and then listen on both for optimistic auto-correct updates
      .withLatestFrom(projectsFb$, (ev, projectsFb) => {
     // TODO : this is a firebase operation, not a app state update operation - need fb index!!
        const index = values(projectsFb).findIndex(projectId);
        const fbIndex = keys(projectsFb)[index];

        return {
          context : TASKS,
          command : ADD_NEW_TASK,
          payload : {fbIndex, newTask: taskFactory(taskEnterDescription)} //TODO: write in domain driver? where?
        }
      })
  }
}

const TaskList = DummyComponent;

const ProjectTaskListContainer = vLift(
  div('.task-list.task-list__l-container', {slot: 'tab'}, [
    div('.task-list__l-box-a', {slot: 'toggle'}, []),
    div('.task-list__l-box-b', {slot : 'enter-task'},[]), // TODO .enter-task
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
  InSlot('toggle', [ToggleButton]),
    InSlot('enter-task', [EnterTask]),
//    InSlot('tasks', [TaskList])
]]);

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
