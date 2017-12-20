import * as Rx from "rx";
import { ForEach } from "../../../../../../src/components/ForEach/ForEach"
import { ListOf } from "../../../../../../src/components/ListOf/ListOf"
import { InSlot} from "../../../../../../src/components/InSlot"
import { InjectSources } from "../../../../../../src/components/Inject/InjectSources"
import { InjectSourcesAndSettings } from "../../../../../../src/components/Inject/InjectSourcesAndSettings"
import { DOM_SINK, EmptyComponent, DummyComponent, format, Div, Nav, vLift, preventDefault } from "../../../../../../src/utils"
import { pipe, values, keys, always, filter, path, map } from 'ramda'
import { a, p, div, img, nav, h2, ul, li, button, input, strong } from "cycle-snabbdom"
import { UPDATE_TASK_COMPLETION_STATUS, TASKS, DELETE_TASK, ACTIVITIES, LOG_NEW_ACTIVITY, activityFactory, taskFactory } from "../../../../src/domain"
import {computeTaskCheckedActions, computeSaveUpdatedTaskActions, calendarTime, formatEfforts} from './helpers'
import {taskEnterButtonSelector, taskEnterInputSelector} from './properties'
import {taskListStateFactory} from './state'
import {CheckBox} from '../../../UI/CheckBox'
import {Editor} from '../../../UI/Editor'
import { InjectStateInSinks } from "../../../../../../src/components/Inject/InjectStateInSinks"
import {TaskInfo} from './TaskInfo'
import { ROUTE_PARAMS } from "../../../../../../src/components/Router/properties"

const $ = Rx.Observable;

// Helpers
export const taskDeleteSelector = listIndex => `.task__delete.task__delete_${listIndex}`;

export function TaskDelete(sources, settings){
  const {[DOM_SINK]: DOM, projectFb$, user$} = sources;
  const {[ROUTE_PARAMS]: { projectId }, filteredTasks, listIndex} = settings;
  const filteredTask = filteredTasks[listIndex];
  const {title} = filteredTask;

  const events = {
    taskDelete : DOM.select(taskDeleteSelector(listIndex)).events('click').do(preventDefault)
  };

  // TODO : also add log ot activity service
  // TODO : make sure activity service is also set when updating
  return {
    domainAction$ : events.taskDelete.withLatestFrom(projectFb$, user$, (_, {fbIndex, project}, user) => {

      return $.from([{
        context : TASKS,
        command : DELETE_TASK,
        payload : {projectFbIndex : fbIndex, tasks : project.tasks, filteredTask}
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

