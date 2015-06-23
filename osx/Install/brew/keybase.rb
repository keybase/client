class Keybase < Formula
  desc "Keybase"
  homepage "https://keybase.io/"
  # url "https://github.com/keybase/client/archive/1.0.0-beta.1.tar.gz"
  # sha256 "0fbe2d12027dac23d147a626d625116188f589263faa74f76cfd5572d42eada3"
  head "https://github.com/keybase/client.git"

  # bottle do
  #   cellar :any
  #   sha256 "" => :yosemite
  # end

  depends_on "go" => :build

  def install
    ENV["GOPATH"] = buildpath
    system "go", "get", "-u", "github.com/keybase/client/go/keybase"
    system "go", "build", "-a", "github.com/keybase/client/go/keybase"
    bin.install "keybase"
  end

  def plist; <<-EOS.undent
    <?xml version="1.0" encoding="UTF-8"?>
    <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
    <plist version="1.0">
    <dict>
      <key>Label</key>
      <string>#{plist_name}</string>
      <key>ProgramArguments</key>
      <array>
        <string>#{bin}</string>
        <string>service</string>
      </array>
      <key>KeepAlive</key>
      <true/>
      <key>RunAtLoad</key>
      <true/>
    </dict>
    </plist>
    EOS
  end

  test do
    system "#{bin}/keybase", "version"
  end
end
