
## Sourcemaps

To get sourcemaps to work in the production app, download the matching sourcemaps from the build folder.
Copy the sourcemaps into the application package manually:

```sh
cp /mysourcemaps/Keybase-1.0.7-20160111080008+1049d47.map/* /Applications/Keybase.app/Contents/Resources/app/desktop/dist/
```

If you have a crash of a non-sourcemapped build (like a screenshot with a crash) you can do a post-mortem debug of the minimized code by using a utility.

```sh
yarn install -g sourcemap-finder
smfinder --position 1200:10 path-to-your-source-map
```
