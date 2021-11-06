package fuse

import (
	"errors"
	"fmt"
	"log"
	"os"
	"os/exec"
	"path"
	"strconv"
	"strings"
	"sync"
	"syscall"
)

var (
	errNoAvail   = errors.New("no available fuse devices")
	errNotLoaded = errors.New("osxfuse is not loaded")
)

func loadOSXFUSE(bin string) error {
	cmd := exec.Command(bin)
	cmd.Dir = "/"
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	err := cmd.Run()
	return err
}

func loadMacFuseIfNeeded(devPrefix string, bin string) error {
	// We only need to check if any fuse device exists. They start with index 0
	// so checking 0 is enough.
	if _, err := os.Stat(devPrefix + "0"); os.IsNotExist(err) {
		return loadOSXFUSE(bin)
	} else {
		return err
	}
}

func openOSXFUSEDev(devPrefix string) (*os.File, error) {
	var f *os.File
	var err error
	for i := uint64(0); ; i++ {
		path := devPrefix + strconv.FormatUint(i, 10)
		f, err = os.OpenFile(path, os.O_RDWR, 0000)
		if os.IsNotExist(err) {
			if i == 0 {
				// not even the first device was found -> fuse is not loaded
				return nil, errNotLoaded
			}

			// we've run out of kernel-provided devices
			return nil, errNoAvail
		}

		if err2, ok := err.(*os.PathError); ok && err2.Err == syscall.EBUSY {
			// try the next one
			continue
		}

		if err != nil {
			return nil, err
		}
		return f, nil
	}
}

func handleMountOSXFUSE(helperName string, errCh chan<- error) func(line string) (ignore bool) {
	var noMountpointPrefix = helperName + `: `
	const noMountpointSuffix = `: No such file or directory`
	return func(line string) (ignore bool) {
		if strings.HasPrefix(line, noMountpointPrefix) && strings.HasSuffix(line, noMountpointSuffix) {
			// re-extract it from the error message in case some layer
			// changed the path
			mountpoint := line[len(noMountpointPrefix) : len(line)-len(noMountpointSuffix)]
			err := &MountpointDoesNotExistError{
				Path: mountpoint,
			}
			select {
			case errCh <- err:
				return true
			default:
				// not the first error; fall back to logging it
				return false
			}
		}

		return false
	}
}

// isBoringMountOSXFUSEError returns whether the Wait error is
// uninteresting; exit status 64 is.
func isBoringMountOSXFUSEError(err error) bool {
	if err, ok := err.(*exec.ExitError); ok && err.Exited() {
		if status, ok := err.Sys().(syscall.WaitStatus); ok && status.ExitStatus() == 64 {
			return true
		}
	}
	return false
}

func receiveDeviceFD(ourSocketFD int) (*os.File, error) {
	// Out-of-band data. This is where the cmsg is stored in, and cmsg is
	// where the FD gets passed back to us. Here's a FreeBSD doc that's
	// related: https://www.freebsd.org/cgi/man.cgi?query=recvmsg&sektion=2
	// It's not darwin but should be similar enough.
	//
	// The data in the Cmsg is the FD. We are assuming 8 bytes instead of 4
	// just to be safe.
	oob := make([]byte, syscall.CmsgLen(8))
	_, oobn, _, _, err := syscall.Recvmsg(ourSocketFD, nil, oob, 0)
	if err != nil {
		return nil, err
	}
	msgs, err := syscall.ParseSocketControlMessage(oob[:oobn])
	if err != nil {
		return nil, fmt.Errorf("ParseSocketControlMessage error: %v", err)
	}
	if len(msgs) == 0 {
		return nil, errors.New("zero SocketControlMessage parsed")
	}
	fds, err := syscall.ParseUnixRights(&msgs[0])
	if err != nil {
		return nil, fmt.Errorf("ParseUnixRights error: %v", err)
	}
	if len(fds) != 1 {
		return nil, fmt.Errorf(
			"unexpected amount of FDs received. Expected 1; got %d", len(fds))
	}
	f := os.NewFile(uintptr(fds[0]), "")
	if f == nil {
		return nil, errors.New("empty *os.File returned by os.NewFile. bad fd?")
	}
	return f, nil
}

