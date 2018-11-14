# Troubleshooting

## Stale Cache
If you run into weird issues with your packager this may be due to a stale cache, run this command to wipe your local cache:

```sh
yarn run rn-packager-wipe-cache
```

## Expected to find exactly one React Native renderer on DevTools hook.

You might be importing a library that attaches itself as a renderer, such as `react-dom`.  If that's the case, you should:

Refactor your code so those libraries stay within a .desktop.js and don't leak. Or, as a last resort, it should be predicated on `!isMobile` and use `require` to access the library.

