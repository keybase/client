package kex

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"

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

var ErrMACMismatch = errors.New("Computed HMAC doesn't match message HMAC")

type Msg struct {
	Meta
	Body
}

func NewMsg(ctx *Context, body *Body) *Msg {
	return &Msg{
		Meta: ctx.Meta,
		Body: *body,
	}
}

func (m *Msg) CheckMAC() (bool, error) {
	sum, err := m.MacSum()
	if err != nil {
		return false, err
	}
	return hmac.Equal(sum, m.Mac), nil
}

func (m *Msg) MacSum() ([]byte, error) {
	t := m.Mac
	defer func() { m.Mac = t }()
	m.Mac = nil
	var buf bytes.Buffer
	var h codec.MsgpackHandle
	if err := codec.NewEncoder(&buf, &h).Encode(m); err != nil {
		return nil, err
	}
	return m.mac(buf.Bytes(), m.StrongID[:]), nil
}

func (m *Msg) mac(message, key []byte) []byte {
	mac := hmac.New(sha256.New, key)
	mac.Write(message)
	return mac.Sum(nil)
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

func MsgImport(w *jsonw.Wrapper) (*Msg, error) {
	r := &Msg{}
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

	body, err := w.AtKey("msg").GetString()
	if err != nil {
		return nil, err
	}
	mb, err := BodyDecode(body)
	if err != nil {
		return nil, err
	}
	r.Body = *mb

	ok, err := r.CheckMAC()
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, ErrMACMismatch
	}

	return r, nil
}

// MsgArgs has optional fields in it, but there aren't that many,
// so just using the same struct for all msgs for simplicity.
type MsgArgs struct {
	StrongID     StrongID
	DeviceID     libkb.DeviceID
	DevKeyID     libkb.KID
	SigningKey   libkb.NaclSigningKeyPublic
	Sig          string
	DevType      string
	DevDesc      string
	MerkleTriple libkb.MerkleTriple
}

type Body struct {
	Name string
	Args MsgArgs
	Mac  []byte
}

func BodyDecode(data string) (*Body, error) {
	bytes, err := base64.StdEncoding.DecodeString(data)
	if err != nil {
		return nil, err
	}
	var h codec.MsgpackHandle
	var k Body
	err = codec.NewDecoderBytes(bytes, &h).Decode(&k)
	if err != nil {
		return nil, err
	}
	return &k, nil
}

func (k *Body) Encode() (string, error) {
	var buf bytes.Buffer
	var h codec.MsgpackHandle
	err := codec.NewEncoder(&buf, &h).Encode(k)
	if err != nil {
		return "", nil
	}
	return base64.StdEncoding.EncodeToString(buf.Bytes()), nil
}
