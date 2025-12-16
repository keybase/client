//go:build (!darwin && !windows) || ios
// +build !darwin,!windows ios

package simplefs

import "context"

// Quarantine is for adding the mark of the web.
func Quarantine(ctx context.Context, path string) error {
	return nil
}

func limitFilenameLengthForWindowsDownloads(filename string) string {
	return filename
}
