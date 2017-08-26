// NOTE : right now all casewhen are evaluated

import { m } from '../m'
import {
  assertContract, checkAndGatherErrors, DOM_SINK, hasAtLeastOneChildComponent, isArray, isArrayOf,
  isFunction, isSource,
  isString, removeNullsFromArray, unfoldObjOverload
} from '../../utils'
import { addIndex, assoc, defaultTo, equals, flatten, map, mergeAll } from 'ramda'
import * as Rx from 'rx'
import { SWITCH_SOURCE } from "./properties"

const $ = Rx.Observable;
const mapIndexed = addIndex(map)

function defaultsTo(obj, defaultsTo) {
  return !obj ? defaultsTo : obj
}

// CONFIG
const defaultEqFn = function swichCptdefaultEqFn(a, b) {
  return equals(a, b)
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

function hasWhenProperty(sources, settings) {
  return Boolean(settings && 'when' in settings)
}

function hasEqFnProperty(sources, settings) {
  return Boolean(!settings || !('eqFn' in settings))
    || Boolean(isFunction(settings.eqFn))
}

function hasSinkNamesProperty(sources, settings) {
  return Boolean(settings || !settings.sinkNames)
    && Boolean(isArrayOf(isString)(settings.sinkNames))
}

function hasValidOnProperty(sources, settings) {
  return Boolean(isString(settings.on) && sources[settings.on])
}

function hasOnProperty(sources, settings) {
  return Boolean(settings && settings.on)
}

const isCaseSettings = checkAndGatherErrors([
  [hasWhenProperty, `Settings parameter must have a 'when' property!`],
  [hasEqFnProperty, `If settings parameter has a eqFn property, it must be a function!`]
], `isCaseSettings : fails!`);

const isSwitchSettings = checkAndGatherErrors([
  [hasSinkNamesProperty, `Settings parameter must have a 'sinkNames' property!`],
  [hasValidOnProperty, `Settings parameter must have a 'on' property, which is a string, and corresponds to a source in sources!`],
  [hasEqFnProperty, `If settings parameter has a eqFn property, it must be a function!`]
], `Switch : Invalid switch component settings!`);

//////////////
function computeSinks(makeOwnSinks, childrenComponents, sources, settings) {
  let { eqFn, when, sinkNames, on } = settings;
  let cachedSinks = null;

  const overload = unfoldObjOverload(on, [
    { 'guard$': isFunction },
    { 'sourceName': isString }
  ]);
  let { guard$, sourceName, _index } = overload;
  let switchSource;

  if (overload._index === 1) {
    // Case : overload `settings.on :: SourceName`
    switchSource = sources[sourceName]
  }
  if (overload._index === 0) {
    // Case : overload `settings.on :: SourceName`
    switchSource = guard$(sources, settings)
    assertContract(isSource, [switchSource],
      `Case > computeSinks > The function used for conditional switching did not return an observable!`)
  }

  // set default values for optional properties
  eqFn = defaultTo(cfg.defaultEqFn, eqFn);

  const shouldSwitch$ = switchSource
    .map(x => eqFn(x, when))
    .do(function (isMatching) {
      if (isMatching) {
        console.info(`Found a match (${when}) for Case branch ${settings.trace}`)
        console.info(`Computing the corresponding sinks`)
        const mergedChildrenComponentsSinks = m(
          {},
          { matched: when, trace : 'executing case children' },
          childrenComponents)

        cachedSinks = mergedChildrenComponentsSinks(sources, settings)
      }
      else {
        console.info(`Did not find a match (${when}) for Case branch ${settings.trace}`)
      }
    })
    // NOTE: apparently necessary because every sink name wires at a different moment?? maybe
    // because the wire happens at switch time? and that is a different time every time??
    // Anyways it semms to work like this, so no more touching it
    .shareReplay(1)
  ;

  function makeSwitchedSink(sinkName) {
    return {
      [sinkName]: shouldSwitch$.map(function makeSwitchedSinkFromCache(isMatchingCase) {
        // TODO : remove unused, use let isntead of var
        // TODO : use return inside the ifs and remove cached$
        var cached$

        if (isMatchingCase) {
          // Case : the switch source emits a value corresponding to the
          // configured case in the component

          // Case : the component produces a sink with that name
          if (cachedSinks[sinkName] != null) {
            console.log(`Switch > Case > computeSinks > makeSwitchedSink > Branch ${settings.trace} > sink ${sinkName} : extracting...`)
            cached$ = cachedSinks[sinkName]
              .tap(console.warn.bind(console, `Switch > Case > computeSinks > makeSwitchedSink > Branch ${settings.trace} > sink ${sinkName} emits :`))
              .finally(_ => {
                console.log(`sink ${sinkName} terminating due to applicable case change`)
              })
          }
          else {
            // Case : the component does not have any sinks with the
            // corresponding sinkName
            // NOTE : Don't use $.never(), this avoids hanging in some cases
            console.log(`Switch > Case > computeSinks > makeSwitchedSink > Branch ${settings.trace} > sink ${sinkName} : component does not have a sink with that name, sink set to empty`)
            cached$ = $.empty()
          }
        }
        else {
          // Case : the switch source emits a value NOT corresponding to the
          // configured case in the component
          console.log(`Switch > Case > computeSinks > makeSwitchedSink > Branch ${settings.trace} > sink ${sinkName} : set to empty or null`)
          // TODO : replace DOM which is specific to cycle
          // In fact, we need to put null in DOM because we need to erase
          // the current value of DOM, which should be on only iff the case
          // is fulfilled.
          // In even more fact, this is the case for any behaviour, not just
          // the DOM. Behaviours must continuously have a value. Not settings null for the DOM,
          // i.e. for instance setting $.empty() would mean a `combineLatest` down the road would
          // still lead to the display of the old DOM, or worse block part of the DOM building
          // (all sources for `combineLatest` must have emitted for the operator to emit its first
          // value)
          cached$ = sinkName === DOM_SINK ? $.of(null) : $.empty()
        }
        return cached$
      })
        .tap(function () {
          console.warn(`Switch > Case > computeSinks > makeSwitchedSink > Branch ${settings.trace} > switching in ${sinkName}`)
        })
        .switch()
    }
  }

  return mergeAll(map(makeSwitchedSink, sinkNames)) // ramda mergeAll, not Rx
}

export const SwitchSpec = {
  mergeSinks: {
    DOM: function mergeDomSwitchedSinks(ownSink, childrenDOMSink, settings) {
      const allSinks = flatten([ownSink, childrenDOMSink])
      const allDOMSinks = removeNullsFromArray(allSinks)

      // NOTE : zip rxjs does not accept only one argument...
      return $.merge(allDOMSinks.map((sink, index) => sink.tap(
        function (x) {
          console.warn(`Switch > SwitchSpec > mergeDomSwitchedSinks (child ${index}) emits :`, x)
        }
      ))) //!! passes an array
        .filter(Boolean)
      // Most values will be null
      // All non-null values correspond to a match
      // In the degenerated case, all values will be null (no match
      // at all)
    }
  },
  checkPreConditions: isSwitchSettings
}

export const CaseSpec = {
  computeSinks: computeSinks,
  checkPreConditions: isCaseSettings
}

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
export function Switch(switchSettings, childrenComponents) {
  assertContract(hasAtLeastOneChildComponent, [childrenComponents], `Switch : switch combinator must at least have one child component to switch to!`);
  assertContract(hasOnProperty, [null, switchSettings], `Switch : switch combinator must have a 'on' property !`);
  let _SwitchSpec = SwitchSpec;
  let _switchSettings = switchSettings;

  // if we precompute the switch source, then change the specs and settings of the case
  // components so that we add the precomputed source to the children sources, and we pass the
  // `on` settings to be that extra source.
  // All this is to avoid a previous bug where the computed switch source was computed within
  // the Case component, hence it was computed every time for every case component
  if (isFunction(switchSettings.on)) {
    _SwitchSpec = assoc('makeLocalSources', function addComputedSwitchSource(sources, settings) {
      const switchSource = switchSettings.on(sources, settings);
      return {
        [SWITCH_SOURCE]: switchSource
      }
    }, SwitchSpec);
    _switchSettings = assoc('on', SWITCH_SOURCE, switchSettings);
  }

  return m(_SwitchSpec, _switchSettings, childrenComponents)
}

export function Case(CaseSettings, childrenComponents) {
  return m(CaseSpec, CaseSettings, childrenComponents)
}

// TODO : when doc and specs is written write carefully the test to test everything
// - matched passed to children
// - case when several components are active at the same time (several passing predicates)
// TODO : change the DOC : contracts - should only have one branch of Case at any given time for now
// TODO : study a DynSwitch reimplementation which multicasts the component sinks into one sink

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
