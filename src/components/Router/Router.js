import {
  assertContract, checkAndGatherErrors, DOM_SINK, format, hasAtLeastOneChildComponent, isArray,
  isArrayOf, isString
} from "../../utils"
import { m } from "../m/m"
import { defaultTo, isNil, keys, map as mapR, mergeAll, omit, path as pathR } from "ramda"
import { routeMatcher } from "../../vendor/routematcher"
import Rx from "rx"
import { ROUTE_CONFIG, ROUTE_PARAMS, ROUTE_SOURCE } from "./properties"

const $ = Rx.Observable

///////////
// Helpers
function hasSinkNamesProperty(sources, settings) {
  return Boolean(settings && 'sinkNames' in settings)
    && Boolean(isArrayOf(isString)(settings.sinkNames))
}

function hasRouteProperty(sources, settings) {
  return Boolean(settings && 'route' in settings)
    || Boolean(isString(settings.route) && settings.route.length > 1)
}

function hasRouteSourceProperty(sources, settings) {
  return Boolean(!settings || !('routeSource' in settings)) ||
    Boolean(settings && 'routeSource' in settings
      && isString(settings.routeSource) && settings.routeSource.length > 0)
}

/**
 * @typedef {String} Route
 */

/**
 * @typedef {Object.<String, String> | null} ParsedRoute
 */
/**
 * @param {Route} routeToMatch the configured route to be matched against current location
 * @returns {function(Route): {match : ParsedRoute | {routeRemainder : *}}} Returns a function
 * which, when called with the current route location, returns :
 * - the parsed route when the current route location matches the configured route (total match)
 * - the route remainder if the current route lcoation strictly 'contains' the configured route,
 * i.e. there is a substring of current route location that matches the configured route. The
 * route remainder is the difference between the current route location and that substring
 * - configured route : /*param, route location : /a/b => {routeRemainder : b, param : a}
 * In short, this allows for partial matching of url vs. configured route.
 * The returned object always contains the matched parameters from the url (undefined if none)
 * and `routeRemainder` property holds on the next sections of the url (undefined when no
 * next sections).
 */
function match(routeToMatch) {
  let rm1 = routeMatcher(routeToMatch)
  // TODO : put into a property when tests are passing `/*${ROUTE_REMAINDER}`
  let rm2 = routeMatcher(routeToMatch + '/*routeRemainder')

  return function match(incomingRoute) {
    console.debug(`Router > match > matching against route : ${format(routeToMatch)}`)
    if (isNil(incomingRoute)) {
      return {
        match: null
      }
    }

    const matched = rm1.parse(incomingRoute)
    const remainder = rm2.parse(incomingRoute)

    return {
      match: matched || remainder
    }
  }
}

const isRouteSettings = checkAndGatherErrors([
  [hasRouteProperty, `Settings parameter must have a 'route' property which is a non empty string!`],
  [hasSinkNamesProperty, `Settings parameter must have a 'sinkNames' property!`],
  [hasRouteSourceProperty, `If settings parameter have a 'routeSource' property, then it must be a string!`],
], `isRouteSettings : fails!`);

/**
 * Definition for a router component which :
 * - will pass the sinks of its children components iff the new route
 * matches the route configured for the components
 * - when the route no longer matches, components sinks are terminated
 * - when the route matches, changes but keeps the same value, children
 * sinks remain in place
 * Route information is read on the `route$` property
 * Children components pass to their own children a `route$` which is the
 * `route$` they received from their parent, from which they remove the
 * part of the route that they have matched (passing what is called here the
 * remainder).
 * Params parsed from the matched route are passed to the children
 * component through their `settings` parameters, with the `routeParams`
 * property.
 * The `route$` property can be but should not be manipulated directly out
 * of a `Router` component.
 *
 * Two settings are necessary :
 * - route : the route which triggers the component sinks activation.
 *   1. Note that a route value of `undefined` will produce no matching,
 *   while a value of `""` will match `":user"` ! See the tests
 *   2. Every new nested route will trigger the emission of a nested route
 *   value, even if that new nested route value is the same as the
 *   previous one.
 *   3. In the routed component, the `route$` will emit the matched
 *   portion of the route. However, the same information is already broken
 *   down in `routeParams` and should be read from there.
 *
 * - sinkNames : the list of sinks (names) which must be activated in
 * response to the matching route
 *
 * Note that the DOM sink will emit null on some specific circumstances,
 * hence the component receiving the routed DOM sink must plan for that
 * case accordingly. That means DOM :: Observable<VNode>|Null
 *
 * @param {Sources} sources
 * @param {{route: string, sinkNames: Array<string>, trace: string}} settings
 * @param {Array<Component>} childrenComponents
 * @param {function(Sources, Settings)} makeOwnSinks
 *
 */
