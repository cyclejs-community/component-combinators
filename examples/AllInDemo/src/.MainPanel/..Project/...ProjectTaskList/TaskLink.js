import * as Rx from "rx";
import { a } from "cycle-snabbdom"
import { DOM_SINK } from "../../../../../../helpers/src/index"

const $ = Rx.Observable;

export function TaskLink(sources, settings) {
  const { filteredTask: { nr }, listIndex } = settings;
  // NOTE : with this router, if url is x/y then passing task/nr will give x/tasks/nr
  // NOTE : Here we show an example of nested route change, i.e. where a route is defined
  // RELATIVELY to the current route.
  const filteredTaskDetailRoute = ['task/', nr].join('');

  // NOTE : here we show an example of using the default behaviour of the `a` element, instead
  // of listening on `a` element clicks and routing manually and preventing default event processing
  // It is so much simpler. However, one must be sure that the default behaviour will always be
  // the one expected.
  return {
    [DOM_SINK]: $.of(
      a('.button.button--small', { attrs: { href: filteredTaskDetailRoute } }, 'Details')
    ),
  }
}
