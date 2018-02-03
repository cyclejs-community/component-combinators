# multi repo
- npm registry has pretty bad error management. Put wrong registry url and all I got was cryptic 
error (registry json bla bla)
- also problem with windows and npm, downgraded npm to v5.3 and node to 8.2

# rollup
- some shitty error message (invalid token) solved by removing node_modules and reinstalling
- and having rollup in global (don't know if that played a role though)

# browserify and import/export
- be careful about syntax... specially for default export (ideal is to just never use default 
export but some third-party libraries do, so impossible to avoid it entirely)
  - for rx, `import Rx from "rx"` instead of `import * as Rx`
    - otherwise only works for webpack, not for rollup
- for cycle-snabbdom, include snabbdom-to-html, and snabbdom too
  - look at some build doc from the library
  - or look at the error message (first option is best though)
  - that means also write build doc for my own library!!
- had to configure browserify to use babelify transform in the package.json, for some reasons 
stopped working with the CLI flag --transform... Maybe a hidden change of version of something? 
Life is a mystery.

# formatting object
Be sure to have maxDepth set (I set 3), otherwise object like DOM or observable take an eternity 
to display.

# build issues
- remove node_module, force clean the npm cache (npm clean cache --force, or sth like that)
- update version (that worked for rollup uglyfy plugin)
- pray
