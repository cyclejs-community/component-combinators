# Motivation
This is a demonstration featuring a medium-complexity app and illustrating how to structure it with this combinator library. The example is taken from the book [Mastering Angular2 components](https://www.packtpub.com/web-development/mastering-angular-2-components). We actually implement a significant subset of the application presented in the book : we will not implement neither dashboard nor plug-in section.

I chose this example because it allows to compare componentization model between the one I propose and Angular's one and draw parallels and differences.

# Specifications
## Description
The short description is that this application allows a user to manage a list of task belonging to projects.

## Back-end
Will use firebase.

Physical data model is summarized in the next sections.

### Project
| Field | Type | Example 
|---|---|---
|projectId| `String` | firebase id?
|deleted | `Boolean` | false
|title | `String` | Your first project
|description | `String` | This is your first project in the task management system
|tasks | `Tasks :: Array<Task>` | N/A

### Task
| Field | Type | Example 
|---|---|---
|nr | `Number` | 1
|position | `Number` | 0
|title | `String` | Task 1
|done| `Null | TimeString?`| false
|created| `String?`| ??
|efforts| `Effort :: Record {estimated :: Number, effective : Number}` | { estimated: 86400000, effective: 0 }

### Activity
| Field | Type | Example 
|---|---|---
|user | `User :: Record {name::String, pictureDataUri: Base64URI}` | { name: 'You', pictureDataUri: 'data:image/svg+xml;base64,PD94bWwgd...vbj}
|time| `TimeString?`|,+Moment(now).subtract(8, 'hours')
|subject| Reference to a given project | firebase id?
|category| Reference to property in project table??  | 'tasks'
|title| `String` | 'A task was updated'
|message|`String`| 'The task \'New task created\' was updated on #project-1.'

## Front-end

No wireframes are available, however the following screenshot from the Angular2 implementation should help figuring out the functionalities of the application.

![screenshot](https://i.imgur.com/NXgJV2c.png) 

# Running the demo
- npm run wbuild (once)
- npm run serve (as many times as necessary)
- open `index.html` in a local webserver
