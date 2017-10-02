import { ListOf } from "../../../../../../src/components/ListOf/ListOf"
import { InSlot} from "../../../../../../src/components/InSlot"
import { InjectSources } from "../../../../../../src/components/Inject/InjectSources"
import { InjectSourcesAndSettings } from "../../../../../../src/components/Inject/InjectSourcesAndSettings"
import { DOM_SINK, EmptyComponent, DummyComponent, format, Div, Nav, vLift, preventDefault, getInputValue } from "../../../../../../src/utils"
import { pipe, values, keys, always, filter, path, map, prop } from 'ramda'
import { a, p, div, img, nav, strong, h2, ul, li, button, input } from "cycle-snabbdom"
import { m } from "../../../../../../src/components/m/m"
import { ROUTE_PARAMS } from "../../../../../../src/components/Router/properties"
import { TASK_TAB_BUTTON_GROUP_STATE, PATCH } from "../../../../src/inMemoryStore"
import { TASKS, ADD_NEW_TASK, ACTIVITIES, LOG_NEW_ACTIVITY, taskFactory, activityFactory } from "../../../../src/domain"
import {filterTasks, isButtonActive, makeButtonGroupSelector, computeTasksButtonGroupClasses} from './helpers'
import {tasksButtonGroupInitialState} from './properties'

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
export function tasksButtonGroupState$(sources, settings){
  // NOTE : we skip the basic assertions for this demo
  // - labels MUST be non-empty array (logically should even be more than one element)
  const {buttonGroup : {labels, namespace}} = settings;
  const {projects$, storeAccess, storeUpdate$} = sources;
  // Initial button state is in the in-memory store
  const initialButtonGroupState$ = storeAccess.getCurrent(TASK_TAB_BUTTON_GROUP_STATE)
  // slice out the relevant part of the state
    .map(prop('filter'))
    .map(x => ({label: x}))
  ;

  return {
    buttonGroupState$ : $.concat(
      initialButtonGroupState$,
      // NOTE: that is one way to merge a group of component's event. The other way is in the ListOf
      $.merge(labels.map((label, index) => {
          return sources[DOM_SINK].select(makeButtonGroupSelector({label, index, namespace})).events('click')
            .do(preventDefault)
            .map(ev => ({label, index}))
        }))
      )
      // those are events
      .share()
  }
}

export function taskListStateFactory(sources, settings){
  const {projects$, storeAccess, storeUpdate$} = sources;
  const {[ROUTE_PARAMS] : {projectId}} = settings;

  // NOTE:  filter will be in {filter: ...}
  const taskFilter$ = storeAccess.getCurrent(TASK_TAB_BUTTON_GROUP_STATE)
    .concat(storeUpdate$.getResponse(TASK_TAB_BUTTON_GROUP_STATE).map(path(['response'])))
    // NOTE : this is a behaviour
    .shareReplay(1)
  ;

  const filteredTasks$ = projects$
  // NOTE : `combineLatest`, not `withLatestFrom` as we want to update also when the filter changes
  // so taskFilter$ is a behaviour resulting from the combination of two behaviours
    .combineLatest(taskFilter$, (projects, {filter: taskFilter}) => {
      return projects
        .filter(project => project._id === projectId)
        .map(project => filterTasks(project.tasks, taskFilter))
      [0]
    })
    // NOTE : this is a behaviour
    .shareReplay(1);

  return {
    taskFilter$,
    filteredTasks$
  }
}

