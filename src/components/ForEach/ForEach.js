import {
  assertContract, hasAtLeastOneChildComponent, isObservable, isString
} from "../../../contracts/src/index"
import { format } from "../../../utils/src/index"
import { m } from '../m/m'
import { map, mergeAll, set } from 'ramda'
import * as Rx from "rx";
import {
  combinatorNameInSettings, componentNameInSettings, reconstructComponentTree
} from "../../../tracing/src/helpers"

const $ = Rx.Observable;

function isForEachSettings(sources, settings) {
  return 'from' in settings && 'as' in settings
    && isString(settings.from) && isString(settings.as)
}

function isValidForEachSettings(sources, settings) {
  return sources && sources[settings.from] && isObservable(sources[settings.from])
    && 'sinkNames' in settings
}

function computeSinks(parentComponent, childrenComponents, sources, settings) {
  let { from, as, sinkNames } = settings;
  let cachedSinks = null;

  const switchSource = sources[from];
  // assertContract(isValidForEachSettings, [sources, settings], `ForEach > computeSinks >
  // isValidForEachSettings : source ${from} not found in sources!`);

  const shouldSwitch$ = switchSource
    .do(function (incomingValue) {
      console.info(`${settings.trace} > ForEach > New value from source ${from}`, format(incomingValue));
      console.info(`${settings.trace} > ForEach > Computing the associated sinks`);

      const switchedComponent = m(
        {},
        set(combinatorNameInSettings, 'ForEach|Inner', { [as]: incomingValue }),
        // Keep the shape of the component tree, this avoids edge case of container component == null which causes
        // exttra logs and wrong indices
        reconstructComponentTree(parentComponent, childrenComponents));

      // TODO : think about how to pass trace...
      cachedSinks = switchedComponent(sources, settings);
    })
    // NOTE: apparently necessary because every sink name wires at a different moment?? maybe
    // because the wire happens at switch time? and that is a different time every time??
    // Anyways it semms to work like this, so no more touching it
    .shareReplay(1)
  ;

  function makeSwitchedSink(sinkName) {
    return {
      [sinkName]: shouldSwitch$.map(function makeSwitchedSinkFromCache(incomingValue) {
        // Case : the component produces a sink with that name
        if (cachedSinks[sinkName] != null) {
          console.log(`ForEach > makeSwitchedSink > sink ${sinkName} : extracting...`)
          return cachedSinks[sinkName]
            .tap(console.warn.bind(console, `ForEach > makeSwitchedSink > sink ${sinkName} emits :`))
            .finally(_ => {
              console.log(`sink ${sinkName} terminating due to applicable case change`)
            })
            .share()
        }
        else {
          // Case : the component does not have any sinks with the corresponding sinkName
          // NOTE : Don't use $.never(), this avoids hanging in some cases
          console.log(`ForEach > makeSwitchedSink > sink ${sinkName} : component does not have a sink with that name, sink set to empty`)
          return $.empty()
        }
      })
        .tap(function () {
          console.warn(`ForEach > makeSwitchedSink > switching in ${sinkName}`)
        })
        .switch()
    }
  }

  return mergeAll(map(makeSwitchedSink, sinkNames))
}

// Spec
const forEachSpec = {
  computeSinks: computeSinks,
  checkPreConditions: isValidForEachSettings
};

export function ForEach(forEachSettings, componentTree) {
  assertContract(hasAtLeastOneChildComponent, [componentTree], `ForEach : ForEach combinator must at least have one child component to switch to!`);
  assertContract(isForEachSettings, [null, forEachSettings], `ForEach : ForEach combinator must have 'from' and 'as' property which are strings!`);

  // TODO : have a look at specs maybe add combinator name to the second m, or remove the trace in that m? but then
  // that m does not have the trace/?
  return m(forEachSpec, set(combinatorNameInSettings, 'ForEach', forEachSettings), componentTree)
}
