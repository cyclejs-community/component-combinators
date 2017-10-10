import * as Rx from "rx";
import { ForEach } from "../../../../../../src/components/ForEach/ForEach"
import { ListOf } from "../../../../../../src/components/ListOf/ListOf"
import { InSlot} from "../../../../../../src/components/InSlot"
import { InjectSources } from "../../../../../../src/components/Inject/InjectSources"
import { InjectSourcesAndSettings } from "../../../../../../src/components/Inject/InjectSourcesAndSettings"
import { DOM_SINK, EmptyComponent, DummyComponent, format, Div, Nav, vLift, preventDefault } from "../../../../../../src/utils"
import { pipe, values, keys, always, filter, path, map } from 'ramda'
import { a, p, div, img, nav, strong, h2, ul, li, button, input } from "cycle-snabbdom"
import { UPDATE_TASK_COMPLETION_STATUS, TASKS, taskFactory } from "../../../../src/domain"
import {computeTaskCheckedActions, computeSaveUpdatedTaskActions, calendarTime, formatEfforts} from './helpers'
import {taskEnterButtonSelector, taskEnterInputSelector} from './properties'
import {taskListStateFactory} from './state'
import {CheckBox} from '../../../UI/CheckBox'
import {Editor} from '../../../UI/Editor'
import { InjectStateInSinks } from "../../../../../../src/components/Inject/InjectStateInSinks"

const $ = Rx.Observable;

const renderTaskInfo = (info , title) => info ?
  div('.task-infos__info', { style : info ? 'none' : 'initial' },
    title ? [  strong(`${title}: `), info] : info
  )
  : undefined
;

export  function TaskInfo(sources, settings){
  const {filteredTask : {done, title, created, efforts, position, nr, type, milestone}, listIndex} = settings;

  debugger
  return {
    [DOM_SINK] : $.of(
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
