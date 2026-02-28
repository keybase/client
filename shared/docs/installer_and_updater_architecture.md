## Installer and Updater Architecture

### Installer

Let's start with OS X, because it's the most challenging environment as well as
the one that's had the most work done on it.

We have components to keep up to date, some requiring special privileges:

1. The Go client/service binary
2. The Electron app
3. The FUSE kernel binary (kbfuse kext and fsbundle)
4. The launchd services for keybase and KBFS

Here's the plan:

We have a single "app bundle" containing all of the items above, called
Keybase.app. It also contains a native installer binary and a privileged
helper, which handles installing 3 and 4.

On OS X, app bundles look like normal executables to the user, but they're
always signed and they can perform privileged operations.

We distribute the Keybase.app bundle inside a DMG. Any time you launch
Keybase.app, it launches Electron, which launches the native installer binary
straight away. It blocks on the native installer binary exiting. The native
installer binary checks the app bundle it's inside, and:

- If the installer sees that the app bundle doesn't contain any newer
  components than are installed on the system, it exits very quickly, and the
  fact that it ran is invisible to the user. It does not have user-facing UI.

- If the installer sees that the app bundle it's inside _does_ contain new
  components, it installs them before restarting the services and allowing
  Electron to continue with new code.

In this sense, the installer is also the updater. To update, we replace
the entire "Keybase.app" bundle with a new one and relaunch Keybase.app,
which triggers Electron to start the installer, which performs an install,
before continuing.

Some of the installation steps are done by the privileged helper, because they
have to be. But most are done by our own Go code, by running `keybase install`
using the new `keybase` Go binary that we're updating to. Here are the full
commands:

```sh
# Keybase service install (launchd):
keybase install --components=service

# KBFS service install (launchd):
keybase install --components=kbfs

# CLI install:
keybase install --components=cli
```

The code for `keybase install` on OS X is here:

https://github.com/keybase/client/blob/master/go/client/install_osx.go

Once we think the install has finished, we can run a few commands to check the
status of the new components:

```sh
keybase launchd status --format=json service
keybase launchd status --format=json kbfs
keybase fuse status
```

### Updater

The design above limits the updater's responsibilities to:

- check for a new version
- download it
- ask the user for permission to update, or do so automatically if they've
  said they don't want to be asked every time
- check signatures on the new upgrade, ask for admin permissions if needed to
  perform the install
- replace the old app bundle on disk with the newly-downloaded one
- restart the app, triggering the installer to notice and install new services

#### How do we find out about updates?

There are many possibilities here. The service could find out (it is notified
of available upgrades by the API server in response to every request it makes)
and tell the Electron client over RPC. Or the Electron client could regularly
ping an API server endpoint asking for updates. Or the Electron client could
ping a [Squirrel.Server protocol](https://github.com/Squirrel/Squirrel.Mac#update-json-format)
server, which is something its `auto-updater` module already knows how to do.

We'd like to start by just building our own updater in Go, though. It allows
us to avoid a .NET 4.5 dependency on Windows, and to do authenticated upgrade
requests that return different versions based on which Keybase user you're
logged in as, which a Squirrel server (because it has no state) wouldn't.

There's a complication, though: while the service can ask for updates **as
a given user** inside an authenticated request, Squirrel update requests don't
follow our API, and so don't authenticate as a Keybase user. This might
require us to have the Keybase service tell the client about a new upgrade
instead.

#### How do we apply updates?

We'll start by writing our own Go code for the steps in the bullet points above.

#### What about Windows and Linux?

The Go code that we write for OS X will probably be reasonably portable to
Windows. We'd make a separate `keybase install` backend for Windows.

Linux will be different -- Linux has a culture around letting your OS perform
package management for you, so we would expect to just push e.g. .deb package
updates to our own APT repository, and we can pop up notifications to remind
the user to perform a system upgrade if we notice that they're lagging behind.

#### How do we handle CI, Nightlies and Releases?

We should have a script (see Gabriel's `scripts/package-desktop.sh`) that
creates and signs an app bundle from the repo at a specified commit hash.
We have to sign the bundle even if it's just for internal use -- that's just
how OS X app bundles work.

We'd run the script from cron once a day on the most recent commit, and on
demand whenever we're ready to cut a new stable release and push it out.

#### How do we give nightlies to some users and not others?

We'd like to have a new "feature flag" model on the API server. You can assign
flags (an array of strings) to users, and they would be returned by the API
server with the result to every API request (should it be less often?). The
local Keybase Go service stores each registered user's flags (e.g. in
`config.json`) and makes them available to the service's clients over RPC.

Keybase staff would have the "nightly" feature flag active, and the Squirrel
server endpoint will give a nightly build URL out to nightly users if they ask
for one. (They should also be able to maintain a separate stable build Keybase
install too.)

People who have been invited to the KBFS beta can get a "kbfs_active" feature
flag. We can check for that before exposing KBFS UI to them or trying to mount
KBFS in the kbfsfuse service.
