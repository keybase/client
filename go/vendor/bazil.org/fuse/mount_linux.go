package fuse

import (
	"fmt"
	"log"
	"net"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"syscall"

	sysunix "golang.org/x/sys/unix"
)

func handleFusermountStderr(errCh chan<- error) func(line string) (ignore bool) {
	return func(line string) (ignore bool) {
		if line == `fusermount: failed to open /etc/fuse.conf: Permission denied` {
			// Silence this particular message, it occurs way too
			// commonly and isn't very relevant to whether the mount
			// succeeds or not.
			return true
		}

		const (
			noMountpointPrefix = `fusermount: failed to access mountpoint `
			noMountpointSuffix = `: No such file or directory`
		)
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

// isBoringFusermountError returns whether the Wait error is
// uninteresting; exit status 1 is.
func isBoringFusermountError(err error) bool {
	if err, ok := err.(*exec.ExitError); ok && err.Exited() {
		if status, ok := err.Sys().(syscall.WaitStatus); ok && status.ExitStatus() == 1 {
			return true
		}
	}
	return false
}

func getDirectMountOptions(dir string, conf *mountConfig, f *os.File) (
	fsName, options string, flag uintptr, err error) {
	fsName = conf.options["fsname"]

	fi, err := os.Lstat(dir)
	if err != nil {
		return "", "", 0, err
	}
	if !fi.IsDir() {
		return "", "", 0, fmt.Errorf("%s is not a directory", dir)
	}
	mode := fi.Mode() | 040000 // expected directory mode in a C-style stat buf

	// TODO: support more of fusermount's options here.
	optionsSlice := []string{
		fmt.Sprintf("fd=%d", f.Fd()),
		fmt.Sprintf("rootmode=%o", mode&syscall.S_IFMT),
		"user_id=0",
		"group_id=0",
	}
	if _, ok := conf.options["allow_other"]; ok {
		optionsSlice = append(optionsSlice, "allow_other")
	}

	flag = sysunix.MS_NOSUID | sysunix.MS_NODEV
	if _, ok := conf.options["ro"]; ok {
		flag |= sysunix.MS_RDONLY
	}

	return fsName, strings.Join(optionsSlice, ","), flag, nil
}

func doDirectMountAsRoot(
	dir string, conf *mountConfig) (f *os.File, err error) {
	f, err = os.OpenFile("/dev/fuse", os.O_RDWR, 0600)
	if err != nil {
		return nil, err
	}
	defer func() {
		if err != nil {
			f.Close()
		}
	}()

	fsName, options, flag, err := getDirectMountOptions(dir, conf, f)
	if err != nil {
		return nil, err
	}

	// Make sure the directory is empty before mounting over it.
	d, err := os.Open(dir)
	if err != nil {
		return nil, err
	}
	fis, err := d.Readdir(0)
	if err != nil {
		d.Close()
		return nil, err
	}
	err = d.Close()
	if err != nil {
		return nil, err
	}
	// TODO: Support the `nonempty` config option.
	if len(fis) != 0 {
		return nil, fmt.Errorf("%s is non-empty", dir)
	}

	err = syscall.Mount(fsName, dir, "fuse", flag, options)
	if err != nil {
		return nil, err
	}
	return f, nil
}

// pollHack was written by hanwen for the go-fuse package, and the
// comment and code below was taken from
// https://github.com/hanwen/go-fuse/commit/4f10e248ebabd3cdf9c0aa3ae58fd15235f82a79
//
// Go 1.9 introduced polling for file I/O. The implementation causes
// the runtime's epoll to take up the last GOMAXPROCS slot, and if
// that happens, we won't have any threads left to service FUSE's
// _OP_POLL request. Prevent this by forcing _OP_POLL to happen, so we
// can say ENOSYS and prevent further _OP_POLL requests.
func pollHack(mountPoint string) error {
	fd, err := syscall.Creat(
		filepath.Join(mountPoint, PollHackName), syscall.O_CREAT)
	if err != nil {
		return err
	}
	pollData := []sysunix.PollFd{{
		Fd:     int32(fd),
		Events: sysunix.POLLIN | sysunix.POLLPRI | sysunix.POLLOUT,
	}}

	// Trigger _OP_POLL, so we can say ENOSYS. We don't care about
	// the return value.
	sysunix.Poll(pollData, 0)
	syscall.Close(fd)
	return nil
}

func mount(dir string, conf *mountConfig, ready chan<- struct{}, _ *error) (fusefd *os.File, err error) {
	defer func() {
		if err == nil {
			// If we successfully mounted, then force a poll lookup as
			// one of the first mountpoint requests, so that the
			// kernel will receive an ENOSYS immediately and not risk
			// deadlocks on future poll requests coming in via
			// different threads.
			go func() {
				_ = pollHack(dir)
			}()
		}
	}()

	// linux mount is never delayed
	close(ready)

	if os.Geteuid() == 0 {
		// If we are running as root, we can avoid the security risks
		// that come along with exec'ing fusermount and just mount
		// directly.
		return doDirectMountAsRoot(dir, conf)
	}

	fds, err := syscall.Socketpair(syscall.AF_FILE, syscall.SOCK_STREAM, 0)
	if err != nil {
		return nil, fmt.Errorf("socketpair error: %v", err)
	}

	writeFile := os.NewFile(uintptr(fds[0]), "fusermount-child-writes")
	defer writeFile.Close()

	readFile := os.NewFile(uintptr(fds[1]), "fusermount-parent-reads")
	defer readFile.Close()

	cmd := exec.Command(
		"fusermount",
		"-o", conf.getOptions(),
		"--",
		dir,
	)
	cmd.Env = append(os.Environ(), "_FUSE_COMMFD=3")

	cmd.ExtraFiles = []*os.File{writeFile}

	var wg sync.WaitGroup
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return nil, fmt.Errorf("setting up fusermount stderr: %v", err)
	}
	stderr, err := cmd.StderrPipe()
	if err != nil {
		return nil, fmt.Errorf("setting up fusermount stderr: %v", err)
	}

	if err := cmd.Start(); err != nil {
		return nil, fmt.Errorf("fusermount: %v", err)
	}
	helperErrCh := make(chan error, 1)
	wg.Add(2)
	go lineLogger(&wg, "mount helper output", neverIgnoreLine, stdout)
	go lineLogger(&wg, "mount helper error", handleFusermountStderr(helperErrCh), stderr)
	wg.Wait()
	if err := cmd.Wait(); err != nil {
		// see if we have a better error to report
		select {
		case helperErr := <-helperErrCh:
			// log the Wait error if it's not what we expected
			if !isBoringFusermountError(err) {
				log.Printf("mount helper failed: %v", err)
			}
			// and now return what we grabbed from stderr as the real
			// error
			return nil, helperErr
		default:
			// nope, fall back to generic message
		}

		return nil, fmt.Errorf("fusermount: %v", err)
	}

	c, err := net.FileConn(readFile)
	if err != nil {
		return nil, fmt.Errorf("FileConn from fusermount socket: %v", err)
	}
	defer c.Close()

	uc, ok := c.(*net.UnixConn)
	if !ok {
		return nil, fmt.Errorf("unexpected FileConn type; expected UnixConn, got %T", c)
	}

	buf := make([]byte, 32) // expect 1 byte
	oob := make([]byte, 32) // expect 24 bytes
	_, oobn, _, _, err := uc.ReadMsgUnix(buf, oob)
	scms, err := syscall.ParseSocketControlMessage(oob[:oobn])
	if err != nil {
		return nil, fmt.Errorf("ParseSocketControlMessage: %v", err)
	}
	if len(scms) != 1 {
		return nil, fmt.Errorf("expected 1 SocketControlMessage; got scms = %#v", scms)
	}
	scm := scms[0]
	gotFds, err := syscall.ParseUnixRights(&scm)
	if err != nil {
		return nil, fmt.Errorf("syscall.ParseUnixRights: %v", err)
	}
	if len(gotFds) != 1 {
		return nil, fmt.Errorf("wanted 1 fd; got %#v", gotFds)
	}
	f := os.NewFile(uintptr(gotFds[0]), "/dev/fuse")
	return f, nil
}
