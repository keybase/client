package hostmanifest

// KnownInstallers returns a map of browser-to-Installer that this package
// knows about for this platform.
func KnownInstallers() map[string]Installer {
	return map[string]Installer{
		// https://developer.chrome.com/extensions/nativeMessaging#native-messaging-host-location-nix
		"chrome": &whitelistPath{
			Root: "/etc/opt/chrome/native-messaging-hosts/",
			Home: ".config/google-chrome/NativeMessagingHosts",
		},
		"chromium": &whitelistPath{
			Root: "/etc/chromium/native-messaging-hosts",
			Home: ".config/chromium/NativeMessagingHosts",
		},
		// https://developer.mozilla.org/en-US/Add-ons/WebExtensions/Native_messaging
		"firefox": &whitelistPath{
			Root: "/usr/lib/mozilla/native-messaging-hosts",
			Home: ".mozilla/native-messaging-hosts",
		},
	}
}
