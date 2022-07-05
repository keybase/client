package stellarnet

import (
	"encoding/hex"
	"errors"
	"fmt"
	"strconv"
	"strings"

	"github.com/stellar/go/xdr"
)

// MemoType is the kind of memo.
type MemoType int

// These are the constants for the various memo types.
const (
	MemoTypeNone MemoType = iota
	MemoTypeText
	MemoTypeID
	MemoTypeHash
	MemoTypeReturn
)

// MemoHash is a 32 byte hash value.
type MemoHash [32]byte

// Memo is very similar to xdr.Memo, but we'd like consumers of
// stellarnet to not have to know anything about xdr.
type Memo struct {
	Type       MemoType
	Text       *string
	ID         *uint64
	Hash       *MemoHash
	ReturnHash *MemoHash
}

// NewMemoNone returns a Memo of type MemoTypeNone.
func NewMemoNone() *Memo {
	return &Memo{Type: MemoTypeNone}
}

// NewMemoText returns a Memo of type MemoTypeText.
func NewMemoText(s string) *Memo {
	return &Memo{Type: MemoTypeText, Text: &s}
}

// NewMemoID returns a Memo of type MemoTypeID.
func NewMemoID(n uint64) *Memo {
	return &Memo{Type: MemoTypeID, ID: &n}
}

// NewMemoHash returns a Memo of type MemoTypeHash.
func NewMemoHash(h MemoHash) *Memo {
	return &Memo{Type: MemoTypeHash, Hash: &h}
}

// NewMemoReturn returns a Memo of type MemoTypeReturn.
func NewMemoReturn(h MemoHash) *Memo {
	return &Memo{Type: MemoTypeReturn, ReturnHash: &h}
}

// NewMemoFromStrings returns a Memo converted from a string to the specified type.
func NewMemoFromStrings(in, kind string) (*Memo, error) {
	switch strings.ToLower(kind) {
	case "none", "":
		if in != "" {
			return nil, errors.New("invalid memo: nonempty string for memo type none")
		}
		return NewMemoNone(), nil
	case "text":
		return NewMemoText(in), nil
	case "id":
		n, err := strconv.ParseUint(in, 10, 64)
		if err != nil {
			return nil, fmt.Errorf("invalid memo: could not convert to uint64 id (%s)", err)
		}
		return NewMemoID(n), nil
	case "hash":
		decoded, err := hex.DecodeString(in)
		if err != nil {
			return nil, fmt.Errorf("invalid memo: could not decode hex input string for hash (%s)", err)
		}
		var h MemoHash
		copy(h[:], decoded)
		return NewMemoHash(h), nil
	case "return":
		decoded, err := hex.DecodeString(in)
		if err != nil {
			return nil, fmt.Errorf("invalid memo: could not decode hex input string for hash (%s)", err)
		}
		var h MemoHash
		copy(h[:], decoded)
		return NewMemoReturn(h), nil
	}

	return nil, errors.New("invalid memo:  unknown type")
}

// toXDR returns an xdr.Memo of this memo.
func (m *Memo) toXDR() (xdr.Memo, error) {
	switch m.Type {
	case MemoTypeNone:
		return xdr.NewMemo(xdr.MemoTypeMemoNone, nil)
	case MemoTypeText:
		return xdr.NewMemo(xdr.MemoTypeMemoText, *m.Text)
	case MemoTypeID:
		return xdr.NewMemo(xdr.MemoTypeMemoId, xdr.Uint64(*m.ID))
	case MemoTypeHash:
		return xdr.NewMemo(xdr.MemoTypeMemoHash, xdr.Hash(*m.Hash))
	case MemoTypeReturn:
		return xdr.NewMemo(xdr.MemoTypeMemoReturn, xdr.Hash(*m.ReturnHash))
	}
	return xdr.Memo{}, errors.New("unknown memo type")
}

func (m *Memo) String() string {
	switch m.Type {
	case MemoTypeNone:
		return "<none>"
	case MemoTypeText:
		return fmt.Sprintf("%q <text>", *m.Text)
	case MemoTypeID:
		return fmt.Sprintf("%d <id>", *m.ID)
	case MemoTypeHash:
		return fmt.Sprintf("%x <hash>", *m.Hash)
	case MemoTypeReturn:
		return fmt.Sprintf("%x <return>", *m.ReturnHash)
	}
	return "<unknown>"
}
