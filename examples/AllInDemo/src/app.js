import * as Rx from "rx";
import { ForEach } from "../../../src/components/ForEach/ForEach"
import { ListOf } from "../../../src/components/ListOf/ListOf"
import { InjectSources } from "../../../src/components/Inject/InjectSources"
import { DOM_SINK, EmptyComponent } from "../../../src/utils"
import { CARDS, PAGE } from "./domain/index"
import { path } from 'ramda'
import { div } from "cycle-snabbdom"

const $ = Rx.Observable;

export const App = function(sources,settings) {
  return {
    [DOM_SINK] : $.of(div('dummy'))
  }
}
