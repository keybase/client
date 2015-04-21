package libkbfs

import (
	"crypto/tls"
	"crypto/x509"
	"encoding/base64"
	"errors"
	"fmt"
	libkb "github.com/keybase/client/go/libkb"
	"github.com/keybase/client/protocol/go"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
	"io/ioutil"
	"net"
	"sync"
	"time"
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
	kbpki      KBPKI
}

type BlockClt struct {
	clt keybase_1.BlockClient
	Connectable
}

type BIndexClt struct {
	clt keybase_1.BIndexClient
	Connectable
}

type BlockServerRemote struct {
	blockly  BlockClt
	bindexly BIndexClt
}

func TLSConnect(srv_addr string) (conn net.Conn, err error) {
	CA_Pool := x509.NewCertPool()
	var cacert []byte
	cacert, err = ioutil.ReadFile("./cacert.pem")
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
	c.conn, err = TLSConnect(c.srv_addr)
	return
}

func (c *BlockClt) ConnectOnce() error {
	err := c.Connectable.ConnectOnce()
	if err != nil {
		return err
	}
	c.clt = keybase_1.BlockClient{rpc2.NewClient(
		rpc2.NewTransport(c.conn, libkb.NewRpcLogFactory(), libkb.WrapError), libkb.UnwrapError)}

	session, err := c.kbpki.GetSession()
	if err == nil {
		err = c.clt.BlockSession(session.GetToken())
		if err == nil {
			c.connected = true
			return nil
		}
	}
	c.conn.Close() //failed to announce session, close the whole thing
	return err
}

func (c *BIndexClt) ConnectOnce() error {
	err := c.Connectable.ConnectOnce()
	if err != nil {
		return err
	}
	c.clt = keybase_1.BIndexClient{rpc2.NewClient(
		rpc2.NewTransport(c.conn, libkb.NewRpcLogFactory(), libkb.WrapError), libkb.UnwrapError)}

	session, err := c.kbpki.GetSession()
	if err == nil {
		err = c.clt.BIndexSession(session.GetToken())
		if err == nil {
			c.connected = true
			return nil
		}
	}
	c.conn.Close() //failed to announce session, close the whole thing
	return err
}

func NewBlockServerRemote(blk_srvaddr string, bind_srvaddr string, kbpki KBPKI) *BlockServerRemote {
	b := &BlockServerRemote{}

	var err error
	b.blockly.srv_addr = blk_srvaddr
	b.blockly.kbpki = kbpki
	if err = b.blockly.ConnectOnce(); err != nil {
		go b.blockly.Reconnect()
	}

	b.bindexly.srv_addr = bind_srvaddr
	b.bindexly.kbpki = kbpki
	if err = b.bindexly.ConnectOnce(); err != nil {
		go b.bindexly.Reconnect()
	}

	return b
}

func (b *Connectable) WaitForReconnect() error {
	timeout := time.Now().Add(TIMEOUT)

	b.retry_mu.Lock()
	defer b.retry_mu.Unlock()

	for !b.connected {
		b.retry_mu.Unlock()
		if time.Now().After(timeout) {
			return ErrBlockConnTimeout
		}
		time.Sleep(1 * time.Second)
		b.retry_mu.Lock()
	}
	return nil
}

func (b *BlockClt) Reconnect() {
	b.retry_mu.Lock()
	defer b.retry_mu.Unlock()

	for b.ConnectOnce() != nil {
		b.retry_mu.Unlock()
		time.Sleep(1 * time.Second)
		b.retry_mu.Lock()
	}
	return
}

func (b *BIndexClt) Reconnect() {
	b.retry_mu.Lock()
	defer b.retry_mu.Unlock()

	for b.ConnectOnce() != nil {
		b.retry_mu.Unlock()
		time.Sleep(1 * time.Second)
		b.retry_mu.Lock()
	}
	return
}

func (b *BlockServerRemote) Shutdown() {
	b.blockly.conn.Close()
	b.bindexly.conn.Close()
}

func (b *BlockServerRemote) Get(id BlockId, context BlockContext) ([]byte, error) {
	if !b.blockly.connected {
		if err := b.blockly.WaitForReconnect(); err != nil {
			return nil, err
		}
	}
	//XXX: if fails due to connection problem, should reconnect
	bid := keybase_1.BlockIdCombo{
		BlockId: base64.StdEncoding.EncodeToString(id[:]),
		Size:    0,
	}

	if buf, err := b.blockly.clt.GetBlock(bid); err != nil {
		return nil, err
	} else {
		return buf, err
	}
	//XXX: need to fetch the block key
}

func (b *BlockServerRemote) Put(id BlockId, context BlockContext, buf []byte) error {
	if !b.blockly.connected {
		if err := b.blockly.WaitForReconnect(); err != nil {
			return err
		}
	}
	if !b.bindexly.connected {
		if err := b.bindexly.WaitForReconnect(); err != nil {
			return err
		}
	}

	arg := keybase_1.PutBlockArg{
		Bid: keybase_1.BlockIdCombo{BlockId: base64.StdEncoding.EncodeToString(id[:]), Size: len(buf)},
		Buf: buf,
	}
	if err := b.blockly.clt.PutBlock(arg); err != nil {
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
