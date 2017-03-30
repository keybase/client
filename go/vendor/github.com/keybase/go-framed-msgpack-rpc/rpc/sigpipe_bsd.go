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
	fd := int(reflect.ValueOf(c).Elem().FieldByName("fd").Elem().FieldByName("sysfd").Int())
	return syscall.SetsockoptInt(fd, syscall.SOL_SOCKET, syscall.SO_NOSIGPIPE, 1)
}