func callMount(bin string, daemonVar string, dir string, conf *mountConfig,
	ready chan<- struct{}, errp *error) (f *os.File, err error) {
	for k, v := range conf.options {
		if strings.Contains(k, ",") || strings.Contains(v, ",") {
			// Silly limitation but the mount helper does not
			// understand any escaping. See TestMountOptionCommaError.
			return nil, fmt.Errorf("mount options cannot contain commas on darwin: %q=%q", k, v)
		}
	}
	cmd := exec.Command(
		bin,
		"-o", conf.getOptions(),
		// Tell osxfuse-kext how large our buffer is. It must split
		// writes larger than this into multiple writes.
		//
		// OSXFUSE seems to ignore InitResponse.MaxWrite, and uses
		// this instead.
		"-o", "iosize="+strconv.FormatUint(maxWrite, 10),
		dir,
	)
	cmd.Env = os.Environ()
	// OSXFUSE <3.3.0
	cmd.Env = append(cmd.Env, "MOUNT_FUSEFS_CALL_BY_LIB=")
	// OSXFUSE >=3.3.0
	cmd.Env = append(cmd.Env, "MOUNT_OSXFUSE_CALL_BY_LIB=")
	// OSXFUSE >=4.0.0
	cmd.Env = append(cmd.Env, "_FUSE_CALL_BY_LIB=")

	daemon := os.Args[0]
	if daemonVar != "" {
		cmd.Env = append(cmd.Env, daemonVar+"="+daemon)
	}

	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return nil, fmt.Errorf("setting up mount_osxfusefs stderr: %v", err)
	}
	stderr, err := cmd.StderrPipe()
	if err != nil {
		return nil, fmt.Errorf("setting up mount_osxfusefs stderr: %v", err)
	}

	// Make a pair of socket FDs and pass it in to the mounter command.
	fds, err := syscall.Socketpair(syscall.AF_UNIX, syscall.SOCK_STREAM, 0)
	if err != nil {
		return nil, err
	}
	theirFD := fds[0]
	ourFD := fds[1]
	cmd.Env = append(cmd.Env, "_FUSE_COMMFD="+strconv.Itoa(theirFD))

	theirFDClosed := false
	defer syscall.Close(ourFD)
	defer func() {
		if !theirFDClosed {
			syscall.Close(theirFD)
		}
	}()

	if err := cmd.Start(); err != nil {
		return nil, fmt.Errorf("mount_osxfusefs: %v", err)
	}

	// After calling the mount helper, we need to assume the volume has been
	// mounted. So we need to call umount in case error happens when trying to
	// receive the fd.
	//
	// This is important because otherwise since some file system operations
	// are delayed until the FUSE volume has been initialized (FUSE_INIT), some
	// system processes will be put on hold until the mount is complete or the
	// volume is unmounted due to daemon_timeout. When it happens, Safari
	// refuses to laod any page and reboot gets stuck as well.
	//
	// We don't have to call unmount if cmd.Start() returns an error because it
	// only returns an error if starting the process fails.
	defer func() {
		if err != nil {
			log.Printf(
				"calling syscall.Unmount because callMount failed: %v", err)
			if err := syscall.Unmount(dir, 0); err != nil {
				log.Printf("syscall.Unmount failed: %v", err)
			}
		}
	}()

	if err = syscall.Close(theirFD); err != nil {
		return nil, fmt.Errorf(
			"mount_osxfusefs: closing our copy of their FD error: %v", err)
	}
	theirFDClosed = true

	helperErrCh := make(chan error, 1)
	go func() {
		var wg sync.WaitGroup
		wg.Add(2)
		go lineLogger(&wg, "mount helper output", neverIgnoreLine, stdout)
		helperName := path.Base(bin)
		go lineLogger(&wg, "mount helper error", handleMountOSXFUSE(helperName, helperErrCh), stderr)
		wg.Wait()
		if err := cmd.Wait(); err != nil {
			// see if we have a better error to report
			select {
			case helperErr := <-helperErrCh:
				// log the Wait error if it's not what we expected
				if !isBoringMountOSXFUSEError(err) {
					log.Printf("mount helper failed: %v", err)
				}
				// and now return what we grabbed from stderr as the real
				// error
				*errp = helperErr
				close(ready)
				return
			default:
				// nope, fall back to generic message
			}

			*errp = fmt.Errorf("mount_osxfusefs: %v", err)
			close(ready)
			return
		}

		*errp = nil
		close(ready)
	}()

	deviceF, err := receiveDeviceFD(ourFD)
	if err != nil {
		return nil, fmt.Errorf(
			"mount_osxfusefs: receiving device FD error: %v", err)
	}

	return deviceF, nil
}

func mount(dir string, conf *mountConfig, ready chan<- struct{}, errp *error) (*os.File, error) {
	locations := conf.osxfuseLocations
	if locations == nil {
		locations = []OSXFUSEPaths{
			OSXFUSELocationV3,
			OSXFUSELocationV2,
		}
	}
	for _, loc := range locations {
		if _, err := os.Stat(loc.Mount); os.IsNotExist(err) {
			// try the other locations
			continue
		}

		if err := loadMacFuseIfNeeded(loc.DevicePrefix, loc.Load); err != nil {
			return nil, err
		}
		f, err := callMount(
			loc.Mount, loc.DaemonVar, dir, conf, ready, errp)
		if err != nil {
			return nil, err
		}
		return f, nil
	}
	return nil, ErrOSXFUSENotFound
}