function computeSinks(makeOwnSinks, childrenComponents, sources, settings) {
  const trace = 'Router (' + (settings.trace || "") + ")";
  console.groupCollapsed(`${trace} > computeSinks`)
  console.debug(`sources : ${keys(sources)}`)
  console.debug(`settings`, settings)
  console.debug('childrenComponents', childrenComponents);

  // The sink names are necessary as we cannot know otherwise in
  // advance what are the sinks output by the children components without
  // executing all the children components.
  // However to execute the children components, we need to pass the route
  // params to the children. To get those params, in turn, we need to
  // enter the observable monad, from which we can't get out.
  // This behaviour results in having to handle null cases for sinks (some
  // sinks might be present only on some children components).
  const { sinkNames, routeSource } = settings;
  const routeSourceName = defaultTo(ROUTE_SOURCE, routeSource)

  let cachedSinks = null;

  let route$ = sources[routeSourceName]
    .tap(console.debug.bind(console, `${trace} : source ${routeSourceName}`))

  let matchedRoute$ = route$.map(match(settings[ROUTE_CONFIG]))
    .tap(x => {
        if (isNil(x.match)) {
          console.debug(`${trace} > matchedRoute$ > current route does not match this component's route!`)
        } else {
          console.debug(`${trace} > matchedRoute$ > current route matches!! :`, x)
        }
      }
    )
    // NOTE : replaying here is mandatory
    // That's because the children are passed `matchedRoute` and
    // connect to it AFTER the `route$` has emitted its value...
    // In short, while time is abstracted out in the case of a static
    // graph, dynamic stream graphs come with synchronization pains
    .shareReplay(1)

  let changedRouteEvents$ = matchedRoute$
    .distinctUntilChanged(({ match }) => {
      return match ? omit(['routeRemainder'], match) : null
    })
    .tap(console.debug.bind(console, `${trace} > changedRouteEvents$ > route change (ignoring duplicates) on section :`))
    .do(function computeChildrenSinksIfAny({ match }) {
      // Case : the configured route did match the current route
      if (match != null) {
        console.info(`${trace} > computing children components sinks with match`, match);
        const componentFromChildren = m({
            makeLocalSources: function makeLocalSources(sources, __settings) {
              console.group(`${trace} > changedRouteEvents$ > children wrapper component > makeLocalSources`);
              console.debug(`sources : ${keys(sources)}, __settings :`, __settings);
              console.groupEnd();

              return {
                [routeSourceName]: matchedRoute$
                  .map(pathR(['match', 'routeRemainder']))
                  .tap(console.debug.bind(console,
                    `${trace} > changedRouteEvents$ > children wrapper component  > source ${routeSourceName} > routeRemainder (new route$ for children)`))
                  .share(),
              }
            },
          }, {
            [ROUTE_PARAMS]: omit(['routeRemainder'], match),
            trace: `${trace} > componentFromChildren`
          },
          [makeOwnSinks, childrenComponents]);
        cachedSinks = componentFromChildren(sources, settings);
      }
      else {
        cachedSinks = null
      }
    })
    .share()
  // Note : must be shared, used twice here
  // NOTE : we cannot group  matchedRoute$ and changedRouteEvents$ in one, as one needs a Replay
  // and the other one needs just a share :
  // - changedRouteEvents$ really is an event, we don't want it to trigger in a delayed manner.
  // Tests proved that this leads to children componnt emitting values when they should already
  // be disconnected

  function makeRoutedSinkFromCache(sinkName) {
    return function makeRoutedSinkFromCache(params) {
      let cached$, preCached$, prefix$

      if (params != null) {
        // Case : new route matches component configured route
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

          prefix$ = sinkName === DOM_SINK ?
            // Case : DOM sink
            // actually any sink which is merged with a `combineLatest`
            // but here by default only DOM sinks are merged that way
            // Because the `combineLatest` blocks till all its sources
            // have started, and that behaviour interacts badly with
            // route changes desired behavior, we forcibly emits a `null`
            // value at the beginning of every sink.
            $.of(null) :
            // Case : Non-DOM sink
            // Non-DOM sinks are merged with a simple `merge`, there
            // is no conflict here, so we just return nothing
            $.empty()

          preCached$ = cachedSinks[sinkName]
            .tap(console.log.bind(console, `${trace} > makeRoutedSinkFromCache > sink ${sinkName} :`))
            .finally(_ => {
              void _
              console.log(`${trace} > makeRoutedSinkFromCache > sink ${sinkName} : terminating due to route change`)
            })

          cached$ = $.concat(prefix$, preCached$)
        }
        else {
          // Case : the component does not have any sinks with the
          // corresponding sinkName
          console.info(`${trace} > sink ${sinkName} : component has no such sink!`)
          console.debug(`${trace} > makeRoutedSinkFromCache > sink ${sinkName} : -> empty`)
          cached$ = $.empty()
        }
      }
      else {
        // Case : new route does NOT match component configured route
        console.log(`${trace} > sink ${sinkName} : no match for this component on this route!`)
        cached$ = sinkName === DOM_SINK ? $.of(null) : $.empty()
      }

      return cached$
    }
  }

  function makeRoutedSink(sinkName) {
    return {
      [sinkName]: changedRouteEvents$
        .pluck('match')
        .map(makeRoutedSinkFromCache(sinkName))
        .switch()
    }
  }

  console.groupEnd();

  return mergeAll(mapR(makeRoutedSink, sinkNames))
}

const RouterSpec = {
  computeSinks: computeSinks,
  checkPreConditions: isRouteSettings
};

// TODO : in index.js set up the sinks for the router as in FSM-example
// TODO : write documentation
export function OnRoute(routeSettings, componentTree) {
  // check that components is an array
  assertContract(hasAtLeastOneChildComponent, [componentTree], `Router : router combinator must at least have one child component to route to!`);

  return m(RouterSpec, routeSettings, componentTree)
}
