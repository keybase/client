// +build linux,!android

package systemd

import (
	"errors"
	"net"
	"os"

	sdActivation "github.com/coreos/go-systemd/activation"
	sdDaemon "github.com/coreos/go-systemd/daemon"
	sdUtil "github.com/coreos/go-systemd/util"
)

func IsRunningSystemd() bool {
	return sdUtil.IsRunningSystemd()
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
	sdDaemon.SdNotify(false /* unsetEnv */, "READY=1")
}
