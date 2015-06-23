class Keybase < Formula
  desc "Keybase"
  homepage "https://keybase.io/"

  # Just for testing since brew can't access private repo
  url "https://keybase-app.s3.amazonaws.com/client-v1.0.0-beta.1.tar.gz"
  #url "https://github.com/keybase/client/archive/v1.0.0-beta.1.tar.gz"

  sha256 "6037e413a51ca4d43baf854723d992edc7f6a0f136729a4083ce395c7463bf08"
  head "https://github.com/keybase/client.git"
  version "1.0.0-beta.1"

  bottle do
    cellar :any

    # Just for testing since brew can't access private repo
    root_url "https://keybase-app.s3.amazonaws.com"
    #root_url "https://github.com/keybase/client/releases/download/v1.0.0-beta.1"

    sha256 "3c8eeac9fd3012158713f477d907ddae806c4c910da568ec971c9fb33ed055b2" => :yosemite
  end

  depends_on "go" => :build

  def install
    ENV["GOPATH"] = buildpath
    system "go", "get", "-u", "github.com/keybase/client/go/keybase"
    system "go", "build", "-a", "github.com/keybase/client/go/keybase"
    bin.install "keybase"
  end

  def post_install
    # Automatically restart (unload/load) the service
    Dir.glob("#{opt_prefix}/*.plist").each do |plist_source_path|
      ln_sf plist_source_path, "#{ENV['HOME']}/Library/LaunchAgents"
      plist_dest_path = "#{ENV['HOME']}/Library/LaunchAgents/#{File.basename(plist_source_path)}"
      system "launchctl", "unload", plist_dest_path
      system "launchctl", "load", "-w", plist_dest_path
    end
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
        <string>#{opt_bin}/keybase</string>
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
