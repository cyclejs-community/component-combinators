import { m } from "../m"

export function InjectSourcesAndSettings({ sourceFactory, settings }, childrenComponents) {
  // NOTE : not using makeLocalSettings which is the lowest priority of all settings
  return m({ makeLocalSources: sourceFactory }, settings, childrenComponents)
}
