# build size
could be reduced by importing rx-lite instead of rx.all

# rollup build failed, now passed
`Uncaught TypeError: Cannot read property 'of' of undefined` in

```javascript
function EmptyComponent(sources, settings) {
  return {
    [DOM_SINK]: $.of(div(''))
  }
}
```

so many issues :

- for rx, `import Rx from "rx"` instead of `import * as Rx`
  - otherwise only works for webpack, not for rollup
- for cycle-snabbdom, include snabbdom-to-html, and snabbdom too
