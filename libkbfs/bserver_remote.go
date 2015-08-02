package libkbfs

import (
	"crypto/tls"
	"crypto/x509"
	"encoding/hex"
	"errors"
	"io/ioutil"
	"net"
	"sync"
	"time"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/protocol/go"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
	"golang.org/x/net/context"
)

var (
	// ErrNoActiveConn is an error returned when this component
	// is not yet connected to the block server.
	ErrNoActiveConn = errors.New("Not connected to block server")
	// BServerTimeout is the timeout for communications with block server.
	BServerTimeout = 60 * time.Second
)

// BlockServerRemote implements the BlockServer interface and
// represents a remote KBFS block server.
type BlockServerRemote struct {
	config Config

	srvAddr  string
	certFile string

	// connMu protects both conn and shutdown
	connMu   sync.Mutex
	conn     net.Conn
	shutdown bool

	clt keybase1.GenericClient

	// connectedChan is closed and set to nil when the connection
	// succeeds.  We'd need to create a new connectedChan if we ever
	// want to deal with reconnecting after a disconnect.
	connectedMu   sync.Mutex
	connectedChan chan struct{}

	lastTried time.Time
}

// NewBlockServerRemote constructs a new BlockServerRemote for the
// given address.
func NewBlockServerRemote(ctx context.Context, config Config,
	blkSrvAddr string) *BlockServerRemote {
	b := &BlockServerRemote{
		config:        config,
		srvAddr:       blkSrvAddr,
		certFile:      "./cert.pem",
		connectedChan: make(chan struct{}),
	}

	// Start connecting in the background
	go b.Reconnect(ctx)
	return b
}

// newBlockServerRemoteWithClient should only be used for testing.
func newBlockServerRemoteWithClient(ctx context.Context, config Config,
	client keybase1.GenericClient) *BlockServerRemote {
	b := &BlockServerRemote{
		config:        config,
		connectedChan: make(chan struct{}),
		clt:           client,
	}

	if err := b.ConnectOnce(ctx); err != nil {
		panic("Failed to connect to a provided client.")
	}

	return b
}

// TLSConnect connects over TLS to the given server, expecting the
// connection to be authenticated with the given certificate.
func TLSConnect(cFile string, Addr string) (conn net.Conn, err error) {
	CAPool := x509.NewCertPool()
	var cacert []byte
	cacert, err = ioutil.ReadFile(cFile)
	if err != nil {
		return
	}
	CAPool.AppendCertsFromPEM(cacert)

	config := tls.Config{RootCAs: CAPool}
	conn, err = tls.Dial("tcp", Addr, &config)
	if err != nil {
		return
	}
	return
}

func (b *BlockServerRemote) initClient() error {
	b.connMu.Lock()
	defer b.connMu.Unlock()
	if b.shutdown {
		// Pretend everything is fine.  That will cause the goroutine
		// calling us to exit eventually.
		return nil
	}

	var err error
	if b.conn, err = TLSConnect(b.certFile, b.srvAddr); err != nil {
		libkb.G.Log.Warning("NewBlockServerRemote: cannot connect to backend "+
			"err : %v", err)
		return err
	}

	b.clt = rpc2.NewClient(rpc2.NewTransport(b.conn, libkb.NewRPCLogFactory(),
		libkb.WrapError), libkb.UnwrapError)

	return nil
}

// Config returns the configuration object
func (b *BlockServerRemote) Config() Config {
	return b.config
}

// ConnectOnce tries once to connect to the remote block server.
func (b *BlockServerRemote) ConnectOnce(ctx context.Context) error {
	shutdown := func() bool {
		b.connMu.Lock()
		defer b.connMu.Unlock()
		return b.shutdown
	}()
	if shutdown {
		// Pretend everything is fine.  That will cause the goroutine
		// calling us to exit.
		return nil
	}

	var token string
	var session *libkb.Session
	var err error
	if session, err = b.config.KBPKI().GetSession(ctx); err != nil {
		libkb.G.Log.Warning("BlockServerRemote: error getting session %q", err)
		return err
	} else if session != nil {
		token = session.GetToken()
	}

	var user keybase1.UID
	user, err = b.config.KBPKI().GetLoggedInUser(ctx)
	if err != nil {
		return err
	}

	arg := keybase1.EstablishSessionArg{
		User: user,
		Sid:  token,
	}
	clt := keybase1.BlockClient{Cli: b.clt}
	if err = clt.EstablishSession(arg); err != nil {
		libkb.G.Log.Warning("BlockServerRemote: error getting session token %q", err)
		return err
	}

	b.connectedMu.Lock()
	defer b.connectedMu.Unlock()
	close(b.connectedChan)
	b.connectedChan = nil
	return nil
}

func (b *BlockServerRemote) isConnected() bool {
	return b.connectedChan == nil
}

// WaitForReconnect waits for the timeout period to reconnect to the
// server.
func (b *BlockServerRemote) WaitForReconnect(parent context.Context) error {
	c := func() chan struct{} {
		b.connectedMu.Lock()
		defer b.connectedMu.Unlock()
		return b.connectedChan
	}()

	if c == nil {
		// we're already connected
		return nil
	}

	ctx, cancel := context.WithTimeout(parent, BServerTimeout)
	defer cancel()

	// Wait either for the timeout, or for the connection to come up
	// (c will be closed).
	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-c:
		// Note: if we ever want to recover from lost connectivity, we
		// should probably put this whole method in a loop so that we
		// check connectedChan again after the channel closes.
		return nil
	}
}

// Reconnect reconnects to block server.
func (b *BlockServerRemote) Reconnect(ctx context.Context) {
	for b.initClient() != nil {
		time.Sleep(1 * time.Second)
	}

	for b.ConnectOnce(ctx) != nil {
		time.Sleep(1 * time.Second)
	}
}

