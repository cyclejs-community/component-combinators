import { m } from "../m/m"
import { mapObjIndexed } from 'ramda'

export function InjectSources(sourcesHash, childrenComponents) {
  return m({
    makeLocalSources: function makeInjectedLocalSources(sources, settings) {
      return mapObjIndexed(sourceFactory => {
        return sourceFactory(sources, settings)
      }, sourcesHash)
    }
  }, {}, childrenComponents)
}
