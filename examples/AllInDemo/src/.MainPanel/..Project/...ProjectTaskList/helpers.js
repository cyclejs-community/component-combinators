import * as Rx from "rx";
import { DOM_SINK } from "@rxcc/utils"
import {
  ACTIVITIES, activityFactory, LOG_NEW_ACTIVITY, TASKS, UPDATE_TASK_COMPLETION_STATUS,
  UPDATE_TASK_DESCRIPTION
} from "../../../../src/domain"
import { merge } from "ramda"
import Moment from 'moment'

const $ = Rx.Observable;

export function filterTasks(tasks, taskFilter) {
  return tasks
    ? tasks.reduce((acc, task, index) => {
      if (taskFilter === 'all') {
        acc.push(merge(task, { index }));
        return acc
      }
      if ((taskFilter === 'open') && !task.done) {
        acc.push(merge(task, { index }));
        return acc
      }
      if ((taskFilter === 'done') && task.done) {
        acc.push(merge(task, { index }));
        return acc
      }

      return acc
    }, [])
    : []
}

export function isButtonActive(taskFilter, label) {
  return label === taskFilter
}

export function makeButtonGroupSelector({ label, index, namespace }) {
  return `.${namespace}.${[label, index].join('-')}`
}

export function computeTaskFilterTabClasses(taskFilter, label) {
  const staticClasses = ['button', 'button--toggle'];
  const buttonClasses = isButtonActive(taskFilter, label)
    ? staticClasses.concat(['button--active'])
    : staticClasses;

  return buttonClasses
}

export function ComputeCheckBoxActions(sources, settings) {
  // NOTE : I now have DOM, save$, focus sources from Editor sinks, thanks to Pipe
  const { isChecked$, projectFb$ } = sources;
  const { filteredTask } = settings;

  // NOTE : common mistake is to forget to pass the sinks from the previous component in the pipe
  return {
    [DOM_SINK]: sources[DOM_SINK],
    domainAction$: isChecked$.withLatestFrom(projectFb$, (isChecked, projectFb) => {
      const { fbIndex, project } = projectFb;

      return {
        context: TASKS,
        command: UPDATE_TASK_COMPLETION_STATUS,
        payload: { isChecked, project, projectFbIndex: fbIndex, filteredTask }
      }
    })
  }
}

export function ComputeEditorActions(sources, settings) {
  // NOTE : I now have DOM, save$, focus sources from Editor sinks, thanks to Pipe
  const { save$, focus, projectFb$, user$ } = sources;
  const { filteredTask } = settings;

  // NOTE : common mistake is to forget to pass the sinks from the previous component in the pipe
  return {
    [DOM_SINK]: sources[DOM_SINK],
    focus,
    domainAction$: save$
      .withLatestFrom(projectFb$, user$, (save, projectFb, user) => {
        const { fbIndex, project: { _id: projectId } } = projectFb;
        const { editMode, textContent } = save;
        // NOTE : the index of the child correspond to the index of the item in the list

        return $.from([
          {
            context: TASKS,
            command: UPDATE_TASK_DESCRIPTION,
            payload: { newTitle: textContent, projectFbIndex: fbIndex, filteredTask }
          },
          {
            context: ACTIVITIES,
            command: LOG_NEW_ACTIVITY,
            payload: activityFactory({
              user,
              time: +Date.now(),
              subject: projectId,
              category: 'tasks',
              title: 'A task was updated',
              message: `The task "'A task was added'" was updated on #${projectId}.`
            })
          }
        ])
      })
      .switch()
  }
}

export const UNITS = [{
  short: 'w',
  milliseconds: 5 * 8 * 60 * 60 * 1000
}, {
  short: 'd',
  milliseconds: 8 * 60 * 60 * 1000
}, {
  short: 'h',
  milliseconds: 60 * 60 * 1000
}, {
  short: 'm',
  milliseconds: 60 * 1000
}];

export function formatDuration(timeSpan) {
  return UNITS.reduce((str, unit) => {
    const amount = timeSpan / unit.milliseconds;
    if (amount >= 1) {
      const fullUnits = Math.floor(amount);
      const formatted = `${str} ${fullUnits}${unit.short}`;
      timeSpan -= fullUnits * unit.milliseconds;
      return formatted;
    } else {
      return str;
    }
  }, '').trim();
}

export function calendarTime(value) {
  if (value && (value instanceof Date || typeof value === 'number')) {
    return new Moment(value).calendar();
  }
}

export function formatEfforts(value) {
  if (value == null || typeof value !== 'object') {
    return value;
  }

  return `${formatDuration(value.effective) || 'none'} of ${formatDuration(value.estimated) || 'un-estimated'}`;
}

export function findScrollableParent(element) {
  while ( element != document.documentElement ) {
    if (getComputedStyle(element).overflowY !== 'visible') {
      break;
    }
    element = element.parentElement;
  }

  return element;
}
