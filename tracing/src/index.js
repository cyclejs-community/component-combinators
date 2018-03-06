import { decorateWithAdvice } from "../utils/src/index"
import { defaultTo } from 'ramda'
import {
  deconstructHelpersFromSettings, deconstructTraceFromSettings, getLeafComponentName, getPathForNthChild,
  isEnabledTracing, isLeafComponent, setComponentNameInSettings, setContainerFlagInSettings, setLeafFlagInSettings,
  setPathInSettings, mapOverComponentTree, traceSinks, traceSources, getId
} from './helpers'
import { iframeId, iframeSource, PATH_ROOT, SOURCE_EMISSION } from './properties'

// - pass in settings
// - _trace : {traceSpecs : { driverName : [traceSourceFn, traceSinkFn]}, defaultTraceSpecs : [traceSourceFn,
// traceSinkFn], combinatorName, componentName, sendMessage, onMessage, isTraceEnabled:Y/N, isContainerComponent,
// isLeaf, path} - first componentName is 'App' when decorating run - _helpers : {getID, } (merge fusion, no destroy) -
// _hooks : {preprocessInput, postprocessOutput} - preprocessInput : componentDef, _settings, componentTree -
// postprocessOutput : function mComponent(sources, innerSettings) - that will be written as an advice on mComponent
// i.e. - = decorateWithAdvice(aroundAdvice, mComponent)

// iFrame
// Create the iframe
let iframe = document.createElement('iframe');
iframe.setAttribute('src', iframeSource);
iframe.setAttribute('id', iframeId);
iframe.style.width = 450 + 'px';
iframe.style.height = 200 + 'px';
// TODO : that kind of requires body to be already there... Some guard to put here
// NOTE : could also pass it as a vNode through DOM driver... make it simple for now
document.body.appendChild(iframe);

// Send a message to the child iframe
const iframeEl = document.getElementById(iframeId);

/**
 * Sends a message to the devtool iframe
 * @param {*} msg Anything which can be JSON.stringified
 */
function sendMessage(msg) {
  // Make sure you are sending a string, and to stringify JSON
  // NOTE : also possible to pass a sequence of Transferable objects with the message
  iframeEl.contentWindow.postMessage(JSON.stringify(msg), '*');
}

// onMessage
function onMessage(msg) {
  console && console.warn(`received message : %s`, JSON.stringify(msg))
}

/**
 * @typedef {Component} ContainerComponent
 */

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
// TODO
//`  - get new settings
//`  - path should already be there. If not initialize with default
//`  - LOG : path and combinatorName and componentName which I have at config time
//`  - activated with settings._config.trace = true
//`    - apply around advice to componentTree
//`  - for each component in componentTree
//`  - apply around advice
//`  - add path in its settings
//`  - if isLeaf(component)
//`  - apply around advice to component
//`  - transform sources
//`  - add componentName in its settings
//`  - add componentName in tap to sources
//`  - transform sinks
//`  - add componentName in tap to sinks
//`

  if (!isEnabledTracing(mSettings)) {
    return { componentDef, mSettings, componentTree }
  }
  else {
    const { path, combinatorName, componentName, sendMessage } = deconstructTraceFromSettings(mSettings);
    const { getId } = deconstructHelpersFromSettings(mSettings);

    // set root path if no path is set
    let updatedSettings = setPathInSettings(defaultTo(PATH_ROOT, path), mSettings);

    // Inject path in every child component, misc. info and special trace treatment for leaf components
    // TODO : extract in another function
    const advisedComponentTree = mapOverComponentTree((component, isContainerComponent, index) => {
      const advisedComponent = decorateWithAdvice({
        around: function decorateComponentWithTraceInfo(joinpoint, component) {
          const { args, fnToDecorateName } = joinpoint;
          const [sources, childComponentSettings] = args;
          let updatedChildComponentSettings = setPathInSettings(getPathForNthChild(index, path), childComponentSettings);
          updatedChildComponentSettings = setContainerFlagInSettings(isContainerComponent, updatedChildComponentSettings);
          const isLeaf = isLeafComponent(component);

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
    }, componentTree);

    //`  - LOG : path and combinatorName and componentName which I have at config time
    const treeDescriptionMessage = { componentName, combinatorName, when: +Date.now(), path, id: getId() };
    sendMessage(treeDescriptionMessage);

    return { componentDef, updatedSettings, advisedComponentTree }
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

      if (!isEnabledTracing(childComponentSettings)) {
        return mComponent(sources, childComponentSettings)
      }
      else {
        const tracedSources = traceSources(sources, childComponentSettings);
        const sinks = mComponent(tracedSources, childComponentSettings);
        const tracedSinks = traceSinks(sinks, childComponentSettings);

        return tracedSinks
      }
    }
  })
}

/**
 * DOC : TODO at the end, document _trace shape
 */
