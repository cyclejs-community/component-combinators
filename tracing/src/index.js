import {
  containerFlagSettingsLens,
  deconstructHelpersFromSettings, deconstructTraceFromSettings, defaultTraceSinkFn, defaultTraceSourceFn,
  forEachInComponentTree, getId,
  getIsTraceEnabled, getLeafComponentName, getPathForNthChild, isLeafComponent, mapOverComponentTree,
  setComponentNameInSettings, setContainerFlagInSettings, setLeafFlagInSettings, setPathInSettings, traceSinks,
  traceSources
} from './helpers'
import {
  GRAPH_STRUCTURE, iframeId, iframeSource, IS_TRACE_ENABLED_DEFAULT, PATH_ROOT, TRACE_BOOTSTRAP_NAME
} from './properties'
import { Combine } from "../../src/components/Combine"
import { decorateWithAdvice, getFunctionName, vLift } from "../../utils/src"
import { iframe, div, p, a, i } from "cycle-snabbdom"
import { merge, pathOr, view } from 'ramda'

let graphCounter = 0;
function getGraphCounter(){ return graphCounter++}

/**
 * Sends a message to the devtool iframe
 * @param {*} msg Anything which can be JSON.stringified
 */
function sendMessage(msg) {
  // Make sure you are sending a string, and to stringify JSON
  // NOTE : also possible to pass a sequence of Transferable objects with the message
  const iframeEl = document.getElementById(iframeId);
  iframeEl.contentWindow.postMessage(JSON.stringify(msg), '*');
}

// onMessage
function onMessage(msg) {
  console && console.warn(`received message : %s`, JSON.stringify(msg))
}

/**
 * Curried function which adds trace info (path, flags...) in the settings for a component. If the processed
 * component is a leaf component, its input and output must be directly traced. If not, they will be traced in the
 * invocation of the next combinator layer.
 * @param {Array<Number>} path
 * @returns {function(Component, Boolean, Number):Component} advised component
 */
function addTraceInfoToComponent(path) {
  return function addTraceInfoToComponent(component, isContainerComponent, index) {
    const advisedComponent = decorateWithAdvice({
      around: function decorateComponentWithTraceInfo(joinpoint, component) {
        const { args, fnToDecorateName } = joinpoint;
        const [sources, childComponentSettings] = args;
        let updatedChildComponentSettings = setPathInSettings(getPathForNthChild(index, path), childComponentSettings);
        updatedChildComponentSettings = setContainerFlagInSettings(isContainerComponent, updatedChildComponentSettings);
        const isLeaf = isLeafComponent(component);
        debugger

        if (isLeaf) {
          // If the component is a leaf component:
          // - add its name to settings for tracing purposes
          // - tap its sources and sinks here and now
          updatedChildComponentSettings = setComponentNameInSettings(getLeafComponentName(component), updatedChildComponentSettings);
          updatedChildComponentSettings = setLeafFlagInSettings(isLeaf, updatedChildComponentSettings);
          const tracedSources = traceSources(sources, updatedChildComponentSettings);
          const sinks = component(tracedSources, updatedChildComponentSettings);
          const tracedSinks = traceSinks(sinks, updatedChildComponentSettings);

          return tracedSinks
        }
        else {
          // If the component is a `m` component, i.e. obtained from m(...), let it be
          // It will be traced at the `m` level
          return component(sources, childComponentSettings);
        }
      }
    }, component);

    return advisedComponent
  }

}

/**
 * @typedef [Array<Component> | [Component, Array<Component>]] ComponentTree
 */
/**
 * - Receives the same inputs as `m` and adapt those inputs to include the trace aspect to the `m` FACTORY
 *   - Adds `path` to settings, so that it corresponds to the location of the component in the component tree
 *   - Logs out the corresponding information
 * - Adds path also to CHILDREN components settings, together with miscellaneous info (isLeaf, etc.)
 * - Adds the trace aspect to leaf COMPONENTS if any
 * @param componentDef
 * @param {Settings} mSettings
 * @param {ComponentTree} componentTree
 * @returns {Settings}
 */
function preprocessInput(componentDef, mSettings, componentTree) {
  if (!getIsTraceEnabled(mSettings)) {
    return { componentDef, mSettings, componentTree }
  }
  else {
    const { path, combinatorName, componentName, sendMessage } = deconstructTraceFromSettings(mSettings);

    // set root path if no path is set
    let updatedSettings = setPathInSettings(path || PATH_ROOT, mSettings);

    // Inject path in every child component, misc. info and special trace treatment for leaf components
    const advisedComponentTree = mapOverComponentTree(addTraceInfoToComponent(path), componentTree);

    //`  - LOG : path and combinatorName and componentName which I have at config time
    // TODO : I need also to pass isContainreComponent optimally, will it be in mSettings? maybe, if not leaf
    // case leaf is treated below
    sendMessage({
      logType : GRAPH_STRUCTURE,
      componentName,
      combinatorName,
      isContainerComponent : view(containerFlagSettingsLens, mSettings),
      when: +Date.now(),
      path,
      id: getGraphCounter()
    });
    // Edge case : I have to also log those component from the component tree which are leaf components as they won't
    // log themselves
    forEachInComponentTree((component, isContainerComponent, index) => {
      if (isLeafComponent(component)) {
        sendMessage({
          logType : GRAPH_STRUCTURE,
          componentName : getFunctionName(component),
          combinatorName: undefined,
          isContainerComponent : isContainerComponent,
          when : +Date.now(),
          path : path.concat([index]),
          id: getGraphCounter()
        })
      }
    }, componentTree);

    return { componentDef, settings: updatedSettings, componentTree: advisedComponentTree }
  }
}

