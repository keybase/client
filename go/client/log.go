package client

import (
	"bytes"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
	rpc "github.com/keybase/go-framed-msgpack-rpc"
)

type LogUIServer struct {
	log libkb.LogUI
}

func NewLogUIProtocol() rpc.Protocol {
	return keybase1.LogUiProtocol(&LogUIServer{G.Log})
}

func (s LogUIServer) Log(_ context.Context, arg keybase1.LogArg) error {
	buf := new(bytes.Buffer)
	RenderText(buf, arg.Text)
	msg := buf.String()
	switch arg.Level {
	case keybase1.LogLevel_DEBUG:
		s.log.Debug(msg)
	case keybase1.LogLevel_INFO:
		s.log.Info(msg)
	case keybase1.LogLevel_WARN:
		s.log.Warning(msg)
	case keybase1.LogLevel_ERROR:
		s.log.Errorf(msg)
	case keybase1.LogLevel_NOTICE:
		s.log.Notice(msg)
	case keybase1.LogLevel_CRITICAL:
		s.log.Critical(msg)
	default:
		s.log.Warning(msg)
	}
	return nil
}
