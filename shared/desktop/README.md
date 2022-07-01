**Attention, please.**

This code is a work in progress, and we publish it for full transparency. You can review the source code, but:

- you shouldn't just run this code without reading it, as it may have bugs or stubbed out crypto
- it might not do exactly what it says it is doing

If you really want to install Keybase, please return to the repo [README.md](https://github.com/keybase/client/blob/master/README.md) for official release instructions.

---

## Keybase (Electron)

This directory is an exploration of using react-native alongside React in Electron.

It's an early prototype, not ready for use yet.

To run:

```sh
npm install
npm start
```

Available npm run commands:

- `npm start`: Build a development bundle and start the app off of those files (If you're running the app once)
- `hot-server`: Start the hot-reloading server
- `start-hot`: Connect to a hot-reloading server (If you're developing and want to see changes as you make them)
- `build-dev`: Build a development bundle
- `build-prod`: Build a production bundle
- `start-cold`: Start the app off of the build-dev bundles
- `package`: Make an electron application build

Environment variables:

- `HOME`: Home dir to use, useful for multiple installs
- `KEYBASE_RUN_MODE`: prod, staging, devel
- `KEYBASE_LOCAL_DEBUG` (bool): Debug
- `KEYBASE_SHOW_DEVTOOLS` (bool): Show devtools
- `KEYBASE_RPC_DELAY`: Number of ms to delay all RPC calls (requires debug mode)
- `KEYBASE_RPC_DELAY_RESULT`: Number of ms to delay all RPC call callbacks (requires debug mode)

### Sourcemaps

Getting sourcemaps to work in the production app:

Download the matching sourcemaps from the build folder. Run the following npm command, passing the path to the unzipped path

```
npm run inject-sourcemaps-prod -- /mysourcemaps/Keybase-1.0.7-20160111080008+1049d47.map
```

This will copy the sourcemaps into the application package (if installed in the default location). Otherwise you can just do this yourself

If you have a crash of a non-sourcemapped build (like a screenshot with a crash) you can do a post-mortem debug of the minimized code by using a utility.

```
npm install -g sourcemap-finder
smfinder --position 1200:10 path-to-your-source-map
```

### HMR (hot module replacement)

[HMR](https://webpack.js.org/concepts/hot-module-replacement/) will be enabled if you use the `yarn hot-server`/`yarn start-hot` combo to run the GUI. HMR works by looking at what file was updated, and traversing the module dependency tree back to the root (in `./renderer/index.js`).

Along the way, webpack looks at the current `module` it is at and that module's `parent`. If the `parent` has declared that it can accept the changes in `module`, HMR will stop traversing and call a callback defined in `parent`. If any of the dependency branches makes it down to the root, HMR will fail and trigger a full reload. It'll also throw an exception listing the dependency path that was followed.

This project is set up to allow HMR for changes in the view layer, and trigger full reloads otherwise (these boundaries are fuzzy as they depend on the app's dep tree as described). The view layer's dependency tree funnels down through the routing modules in `/shared/app/routes-*.js`. These files are imported by `./renderer/index.js`, which has a `module.hot.accept` call that accepts the changes and re-renders the new version of the app. _If anything else in the app imports the route files without `accept`ing them, HMR will break._ To fix it, either find a way to avoid importing the route files (preferable), or add a `module.hot.accept` call in the offending file (see `/shared/app/actions/login.js`).
