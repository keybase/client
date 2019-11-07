package txnbuild

import (
	"fmt"

	"github.com/stellar/go/support/errors"
	"github.com/stellar/go/xdr"
)

// MemoText is used to send human messages of up to 28 bytes of ASCII/UTF-8.
type MemoText string

// MemoID is an identifier representing the transaction originator.
type MemoID uint64

// MemoHash is a hash representing a reference to another transaction.
type MemoHash [32]byte

// MemoReturn is a hash representing the hash of the transaction the sender is refunding.
type MemoReturn [32]byte

// MemoTextMaxLength is the maximum number of bytes allowed for a text memo.
const MemoTextMaxLength = 28

// Memo represents the superset of all memo types.
type Memo interface {
	ToXDR() (xdr.Memo, error)
}

// ToXDR for MemoText returns an XDR object representation of a Memo of the same type.
func (mt MemoText) ToXDR() (xdr.Memo, error) {
	if len(mt) > MemoTextMaxLength {
		return xdr.Memo{}, fmt.Errorf("Memo text can't be longer than %d bytes", MemoTextMaxLength)
	}

	return xdr.NewMemo(xdr.MemoTypeMemoText, string(mt))
}

// ToXDR for MemoID returns an XDR object representation of a Memo of the same type.
func (mid MemoID) ToXDR() (xdr.Memo, error) {
	return xdr.NewMemo(xdr.MemoTypeMemoId, xdr.Uint64(mid))
}

// ToXDR for MemoHash returns an XDR object representation of a Memo of the same type.
func (mh MemoHash) ToXDR() (xdr.Memo, error) {
	return xdr.NewMemo(xdr.MemoTypeMemoHash, xdr.Hash(mh))
}

// ToXDR for MemoReturn returns an XDR object representation of a Memo of the same type.
func (mr MemoReturn) ToXDR() (xdr.Memo, error) {
	return xdr.NewMemo(xdr.MemoTypeMemoReturn, xdr.Hash(mr))
}

// memoFromXDR returns a Memo from XDR
func memoFromXDR(memo xdr.Memo) (Memo, error) {
	var newMemo Memo
	var memoCreated bool

	switch memo.Type {
	case xdr.MemoTypeMemoText:
		value, ok := memo.GetText()
		newMemo = MemoText(value)
		memoCreated = ok
	case xdr.MemoTypeMemoId:
		value, ok := memo.GetId()
		newMemo = MemoID(uint64(value))
		memoCreated = ok
	case xdr.MemoTypeMemoHash:
		value, ok := memo.GetHash()
		newMemo = MemoHash(value)
		memoCreated = ok
	case xdr.MemoTypeMemoReturn:
		value, ok := memo.GetRetHash()
		newMemo = MemoReturn(value)
		memoCreated = ok
	case xdr.MemoTypeMemoNone:
		memoCreated = true
	}

	if !memoCreated {
		return nil, errors.New("invalid memo")
	}

	return newMemo, nil
}
