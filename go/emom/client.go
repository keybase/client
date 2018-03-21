package emom

import (
	errors "errors"
	emom1 "github.com/keybase/client/go/protocol/emom1"
	codec "github.com/keybase/go-codec/codec"
	rpc "github.com/keybase/go-framed-msgpack-rpc/rpc"
	context "golang.org/x/net/context"
	sync "sync"
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

	// protected by seqMapMu
	seqMapMu      sync.Mutex
	seqMap        map[rpc.SeqNumber]rpc.SeqNumber
	fatalSeqError error
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
	replySequencer := func(server rpc.SeqNumber, client rpc.SeqNumber) {
		ret.replySequencer(server, client)
	}
	cli := rpc.NewClientWithSendNotifierAndReplySequencer(xp, nil, nil, sendNotifier, replySequencer)
	ret.cli = cli
	ret.aeClient = emom1.AeClient{Cli: cli}
	return ret
}

func (c *Client) replySequencer(server rpc.SeqNumber, client rpc.SeqNumber) {
	c.seqMapMu.Lock()
	defer c.seqMapMu.Unlock()
	if _, found := c.seqMap[client]; found {
		c.fatalSeqError = newServerSequenceError("ae.1 RPC seqid %d was replied to multiple times", client)
	} else {
		c.seqMap[client] = server
	}
}

func (c *Client) assertServerSequence(clientRpcSeqNo rpc.SeqNumber, nonce emom1.Seqno) error {
	c.seqMapMu.Lock()
	defer c.seqMapMu.Unlock()

	if c.fatalSeqError != nil {
		return c.fatalSeqError
	}

	serverSeqno, found := c.seqMap[clientRpcSeqNo]
	if !found {
		return newServerSequenceError("didn't find a reply for RPC seqid %d", clientRpcSeqNo)
	}
	delete(c.seqMap, clientRpcSeqNo)

	if emom1.Seqno(serverSeqno) != nonce {
		return newServerSequenceError("out of order server reply; wanted %d but got %d", serverSeqno, nonce)
	}
	return nil
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
	aeClientSeqno := <-c.sentChan
	c.seqnoMu.Unlock()

	// Wait for the RPC Reply to be received from the server
	<-doneCh

	// The reply came in a sequence of replies from the server.
	// Make sure that place in the sequence matches the nonce that
	// is being advertised in the server's encryption. If not,
	// we have to assume the channel was malicious and was reordering
	// replies.
	err = c.assertServerSequence(aeClientSeqno, wrappedRes.A.N)
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
