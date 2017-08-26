// ForEach({from : 'fetchedCardsInfo$', as : 'items'}
import {defaultTo} from 'ramda'
import { defaultFilterBy } from "./properties"
import { format } from "../../utils"
import { m } from '../m'
import {
  assertContract, checkAndGatherErrors, DOM_SINK, hasAtLeastOneChildComponent, isArrayOf,
  isFunction, isSource, isString, removeNullsFromArray, unfoldObjOverload, isString, isFunction
} from '../../utils'
import { addIndex, assoc, defaultTo, equals, flatten, map, mergeAll } from 'ramda'
import * as Rx from 'rx'

function isForEachSettings (sources, settings) {
  return 'from' in settings && 'as' in settings
  && isString(settings.from) && isString(settings.as)
}

function computeSinks(makeOwnSinks, childrenComponents, sources, settings){
  // TODO : when changing m signature pay attention to tat too, I don't use makeOwnSinks I should?
  let { from, as } = settings;
  let cachedSinks = null;

  const switchSource = sources[from];
  const shouldSwitch$ = switchSource
    .do(function (incomingValue) {
        console.info(`${settings.trace} > ForEach > New value from source ${from}`, format(incomingValue))
        console.info(`${settings.trace} > ForEach > Computing the associated sinks`)
        const mergedChildrenComponentsSinks = m(
          {},
          { [as]: incomingValue, trace: 'executing ForEach children' },
          childrenComponents);

        cachedSinks = mergedChildrenComponentsSinks(sources, settings)
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

  return mergeAll(map(makeSwitchedSink, sinkNames)) // ramda mergeAll, not Rx
}

// Spec
const ForEachSpec = {
  computeSinks: computeSinks
};

export function ForEach(forEachSettings, childrenComponents) {
  assertContract(hasAtLeastOneChildComponent, [childrenComponents], `ForEach : ForEach combinator must at least have one child component to switch to!`);
  assertContract(isForEachSettings, [null, forEachSettings], `ForEach : ForEach combinator must have 'from' and 'as' property which are strings!`);

  return m(ForEachSpec, forEachSettings, childrenComponents)
}
