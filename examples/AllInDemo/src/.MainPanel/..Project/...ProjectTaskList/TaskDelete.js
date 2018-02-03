import * as Rx from "rx";
import { preventDefault } from "../../../../../../utils/src/index"
import { DOM_SINK } from "../../../../../../helpers/src/index"
import {
  ACTIVITIES, activityFactory, DELETE_TASK, LOG_NEW_ACTIVITY, TASKS
} from "../../../../src/domain"
import { ROUTE_PARAMS } from "@rxcc/components"

const $ = Rx.Observable;

// Helpers
export const taskDeleteSelector = listIndex => `.task__delete.task__delete_${listIndex}`;

export function TaskDelete(sources, settings) {
  const { [DOM_SINK]: DOM, projectFb$, user$ } = sources;
  const { [ROUTE_PARAMS]: { projectId }, filteredTasks, listIndex } = settings;
  const filteredTask = filteredTasks[listIndex];
  const { title } = filteredTask;

  const events = {
    taskDelete: DOM.select(taskDeleteSelector(listIndex)).events('click').do(preventDefault)
  };

  // TODO : also add log ot activity service
  // TODO : make sure activity service is also set when updating
  return {
    domainAction$: events.taskDelete.withLatestFrom(projectFb$, user$, (_, { fbIndex, project },
                                                                        user) => {

      return $.from([{
        context: TASKS,
        command: DELETE_TASK,
        payload: { projectFbIndex: fbIndex, tasks: project.tasks, filteredTask }
      },
        {
          context: ACTIVITIES,
          command: LOG_NEW_ACTIVITY,
          payload: activityFactory({
            user,
            time: +Date.now(),
            subject: projectId,
            category: 'tasks',
            title: 'A task was deleted',
            message: `The task "${title}" was deleted from #${projectId}.`
          })
        }
      ])
    })
      .switch()
  }
}

