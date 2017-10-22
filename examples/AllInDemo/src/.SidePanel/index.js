import * as Rx from "rx";
import { ForEach } from "../../../../src/components/ForEach/ForEach"
import { ListOf } from "../../../../src/components/ListOf/ListOf"
import { InjectSources } from "../../../../src/components/Inject/InjectSources"
import {
  Div, DOM_SINK, EmptyComponent, firebaseListToArray, preventDefault
} from "../../../../src/utils"
import { always, filter, map } from 'ramda'
import { a, div, h2, img, nav, p, strong, ul } from "cycle-snabbdom"
import { m } from "../../../../src/components/m/m"
import { InSlot } from "../../../../src/components/InSlot"

const $ = Rx.Observable;

// Helpers
function renderTasksSummary({ user, projects }) {
  const openTasksCount = firebaseListToArray(projects)
    .reduce((count, project) => count + project.tasks.filter((task) => !task.done).length, 0);

  return div('.user-area', [
    div('.user-area__l-profile', [
      img({
        attrs: {
          src: user.pictureDataUri
        }
      }, [])
    ]),
    div('.user-area__l-information', [
      p('.user-area__welcome-text', `Hi ${user.name}`),
      openTasksCount
        ? p([`You got `, strong(openTasksCount), ` open tasks.`])
        : p('No open tasks. Hooray!')
    ])
  ])
}

function getProjectNavigationItems$(sources, settings) {
  return sources.projects$
    .map(filter(project => !project.deleted))
    .map(map(project => ({
      title: project.title,
      link: ['projects', project._id].join('/')
    })))
    .distinctUntilChanged()
    .tap(x => console.log(`getProjectNavigationItems$:`, x))
    // NOTE : this is a behaviour
    .shareReplay(1)
    ;
}

// Components
// Navigation(..., [NavigationSection(..., [NavigationItem(...,[])])])
function Navigation(sources, settings) {
  // NOTE : the `Div('.app__l-side')` could also be moved in the top level div below. I however
  // think it is more readable to expose the container class outside the navigation component
  // This is obviously arbitrary. On the downside, it will be less performant, and also adds an
  // extra div only because snabbdom only accepts `VNode`, not `[VNode]`, so we wrap in `div`
  const { user$, projects$ } = sources;
  const state$ = $.combineLatest(user$, projects$, (user, projects) => ({ user, projects }))

  return {
    [DOM_SINK]: state$.map(state => {
      return div('.navigation', [
        renderTasksSummary(state),
        // NOTE : nav('', {..}, []) does not work, '' is not recognized as valid selector
        nav({ slot: 'navigation-section' }, [])
      ])
    })
  }
}

function NavigationSection(sources, settings) {
  const { title } = settings;

  return {
    [DOM_SINK]: $.of(
      div('.navigation-section', { slot: 'navigation-section' }, [
        h2('.navigation-section__title', title),
        ul('.navigation-section__list', { slot: 'navigation-item' }, [])
      ])
    )
  }
}

function NavigationItem(sources, settings) {
  const { url$ } = sources;
  const { project: { title, link } } = settings;
  const linkSanitized = link.replace(/\//i, '_');

  const state$ = url$.map(url => {
    return url.indexOf(link) > -1
  });

  return {
    [DOM_SINK]: state$.map(isLinkActive => {
      const isLinkActiveClass = isLinkActive ? '.navigation-section__link--active' : '';

      return a(
        `${isLinkActiveClass}.navigation-item.navigation-section__link.${linkSanitized}`,
        { attrs: { href: link }, slot: 'navigation-item' },
        title)
    }),
    // NOTE : we avoid having to isolate by using the link which MUST be unique over the whole
    // application (unicity of a route)
    router: sources.DOM.select(`.navigation-section__link.${linkSanitized}`).events('click')
      .do(preventDefault)
      .map(always('/' + link + '/'))
  }
}

export const SidePanel =
  m({}, {}, [Div('.app__l-side'), [
    m({}, {}, [Navigation, [
      // NOTE : this is the same as having NavigatinoSection({title}, componentTree)
      // except that we do not have to define that AD-HOC combinator
      // I'd rather have for now only the GENERAL combinator as combinators
      // TODO : but maybe that's the way to go??
      m({}, { title: 'Main' }, [NavigationSection, [
        m({}, { project: { title: 'Dashboard', link: 'dashboard' } }, [NavigationItem])
      ]]),
      m({}, { title: 'Projects' }, [NavigationSection, [
        InSlot('navigation-item', [
          InjectSources({ projectNavigationItems$: getProjectNavigationItems$ }, [
            ForEach({ from: 'projectNavigationItems$', as: 'projectList' }, [
              ListOf({ list: 'projectList', as: 'project' }, [
                EmptyComponent,
                NavigationItem
              ])
            ])
          ])
        ])
      ]]),
      m({}, { title: 'Admin' }, [NavigationSection, [
        m({}, { project: { title: 'Manage Plugins', link: 'plugins' } }, [NavigationItem])
      ]]),
    ]])
  ]]);

