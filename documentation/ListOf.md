# Motivation

The `ListOf` component allows to 'execute a single given template component for different values of a parameterizing input. Typically, the values come from an array, and a component is constructed from the execution, for each value of the array, of the given template component parameterized by that value.

Practically speaking, this is akin to a `for` loop on an input array. While it is easy for a known array with a given length to execute that loop, the `ListOf` component abstract out managing cases where the array content or length is not known in advance. The `ListOf` component as such combines well with the `ForEach` component, which can serve as the source of the array from which build the loop.

Note that for each incoming array, the `ListOf` component is switched off and then on again. This means any non-persisted state local to the component will be reinitialized. In this case this behaviour is not desired, a turn-around is to persist the local state to retrieve it between switches.

# API

## ListOf :: ListOfSettings -> [ListEmptyComponent, ListNonEmptyComponent] -> ListOfComponent

### Description
Creates a `ListOf` component whose behaviour is parameterized via `ListOfSettings`. Has exactly 2 children components corresponding to two cases :

- the source array has no items (empty array) : In that case, the first child component (`ListEmptyComponent`) is selected as the child component of relevance
- the source array has some items : In that case, the second child component (`ListNonEmptyComponent`) is selected as the child component of relevance

The parametrization is as follows :

- The source array is specified by `list` property in settings, in the form of a string which is the name of the property to be found in the `Settings` parameter for the component. That property will hold the source array.
- The parameterizing array item is specified by `as` property in settings. The component will be executed with the property whose name is specified in `as` passed in its settings. 
- the optional setting property `buildActionsFromChildrenSinks` has the same function as `mergeSinks` in the `m` component factory. It can be :
	- a function `mergeSinks :: makeOwnSinks -> Array<Sinks> -> Settings -> Sinks`
		- that function takes all sinks produced by parent and children components, and reduces them into a single `Sinks` object
	- a hashmap `mergeSinks :: HashMap<SinkName, SinkMergeFn>` with `SinkMergeFn :: Sink -> Array<Sink> -> Settings -> Sinks`
		- the hashmap contains for each given sink, a reducing function which takes all such given sink produced by the children component and the parent component (`makeOwnSinks`) and produces a single reduced sink.
- the optional setting property `actionsMap` serves to rename sinks returned by the reducing `mergeSinks` functions, whether user-configured or the default ones. `actionsMap` simply maps an input sink name (keys of the object) to an output sink name (values of the object).


The behaviour is as follows :

- the source array pointed to by `list` property is identified and accessed
- If there is no values in the array, the first child component is selected
- If there are values in the array, the second child component is selected
- for all values in the array, the selected child component will receive that value in the property pointed to by `as` and be executed
- there will be then be as many resulting children components as there are values in the array (except if there were no values in the array, in which case there is only one child component)
- the resulting children components sinks and the parent component sinks are reduced into what will become the `ListOf` component sinks, according to the reducing logic specified by `buildActionsFromChildrenSinks` and `actionsMap` properties

**NOTE** : The sinks reducing function `buildActionsFromChildrenSinks` is called as such as most often, the children component will return intent sinks, which will be transformed into actions sinks by the reducing function. It seems the chosen name illustrates better the purpose than a more generic name like `mergeSinks`, which is already used in a number of other places and contexts.

### Types
- `ListOfComponent :: Component`
- `ListEmptyComponent :: Component`
- `ListNonEmptyComponent :: Component`
- `ListOfSettings :: Record {`
- `  list :: SourceName` **Mandatory**
- `  as :: SettingsPropertyName` **Mandatory**
- `  buildActionsFromChildrenSinks :: (cf. m)` **Optional**
- `  actionsMap :: HashMap<SinkName, SinkName>` **Optional**
- `}`
- `SinkName :: String`

### Contracts
- for a given configuration of the `list` setting property, there MUST be a matching property in the same settings object. That property must correspond to an array. That is, if `list` is `'items'`, then there must be an array in `settings.items`.
- there MUST be exactly two children component

# Example
cf. demo and tests

# Tips
- Used in combination with `ForEach`, the `ListOf` component allows to implement displaying a list of component while allowing for the source array for that list to change dynamically (see demo).
	- note that the whole list component is switched off and then back on every time a new source array is produced. If one wants to, instead, match a diff of the new and current source array to a diff of the resulting components, that logic has to be implemented in a specific component whose input will be array updates instead of arrays.
- The renaming facilities offered by the `ListOf` configuration allows to reuse existing library components with a slightly different surface API by making the connection between the output of upstreams components with the input of such existing library components.
