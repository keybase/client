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
	// ErrNoActiveBlockConn is an error returned when this component
	// is not yet connected to the block server.
	ErrNoActiveBlockConn = errors.New("Not connected to block server")
	// ErrBlockConnTimeout is an error returned timed out (repeatedly)
	// while trying to connect to the block server.
	ErrBlockConnTimeout = errors.New("Repeatedly failed to connect to block server")
	// ErrNoActiveBIndexConn is an error returned when this component
	// is not yet connected to the block index server.
	ErrNoActiveBIndexConn = errors.New("Not connected to bindex server")
	// ErrBIndexConnTimeout is an error returned timed out
	// (repeatedly) while trying to connect to the block index server.
	ErrBIndexConnTimeout = errors.New("Repeatedly failed to connect to bindex server")
	// BServerTimeout is the timeout for communications with block server.
	BServerTimeout = 60 * time.Second
)

// Connectable represents a remote KBFS server
type Connectable struct {
	srvAddr   string
	conn      net.Conn
	connected bool
	lastTried time.Time
	retryMu   sync.Mutex
}

// BlockServerRemote implements the BlockServer interface and
// represents a remote KBFS block server.
type BlockServerRemote struct {
	clt   keybase1.BlockClient
	kbpki KBPKI
	Connectable
}

// TLSConnect connects over TLS to the given server, expecting the
// connection to be authenticated with the given certificate.
func TLSConnect(certFile string, srvAddr string) (conn net.Conn, err error) {
	CAPool := x509.NewCertPool()
	var cacert []byte
	cacert, err = ioutil.ReadFile(certFile)
	if err != nil {
		return
	}
	CAPool.AppendCertsFromPEM(cacert)

	config := tls.Config{RootCAs: CAPool}
	conn, err = tls.Dial("tcp", srvAddr, &config)
	if err != nil {
		return
	}
	return
}

// TCPConnect connects to the given server over plaintext TCP.
func TCPConnect(srvaddr string) (net.Conn, error) {
	return net.Dial("tcp", srvaddr)
}

// ConnectOnce tries one time to connect to the server over TLS.
func (c *Connectable) ConnectOnce() (err error) {
	c.conn, err = TLSConnect(c.srvAddr, "./cacert.pem")
	return
}

// WaitForReconnect waits for the timeout period to reconnect to the
// server.
func (c *Connectable) WaitForReconnect() error {
	timeout := time.Now().Add(BServerTimeout)

	c.retryMu.Lock()
	defer c.retryMu.Unlock()

	for !c.connected {
		c.retryMu.Unlock()
		if time.Now().After(timeout) {
			return ErrBlockConnTimeout
		}
		time.Sleep(1 * time.Second)
		c.retryMu.Lock()
	}
	return nil
}

// Reconnect reconnects to the server.
func (c *Connectable) Reconnect() {
	c.retryMu.Lock()
	defer c.retryMu.Unlock()

	for c.ConnectOnce() != nil {
		c.retryMu.Unlock()
		time.Sleep(1 * time.Second)
		c.retryMu.Lock()
	}
	return
}

// NewBlockServerRemote constructs a new BlockServerRemote for the
// given address.
func NewBlockServerRemote(blkSrvAddr string, bindSrvAddr string, kbpki KBPKI) *BlockServerRemote {
	b := &BlockServerRemote{
		kbpki: kbpki,
	}
	b.srvAddr = blkSrvAddr

	if err := b.ConnectOnce(); err != nil {
		go b.Reconnect()
	}

	return b
}

// ConnectOnce tries once to connect to the remote block server.
func (b *BlockServerRemote) ConnectOnce() error {
	err := b.Connectable.ConnectOnce()
	if err != nil {
		return err
	}
	b.clt = keybase1.BlockClient{Cli: rpc2.NewClient(
		rpc2.NewTransport(b.conn, libkb.NewRpcLogFactory(), libkb.WrapError), libkb.UnwrapError)}

	session, err := b.kbpki.GetSession()
	if err == nil {
		err = b.clt.EstablishSession(session.GetToken())
		if err == nil {
			b.connected = true
			return nil
		}
	}
	b.conn.Close() //failed to announce session, close the whole thing
	return err
}

// Shutdown closes the connection to this remote block server.
func (b *BlockServerRemote) Shutdown() {
	b.conn.Close()
}

// Get implements the BlockServer interface for BlockServerRemote.
func (b *BlockServerRemote) Get(id BlockID, context BlockContext) ([]byte, error) {
	if !b.connected {
		if err := b.WaitForReconnect(); err != nil {
			return nil, err
		}
	}
	//XXX: if fails due to connection problem, should reconnect
	bid := keybase1.BlockIdCombo{
		BlockHash: hex.EncodeToString(id[:]),
		Size:      0,
	}

	res, err := b.clt.GetBlock(bid)
	if err != nil {
		return nil, err
	}
	return res.Buf, err
	//XXX: need to fetch the block key
}

// Put implements the BlockServer interface for BlockServerRemote.
func (b *BlockServerRemote) Put(id BlockID, context BlockContext, buf []byte) error {
	if !b.connected {
		if err := b.WaitForReconnect(); err != nil {
			return err
		}
	}
	arg := keybase1.PutBlockArg{
		Bid: keybase1.BlockIdCombo{
			ChargedTo: keybase1.UID(context.GetWriter()),
			BlockHash: hex.EncodeToString(id[:]),
			Size:      len(buf),
		},
		Folder: "",
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
