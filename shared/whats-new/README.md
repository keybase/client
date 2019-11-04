### How to Add a New Version

1. Add new version
   1. Set `lastLastVersion` to the value of `lastVersion`
   2. Set `lastVersion` to the value of `currentVersion`
   3. Set `currentVersion` to the new version

2. Update the following files:
   1. `client/shared/constants/whats-new.tsx` for JavaScript values
   2. `client/shared/constants/types/whats-new.tsx` for TypeScript type literals

3. New new features in `client/shared/whats-new/releases.tsx` using the
   `NewFeatureRow` component.
    * Each feature row needs to take the `seen` prop to set its badge state
      correctly
    * Navigation can be done either internally to the application or externally
      to a Web URL. Use `onNavigate` to move to different routes in the app, and
      `onNavigateExternal` for external URLs like keybase.io
    * Images need to be required with `require('')`

4. Add any image assets to `client/shared/images/releases/M.M.P/{name}.png`
    * Images have to be PNGs
    * Limit file size since we will be bundling these assets with the desktop
      and mobile applications

### Important Notes
* Invariant: `currentVersion` > `lastVersion` > `lastLastVersion`

* Make sure images from old release are removed from
   `client/shared/images/releases/M.M.P/{name}.png`

* Version numbers matter in `client/shared/constants/whats-new.tsx`. They are
   used to sync the **most recent** version a user has seen and set the badge
   state of the radio icon.
