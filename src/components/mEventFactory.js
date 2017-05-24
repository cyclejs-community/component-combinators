import {
  isStrictRecord, isHashMap, isFunction, isString, removeNullsFromArray, getSinkNamesFromSinksArray,
  preventDefault
} from "../utils"
import { defaultMergeSinkFn, m } from './m'
import { isNil, either, T, reduce, keys, difference } from "ramda"
import { isEventName } from "./types"

// No further argument type checking here
const isEventFactoryFunction = isFunction

// Could be checking among the list of events from the DOM but I dont, I am lazy
const isDomEventName = isString
const isSelectorString = isString
const isSelectorDescription = T
const isSelector = isHashMap(isSelectorDescription, isSelectorString)

const isEventFactoryEventSettings = either(isNil, isStrictRecord({
  custom : either(isNil, isHashMap(isEventName, isEventFactoryFunction)),
  DOM : either(isNil, isHashMap(isDomEventName, isSelector))
}))

function hasEventsProperty(settings) {
  return settings && settings.events
}

function checkEventFactoryPreConditions(sources, settings) {
  return hasEventsProperty(settings) &&
      isEventFactoryEventSettings(settings.events)
}

/*
 ###  EventFactorySettings
 - `{`
 - `events : {`
 -   `custom : {eventName : (sources, settings) =>  event$},`
 -   `DOM : { eventName : {selectorDesc : 'selector}}`
 -   `}`
 - `}`
 */
function makeEventFactorySinks (sources, settings){
  const {events : {custom, DOM}} = settings

  const customEvents = reduce ((acc, customEventName) => {
    acc[customEventName] = custom[customEventName](sources, settings)
    return acc
  }, {}, keys(custom))

  const createdEvents = reduce ((acc, DomEventName) => {
    // We dont test if this update is destructive, it is not in our contract
    // This means DOM events have priority over custom events in case of event name conflicts
    const selectors = DOM[DomEventName]

    return reduce((innerAcc, selectorDesc) => {
      const selector = selectors[selectorDesc]
      const eventName = [selector, DomEventName].join('_')
      innerAcc[eventName] = sources.DOM.select(selector).events(DomEventName).tap(preventDefault)

      return innerAcc
    }, acc, keys(selectors))

  }, customEvents, keys(DOM))

  return createdEvents
}

function mergeEventFactorySinksWithChildrenSinks (eventSinks, childrenSinks, localSettings){
  const childrenSinksArray = flatten(removeNullsFromArray([childrenSinks]))
  const allSinks = flatten(removeNullsFromArray([eventSinks, childrenSinks]))
  const eventSinkNames = keys(eventSinks)
  const childrenSinkNames = getSinkNamesFromSinksArray(childrenSinksArray)
  const sinkNames = getSinkNamesFromSinksArray(allSinks)

  // throw error in the case of children sinks with the same sink name as event sinks
  if (difference (eventSinkNames, childrenSinkNames).length !== 0) {
    throw `mEventFactory > mergeEventFactorySinksWithChildrenSinks : found children sinks with 
           at least one sink name conflicting with an event sink : 
           ${eventSinkNames} vs. ${childrenSinkNames}`
  }

  // otherwise apply default merge functions
  return defaultMergeSinkFn(eventSinks, childrenSinks, localSettings, sinkNames)
}

const eventFactorySpec = {
  // No extra sources
  makeLocalSources: null,
  // No extra settings
  makeLocalSettings: null,
  // We check that the settings have the appropriate shape
  checkPreConditions: checkEventFactoryPreConditions,
  checkPostConditions: null,
  // Create the event sinks from the specifications
  makeOwnSinks: makeEventFactorySinks,
  // We merge children sinks with the by-default merge functions
  mergeSinks: mergeEventFactorySinksWithChildrenSinks
}

export function mEventFactory(EventFactorySettings, childrenComponents) {
  // returns a component which default-merges sinks coming from the children
  // and adds its events sinks to it

  return m(eventFactorySpec, EventFactorySettings, childrenComponents)
}
