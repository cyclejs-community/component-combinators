Display an editable field, allows to edit it, and send the result when enter is pressed
Cf. <ngc-editor [content]="task?.title"
                    [showControls]="true"
                    (editSaved)="onTitleSaved($event)"></ngc-editor>

Editor({content, enableTags, showControls, editMode, tagInputManager}, [
  TaskTitleContainer, [no children is possible, the edited field goes inside on the container
]])

- can use a state machine for its implementation, but the simple one (hence no need for keeping state externally).
  - States : 
    - EDITABLE, 
    - NON-EDITABLE
  - Events : SAVE, CANCEL, EDIT
  - Transitions : 
    - EDITABLE : can click SAVE, CANCEL
      - transition to state NON-EDITABLE
    - NON-EDITABLE : can click EDIT
      - transition to state EDITABLE

- passes editSaved, editableInput to outside

- we will exclude the tags mechanism in our implementation
