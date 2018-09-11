// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"bytes"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
)

type LogUIServer struct {
	libkb.Contextified
}

func NewLogUIProtocol(g *libkb.GlobalContext) rpc.Protocol {
	return keybase1.LogUiProtocol(&LogUIServer{Contextified: libkb.NewContextified(g)})
}

func (s LogUIServer) Log(_ context.Context, arg keybase1.LogArg) error {
	buf := new(bytes.Buffer)
	RenderText(s.G(), buf, arg.Text)
	msg := buf.String()
	logger := s.G().Log.CloneWithAddedDepth(1)
	switch arg.Level {
	case keybase1.LogLevel_DEBUG:
		logger.Debug("%s", msg)
	case keybase1.LogLevel_INFO:
		logger.Info("%s", msg)
	case keybase1.LogLevel_WARN:
		logger.Warning("%s", msg)
	case keybase1.LogLevel_ERROR:
		logger.Errorf("%s", msg)
	case keybase1.LogLevel_NOTICE:
		logger.Notice("%s", msg)
	case keybase1.LogLevel_CRITICAL:
		logger.Critical("%s", msg)
	default:
		logger.Warning("%s", msg)
	}
	return nil
}
