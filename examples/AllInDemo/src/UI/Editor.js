import * as Rx from "rx";
import { DOM_SINK, preventDefault } from "@rxcc/utils"
import { button, div } from "cycle-snabbdom"
import { always, merge } from 'ramda'

const $ = Rx.Observable;
let counter = 0;

const strcat = x => y => "" + x + y;
const defaultNamespace = 'editor';
const editorEditableContentSelector = strcat('.editor__editable-content');
const saveButtonSelector = strcat(".editor__icon-save");
const cancelButtonSelector = strcat(".editor__icon-cancel");
const editButtonSelector = strcat(".editor__icon-edit");
const editorEditModeSelector = (editMode,
                                editorSelector) => editMode ? editorSelector + `.editor--edit-mode` : editorSelector;
const editorOutputSelector = strcat('.editor__output');

function getTextContent(document, selector) {
  // NOTE : the selector is for a div
  return document.querySelector(selector).textContent || ''
}

// TODO : disable task title when task is checked as done !!
function Editor_(sources, settings) {
  const { [DOM_SINK]: DOM, document } = sources;
  const {
    editor: { showControls, enableTags, initialEditMode, initialContent, namespace }
  } = settings;
  const editorSelector = namespace
    ? ['', [defaultNamespace, ++counter].join('-'), namespace].join('.')
    : ['', [defaultNamespace, ++counter].join('-')].join('.')
  ;

  const showControlAndEditModeVTree =
    div(".editor__controls", [
      button(`${editorSelector}.editor__icon-save`),
      button(`${editorSelector}.editor__icon-cancel`)
    ]);
  const showControlAndNotEditModeVTree =
    div(".editor__controls", [
      button(`${editorSelector}.editor__icon-edit`)
    ]);
  const showControlVTree = editMode => showControls && editMode
    ? showControlAndEditModeVTree
    : showControls && !editMode
      ? showControlAndNotEditModeVTree
      : undefined

  // NOTE : shared defensively because they are events (only save$ is mandatory to be shared)
  const events = {
    edit$: DOM.select(editButtonSelector(editorSelector)).events('click').do(preventDefault)
      .map(_ => ({
        editMode: true,
        editableTextContent: getTextContent(document, editorOutputSelector(editorSelector))
      }))
      .share(),
    save$: DOM.select(saveButtonSelector(editorSelector)).events('click').do(preventDefault)
      .map(_ => ({
        editMode: false,
        textContent: getTextContent(document, editorEditableContentSelector(editorSelector)),
        editableTextContent: ''
      }))
      .share(),
    cancel$: DOM.select(cancelButtonSelector(editorSelector)).events('click').do(preventDefault)
      .map(always({ editMode: false, editableTextContent: '' }))
      .share()
  };

  const initialState = {
    textContent: initialContent,
    editMode: initialEditMode
  };
  const state$ = $.merge(
    events.edit$,
    events.save$,
    events.cancel$
  ).scan((acc, stateUpdate) => merge(acc, stateUpdate), initialState)
    .startWith(initialState);

  return {
    [DOM_SINK]: state$.map(({ editMode, textContent, editableTextContent }) => (
      div(`${editorEditModeSelector(editMode, editorSelector)}.editor`, [
        div(`${editorEditableContentSelector(editorSelector)}`, {
          props: { textContent: editableTextContent },
          attrs: { contenteditable: "true" }
        }),
        div(`${editorOutputSelector(editorSelector)}`, textContent),
        showControlVTree(editMode)
      ])
    )),
    save$: events.save$,
    focus: state$.skip(1)
      .filter(({ editMode }) => Boolean(editMode))
      .map(({ editMode, textContent }) => {
        return editMode
          // !! NOTE : have to delay here because focus driver executes before the DOM driver, so
          // the element cannot be focused on as it is not displayed yet
          ? $.of({ selector: editorEditableContentSelector(editorSelector) }).delay(0)
          : $.empty()
      })
      .switch()
  }
}

export const Editor = Editor_
