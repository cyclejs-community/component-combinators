import * as Rx from "rx";
import { OnRoute} from "../../../../../../src/components/Router/Router"
import { ForEach } from "../../../../../../src/components/ForEach/ForEach"
import { ListOf } from "../../../../../../src/components/ListOf/ListOf"
import { InSlot} from "../../../../../../src/components/InSlot"
import { InjectSources } from "../../../../../../src/components/Inject/InjectSources"
import { InjectSourcesAndSettings } from "../../../../../../src/components/Inject/InjectSourcesAndSettings"
import { DOM_SINK, EmptyComponent, DummyComponent, format, Div, Nav, vLift, preventDefault, getInputValue } from "../../../../../../src/utils"
import { pipe, values, keys, always, filter, map } from 'ramda'
import { a, p, div, img, nav, strong, h2, ul, li, button, input } from "cycle-snabbdom"
import { m } from "../../../../../../src/components/m/m"
import { ROUTE_PARAMS } from "../../../../../../src/components/Router/properties"
import { TASK_TAB_BUTTON_GROUP_STATE, PATCH } from "../../../../src/inMemoryStore"
import { TASKS, ADD_NEW_TASK, ACTIVITIES, LOG_NEW_ACTIVITY, taskFactory, activityFactory } from "../../../../src/domain"

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

const ToggleButton =
  InjectSourcesAndSettings({sourceFactory: tasksButtonGroupState$, settings : tasksButtonGroupSettings}, [
    ForEach({from : 'buttonGroupState$', as : 'buttonGroupState'}, [
      ListOf({list : 'buttonGroup.labels', as : 'label'}, [
        DummyComponent,
        ButtonFromGroup
      ])
    ])
  ]);

// BUG : if "#title_input.enter-task__title-input" is replaced by
// BUG : ".enter-task__title-input#title_input", then input tag appears as <input.enter-tas...>!!
const taskEnterInputSelector = "#title_input.enter-task__title-input";
const taskEnterButtonSelector = ".button.enter-task__l-box-b";

function EnterTask (sources, settings){
  let key =0;
  const {projectsFb$, user$, document} = sources;
  const taskEnterButtonClick$ = sources[DOM_SINK].select(taskEnterButtonSelector).events('click')
  // NOTE : is event -> share
    .share();
  const {[ROUTE_PARAMS] : {projectId}} = settings;

  // NOTE :: we use a key here which changes all the time to force snabbdom to always render the
  // input vNodes. Because we read from the actual DOM, the input vNodes are no longer the
  // soruce of truth for the input state. From a snabbdom point of view, we render two exact
  // same vNodes and hence it does not do anything. So we have to force the update.
  const vNodes = key => div('.enter-task', [
    div(".enter-task__l-container", [
      div(".enter-task__l-box-a", [
        input(taskEnterInputSelector, {
          // erase content of input
          "key": key,
          "attrs": {
            "type": "text",
            "placeholder": "Enter new task title...",
          },
          "props": {
            value : '',
            required: false
          }
        })
      ]),
      div(".enter-task__l-box-b", [
        button(`${taskEnterButtonSelector}`, [`Add Task`])
      ])
    ])
  ]);

  return {
    [DOM_SINK] : taskEnterButtonClick$
      .map(always(vNodes(key++)))
      .startWith(vNodes(key++)),
    domainAction$: taskEnterButtonClick$
      .do(preventDefault)
      // In a normal case, I would have to do both update, remote state and duplicated local state
      // and then listen on both for optimistic auto-correct updates
      .withLatestFrom(projectsFb$, user$, (ev, projectsFb, user) => {
        const index = values(projectsFb).findIndex(project => project._id === projectId);
        const fbIndex = keys(projectsFb)[index];
        const tasks = projectsFb[fbIndex].tasks
        const newTaskPosition = tasks.length;
        const nr = tasks.reduce((maxNr, task) => task.nr > maxNr ? task.nr : maxNr, 0) + 1;
        // NOTE : has to be computed just before it is used, otherwise might not get the current
        // value
        const _taskEnterDescription = getInputValue(document, taskEnterInputSelector);
        const taskEnterDescription = _taskEnterDescription ? _taskEnterDescription : 'Task';

        // NOTE : We have two domain actions to perform here
        return $.from([{
          context : TASKS,
          command : ADD_NEW_TASK,
          payload : {fbIndex, newTask: taskFactory(taskEnterDescription, newTaskPosition, nr), newTaskPosition}
        }, {
          context : ACTIVITIES,
          command : LOG_NEW_ACTIVITY,
          payload : activityFactory({
            user,
            time : +Date.now(),
            subject : projectId,
            category : 'tasks',
            title : 'A task was added',
            message : `A new task "'A task was added'" was added to #${projectId}.`
          })
        }
        ])
      })
      .switch()
  }
}

function taskFilter$(sources, settings){
  // TODO: finish . reminder /filter hold the filter
  // TODO : add the getResponse to have constantly updated value
  return sources.storeAccess.getCurrent(TASK_TAB_BUTTON_GROUP_STATE, null)
}

function filteredTasks$(sources, settings){
  const {[ROUTE_PARAMS] : {projectId}} = settings;

  return sources.projects$.map(projects => {
    return projects
      .filter(project => project._id === projectId)
      .map(projects => projects[0])
      .map(project => project.tasks)
      .map(tasks => tasks.filter(task => {
        return task.done
      }))

  })
}

// TODO : merge that cf. below
taskFilterChange(filter) {
  this.selectedTaskFilter = filter;
  this.filteredTasks = this.tasks ? this.tasks.filter((task) => {
    if (filter === 'all') {
      return true;
    } else if (filter === 'open') {
      return !task.done;
    } else {
      return task.done;
    }
  }) : [];
}

const TaskListContainer = vLift(
  div('.task-list__l-box-c', [
    div('.task-list__tasks', {slot: 'task'}, [])
  ])
);
//TODO : change to sources and settigns to have filteredTasks$, taskFilter$ BOTH (one depends on
// the other...) beware that when the filter change the filterTask must also change!! this is a
// combineLatest
const TaskList = InjectSourcesAndSettings({filteredTasks$, taskFilter$}, [TaskListContainer,  InSlot('task', [
  // TODO : only filtered tasks
  // ForEach filteredTasks$ ListOf Task
])]);

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
