import * as Rx from "rx";
import { InSlot } from "../../../../../../src/components/InSlot"
import { vLift } from "../../../../../../src/utils"
import { div } from "cycle-snabbdom"
import { m } from "../../../../../../src/components/m/m"
import { ToggleButton } from './ToggleButton'
import { EnterTask } from './EnterTask'
import { TaskList } from './TaskList'

const $ = Rx.Observable;

const ProjectTaskListContainer = vLift(
  div('.task-list.task-list__l-container', { slot: 'tab' }, [
    div('.task-list__l-box-a', { slot: 'toggle' }, []),
    div('.task-list__l-box-b', { slot: 'enter-task' }, []),
    div('.task-list__l-box-c', [
      div('.task-list__tasks', { slot: 'tasks' }, [])
    ])
  ]));

export const ProjectTaskList =
  m({}, {}, [ProjectTaskListContainer, [
    InSlot('toggle', [ToggleButton]),
    InSlot('enter-task', [EnterTask]),
    InSlot('tasks', [TaskList])
  ]]);
