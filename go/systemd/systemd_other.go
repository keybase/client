// +build !linux android

package systemd

import "net"

func IsSocketActivated() bool {
	return false
}

// Currently only implemented for systemd on Linux.
func GetListenerFromEnvironment() (net.Listener, error) {
	return nil, nil
}

// Currently only implemented for systemd on Linux.
func NotifyStartupFinished() {
	// no-op
}
