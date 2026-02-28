## Overview

The `shared` library contains our shared code used by all the platforms.
When we have application specific code we want/need to split at a file level we use a per-platform suffix (.native.tsx, .desktop.tsx, .android.tsx, etc)
Additionally we have constants within the app to switch code depending on the platform.

## Navigation

We use react-navigation to handle our nav. We have static routes defined in various `routes.tsx` files which define the mapping of the name to a `page` component. That page component is a simple wrapper that uses an async `import` to help with treeshaking / lazy loading and sets up various `React.Context`s and pulls params from the navigation system.
We dispatch actions through the state layer to navigate (`C.Router2.navigateAppend`)

## State

Application state is held in various zustand stores. In order to maintain a static import order we always import `@/constants` where they are re-exported.
There are some stores which have dependencies on others, in those rare cases they use `subscribe` on them.
Regular stores have a `dispatch` which is similar to a redux action layer. Some stores have helpers also that hold derived getters.
On a signout (and some other cases) we want to ensure all the stores are reset so there is a reset layer.
We leverage React Contexts in some places but a lot of the older code existed before we had zustand and before hooks even existed.

## Components

Common components are in `@/common-adapters`. In order to fight circular dependencies within here we import other common-adapters locally and not from the index and wrap them in a `const Kb2` so the code can be uniform.

## Legacy components

As the app was built over time while React was evolving we do have some class based components and some older patterns. We used to make `container` classes which dealt with the redux store and passed them into 'plain' components (this also helped with storybook and other testing) but we've since moved away from this and just to pure hooks and context.
