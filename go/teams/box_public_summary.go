package teams

import (
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

type boxPublicSummaryTable map[keybase1.UID]keybase1.Seqno

type boxPublicSummary struct {
	table boxPublicSummaryTable
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
	return libkb.MsgpackEncode(b.table)
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
	return len(b.table) > 0
}
