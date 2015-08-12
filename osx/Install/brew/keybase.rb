class Keybase < Formula
  desc "Keybase"
  homepage "https://keybase.io/"

  # Just for testing since brew can't access private repo
  url "https://keybase-app.s3.amazonaws.com/client-1.0.0-beta.8.tar.gz"
  #url "https://github.com/keybase/client/archive/v1.0.0-beta.8.tar.gz"

  sha256 "645bf9ea42bd8ea17f1212a1d04ac3aafab4faa70bbe9da4ae66ebc4e18b8e47"
  head "https://github.com/keybase/client.git"
  version "1.0.0-beta.8"

  bottle do
    cellar :any

    # Just for testing since brew can't access private repo
    root_url "https://keybase-app.s3.amazonaws.com"
    #root_url "https://github.com/keybase/client/releases/download/v1.0.0-beta.8"

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
      plist_dest_path = "#{ENV['HOME']}/Library/LaunchAgents/#{File.basename(plist_source_path)}"

      rm plist_dest_path
      cp plist_source_path, "#{ENV['HOME']}/Library/LaunchAgents/"

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
        <string>--log-format=file</string>
        <string>service</string>
      </array>
      <key>KeepAlive</key>
      <true/>
      <key>RunAtLoad</key>
      <true/>
      <key>StandardErrorPath</key>
      <string>#{ENV['HOME']}/Library/Logs/#{plist_name}.log</string>
      <key>StandardOutPath</key>
      <string>#{ENV['HOME']}/Library/Logs/#{plist_name}.log</string>
    </dict>
    </plist>
    EOS
  end

  test do
    system "#{bin}/keybase", "version"
  end
end
