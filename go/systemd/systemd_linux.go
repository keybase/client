// +build linux,!android

package systemd

import (
	"errors"
	"fmt"
	"net"
	"os"
	"os/exec"
	"strings"

	sdActivation "github.com/coreos/go-systemd/activation"
	sdDaemon "github.com/coreos/go-systemd/daemon"
	sdUtil "github.com/coreos/go-systemd/util"
)

// IsUserSystemdRunning checks that systemd is running at the user- (as opposed
// to system-) level. IsRunningSystemd below checks the system level, but there
// are cases where the system level is working while the user level is not.
// Sudo env weirdness can cause it, and it also happens on older distros. In
// those cases, we'll also fall back to non-systemd startup.
//
// This function prints loud warnings because we only ever run it when
// IsRunningSystemd is true, in which case all of these errors are unexpected.
func IsUserSystemdRunning() bool {
	c := exec.Command("systemctl", "--user", "is-system-running")
	output, err := c.Output()
	// Ignore non-zero-exit-status errors, because of "degraded" below.
	_, isExitError := err.(*exec.ExitError)
	if err != nil && !isExitError {
		os.Stderr.WriteString(fmt.Sprintf("Failed to run systemctl: check user manager status: %s\n", err))
		return false
	}
	outputStr := strings.TrimSpace(string(output))

	switch outputStr {
	case "running":
		return true
	case "degraded":
		// "degraded" just means that some service has failed to start. That
		// could be a totally unrelated application on the user's machine, so
		// we treat it the same as "running". Other methods of detecting this
		// have turned out to be inconsistent across machines, like checking
		// the status of dbus or init.scope, or even `systemd-run --user true`.
		// If this is a false positive, user should specify KEYBASE_SYSTEMD=0.
		return true
	case "":
		os.Stderr.WriteString(fmt.Sprintf("Failed to reach user-level systemd daemon.\n"))
		return false
	default:
		os.Stderr.WriteString(fmt.Sprintf("Systemd reported an unexpected status: %s\n", outputStr))
		return false
	}
}

func IsRunningSystemd() bool {
	return sdUtil.IsRunningSystemd() && IsUserSystemdRunning()
}

// NOTE: We no longer configure our keybse.service and kbfs.service units to be
// socket-activated by default. It was causing too much trouble when
// non-systemd instances deleted the socket files. It's possible this issue
// will get fixed in future versions of systemd; see
// https://github.com/systemd/systemd/issues/7274.
func IsSocketActivated() bool {
	return (os.Getenv("LISTEN_FDS") != "")
}

// If the service has been started via socket activation, with a socket already
// open in the environment, return that socket. Otherwise return (nil, nil).
// Currently only implemented for systemd on Linux.
func GetListenerFromEnvironment() (net.Listener, error) {
	// NOTE: If we ever set unsetEnv=true, we need to change IsSocketActivated above.
	listeners, err := sdActivation.Listeners(false /* unsetEnv */)
	if err != nil {
		// Errors here (e.g. out of file descriptors, maybe?) aren't even
		// returned by go-systemd right now, but they could be in the future.
		return nil, err
	}
	if len(listeners) > 1 {
		// More than one socket here probably means a messed up .service file.
		return nil, errors.New("Too many listeners passed from systemd.")
	}
	if len(listeners) == 1 {
		// Found a socket in the environment. Return it.
		return listeners[0], nil
	}
	// No socket found. Either we're not running under systemd at all, or the
	// socket isn't configured. The caller will create its own socket.
	return nil, nil
}

func NotifyStartupFinished() {
	_, _ = sdDaemon.SdNotify(false /* unsetEnv */, "READY=1")
}
