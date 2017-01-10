
## Sourcemaps

To get sourcemaps to work in the production app, download the matching sourcemaps from the build folder.
Run the following npm command, passing the path to the unzipped path:

```sh
yarn run inject-sourcemaps-prod -- /mysourcemaps/Keybase-1.0.7-20160111080008+1049d47.map
```

This will copy the sourcemaps into the application package (if installed in the default location). Otherwise you can do this yourself.

If you have a crash of a non-sourcemapped build (like a screenshot with a crash) you can do a post-mortem debug of the minimized code by using a utility.

```sh
yarn install -g sourcemap-finder
smfinder --position 1200:10 path-to-your-source-map
```
