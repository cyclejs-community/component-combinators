import * as Rx from "rx";
import { ForEach } from "../../../src/components/ForEach/ForEach"
import { ListOf } from "../../../src/components/ListOf/ListOf"
import { InjectSources } from "../../../src/components/Inject/InjectSources"
import { DOM_SINK, EmptyComponent } from "../../../src/utils"
import { AspirationalPageHeader } from "./AspirationalPageHeader"
import { Card } from "./Card"
import { CARDS, PAGE } from "./domain/index"
import { Pagination } from "./Pagination"
import { path } from 'ramda'

const $ = Rx.Observable;

function fetchCardsInfo(sources, settings) {
  return fetchPageNumber(sources, settings)
    .flatMapLatest(page => sources.domainQuery.getCurrent(CARDS, { page }))
    // NOTE : this is a behaviour
    .shareReplay(1)
    .tap(x => console.debug(`fetchCardsInfo > domainQuery > CARDS :`, x))
}

function fetchPageNumber(sources, settings) {
  return sources.domainQuery.getCurrent(PAGE)
  // NOTE : building a live query by fetching the current page number and adding page number
  // change notifications resulting from actions affecting the page
    .concat(sources.domainAction$.getResponse(PAGE).map(path(['response', 'page'])))
    // NOTE : this is a behaviour
    .shareReplay(1)
    .tap(x => console.debug(`fetchPageNumber > domainQuery > PAGE :`, x))
}

export const App = InjectSources({
  fetchedCardsInfo$: fetchCardsInfo,
  fetchedPageNumber$: fetchPageNumber
}, [
  ForEach({
      from: 'fetchedCardsInfo$',
      as: 'items',
      sinkNames: [DOM_SINK],
      trace: 'ForEach card'
    }, [AspirationalPageHeader, [
      ListOf({ list: 'items', as: 'cardInfo', trace: 'ForEach card > ListOf' }, [
        EmptyComponent,
        Card,
      ])
    ]]
  ),
  ForEach({
    from: 'fetchedPageNumber$',
    as: 'pageNumber',
    sinkNames: [DOM_SINK, 'domainAction$']
  }, [
    Pagination
  ])
]);

// TODO : all : think about work around for isolation, components need to pass their click free of
// concerns
// TODO : m : write a better doc to explain settings inheritance, and put in the docs not in te code
// TODO : m : design better trace information
// for instance outer trace could be concatenated to inner trace to trace also the
// component hierarchy
// TODO : m : also add slot mechanism to default DOM merge to include child component at given
// position of parent : PUT THE SLOT IN VNODE DATA property
//       necessary to add a `currentPath` parameter somewhere which
//       carries the current path down the tree
// TODO : all components : replace singular treatment for DOM into behaviourSinkNames, sinkNames
// - all behaviourSinkNames must give a zero value (for DOM : $.of(null)
// - but really find a non-DOM example and investigate, it is not so simple
// NTH : Router : route params property name could be configured in settings, to think about
// TODO : FSM : a bunch of them pending
