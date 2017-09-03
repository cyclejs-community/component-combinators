

# Motivation
The action driver allows to execute a command on a resource and retrieve the response. The command is parameterized by the repository holding the resource, the resource in question, and additional parameters which specify further the command to be executed.

A typical application is to execute a domain object's method or a domain service in a given bounded context. More generally, the action driver can be used to execute any command pre-defined for a given context with a set of parameters.

# API

## makeDomainActionDriver :: Repository-> ActionConfig -> ActionDriver

### Description
Creates a <em>request/response</em> driver from a configuration object (called `config` here) and a repository (`repository`).

The `context` is mapped to a `get` function through the `config` object. That `get` function is executed with `repository`, `context`, and `payload` as parameters.  That `get` function must return a `Promise`. 

The driver sink receives an object which encodes the request to be executed with the following properties :

- context
	- the context within which to understand the command. The same command identifier can correspond to different functions, depending on the context.
- command
	- an identifier for the command to be executed, to be mapped with an actual function through the `config` object
- payload
	- the parameters to be passed to the command to be executed

The behaviour is as follows :

- the driver receives an action, i.e. `context, command, payload` information
- the function to be executed is obtained through the `config` object as `config[context][command]`
- that function is called with `(repository, context, payload)` as parameters
- if the function throws, the exception is caught and an error response is issued through the driver sink
- Response objects understand error as being :
	- exceptions occurring during execution of the command, 
	- failing promise being returned, 
	- an `Error` object being returned by the command
- responses objects 
	- pass errors and result of commands in a similar fashion as node callbacks, i.e. with a separate channel for errors
	- keep the matching request, to allow for posterior reconciliation of response and request
- to further facilitate the filtering out of responses, each context has a dedicated source which passes on only responses corresponding to actions in that context.
	- `getResponse` property holds a function which returns a subject which only passes on the responses for a given context


### Types
- `Repository :: *` 
- `ActionConfig :: HashMap<Context, HashMap<Command, ActionFn>>`
- `ActionFn :: Repository -> Context -> Payload -> Promise<*> | Error`
- `ActionDriver :: Sink<ActionRequest> -> Source<ActionResponse> & Record {getResponse :: Context -> Subject}`
- `ActionRequest :: Record {context :: Context, command : Command, payload : Payload}`
- `Context :: String`
- `Command :: String`
-  `Payload :: *`
- `ActionResponse :: Record {request :: ActionRequest, err :: Error | Null, response :: Response | Null}`
- `Response :: *`

### Contracts
- for every context and command passed as parameters, there MUST be a matching `config[context][command]` which is a function

# Example
cf. `ForEachListOf` demo

# Tips
- the action driver can be used in connection with the query driver to implement live queries. An example of this is portrayed in the `ForEachListOf` demo. One fetches the current value of a resource, while listening on posterior responses from update actions on that resource.
