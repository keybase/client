package emom

import (
	errors "errors"
	emom1 "github.com/keybase/client/go/protocol/emom1"
	codec "github.com/keybase/go-codec/codec"
	rpc "github.com/keybase/go-framed-msgpack-rpc/rpc"
	context "golang.org/x/net/context"
	sync "sync"
	time "time"
)

type Client struct {
	cli            *rpc.Client
	aeClient       emom1.AeClient
	xp             rpc.Transporter
	sentChan       chan rpc.SeqNumber
	errorUnwrapper rpc.ErrorUnwrapper
	cryptoer       Cryptoer

	// protected by seqnoMu
	seqnoMu sync.Mutex
	seqno   emom1.Seqno

	serverSequencer Sequencer
}

func NewClient(xp rpc.Transporter, eu rpc.ErrorUnwrapper, cryptoer Cryptoer) *Client {
	ch := make(chan rpc.SeqNumber)
	ret := &Client{
		seqno:          emom1.Seqno(0),
		xp:             xp,
		sentChan:       ch,
		errorUnwrapper: eu,
		cryptoer:       cryptoer,
	}
	sendNotifier := func(s rpc.SeqNumber) {
		ch <- s
	}
	cli := rpc.NewClientWithSendNotifier(xp, nil, nil, sendNotifier)
	ret.cli = cli
	ret.aeClient = emom1.AeClient{Cli: cli}
	return ret
}

func codecHandle() *codec.MsgpackHandle {
	var mh codec.MsgpackHandle
	mh.WriteExt = true
	return &mh
}

func encodeToBytes(i interface{}) ([]byte, error) {
	var encoded []byte
	err := codec.NewEncoderBytes(&encoded, codecHandle()).Encode(i)
	return encoded, err
}

func decodeFromBytes(p interface{}, b []byte) error {
	return codec.NewDecoderBytes(b, codecHandle()).Decode(p)
}

func (c *Client) unwrapError(encodedError []byte) error {
	if encodedError == nil {
		return nil
	}

	if c.errorUnwrapper == nil {
		var s string
		if tmp := decodeFromBytes(&s, encodedError); tmp != nil {
			return errors.New("undecodable RPC error")
		}
		return errors.New(s)
	}

	arg := c.errorUnwrapper.MakeArg()

	if tmp := decodeFromBytes(&arg, encodedError); tmp != nil {
		return errors.New("undecodable error in encrypted RPC (working with error unwrapper)")
	}

	unwrapErr, ret := c.errorUnwrapper.UnwrapError(arg)
	if unwrapErr != nil {
		return unwrapErr
	}
	return ret
}

func (c *Client) Call(ctx context.Context, method string, arg interface{}, res interface{}) (err error) {
	var wrappedArg emom1.Arg
	var encodedArg []byte
	var encodedRequestPlaintext []byte
	var wrappedRes emom1.Res
	var responsePlaintext emom1.ResponsePlaintext
	var encodedResponsePlaintext []byte

	c.seqnoMu.Lock()
	doneCh := make(chan struct{})
	seqno := c.seqno
	c.seqno++

	encodedArg, err = encodeToBytes(arg)
	if err != nil {
		return err
	}

	rp := emom1.RequestPlaintext{
		S: &seqno,
		N: method,
		A: encodedArg,
	}

	err = c.cryptoer.InitClient(ctx, &wrappedArg, &rp)
	if err != nil {
		return err
	}

	encodedRequestPlaintext, err = encodeToBytes(rp)
	if err != nil {
		return err
	}

	wrappedArg.A, err = encrypt(ctx, encodedRequestPlaintext, emom1.MsgType_CALL, seqno, c.cryptoer.SessionKey())
	if err != nil {
		return err
	}

	go func() {
		wrappedRes, err = c.aeClient.C(ctx, wrappedArg)
		doneCh <- struct{}{}
	}()
	<-c.sentChan
	c.seqnoMu.Unlock()

	// Wait for the RPC Reply to be received from the server
	<-doneCh

	// It would be ideal if we could ensure that we're seeing requests
	// as the same order as they come across the wire. But this is hard
	// to enforce without a lot of disruption in the RPC library.  So we're
	// going to do something else instead: ensure that we're handling the
	// RPCs in the order that the server sent them. This means an attacker
	// who owns the network can drop packet 10 and nothing after it will go through.
	// But a malicious network can also DoS the connection, so this isn't
	// an interesting attack.
	err = c.serverSequencer.Wait(ctx, wrappedRes.A.N, time.Minute)
	if err != nil {
		return err
	}

	encodedResponsePlaintext, err = c.decrypt(ctx, emom1.MsgType_REPLY, wrappedRes.A, c.cryptoer.SessionKey())
	if err != nil {
		return err
	}

	err = decodeFromBytes(responsePlaintext, encodedResponsePlaintext)
	if err != nil {
		return err
	}

	if responsePlaintext.S != seqno {
		return WrongReplyError{seqno, responsePlaintext.S}
	}

	err = decodeFromBytes(res, responsePlaintext.R)
	if err != nil {
		return err
	}

	err = c.unwrapError(responsePlaintext.E)
	if err != nil {
		return err
	}
	return nil
}

func (c *Client) Notify(ctx context.Context, method string, arg interface{}) error {
	return nil
}

var _ rpc.GenericClient = (*Client)(nil)
