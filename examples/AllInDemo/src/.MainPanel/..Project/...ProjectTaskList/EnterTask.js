import * as Rx from "rx";
import { getInputValue, preventDefault } from "../../../../../../utils/src/index"
import { DOM_SINK } from "../../../../../../helpers/src/index"
import { button, div, input } from "cycle-snabbdom"
import { ROUTE_PARAMS } from "@rxcc/components"
import {
  ACTIVITIES, activityFactory, ADD_NEW_TASK, LOG_NEW_ACTIVITY, taskFactory, TASKS
} from "../../../../src/domain"
import { taskEnterButtonSelector, taskEnterInputSelector } from './properties'

const $ = Rx.Observable;

function renderTaskEntryArea(key) {
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
  const { [ROUTE_PARAMS]: { projectId } } = settings;
  const taskEnterButtonClick$ = sources[DOM_SINK].select(taskEnterButtonSelector).events('click')
  // NOTE : is event -> share
    .share();

  // NOTE :: we use a key here which changes all the time to force snabbdom to always render the
  // input vNodes. Because we read from the actual DOM, the input vNodes are no longer the
  // soruce of truth for the input state. From a snabbdom point of view, without that key, we
  // render two exact same vNodes and hence it does not do anything. So we have to force the
  // update by making the successive vNodes differ.
  return {
    [DOM_SINK]: taskEnterButtonClick$
      .map(_ => renderTaskEntryArea(++key))
      .startWith(renderTaskEntryArea(++key)),
    domainAction$: taskEnterButtonClick$
      .do(preventDefault)
      // Optimistic implementation. In the real word, we should check that the domain udpate went
      // through successfully and react appropriately if not. Just as the original Angular2
      // application does, we do not bother here
      .withLatestFrom(projectFb$, user$, (ev, projectFb, user) => {
        const { fbIndex: projectFbIndex, project } = projectFb;
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
            projectFbIndex,
            newTask: taskFactory(taskEnterDescription, newTaskPosition, nr),
            tasks
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

