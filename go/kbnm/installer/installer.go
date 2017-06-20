package installer

import (
	"encoding/json"
	"os"
	"os/user"
	"path/filepath"
)

type AppManifest interface {
	ID() string
}

type App struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	Path        string `json:"path"`
	Type        string `json:"type"`
}

func (app App) ID() string {
	return app.Name
}

type chromeApp struct {
	App
	AllowedOrigins []string `json:"allowed_origins"`
}

type firefoxApp struct {
	App
	AllowedExtensions []string `json:"allowed_extensions"`
}

func KnownInstallers() map[string]Installer {
	return map[string]Installer{
		// https://developer.chrome.com/extensions/nativeMessaging#native-messaging-host-location-nix
		"chrome": &WhitelistPath{
			Root: "/Library/Google/Chrome/NativeMessagingHosts",
			Home: "Library/Application Support/Google/Chrome/NativeMessagingHosts",
		},
		"chromium": &WhitelistPath{
			Root: "/Library/Application Support/Chromium/NativeMessagingHosts",
			Home: "Library/Application Support/Chromium/NativeMessagingHosts",
		},
		// TODO: MDN link
		"firefox": &WhitelistPath{
			Root: "/Library/Application Support/Mozilla/NativeMessagingHosts",
			Home: "Library/Application Support/Mozilla/NativeMessagingHosts",
		},
	}
}

type Installer interface {
	Install(u *user.User, app AppManifest) error
	Uninstall(u *user.User, app AppManifest) error
}

type WhitelistPath struct {
	Root string
	Home string
}

func (w *WhitelistPath) Path(u *user.User, appID string) string {
	if u.Uid == "0" {
		return filepath.Join(w.Root, appID+".json")
	}
	return filepath.Join(u.HomeDir, w.Home, appID+".json")
}

func (w *WhitelistPath) Install(u *user.User, app AppManifest) error {
	jsonPath := w.Path(u, app.ID())
	parentDir := filepath.Dir(jsonPath)

	// Make the path if it doesn't exist
	if err := os.MkdirAll(parentDir, os.ModePerm); err != nil {
		return err
	}

	// Write the file
	fp, err := os.OpenFile(jsonPath, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0644)
	if err != nil {
		return err
	}
	defer fp.Close()

	encoder := json.NewEncoder(fp)
	encoder.SetIndent("", "    ")
	if err := encoder.Encode(&app); err != nil {
		return err
	}

	return fp.Sync()
}

func (w *WhitelistPath) Uninstall(u *user.User, app AppManifest) error {
	jsonPath := w.Path(u, app.ID())
	if err := os.Remove(jsonPath); err != nil && !os.IsNotExist(err) {
		// We don't care if it doesn't exist, but other errors should escalate
		return err
	}
	return nil
}

const kbnmAppName = "io.keybase.kbnm"

func UninstallKBNM() error {
	u, err := user.Current()
	if err != nil {
		return err
	}

	app := App{
		Name: kbnmAppName,
	}

	for _, whitelist := range KnownInstallers() {
		if err := whitelist.Uninstall(u, app); err != nil {
			return err
		}
	}

	return nil
}

func InstallKBNM(path string) error {
	u, err := user.Current()
	if err != nil {
		return err
	}
	app := App{
		Name:        kbnmAppName,
		Description: "Keybase Native Messaging API",
		Path:        path,
		Type:        "stdio",
	}

	var manifest AppManifest
	for browser, whitelist := range KnownInstallers() {
		switch browser {
		case "chrome", "chromium":
			manifest = chromeApp{
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
			manifest = firefoxApp{
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
