package stellar

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"errors"
	"fmt"
	"net"
	"time"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/msgpack"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	"golang.org/x/crypto/nacl/box"
)

// An experimental airdrop registration protocol, we may or may not decide to use this.

type dialFunc func(m libkb.MetaContext) (net.Conn, error)

type Client struct {
	uid      keybase1.UID
	dialFunc dialFunc
}

func NewClient() *Client {
	ret := &Client{}
	ret.dialFunc = ret.dial
	return ret
}

func (a *Client) dial(m libkb.MetaContext) (conn net.Conn, err error) {
	defer m.Trace("airdrop.Client#dial", &err)()
	uri, tls, err := a.getURIAndTLS(m)
	if err != nil {
		return nil, err
	}
	conn, err = uri.DialWithConfig(tls)
	if err != nil {
		return nil, err
	}
	return conn, err
}

func (a *Client) getURIAndTLS(m libkb.MetaContext) (uri *rpc.FMPURI, tlsConfig *tls.Config, err error) {
	defer m.Trace("airdrop.Client#getURIAndTLS", &err)()

	rm := m.G().Env.GetRunMode()
	s, found := libkb.MpackAPIServerLookup[rm]
	if !found {
		return nil, nil, fmt.Errorf("URI not found for run mode: %s", rm)
	}
	uri, err = rpc.ParseFMPURI(s)
	if err != nil {
		return nil, nil, err
	}
	if !uri.UseTLS() {
		return uri, nil, nil
	}
	var ok bool
	var ca []byte
	ca, ok = libkb.GetBundledCAsFromHost(uri.Host)
	if !ok {
		return nil, nil, fmt.Errorf("No CA found for URI %s", s)
	}
	certs := x509.NewCertPool()
	if !certs.AppendCertsFromPEM(ca) {
		return nil, nil, errors.New("Unable to load root certificates")
	}
	tlsConfig = &tls.Config{
		RootCAs:    certs,
		ServerName: uri.Host,
	}
	return uri, tlsConfig, nil
}

func (a *Client) connect(m libkb.MetaContext) (cli keybase1.AirdropClient, xp rpc.Transporter, err error) {
	conn, err := a.dialFunc(m)
	if err != nil {
		return cli, nil, err
	}

	xp = libkb.NewTransportFromSocket(m.G(), conn, keybase1.NetworkSource_REMOTE)
	genericCli := rpc.NewClient(xp, libkb.NewContextifiedErrorUnwrapper(m.G()), nil)
	return keybase1.AirdropClient{Cli: genericCli}, xp, nil
}

type sharedKey [32]byte

func precomputeKey(privKey libkb.NaclDHKeyPair, pubKey keybase1.BinaryKID) (sharedKey sharedKey, err error) {
	serverPublicKey, err := libkb.BinaryKIDToRawNaCl(pubKey)
	if err != nil {
		return sharedKey, ErrBadKID
	}
	var serverPublicKeyBuf [32]byte
	copy(serverPublicKeyBuf[:], serverPublicKey)
	box.Precompute((*[32]byte)(&sharedKey), &serverPublicKeyBuf, (*[32]byte)(privKey.Private))
	return sharedKey, nil
}

func (a *Client) round1(m libkb.MetaContext, cli keybase1.AirdropClient) (sharedKey sharedKey, uid keybase1.UID, kid keybase1.BinaryKID, err error) {
	uid, myEncKey := m.G().ActiveDevice.UIDAndEncryptionKey()
	if uid.IsNil() {
		return sharedKey, uid, kid, errors.New("cannot register if logged out")
	}
	kid = myEncKey.GetBinaryKID()
	arg := keybase1.Reg1Arg{
		Uid: uid,
		Kid: kid,
	}
	res, err := cli.Reg1(m.Ctx(), arg)
	if err != nil {
		return sharedKey, uid, kid, err
	}
	myEncKeyDH, ok := myEncKey.(libkb.NaclDHKeyPair)
	if !ok {
		return sharedKey, uid, kid, errors.New("got wrong type of secret key back")
	}
	sharedKey, err = precomputeKey(myEncKeyDH, res)
	if err != nil {
		return sharedKey, uid, kid, err
	}
	return sharedKey, uid, kid, nil
}

