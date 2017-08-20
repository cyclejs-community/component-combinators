apparently too many connections to switch source leads to bug, so idea is to do with only one pass

```
Switch({on : switchSource}, [
  Case({when : value1}, [Child1])
  Case({when : value2}, [Child2])
])
```

  Case({when : value1}, [Child1]) = function(sources, settings) {
  const switchedAndMergedSinks = 
    switchSource
      .filter(equals(when))
      // execute children components and merge them
      .map(match => {
        // match is not relevant, it is equal to when by construction
        // should merge some Case settings in that m (in case Case specifies sth for merging children sinks)
        const sinks = m({??}, {??}, childrenComponents)(sources, settings)
        const muxedSinks$ = mux(sinks)
      })
      .switch()
      .share()
      ;
  // get the sinks back
  return demux(sinkNames, switchedAndMergedSinks)
  }

function mux(sinks) {
  return $.mergeAll(map(sinkName => {
    const sink$ = sinks[sinkName];
    return sink$.prefixWith(sinkName)
  }, keys(sinks)))
}

function demux(sinkNames, muxedSinks) {
  return sinkNames.map(sinkName => {
    return muxedSinks.filter(isPrefixedWith(sinkName)
  })
}
