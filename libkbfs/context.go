// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"net"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/go-framed-msgpack-rpc"
)

// Context defines the environment for this package
type Context interface {
	GetRunMode() libkb.RunMode
	GetLogDir() string
	ConfigureSocketInfo() (err error)
	GetSocket(clearError bool) (net.Conn, rpc.Transporter, bool, error)
	NewRPCLogFactory() *libkb.RPCLogFactory
}
