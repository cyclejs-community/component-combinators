import * as Rx from "rx";
import { ROUTE_SOURCE } from "./properties"
import { ForEach } from "../../../src/components/ForEach/ForEach"
import { ListOf } from "../../../src/components/ListOf/ListOf"
import { InjectSources } from "../../../src/components/Inject/InjectSources"
import { InjectSourcesAndSettings } from "../../../src/components/Inject/InjectSourcesAndSettings"
import { DOM_SINK, EmptyComponent, DummyComponent, format } from "../../../src/utils"
import { pipe, values } from 'ramda'
import { PROJECTS, USER } from "./domain/index"
import { p, div, img, nav, strong } from "cycle-snabbdom"
import { m } from "../../../src/components/m/m"
import 'user-area.scss'

// TODO : import css for each component : configure webpack! Do I need koala??

const $ = Rx.Observable;

function fbListToArray(fbList){
  // will have {key1:element, key2...}
  return values(fbList)
}

function AppContainer(sources, settings) {

  return {
    [DOM_SINK]: $.of(div('.app', []))
  }
}

function SidePanelContainer(sources, settings) {
  return {
    [DOM_SINK]: $.of(div('.app__l-side', []))
  }
}

function Nav(sources, settings) {
  return {
    [DOM_SINK]: $.of(nav([]))
  }
}

function renderTasksSummary(state) {
  const { user, projects } = state;
  const openTasksCount = fbListToArray(projects)
    .reduce((count, project) => count + project.tasks.filter((task) => !task.done).length, 0);

  return div([
    div('.user-area__l-profile', [
      img({
        attrs: {
          src: user.pictureDataUri
        }
      }, [])
    ]),
    div('.user-area__l-information', [
      p('.user-area__welcome-text', `Hi ${user.name}}}`),
      openTasksCount
        ? p([`You got `, strong(openTasksCount), ` open tasks.`])
        : p('No open tasks. Hooray!')
    ])
  ])
}

function TasksSummary(sources, settings) {
  const { user$, projects$ } = sources;
  const state$ = $.combineLatest(user$, projects$, (user, projects) => ({ user, projects }))

  return {
    [DOM_SINK]: state$.map(renderTasksSummary)
  }
}

// TODO : I am here!!
function Section(){
  return EmptyComponent()
}
function SubSection(){
  return EmptyComponent()
}

const SidePanel = m({}, {}, [SidePanelContainer, [
  TasksSummary,
  m({}, {}, [Nav, [
    Section({ title: 'Main' }, [
      SubSection({ title: 'DASHBOARD', link: '/dashboard' }, [])
    ]),
    Section({ title: 'Projects' }, [
      InjectSources({ userProjectList$: void 1 }, [
        ForEach({ from: 'userProjectList$', as: 'userProjectList' }, [
          ListOf({ list: 'userProjectList', as: 'project' }, [
//            m({ makeLocalSettings: function(){} },{}, [])//=> {title, link} = project}, {},
            // [SubSection]})*
          ])
        ])
      ])
    ]),
    Section({ title: 'Admin' }, [
      SubSection({ title: 'MANAGE PLUGINS', link: '/plugins' }, [])
    ])
  ]])
]
])

const MainPanel = DummyComponent;

const UI = [SidePanel, MainPanel];

export const App = InjectSourcesAndSettings({
  sourceFactory: function (sources, settings) {
    return {
      // router
      [ROUTE_SOURCE]: sources.router
        .map(location => {
          const route = location.pathname;
          return (route && route[0] === '/') ? route.substring(1) : route
        })
        .tap(
          x => console.debug(`App > InjectSourcesAndSettings > ${ROUTE_SOURCE} emits :`, format(x))
        )
        // starts with home route
        .startWith('')
        .share(),
      user$ : sources.domainQuery.getCurrent(USER),
      projects$: sources.domainQuery.getCurrent(PROJECTS)
    }
  },
  settings: {
    sinkNames: ['domainQuery', 'domainAction$', DOM_SINK, 'router'],
    routeSource: ROUTE_SOURCE
  }
}, [AppContainer, UI]);

