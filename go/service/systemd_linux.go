// +build linux,!android

package service

import (
	"errors"
	"net"

	sdActivation "github.com/coreos/go-systemd/activation"
)

// If the service has been started via socket activation, with a socket already
// open in the environment, return that socket. Otherwise return (nil, nil).
// Currently only implemented for systemd on Linux.
func GetListenerFromEnvironment() (net.Listener, error) {
	listeners, err := sdActivation.Listeners(true /* unsetEnv */)
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
