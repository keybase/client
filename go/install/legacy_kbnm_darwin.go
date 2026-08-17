// Copyright 2026 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package install

import (
	"errors"
	"fmt"
	"os"
	"os/user"
	"path/filepath"
)

const legacyKBNMManifestName = "io.keybase.kbnm.json"

func legacyKBNMManifestPaths(homeDir string, isAdmin bool) ([]string, error) {
	if isAdmin {
		return []string{
			filepath.Join("/Library/Google/Chrome/NativeMessagingHosts", legacyKBNMManifestName),
			filepath.Join("/Library/Application Support/Chromium/NativeMessagingHosts", legacyKBNMManifestName),
			filepath.Join("/Library/Application Support/Mozilla/NativeMessagingHosts", legacyKBNMManifestName),
		}, nil
	}

	homeDir = filepath.Clean(homeDir)
	if !filepath.IsAbs(homeDir) || homeDir == string(filepath.Separator) {
		return nil, fmt.Errorf("invalid home directory for legacy native messaging cleanup")
	}

	return []string{
		filepath.Join(homeDir, "Library/Application Support/Google/Chrome/NativeMessagingHosts", legacyKBNMManifestName),
		filepath.Join(homeDir, "Library/Application Support/Chromium/NativeMessagingHosts", legacyKBNMManifestName),
		filepath.Join(homeDir, "Library/Application Support/Mozilla/NativeMessagingHosts", legacyKBNMManifestName),
	}, nil
}

func removeLegacyKBNMManifests(paths []string) error {
	var errs []error
	for _, path := range paths {
		if err := os.Remove(path); err != nil && !errors.Is(err, os.ErrNotExist) {
			errs = append(errs, fmt.Errorf("remove %q: %w", path, err))
		}
	}
	return errors.Join(errs...)
}

// cleanupLegacyKBNM removes manifests left by clients released before the
// browser extension was retired. Keep this best-effort so stale filesystem
// permissions cannot prevent Keybase itself from being installed or removed.
func cleanupLegacyKBNM(log Log) {
	currentUser, err := user.Current()
	if err != nil {
		log.Warning("Unable to determine the current user for legacy native messaging cleanup: %s", err)
		return
	}

	paths, err := legacyKBNMManifestPaths(currentUser.HomeDir, currentUser.Uid == "0")
	if err == nil {
		err = removeLegacyKBNMManifests(paths)
	}
	if err != nil {
		log.Warning("Unable to remove all legacy native messaging manifests: %s", err)
	}
}
