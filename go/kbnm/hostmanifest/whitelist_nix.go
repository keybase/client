// +build !darwin

package hostmanifest

import (
	"fmt"
	"os"
	"path/filepath"
)

func wrapWriteErr(err error, hostsPath string) error {
	if !os.IsPermission(err) {
		return err
	}
	dirName := filepath.Dir(hostsPath)
	return fmt.Errorf("%s: Make sure you have write permissions on the directory: %q", err, dirName)
}
