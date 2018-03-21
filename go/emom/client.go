package emom

import (
	binary "encoding/binary"
	emom1 "github.com/keybase/client/go/protocol/emom1"
	clockwork "github.com/keybase/clockwork"
	codec "github.com/keybase/go-codec/codec"
	rpc "github.com/keybase/go-framed-msgpack-rpc/rpc"
	saltpack "github.com/keybase/saltpack"
	context "golang.org/x/net/context"
	sync "sync"
)

type ServerPublicKey struct {
	gen emom1.KeyGen
	key saltpack.BoxPublicKey
}

type User struct {
	uid            emom1.UID
	userSigningKey saltpack.SigningSecretKey
}

type Client struct {
	user            User
	serverPublicKey ServerPublicKey
	cli             *rpc.Client
	aeClient        emom1.AeClient

	seqnoMu sync.Mutex
	seqno   emom1.Seqno

	seqMapMu      sync.Mutex
	seqMap        map[rpc.SeqNumber]rpc.SeqNumber
	fatalSeqError error

	xp       rpc.Transporter
	sentChan chan rpc.SeqNumber

	sessionKey saltpack.BoxPrecomputedSharedKey

	clock clockwork.Clock
}

func NewClient(xp rpc.Transporter, user User, server ServerPublicKey) *Client {
	ch := make(chan rpc.SeqNumber)
	ret := &Client{
		user:            user,
		serverPublicKey: server,
		seqno:           emom1.Seqno(0),
		xp:              xp,
		sentChan:        ch,
		clock:           clockwork.NewRealClock(),
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

func (c *Client) SetClock(clock clockwork.Clock) {
	c.clock = clock
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

func makeNonce(msgType emom1.MsgType, n emom1.Seqno) saltpack.Nonce {
	var out saltpack.Nonce
	copy(out[0:16], "encrypted_fmprpc")
	binary.BigEndian.PutUint32(out[12:16], uint32(msgType))
	binary.BigEndian.PutUint64(out[16:], uint64(n))
	return out
}

func encrypt(ctx context.Context, msg []byte, msgType emom1.MsgType, n emom1.Seqno, key saltpack.BoxPrecomputedSharedKey) (emom1.AuthEnc, error) {
	return emom1.AuthEnc{
		N: n,
		E: key.Box(makeNonce(msgType, n), msg),
	}, nil
}

func (c *Client) decrypt(ctx context.Context, msgType emom1.MsgType, ae emom1.AuthEnc, key saltpack.BoxPrecomputedSharedKey) ([]byte, error) {
	return key.Unbox(makeNonce(msgType, ae.N), ae.E)
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

	if c.sessionKey == nil {
		wrappedArg.H, rp.F, err = c.doHandshake(ctx)
		if err != nil {
			return err
		}
	}

	encodedRequestPlaintext, err = encodeToBytes(rp)
	if err != nil {
		return err
	}

	wrappedArg.A, err = encrypt(ctx, encodedRequestPlaintext, emom1.MsgType_CALL, seqno, c.sessionKey)
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

	encodedResponsePlaintext, err = c.decrypt(ctx, emom1.MsgType_REPLY, wrappedRes.A, c.sessionKey)
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

	return nil
}

func (c *Client) doHandshake(ctx context.Context) (*emom1.Handshake, *emom1.SignedAuthToken, error) {

	ephemeralKey, err := c.serverPublicKey.key.CreateEphemeralKey()
	if err != nil {
		return nil, nil, err
	}
	ephemeralKID := emom1.KID(ephemeralKey.GetPublicKey().ToKID())

	c.sessionKey = ephemeralKey.Precompute(c.serverPublicKey.key)

	handshake := emom1.Handshake{
		V: 1,
		S: c.serverPublicKey.gen,
		K: ephemeralKID,
	}

	authToken := emom1.AuthToken{
		C: emom1.ToTime(c.clock.Now()),
		K: ephemeralKID,
		U: c.user.uid,
	}

	msg, err := encodeToBytes(authToken)
	if err != nil {
		return nil, nil, err
	}
	sig, err := c.user.userSigningKey.Sign(msg)
	if err != nil {
		return nil, nil, err
	}
	signedAuthToken := emom1.SignedAuthToken{
		T: authToken,
		D: emom1.KID(c.user.userSigningKey.GetPublicKey().ToKID()),
		S: sig,
	}

	return &handshake, &signedAuthToken, nil
}

func (c *Client) Notify(ctx context.Context, method string, arg interface{}) error {
	return nil
}

var _ rpc.GenericClient = (*Client)(nil)
