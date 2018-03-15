import { append, assocPath, isNil, lens, mapObjIndexed, set } from 'ramda'
import { BEHAVIOUR_TYPE, EVENT_TYPE, SINK_EMISSION, SOURCE_EMISSION } from './properties'
import {
  CHILDREN_ONLY, componentTreePatternMatchingPredicates, CONTAINER_AND_CHILDREN, makePatternMatcher, ONE_COMPONENT_ONLY
} from '../../utils/src/index'
import { convertVNodesToHTML, isNextNotification } from "../../utils/src"

let counter = 0;

export function getId() {
  return counter++
}

export function getIsTraceEnabled(settings) {
  return !!settings._trace.isTraceEnabled
}

export function isLeafComponent(component) {
  // non-leaf components are :
  // - components returned by `m`, i.e.
  //   - named `mComponent`
  //   - named `??` if advised around ; same name ``mComponent` for now
  // TODO : check that works with InSlot because that combinator is not using `m`...

  return !(component.name === `mComponent` || component.name === `mComponent` || component.name === `InSlot`)
}

export function getLeafComponentName(component) {
  return component.name || `LeafComponent`
}

/**
 *
 * @param {*} settings Take the settings to deconstruct
 * @returns {{traceSpecs: TraceSpecs, combinatorName: String, componentName: String, sendMessage: Function, onMessage:
 *   Function, isTraceEnabled: Boolean, isContainerComponent: Boolean, isLeaf: Boolean, path: *}}
 */
export function deconstructTraceFromSettings(settings) {
  if (!('_trace' in settings)) throw `deconstructTraceFromSettings : settings do not have a _trace property!`
  else {
    const {
      _trace: {
        traceSpecs, defaultTraceSpecs, combinatorName, componentName, sendMessage, onMessage, isTraceEnabled, isContainerComponent, isLeaf, path
      }
    } = settings;

    return {
      traceSpecs,
      defaultTraceSpecs,
      combinatorName,
      componentName,
      sendMessage,
      onMessage,
      isTraceEnabled,
      isContainerComponent,
      isLeaf,
      path
    }
  }
}

export function deconstructHelpersFromSettings(settings) {
  return { getId: settings._helpers.getId }
}

/**
 * Computes the path in the tree for the child at index `index`, whose parent is at location `path`
 * @param {Number} index
 * @param {Array<Number>} path
 * @returns {string}
 */
export function getPathForNthChild(index, path) {
  return append(index, path)
}

export const pathSettingsLens = lens(
  settings => settings._trace.path,
  (path, settings) => assocPath(['_trace', 'path'], path, settings)
);
export const setPathInSettings = set(pathSettingsLens);

export  const containerFlagSettingsLens = lens(
  settings => settings._trace.isContainerComponent,
  (flag, settings) => assocPath(['_trace', 'isContainerComponent'], flag, settings)
);
export const setContainerFlagInSettings = set(containerFlagSettingsLens);

export const leafFlagSettingsLens = lens(
  settings => settings._trace.isLeaf,
  (flag, settings) => assocPath(['_trace', 'isLeaf'], flag, settings)
);
export const setLeafFlagInSettings = set(leafFlagSettingsLens);

export const componentNameInSettings = lens(
  settings => settings._trace.componentName,
  (flag, settings) => assocPath(['_trace', 'componentName'], flag, settings)
);
export const setComponentNameInSettings = set(componentNameInSettings);

/**
 * Applies a `fmap` function to the component tree, keeping the component tree data structure
 * @param {function(component:Component, isContainerComponent:Boolean, index:Number):Component} fmap
 * @param {ComponentTree} componentTree
 * @return componentTree
 */
export function mapOverComponentTree(fmap, componentTree) {
  function fmapChildren(component, index) {
    return fmap(component, false, index)
  }

  const componentTreePatternMatchingMapOverExpressions = {
    [ONE_COMPONENT_ONLY]: componentTree => componentTree.map(fmapChildren),
    // In the following case, the first component (index 0) is the container component
    [CONTAINER_AND_CHILDREN]: componentTree => {
      const containerComponent = componentTree[0];
      const childrenComponents = componentTree[1];
      return [
        fmap(containerComponent, true, 0),
        childrenComponents.map(fmapChildren)
      ]
    },
    [CHILDREN_ONLY]: componentTree => componentTree.map(fmapChildren)
  };
  const componentTreeMapper =
    makePatternMatcher(componentTreePatternMatchingPredicates, componentTreePatternMatchingMapOverExpressions);

  return componentTreeMapper(componentTree);
}

