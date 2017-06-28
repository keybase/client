package hostmanifest

import (
	"encoding/json"
	"os"
	"path/filepath"

	"golang.org/x/sys/windows/registry"
)

// KnownInstallers returns a map of browser-to-Installer that this package
// knows about for this platform.
func KnownInstallers() map[string]Installer {
	return map[string]Installer{
		"chrome": &whitelistRegistry{
			RegKey:     `SOFTWARE\Google\Chrome\NativeMessagingHosts`,
			FileSuffix: `_chrome`,
		},
		"chromium": &whitelistRegistry{
			RegKey:     `SOFTWARE\Chromium\NativeMessagingHosts`,
			FileSuffix: `_chromium`,
		},
		"firefox": &whitelistRegistry{
			RegKey:     `SOFTWARE\Mozilla\NativeMessagingHosts`,
			FileSuffix: `_firefox`,
		},
	}
}

// whitelistRegistry is used for installing the whitelist as a JSON into a given
// registry entry. When Install is called, it will also write a JSON manifest to be adjacent to the app Path.
type whitelistRegistry struct {
	// RegKey is the path of the NativeMessage whitelist registry key
	RegKey string
	// FileSuffix is a suffix for the JSON filename before the extension to
	// avoid collisions across browsers because they're written in the same
	// directory.
	FileSuffix string
}

// writeJSON writes the whitelist manifest JSON file adjacent to the app's
// binary.
func (w *whitelistRegistry) writeJSON(path string, app AppManifest) error {
	// Write the file
	fp, err := os.OpenFile(path, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0644)
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

func (w *whitelistRegistry) paths(app AppManifest) (jsonPath string, keyPath string) {
	parentDir := filepath.Dir(app.BinPath())
	suffix := filepath.Base(w.FileSuffix) // To make sure it's safe to use
	basename := app.ID()
	if suffix != "." {
		basename += suffix
	}

	jsonPath = filepath.Join(parentDir, basename+".json")
	keyPath = filepath.Join(w.RegKey, app.ID())
	return
}

// Install on Windows ignores the provided user and always installs in the
// CURRET_USER context, writing the JSON adjacent to the binary path.
func (w *whitelistRegistry) Install(_ User, app AppManifest) error {
	// We assume that the parentDir already exists, where the binary lives.
	jsonPath, keyPath := w.paths(app)
	if err := w.writeJSON(jsonPath, app); err != nil {
		return err
	}

	scope := registry.CURRENT_USER
	k, _, err := registry.CreateKey(scope, keyPath, registry.SET_VALUE|registry.CREATE_SUB_KEY|registry.WRITE)
	if err != nil {
		return err
	}
	defer k.Close()

	return k.SetStringValue("", jsonPath)
}

func (w *whitelistRegistry) Uninstall(_ User, app AppManifest) error {
	scope := registry.CURRENT_USER
	jsonPath, keyPath := w.paths(app)
	if err := registry.DeleteKey(scope, keyPath); err != nil {
		return err
	}
	if err := os.Remove(jsonPath); err != nil && !os.IsNotExist(err) {
		// We don't care if it doesn't exist, but other errors should escalate
		return err
	}
	return nil
}
