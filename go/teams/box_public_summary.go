package teams

import (
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-codec/codec"
)

type boxPublicSummaryTable map[keybase1.UID]keybase1.Seqno

type boxPublicSummary struct {
	table    boxPublicSummaryTable
	encoding []byte
}

func newBoxPublicSummary(d map[keybase1.UserVersion]keybase1.PerUserKey) (*boxPublicSummary, error) {
	ret := boxPublicSummary{
		table: make(boxPublicSummaryTable, len(d)),
	}
	for uv, puk := range d {
		q, found := ret.table[uv.Uid]
		if !found || q < puk.Seqno {
			ret.table[uv.Uid] = puk.Seqno
		}
	}

	return &ret, nil
}

func (b *boxPublicSummary) encode() ([]byte, error) {
	// Just encode it once, since if ever canonical encoding
	// stops working, it won't matter, we'll still get consitent results.
	if b.encoding != nil {
		return b.encoding, nil
	}
	var mh codec.MsgpackHandle
	mh.WriteExt = true
	mh.Canonical = true
	var encoded []byte
	err := codec.NewEncoderBytes(&encoded, &mh).Encode(b.table)
	if err != nil {
		return nil, err
	}
	b.encoding = encoded
	return encoded, nil
}

func (b *boxPublicSummary) Hash() ([]byte, error) {
	tmp, err := b.encode()
	if err != nil {
		return nil, err
	}
	ret := sha256.Sum256(tmp)
	return ret[:], nil
}

func (b *boxPublicSummary) HashHexEncoded() (string, error) {
	tmp, err := b.Hash()
	if err != nil {
		return "", err
	}
	return hex.EncodeToString(tmp), nil
}

func (b *boxPublicSummary) EncodeToString() (string, error) {
	dst, err := b.encode()
	if err != nil {
		return "", err
	}
	return base64.StdEncoding.EncodeToString(dst), nil
}

func (b *boxPublicSummary) IsEmpty() bool {
	return len(b.table) == 0
}
