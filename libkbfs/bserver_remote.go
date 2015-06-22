package libkbfs

import (
	"crypto/tls"
	"crypto/x509"
	"encoding/hex"
	"errors"
	"fmt"
	"io/ioutil"
	"net"
	"sync"
	"time"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/protocol/go"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
)

var (
	// ErrNoActiveConn is an error returned when this component
	// is not yet connected to the block server.
	ErrNoActiveConn = errors.New("Not connected to block server")
	// ErrConnTimeout is an error returned timed out (repeatedly)
	// while trying to connect to the block server.
	ErrConnTimeout = errors.New("Repeatedly failed to connect to block server")
	// BServerTimeout is the timeout for communications with block server.
	BServerTimeout = 60 * time.Second
)

// BlockServerRemote implements the BlockServer interface and
// represents a remote KBFS block server.
type BlockServerRemote struct {
	config Config

	srvAddr  string
	certFile string

	conn      net.Conn
	clt       keybase1.BlockClient
	connected bool

	lastTried time.Time
	retryMu   sync.Mutex
}

// NewBlockServerRemote constructs a new BlockServerRemote for the
// given address.
func NewBlockServerRemote(config Config, blkSrvAddr string) *BlockServerRemote {
	b := &BlockServerRemote{
		config:   config,
		srvAddr:  blkSrvAddr,
		certFile: "./cert.pem",
	}

	if err := b.ConnectOnce(); err != nil {
		go b.Reconnect()
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

// Config returns the configuration object
func (b *BlockServerRemote) Config() Config {
	return b.config
}

// ConnectOnce tries once to connect to the remote block server.
func (b *BlockServerRemote) ConnectOnce() error {
	var err error
	if b.conn, err = TLSConnect(b.certFile, b.srvAddr); err != nil {
		return err
	}

	b.clt = keybase1.BlockClient{Cli: rpc2.NewClient(
		rpc2.NewTransport(b.conn, libkb.NewRPCLogFactory(), libkb.WrapError), libkb.UnwrapError)}

	var session *libkb.Session
	if session, err = b.config.KBPKI().GetSession(); err != nil {
		libkb.G.Log.Warning("error getting session, disconnect from backend: %q", err)
		b.conn.Close()
		return err
	}
	if err = b.clt.EstablishSession(session.GetToken()); err != nil {
		b.conn.Close()
		return err
	}

	b.connected = true
	return nil
}

// WaitForReconnect waits for the timeout period to reconnect to the
// server.
func (b *BlockServerRemote) WaitForReconnect() error {
	timeout := time.Now().Add(BServerTimeout)

	b.retryMu.Lock()
	defer b.retryMu.Unlock()

	for !b.connected {
		b.retryMu.Unlock()
		if time.Now().After(timeout) {
			return ErrConnTimeout
		}
		time.Sleep(1 * time.Second)
		b.retryMu.Lock()
	}
	return nil
}

// Reconnect reconnects to block server.
func (b *BlockServerRemote) Reconnect() {
	b.retryMu.Lock()
	defer b.retryMu.Unlock()

	for b.ConnectOnce() != nil {
		b.retryMu.Unlock()
		time.Sleep(1 * time.Second)
		b.retryMu.Lock()
	}
	return
}

// Shutdown closes the connection to this remote block server.
func (b *BlockServerRemote) Shutdown() {
	b.conn.Close()
}

// Get implements the BlockServer interface for BlockServerRemote.
func (b *BlockServerRemote) Get(id BlockID, context BlockContext) (
	[]byte, BlockCryptKeyServerHalf, error) {
	if !b.connected {
		if err := b.WaitForReconnect(); err != nil {
			return nil, BlockCryptKeyServerHalf{}, err
		}
	}
	bid := keybase1.BlockIdCombo{
		BlockHash: hex.EncodeToString(id[:]),
		ChargedTo: context.GetWriter(),
	}
	//XXX: if fails due to connection problem, should reconnect
	res, err := b.clt.GetBlock(bid)
	if err != nil {
		return nil, BlockCryptKeyServerHalf{}, err
	}

	// TODO: return the server-half of the block key
	bk := BlockCryptKeyServerHalf{}
	if kbuf, err := hex.DecodeString(res.BlockKey); err == nil {
		copy(bk.ServerHalf[:], kbuf)
	}
	return res.Buf, bk, err
}

// Put implements the BlockServer interface for BlockServerRemote.
// TODO: store the server-half of the block key
func (b *BlockServerRemote) Put(id BlockID, tlfID DirID, context BlockContext,
	buf []byte, serverHalf BlockCryptKeyServerHalf) error {
	if !b.connected {
		if err := b.WaitForReconnect(); err != nil {
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
	err := b.clt.PutBlock(arg)
	if err != nil {
		libkb.G.Log.Warning("PUT to backend err : %q", err)
	}
	return err
}

// Delete implements the BlockServer interface for BlockServerRemote.
func (b *BlockServerRemote) Delete(id BlockID, context BlockContext) error {
	arg := keybase1.DecBlockReferenceArg{
		Bid: keybase1.BlockIdCombo{
			ChargedTo: context.GetWriter(), //should be the original chargedto
			BlockHash: hex.EncodeToString(id[:]),
		},
		Nonce:     "0000",
		Folder:    "",
		ChargedTo: context.GetWriter(), //the actual writer to decrement quota from
	}
	err := b.clt.DecBlockReference(arg)
	if err != nil {
		libkb.G.Log.Warning("PUT to backend err : %q", err)
	}
	return err
}
