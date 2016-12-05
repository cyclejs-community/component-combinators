// TODO : DOCUMENTATION : all settings which should not be inherited from the
// parent should have default value. This prevents unintentional overriding
// from the ancestor hierarchy. Settings' default value should be part of
// the component documentation

define(function (require) {
  const Rx = require('rx')
  const U = require('util')
  const m = U.m
  const Cycle = require('cycle')
  const Router = require('components/Router')
  //    const toHTML = require('vdomtohtml')
  const Sdom = require('cycle-snabbdom')
  const Sdom2html = require('snabbdom-to-html').toHTML
  const makeDOMDriver = Sdom.makeDOMDriver
  const makeHTMLDriver = Sdom.makeHTMLDriver
  const {h, h2, h3, div, p, ul, li, span, a, i} = Sdom
  const Mclass = require('snabbdom_class')
  const Mprops = require('snabbdom_props')
  const Mstyle = require('snabbdom_style')
  const Mattributes = require('snabbdom_attributes')

  const modules = [Mclass, Mprops, Mstyle, Mattributes]
  const $ = Rx.Observable

  const createBrowserHistory = require('history').createBrowserHistory
  const history = createBrowserHistory()
  const makeHistoryDriver = require('history_driver.js').makeHistoryDriver

  const historyDriver = makeHistoryDriver(history, {capture: true})

  function makeFakeAuthDriver() {
    return function authDriver(authIntent$) {
      authIntent$.tap(console.log.bind(console, 'authDriver : authIntent$ :'))
    }
  }

  function makeFakeQueueDriver() {
    return function queueDriver(queueIntent$) {
      queueIntent$.tap(console.log.bind(console, 'queueDriver : queueIntent$ :'))
    }
  }

  function filterNull(driver) {
    return function filteredDOMDriver(sink$) {
      return driver(sink$.filter(x => x))
    }
  }

  const drivers = {
    DOM: filterNull(makeDOMDriver('#app', {transposition: false, modules})),
    router: historyDriver,
    //    auth$: makeFakeAuthDriver(),
    //    queue$: makeFakeQueueDriver(),
  }

  /**
   * FIXTURES
   */
  let App = {Group: {}, User: {}}

  App.Group.FIXTURES = [{
    id: 1,
    name: "Group one",
    details: "details for Group one",
    users: [1, 2]

  }, {
    id: 2,
    name: "Group two",
    details: "details for Group two",
    users: [2]
  }]

  App.User.FIXTURES = [{
    id: 1,
    name: "Tom",
    details: "I am the Cat !",
    groups: [1]

  }, {
    id: 2,
    name: "Jerry",
    details: "I am the Mouse !",
    groups: [2]
  }]

  /**
   * Rendering functions
   */
  function renderGroups(groups) {
    return div([
      h3('Groups'),
      p('Click on a group to display corresponding users'),
      div({style: ''}, [
        ul(
          groups.map(group => li([
            a({
              "attrs": {"href": `/group/${group.id}`}
            }, [group.name])
          ]))
        )
      ])
    ])
  }

  function renderUsers(groupID, userIDs) {
    const users = userIDs.map(x => App.User.FIXTURES[x - 1])

    return div([
      h3('Users'),
      p('Click on an user to display the details'),
      div([
        ul(
          users.map(user => li([
            a({
              "attrs": {"href": `/group/${groupID}/user/${user.id}`}
            }, [user.name])
          ]))
        )
      ])
    ])
  }

  function renderDetails(model) {
    return div([
      h3(`Details for ${model.name}`),
      div([
        i(`${model.details}`)
      ])
    ])
  }

  const groups = App.Group.FIXTURES
  const users = App.User.FIXTURES

  function main(sources) {

    console.log('render group', Sdom2html(renderGroups(groups)))

    const setUpSources = {
      makeLocalSources: function makeShowGroupCoreExtraSources(sources) {
        const route$ = sources.router.pluck('pathname').map(route => {
            return (route && route[0] === '/') ? route.substring(1) : route
          }
        )
        route$.subscribe(console.log.bind(console, 'route'))
        return {
          route$: route$
        }
      },
        makeLocalSettings : function (settings){
            return {sinkNames: ['DOM', 'router']}
        }
    }

    const showGroupCore = {
      makeOwnSinks: function showGroupCore(sources, settings) {
        return {
          DOM: $.of(renderGroups(groups))
        }
      }
    }

    const showUserDetails = function showUserDetails(sources, settings) {
      const userID = settings.routeParams.userId

      return {
        DOM: $.of(renderDetails(users[userID - 1]))
      }
    }

    const showUsersCore = {
      makeOwnSinks: function showUsersCore(sources, settings) {
        const groupID = settings.routeParams.groupId

        return {
          DOM: $.of(renderUsers(groupID, groups[groupID - 1].users))
        }
      }
    }

    const showGroupDetails = m(showUsersCore, {}, [
      m(Router, {route: 'user/:userId'}, [
        showUserDetails
      ])
    ])

    const page = m(setUpSources, {}, [
      m(showGroupCore, {}, [
        m(Router, {route: 'group/:groupId'}, [
          showGroupDetails
        ])
      ])
    ])

    const pageSinks = page(sources, {})

    return {
      DOM: pageSinks.DOM,
      router: $.never()
    }
  }

  // NOTE : Implements a circular flow with : main(drivers(replayS)).subscribe(replayS)
  Cycle.run(main, drivers)

})
