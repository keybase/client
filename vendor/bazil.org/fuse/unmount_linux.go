package fuse

import (
	"bytes"
	"errors"
	"os"
	"os/exec"

	sysunix "golang.org/x/sys/unix"
)

func unmount(dir string) error {
	if os.Geteuid() == 0 {
		// If we are running as root, we can avoid the security risks
		// that come along with exec'ing fusermount and just unmount
		// directly.  Since we are root, let's just always detach the
		// unmount to enable cases where the root user is forcing an
		// upgrade of a user-based file system but there are still
		// open file handles.  TODO: plumb the detach flag through
		// the public unmount interface.
		return sysunix.Unmount(dir, sysunix.MNT_DETACH)
	}

	cmd := exec.Command("fusermount", "-u", dir)
	output, err := cmd.CombinedOutput()
	if err != nil {
		if len(output) > 0 {
			output = bytes.TrimRight(output, "\n")
			msg := err.Error() + ": " + string(output)
			err = errors.New(msg)
		}
		return err
	}
	return nil
}
