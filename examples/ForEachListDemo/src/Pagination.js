import * as Rx from "rx";
import { a, div } from 'cycle-snabbdom'
import { preventDefault } from "@rxcc/utils"
import { DOM_SINK } from "@rxcc/utils"
import { always } from 'ramda'
import { PAGE, UPDATE } from "./domain/index"

const $ = Rx.Observable;
const maxPages = 2;
const pageNumberArray = Array.apply(null, { length: maxPages }).map(Number.call, Number);

function renderPagination(activePageNumber) {

  return pageNumberArray.map(pageNumber => {
    const activeClass = activePageNumber === pageNumber
      ? '.active'
      : '';

    return a(`${activeClass}.step.step-${pageNumber}`, [
      div(".content", [pageNumber + 1])
    ])
  })
}

export function Pagination(sources, settings) {
  const { pageNumber } = settings;
  const renderedPaginationSection = renderPagination(pageNumber);
  const changePageIntents = pageNumberArray.map(pageNumber => {
    return sources[DOM_SINK].select(`a.step.step-${pageNumber}`).events('click').do(preventDefault)
      .map(always(pageNumber))
  });
  const changePageActions = changePageIntents.map((clickedPageNumber$, index) => {
    return clickedPageNumber$.map(always({
      context: PAGE,
      command: UPDATE,
      payload: {page : index}
    }))
  });

  return {
    [DOM_SINK]: $.of(
      div(".ui.steps.unstackable", renderedPaginationSection),
    ),
    domainAction$ : $.merge(changePageActions)
  }
}
