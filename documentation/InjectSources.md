
# Motivation
The `InjectSources` component allows to add sources to an existing set of sources. Those extra sources will be constructed from the existing sources and parameterized by some settings. 

Typically, extra sources can be :

- events (user clicks), 
- behaviours (current content of database table), 
- 'reactive behaviours' (which are both events and behaviours)
	- always hold a current value
	- pass on update events

It is important to understand well the semantics of those sources to create them in a safe and bug-free way.

# API

## InjectSources:: InjectSourcesSettings -> [Component] -> InjectSourcesComponent

### Description
Creates a component whose `sources` parameter will include the sources configured in the `InjectSourcesSettings` parameter. 

The parametrization is as follows :

- each property of the `InjectSourcesSettings` parameter is the name of a source to create, mapped to a factory function to actually create that source from the existing sources and settings. 

The behaviour is as follows :

- the sources to inject are created according to the logic enclosed in their factories
- children component are called with a `sources` parameter which is the merge of the previous `sources` and the injected sources. 
- In case of conflict (injected a source with same name than an existing one), the injected source has priority
- the newly injected and merged `sources` object is used for every configured function which uses a `sources` parameter

### Types
- `InjectSourcesComponent:: Component`
- `InjectSourcesSettings :: HashMap <SourceName, SourceFactory>`
- `SourceFactory :: Sources -> Settings -> Source`
- `Sources :: HashMap<SourceName, Source>`

### Contracts
- mostly types contract

# Example
cf. demo and tests (`ForEach` demo for instance)

# Tips
- It is very important to distinguish between event sources and behaviour sources. The first ones should be multicasted (`.share()` with Rxjs), while the second one should be memoized (`.shareReplay(1)` with Rxjs). Failure to do so is the major source of productivity loss when programming with streams. Given the hard task which is debugging in the context of streams, it is highly recommended to think about the nature of the injected source beforehand and implement it accordingly.
