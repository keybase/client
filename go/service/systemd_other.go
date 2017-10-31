// +build !linux android

package service

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
