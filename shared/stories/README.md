# Storybook

Our stories are defined alongside our components in `*.stories.js`. They are funnelled down through `stories/stories.js` and `stories/stories-native.js` and are then imported by `stories/index.*.js` which exports the global story loader. See examples in any `*.stories.js` for how to write a story loader. Once you've written a story, adding it to `stories.js` (or `stories-native.js` if it's a native-only story) will be enough to add it to the live storybook.

## Running storybook

### Desktop

The `yarn run storybook` command will spin up a local storybook server on `localhost:6006`

### Native

There's a native storybook UI that controls the selected story. You can also control the current native view by running `yarn run rn-storybook` (with storybook running on a simulator) and navigating to `localhost:7007`.

#### Android

Storybook can be enabled by going to Build > Select Build Variant and selecting 'storyBook'.

```
# Enable storybook web UI connection
adb reverse tcp:7007 tcp:7007
```

#### iOS

Storybook is controlled by the constants return value in `Storybook.m`. Changing it to `@{@"isStorybook": @true}` enables storybook mode.

## Storyshots

We use an addon to storybook called [Storyshots][1] that adds jest tests on all our defined stories. `yarn test` will run the jest tests and compare the output DOM to the stored snapshots, which are checked into the client repo. This means that updating components with stories can cause jest tests to fail if the snapshots haven't also been updated. Running `yarn test -u` will update the snapshots to the current output.

## Connected children

If a story has a child that is connected to the redux store, that child will still try to its connector in storybook mode, which will fail. To work around this, we patch `connect` in storybook mode to access the store in a different way. `connect` in storybook mode will assume the store is a map that looks like this:

```js
{
  [componentDisplayName: string]: ownProps => viewProps
}
```

The patched `connect` will ignore anything defined in `(mapStateToProps, mapDispatchToProps, mergeProps)` and try to call the closure (the _prop factory_) in the store. The prop factory will get whatever is in `ownProps` and should return the props that the view expects.

In stories with connected children, a `<Provider />` will need to wrap the top level (via `addDecorator`) and contain this map. For convenience, `createPropProvider` is exported from `./stories` that creates a `<Provider />` from a map. `./prop-providers` contains some common prop factory creators, as well as a `compose` function to combine multiple maps into a single `<Provider />`. See `devices/index.stories.js` for a sample implementation.

### Display names

Making a prop factory requires knowing the display name of the connected component(s), which is generally the variable name of the component. Sometimes the display name fails to get piped through to the connector, in which case a `setDisplayName(n)` will need to be chained _immediately after_ the relevant connect call via recompose. Then the prop factory can be defined under `n`.

### Mocks

Mocks are handled a couple of ways. How storybook and storyshots work is slightly different. Jest has some overrides in the package.json file in the 'jest' section. Storybook has some overrides with webpack in the .storybook/webpack.config.js file. React native storybook was also ignoring some mocks (unclear why) so react-redux is being injected manually in mock-react-redux.js

[1]: https://github.com/storybooks/storybook/tree/master/addons/storyshots
