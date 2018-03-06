import { always, append, assocPath, defaultTo, isNil, lens, mapObjIndexed, set, F, T, cond, tail, head, flatten  } from 'ramda'
import { BEHAVIOUR_TYPE, EVENT_TYPE, SINK_EMISSION, SOURCE_EMISSION} from './properties'
import { CHILDREN_ONLY, CONTAINER_AND_CHILDREN, ONE_COMPONENT_ONLY, componentTreePatternMatchingPredicates, makePatternMatcher } from '../utils/src/index'

let counter = 0;

export function getId() {
  return counter++
}

export function isEnabledTracing(settings) {
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
 * @typedef {Object} TraceFns
 * @property {Function} 0 `TraceSourceFn` function taking a source and returning a traced source
 * @property {Function} 1 `TraceSinkFn` function taking a sink and returning a traced sink
 */

/**
 * @typedef {Object.<DriverName, TraceFns>} TraceSpecs
 */
/**
 *
 * @param {*} settings Take the settings to deconstruct
 * @returns {{traceSpecs: TraceSpecs, combinatorName: String, componentName: String, sendMessage: Function, onMessage:
 *   Function, isTraceEnabled: Boolean, isContainerComponent: Boolean, isLeaf: Boolean, path: *}}
 */
export function deconstructTraceFromSettings(settings) {
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

const pathSettingsLens = lens(
  settings => settings._trace.path,
  (path, settings) => assocPath(['_trace', 'path'], path, settings)
);
export const setPathInSettings = set(pathSettingsLens);

const containerFlagSettingsLens = lens(
  settings => settings._trace.isContainerComponent,
  (flag, settings) => assocPath(['_trace', 'isContainerComponent'], flag, settings)
);
export const setContainerFlagInSettings = set(containerFlagSettingsLens);

const leafFlagSettingsLens = lens(
  settings => settings._trace.isLeaf,
  (flag, settings) => assocPath(['_trace', 'isLeaf'], flag, settings)
);
export const setLeafFlagInSettings = set(leafFlagSettingsLens);

const componentNameInSettings = lens(
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
  function fmapChildren(component, index){
    return fmap(component, false, index)
  }

  const componentTreePatternMatchingMapOverExpressions = {
    [ONE_COMPONENT_ONLY] : componentTree => componentTree.map(fmapChildren),
    // In the following case, the first component (index 0) is the container component
    [CONTAINER_AND_CHILDREN] : componentTree => {
      const containerComponent = componentTree[0];
      const childrenComponents = componentTree[1];
      return [
        fmap(containerComponent, true, 0),
        childrenComponents.map(fmapChildren)
      ]
    },
    [CHILDREN_ONLY] : componentTree => componentTree.map(fmapChildren)
  };
  const componentTreeMapper =
    makePatternMatcher(componentTreePatternMatchingPredicates, componentTreePatternMatchingMapOverExpressions );

  return componentTreeMapper(componentTree);
}

// TODO : pattern matching helpers : test and put in utils!!!

export function traceSources(traceSpecs, sources, settings) {
  const { traceSpecs, defaultTraceSpecs, combinatorName, componentName, sendMessage } = deconstructTraceFromSettings(settings);
  const defaultTraceSourceFn = defaultTraceSpecs && defaultTraceSpecs[0];

  return mapObjIndexed((source, sourceName) => {
    const traceFn = traceSpecs[sourceName];

    if (traceFn) {
      // Case : There is a configured trace function for that source
      return traceFn(source, settings)
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
      return defaultTraceSourceFn(source, settings)
    }
  }, sources)
}

export function traceSinks(traceSpecs, sinks, settings) {
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

      if (traceFn) {
        // Case : There is a configured trace function for that sink
        return traceFn(sink, settings)
      }
      else {
        // Case : There is no configured trace function for that sink
        return defaultTraceSinkFn(sink, settings)
      }
    }, sinks)
  }
}

function defaultTraceSourceFn(source, settings) {
  const { traceSpecs, defaultTraceSpecs, combinatorName, componentName, sendMessage, path } = deconstructTraceFromSettings(settings);
  const { getId } = deconstructHelpersFromSettings(settings);

  if (isBehaviourSource(source)) {
    return source
      .materialize()
      .tap(notification => {
        const message = {
          emits: { type: SOURCE_EMISSION, value: notification },
          componentName, combinatorName, when: +Date.now(), path, id: getId()
        };

        sendMessage(message);
      })
      .dematerialize()
      .shareReplay(1)
  }
  else if (isEventSource(source)) {
    return source
      .materialize()
      .tap(notification => {
        const message = {
          emits: { type: SOURCE_EMISSION, value: notification },
          componentName, combinatorName, when: +Date.now(), path, id: getId()
        };

        sendMessage(message);
      })
      .dematerialize()
      .share()
  }
  else {
    throw `defaultTraceSourceFn : Found source for which no trace function is available! `
  }
}

function defaultTraceSinkFn(sink, settings) {
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
    return sink
      .materialize()
      .tap(notification => {
        const message = {
          emits: { type: SINK_EMISSION, value: notification },
          componentName, combinatorName, when: +Date.now(), path, id: getId()
        };

        sendMessage(message);
      })
      .dematerialize()
      .shareReplay(1)
  }
  else if (isEventSink(sink)) {
    return sink
      .materialize()
      .tap(notification => {
        const message = {
          emits: { type: SINK_EMISSION, value: notification },
          componentName, combinatorName, when: +Date.now(), path, id: getId()
        };

        sendMessage(message);
      })
      .dematerialize()
      .share()
  }
  else {
    throw `defaultTraceSinkFn : Found sink for which no trace function is available! `
  }
}

function getTypeOf(obj) {
  return obj && obj.type
}

function isBehaviourSource(source) {
  return getTypeOf(source) === BEHAVIOUR_TYPE
}

function isBehaviourSink (sink){
  return Boolean(sink && isBehaviourSource(sink))
}

function isEventSource(source) {
  return getTypeOf(source) === EVENT_TYPE
}

function isEventSink (sink){
  return Boolean(sink && isEventSource(sink))
}

// TODO : write the advice on run function - with the trace, default and non-default (tests to write?? YES, with
// stubbed sendMessage it is easy)
// TODO : test the window messaging and iframe add
// TODO : write the iframe message reception
// TODO : rerun m tests to check old behaviour is conserved (no trace)
// TODO : THEN refactor m in several smaller functions (three strategies cf. TODOs in coherence with doc)
