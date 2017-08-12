// NOTE : right now all casewhen are evaluated

import {m} from '../m'
import {assertSignature, assertContract, checkSignature,
  isString, isArray, isArrayOf, isFunction, isSource,
  unfoldObjOverload, removeNullsFromArray, removeEmptyVNodes, isVNode} from '../../utils'
import {addIndex, forEach, all, any, map, mapObjIndexed, reduce, keys, values,
  merge, mergeAll, flatten, prepend, uniq, always, reject,
  either, isNil, omit, path, complement, or, equals} from 'ramda'
import * as Rx from 'rx'
import {h, div, span} from 'cycle-snabbdom'

const $ = Rx.Observable;
const mapIndexed = addIndex(map)

function defaultsTo(obj, defaultsTo) {
  return !obj ? defaultsTo : obj
}

// CONFIG
const defaultEqFn = function swichCptdefaultEqFn(a, b) {
  return equals(a,b)
}
const cfg = {
  defaultEqFn: defaultEqFn
}

// Type checking typings
/**
 * @typedef {function(Sources,Settings):Source} SwitchOnCondition
 */
/**
 * @typedef {SourceName} SwitchOnSource
 */
/**
 * @typedef {Object} SwitchCaseSettings
 * @property {SwitchOnCondition | SwitchOnSource} on
 * @property {Array<SinkName>} sinkNames
 * @property {?function(*,*): Boolean} eqFn
 */

//////
// Helper functions
function isSwitchSettings(settings) {
  const {eqFn, when, sinkNames, on} = settings
  const signature = {
    eqFn: either(isNil, isFunction),
    when: complement(isNil),
    sinkNames: isArrayOf(isString),
    on: either(isString, isFunction)
  }
  const signatureErrorMessages = {
    eqFn: 'eqFn property, when not falsy, must be a function.',
    when: '\'when\' property is mandatory.',
    sinkNames: 'sinkNames property must be an array of strings',
    on: '`on` property is mandatory and must be a string or a function.'
  }

  return checkSignature(settings, signature, signatureErrorMessages)
}

function hasAtLeastOneChildComponent(childrenComponents) {
  return childrenComponents &&
  isArray(childrenComponents) &&
  childrenComponents.length >= 1 ? true : ''
}

function computeSinks(makeOwnSinks, childrenComponents, sources, settings) {
  // TODO (later): Be careful that the inheritance of settings down the
  // chain can pollute children... So I need to check the presence of the
  // passed settings before merge to check that mandatory properties are
  // passed and not inherited unexpectedly from an ancestor.
  // This will have to be done via settingsContracts at SwitchCase level

  let {eqFn, when, sinkNames, on} = settings

  const overload = unfoldObjOverload(on, [
    {'guard$': isFunction},
    {'sourceName': isString}
  ])
  let {guard$, sourceName, _index} = overload
  let switchSource

  if (overload._index === 1) {
    // Case : overload `settings.on :: SourceName`
    switchSource = sources[sourceName]
    assertContract(isSource, [switchSource],
      `An observable with name ${sourceName} could not be found in sources`)
  }
  if (overload._index === 0) {
    // Case : overload `settings.on :: SourceName`
    switchSource = guard$(sources, settings)
    assertContract(isSource, [switchSource],
      `The function used for conditional switching did not return an observable!`)
  }

  // set default values for optional properties
  eqFn = defaultsTo(eqFn, cfg.defaultEqFn)

  const shouldSwitch$ = switchSource
    .map(x => eqFn(when, x))
    .share()

  const cachedSinks$ = shouldSwitch$
    .filter(x => x)
    .map(function (_) {
      const mergedChildrenComponentsSinks = m(
        {},
        {matched: when},
        childrenComponents)

      return mergedChildrenComponentsSinks(sources, settings)
    })
    .share() // multicasted to all sinks

  function makeSwitchedSinkFromCache(sinkName) {
    return function makeSwitchedSinkFromCache(isMatchingCase, cachedSinks) {
      var cached$, preCached$, prefix$
      if (isMatchingCase) {
        // Case : the switch source emits a value corresponding to the
        // configured case in the component

        // Case : matches configured value
        if (cachedSinks[sinkName] != null) {
          // Case : the component produces a sink with that name
          // This is an important case, as parent can have children
          // nested at arbitrary levels, with either :
          // 1. sinks which will not be retained (not in `sinkNames`
          // settings)
          // 2. or no sinks matching a particular `sinkNames`
          // Casuistic 1. is taken care of automatically as we only
          // construct the sinks in `sinkNames`
          // Casuistic 2. is taken care of thereafter
          cached$ = cachedSinks[sinkName]
            .tap(console.log.bind(console, 'sink ' + sinkName + ':'))
            .finally(_ => {
              console.log(`sink ${sinkName} terminating due to applicable case change`)
            })
        }
        else {
          // Case : the component does not have any sinks with the
          // corresponding sinkName
          // NOTE : $.never() could also be, but this one avoids hanging
          // in some cases
          cached$ = $.empty()
        }
      }
      else {
        // Case : the switch source emits a value NOT corresponding to the
        // configured case in the component
        console.log('isMatchingCase is null!!! no match for this component on' +
          ' this route!')
        // TODO : replace DOM which is specific to cycle
        // In fact, we need to put null in DOM because we need to erase
        // the current value of DOM, which should be on only iff the case
        // is fulfilled.
        // In even more fact, this is the case for any behaviour, not just
        // the DOM. It must have a zero value for the monoidal merge operation
        cached$ = sinkName === 'DOM' ? $.of(null) : $.empty()
      }
      return cached$
    }
  }

  function makeSwitchedSink(sinkName) {
    return {
      [sinkName]: shouldSwitch$.withLatestFrom(
        cachedSinks$,
        makeSwitchedSinkFromCache(sinkName)
      )
        .tap(function () {
          console.warn(`switching: ${sinkName}`)
        })
        .switch()
    }
  }

  // console.groupEnd()

  return mergeAll(map(makeSwitchedSink, sinkNames))
}

