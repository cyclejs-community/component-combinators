// NOTE : from https://github.com/r7kamura/cycle-history-driver/releases/tag/v0.0.2
import * as Rx from "rx";

const historyRecord$ = new Rx.Subject();
window.onpopstate = (event) => {
  historyRecord$.onNext(event);
};

export function makeHistoryDriver() {
  return (history$) => {
    history$.subscribe(({ state = {}, title = '', url }) => {
      window.history.pushState(state, title, url);
    });
    return historyRecord$;
  };
}
