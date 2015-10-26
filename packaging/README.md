This directory contains scripts that we use to build release packages
for the Keybase app. Most of this is only useful internally, and if
you're reading this the scripts under `export` and `release` are
deprecated.

The `debian/build_debian.sh` and `rpm/build_rpm.sh` scripts are useful
if you want to build your own version of the Linux packages. Running
them looks like this:

    ./debian/build_debian.sh production

The `Dockerfile` here specifies our build environment. If you install
the same packages on your own machine, that'll probably work fine too.
