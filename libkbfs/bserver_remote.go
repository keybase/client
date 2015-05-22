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
	"github.com/keybase/client/protocol/go"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
)

var (
	ErrNoActiveBlockConn  = errors.New("Not connected to block server")
	ErrBlockConnTimeout   = errors.New("Repeatedly failed to connect to block server")
	ErrNoActiveBIndexConn = errors.New("Not connected to bindex server")
	ErrBIndexConnTimeout  = errors.New("Repeatedly failed to connect to bindex server")
	TIMEOUT               = 60 * time.Second
)

type Connectable struct {
	srv_addr   string
	conn       net.Conn
	connected  bool
	last_tried time.Time
	retry_mu   sync.Mutex
}

type BlockServerRemote struct {
	clt   keybase1.BlockClient
	kbpki KBPKI
	Connectable
}

func TLSConnect(cert_file string, srv_addr string) (conn net.Conn, err error) {
	CA_Pool := x509.NewCertPool()
	var cacert []byte
	cacert, err = ioutil.ReadFile(cert_file)
	if err != nil {
		return
	}
	CA_Pool.AppendCertsFromPEM(cacert)

	config := tls.Config{RootCAs: CA_Pool}
	conn, err = tls.Dial("tcp", srv_addr, &config)
	if err != nil {
		return
	}
	return
}

func TCPConnect(srvaddr string) (net.Conn, error) {
	return net.Dial("tcp", srvaddr)
}

func (c *Connectable) ConnectOnce() (err error) {
	c.conn, err = TLSConnect(c.srv_addr, "./cacert.pem")
	return
}

func (c *Connectable) WaitForReconnect() error {
	timeout := time.Now().Add(TIMEOUT)

	c.retry_mu.Lock()
	defer c.retry_mu.Unlock()

	for !c.connected {
		c.retry_mu.Unlock()
		if time.Now().After(timeout) {
			return ErrBlockConnTimeout
		}
		time.Sleep(1 * time.Second)
		c.retry_mu.Lock()
	}
	return nil
}

func (c *Connectable) Reconnect() {
	c.retry_mu.Lock()
	defer c.retry_mu.Unlock()

	for c.ConnectOnce() != nil {
		c.retry_mu.Unlock()
		time.Sleep(1 * time.Second)
		c.retry_mu.Lock()
	}
	return
}

func NewBlockServerRemote(blk_srvaddr string, bind_srvaddr string, kbpki KBPKI) *BlockServerRemote {
	b := &BlockServerRemote{
		kbpki: kbpki,
	}
	b.srv_addr = blk_srvaddr

	if err := b.ConnectOnce(); err != nil {
		go b.Reconnect()
	}

	return b
}

func (c *BlockServerRemote) ConnectOnce() error {
	err := c.Connectable.ConnectOnce()
	if err != nil {
		return err
	}
	c.clt = keybase1.BlockClient{rpc2.NewClient(
		rpc2.NewTransport(c.conn, libkb.NewRpcLogFactory(), libkb.WrapError), libkb.UnwrapError)}

	session, err := c.kbpki.GetSession()
	if err == nil {
		err = c.clt.EstablishSession(session.GetToken())
		if err == nil {
			c.connected = true
			return nil
		}
	}
	c.conn.Close() //failed to announce session, close the whole thing
	return err
}

func (b *BlockServerRemote) Shutdown() {
	b.conn.Close()
}

func (b *BlockServerRemote) Get(id BlockId, context BlockContext) ([]byte, error) {
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

	if res, err := b.clt.GetBlock(bid); err != nil {
		return nil, err
	} else {
		return res.Buf, err
	}
	//XXX: need to fetch the block key
}

func (b *BlockServerRemote) Put(id BlockId, context BlockContext, buf []byte) error {
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
	} else {
		return err
	}
	return nil

}

func (b *BlockServerRemote) Delete(id BlockId, context BlockContext) error {
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
