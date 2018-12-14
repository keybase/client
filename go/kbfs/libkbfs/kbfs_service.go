package libkbfs

import (
	"errors"
	"io"
	"net"
	"sync"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/systemd"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	kbgitkbfs "github.com/keybase/kbfs/protocol/kbgitkbfs1"
)

// KBFSErrorUnwrapper unwraps errors from the KBFS service.
type KBFSErrorUnwrapper struct {
}

var _ rpc.ErrorUnwrapper = KBFSErrorUnwrapper{}

// MakeArg implements rpc.ErrorUnwrapper.
func (eu KBFSErrorUnwrapper) MakeArg() interface{} {
	return &keybase1.Status{}
}

// UnwrapError implements rpc.ErrorUnwrapper.
func (eu KBFSErrorUnwrapper) UnwrapError(arg interface{}) (appError error,
	dispatchError error) {
	s, ok := arg.(*keybase1.Status)
	if !ok {
		return nil, errors.New("Error converting arg to keybase1.Status object in DiskCacheErrorUnwrapper.UnwrapError")
	}

	if s == nil || s.Code == 0 {
		return nil, nil
	}

	switch s.Code {
	case StatusCodeDiskBlockCacheError:
		appError = DiskBlockCacheError{Msg: s.Desc}
		break
	default:
		ase := libkb.AppStatusError{
			Code:   s.Code,
			Name:   s.Name,
			Desc:   s.Desc,
			Fields: make(map[string]string),
		}
		for _, f := range s.Fields {
			ase.Fields[f.Key] = f.Value
		}
		appError = ase
	}

	return appError, nil
}

type kbfsServiceConfig interface {
	diskBlockCacheGetter
	logMaker
	syncedTlfGetterSetter
}

// KBFSService represents a running KBFS service.
type KBFSService struct {
	config   kbfsServiceConfig
	log      logger.Logger
	kbCtx    Context
	stopOnce sync.Once
	stopCh   chan struct{}
}

// NewKBFSService creates a new KBFSService.
func NewKBFSService(kbCtx Context, config kbfsServiceConfig) (
	*KBFSService, error) {
	log := config.MakeLogger("FSS")
	// Check to see if we're receiving a socket from systemd. If not, create
	// one and bind to it.
	listener, err := systemd.GetListenerFromEnvironment()
	if err != nil {
		return nil, err
	}
	if listener != nil {
		log.Debug("Found listener in the environment. Listening on fd 3.")
	} else {
		log.Debug("No listener found in the environment. Binding a new socket.")
		listener, err = kbCtx.BindToKBFSSocket()
		if err != nil {
			return nil, err
		}
	}
	k := &KBFSService{
		config: config,
		log:    log,
		kbCtx:  kbCtx,
	}
	k.Run(listener)
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
	protocols := []rpc.Protocol{
		kbgitkbfs.DiskBlockCacheProtocol(NewDiskBlockCacheService(k.config)),
	}
	for _, proto := range protocols {
		if err := srv.Register(proto); err != nil {
			return err
		}
	}
	return nil
}

// handle creates a server on an established connection.
func (k *KBFSService) handle(c net.Conn) {
	xp := rpc.NewTransport(c, k.kbCtx.NewRPCLogFactory(), libkb.WrapError, rpc.DefaultMaxFrameLength)

	server := rpc.NewServer(xp, libkb.WrapError)

	err := k.registerProtocols(server, xp)

	if err != nil {
		k.log.Warning("RegisterProtocols error: %s", err)
		return
	}

	// Run the server, then wait for it or this KBFSService to finish.
	serverCh := server.Run()
	go func() {
		select {
		case <-k.stopCh:
		case <-serverCh:
		}
		// Close is idempotent, so always close when we're done.
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
func (k *KBFSService) Shutdown() {
	k.stopOnce.Do(func() {
		close(k.stopCh)
	})
}