/**
 * Traces sourcs and sinks of mComponent (around advice on returned mComponent)
 * NOTE : this really is only a m-generated component. Leaf component are traced in preprocessOutput
 * @param  {Component} mComponent
 * @returns {Component}
 */
function postprocessOutput(mComponent) {
  return decorateWithAdvice({
    around: function traceSourcesAndSinks(joinpoint, mComponent) {
      const { args, fnToDecorateName } = joinpoint;
      const [sources, childComponentSettings] = args;

      // NOTE : childComponentSettings is the `innerSettings` from `mComponent`
      // hence there is no way to have access to mSettings or localSettings in `componentDef`
      // as we do not have a closure here
      // NOTE : if we execute `postprocessOutput`, it MUST mean that we have the trace enabled
      // if (!getIsTraceEnabled(childComponentSettings)) {
      //   return mComponent(sources, childComponentSettings)
      // }
      const tracedSources = traceSources(sources, childComponentSettings);
      const sinks = mComponent(tracedSources, childComponentSettings);
      const tracedSinks = traceSinks(sinks, childComponentSettings);

      return tracedSinks
    }
  }, mComponent)
}

const TraceIframe = vLift(
  iframe(iframeId, {
    props: {
      src: iframeSource,
    },
    style: {
      width: '450px',
      height: '200px'
    }
  }, [])
);

const adviseApp = (traceDef, App) => decorateWithAdvice({
  around: function (joinpoint, App) {
    const { args } = joinpoint;
    const [sources, _settings] = args;
    const settings = merge(_settings, traceDef);

    // TODO : check which of two possibilities work (diff. is settings inheritance)
    // In one case, the App might redefine trace info (component name etc), in another case not so check which
    const tracedApp = Combine({}, [
      TraceIframe,
      Combine(traceDef, [App])
    ]);

    // That does not work, as App will receive `traceDef` settings through local settings, and we need with
    // mSettings
    // const tracedApp = Combine({}, [
    //   TraceIframe,
    //   InjectSourcesAndSettings({
    //     settings: () => traceDef
    //   }, [
    //     App
    //   ])
    // ]);

    return tracedApp(sources, settings)
  }
}, App);

/**
 * @param {TraceDef} traceDefSpecs
 * @param {Component} App
 * @return Component Component whose inputs and outputs (i.e. sources and sinks) are traced
 */
export function traceApp(traceDefSpecs, App) {
  // TODO : add contract for traceDefSpecs!! important for debugging
  // because I have default values, most of the values are optional except traceSpecs
  debugger
  const traceDef = {
    _hooks: pathOr({ preprocessInput, postprocessOutput }, ['_hooks'], traceDefSpecs),
    _helpers: pathOr({ getId }, ['_helpers'], traceDefSpecs),
    _trace: {
      componentName: TRACE_BOOTSTRAP_NAME,
      isTraceEnabled: pathOr(IS_TRACE_ENABLED_DEFAULT, ['_trace', 'isTraceEnabled'], traceDefSpecs),
      isContainerComponent: pathOr(false, ['_trace', 'isContainerComponent'], traceDefSpecs),
      isLeaf: pathOr(false, ['_trace', 'isLeaf'], traceDefSpecs),
      path: pathOr([0], ['_trace', 'path'], traceDefSpecs),
      sendMessage: pathOr(sendMessage, ['_trace', 'sendMessage'], traceDefSpecs),
      onMessage: null, // not used for now
      traceSpecs: traceDefSpecs._trace.traceSpecs,
      defaultTraceSpecs: pathOr([defaultTraceSourceFn, defaultTraceSinkFn], ['_trace', 'defaultTraceSpecs'], traceDefSpecs),
    }
  };

  return adviseApp(traceDef, App)
}

/**
 * @param {TraceSpecs} traceSpecs
 * @param {Component} App
 * @return Component Component whose inputs and outputs (i.e. sources and sinks) are traced
 */
export function traceAppBasic(traceSpecs, App) {
  // will inject _traceSpecs and _helpers (that should be merged without stomping) and _hooks (also merging as much
  // as possible). So for now we will do it so that traceDef actually include those helpers and so on.
  // We will think about hook overriding and composition when that problem happens
  /** @type TraceDef*/
  const traceDef = {
    _hooks: { preprocessInput, postprocessOutput },
    _helpers: { getId },
    _trace: {
      componentName: TRACE_BOOTSTRAP_NAME,
      isTraceEnabled: IS_TRACE_ENABLED_DEFAULT,
      isContainerComponent: false,
      isLeaf: false,
      path: [0],
      sendMessage: sendMessage,
      onMessage: null, // not used for now
      traceSpecs: traceSpecs,
      defaultTraceSpecs: [defaultTraceSourceFn, defaultTraceSinkFn]
    }
  };

  return adviseApp(traceDef, App)
}

// TODO : test the window messaging and iframe add
// TODO : write the iframe message reception

/**
 * @typedef {function(source:Source, sourceName:String, settings:Settings):Source} TraceSourceFn
 * function taking a source and returning a traced source
 */
/**
 * @typedef {function(sink:Sink, sinkName:String, settings:Settings):Sink} TraceSinkFn
 * function taking a sink and returning a traced sink
 */
/**
 * @typedef {[TraceSourceFn, TraceSinkFn]} TraceSpec
 */
/**
 * @typedef {HashMap<DriverName, TraceSpec>} TraceSpecs
 */
/**
 * @typedef {Object} TraceDef
 * @property {{traceSpecs:TraceSpecs, defaultTraceSpecs:[], combinatorName, componentName, sendMessage,
 *   onMessage, isTraceEnabled, isContainerComponent, isLeaf, path:Array<Number>}} _trace
 * @property {{getId : function()}} _helpers
 */

// TODO : how to trace the DOM source??, I have to intervene the dom OBJECT! same for document thing about it
