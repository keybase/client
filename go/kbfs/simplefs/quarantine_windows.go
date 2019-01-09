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
