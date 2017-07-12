package hostmanifest

import (
	"encoding/json"
	"os"
	"path/filepath"
)

// whitelistPath is used for installing the whitelist as a JSON into a given
// path on disk.
type whitelistPath struct {
	// Root is the path of the machine-global NativeMessage whitelists.
	Root string
	// Home is the path of the NativeMessage whitelists for regular users.
	Home string
}

func (w *whitelistPath) path(u User, appID string) string {
	if u.IsAdmin() {
		return filepath.Join(u.PrefixPath(), w.Root, appID+".json")
	}
	return filepath.Join(u.PrefixPath(), w.Home, appID+".json")
}

func (w *whitelistPath) Install(u User, app AppManifest) error {
	jsonPath := w.path(u, app.ID())
	parentDir := filepath.Dir(jsonPath)

	// Make the path if it doesn't exist
	if err := os.MkdirAll(parentDir, os.ModePerm); err != nil {
		return wrapWriteErr(err, parentDir)
	}

	// Write the file
	fp, err := os.OpenFile(jsonPath, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0644)
	if err != nil {
		return wrapWriteErr(err, jsonPath)
	}
	defer fp.Close()

	encoder := json.NewEncoder(fp)
	encoder.SetIndent("", "    ")
	if err := encoder.Encode(&app); err != nil {
		return err
	}

	return fp.Sync()
}

func (w *whitelistPath) Uninstall(u User, app AppManifest) error {
	jsonPath := w.path(u, app.ID())
	if err := os.Remove(jsonPath); err != nil && !os.IsNotExist(err) {
		// We don't care if it doesn't exist, but other errors should escalate
		return err
	}
	return nil
}
