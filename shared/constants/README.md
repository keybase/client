Overview of the state management system:

Previously we had everything using redux and saga. This worked ok but there were always
complaints about all the boilerplate and sagas had too many footguns. We eventually
reduced the allowed API on sagas until it was mostly using listernActions (listen for
an action then emit some actions) and a few `.take`s in async functions.

We recently moved to replace most of this state management with zustand. Zustand allows us
to keep all our logic in one place, reduce our generated boilerplate, have simpler models for
async and lets us split our stores which means less subscribers firing on components (perf win).

Because we have a more complicated rpc system (maybe we could change that) we leverage the fact that
the 'actions' in this world are just methods in our `dispatch` object. We segregate the functions which
can change at runtime into a `dynamic` object. This lets us inject responders to callbacks on rpcs into there
which components can trigger based on some UI interaction.

There are some minimal redux pieces mainly because we need a way to send data over the electron bridge
and that needs a representation, so we'd just have to remake something like our actions anyways. The other
use case is for a general 'event emitter' pattern. These actions shouldn't produce any direct reducer
changes.
