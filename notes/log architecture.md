# Motivation
We previously presented a componentization model for cyclejs, which isolate the glueing of 
components into component combinators, from the application logic. We showed through 
miscellaneous examples that our component model is close in its syntax from React's component 
model, and is amenable to further syntactic sugaring (DSL, JSX, etc). The end result is an 
application logic which is more readable (i.e. easy to understand and reason about), more 
writable (i.e. easy to form a mental model and translate it into code). 

The present effort focus on maintanability aspects linked to the chosen architecture. 
Maintainability is the ease by which a program can be altered to cope with **reason for changes** 
(in environment, specifications, etc.), and **defects** (bugs, poor performance, etc.). 

Specifically, we are focusing here on adding capabilities in the program which allow to trace 
and debug a reactive system built with the chosen architecture.

# How it works
We have :

- `run :: App -> Drivers -> Record {Sources, Sinks}`
- `App :: Component`
- `Drivers :: HashMap<DriverName, Driver>`
- `Driver :: Sink -> Source`
 
We use a `traceRun` function which will take the `run` function as parameter, and add the tracing
 aspect to it. This is done by adding a `sources.traceInputs` and `sources.traceOutputs` 
 dependencies into the `sources` parameter. 
 Those `trace` dependencies know how to trace inputs and outputs from any source or sink.

- `traceRun :: TraceFns -> Runnable -> TracedRunnable`
- `traceRun :: TraceFns -> Runnable -> App -> Drivers -> Record {Sources, Sinks}`
- `TraceFns :: HashMap<DriverName, TraceFn>`

In `m`, I can only trace the sources, not the stuff derived from the sources cause I dont know 
what they are, so no way to attach an input to a component, except time precedence and same 
context (same app/process/session/window)

But I can emit a log for each input by intervening the `sources.source`. Just I won't know where 
in the component tree that input is being read.

Unless I trace every sources in `m` before passing it ?? could be

# Injection of traceInputs and traceSinks
Note that in cycle, drivers are called first with subjects. Then app with drivers sinks as source

- `traceRun :: TraceSpecs -> Runnable -> TracedRunnable`
- `traceRun :: TraceSpecs -> Runnable -> App -> Drivers -> Record {Sources, Sinks}`
- `TraceSpecs :: HashMap<DriverName, TraceFn>`

## Code
const traceSpecs = {
  DriverName : traceFn,
  default? // will be necessary because of Pipe for instance...
}
const tracedRun = traceRun(traceSpecs, run);
const {tracedSources, tracedSinks} = tracedRun(App, Drivers);

function traceRun (traceSpecs, run) {
  const driverNames = keys(traceSpecs);
  
  return function tracedRun(app, drivers) {
    // weave the trace aspect in the run function
    // NOTE : could be wrote with a AOP library : this is output transformation
    function tracedApp (sources, settings){
      // trace the inputs at top level : not super useful but done for full tracability
      const tracedSources = driverNames.reduce((acc, driverName) => {
      // TODO : guard against edge case (read or write only drivers)
        acc[driverName] = apply(traceSpecs[driverName].tracedInputs, topLevelTrace, sources[driverName]);
        return acc
      }, {});
      // TO WRITE, should be about the same as previous line, so refactor later
      tracedSources.traceInputs = ... take all sources and add before advice
      tracedSources.traceSinks = ... take all sinks (should be easier, only observable)
      tracedSources.getId = ... closure to give unique id (incremental number)
      
      const tracedSettings = settings;

      return app(tracedSources, tracedSettings)
    }
    
    // trace the input of the drivers i.e. the sinks
    // basically advice on input of driver
    const tracedDrivers = driverNames.reduce((acc, driverName) => {
      acc[driverName] = function (sink){
        return apply(drivers[driverName], traceSpecs[driverName](sink))
      }
      return acc;
    }, {});

    return run(tracedApp, tracedDrivers)
  }
  
}

Actually: 

- pass in settings
  - _trace : {traceSpecs : { driverName : [traceSourceFn, traceSinkFn]}, combinatorName, 
  componentName, postMessage, onMessage, isTraceEnabled:Y/N, }
    - first componentName is 'App' when decorating run
  - _helpers : {getID, } (merge fusion, no destroy)
  - _hooks : {preprocessInput, postprocessOutput}
    - preprocessInput : componentDef, _settings, componentTree
    - postprocessOutput : function mComponent(sources, innerSettings)
      - that will be written as an advice on mComponent i.e.
      - = decorateWithAdvice(aroundAdvice, mComponent)

# org
- settings : {_trace : {combinatorName: ..., componentName: ..., id: ...}}
- !! NOTE : `m` should have pass a unique id to disambiguate possible conflicts, same `m` 
running, same id, differnt `m` different id
- id accumulate
- combinatorName accumulate combinators
  - we have a combinator path from the graph we want to display
  - this combined with the id mechanism gives us unicity of the path, so we can do the graph 
  reliably
  - this is necessary would it be that we have component or combinator with same name causing 
  disambiguation issues
