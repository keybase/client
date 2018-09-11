// +build !darwin

package rpc

import "net"

func DisableSigPipe(c net.Conn) error {
	return nil
}