// Shutdown closes the connection to this remote block server.
func (b *BlockServerRemote) Shutdown() {
	b.connMu.Lock()
	defer b.connMu.Unlock()
	if b.conn != nil {
		b.conn.Close()
	}
	b.shutdown = true
}

// Get implements the BlockServer interface for BlockServerRemote.
func (b *BlockServerRemote) Get(ctx context.Context, id BlockID,
	context BlockContext) ([]byte, BlockCryptKeyServerHalf, error) {
	libkb.G.Log.Debug("BlockServerRemote.Get id=%s uid=%s\n",
		hex.EncodeToString(id[:]), context.GetWriter().String())
	if !b.isConnected() {
		if err := b.WaitForReconnect(ctx); err != nil {
			return nil, BlockCryptKeyServerHalf{}, err
		}
	}
	bid := keybase1.BlockIdCombo{
		BlockHash: hex.EncodeToString(id[:]),
		ChargedTo: context.GetWriter(),
	}

	var res keybase1.GetBlockRes
	f := func() error {
		var err error
		//XXX: if fails due to connection problem, should reconnect
		clt := keybase1.BlockClient{Cli: b.clt}
		res, err = clt.GetBlock(bid)
		return err
	}

	err := runUnlessCanceled(ctx, f)
	if err != nil {
		libkb.G.Log.Debug("BlockServerRemote.Get id=%s err=%v\n",
			hex.EncodeToString(id[:]), err)
		return nil, BlockCryptKeyServerHalf{}, err
	}

	bk := BlockCryptKeyServerHalf{}
	kbuf, err := hex.DecodeString(res.BlockKey)
	if err != nil {
		return nil, BlockCryptKeyServerHalf{}, err
	}

	copy(bk.ServerHalf[:], kbuf)
	return res.Buf, bk, nil
}

// Put implements the BlockServer interface for BlockServerRemote.
// TODO: store the server-half of the block key
func (b *BlockServerRemote) Put(ctx context.Context, id BlockID, tlfID TlfID,
	context BlockContext, buf []byte,
	serverHalf BlockCryptKeyServerHalf) error {
	libkb.G.Log.Debug("BlockServerRemote.Put id=%s uid=%s\n",
		hex.EncodeToString(id[:]), context.GetWriter().String())
	if !b.isConnected() {
		if err := b.WaitForReconnect(ctx); err != nil {
			return err
		}
	}
	arg := keybase1.PutBlockArg{
		Bid: keybase1.BlockIdCombo{
			ChargedTo: context.GetWriter(),
			BlockHash: hex.EncodeToString(id[:]),
		},
		BlockKey: hex.EncodeToString(serverHalf.ServerHalf[:]),
		Folder:   hex.EncodeToString(tlfID[:]),
		Buf:      buf,
	}

	f := func() error {
		clt := keybase1.BlockClient{Cli: b.clt}
		return clt.PutBlock(arg)
	}
	err := runUnlessCanceled(ctx, f)
	if err != nil {
		libkb.G.Log.Debug("BlockServerRemote.Put id=%s err=%v\n",
			hex.EncodeToString(id[:]), err)
		return err
	}

	return nil
}

// AddBlockReference implements the BlockServer interface for BlockServerRemote
func (b *BlockServerRemote) AddBlockReference(ctx context.Context, id BlockID,
	tlfID TlfID, context BlockContext) error {
	libkb.G.Log.Debug("BlockServerRemote.AddBlockReference id=%s uid=%s\n",
		hex.EncodeToString(id[:]), context.GetWriter().String())
	nonce := context.GetRefNonce()
	arg := keybase1.IncBlockReferenceArg{
		Bid: keybase1.BlockIdCombo{
			ChargedTo: context.GetWriter(), //should be the original chargedto
			BlockHash: hex.EncodeToString(id[:]),
		},
		Nonce:     hex.EncodeToString(nonce[:]),
		Folder:    hex.EncodeToString(tlfID[:]),
		ChargedTo: context.GetWriter(), //the actual writer to decrement quota from
	}

	f := func() error {
		clt := keybase1.BlockClient{Cli: b.clt}
		return clt.IncBlockReference(arg)
	}
	err := runUnlessCanceled(ctx, f)
	if err != nil {
		// TODO: translate a particular RPC error into
		// IncrementMissingBlockError?
		libkb.G.Log.Debug("AddBlockReference to backend err : %q", err)
		return err
	}

	return nil
}

// RemoveBlockReference implements the BlockServer interface for
// BlockServerRemote
func (b *BlockServerRemote) RemoveBlockReference(ctx context.Context, id BlockID,
	tlfID TlfID, context BlockContext) error {
	libkb.G.Log.Debug("BlockServerRemote.RemoveBlockReference id=%s uid=%s\n",
		hex.EncodeToString(id[:]), context.GetWriter().String())
	nonce := context.GetRefNonce()
	arg := keybase1.DecBlockReferenceArg{
		Bid: keybase1.BlockIdCombo{
			ChargedTo: context.GetWriter(), //should be the original chargedto
			BlockHash: hex.EncodeToString(id[:]),
		},
		Nonce:     hex.EncodeToString(nonce[:]),
		Folder:    hex.EncodeToString(tlfID[:]),
		ChargedTo: context.GetWriter(), //the actual writer to decrement quota from
	}

	f := func() error {
		clt := keybase1.BlockClient{Cli: b.clt}
		return clt.DecBlockReference(arg)
	}
	err := runUnlessCanceled(ctx, f)
	if err != nil {
		libkb.G.Log.Debug("RemoveBlockReference to backend err : %q", err)
		return err
	}

	return nil
}
