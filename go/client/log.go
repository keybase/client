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
	switch arg.Level {
	case keybase1.LogLevel_DEBUG:
		s.G().Log.Debug("%s", msg)
	case keybase1.LogLevel_INFO:
		s.G().Log.Info("%s", msg)
	case keybase1.LogLevel_WARN:
		s.G().Log.Warning("%s", msg)
	case keybase1.LogLevel_ERROR:
		s.G().Log.Errorf("%s", msg)
	case keybase1.LogLevel_NOTICE:
		s.G().Log.Notice("%s", msg)
	case keybase1.LogLevel_CRITICAL:
		s.G().Log.Critical("%s", msg)
	default:
		s.G().Log.Warning("%s", msg)
	}
	return nil
}
