package engine

import (
	"bytes"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"time"

	"github.com/keybase/client/go/libkb"
	jsonw "github.com/keybase/go-jsonw"
	"github.com/ugorji/go/codec"
)

const (
	startkexMsg    = "startkex"
	startrevkexMsg = "startrevkex"
	helloMsg       = "hello"
	pleasesignMsg  = "pleasesign"
	doneMsg        = "done"
)

var KexGlobalTimeout = 5 * time.Minute

type KexSender struct {
}

func NewKexSender() *KexSender {
	return &KexSender{}
}

func (s *KexSender) StartKexSession(ctx *KexContext, id KexStrongID) error {
	mb := &KXMB{Name: startkexMsg, Args: MsgArgs{StrongID: id}}
	return s.post(ctx, mb)
}

func (s *KexSender) StartReverseKexSession(ctx *KexContext) error {
	return nil
}

func (s *KexSender) Hello(ctx *KexContext, devID libkb.DeviceID, devKeyID libkb.KID) error {
	mb := &KXMB{Name: helloMsg, Args: MsgArgs{DeviceID: devID, DevKeyID: devKeyID}}
	return s.post(ctx, mb)
}

func (s *KexSender) PleaseSign(ctx *KexContext, eddsa libkb.NaclSigningKeyPublic, sig, devType, devDesc string) error {
	mb := &KXMB{Name: pleasesignMsg, Args: MsgArgs{SigningKey: eddsa, Sig: sig, DevType: devType, DevDesc: devDesc}}
	return s.post(ctx, mb)
}

func (s *KexSender) Done(ctx *KexContext, mt libkb.MerkleTriple) error {
	mb := &KXMB{Name: doneMsg, Args: MsgArgs{MerkleTriple: mt}}
	return s.post(ctx, mb)
}

// XXX get rid of this when real client comm works
func (s *KexSender) RegisterTestDevice(srv KexHandler, device libkb.DeviceID) error {
	return nil
}

func (s *KexSender) post(ctx *KexContext, msg *KXMB) error {
	menc, err := msg.Encode()
	if err != nil {
		return err
	}
	_, err = G.API.Post(libkb.ApiArg{
		Endpoint:    "kex/send",
		NeedSession: true,
		Args: libkb.HttpArgs{
			"dir":      libkb.I{Val: 1},
			"I":        libkb.S{Val: hex.EncodeToString(ctx.StrongID[:])},
			"msg":      libkb.S{Val: menc},
			"receiver": libkb.S{Val: ctx.Dst.String()},
			"sender":   libkb.S{Val: ctx.Src.String()},
			"seqno":    libkb.I{Val: ctx.Seqno},
			"w":        libkb.S{Val: hex.EncodeToString(ctx.WeakID[:])},
		},
	})
	return err
}

type KexReceiver struct {
	handler KexHandler
	seqno   int
	pollDur time.Duration
}

func NewKexReceiver(handler KexHandler) *KexReceiver {
	return &KexReceiver{handler: handler, pollDur: 20 * time.Second}
}

func (r *KexReceiver) Receive(ctx *KexContext) error {
	msgs, err := r.get(ctx)
	if err != nil {
		return err
	}
	for _, m := range msgs {
		mb, err := KXMBDecode(m.body)
		if err != nil {
			return err
		}
		switch mb.Name {
		case startkexMsg:
			return r.handler.StartKexSession(ctx, mb.Args.StrongID)
		case startrevkexMsg:
			return r.handler.StartReverseKexSession(ctx)
		case helloMsg:
			return r.handler.Hello(ctx, mb.Args.DeviceID, mb.Args.DevKeyID)
		case pleasesignMsg:
			return r.handler.PleaseSign(ctx, mb.Args.SigningKey, mb.Args.Sig, mb.Args.DevType, mb.Args.DevDesc)
		case doneMsg:
			// XXX fix nil merkletriple
			return r.handler.Done(ctx, libkb.MerkleTriple{})
		default:
			return fmt.Errorf("unhandled message name: %q", mb.Name)
		}
	}
	return nil
}

func (r *KexReceiver) ReceiveFilter(name string) error {
	return nil
}

