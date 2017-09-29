import { m } from "../m/m"
import { assertContract, isFunction } from "../../utils"

function isSourcesAndSettings(obj){
  return 'sourceFactory' in obj && isFunction(obj['sourceFactory'])
}

export function InjectSourcesAndSettings({ sourceFactory: sourcesFactory, settings }, componentTree) {
  // NOTE : not using makeLocalSettings which is the lowest priority of all settings
  assertContract(isSourcesAndSettings, [{ sourceFactory: sourcesFactory, settings }], `First parameter must have a sourceFactory property to compute the new sources, and may have a settings property for the extra settings!`);

  return m({ makeLocalSources: sourcesFactory }, settings, componentTree)
}

