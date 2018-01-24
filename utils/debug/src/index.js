import { keys, mapObjIndexed, pipe, tap } from "ramda"
import toHTML from "snabbdom-to-html"
// import { StandardError } from "standard-error"
import formatObj from "fmt-obj"

// Type checking typings
/**
 * @typedef {String} ErrorMessage
 */
/**
 * @typedef {Boolean|Array<ErrorMessage>} SignatureCheck
 * Note : The booleam can only be true
 */

// Component typings
/**
 * @typedef {String} SourceName
 */
/**
 * @typedef {String} SinkName
 */
/**
 * @typedef {Rx.Observable} Source
 */
/**
 * @typedef {Rx.Observable|Null} Sink
 */
/**
 * @typedef {Object.<string, Source>} Sources
 */
/**
 * @typedef {Object.<string, Sink>} Sinks
 */
/**
 * @typedef {?Object.<string, ?Object>} Settings
 */
/**
 * @typedef {function(Sink, Array<Sink>, Settings):Sink} mergeSink
 */
/**
 * @typedef {Object} DetailedComponentDef
 * @property {?function(Sources, Settings)} makeLocalSources
 * @property {?function(Settings)} makeLocalSettings
 * @property {?function(Sources, Settings):Sinks} makeOwnSinks
 * @property {Object.<SinkName, mergeSink> | function} mergeSinks
 * @property {function(Sinks):Boolean} sinksContract
 * @property {function(Sources):Boolean} sourcesContract
 */
/**
 * @typedef {Object} ShortComponentDef
 * @property {?function(Sources, Settings)} makeLocalSources
 * @property {?function(Settings)} makeLocalSettings
 * @property {?function(Sources, Settings):Sinks} makeOwnSinks
 * @property {function(Component, Array<Component>, Sources, Settings)}
 * computeSinks
 * @property {function(Sinks):Boolean} sinksContract
 * @property {function(Sources):Boolean} sourcesContract
 */

/**
 * @typedef {function(Sources, Settings):Sinks} Component
 */

/**
 * Adds `tap` logging/tracing information to all sinks
 * @param {String} traceInfo
 * @param {Sinks} sinks
 * @returns {*}
 */
function traceSinks(traceInfo, sinks) {
  return mapObjIndexed((sink$, sinkName) => {
    return sink$
      ? sink$.tap(function log(x) {
        console.debug(`traceSinks > ${traceInfo} > sink ${sinkName} emits :`, x)
      })
      // Pass on null and undefined values as they are, they will be filtered out downstream
      : sink$
  }, sinks)
}

//IE workaround for lack of function name property on Functions
//getFunctionName :: (* -> *) -> String
const getFunctionName = (r => fn => {
  return fn.name || ((('' + fn).match(r) || [])[1] || 'Anonymous');
})(/^\s*function\s*([^\(]*)/i);

const logFnTrace = (title, paramSpecs) => ({
  before: (args, fnToDecorateName) =>
    console.info(`==> ${title.toUpperCase()} | ${fnToDecorateName}(${paramSpecs.join(', ')}): `, args),
  after: (result, fnToDecorateName) => {
    console.info(`<== ${title.toUpperCase()} | ${fnToDecorateName} <- `, result);
    return result
  },
});

function toHTMLorNull(x) {
  return x ? toHTML(x) : null
}

function convertVNodesToHTML(vNodeOrVnodes) {
  if (isArray(vNodeOrVnodes)) {
    console.debug(`toHTML: ${vNodeOrVnodes.map(x => x ? toHTML(x) : null)}`)
    return vNodeOrVnodes.map(toHTMLorNull)
  }
  else {
    console.debug(`toHTML: ${toHTMLorNull(vNodeOrVnodes)}`)
    return toHTMLorNull(vNodeOrVnodes)
  }
}

function formatArrayObj(arr, separator) {
  return arr.map(format).join(separator)
}

function format(obj) {
  // basically if obj is an object, use formatObj, else use toString
  if (obj === 'null') {
    return '<null>'
  }
  else if (obj === 'undefined') {
    return '<undefined>'
  }
  else if (isString(obj) && obj.length === 0) {
    return '<empty string>'
  }
  else if (isArray(obj)) {
    return formatArrayObj(obj, ' ; ')
  }
  else if (isObject(obj)) {
    if (keys(obj).length === 0) {
      // i.e. object is {}
      return '<empty object>'
    }
    else return formatObj(obj)
  }
  else {
    return "" + obj
  }
}

function traceFn(fn, text) {
  return pipe(fn, tap(console.warn.bind(console, text ? text + ":" : "")))
}

export {
  traceSinks,
  getFunctionName,
  logFnTrace,
  convertVNodesToHTML,
  formatArrayObj,
  format,
  traceFn,
}
