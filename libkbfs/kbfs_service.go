package libkbfs

import (
	"io"
	"net"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
)

type kbfsService struct {
	log    logger.Logger
	kbCtx  Context
	stopCh chan struct{}
}

func NewKBFSService(kbCtx Context, log logger.Logger) *kbfsService {
	return &kbfsService{
		log:   log,
		kbCtx: kbCtx,
	}
}

func (k *kbfsService) RegisterProtocols(
	srv *rpc.Server, xp rpc.Transporter) error {
	// TODO: fill in with actual protocol.
	protocols := []rpc.Protocol{}
	for _, proto := range protocols {
		if err := srv.Register(proto); err != nil {
			return err
		}
	}
	return nil
}

func (k *kbfsService) Handle(c net.Conn) {
	xp := rpc.NewTransport(c, k.kbCtx.NewRPCLogFactory(), libkb.WrapError)

	server := rpc.NewServer(xp, libkb.WrapError)

	err := k.RegisterProtocols(server, xp)

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

func (k *kbfsService) ListenLoop(l net.Listener) error {
	for {
		c, err := l.Accept()
		if err != nil {

			if libkb.IsSocketClosedError(err) {
				err = nil
			}

			k.log.Debug("Leaving ListenLoop() w/ error %v", err)
			return err
		}
		go k.Handle(c)
	}
}
