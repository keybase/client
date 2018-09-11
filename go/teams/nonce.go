package teams

import (
	"encoding/base64"
	"encoding/binary"

	"github.com/keybase/client/go/libkb"
)

// nonce24 manages a 24-byte nonce with a 20-byte prefix
// and a 4-byte counter.  The counter is incremented every
// time the full nonce is retrieved so that no nonces are
// reused.
type nonce24 struct {
	prefix  []byte
	counter uint32
}

// newNonce24 creates a nonce with a random 20 byte prefix and
// a counter starting at 0.
func newNonce24() (*nonce24, error) {
	prefix, err := libkb.RandBytes(20)
	if err != nil {
		return nil, err
	}
	return &nonce24{prefix: prefix}, nil
}

// newNonce24 creates a nonce with a random 20 byte prefix and
// a counter starting at 1.
func newNonce24SkipZero() (*nonce24, error) {
	n, err := newNonce24()
	if err != nil {
		return nil, err
	}
	n.counter = 1
	return n, nil
}

// Nonce gets the 24 byte nonce prefix + counter and increments
// the counter so that the nonce isn't reused.
func (n *nonce24) Nonce() ([24]byte, uint32) {
	var nonce [24]byte
	copy(nonce[:20], n.prefix)
	copy(nonce[20:24], n.counterBytes())
	counter := n.counter
	n.counter++
	return nonce, counter
}

// PrefixEncoded returns a base64 encoding of the 20 byte nonce prefix.
func (n *nonce24) PrefixEncoded() string {
	return base64.StdEncoding.EncodeToString(n.prefix)
}

func (n *nonce24) counterBytes() []byte {
	b := [4]byte{}
	binary.BigEndian.PutUint32(b[:], n.counter)
	return b[:]
}
