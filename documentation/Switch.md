# Motivation
The `Switch` component allows to associate a set of values from a source (called switch source) to a component. When the switch source emits the values associated to a given component, that component is activated. Components which are not associated to the emitted set of values are deactivated.

The `Switch` component can be viewed as a single-state state machine, whose only event source is the switch source and event guards are the predicates specifying the component matching.

Practically speaking, the `Switch` component allows to improve separation of concern by removing control flow out of some component designs. For instance, supposing we have a component whose behaviour depends on a discretizable parameter, in addition to other parameters, we need to write the logic corresponding to each discrete value in the body of the same function. With `Switch`, we can write several components corresponding to the logic for each discrete value.

For example, a component might be specified to display a product page when the user is logged in, and otherwise display a login page. This components hence has two behaviour or concerns which are unrelated. The discrete values here can be thought of as `LOGGED_IN`, `NOT_LOGGED_IN`. With `Switch`, we can write a `Login` component separately and independently from the `Product` component, and let the `Switch` component activate the right component.

Note that this makes less sense when the isolated concerns are dependent. For instance, a `Product` component which displays a product details page for a given product would not be a good fit for usage of the `Switch` component, even if one can discretize products by product ids. The code for displaying a given product id, being the same for any product, using `Switch` would lead to code duplication, violating the DRY principle.

# Tips
- One should strive to have a relatively low number of discretized switch values as there is a performance cost which is linear with the number of such values. As a matter of fact, all predicates matching switched components to their discretized values are executed, for every incoming value of the switch source.
- One can have several fulfilled predicates for a given incoming value of the switch source. This means that several components could be activated for a given incoming value, but different conditions, which allows to implement more complex logic. This is however to use wisely, as the ability to reason about behaviour suffers somewhat. For instance, when several components can be activated for the same incoming value, and order of activation of those component matter, such ordering requirement is essentially hidden as implementation detail in the source code.
