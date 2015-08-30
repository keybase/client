class Keybase < Formula
  desc "Keybase"
  homepage "https://keybase.io/"

  #url "https://github.com/keybase/client/archive/v1.0.0-11.tar.gz"
  #sha256 "645bf9ea42bd8ea17f1212a1d04ac3aafab4faa70bbe9da4ae66ebc4e18b8e47"

  head "https://github.com/keybase/client.git"
  version "1.0.0-11"

  # bottle do
  #   cellar :any
  #   root_url "https://github.com/keybase/client/releases/download/v1.0.0-11"
  #   sha256 "3c8eeac9fd3012158713f477d907ddae806c4c910da568ec971c9fb33ed055b2" => :yosemite
  # end

  depends_on "go" => :build

  def install
    # ENV["GOPATH"] = buildpath
    # system "go", "get", "-u", "github.com/keybase/client/go/keybase"

    # Currently doing local installs since repo is private
    ENV["GOPATH"] = "/Users/gabe/Projects/go"
    system "go", "build", "-a", "github.com/keybase/client/go/keybase"


    bin.install "keybase"
    keybase_bin = "#{bin}/keybase"
    system keybase_bin, "launchd", "install", "homebrew.mxcl.keybase", keybase_bin
  end

  test do
    system "#{bin}/keybase", "version", "-d"
  end
end
