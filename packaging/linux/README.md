Oh my god so many steps I'm really sorry.

Clone kbfs adjacent to client (this repo). The exact path doesn't
matter.

Get all the credentials. Run test_all_credentials.sh in this directory
to see what you're missing and check that everything's working. Note
that this requires the `s3cmd` tool to talk to S3. The credentials are
in another repository (ask Max about where that is), which has
instructions for installing them.

Set up docker. The build image will be created automatically, so long as
the basics like `docker ps` are working.

Once that's set up, here's the command to kick off a build.

    ./docker_build.sh prerelease origin/master

If the code signing GPG key is password protected in your setup (which
it should be, unless you're the automated build machine), the build will
probably prompt you to enter that passphrase twice, once to export it
from your local keyring and again to import it inside the docker
container.

You can replace `origin/master` with any commit or branch name, to
choose what gets built. The `prerelease` target is kind of a legacy
name, and it's required.

You can ctrl-c the build if you need to kill it, but PLEASE DO NOT do
that once it's finished building and started pushing. The result would
be corrupt repo metadata for everyone on Ubuntu/Deb/RPM.

If you need to forcibly skip CI, set NOWAIT=1 in the environment.

If you want to test the build without pushing live, set
KEYBASE_DRY_RUN=1 in the environment. Be very careful not to typo that
variable. You should see "This build+push is a DRY RUN." after all the
git fetches in the build output, if you did this right.
