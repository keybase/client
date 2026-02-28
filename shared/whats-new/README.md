### How to Add a New Version

1. Add new version (divided by section)
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
      to a Web URL.
    * Use `onNavigate` to move to different routes in the app, and `onNavigateExternal` for external URLs like keybase.io

4. Add any image assets to `client/shared/images/releases/{MAJ-MIN-PATCH-name}.png`
    * Generate icon constants with `yarn update-icon-constants`
    * Images can be referenced with their `Kb.Icon` name. E.g.
        ```tsx
        <NewFeatureRow image="4.8.0-keybase-fm">
            {...}
        </NewFeatureRow>
        ```
    * Images have to be PNGs
    * Minimize file size since we will be bundling these assets with the desktop
      and mobile applications

### Important Notes
* Invariant: `currentVersion` > `lastVersion` > `lastLastVersion`

* Make sure images from old release are removed from
   `client/shared/images/releases/{MAJ-MIN-PATCH-name}.png`
   
* Regenerate icon constants after removing or adding images
   `yarn update-icon-constants`

* Version numbers matter in `client/shared/constants/whats-new.tsx`. They are
   used to sync the **most recent** version a user has seen and set the badge
   state of the radio icon.
