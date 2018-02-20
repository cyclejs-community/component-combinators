import * as Rx from "rx";
import { Combine, InSlot } from "@rxcc/components"
import { DOM_SINK } from "@rxcc/utils"
import { div } from "cycle-snabbdom"
import { Header } from './Header'
import { Feature } from './Feature'
import { Footer} from './Footer'

const $ = Rx.Observable;

export const App = Combine({}, [LayoutContainer, [
  InSlot('body', [Feature]),
  InSlot('header', [Header]),
  InSlot('footer', [Footer]),
]]);

function LayoutContainer(sources, settings) {
  return {
    [DOM_SINK]: $.of(div([
      div(".ui.fixed.inverted.menu", { "slot": "header", }, []),
      div(".ui.main.text.container", { "slot": "body", }, []),
      div(".ui.inverted.vertical.footer.segment", { "slot": "footer", }, []),
    ]))
  }
}
