## Prereleases

These scripts build prerelease versions of the app and services.

### Versioning

We use a semantic versioning string, that looks like 1.2.3 or 1.2.3-400 or 1.2.3-400+comment. After the dash (-) is the prerelease info. After the plus (+) is a comment field.

- By setting `libkb.PrereleaseBuild` ldflag at compile time

For the `libkb.PrereleaseBuild` ldflag, the prerelease scripts use the date format `+%Y%m%d%H%M%S` so that we can build without having to change the build number and commit changes to the repo.

This date format is meant to be both human readable and an ordered number. (An epoch is ordered and not human readable,
and other formats with dashes and dots are not numeric.) For example, 20151215102019 is 12/15/2015 at 10:20:19. We like keeping build number an ordered number (instead of alpha.1) so that we can prevent downgrades and see what time the build occurred.

In addition, a comment with a short sha of the last commit is added as well allowing you to pinpoint more easily where in the git history the build was made.

### Building

To build and deploy the app:

```
./build_app.sh
```

### Scheduling Builds

There is an example of a plist to for scheduled builds.

```
launchctl load ~/Library/LaunchAgents/keybase.prerelease.plist
```

### Dev/Local Builds

To build a version of the app using the local repo without signing or uploading
to S3:

```
NOPULL=1 NOS3=1 NOSIGN=1 ./build_app.sh
```

For faster debugging/testing, you can build Keybase services (go binaries)
directly into an existing app install:

```
BUILD_DIR=/Applications/Keybase.app/Contents/SharedSupport/bin ./build_keybase.sh
BUILD_DIR=/Applications/Keybase.app/Contents/SharedSupport/bin ./build_kbfs.sh
```

To build the app and services from a local copy (for testing):

```
TEST=1 NOSIGN=1 ./build_app.sh
```

### Testing Updates

To store current install, to re-apply as an update:

```
ditto -c -k --keepParent -rsrc /Applications/Keybase.app /tmp/Keybase.zip
keybase sign -d -i /tmp/Keybase.zip -o /tmp/keybase.sig
keybase -d update run --source=local --url=file:///tmp/Keybase.zip --signature=/tmp/keybase.sig --force
```

### Updating from Test Builds

```
keybase update run --source=remote --url="https://s3.amazonaws.com/prerelease-test.keybase.io/update-darwin-prod.json"
```
