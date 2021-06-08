// +build windows

package simplefs

import (
	"io/ioutil"

	"golang.org/x/net/context"
)

// Quarantine is for adding the mark of the web
func Quarantine(ctx context.Context, path string) error {
	return ioutil.WriteFile(path+":Zone.Identifier", []byte("[ZoneTransfer]\r\nZoneId=3"), 0644)
}

// limitFilenameLengthForWindowsDownloads truncates the filename so that its
// length is smaller than or equal to filenameLengthLimit. The reason for this
// is Windows has a limit on path length of 255, but somehow some calls making
// a file that causes the path length go over that is possible. This limits the
// download filename to 200 bytes, which should be enough to add any suffix or
// the X:\Downloads prefix to. Since this operates
func limitFilenameLengthForWindowsDownloads(filename string) string {
	const filenameLengthLimit = 200

	if len(filename) > filenameLengthLimit {
		// Find the last index of UTF-8 rune that doesn't cause us to go over
		// filenameLengthLimit, and use that as the boundary.
		end := 0
		for i, _ := range filename {
			if i > filenameLengthLimit {
				break
			}
			end = i
		}
		return filename[:end]
	}
	return filename
}
