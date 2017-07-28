package installer

import (
	"os"
	"path/filepath"
	"strings"

	"github.com/keybase/client/go/kbnm/hostmanifest"
)

const kbnmAppName = "io.keybase.kbnm"

// CurrentUser returns a hostmanifest.User while allowing for overrides using
// environment variables:
// * KBNM_INSTALL_ROOT != "" will force the user paths to be root
// * KBNM_INSTALL_OVERLAY will prefix the paths
func CurrentUser() (hostmanifest.User, error) {
	u, err := hostmanifest.CurrentUser()
	if err != nil {
		return nil, err
	}
	if os.Getenv("KBNM_INSTALL_ROOT") != "" {
		u.Admin = true
		u.Path = ""
	}
	overlay := os.Getenv("KBNM_INSTALL_OVERLAY")
	if overlay != "" {
		u.Path = filepath.Join(overlay, u.Path)
	}
	return u, err
}

// UninstallKBNM removes NativeMessaging whitelisting for KBNM.
func UninstallKBNM() error {
	u, err := CurrentUser()
	if err != nil {
		return err
	}

	app := hostmanifest.App{
		Name: kbnmAppName,
	}

	for _, whitelist := range hostmanifest.KnownInstallers() {
		if err := whitelist.Uninstall(u, app); err != nil {
			return err
		}
	}

	return nil
}

// InstallKBNM writes NativeMessaging whitelisting for KBNM.
func InstallKBNM(path string) error {
	u, err := CurrentUser()
	if err != nil {
		return err
	}

	// If we're installing in an overlay, we need to strip it as a prefix from
	// the path we detect.
	overlay := os.Getenv("KBNM_INSTALL_OVERLAY")
	if overlay != "" {
		// This is a bit arcane because filepath.HasPrefix deprecated due to
		// being broken, but what it does is it attempts to map path as
		// relative to overlay. If it succeeds and they're both absolute paths
		// (which means the relative path won't start with "../"), then make
		// path an absolute path with the overlay removed
		// filepath.Rel takes care of normalizing paths which is an advantage
		// over direct string comparisons which would be simpler.
		rel, err := filepath.Rel(overlay, path)
		if err == nil && !strings.HasPrefix(rel, ".") {
			path = "/" + rel
		}
	}

	app := hostmanifest.App{
		Name:        kbnmAppName,
		Description: "Keybase Native Messaging API",
		Path:        path,
		Type:        "stdio",
	}

	var manifest hostmanifest.AppManifest
	for browser, whitelist := range hostmanifest.KnownInstallers() {
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
