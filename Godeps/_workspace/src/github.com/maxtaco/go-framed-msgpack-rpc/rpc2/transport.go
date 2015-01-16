package rpc2

import (
	"bufio"
	"bytes"
	"github.com/ugorji/go/codec"
	"io/ioutil"
	"net"
	"sync"
)

type WrapErrorFunc func(error) interface{}
type UnwrapErrorFunc func(nxt DecodeNext) (error, error)

type Transporter interface {
	RawWrite([]byte) error
	ReadByte() (byte, error)
	Decode(interface{}) error
	Encode(interface{}) error
	GetDispatcher() (Dispatcher, error)
	ReadLock()
	ReadUnlock()
}

type ConPackage struct {
	con        net.Conn
	remoteAddr net.Addr
	br         *bufio.Reader
	dec        *codec.Decoder
}

func (c *ConPackage) ReadByte() (b byte, e error) {
	return c.br.ReadByte()
}

func (c *ConPackage) Write(b []byte) (err error) {
	_, err = c.con.Write(b)
	return
}

func (c *ConPackage) Close() error {
	return c.con.Close()
}

func (c *ConPackage) GetRemoteAddr() net.Addr {
	return c.remoteAddr
}

type Transport struct {
	mh         *codec.MsgpackHandle
	cpkg       *ConPackage
	buf        *bytes.Buffer
	enc        *codec.Encoder
	mutex      *sync.Mutex
	rdlck      *sync.Mutex
	dispatcher Dispatcher
	packetizer *Packetizer
	log        LogInterface
	running    bool
	wrapError  WrapErrorFunc
}

func NewConPackage(c net.Conn, mh *codec.MsgpackHandle) *ConPackage {
	br := bufio.NewReader(c)

	return &ConPackage{
		con:        c,
		remoteAddr: c.RemoteAddr(),
		br:         br,
		dec:        codec.NewDecoder(br, mh),
	}
}

func (t *Transport) IsConnected() bool {
	t.mutex.Lock()
	ret := (t.cpkg != nil)
	t.mutex.Unlock()
	return ret
}

func (t *Transport) GetRemoteAddr() (ret net.Addr) {
	if t.cpkg != nil {
		ret = t.cpkg.GetRemoteAddr()
	}
	return
}

func NewTransport(c net.Conn, l LogFactory, wef WrapErrorFunc) *Transport {
	var mh codec.MsgpackHandle

	buf := new(bytes.Buffer)
	ret := &Transport{
		mh:        &mh,
		cpkg:      NewConPackage(c, &mh),
		buf:       buf,
		enc:       codec.NewEncoder(buf, &mh),
		mutex:     new(sync.Mutex),
		rdlck:     new(sync.Mutex),
		wrapError: wef,
	}
	if l == nil {
		l = NewSimpleLogFactory(nil, nil)
	}
	log := l.NewLog(ret.cpkg.GetRemoteAddr())
	ret.log = log
	ret.dispatcher = NewDispatch(ret, log, wef)
	ret.packetizer = NewPacketizer(ret.dispatcher, ret)
	return ret
}

func (t *Transport) ReadLock()   { t.rdlck.Lock() }
func (t *Transport) ReadUnlock() { t.rdlck.Unlock() }

func (t *Transport) encodeToBytes(i interface{}) (v []byte, err error) {
	if err = t.enc.Encode(i); err != nil {
		return
	}
	v, _ = ioutil.ReadAll(t.buf)
	return
}

func (t *Transport) run2() (err error) {
	err = t.packetizer.Packetize()
	t.handlePacketizerFailure(err)
	return
}

func (t *Transport) handlePacketizerFailure(err error) {
	// For now, just throw everything away.  Eventually we might
	// want to make a plan for reconnecting.
	t.mutex.Lock()
	t.log.TransportError(err)
	t.running = false
	t.dispatcher.Reset()
	t.dispatcher = nil
	t.packetizer.Clear()
	t.packetizer = nil
	t.cpkg.Close()
	t.cpkg = nil
	t.mutex.Unlock()
	return
}

func (t *Transport) run(bg bool) (err error) {
	dostart := false
	t.mutex.Lock()
	if t.cpkg == nil {
		err = DisconnectedError{}
	} else if !t.running {
		dostart = true
		t.running = true
	}
	t.mutex.Unlock()
	if dostart {
		if bg {
			go t.run2()
		} else {
			err = t.run2()
		}
	}
	return
}

func (t *Transport) Encode(i interface{}) (err error) {
	var v1, v2 []byte
	if v2, err = t.encodeToBytes(i); err != nil {
		return
	}
	l := len(v2)
	if v1, err = t.encodeToBytes(l); err != nil {
		return
	}
	if err = t.RawWrite(v1); err != nil {
		return
	}
	return t.RawWrite(v2)
}

func (t *Transport) getConPackage() (ret *ConPackage, err error) {
	t.mutex.Lock()
	ret = t.cpkg
	t.mutex.Unlock()
	if ret == nil {
		err = DisconnectedError{}
	}
	return
}

func (t *Transport) ReadByte() (b byte, err error) {
	var cp *ConPackage
	if cp, err = t.getConPackage(); err == nil {
		b, err = cp.ReadByte()
	}
	return
}

func (t *Transport) Decode(i interface{}) (err error) {
	var cp *ConPackage
	if cp, err = t.getConPackage(); err == nil {
		err = cp.dec.Decode(i)
	}
	return
}

func (t *Transport) RawWrite(b []byte) (err error) {
	var cp *ConPackage
	if cp, err = t.getConPackage(); err == nil {
		err = cp.Write(b)
	}
	return err
}

func (t *Transport) GetDispatcher() (d Dispatcher, err error) {
	t.run(true)
	if !t.IsConnected() {
		err = DisconnectedError{}
	} else {
		d = t.dispatcher
	}
	return
}