export function forEachInComponentTree(fDo, componentTree) {
  function fDoChildren(component, index) {
    return fDo(component, false, index)
  }

  const componentTreePatternMatchingMapOverExpressions = {
    [ONE_COMPONENT_ONLY]: componentTree => componentTree.forEach(fDoChildren),
    // In the following case, the first component (index 0) is the container component
    [CONTAINER_AND_CHILDREN]: componentTree => {
      const containerComponent = componentTree[0];
      const childrenComponents = componentTree[1];

      fDo(containerComponent, true, 0);
      childrenComponents.forEach(fDoChildren);
    },
    [CHILDREN_ONLY]: componentTree => componentTree.forEach(fDoChildren)
  };
  const componentTreeMapper =
    makePatternMatcher(componentTreePatternMatchingPredicates, componentTreePatternMatchingMapOverExpressions);

  return componentTreeMapper(componentTree);
}

export function traceSources(sources, settings) {
  const { traceSpecs, defaultTraceSpecs, combinatorName, componentName, sendMessage } = deconstructTraceFromSettings(settings);
  const defaultTraceSourceFn = defaultTraceSpecs && defaultTraceSpecs[0];

  return mapObjIndexed((source, sourceName) => {
    const traceFn = traceSpecs[sourceName];
    const traceSourceFn = traceFn[0];

    if (traceFn) {
      // Case : There is a configured trace function for that source
      return traceSourceFn(source, sourceName, settings)
    }
    else {
      // Case : There is no configured trace function for that source
      // This can be the case for sources being added at run-time, and which do not correspond to drivers
      // They can :
      // - either be configured at compile-time (sub-optimal and less maintainable solution)
      // - be handled in a syntactic way : sources grouped in syntactic group to which a trace function is assigned
      //   - sources which are observables handled in a given way
      //   - sources whose sourceName is in a given way handled in the corresponding way
      // having a default way is difficult because some sources should be tapped with share, other with shareReplay
      // If we had an id, we could detect duplication...
      return defaultTraceSourceFn(source, sourceName, settings)
    }
  }, sources)
}

export function traceSinks(sinks, settings) {
  const { traceSpecs, defaultTraceSpecs, combinatorName, componentName, sendMessage, path } = deconstructTraceFromSettings(settings);
  const defaultTraceSinkFn = defaultTraceSpecs && defaultTraceSpecs[1];

  if (isNil(sinks)) {
    sendMessage({
      componentName, combinatorName, when: +Date.now(), path, id: getId(),
      warning: 'encountered component which returns null as sinks!!'
    });
    return null
  }
  else {
    return mapObjIndexed((sink, sinkName) => {
      const traceFn = traceSpecs[sinkName];
      const traceSinkFn = traceFn[1];

      if (traceFn) {
        // Case : There is a configured trace function for that sink
        return traceSinkFn(sink, sinkName, settings)
      }
      else {
        // Case : There is no configured trace function for that sink
        return defaultTraceSinkFn(sink, sinkName, settings)
      }
    }, sinks)
  }
}

export function makeDOMSourceNotificationMessage({ sourceName, settings, notification }) {
  const { traceSpecs, defaultTraceSpecs, combinatorName, componentName, sendMessage, path } = deconstructTraceFromSettings(settings);
  const { getId } = deconstructHelpersFromSettings(settings);
  const { kind, value, error } = notification;

  return {
    emits: {
      type: SOURCE_EMISSION,
      identifier: sourceName,
      notification: isNextNotification(notification)
        ? { value: convertVNodesToHTML(notification.value), kind }
        : { kind, error }
    },
    componentName, combinatorName, when: +Date.now(), path, id: getId()
  }
}

export function makeSourceNotificationMessage({ sourceName, settings, notification }) {
  const { traceSpecs, defaultTraceSpecs, combinatorName, componentName, sendMessage, path } = deconstructTraceFromSettings(settings);
  const { getId } = deconstructHelpersFromSettings(settings);
  const { kind, value, error } = notification;

  return {
    emits: {
      type: SOURCE_EMISSION,
      identifier: sourceName,
      notification: isNextNotification(notification)
        ? { value, kind }
        : { kind, error }
    },
    componentName, combinatorName, when: +Date.now(), path, id: getId()
  }
}


export function makeDOMSinkNotificationMessage({ sinkName, settings, notification }) {
  const { traceSpecs, defaultTraceSpecs, combinatorName, componentName, sendMessage, path } = deconstructTraceFromSettings(settings);
  const { getId } = deconstructHelpersFromSettings(settings);
  const { kind, value, error } = notification;

  return {
    emits: {
      type: SINK_EMISSION,
      identifier: sinkName,
      notification: isNextNotification(notification)
        ? { value: convertVNodesToHTML(notification.value), kind }
        : { kind, error }
    },
    componentName, combinatorName, when: +Date.now(), path, id: getId()
  }
}


