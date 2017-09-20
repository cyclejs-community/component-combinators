
# Motivation
We want in this section to describe the default merge function used by the `m` component factory, when no such merge function is supplied by the user.

## DOM merge
The `DOM` merge function relating to `m :: ComponentDef -> Settings -> [ParentComponent, Array<ChildComponent>])` has the following signature : `DOMDefaultMerge :: Nullable<ParentDOMSink>, Array<DOMSink>, Settings`, where :

- `ParentDOMSink` encapsulates the DOM produced by `ParentComponent`
- `Array<DOMSink>` encapsulates the DOM produced by the children`Array<ChildComponent>`
- `Settings` follows the usual inheritance rules of settings through the component tree

If the user does not supply a merge function through the `ComponentDef` parameter, the default one is used. The default merge function by default append the DOM trees produced by the children at the end of the parent DOM tree. This behaviour can however be altered if the parent component explicitly makes use of named slots. We proceed with describing those two cases.

### Regular DOM merge
Let's consider `m({}, {}, [ParentComponent, [SiblingComponent1, SiblingComponent2]` with the following DOMs being produced :

- component's DOM
```html
<div id='#parent'>
  <h2> This is some content included in the parent component's DOM </h2>
</div>
```

- SiblingComponent1
```html
<div id='#sibling1'>
  <span> first sibling component's DOM </span>
</div>
```

- SiblingComponent2
```html
<div id='#sibling2'>
  <span> second sibling component's DOM </span>
</div>
```

The merged result will be similar to :
```html
<div id='#parent'>
  <h2> This is some content included in the parent component's DOM </h2>
	<div id='#sibling1'>
	  <span> first sibling component's DOM </span>
	</div>
	<div id='#sibling2'>
	  <span> second sibling component's DOM </span>
	</div>
</div>
```

** NOTE ** : for the edge case when the parent component does not have a selector for the children to be included within (for instance if it is a text node), a dummy `div` selector is created, whose first children is the text node, and next children are the children DOM trees. For more details look at the tests.

### Slotted DOM merge
The slotted DOM merge is a powerful, albeit complex functionality which allows to build the parent DOM from the children DOM according to a redistribution logic specified by a slot mechanism similar to the one used for `Web Components`.

Let's assume :

1. parent component DOM
```html
<div class="element-details-template">
  <style>
  details {font-family: "Open Sans Light",Helvetica,Arial}
  .name {font-weight: bold; color: #217ac0; font-size: 120%}
  h4 { margin: 10px 0 -8px 0; }
  h4 span { background: #217ac0; padding: 2px 6px 2px 6px }
  h4 span { border: 1px solid #cee9f9; border-radius: 4px }
  h4 span { color: white }
  .attributes { margin-left: 22px; font-size: 90% }
  .attributes p { margin-left: 16px; font-style: italic }
  </style>
  <div class=".element-details">
    <div class=".element-details__summary">
      <span>
        <code class="name">&lt;<slot name="element-name">NEED NAME</slot>&gt;</code>
        <i class="desc"><slot name="description">NEED DESCRIPTION</slot></i>
      </span>
    </div>
    <div class="attributes">
      <h4><span>Attributes</span></h4>
      <slot name="attributes"><p>None</p></slot>
    </div>
  </div>
  <hr>
</div>
```

That parent DOM has several features:

- it has a `<style>` element with a set of CSS styles that are scoped just to the document fragment.
- it uses `<slot>` and its name attribute to make three named slots:
  - `<slot name="element-name">`
  - `<slot name="description">`
  - `<slot name="attributes">`
- the named slots are wrapped within regular HTML elements.

Let's consider now the slot contents :

 2. child with slot `element-name`
 
 ```html
 <span slot="element-name">slot</span>
 ```

 3. child with slot `description`

```html
<span slot="description">A placeholder inside a web
    component that users can fill with their own markup,
    with the effect of composing different DOM trees
    together.</span>
```

4. child with slot `attributes`

```html
<dl slot="attributes">
    <dt>name</dt>
    <dd>The name of the slot.</dd>
</dl>
```

The merged DOM should hence be :

```html
<div class="element-details-template">
  <style>
  .element-details {font-family: "Open Sans Light",Helvetica,Arial}
  .name {font-weight: bold; color: #217ac0; font-size: 120%}
  h4 { margin: 10px 0 -8px 0; }
  h4 span { background: #217ac0; padding: 2px 6px 2px 6px }
  h4 span { border: 1px solid #cee9f9; border-radius: 4px }
  h4 span { color: white }
  .attributes { margin-left: 22px; font-size: 90% }
  .attributes p { margin-left: 16px; font-style: italic }
  </style>
  <div class=".element-details">
    <div class=".element-details__summary">
      <span>
        <code class="name">&lt;
           <span slot="element-name">slot</span>
        </code>
        <i class="desc">
          <span slot="description">A placeholder inside a web
    component that users can fill with their own markup,
    with the effect of composing different DOM trees
    together.</span>
        </i>
      </span>
    </div>
    <div class="attributes">
      <h4><span>Attributes</span></h4>
      <dl slot="attributes">
        <dt>name</dt>
        <dd>The name of the slot.</dd>
      </dl>
    </div>
  </div>
  <hr>
</div>
```

