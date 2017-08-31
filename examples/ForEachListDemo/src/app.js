import { ForEach } from "../../../src/components/ForEach/ForEach"
import { ListOf } from "../../../src/components/ListOf/ListOf"
import { DOM_SINK, EmptyComponent } from "../../../src/utils"
import { Card } from "./Card"
import { AspirationalPageHeader } from "./AspirationalPageHeader"
import * as Rx from "rx";
import { div } from 'cycle-snabbdom'
import { InjectSources } from "../../../src/components/Inject/InjectSourcesAndSettings"

const $ = Rx.Observable;
const maxPages = 3;

function fetchCardsInfo (sources, settings){

}

function fetchPageNumber (sources, settings){

}

export const App = InjectSources({
  fetchedCardsInfo$: fetchCardsInfo,
  fetchedPageNumber$: fetchPageNumber
}, [
  ForEach({ from: 'fetchedCardsInfo$', as: 'items' }, [
    m({ makeOwnSinks: AspirationalPageHeader }, { trace: 'AspirationalPageHeader' }, [
      ListOf({ list: 'items', as: 'cardInfo' }, [
        EmptyComponent,
        Card,
      ])
    ])
  ]),
  ForEach({ from: 'fetchedPageNumber$', as: 'pageNumber' }, [
    Pagination
  ])
])

function renderPagination(activePageNumber) {
  const pageNumberArray = Array.apply(null, { length: maxPages }).map(Number.call, Number);

  return pageNumberArray.map(pageNumber => {
    const activeClass = activePageNumber === pageNumber
      ? 'active'
      : '';

    return div(`${activeClass}.step`, [
      div(".content", [`1`])
    ])
  })
}

function Pagination(sources, settings) {
  const { pageNumber } = settings;

  return {
    [DOM_SINK]: $.of(
      div(".ui.steps", [
          renderPagination(pageNumber)
        ]
      ),
    )
  }
}


// TODO : write before Pagination as a ForEach on the corresponding domain.query source
// TODO : add domain driver
// TODO : add logic to on click from page write page number in local storage (domain)
// TODO : get that number in Pagination and set active for the appropriate step
// TODO : write fetchedCardsInfo$ as getting the number, and getting from local storage (domain)
// the card [data]
