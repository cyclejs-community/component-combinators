import * as Rx from "rx";
import { Div, DOM_SINK, preventDefault } from "../../../../src/utils"
import { a, p, div, img, nav, strong, h2, ul, li, button, input, label, span } from  "cycle-snabbdom"
import {defaultTo, always} from 'ramda'
import { InjectSources } from "../../../../src/components/Inject/InjectSources"
import { TASKS, UPDATE_TASK_DESCRIPTION } from "../domain/index"

const $ = Rx.Observable;

const editableContentElementSelector = `.editableContentElement`;
const saveButtonSelector = ".editor__icon-save";
const cancelButtonSelector = ".editor__icon-cancel";
const editButtonSelector = ".editor__icon-edit";
const editorEditModeSelector = editMode => editMode ? `.editor--edit-mode` : '';

function getTextContent(document, selector){
  // NOTE : the selector is for a div
  return document.querySelector(selector).textContent || ''
}

function Editor_(sources, settings) {
  const {[DOM_SINK]:DOM, document} = sources;
  const {
    editor: { showControls, enableTags, initialEditMode, initialContent }
  } = settings;

  const showControlAndEditModeVTree =
    div(".editor__controls", [
      button(".editor__icon-save"),
      button(".editor__icon-cancel")
    ]);
  const showControlAndNotEditModeVTree =
    div(".editor__controls", [
      button(".editor__icon-edit")
    ]);
  const showControlVTree = editMode => showControls && editMode
    ? showControlAndEditModeVTree
    : showControls && !editMode
      ? showControlAndNotEditModeVTree
      : undefined

  // NOTE : shared defensively because they are events (only save$ is mandatory to be shared)
  const events = {
    edit$ : DOM.select(editButtonSelector).events('click').do(preventDefault).share(),
    save$ :DOM.select(saveButtonSelector).events('click').do(preventDefault).share(),
    cancel$ : DOM.select(cancelButtonSelector).events('click').do(preventDefault).share()
  };

  const initialState = {
    textContent : initialContent,
    editMode : initialEditMode
  };
  const state$ = $.merge(
    events.edit$.map(always({editMode: true})),
    events.save$.map(always({editMode: false, textContent : getTextContent(document, editableContentElementSelector)})),
    events.cancel$.map(always({editMode: false}))
  ).scan((acc, stateUpdate) => merge(acc, stateUpdate), initialState)
    .startWith(initialState);

  return {
    [DOM_SINK]: state$.map(({editMode, textContent}) => (
      div(`.editor${editorEditModeSelector(editMode)}`, [
        div(`${editableContentElementSelector}.editor__editable-content`, {
          attrs: { contenteditable: "true" }
        }),
        div('.editor__output', textContent),
        showControlVTree(editMode) // TODO :check that undefined value are accepted in the array
      ])
    )),
    save$ : events.save$,
  }
}

export const Editor = m({},{}, [ Editor_ ]);

// editor state : { editMode, textContent} starting with settings {editMode default false; content
// from task$ or whatever the name}

//

