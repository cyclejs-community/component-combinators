import { DOM_SINK, labelSourceWith, preventDefault } from "../../../../../../src/utils"
import { prop } from 'ramda'
import { ROUTE_PARAMS } from "../../../../../../src/components/Router/properties"
import { getStateInStore, TASK_TAB_BUTTON_GROUP_STATE } from "../../../../src/inMemoryStore"
import { filterTasks, makeButtonGroupSelector } from './helpers'
import { INITIAL_SHOWN_TASK_COUNT, SCROLL_INCREMENT, TaskListScrollBarSelector } from './properties'

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
export function tasksButtonGroupStateChange$(sources, settings) {
  // NOTE : we skip the basic assertions for this demo
  // - labels MUST be non-empty array (logically should even be more than one element)
  const { buttonGroup: { labels, namespace } } = settings;
  const { projects$, storeAccess, storeUpdate$ } = sources;
  // Initial button state is in the in-memory store
  const initialButtonGroupState$ = storeAccess.getCurrent(TASK_TAB_BUTTON_GROUP_STATE)
    // slice out the relevant part of the state
      .map(prop('filter'))
      .map(x => ({ label: x }))
  ;

  return {
    buttonGroupStateChange$: $.concat(
      initialButtonGroupState$,
      // NOTE: that is one way to merge a group of component's event. The other way is in the ListOf
      $.merge(labels.map((label, index) => {
        return sources[DOM_SINK].select(makeButtonGroupSelector({
          label,
          index,
          namespace
        })).events('click')
          .do(preventDefault)
          .map(ev => ({ label, index }))
      }))
    )
    // those are events
      .share()
  }
}

function getTaskFilter(sources, settings) {
  // NOTE:  filter will be in {filter: ...}
  return getStateInStore(TASK_TAB_BUTTON_GROUP_STATE, sources, settings)
}

// Checks if an element with scrollbars is fully scrolled to the bottom
function isScrolledBottom(element) {
  return element.scrollHeight - element.scrollTop === element.clientHeight
}

function getShowMoreItemsEvent(sources, settings) {
  const { document } = sources;
  const scrollableElement = document.querySelector(TaskListScrollBarSelector);
  const scroll$ = sources[DOM_SINK].select(TaskListScrollBarSelector).events('scroll', { useCapture: true }).share();

  return scroll$
    .tap(x => {
      debugger
    })
    .map(_ => scrollableElement && isScrolledBottom(scrollableElement))
    .filter(Boolean)
  // TODO : check it works, hopefully won't fire too much, if not add a throttle
  // TODO : beware if scroll will bubble, depends on cycle DOM version cf.
  // https://github.com/cyclejs/cyclejs/issues/308 : SHOULD BE WORKING!!
}

export function taskListStateFactory(sources, settings) {
  const { projects$ } = sources;
  const { [ROUTE_PARAMS]: { projectId } } = settings;

  // Type : Array<Tasks> array of tasks taken for the selected project and filtered by selected
  // filter
  const filteredTasks$ = projects$
  // NOTE : `combineLatest`, not `withLatestFrom` as we want to update also when the filter changes
  // so taskFilter$ is a behaviour resulting from the combination of two behaviours
    .combineLatest(
      getTaskFilter(sources, settings),
      (projects, { filter: taskFilter }) => {
        return projects
          .filter(project => project._id === projectId)
          .map(project => filterTasks(project.tasks, taskFilter))[0]
      })
    // NOTE : this is an EVENT! which is filtered task value change event
    .share();

  return {
    filteredTasks$
  }
}

