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

Run the prerelease build. (The production build is deprecated.)

    ./docker_build.sh prerelease origin/master

If you need to forcibly skip CI, set NOWAIT=1 in the environment.

If you want to test the build without pushing live, set
KEYBASE_DRY_RUN=1 in the environment. Be very careful not to typo that
one. You should see "This build+push is a DRY RUN." early in the build
output if you did this right.
