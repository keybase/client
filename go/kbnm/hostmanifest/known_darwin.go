package hostmanifest

// KnownInstallers returns a map of browser-to-Installer that this package
// knows about for this platform. If overlay is not empty, then all paths are
// prefixed with the overlay path.
func KnownInstallers(overlay string) map[string]Installer {
	return map[string]Installer{
		// https://developer.chrome.com/extensions/nativeMessaging#native-messaging-host-location-nix
		"chrome": &whitelistPath{
			Root:    "/Library/Google/Chrome/NativeMessagingHosts",
			Home:    "Library/Application Support/Google/Chrome/NativeMessagingHosts",
			Overlay: overlay,
		},
		"chromium": &whitelistPath{
			Root:    "/Library/Application Support/Chromium/NativeMessagingHosts",
			Home:    "Library/Application Support/Chromium/NativeMessagingHosts",
			Overlay: overlay,
		},
		// https://developer.mozilla.org/en-US/Add-ons/WebExtensions/Native_messaging
		"firefox": &whitelistPath{
			Root:    "/Library/Application Support/Mozilla/NativeMessagingHosts",
			Home:    "Library/Application Support/Mozilla/NativeMessagingHosts",
			Overlay: overlay,
		},
	}
}
