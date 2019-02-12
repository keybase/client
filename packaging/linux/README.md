# Keybase Linux Packaging
See usage and technical docs at https://keybase.io/docs/linux-user-guide.
GitHub issues, bug reports, and pull requests welcome, especially if something
small can be changed to support your distribution or setup.

If you make changes to a shell file, *please run
[shellcheck](https://www.shellcheck.net/)* and make sure there are no
additional warnings!

## External packagers
The main cross-platform build file is `build_binaries.sh`.

You can set some environment variables to control what gets built.
`KEYBASE_BUILD_ARM_ONLY=1` - builds arm64 only
`KEYBASE_SKIP_64_BIT=1` - builds 32 bit only
`KEYBASE_SKIP_32_BIT=1` - builds 64 bit only

The default is to build both 32-bit and 64-bit.

There are test Dockerfiles and a helpful README at
https://github.com/keybase/client/tree/master/packaging/linux/test that you can
use to make sure your changes work correctly on different systems.

## Internal packagers
`build_and_push_packages.sh` also pushes them to our own apt, rpm, and AUR
repos, but requires credentials that can be tested with `test_all_credentials.sh`
(note: `s3cmd` required).

You can also build with docker: install docker and start the daemon if necessary.

```bash
./docker_build.sh prerelease HEAD
```

You can replace `HEAD` with any commit or branch name, to
choose what gets built. The `prerelease` target is kind of a legacy
name, and it's required.

You can ctrl-c the build if you need to kill it, but PLEASE DO NOT do
that once it's finished building and started pushing. The result would
be corrupt repo metadata for everyone on Ubuntu/Deb/RPM.

If you need to forcibly skip CI, set NOWAIT=1 in the environment.

If you want to test the build without pushing live, set `KEYBASE_DRY_RUN=1` in
the environment. Be very careful not to typo that variable. You should see
"This build+push is a DRY RUN." after all the git fetches in the build output,
if you did this right. A dry run will push the package to the s3 bucket
jack-testing.keybase.io, but this is not exposed on the internet.  You
could copy the repo to somewhere in prerelease.keybase.io to test a `yum
install`, for example.

To make a nightly build, add `KEYBASE_NIGHTLY=1` to the environment.

#### Making changes to the Dockerfile
The most common change is bumping the version of Go we're using. Do that
in the Dockerfile in this directory. Whenenever you make changes that
affect the docker image, you also need to bump its version number in
docker_build.sh. Look for the line that looks like this:

    image=keybase_packaging_{**SEE NUMBER IN client/packaging/linux/docker_build.sh**}

Increment that number, so that everyone who's running these builds
automatically rebuilds the docker image with your change.

#### Setting up the automated slackbot
Clone https://github.com/keybase/slackbot and follow the instructions in
systemd/README.md.
