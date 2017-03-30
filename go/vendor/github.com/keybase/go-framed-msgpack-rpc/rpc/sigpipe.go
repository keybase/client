// +build !darwin

package rpc

import "net"

func disableSigPipe(c net.Conn) error {
	return nil
}
