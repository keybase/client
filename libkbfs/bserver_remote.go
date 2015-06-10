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
		certFile: "./cacert.pem",
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
		rpc2.NewTransport(b.conn, libkb.NewRpcLogFactory(), libkb.WrapError), libkb.UnwrapError)}

	var session *libkb.Session
	if session, err = b.config.KBPKI().GetSession(); err != nil {
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
		Size:      int(context.GetQuotaSize()),
		ChargedTo: context.GetWriter(),
	}
	res, err := b.clt.GetBlock(bid)
	//XXX: if fails due to connection problem, should reconnect
	if err != nil {
		return nil, BlockCryptKeyServerHalf{}, err
	}
	// TODO: return the server-half of the block key
	var kbuf []byte
	kbuf, err = hex.DecodeString(res.Skey.BlockKey)
	if err != nil {
		return nil, BlockCryptKeyServerHalf{}, err
	}
	bk := BlockCryptKeyServerHalf{}
	copy(bk.ServerHalf[:], kbuf)
	return res.Buf, bk, err
}

// Put implements the BlockServer interface for BlockServerRemote.
// TODO: store the server-half of the block key
func (b *BlockServerRemote) Put(id BlockID, context BlockContext,
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
			Size:      int(context.GetQuotaSize()),
		},
		Skey: keybase1.BlockKey{
			EpochID:     0,
			EpochKey:    "DEADBEEF",
			RandBlockId: "DEADBEEF",
			BlockKey:    hex.EncodeToString(serverHalf.ServerHalf[:]),
		},
		Folder: "", //XXX: strib needs to tell me what folder this block belongs
		Buf:    buf,
	}
	if err := b.clt.PutBlock(arg); err != nil {
		fmt.Printf("PUT err is %v\n", err)
		return err
	}
	return nil
}

// Delete implements the BlockServer interface for BlockServerRemote.
func (b *BlockServerRemote) Delete(id BlockID, context BlockContext) error {
	/*
		if err := b.blockly.clt.blockSession(); err != nil {
			return err
		}
			arg := keybase_1.DeleteArg{
				Blockid: id[:],
				Uid:     keybase_1.UID(context.GetWriter()),
			}
				if err := b.blockly.clt.Delete(arg); err != nil {
					fmt.Printf("DEL err %v\n", err)
					return err
				} else {
					return nil
				}
	*/
	return nil
}
