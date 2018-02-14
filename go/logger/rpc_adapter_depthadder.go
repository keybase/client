package logger

import "github.com/keybase/go-framed-msgpack-rpc/rpc"

type LogOutputWithDepthAdder struct {
	Logger
}

var _ rpc.LogOutput = LogOutputWithDepthAdder{}

// CloneWithAddedDepth implements the rpc.LogOutput interface.
func (l LogOutputWithDepthAdder) CloneWithAddedDepth(depth int) rpc.LogOutputWithDepthAdder {
	return LogOutputWithDepthAdder{l.Logger.CloneWithAddedDepth(depth)}
}
