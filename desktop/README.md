
**Attention, please.**

This code is a work in progress, and we publish it for full transparency. You can review the source code, but:

 - you shouldn't just run this code without reading it, as it may have bugs or stubbed out crypto
 - it might not do exactly what it says it is doing

If you really want to install Keybase, please return to the [top level Readme.md](https://github.com/keybase/client/blob/master/README.md) for official release instructions.

----------

## Keybase (Electron)

This directory is an exploration of using react-native alongside React in Electron.

It's an early prototype, not ready for use yet.

To run:

```sh
npm install
npm start
```

Available npm run commands:

 - npm start: Build a development bundle and start the app off of those files (If you're running the app once)
 - hot-server: Start the hot-reloading server
 - start-hot: Connect to a hot-reloading server (If you're developing and want to see changes as you make them)

 - build-dev: Build a development bundle
 - build-prod: Build a production bundle
 - start-cold: Start the app off of the build-dev bundles

 - package: Make an electron application build

Environment variables:

 - $HOME: Home dir to use. Useful for multiple parallel installs
 - $KEYBASE_RUN_MODE: production | devel. Which server to hit
 - $KEYBASE_APP_DEBUG: Debug settings, extra logging
 - $KEYBASE_SHOW_DEVTOOLS: Show devtools
 - $KEYBASE_RPC_DELAY: Number of ms to delay all RPC calls (requires debug mode)

Use
```
launchctl setenv KEYBASE_APP_DEBUG true
```
to debug the production app

Getting sourcemaps to work in the production app:

Download the matching sourcemaps from the build folder. Run the following npm command, passing the path to the unzipped path

```
npm run inject-sourcemaps-prod -- /mysourcemaps/Keybase-1.0.7-20160111080008+1049d47.map
```

This will copy the sourcemaps into the application package (if installed in the default location). Otherwise you can just do this yourself
