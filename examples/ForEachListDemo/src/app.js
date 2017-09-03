import * as Rx from "rx";
import { ForEach } from "../../../src/components/ForEach/ForEach"
import { ListOf } from "../../../src/components/ListOf/ListOf"
import { m } from "../../../src/components/m"
import { InjectSources } from "../../../src/components/Inject/InjectSources"
import { DOM_SINK, EmptyComponent } from "../../../src/utils"
import { AspirationalPageHeader } from "./AspirationalPageHeader"
import { Card } from "./Card"
import { CARDS, PAGE } from "./domain/index"
import { Pagination } from "./Pagination"
import {prop, path} from 'ramda'

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
  }, [
    m({ makeOwnSinks: AspirationalPageHeader }, { trace: 'm AspirationalPageHeader' }, [
      ListOf({ list: 'items', as: 'cardInfo', trace: 'ForEach card > ListOf' }, [
        EmptyComponent,
        Card,
      ])
    ])
  ]),
  ForEach({
    from: 'fetchedPageNumber$',
    as: 'pageNumber',
    sinkNames: [DOM_SINK, 'domainAction$']
  }, [
    Pagination
  ])
])


// TODO : TAKE THIS ACTION DRIVER and put it out as a driver to be published (with the
// setTimeout modif)
// TODO : write the domain driver so I can get live query a la firebase
// TODO : write doc for domain driver also when finished
// TODO : see m.js TODO
