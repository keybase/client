// +build !linux android

package service

import "net"

// Currently only implemented for systemd on Linux.
func GetListenerFromEnvironment() (net.Listener, error) {
	return nil, nil
}
