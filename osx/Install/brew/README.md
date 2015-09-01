
Tag release: v1.0.0-8 (should match libkb/version.go)
Update source archive ...client/archive/v1.0.0-8.tar.gz
Update source archive SHA256 in keybase.rb: `shasum -a 256 client-1.0.0-8.tar.gz`

To create bottle:

    brew install --build-bottle keybase.rb

To install from source:

    brew install --build-from-source keybase.rb

To install from bottle:

    brew install --force-bottle keybase.rb

To install locally, edit formula to use your GOPATH, and then:

    brew install --HEAD keybase.rb
