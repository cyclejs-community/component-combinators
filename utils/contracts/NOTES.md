# pretty-format vs. fmt-obj for pretty formatting of javascript objects 
with rollup, this does not work because of `process` variable remaining in the `format` library 
wrongly built by rollup?:

```html
<!doctype html>
<html class="no-js" lang="">
<head>
    <meta charset="utf-8">
    <title></title>
    <script src="./lib/rxcc-debug-es5-umd-rollup.js"></script>
</head>

<body>
<!-- Add your site or application content here -->
<p>Hello world! This is HTML5 Boilerplate.</p>
<div id="app">
    <div id="appmain"></div>
</div>
<div id="feedback"></div>
<script type="text/javascript">
  console.log('checking build', rxccDebug)
</script>
</body>
</html>
```

so I switch the format library to the one used by facebook with jest: pretty-format

However that adds at least 40Kb to the rollup build!!!

# snabbdom-to-html plays bad with rollup
mistery as always (fine if debug alone, but with contract importign from debug, we have error) : 

```
[!] Error: 'default' is not exported by ..\debug\node_modules\snabbdom-to-html\index.js
https://github.com/rollup/rollup/wiki/Troubleshooting#name-is-not-exported-by-module
..\debug\src\index.js (3:7)
1: // NOTE : to avoid circular import, debug should remain without any dependency on other utils
2: import { keys, mapObjIndexed, pipe, tap } from "ramda"
3: import toHTML from "snabbdom-to-html"
```
