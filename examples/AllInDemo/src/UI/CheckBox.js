import * as Rx from "rx";
import { assertContract } from "../../../../utils/contracts/src/index"
import { DOM_SINK } from "../../../../utils/helpers/src/index"
import { format } from "../../../../utils/debug/src/index"
import { div, input, label, span } from "cycle-snabbdom"
import { defaultTo } from 'ramda'

const $ = Rx.Observable;

const defaultNamespace = 'check-box';
let counter = 0;

const labelSelector = ".checkbox__label";
const inputSelector = ".checkbox__input";
const checkBoxTextSelector = ".checkbox__text";

function isCheckBoxSettings(settings) {
  return 'label' in settings
    //  && 'namespace' in settings // optional
    && 'isChecked' in settings
}

export function CheckBox(sources, settings) {
  const { checkBox: { label: _label, namespace, isChecked } } = settings;
  const checkBoxSelector = '.' + [defaultTo(defaultNamespace, namespace), ++counter].join('-');
  const __label = defaultTo('', _label);

  assertContract(isCheckBoxSettings, [settings.checkBox], `CheckBox : Invalid check box settings! : ${format(settings.checkBox)}`)

  const events = {
    'change': sources[DOM_SINK].select(checkBoxSelector).events('change')
      .map(ev => ev.target.checked)
  };

  return {
    [DOM_SINK]: $.of(div('.checkbox', [
      label(labelSelector, [
        input([inputSelector, checkBoxSelector].join(''), {
          "attrs": {
            "type": "checkbox",
            "checked": isChecked,
          }
        }),
        // NOTE : !! snabbdom overload selection algorithm fails if last input is undefined
        span(checkBoxTextSelector, __label)
      ])
    ])),
    isChecked$: events.change
  }
}


