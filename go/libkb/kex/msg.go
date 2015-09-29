package kex

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"fmt"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
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
	CancelMsg              = "cancel"
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
	Body *Body `json:"msg"`
}

// NewMsg creates a kex message from metadata and a body.
func NewMsg(mt *Meta, body *Body) *Msg {
	return &Msg{
		Meta: *mt,
		Body: body,
	}
}

// String returns a string summary of the message.
func (m *Msg) String() string {
	return fmt.Sprintf("%s {w = %s, I = %s, sender = %s, receiver = %s, seqno = %d, dir = %d}",
		m.Body.Name, m.WeakID, m.StrongID, m.Sender, m.Receiver, m.Seqno, m.Direction)
}

// CheckMAC verifies that the existing MAC matches the computed
// MAC.
func (m *Msg) CheckMAC(secret SecretKey) (bool, error) {
	sum, err := m.MacSum(secret)
	if err != nil {
		return false, err
	}
	return hmac.Equal(sum, m.Body.Mac), nil
}

// MacSum calculates the MAC for a message.  It removes the
// existing MAC from the message for the calculation, then puts it
// back in place.
func (m *Msg) MacSum(secret SecretKey) ([]byte, error) {
	t := m.Body.Mac
	defer func() { m.Body.Mac = t }()
	m.Body.Mac = nil
	var buf bytes.Buffer
	var h codec.MsgpackHandle
	if err := codec.NewEncoder(&buf, &h).Encode(m); err != nil {
		return nil, err
	}
	return m.mac(buf.Bytes(), secret[:])
}

// mac is a convenience function to calculate the hmac of message
// for key.
func (m *Msg) mac(message, key []byte) ([]byte, error) {
	mac := hmac.New(sha256.New, key)
	if _, err := mac.Write(message); err != nil {
		return nil, err
	}
	return mac.Sum(nil), nil
}

// Name returns the name of the message.
func (m *Msg) Name() MsgName {
	return m.Body.Name
}

// Args returns the message arguments.
func (m *Msg) Args() MsgArgs {
	return m.Body.Args
}

// MsgList is an array of messages that can sort by seqno.
type MsgList []*Msg

func (m MsgList) Len() int           { return len(m) }
func (m MsgList) Less(a, b int) bool { return m[a].Seqno < m[b].Seqno }
func (m MsgList) Swap(a, b int)      { m[a], m[b] = m[b], m[a] }

// MsgArgs contains the union of all the args for the kex message
// protocol interface.  Many of the fields are optional depending
// on the message.
type MsgArgs struct {
	StrongID   StrongID
	DeviceID   keybase1.DeviceID
	DevKeyID   keybase1.KID
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
	err = libkb.MsgpackDecodeAll(bytes, &h, &k)
	if err != nil {
		return nil, err
	}
	return &k, nil
}

// UnmarshalJSON implements the json.Unmarshaler interface.
func (b *Body) UnmarshalJSON(data []byte) error {
	bd, err := BodyDecode(libkb.Unquote(data))
	if err != nil {
		return err
	}
	*b = *bd
	return nil
}

// Encode transforms a message body into a base64-encoded msgpack.
func (b *Body) Encode() (string, error) {
	var buf bytes.Buffer
	var h codec.MsgpackHandle
	err := codec.NewEncoder(&buf, &h).Encode(b)
	if err != nil {
		return "", nil
	}
	return base64.StdEncoding.EncodeToString(buf.Bytes()), nil
}
