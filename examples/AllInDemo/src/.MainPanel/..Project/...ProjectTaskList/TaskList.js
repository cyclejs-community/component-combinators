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
import { DummyComponent } from "../../../../../../src"

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
    // TODO : school case for using Pipe
    // TODO: Pipe ({}, [Editor, ({save$, projectFb$, user$}) => {save$ : $.combineLatest([save$,
    // projectFb$, user$], (save, projectDb, user) => {save, projectDb, user})})])
    // TODO : or Pipe({}, [Editor, collapseSources({target:[save$, save],
    // TODO :                                       objects:[[user$, user], [...], ...]})])
    // TODO : collapseSources generic COMPONENT (not combinator) for INTERFACE ADAPTATION concern
    // DOC : this responnds to the desire to enrich generic components with data from additional
    // concerns
    // TODO : do the sink name napping here : Pipe({}, Editor, coll..., renameSinks({save$ ->
    // domainAction})), and then what is several sources for one target? apply merge default??
    // not customizable? should also add as parameter the same syntax than `m` for merge functions
    // NOTE: the problem here is we mix events, event factory, and behaviours in sources
    // sav$ is an event, we want to compute event data with the state in sources.
    // No specific combinator? just a component Pipe(editor, computeEventData), do the rename in
    // computeEventData, or directly Pipe(editor, computeActions) because after renaming, it is
    // actions!!
    // TODO : Pipe({},[WithEvents(...), WithState(...), ComputeActions(...)]) would be any leaf
    // component including generic or ad-hoc components.
    // InjectSources would be state visible in all the hierarchy, while WithState only visible
    // in Pipe - ComputeActions
    // Those three components actually are the same component sources -> settings, what changes
    // is meaning i.e. meta like log
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
        // TODO : this would be a good case for using PIPE combinator right? That would avoid
        // injectStateInSinks usage
        // TODO Task has events who should be as sources of ListOf, and then actions should be
        // derived from this, so need for buildActions... and InjectStatesFromSinks
        // but then I have to separate DOM display and events? to think about how to do nicely
        // maybe with pipe
        // TODO : change buildActionsFromChildrenSinks to `foldChildrenSinks`
        // TODO : remove the actionsMap and use Pipe (ListOf..., ), but if I do that, I need to
        // pass the mapped sinks explicitly as is logical but also explicity the sinks now in
        // sources and which I want to pass... I am in favor of expliciting sinks as little as
        // ncessary, because it can only be string and that cant be typed. Also less robust, if
        // below sinks change, we have to update the list also there : hidden dependency... or
        // the opposite : explicit make it visible and less possible to forget?
        // TODO : rather use special combinator for interface mapping purposes.
        // SinkMap({map: ...}, Task} : could be extended to a postprocessing function of `m`
        // m, preconditions, preprocessing (makeExtraSources...), main, postconditions,
        // postprocessing (to be named)
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

