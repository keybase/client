## Exporting

This script will export source from the client or kbfs private repositories to a public mirror for beta builds.

- Update the version.go for the client (`go/libkb/version.go`) or kbfs (`libkbfs/version.go`), and commit it.
- Tag this version:

        git tag -a v1.2.3-400 -m v1.2.3-400
        git push --tags

- Run export:

        # For client repo
        sh export.sh client /path/to/client/beta v1.2.3-400

        # For kbfs repo (needs client and kbfs until it has vendoring)
        sh export.sh client /path/to/kbfs/beta v1.2.3-400
        sh export.sh kbfs /path/to/kbfs/beta v1.2.3-400

- Review and commit the changes to the beta repo, as instructed by the export script.
- See [Updating the Brew Formula](https://github.com/keybase/homebrew-beta/blob/master/GUIDE.md#updating-the-formula).
