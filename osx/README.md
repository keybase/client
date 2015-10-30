## Keybase for Mac OS X

**Warning**: The code in this repository does not represent a finalized 
architecture or API and we will probably not accept any external pull requests.
*We advise you not to fork this repository.*

### Project Setup

```sh
# Install CocoaPods (if not installed)
sudo gem install cocoapods
pod setup

# Generate workspace
pod install

# Open workspace (not xcodeproj)
open Keybase.xcworkspace
```

Then select the target ```Keybase``` and run.

### Styleguide

See [STYLEGUIDE.md](STYLEGUIDE.md).

### Dev References

[Launch Agents, Services, XPC](https://developer.apple.com/library/mac/documentation/MacOSX/Conceptual/BPSystemStartup/Chapters/CreatingLaunchdJobs.html): Describes how services are installed and run.

[App Extensions](https://developer.apple.com/library/mac/documentation/General/Conceptual/ExtensibilityPG/ExtensionCreation.html): Describes app extensions for Actions, Share and Finder Sync.

[Privileged Helper Tool](https://developer.apple.com/library/mac/documentation/Security/Conceptual/SecureCodingGuide/Articles/AccessControl.html#//apple_ref/doc/uid/TP40002589-SW2): Describes the Helper tool functionality.


### Xcode Settings

In Xcode, Preferences, Text Editing:

* Prefer indent using: Spaces
* Tab width: 2 spaces
* Indent width: 2 spaces
