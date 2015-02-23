package engine

import (
	"bytes"
	"encoding/base64"
	"encoding/hex"
	"time"

	jsonw "github.com/keybase/go-jsonw"
	"github.com/keybase/go/libkb"
	"github.com/ugorji/go/codec"
)

var KexGlobalTimeout = 5 * time.Minute

type KexSender struct {
}

func NewKexSender() *KexSender {
	return &KexSender{}
}

func (s *KexSender) StartKexSession(ctx *KexContext, id KexStrongID) error {
	return s.post(ctx, "start kex")
}

func (s *KexSender) StartReverseKexSession(ctx *KexContext) error {
	return nil
}

func (s *KexSender) Hello(ctx *KexContext, devID libkb.DeviceID, devKeyID libkb.KID) error {
	return nil
}

func (s *KexSender) PleaseSign(ctx *KexContext, eddsa libkb.NaclSigningKeyPublic, sig, devType, devDesc string) error {
	return nil
}

func (s *KexSender) Done(ctx *KexContext, mt libkb.MerkleTriple) error {
	return nil
}

// XXX get rid of this when real client comm works
func (s *KexSender) RegisterTestDevice(srv KexHandler, device libkb.DeviceID) error {
	return nil
}

func (s *KexSender) post(ctx *KexContext, msg string) error {
	_, err := G.API.Post(libkb.ApiArg{
		Endpoint:    "kex/send",
		NeedSession: true,
		Args: libkb.HttpArgs{
			"sender":   libkb.S{Val: ctx.Src.String()},
			"receiver": libkb.S{Val: ctx.Dst.String()},
			"dir":      libkb.I{Val: 1},
			"I":        libkb.S{Val: hex.EncodeToString(ctx.StrongID[:])},
			"w":        libkb.S{Val: hex.EncodeToString(ctx.WeakID[:])},
			"seqno":    libkb.I{Val: ctx.Seqno},
			"msg":      libkb.S{Val: msg},
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
	return r.get(ctx)
}

func (r *KexReceiver) ReceiveFilter(name string) error {
	return nil
}

func (r *KexReceiver) get(ctx *KexContext) error {
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
		return err
	}

	msgs := res.Body.AtKey("msgs")
	n, err := msgs.Len()
	if err != nil {
		return err
	}
	messages := make([]*KexMsg, n)
	for i := 0; i < n; i++ {
		messages[i], err = KexMsgImport(msgs.AtIndex(i))
		if err != nil {
			return err
		}
	}

	for _, m := range messages {
		G.Log.Info("message: %+v", m)
	}

	return nil
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

type KXMB struct {
	Name string
	Args interface{}
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