export function makeSinkNotificationMessage({ sinkName, settings, notification }) {
  const { traceSpecs, defaultTraceSpecs, combinatorName, componentName, sendMessage, path } = deconstructTraceFromSettings(settings);
  const { getId } = deconstructHelpersFromSettings(settings);
  const { kind, value, error } = notification;

  return {
    emits: {
      type: SINK_EMISSION,
      identifier: sinkName,
      notification: isNextNotification(notification)
        ? { value, kind }
        : { kind, error }
    },
    componentName, combinatorName, when: +Date.now(), path, id: getId()
  }
}

export function traceDOMsinkFn(sink, sinkName, settings) {
  const { traceSpecs, defaultTraceSpecs, combinatorName, componentName, sendMessage, path } = deconstructTraceFromSettings(settings);

  return sink
    .materialize()
    // For DOM sink, we rather pass the mirrorring html (though we loose information doing so...)
    .tap(notification => sendMessage(makeDOMSinkNotificationMessage({ sinkName, settings, notification })))
    .dematerialize()
    .shareReplay(1)
}

export function traceBehaviourSourceFn(source, sourceName, settings) {
  const { traceSpecs, defaultTraceSpecs, combinatorName, componentName, sendMessage, path } = deconstructTraceFromSettings(settings);

  return source
    .materialize()
    .tap(notification => sendMessage(makeSourceNotificationMessage({ sourceName, settings, notification })))
    .dematerialize()
    .shareReplay(1)
}

export function traceEventSourceFn(source, sourceName, settings) {
  const { traceSpecs, defaultTraceSpecs, combinatorName, componentName, sendMessage, path } = deconstructTraceFromSettings(settings);

  return source
    .materialize()
    .tap(notification => sendMessage(makeSourceNotificationMessage({ sourceName, settings, notification })))
    .dematerialize()
    .share()
}

export function traceBehaviourSinkFn(sink, sinkName, settings) {
  const { traceSpecs, defaultTraceSpecs, combinatorName, componentName, sendMessage, path } = deconstructTraceFromSettings(settings);

  return sink
    .materialize()
    .tap(notification => sendMessage(makeSinkNotificationMessage({ sinkName, settings, notification })))
    .dematerialize()
    .shareReplay(1)
}

export function traceEventSinkFn(sink, sinkName, settings) {
  const { traceSpecs, defaultTraceSpecs, combinatorName, componentName, sendMessage, path } = deconstructTraceFromSettings(settings);

  return sink
    .materialize()
    .tap(notification => sendMessage(makeSinkNotificationMessage({ sinkName, settings, notification })))
    .dematerialize()
    .share()
}

// TODO : refactor with ramda cond
export function defaultTraceSourceFn(source, sourceName, settings) {
  if (isBehaviourSource(source)) {
    return traceBehaviourSourceFn(source, sourceName, settings)
  }
  else if (isEventSource(source)) {
    return traceEventSourceFn(source, sourceName, settings)
  }
  else {
    // TODO!! what do I do when no defaults?? should I pass `isBehaviourSource` in settings?? think!
    throw `defaultTraceSourceFn : Found source (${sourceName}) for which no default trace function is available!`
  }
}

// TODO : refactor with ramda COND
export function defaultTraceSinkFn(sink, sinkName, settings) {
  const { traceSpecs, defaultTraceSpecs, combinatorName, componentName, sendMessage, path } = deconstructTraceFromSettings(settings);
  const { getId } = deconstructHelpersFromSettings(settings);

  if (isNil(sink)) {
    sendMessage({
      componentName,
      combinatorName,
      when: +Date.now(),
      path,
      id: getId(),
      warning: 'encountered sink which is not an observable but null'
    });
    return null
  }
  else if (isBehaviourSink(sink)) {
    return traceBehaviourSinkFn(sink, sinkName, settings)
  }
  else if (isEventSink(sink)) {
    return traceEventSinkFn(sink, sinkName, settings)
  }
  else {
    throw `defaultTraceSinkFn : Found sink (${sinkName}) for which no trace function is available! `
  }
}

function getTypeOf(obj) {
  return obj && obj.type
}

function isBehaviourSource(source) {
  return getTypeOf(source) === BEHAVIOUR_TYPE
}

function isBehaviourSink(sink) {
  return Boolean(sink && isBehaviourSource(sink))
}

function isEventSource(source) {
  return getTypeOf(source) === EVENT_TYPE
}

function isEventSink(sink) {
  return Boolean(sink && isEventSource(sink))
}

