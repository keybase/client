## Prereleases

These scripts build prerelease versions of the app and services.

### Versioning

We use a semantic versioning string, that looks like 1.2.3 or 1.2.3-400 or 1.2.3-400+comment. After the dash (-) is the prerelease info. After the plus (+) is a comment field.

There are two ways to set the build number:

- By changing `DefaultBuild` in `libkb/version.go`
- By setting `libkb.CustomBuild` ldflag at compile time

For the `libkb.CustomBuild` ldflag, the prerelease scripts use the date format `+%Y%m%d%H%M%S` so that we can build without having to change the build number and commit changes to the repo.

This date format is meant to be both human readable and an ordered number. (An epoch is ordered and not human readable,
and other formats with dashes and dots are not numeric.) For example, 20151215102019 is 12/15/2015 at 10:20:19. We like keeping build number an ordered number (instead of alpha.1) so that we can prevent downgrades and see what time the build occurred.

In addition, a comment with a short sha of the last commit is added as well allowing you to pinpoint more easily where in the git history the build was made.
