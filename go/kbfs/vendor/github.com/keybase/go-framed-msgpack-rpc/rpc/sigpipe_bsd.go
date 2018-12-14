//+build darwin

package rpc

import (
	"net"
	"reflect"
	"syscall"
)

func DisableSigPipe(c net.Conn) error {
	// Disable SIGPIPE on this connection since we currently need to do this manually for iOS
	// to prevent the signal from crashing iOS apps.
	// See: https://github.com/golang/go/issues/17393
	netFD := reflect.ValueOf(c).Elem().FieldByName("fd").Elem()
	sysfd := netFD.FieldByName("sysfd")
	var fd int
	if sysfd.IsValid() {
		fd = int(sysfd.Int())
	} else { // After go +3792db5
		fd = int(netFD.FieldByName("pfd").FieldByName("Sysfd").Int())
	}
	return syscall.SetsockoptInt(fd, syscall.SOL_SOCKET, syscall.SO_NOSIGPIPE, 1)
}
