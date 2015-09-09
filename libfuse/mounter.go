package libfuse

import (
	"errors"
	"fmt"
	"os/exec"
	"path"
	"runtime"

	"bazil.org/fuse"
)

// Mounter defines interface for different mounting strategies
type Mounter interface {
	Mount() (*fuse.Conn, error)
	Unmount() error
}

// DefaultMounter will only call fuse.Mount and fuse.Unmount directly
type DefaultMounter struct {
	Dir string
}

// Mount uses default mount
func (m DefaultMounter) Mount() (*fuse.Conn, error) {
	return fuse.Mount(m.Dir)
}

// Unmount uses default unmount
func (m DefaultMounter) Unmount() error {
	return fuse.Unmount(m.Dir)
}

// ForceMounter will try its best to get it a mount
type ForceMounter struct {
	Dir string
}

// Mount tries to mount and then unmount, re-mount if unsuccessful
func (m ForceMounter) Mount() (*fuse.Conn, error) {
	// Volume name option is only used on OSX (ignored on other platforms).
	volName, err := volumeName(m.Dir)
	if err != nil {
		return nil, err
	}
	options := []fuse.MountOption{fuse.VolumeName(volName)}

	c, err := fuse.Mount(m.Dir, options...)
	if err == nil {
		return c, nil
	}

	// Mount failed, let's try to unmount and then try mounting again, even
	// if unmounting errors here.
	m.Unmount()

	c, err = fuse.Mount(m.Dir, options...)
	return c, err
}

// Unmount tries to unmount normally and then force if unsuccessful
func (m ForceMounter) Unmount() (err error) {
	// Try unmount
	err = fuse.Unmount(m.Dir)
	if err != nil {
		// Unmount failed, so let's try and force it.
		err = m.forceUnmount()
	}
	return
}

func (m ForceMounter) forceUnmount() (err error) {
	if runtime.GOOS == "darwin" {
		_, err = exec.Command("/usr/sbin/diskutil", "unmountDisk", "force", m.Dir).Output()
	} else if runtime.GOOS == "linux" {
		_, err = exec.Command("umount", "-l", m.Dir).Output()
	} else {
		err = errors.New("Forced unmount is not supported on this platform yet")
	}
	return
}

// volumeName returns the directory (base) name
func volumeName(dir string) (string, error) {
	volName := path.Base(dir)
	if volName == "." || volName == "/" {
		err := fmt.Errorf("Bad volume name: %v", volName)
		return "", err
	}
	return volName, nil
}
