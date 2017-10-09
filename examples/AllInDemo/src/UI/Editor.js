import * as Rx from "rx";
import { Div, DOM_SINK, preventDefault } from "../../../../src/utils"
import { a, p, div, img, nav, strong, h2, ul, li, button, input, label, span } from  "cycle-snabbdom"
import {merge, defaultTo, always} from 'ramda'
import { m } from "../../../../src/components/m/m"

const $ = Rx.Observable;
let counter = 0;

const defaultNamespace = 'editor';
const editableContentElementSelector = editorSelector => editorSelector + `.editableContentElement`;
const saveButtonSelector = editorSelector => editorSelector + ".editor__icon-save";
const cancelButtonSelector = editorSelector => editorSelector + ".editor__icon-cancel";
const editButtonSelector = editorSelector => editorSelector + ".editor__icon-edit";
const editorEditModeSelector = (editMode, editorSelector) => editMode ? editorSelector + `.editor--edit-mode` : editorSelector ;
const editorOutputSelector = editorSelector => editorSelector + '.editor__output';

function getTextContent(document, selector){
  // NOTE : the selector is for a div
  return document.querySelector(selector).textContent || ''
}

// TODO : two bugs
// - no focus when click edit icon
// - no content when click edit icon
//  - review carefully angular2 application - not two elements visible at the same time
// editor_output and editable element!! how?? also maybe focus does not work because I focus on
// the wrong element
//  - also all icons shows - probably issue with selector not specific enough!! add index or
// namepsace
function Editor_(sources, settings) {
  const {[DOM_SINK]:DOM, document} = sources;
  const {
    editor: { showControls, enableTags, initialEditMode, initialContent, namespace }
  } = settings;
  const editorSelector =  namespace
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
    edit$ : DOM.select(editButtonSelector(editorSelector)).events('click').do(preventDefault).share(),
    save$ :DOM.select(saveButtonSelector(editorSelector)).events('click').do(preventDefault).share(),
    cancel$ : DOM.select(cancelButtonSelector(editorSelector)).events('click').do(preventDefault).share()
  };

  const initialState = {
    textContent : initialContent,
    editMode : initialEditMode
  };
  const state$ = $.merge(
    events.edit$.map(_ => ({
      editMode: true, editableTextContent : getTextContent(document, editorOutputSelector(editorSelector))
    }      )),
    events.save$.map(_ => ({
      editMode: false, textContent : getTextContent(document, editableContentElementSelector(editorSelector)),
      editableTextContent : ''
    }      )),
    events.cancel$.map(always({editMode: false, editableTextContent:''}))
  ).scan((acc, stateUpdate) => merge(acc, stateUpdate), initialState)
    .startWith(initialState);

  return {
    [DOM_SINK]: state$.map(({editMode, textContent, editableTextContent}) => (
      div(`${editorEditModeSelector(editMode, editorSelector)}.editor`, [
        div(`${editableContentElementSelector(editorSelector)}.editor__editable-content`, {
          props: {textContent : editableTextContent},
          attrs: { contenteditable: "true" }
        }),
        div(`${editorOutputSelector(editorSelector)}`, textContent),
        showControlVTree(editMode)
      ])
    )),
    save$ : events.save$,
    focus : state$.map(({editMode, textContent}) => {
      return editMode
        ? {selector : editorEditModeSelector(editMode, editorSelector)}
        : $.empty()
    })
      .switch()
  }
}

export const Editor = m({},{}, [ Editor_ ]);

