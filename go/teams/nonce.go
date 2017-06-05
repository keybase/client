package teams

import (
	"encoding/base64"
	"encoding/binary"

	"github.com/keybase/client/go/libkb"
)

type nonce24 struct {
	prefix  []byte
	counter uint32
}

func newNonce24() (*nonce24, error) {
	prefix, err := libkb.RandBytes(20)
	if err != nil {
		return nil, err
	}
	return &nonce24{prefix: prefix}, nil
}

func (n *nonce24) Nonce() [24]byte {
	var nonce [24]byte
	copy(nonce[:20], n.prefix)
	copy(nonce[20:24], n.counterBytes())
	return nonce
}

func (n *nonce24) PrefixEncoded() string {
	return base64.StdEncoding.EncodeToString(n.prefix)
}

func (n *nonce24) Counter() uint32 {
	return n.counter
}

func (n *nonce24) Inc() {
	n.counter++
}

func (n *nonce24) counterBytes() []byte {
	b := [4]byte{}
	binary.BigEndian.PutUint32(b[:], n.counter)
	return b[:]
}
