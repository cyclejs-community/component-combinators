import * as Rx from "rx";
import { keys, values } from 'ramda'
import { ROUTE_PARAMS } from "@rxcc/components"

const $ = Rx.Observable;

export function projectsStateFactory(sources, settings) {
  const { [ROUTE_PARAMS]: { projectId } } = settings;

  const projectFb$ = sources.projectsFb$
    .map(projectsFb => {
      const fbKeys = keys(projectsFb);
      const _values = values(projectsFb);
      const index = _values.findIndex(project => project._id === projectId);
      const fbIndex = fbKeys[index];
      const project = _values[index];

      return {
        fbIndex,
        project
      }
    })
    //    .distinctUntilChanged(prop('fbIndex'))
    .shareReplay(1);

  return {
    projectFb$
  }
}
