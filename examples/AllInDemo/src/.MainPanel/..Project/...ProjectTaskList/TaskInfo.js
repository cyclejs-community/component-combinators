import * as Rx from "rx";
import { div, strong } from "cycle-snabbdom"
import { calendarTime, formatEfforts } from './helpers'
import { DOM_SINK } from "../../../../../../utils/helpers/src/index"

const $ = Rx.Observable;

// TODO : check the classes
const renderTaskInfo = (info, title) => info ?
  div('.task-infos__info', { style: info ? 'none' : 'initial' },
    title ? [strong(`${title}: `), info] : info
  )
  : undefined
;

export function TaskInfo(sources, settings) {
  const { filteredTask: { done, title, created, efforts, position, nr, type, milestone }, listIndex } = settings;

  return {
    [DOM_SINK]: $.of(
      div('.task-infos', [
        renderTaskInfo(`#${nr}`),
        renderTaskInfo(`${calendarTime(created)}`, 'Created'),
        renderTaskInfo(milestone, 'Milestone'),
        renderTaskInfo(formatEfforts(efforts), 'Efforts'),
//        <ngc-plugin-slot name="task-info"></ngc-plugin-slot> // TODO : have a look at the feature
      ])
    )
  }
}
