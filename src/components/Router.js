/**
 * Usage : m(Router, {route: RouteSpec, sinkNames: [...]}, [children
 * components])
 */

import { assertContract, assertSignature, isArray, isArrayOf, isFunction, isString } from "../utils"
import { m } from "./m"
import { isNil, map as mapR, mergeAll as mergeAllR, omit, path as pathR } from "ramda"
import { routeMatcher } from "../vendor/routematcher"
import Rx from "rx"
const $ = Rx.Observable

// Configuration
const routeSourceName = 'route$'

///////////
// Helpers
function match(routeToMatch) {
  let rm1 = routeMatcher(routeToMatch)
  let rm2 = routeMatcher(routeToMatch + '/*routeRemainder')

  return function match(incomingRoute) {
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

function isRouteSettings(obj) {
  return obj.route && isString(obj.route) &&
    obj.sinkNames && isArray(obj.sinkNames) && obj.sinkNames.length > 0
}

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
export function computeSinks(makeOwnSinks, childrenComponents, sources, settings) {
  console.groupCollapsed('Router component > makeAllSinks')
  console.log('sources, settings, childrenComponents', sources, settings, childrenComponents);

  const signature = [{ settings: isRouteSettings },]

  assertSignature('Router > computeSinks', [settings], signature)

  // The sink names are necessary as we cannot know otherwise in
  // advance what are the sinks output by the children components without
  // executing all the children components.
  // However to execute the children components, we need to pass the route
  // params to the children. To get those params, in turn, we need to
  // enter the observable monad, from which we can't get out.
  // This behaviour results in having to handle null cases for sinks (some
  // sinks might be present only on some children components).
  const sinkNames = settings.sinkNames
  const trace = 'router:' + (settings.trace || "")

  let route$ = sources[routeSourceName]
    .tap(console.error.bind(console, 'route$'))

  let matchedRoute$ = route$.map(match(settings.route))
    .tap(console.warn.bind(console, trace + '|matchedRoute$'))
    // NOTE : replaying here is mandatory
    // That's because the children are passed `matchedRoute` and
    // connect to it AFTER the `route$` has emitted its value...
    // In short, while time is abstracted out in the case of a static
    // graph, dynamic stream graphs come with synchronization pains
    .shareReplay(1)

  let changedRouteEvents$ = matchedRoute$
    .pluck('match')
    .distinctUntilChanged(x => {
      console.log('distinctUntilChanged on : ', x ? omit(['routeRemainder'], x) : null)
      return x ? omit(['routeRemainder'], x) : null
    })
    .tap(console.warn.bind(console, 'changedRouteEvents$'))
    .share()
  // Note : must be shared, used twice here

  const cachedSinks$ = changedRouteEvents$
    .map(function (params) {
      let cachedSinks

      if (params != null) {
        console.info('computing children components sinks', params)
        const componentFromChildren = m({
            makeLocalSources: function makeLocalSources(sources, __settings) {
              console.group('makeLocalSources')
              console.log('sources, __settings', sources, __settings);
              console.groupEnd('makeLocalSources')

              return {
                route$: matchedRoute$
                  .map(pathR(['match', 'routeRemainder']))
                  .tap(console.warn.bind(console, settings.trace + ' :' +
                    ' changedRouteEvents$' +
                    ' : routeRemainder: '))
                  .share(),
              }
            },
          }, {
            routeParams: omit(['routeRemainder'], params),
            trace: 'inner - ' + trace
          },
          childrenComponents)
        cachedSinks = componentFromChildren(sources, settings)
      }
      else {
        cachedSinks = null
      }

      return cachedSinks
    })
    .share()

  function makeRoutedSinkFromCache(sinkName) {
    return function makeRoutedSinkFromCache(params, cachedSinks) {
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

          prefix$ = sinkName === 'DOM' ?
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
            .tap(console.log.bind(console, 'sink ' + sinkName + ':'))
            .finally(_ => {
              void _
              console.log(trace + ' : sink ' + sinkName + ': terminating due to' +
                ' route change')
            })

          cached$ = $.concat(prefix$, preCached$)
        }
        else {
          // Case : the component does not have any sinks with the
          // corresponding sinkName
          cached$ = $.empty()
        }
      }
      else {
        // Case : new route does NOT match component configured route
        console.log('params is null!!! no match for this component on' +
          ' this route :' + trace)
        cached$ = sinkName === 'DOM' ? $.of(null) : $.empty()
      }

      return cached$
    }
  }

  function makeRoutedSink(sinkName) {
    return {
      [sinkName]: changedRouteEvents$.withLatestFrom(
        cachedSinks$,
        makeRoutedSinkFromCache(sinkName)
      ).switch()
    }
  }

  console.groupEnd('makeAllSinks')
  return mergeAllR(mapR(makeRoutedSink, sinkNames))
}

export function checkRouteSettingsHaveRouteProp(settings) {
  // there must be a route property and it must be a string
  return settings.route && isString(settings.route)
}

// TODO : think about some rules for names for this kind of functions (HOC? not totally)
// 1. I need an array of component for nested routing
// onRoute(URL, [onRoute(url1, chilcComp1), onRoute(url2, childComp2)])
// 2. But then I miss the settings parameter, i.e. I need to merge the children sinks with an
// appropriate default...
// That is combineLatest for the behaviours (DOM...), merge for the events
// TODO : check the current defaults of `m`
export function onRoute(settings, components) {
  // check that components is an array
  assertContract(isArrayOf(isFunction), [components], `onRoute : MUST be passed array of functions (components)`);
  // check that settings.route is set to a string
  assertContract(checkRouteSettingsHaveRouteProp, [settings], `onRoute : settings MUST include the url in its route property!`)

  return m({ computeSinks }, settings, components)
}

// TODO : have an index.js which imports stuff from sublibs and export * them out
// TODO : then make a npm release, put that in a package.json in FSM-example