- componentName accumulate components so we have a component path (use with id to disambiguate)
  - [App, MainPanel] in one branch
  - [App, SidePanel] in another branch
  - last one in array is current
  - or could use other structure (zipper? [[before], latest])

For example :

```javascript
const App = 
  // NOTE : manually add component name for now 
  InjectSourcesAndSettings({
    _trace: {componentName : 'App'},
    sourceFactory : sources => ({url$: ..., project$: ...})
  }, [Div('.app'), [
                     SidePanel,
                     MainPanel
                    ]])

// NOTE : Always put a named function for leaves components so it is picked up by the trace mechanism
// NOTE : that will force me to not use vLift for Div... mmmm. then write helper `NameFn(fn, name)`
function SidePanel(sources, settings) {
  const { url$ } = sources;
  const events = {
      // NOTE : we avoid having to isolate by using the link which MUST be unique over the whole
      // application (unicity of a route)
      click: sources.DOM.select(`.navigation-section__link.${linkSanitized}`).events('click')
    };
  const state$ = url$
        .map(url => ({isLinkActive : url.indexOf(link) > -1}))
        .shareReplay(1);
  const actions = {
      domUpdate: state$.map(isLinkActive => {
        const isLinkActiveClass = isLinkActive ? '.navigation-section__link--active' : '';

        return a(
          `${isLinkActiveClass}.navigation-item.navigation-section__link.${linkSanitized}`,
          { attrs: { href: link }, slot: 'navigation-item' },
          title)
    }),
    router: events.click
      .map(always('/' + link + '/'))
  }
}; 
```

```javascript
InjectSourcesAndSettings = m (specs, {_trace: {combinatorName : 'InjectSourcesAndSettings'}})
```

Given :

```markdown
- INIT event (i.e. subscription of sinks in drivers, for instance DOM display)
  - this is where behaviours may emit if on the path of a sink subscription
  - here url$ emits its initial value ''
  - componentName:[App-1], combinatorName : [Inject..], emits : {type: source, value: ''}, when:..., id : 1
  - componentName:[App-1, SidePanel-3], combinatorName : 'Inject..', emits : {type: source, value: ''}, when:..., id : 3
  - componentName:[App-1, SidePanel-3], combinatorName : 'Inject..', emits : {type: sink, value: ..}, when:..., id : 3
```

(id has to be with the stuff it disambiguates..., so App-1, SidePanel-3, instead of App,Sidepanel, 3)

combinatorName will be set by the combinator creator -- at config time
componentName will be set by the programmer -- at config time too
- m will traceInput sources with settings.id (if none then 0 - for root)
- then call children components with settings :
  - id : old id + getID, so eac child component has different id; that will be actually a path
    - NO~~ id is set a m level i.e. higher, before callign with sources!!
    - NO there is id from getID, and path, which will add the children index to the existing 
    id
  - set componentName to component.name if no (outer)settings._trace.componentName (case leave 
  compponent) - make sure only that case, i.e. discard name of m combined component (remove name?)
    - as a matter tree should be only combinator till leaves (to put in contract)
  - problem is that to call children components, I cannot have combineSinks, but mergeAllSinks, 
  and mergePerSinks fine.
    - so for combineSinks strategy, decorate the components?
    - note that most combinators use combineSinks strategy so it has be solved also for it

https://stackoverflow.com/questions/9153445/how-to-communicate-between-iframe-and-the-parent-site?noredirect=1&lq=1

I can also emit at m level, in addition to the m-result component level. That allows to have the 
graph prior to execution of any component

- `m` body
  - run around advice (componentDef, _settings, componentTree) - actually hard coded, not advice
    - get new settings
      - set id if not there yet 
        - NO : I might not need an id if I have the path...
      - path should already be there. If not initialize with default
      - LOG : path and combinatorName and componentName which I have at config time
        - activated with settings._config.trace = true
    - apply around advice to componentTree
      - for each component in componentTree
        - apply around advice 
          - add path in its settings
        - if isLeaf(component)
          - apply around advice to component
            - transform sources
              - add componentName in its settings 
              - add componentName in tap to sources
            - transform sinks
              - add componentName in tap to sinks 
    - after advice on mComponent(sources, settings):sinks function
      - apply before advice to (sources, settings)
        - tap sources, log settings
      - apply after advices to (sinks, settings)
        - tap sinks (settings has the tapping functions - DEFINE WHERE)
    
    
    - get new componentTree
      - take one component of componentTree
      - before advice : 
        - set settings : path with index, id with getID, componentName if component is not 
        combinedComponent i.e. component.name <> mComponent
          - NOTE: combinatorName should be passed at config time
        - set sources : tapped with component Name, combinatorName, id, path, value, when.. all info
      - after advice :
        - set sinks : tapped with same as sources, but type is sink
    - return the same function mComponent as before
    - be careful for any edge case
      - empty component tree
      - when value is an error, what to do? log notifications!
      - what else?

- this algorithm in principle does not log the source and sinks of the first `m` : to solve later
        
