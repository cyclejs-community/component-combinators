# Motivation

The `ForEach` component allows to 'execute' a component every time a source is emitting a value. It is hence similar to the `Switch` component in that a component is switched on and off for every incoming value on the source. `ForEach` semantics are similarly akin to those of  `flatMapLatest` or `switchMap` but on a component instead of on a source.

Practically speaking, given a component which is parameterized by a value, the `ForEach` component allows to account for the variability of that value outside of the component's design.  For instance, given a component which displays a list of items, which can change according to the contents of a database, one can write the component in the form of `DisplayListItems(listItem)` instead of `DisplayListItems(listItem$)`, which leads to a simpler implementation for `DisplayListItems`.

Note that for each incoming value of the source, the component is switched off and then on again. This means any non-persisted state local to the component will be reinitialized. In this case this behaviour is not desired, a turn-around is to persist the local state to retrieve it between switches.

# API

## ForEach :: ForEachSettings -> [Component] -> ForEachComponent

### Description
Creates a `ForEach` component whose behaviour is parameterized via `ForEachSettings`. Children components are the components to be mapped to incoming values on the `ForEach` source.

The parametrization is as follows :

- an array of sink names must be passed to indicate which sinks are to be extracted from the case components. Sinks produced by any child component which are not in the sink names array will be ignored. It is not necessary, for any sink name in that array, for a child component to return a sink of that name.
- the `ForEach` source is specified by `from` property in the form of a string which is the name of the source to be found in the `sources` parameter for the component.
- the incoming value from the `from` configured source is passed to the children component in their settings in a property configured in the `as` property of the `ForEach` component's settings.

The behaviour is as follows :

- for every incoming value of the `ForEach` source, the children components are switched off and then switched on 
- Children components are called with the same `sources` as the `ForEach` component, unless explicitly configured otherwise
- Children components are called with the same `settings` as the `ForEach` component, with the addition of a new property whose name is configured in `as` property of `ForEach` settings.

### Types
- `ForEachComponent :: Component`
- `ForEachSettings :: Record {`
- `  sinkNames :: [SinkName]`  **Mandatory**
- `  from :: SourceName` **Mandatory**
- `  as :: SettingsPropertyName` **Mandatory**
- `}`
- `SwitchOnCondition :: Sources -> Settings -> Source`
- `SwitchOnSource:: SourceName`
- `SourceName :: String`
- `SinkName :: String`
- `SettingsPropertyName :: String`

### Contracts
- the source configured through the `from` property MUST be found as a property of the `sources` parameter.
- there must be at least one child component

# Example
cf. demo

# Tips
- If it is necessary to implement a logic by which the component switching should only trigger on **CHANGES** of the incoming value, that logic could be implemented with appending a `distinctUntilChanged` to the `ForEach` source.
- For each incoming value of the source, the component is switched off and then on again. This means any non-persisted state local to the component will be reinitialized. In this case this behaviour is not desired, a turn-around is to persist the local state to retrieve it between switches.
