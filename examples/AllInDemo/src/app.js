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

export const App = ...; // TODO
