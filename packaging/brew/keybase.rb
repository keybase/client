class Keybase < Formula
  desc "Keybase"
  homepage "https://keybase.io/"

  url "https://github.com/keybase/client-beta/archive/v1.0.0-15.tar.gz"
  sha256 "6ceb25b308b2ae3c1b5dd663c4cd49b4e1a3abb74e585273247b1abd51f537cb"

  head "https://github.com/keybase/client-beta.git"
  version "1.0.0-15"

  # bottle do
  #   cellar :any
  #   root_url "https://github.com/keybase/client-beta/releases/download/v1.0.0-15"
  #   sha256 "3c8eeac9fd3012158713f477d907ddae806c4c910da568ec971c9fb33ed055b2" => :yosemite
  # end

  depends_on "go" => :build

  def install
    ENV["GOPATH"] = buildpath
    ENV["GOBIN"] = buildpath
    system "mkdir", "-p", "src/github.com/keybase/"
    system "mv", "client", "src/github.com/keybase/"

    system "go", "get", "github.com/keybase/client/go/keybase"
    system "go", "install", "github.com/keybase/client/go/keybase"

    bin.install "keybase"
  end

  def post_install
    system "#{opt_bin}/keybase", "launchd", "install", "homebrew.mxcl.keybase", "#{opt_bin}/keybase", "--run-mode=devel"
  end

  test do
    system "#{bin}/keybase", "version", "-d"
  end
end
