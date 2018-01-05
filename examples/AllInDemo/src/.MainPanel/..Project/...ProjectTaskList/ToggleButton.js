import { InjectSourcesAndSettings } from "../../../../../../src/components/Inject/InjectSourcesAndSettings"
import { DOM_SINK } from "../../../../../../src/utils"
import { button } from "cycle-snabbdom"
import { PATCH, TASKS_FILTER } from "../../../../src/inMemoryStore"
import { makeButtonGroupSelector } from './helpers'
import { tasksButtonGroupSettings } from './properties'
import { tasksFilter$ } from './state'
import { always, merge, prop } from 'ramda'

const $ = Rx.Observable;

// Helpers
const updateTaskTabButtonGroupStateAction = label => ({
  context: TASKS_FILTER,
  command: PATCH,
  payload: [
    { op: "add", path: '/filter', value: label },
  ]
});

// Displays a button with parameterized label, with status depending on tasks filter
function ButtonFromButtonGroup(sources, settings) {
  const { taskFilter$ } = sources;
  const { buttonLabel, index, buttonGroup: { labels, namespace, buttonClasses } } = settings;
  const buttonGroupSelector = makeButtonGroupSelector({ label: buttonLabel, index, namespace });

  const events = {
    click: sources[DOM_SINK].select(buttonGroupSelector).events('click')
      .map(always(buttonLabel))
  };
  const state$ = taskFilter$;
  return {
    [DOM_SINK]: state$.map(taskFilter => {
      const classes = ['']
        .concat(buttonClasses(taskFilter, buttonLabel))
        .join('.') + buttonGroupSelector;

      return button(classes, buttonLabel)
    }),
    storeUpdate$: events.click
      .withLatestFrom(state$, (label, taskFilter) => ({ label, taskFilter }))
      // no need to do anything if clicking on a button already active
      .filter(x => x.label !== x.taskFilter)
      .map(prop('label'))
      .map(updateTaskTabButtonGroupStateAction)
  }
}

export const ToggleButton =
  InjectSourcesAndSettings({
      sourceFactory: tasksFilter$,
      settings: tasksButtonGroupSettings
    }, tasksButtonGroupSettings.buttonGroup.labels.map((buttonLabel, index) => {
      return function (sources, settings) {
        return ButtonFromButtonGroup(sources, merge(settings, {
          buttonLabel,
          index
        }))
      }
    })
  );
