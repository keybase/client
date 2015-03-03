package kex

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"

	"github.com/keybase/client/go/libkb"
	jsonw "github.com/keybase/go-jsonw"
	"github.com/ugorji/go/codec"
)

// MsgName is for message names.
type MsgName string

// These are the valid message names for kex.
const (
	StartKexMsg    MsgName = "startkex"
	StartRevKexMsg         = "startrevkex"
	HelloMsg               = "hello"
	PleaseSignMsg          = "pleasesign"
	DoneMsg                = "done"
)

// ErrMACMismatch is returned when a MAC fails.
var ErrMACMismatch = errors.New("Computed HMAC doesn't match message HMAC")

// ErrStrongIDMismatch is returned when the strong session ID (I)
// in a message fails to match the receiver's strong session ID.
var ErrStrongIDMismatch = errors.New("Strong session ID (I) mismatch between message and receiver")

// ErrWeakIDMismatch is returned when the weak session ID (w)
// in a message fails to match the receiver's weak session ID.
var ErrWeakIDMismatch = errors.New("Weak session ID (w) mismatch between message and receiver")

// Msg is a kex message.
type Msg struct {
	Meta
	Body
}

// NewMsg creates a kex message from metadata and a body.
func NewMsg(mt *Meta, body *Body) *Msg {
	return &Msg{
		Meta: *mt,
		Body: *body,
	}
}

// String returns a string summary of the message.
func (m *Msg) String() string {
	return fmt.Sprintf("%s {w = %s, I = %s, sender = %s, receiver = %s, seqno = %d, dir = %d}",
		m.Name, m.WeakID, m.StrongID, m.Sender, m.Receiver, m.Seqno, m.Direction)
}

// CheckMAC verifies that the existing MAC matches the computed
// MAC.
func (m *Msg) CheckMAC(secret SecretKey) (bool, error) {
	sum, err := m.MacSum(secret)
	if err != nil {
		return false, err
	}
	return hmac.Equal(sum, m.Mac), nil
}

// MacSum calculates the MAC for a message.  It removes the
// existing MAC from the message for the calculation, then puts it
// back in place.
func (m *Msg) MacSum(secret SecretKey) ([]byte, error) {
	t := m.Mac
	defer func() { m.Mac = t }()
	m.Mac = nil
	var buf bytes.Buffer
	var h codec.MsgpackHandle
	if err := codec.NewEncoder(&buf, &h).Encode(m); err != nil {
		return nil, err
	}
	return m.mac(buf.Bytes(), secret[:]), nil
}

// mac is a convenience function to calculate the hmac of message
// for key.
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

// MsgImport extracts a kex Msg from json.  It also checks the MAC
// of the message.
func MsgImport(w *jsonw.Wrapper, secret SecretKey) (*Msg, error) {
	r := &Msg{}
	u, err := libkb.GetUid(w.AtKey("uid"))
	if err != nil {
		return nil, err
	}
	r.UID = *u

	r.Sender, err = deviceID(w.AtKey("sender"))
	if err != nil {
		return nil, err
	}
	r.Receiver, err = deviceID(w.AtKey("receiver"))
	if err != nil {
		return nil, err
	}

	r.Seqno, err = w.AtKey("seqno").GetInt()
	if err != nil {
		return nil, err
	}
	dir, err := w.AtKey("dir").GetInt()
	if err != nil {
		return nil, err
	}
	r.Direction = Direction(dir)

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

	return r, nil
}

// MsgList is an array of messages.
type MsgList []*Msg

func (m MsgList) Len() int           { return len(m) }
func (m MsgList) Less(a, b int) bool { return m[a].Seqno < m[b].Seqno }
func (m MsgList) Swap(a, b int)      { m[a], m[b] = m[b], m[a] }

// MsgArgs contains the union of all the args for the kex message
// protocol interface.  Many of the fields are optional depending
// on the message.
type MsgArgs struct {
	StrongID   StrongID
	DeviceID   libkb.DeviceID
	DevKeyID   libkb.KID
	SigningKey libkb.NaclSigningKeyPublic
	Sig        string
	DevType    string
	DevDesc    string
}

// Body is the message body.
type Body struct {
	Name MsgName
	Args MsgArgs
	Mac  []byte
	EOF  bool
}

// BodyDecode takes a base64-encoded msgpack and turns it into a
// message body.
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

// Encode transforms a message body into a base64-encoded msgpack.
func (k *Body) Encode() (string, error) {
	var buf bytes.Buffer
	var h codec.MsgpackHandle
	err := codec.NewEncoder(&buf, &h).Encode(k)
	if err != nil {
		return "", nil
	}
	return base64.StdEncoding.EncodeToString(buf.Bytes()), nil
}
