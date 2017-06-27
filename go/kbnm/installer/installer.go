package installer

import (
	"os/user"

	"github.com/keybase/client/go/kbnm/hostmanifest"
)

const kbnmAppName = "io.keybase.kbnm"

// UninstallKBNM removes NativeMessaging whitelisting for KBNM.
func UninstallKBNM(overlay string) error {
	u, err := user.Current()
	if err != nil {
		return err
	}

	app := hostmanifest.App{
		Name: kbnmAppName,
	}

	for _, whitelist := range hostmanifest.KnownInstallers(overlay) {
		if err := whitelist.Uninstall(u, app); err != nil {
			return err
		}
	}

	return nil
}

// UninstallKBNM writes NativeMessaging whitelisting for KBNM.
func InstallKBNM(overlay string, path string) error {
	u, err := user.Current()
	if err != nil {
		return err
	}
	app := hostmanifest.App{
		Name:        kbnmAppName,
		Description: "Keybase Native Messaging API",
		Path:        path,
		Type:        "stdio",
	}

	var manifest hostmanifest.AppManifest
	for browser, whitelist := range hostmanifest.KnownInstallers(overlay) {
		switch browser {
		case "chrome", "chromium":
			manifest = hostmanifest.ChromeApp{
				App: app,
				AllowedOrigins: []string{
					// Production public version in the store
					"chrome-extension://ognfafcpbkogffpmmdglhbjboeojlefj/",
					// Hard-coded key from the repo version
					"chrome-extension://kockbbfoibcdfibclaojljblnhpnjndg/",
					// Keybase-internal version
					"chrome-extension://gnjkbjlgkpiaehpibpdefaieklbfljjm/",
				},
			}
		case "firefox":
			manifest = hostmanifest.FirefoxApp{
				App: app,
				AllowedExtensions: []string{
					"keybase@keybase.io",
				},
			}
		}

		if err := whitelist.Install(u, manifest); err != nil {
			return err
		}
	}
	return nil
}
