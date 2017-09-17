import * as Rx from "rx";
import { ROUTE_SOURCE } from "./properties"
import { ForEach } from "../../../src/components/ForEach/ForEach"
import { ListOf } from "../../../src/components/ListOf/ListOf"
import { InjectSources } from "../../../src/components/Inject/InjectSources"
import { InjectSourcesAndSettings } from "../../../src/components/Inject/InjectSourcesAndSettings"
import { DOM_SINK, EmptyComponent, DummyComponent, format } from "../../../src/utils"
import { pipe, values } from 'ramda'
import { PROJECTS, USER } from "./domain/index"
import { p, div, img, nav, strong, h2, ul, li } from "cycle-snabbdom"
import { m } from "../../../src/components/m/m"
import 'user-area.scss'

const $ = Rx.Observable;

function fbListToArray(fbList){
  // will have {key1:element, key2...}
  return values(fbList)
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

function NavContainer(sources, settings) {
  return {
    [DOM_SINK]: $.of(nav([]))
  }
}

// TODO : I am here!!
function SectionTitle(sources, settings){
  const {title} = settings;

  return {
    [DOM_SINK] : $.of(h2('.navigation-section__title', title))
  }
}
function NavSectionContainer(sources, settings){
  return {
    [DOM_SINK] : $.of(ul('.navigation-section__list',[]))
  }
}

function Section(settings, childrenComponents){
  // TODO : add a contract that this is a childrenComponent not a componentTree!!
  // TODO : express this with the slot mechanism somehow
  return m({}, settings, [
    SectionTitle,
    m({},{}, [NavSectionContainer, [childrenComponents]])
  ])


  // TODO : change the default DOM merge to include slot
  // - children to include, has data.slot set to the string slot
  // - parent in [parent,[children]] has :
  //   - holes with empty vnode except data slot set to the slot
  //   - example : {children:null, sel:null, data: {slot : SLOT}}
  //   - gather all vNodes = parentVNode, childrenVNodes
  //   - all children vNode MUST have their first data at top level slot set
  //   - given that, run through the children and merge within the parent
  //   - if children vNode no slot, then merge like now, within the parent, as the last child
  // Then I would write Section as
  // m({}, {}, [NavSectionContainer, [childrenComponents])
  // where childrenComponents are slotted, and NavSectionContainer is slot-holed

  /*
    <h2 class="navigation-section__title">{{title}}</h2>
  <ul class="navigation-section__list">
    <ng-content select="ngc-navigation-item"></ng-content>
  <ngc-navigation-item *ngFor="let item of items"
    [title]="item.title"
    [link]="item.link"></ngc-navigation-item>
    </ul>
*/

}

function SubSection(){
  return EmptyComponent()
}

function SidePanelContainer(sources, settings) {
  return {
    [DOM_SINK]: $.of(div('.app__l-side', []))
  }
}

export const SidePanel = m({}, {}, [SidePanelContainer, [
  TasksSummary,
  m({}, {}, [NavContainer, [
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

