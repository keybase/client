
## Brew

- Edit the URL: `https://github.com/keybase/client-beta/archive/v1.0.0-15.tar.gz`
- Update the sha256: `shasum -a 256 v1.0.0-15.tar.gz`
- Update the version: `version "1.0.0-15"`

Create the bottle:

    brew install --build-bottle keybase.rb
    brew bottle keybase.rb
