import { m } from "../m"
import { mapObjIndexed } from 'ramda'

export function InjectSourcesAndSettings({ sourceFactory, settings }, childrenComponents) {
  // NOTE : not using makeLocalSettings which is the lowest priority of all settings
  return m({ makeLocalSources: sourceFactory }, settings, childrenComponents)
}

export function InjectSources(sourcesHash, childrenComponents) {
  return m({
    makeLocalSources: function makeInjectedLocalSources(sources, settings) {
      return mapObjIndexed(sourceFactory => {
        return sourceFactory(sources, settings)
      }, sourcesHash)
    }
  }, {}, childrenComponents)
}
