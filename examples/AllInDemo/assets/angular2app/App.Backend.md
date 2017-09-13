# Back-end architecture
As a database, we will use firebase.

## Physical data model
The usual thing would be to do a conceptual data model based on the domain at hand. We will skip all that and give directly the physical data model, with its set of table in firebase.

### Projects (User)
### Tasks (Project)
### Tasks :: {Created, Title, Index, Efforts, Details, Done, Nr (number)}
### Project :: {Title, Description, Tasks}
