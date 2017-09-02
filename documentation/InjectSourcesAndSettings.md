

# Motivation
The `InjectSourcesAndSettings` component allows to add BOTH sources and settings to an existing set of sources and settings. Those extra sources will be constructed from the existing sources and settings. 

Typically: 

- extra sources can be :
	- events (user clicks), 
	- behaviours (current content of database table), 
	- 'reactive behaviours' (which are both events and behaviours)
		- always hold a current value
		- pass on update events
- extra settings can be :
	- trace information, to get a feeling of where in the component hierarchy a log refers to
	- parameters to be passed to all downstreams components
		- `sinkNames` is a common case
	- well anything really, which is dictated by the matter at hand, and represent a parameterization concern which occurs outside of the scope of the affected components.

**NOTE:** It has been deemed better to have a `InjectSources` and a `InjectSourcesAndSettings` component rather than a `InjectSources`  and `InjectSettings`  function, based on hypothesis on frecuency of appearance of such configuration needs. As these components will be more tested in the field, the API might change. In any case, this is a rather minor point.

# API

## InjectSourcesAndSettings :: InjectSourcesAndSettingsSettings -> [Component] -> InjectSourcesAndSettingsComponent

### Description
Creates a component which will execute the `[Component]` with additional sources and settings as per configuration of its `InjectSourcesAndSettingsSettings` parameter.

It is important to understand well the semantics of sources to create them in a safe and bug-free way.

It is important to understand well the mechanism of settings inheritance to so they propagate correctly and result in the expected effects. In particular, what is really important to understand is the precedence rules. (cf. `m`)

- injected settings follow a scoping mechanism similar to that of `let` javascript variables. An injected settings property will be visible in any downstream component. That settings property can be redefined at any level of the hierarchy, and the same visibility rules will apply to that redefinition.
- for instance with `let`
	- `function letTest() {
	  let x = 1;
	  if (true) {
	    let x = 2;  // different variable
	    console.log(x);  // 2
	  }
	  console.log(x);  // 1
	}`
- for instance with `InjectSourcesAndSettings`
	- `InjectSourcesAndSettings({ settings: { trace: 'top level' } }, [
    SomeComponent,
    ForEach({ items: 'items', as: 'things', trace: 'for each level' }, [
      SomeOtherComponent,
      ListOf({ list: 'list', as: 'element', trace: 'list of level' })
    ])
    ThirdComponent
]`
`SomeComponent` will see `trace` set to `'top level'` while `SomeOtherComponent` will see `trace` set to `'for each level'` and `ThirdComponent` will see again `trace` set to 'top level'

The parametrization is as follows :

- the `sourcesFactory` parameter maps to a function which creates a hash of sources from the current sources and settings
- the `settings` property merges together with the existing settings to create new settings that will be passed to the `[Component]`

The behaviour is as follows :

- the sources to inject are created according to the logic enclosed in the factory
- children component are called with a `sources` parameter which is the merge of the previous `sources` and the injected sources. 
- In case of conflict (injected a source with same name than an existing one), the injected source has priority
- the newly injected and merged `sources` object is used for every configured function which uses a `sources` parameter
- the settings to inject are merged with the existing settings according to the precedence rules presented previously.
- the newly injected and merged `settings` object is used for every configured function which uses a `settings` parameter (within the scope of the precedence rules)

### Types
- `InjectSourcesComponent:: Component`
- `InjectSourcesSettings :: Record {`
- `  sourcesFactory :: SourcesFactory,`
- `  settings :: Settings`
- `}`
- `SourcesFactory :: Sources -> Settings -> Sources`
- `Sources :: HashMap<SourceName, Source>`

### Contracts
- mostly types contract

# Example
**TODO TESTS showing the settings inheritance..., no demo**

# Tips
- It is very important to distinguish between event sources and behaviour sources. The first ones should be multicasted (`.share()` with Rxjs), while the second one should be memoized (`.shareReplay(1)` with Rxjs). Failure to do so is the major source of productivity loss when programming with streams. Given the hard task which is debugging in the context of streams, it is highly recommended to think about the nature of the injected source beforehand and implement it accordingly.
- it is very important to understand the mechanism of settings inheritance down the component tree
