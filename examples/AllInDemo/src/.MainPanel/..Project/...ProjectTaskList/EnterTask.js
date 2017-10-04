import * as Rx from "rx";
import { DOM_SINK, getInputValue, preventDefault } from "../../../../../../src/utils"
import { always, keys, values } from 'ramda'
import { button, div, input } from "cycle-snabbdom"
import { ROUTE_PARAMS } from "../../../../../../src/components/Router/properties"
import {
  ACTIVITIES, activityFactory, ADD_NEW_TASK, LOG_NEW_ACTIVITY, taskFactory, TASKS
} from "../../../../src/domain"
import { taskEnterButtonSelector, taskEnterInputSelector } from './properties'

const $ = Rx.Observable;

function render(key) {
  return div('.enter-task', [
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
            value: '',
            required: false
          }
        })
      ]),
      div(".enter-task__l-box-b", [
        button(`${taskEnterButtonSelector}`, [`Add Task`])
      ])
    ])
  ])
}

export function EnterTask(sources, settings) {
  let key = 0;
  const { projectFb$, user$, document } = sources;
  debugger
  const taskEnterButtonClick$ = sources[DOM_SINK].select(taskEnterButtonSelector).events('click')
  // NOTE : is event -> share
    .share();
  const { [ROUTE_PARAMS]: { projectId } } = settings;

  // NOTE :: we use a key here which changes all the time to force snabbdom to always render the
  // input vNodes. Because we read from the actual DOM, the input vNodes are no longer the
  // soruce of truth for the input state. From a snabbdom point of view, we render two exact
  // same vNodes and hence it does not do anything. So we have to force the update.
  return {
    [DOM_SINK]: taskEnterButtonClick$
      .map(always(render(key++)))
      .startWith(render(key++)),
    domainAction$: taskEnterButtonClick$
      .do(preventDefault)
      // In a normal case, I would have to do both update, remote state and duplicated local state
      // and then listen on both for optimistic auto-correct updates
      .withLatestFrom(projectFb$, user$, (ev, projectFb, user) => {
        // TODO : update with now the new source injected projectFb$ = {fbIndex,
        // project}
        const {fbIndex, project} = projectFb;
        const tasks = project.tasks;
        const newTaskPosition = tasks.length;
        const nr = tasks.reduce((maxNr, task) => task.nr > maxNr ? task.nr : maxNr, 0) + 1;
        // NOTE : has to be computed just before it is used, otherwise might not get the current
        // value
        const _taskEnterDescription = getInputValue(document, taskEnterInputSelector);
        const taskEnterDescription = _taskEnterDescription ? _taskEnterDescription : 'Task';

        // NOTE : We have two domain actions to perform here
        return $.from([{
          context: TASKS,
          command: ADD_NEW_TASK,
          payload: {
            fbIndex,
            newTask: taskFactory(taskEnterDescription, newTaskPosition, nr),
            newTaskPosition
          }
        }, {
          context: ACTIVITIES,
          command: LOG_NEW_ACTIVITY,
          payload: activityFactory({
            user,
            time: +Date.now(),
            subject: projectId,
            category: 'tasks',
            title: 'A task was added',
            message: `A new task "'A task was added'" was added to #${projectId}.`
          })
        }
        ])
      })
      .switch()
  }
}

