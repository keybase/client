## Exporting a Release

- Update the version or build in `go/libkb/version.go`.
- Commit and tag this version:

        git add go/libkb/version.go
        git commit -m "New version v1.0.0-15"
        git tag -a v1.0.0-15 -m v1.0.0-15
        git push
        git push --tags

- Clone the client-beta repo (if you haven't already): `git clone https://github.com/keybase/client-beta.git /path/to/client-beta`        
- Run export: `sh export.sh /path/to/client-beta v1.0.0-15`
- Review and commit the changes to the client-beta repo, as instructed by the export script.
- See [Updating the Brew Formula](https://github.com/keybase/homebrew-beta#updating-the-formula).
