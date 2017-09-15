package libkbfs

import (
	"io"
	"net"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
)

// KBFSService represents a running KBFS service.
type KBFSService struct {
	log    logger.Logger
	kbCtx  Context
	stopCh chan struct{}
}

// NewKBFSService creates a new KBFSService.
func NewKBFSService(kbCtx Context, log logger.Logger) (*KBFSService, error) {
	l, err := kbCtx.BindToKBFSSocket()
	if err != nil {
		return nil, err
	}
	k := &KBFSService{
		log:   log,
		kbCtx: kbCtx,
	}
	k.Run(l)
	return k, nil
}

// Run starts listening on the passed-in listener.
func (k *KBFSService) Run(l net.Listener) {
	go k.listenLoop(l)
}

// registerProtocols registers protocols for this KBFSService.
func (k *KBFSService) registerProtocols(
	srv *rpc.Server, xp rpc.Transporter) error {
	// TODO: fill in with actual protocols.
	protocols := []rpc.Protocol{}
	for _, proto := range protocols {
		if err := srv.Register(proto); err != nil {
			return err
		}
	}
	return nil
}

// handle creates a server on an established connection.
func (k *KBFSService) handle(c net.Conn) {
	xp := rpc.NewTransport(c, k.kbCtx.NewRPCLogFactory(), libkb.WrapError)

	server := rpc.NewServer(xp, libkb.WrapError)

	err := k.registerProtocols(server, xp)

	if err != nil {
		k.log.Warning("RegisterProtocols error: %s", err)
		return
	}

	// Run the server, then wait for it or this KBFSService to finish. If
	// KBFSService finishes first, close the connection.
	serverCh := server.Run()
	go func() {
		select {
		case <-k.stopCh:
		case <-serverCh:
		}
		c.Close()
	}()
	<-serverCh

	// err is always non-nil.
	err = server.Err()
	if err != io.EOF {
		k.log.Warning("Run error: %s", err)
	}

	k.log.Debug("handle() complete")
}

// listenLoop listens on a passed-in listener and calls `handle` for any
// connection that is established on the listener.
func (k *KBFSService) listenLoop(l net.Listener) error {
	go func() {
		<-k.stopCh
		l.Close()
	}()
	defer l.Close()
	for {
		c, err := l.Accept()
		if err != nil {

			if libkb.IsSocketClosedError(err) {
				err = nil
			}

			k.log.Debug("listenLoop() done, error: %+v", err)
			return err
		}
		go k.handle(c)
	}
}

// Shutdown shuts down this KBFSService.
func (k *KBFSService) Shutdown() <-chan struct{} {
	select {
	case <-k.stopCh:
	default:
		close(k.stopCh)
	}
	return k.stopCh
}