In short, the general case is that the parent defines some slots by name, and replace those slots by the corresponding DOM slots found in the children DOM's. In this example, all slots are filled, as they can all be found in the children DOMs. 

When a slot cannot be filled in by a corresponding children DOM (the children DOM simply does not define content for that slot), the slotted content of the parent is used as default. The following describes that behaviour, with the same parent component, but this time children component which will not define content for the `attributes` slot.

 2. child with slot `element-name`
 
 ```html
 <span slot="element-name">template</span>
 ```

 3. child with slot `description`

```html
<span slot="description">A mechanism for holding client-
    side content that is not to be rendered when a page is
    loaded but may subsequently be instantiated during
    runtime using JavaScript.</span>
```

In that case, the merged DOM should be :

```html
<div class="element-details-template">
  <style>
  .element-details {font-family: "Open Sans Light",Helvetica,Arial}
  .name {font-weight: bold; color: #217ac0; font-size: 120%}
  h4 { margin: 10px 0 -8px 0; }
  h4 span { background: #217ac0; padding: 2px 6px 2px 6px }
  h4 span { border: 1px solid #cee9f9; border-radius: 4px }
  h4 span { color: white }
  .attributes { margin-left: 22px; font-size: 90% }
  .attributes p { margin-left: 16px; font-style: italic }
  </style>
  <div class=".element-details">
    <div class=".element-details__summary">
      <span>
        <code class="name">&lt;
           <span slot="element-name">template</span>
        </code>
        <i class="desc">
          <span slot="description">A mechanism for holding client-
    side content that is not to be rendered when a page is
    loaded but may subsequently be instantiated during
    runtime using JavaScript.</span>
        </i>
      </span>
    </div>
    <div class="attributes">
      <h4><span>Attributes</span></h4>
      <slot name="attributes"><p>None</p></slot>
    </div>
  </div>
  <hr>
</div>
```

### Rules
- in the parent component's DOM, slots can be repeated. For example, this is a valid proposition :
```html
<fancy-tabs>
  <button slot="title">Title</button>
  <button slot="title" selected>Title 2</button>
  <button slot="title">Title 3</button>
  <section>content panel 1</section>
  <section>content panel 2</section>
  <section>content panel 3</section>
</fancy-tabs>

<!-- Using <h2>'s and changing the ordering would also work! -->
<fancy-tabs>
  <h2 slot="title">Title</h2>
  <section>content panel 1</section>
  <h2 slot="title" selected>Title 2</h2>
  <section>content panel 2</section>
  <h2 slot="title">Title 3</h2>
  <section>content panel 3</section>
</fancy-tabs>
```

where the `fancy-tabs` parent component is defined as :

```html
<div id="tabs">
   <slot id="tabsSlot" name="title"></slot>
</div>
<div id="panels">
   <slot id="panelsSlot"></slot>
</div>
```

In such a case, the children DOM's are appended one after the other. The corresponding merge DOM would then be :

```html
    <div id="tabs">
      <slot id="tabsSlot" name="title">
        <button slot="title">Title</button>
        <button slot="title" selected>Title 2</button>
        <button slot="title">Title 3</button>
      </slot>
    </div>
    <div id="panels">
      <slot id="panelsSlot">
        <section>content panel 1</section>
        <section>content panel 2</section>
        <section>content panel 3</section>
      </slot>
    </div>
```
- an <q>unnamed</q> slot can be used to enclose the children DOMs which are not assigned a slot

See same previous example as a demo of this (`<slot id="panelsSlot">`). Note that using this feature disable the standard DOM merge mechanism described previously.

- Children DOM contents which are not assigned to any slot (including the unnamed slot) are merged into the parent's DOM using the mechanism described in the `standard merge` section.

- If there's more than one unnamed or named slots, the corresponding children content will be replicated in all corresponding slots.
	- this is a difference with the web component slot mechanism where if there's more than one default slot, the first is used.

### vTree transcription
In a `vNode` context, `<slot name="element-name">NEED NAME</slot>` would correspond to `{children : [none], sel:'div', data : {slot : 'attributes'}}`, where `none` is the `vNode` corresponding to `<p>None</p>`.


### Edge cases
cf. tests

# References :

- [Shadow DOM v1: Self-Contained Web Components](https://developers.google.com/web/fundamentals/architecture/building-components/shadowdom)
- [`<slot>` MDN](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/slot)
