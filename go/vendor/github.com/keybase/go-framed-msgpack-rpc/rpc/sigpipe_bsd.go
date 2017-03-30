//+build darwin

package rpc

import (
	"net"
	"reflect"
	"syscall"
)

func disableSigPipe(c net.Conn) error {
	// Turn off SIGPIPE for this connection if requested.
	// See: https://github.com/golang/go/issues/17393
	fd := int(reflect.ValueOf(c).Elem().FieldByName("fd").Elem().FieldByName("sysfd").Int())
	return syscall.SetsockoptInt(fd, syscall.SOL_SOCKET, syscall.SO_NOSIGPIPE, 1)
}