export const SwitchSpec = {
  mergeSinks: {
    DOM: function mergeDomSwitchedSinks(ownSink, childrenDOMSink, settings) {
      const allSinks = flatten([ownSink, childrenDOMSink])
      const allDOMSinks = removeNullsFromArray(allSinks)

      // NOTE : zip rxjs does not accept only one argument...
      return $.merge(allDOMSinks) //!! passes an array
        .tap(console.warn.bind(console, 'Switch.specs' +
          ' > mergeDomSwitchedSinks > merge'))
        .filter(Boolean)
      // Most values will be null
      // All non-null values correspond to a match
      // In the degenerated case, all values will be null (no match
      // at all)
    }
  }
}

export const CaseSpec = {computeSinks: computeSinks}

/**
 * Usage : Switch(SwitchCaseSettings, Array<CaseComponent>)
 * Example : cf. specs
 *   > const mComponent = Switch({
   *   >    on: (sources,settings) => sources.sweatch$,
   *   >    sinkNames: ['DOM', 'a', 'b']
   *   >  }, [
 *   > Case({when: true}, [childComponent1, childComponent2]),
 *   > Case({when: false}, [childComponent3])
 *   > ])
 *
 * The switch combinator activates a component conditionally depending on
 * whether a condition on a 'switch' source stream is satisfied. Note
 * that the condition is evaluated every time there is an incoming value
 * on the switch source.
 * If it is necessary to implement a logic by which the component activation
 * should only trigger on **changes** of the incoming value, that logic
 * could be implemented with a `distinctUntilChanged`.
 * When the condition is no longer satisfied, the previously activated
 * component is deactivated automatically :
 * - DOM sink emits null and terminates
 * - Non-DOM sinks are empty
 * DOM sinks are treated differently because the DOM is a behaviour
 * (continuous value), not an event, so we need to update to null its value
 * when there is no longer a match. i.e. match => DOM, no match => Null
 *
 * Signature 1: SwitchOnCondition -> [Component] -> Component
 * - settings.on :: Sources -> Settings -> Source
 * The function passed as parameter is returning a source observable whose
 * values will be used for the conditional switching.
 * - settings.sinkNames :: [SinkName]
 * This is an array with the names of the sinks to be constructed. This is
 * mandatory as we can't know in advance which sinks to produce
 * - settings.eqFn :: * -> * -> Boolean
 * A predicate which returns true if both parameters are considered equal.
 * This parameter defaults to ramda's equals function
 *
 * Signature 2: SwitchOnSource -> [Component] -> Component
 * - settings.on :: SourceName
 * A string which is the source name whose values will be used for the
 * conditional activation of the component. The source used will be
 * sources[sourceName]
 * - Cf. Signature 1 for the meaning of the rest of parameters
 *
 * Contracts :
 * - the source name given as parameter must exist as property of the `sources` parameter
 * - Switch combinator must have at least one child component
 * - Case combinator must have at least one child component
 * - Switch predicates should be defined such that, for any given value
 * of the 'switch' source, there is only one matching Switch child component
 *   - If that is not the case :
 *     - behaviour is unspecified
 *     - in the present implementation, the last matching component should be the one
 *   prevailing (NOT TESTED).
 * - on, sinkNames, when are mandatory
 *
 * Case component
 * - settings.when :: *
 * An object which will activate the switched-to component whenever the switch source
 * observable returned by the `on` parameter emits that object
 *
 * Contracts :
 * - when is mandatory
 *
 * @params {SwitchSettings} switchSettings
 * @params {Array.<Component>} childrenComponents
 * @return {Component}
 * @throws
 */
export function Switch (switchSettings, childrenComponents) {
  // TODO : check that contracts are correct - nothing missing and correct names of properties
  // TODO : that means move `on` check in computeSinks here in conracts
  // TODO : and use the validation monad for the error passing
  assertContract(isSwitchSettings, [switchSettings], `Switch : Invalid switch component settings!`);
  assertContract(hasAtLeastOneChildComponent, [childrenComponents], `Switch : switch combinator must at least have one child component to switch to!`);
 // TODO : change typedef for SwitchSpec
  return m(SwitchSpec, switchSettings, childrenComponents)
}

export function Case (CaseSettings, childrenComponents) {
  // TODO : check contracts
  // TODO : change typedef for CaseSpec
  return m(CaseSpec, CaseSettings, childrenComponents)
}

// TODO : look a the test. Switch is used as m(Switch, []...)
// change it to Switch(settings, [Case])... I dont know actually see the todo list with fsm
/*
Switch({
  on: 'auth$'
}, [
  Case({ when: IS_LOGGED_IN }, [
    TodoComponent({ routeState: ALL }) // actually will require flip or
    // curry and R.__
  ]),
  Case({ when: complement(IS_LOGGED_IN) }, [
    LogIn({ redirect: '/' })
  ])
]
  */
