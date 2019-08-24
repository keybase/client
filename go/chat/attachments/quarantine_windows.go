// +build windows

package attachments

import (
	"io/ioutil"

	"golang.org/x/net/context"
)

func Quarantine(ctx context.Context, path string) error {
	// Zones 0-4 correspond to Local Machine, Local intranet, Trusted sites, Internet, Restricted sites.
	// https://docs.microsoft.com/en-us/previous-versions/windows/internet-explorer/ie-developer/platform-apis/ms537183(v=vs.85)
	return ioutil.WriteFile(path+":Zone.Identifier", []byte("[ZoneTransfer]\r\nZoneId=3"), 0644)
}