func (r *KexReceiver) get(ctx *KexContext) ([]*KexMsg, error) {
	res, err := G.API.Get(libkb.ApiArg{
		Endpoint:    "kex/receive",
		NeedSession: true,
		Args: libkb.HttpArgs{
			"w":    libkb.S{Val: hex.EncodeToString(ctx.WeakID[:])},
			"dir":  libkb.I{Val: 1},
			"low":  libkb.I{Val: 0},
			"poll": libkb.I{Val: int(r.pollDur / time.Second)},
		},
	})
	if err != nil {
		return nil, err
	}

	msgs := res.Body.AtKey("msgs")
	n, err := msgs.Len()
	if err != nil {
		return nil, err
	}
	messages := make([]*KexMsg, n)
	for i := 0; i < n; i++ {
		messages[i], err = KexMsgImport(msgs.AtIndex(i))
		if err != nil {
			return nil, err
		}
	}

	for _, m := range messages {
		G.Log.Info("message: %+v", m)
	}

	return messages, nil
}

type KexMsg struct {
	KexMeta
	body string
}

func deviceID(w *jsonw.Wrapper) (libkb.DeviceID, error) {
	s, err := w.GetString()
	if err != nil {
		return libkb.DeviceID{}, err
	}
	d, err := libkb.ImportDeviceID(s)
	if err != nil {
		return libkb.DeviceID{}, err
	}
	return *d, nil
}

func KexMsgImport(w *jsonw.Wrapper) (*KexMsg, error) {
	r := &KexMsg{}
	u, err := libkb.GetUid(w.AtKey("uid"))
	if err != nil {
		return nil, err
	}
	r.UID = *u

	r.Src, err = deviceID(w.AtKey("sender"))
	if err != nil {
		return nil, err
	}
	r.Dst, err = deviceID(w.AtKey("receiver"))
	if err != nil {
		return nil, err
	}

	r.Seqno, err = w.AtKey("seqno").GetInt()
	if err != nil {
		return nil, err
	}
	r.Direction, err = w.AtKey("dir").GetInt()
	if err != nil {
		return nil, err
	}

	stID, err := w.AtKey("I").GetString()
	if err != nil {
		return nil, err
	}
	bstID, err := hex.DecodeString(stID)
	if err != nil {
		return nil, err
	}
	copy(r.StrongID[:], bstID)

	wkID, err := w.AtKey("w").GetString()
	if err != nil {
		return nil, err
	}
	bwkID, err := hex.DecodeString(wkID)
	if err != nil {
		return nil, err
	}
	copy(r.WeakID[:], bwkID)

	r.body, err = w.AtKey("msg").GetString()
	if err != nil {
		return nil, err
	}

	return r, nil
}

// MsgArgs has optional fields in it, but there aren't that many,
// so just using the same struct for all msgs for simplicity.
type MsgArgs struct {
	StrongID     KexStrongID
	DeviceID     libkb.DeviceID
	DevKeyID     libkb.KID
	SigningKey   libkb.NaclSigningKeyPublic
	Sig          string
	DevType      string
	DevDesc      string
	MerkleTriple libkb.MerkleTriple
}

type KXMB struct {
	Name string
	Args MsgArgs
}

func KXMBDecode(data string) (*KXMB, error) {
	bytes, err := base64.StdEncoding.DecodeString(data)
	if err != nil {
		return nil, err
	}
	var h codec.MsgpackHandle
	var k KXMB
	err = codec.NewDecoderBytes(bytes, &h).Decode(&k)
	if err != nil {
		return nil, err
	}
	return &k, nil
}

func (k *KXMB) Encode() (string, error) {
	var buf bytes.Buffer
	var h codec.MsgpackHandle
	err := codec.NewEncoder(&buf, &h).Encode(k)
	if err != nil {
		return "", nil
	}
	return base64.StdEncoding.EncodeToString(buf.Bytes()), nil
}

type KexMsgBody string

func KexMsgBodyEncode(in string) KexMsgBody {
	return KexMsgBody(in)
}

func (b KexMsgBody) Decode() string {
	return string(b)
}
