// +build windows

package attachments

import (
	"io/ioutil"

	"golang.org/x/net/context"
)

func Quarantine(ctx context.Context, path string) error {
	return ioutil.WriteFile(path+":Zone.Identifier", []byte("[ZoneTransfer]\r\nZoneId=3"), 0644)
}
