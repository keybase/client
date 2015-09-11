class Keybase < Formula
  desc "Keybase"
  homepage "https://keybase.io/"

  url "https://github.com/keybase/client-beta/archive/v1.0.0-15.tar.gz"
  sha256 "35dbbb707641c159b82483c40412b25900bb8b4b27a0421f8f1efd5b1843b57d"

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
