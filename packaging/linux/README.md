Oh my god so many steps I'm really sorry.

Clone kbfs and server-ops adjacent to client (this repo). The exact path
doesn't matter.

Get all the credentials. Run test_all_credentials.sh in this directory
to see what you're missing and check that everything's working. Note
that this requires the `s3cmd` package to talk to S3.

Set up docker. The build image will be created automatically, so long as
the basics like `docker ps` are working.

Run the prerelease build. (The production build is deprecated.)

    ./docker_build.sh prerelease origin/master
