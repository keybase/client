gobindPlugin invokes gomobile bind command on the specified package.

# Usage

build.gradle:
<pre>
plugins {
  id "org.golang.mobile.bind" version "0.2.9"
}

gobind {
  // Package to bind. Separate multiple packages with spaces.
  pkg="github.com/someone/somepackage"

  // GOPATH
  GOPATH="/home/gopher"

  // Optional list of architectures. Defaults to all supported architectures.
  GOARCH="arm amd64"

  // Absolute path to the gomobile binary. Optional.
  GOMOBILE="/mypath/bin/gomobile"

  // Absolute path to the gobind binary. Optional.
  GOBIND="/mypath/bin/gobind"

  // Absolute path to the go binary. Optional.
  GO="/usr/local/go/bin/go"

  // Pass extra parameters to command line. Optional.
  GOMOBILEFLAGS="-javapkg my.java.package"
}
</pre>

For details:
https://plugins.gradle.org/plugin/org.golang.mobile.bind

# TODO

* Find the stale aar file (how?)
