import {path} from 'ramda'

export function getStateInStore(context, sources, settings) {
  const {storeAccess, storeUpdate$} = sources;

  return  storeAccess.getCurrent(context)
    .concat(storeUpdate$.getResponse(context).map(path(['response'])))
    // NOTE : this is a behaviour
    .shareReplay(1)
}
