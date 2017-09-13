package libkbfs

import (
	"io"
	"net"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
)

type kbfsService struct {
	log logger.Logger
}

func NewKBFSService(kbCtx Context, log logger.Logger) *kbfsService {
	return &kbfsService{
		log: log,
	}
}

func (k *kbfsService) RegisterProtocols(
	srv *rpc.Server, xp rpc.Transporter) error {
	// TODO: fill in with actual protocol.
	protocols := []rpc.Protocol{}
	for _, proto := range protocols {
		if err = srv.Register(proto); err != nil {
			return err
		}
	}
	return nil
}

func (k *kbfsService) Handle(c net.Conn) {
	xp := rpc.NewTransport(c, libkb.NewRPCLogFactory(d.G()), libkb.WrapError)

	server := rpc.NewServer(xp, libkb.WrapError)

	err := d.RegisterProtocols(server, xp)

	if err != nil {
		k.log.Warning("RegisterProtocols error: %s", err)
		return
	}

	// Run the server and wait for it to finish.
	<-server.Run()
	// err is always non-nil.
	err = server.Err()
	if err != io.EOF {
		k.log.Warning("Run error: %s", err)
	}

	k.log.Debug("Handle() complete")
}
