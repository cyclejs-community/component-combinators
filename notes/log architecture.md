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
- `Driver :: Source -> Sink`
 