func (a *Client) round2(m libkb.MetaContext, cli keybase1.AirdropClient, sharedKey sharedKey, uid keybase1.UID, kid keybase1.BinaryKID) (err error) {
	plaintext := keybase1.AirdropDetails{
		Time: keybase1.ToTime(m.G().Clock().Now()),
		Uid:  uid,
		Kid:  kid,
		Vid:  libkb.VID(m, a.uid),
		Vers: libkb.HeaderVersion(),
	}
	b, err := msgpack.Encode(&plaintext)
	if err != nil {
		return err
	}
	var nonce [24]byte
	ctext := box.SealAfterPrecomputation(nil, b, &nonce, (*[32]byte)(&sharedKey))
	err = cli.Reg2(m.Ctx(), ctext)
	return err
}

func (a *Client) Register(m libkb.MetaContext) (err error) {
	m = m.WithLogTag("AIRDROP")
	cli, xp, err := a.connect(m)
	if err != nil {
		return err
	}
	defer xp.Close()
	symKey, uid, kid, err := a.round1(m, cli)
	if err != nil {
		return err
	}
	err = a.round2(m, cli, symKey, uid, kid)
	return err
}

type state int

const (
	stateNone state = 0
	state1    state = 1
	state2    state = 2
)

type RequestProcessor interface {
	Reg1(ctx context.Context, uid keybase1.UID, kid keybase1.BinaryKID, err error)
	Reg2(ctx context.Context, details keybase1.AirdropDetails, err error)
	Close(ctx context.Context, err error)
}

type RequestHandler struct {
	serverKey libkb.NaclDHKeyPair
	uid       keybase1.UID
	userKey   keybase1.BinaryKID
	state     state
	xp        rpc.Transporter
	proc      RequestProcessor
	sharedKey sharedKey
}

func HandleRequest(ctx context.Context, xp rpc.Transporter, srv *rpc.Server, p RequestProcessor) (err error) {
	defer func() {
		if err != nil {
			xp.Close()
		}
	}()
	var kp libkb.NaclDHKeyPair
	kp, err = libkb.GenerateNaclDHKeyPair()
	if err != nil {
		return err
	}
	arh := &RequestHandler{
		state:     stateNone,
		xp:        xp,
		serverKey: kp,
		proc:      p,
	}
	prot := keybase1.AirdropProtocol(arh)
	err = srv.Register(prot)
	if err != nil {
		return err
	}
	go arh.Run(ctx, xp, srv)
	return nil

}

func (a *RequestHandler) Run(ctx context.Context, xp rpc.Transporter, srv *rpc.Server) {
	var err error
	select {
	case <-srv.Run():
	case <-time.After(time.Minute):
		err = ErrTimeout
	case <-ctx.Done():
		err = ErrCanceled
	}
	xp.Close()
	a.proc.Close(ctx, err)
}

func (a *RequestHandler) Reg1(ctx context.Context, arg keybase1.Reg1Arg) (ret keybase1.BinaryKID, err error) {
	defer func() {
		a.proc.Reg1(ctx, arg.Uid, arg.Kid, err)
	}()
	if a.state != stateNone {
		return ret, ErrWrongState
	}
	a.state = state1
	a.uid = arg.Uid
	a.userKey = arg.Kid
	ret = a.serverKey.Public.GetBinaryKID()
	a.sharedKey, err = precomputeKey(a.serverKey, a.userKey)
	if err != nil {
		return ret, err
	}
	return ret, err
}

var ErrWrongState = errors.New("wrong state")
var ErrCannotDecrypt = errors.New("cannot decrypt")
var ErrWrongUID = errors.New("wrong UID")
var ErrWrongKID = errors.New("wrong KID")
var ErrBadKID = errors.New("bad KID")
var ErrTimeout = errors.New("request timed out")
var ErrCanceled = errors.New("canceled")

func (a *RequestHandler) Reg2(ctx context.Context, ctext []byte) (err error) {
	var nonce [24]byte
	var details keybase1.AirdropDetails
	defer func() {
		a.proc.Reg2(ctx, details, err)
	}()
	if a.state != state1 {
		err = ErrWrongState
		return err
	}
	a.state = state2
	plaintext, ok := box.OpenAfterPrecomputation(nil, ctext, &nonce, (*[32]byte)(&a.sharedKey))
	if !ok {
		err = ErrCannotDecrypt
		return err
	}
	err = msgpack.Decode(&details, plaintext)
	if err != nil {
		return err
	}
	if !details.Uid.Equal(a.uid) {
		err = ErrWrongUID
		return err
	}
	if !details.Kid.Equal(a.userKey) {
		err = ErrWrongKID
		return err
	}
	return nil
}
