package txnbuild

import (
	"testing"

	"github.com/stellar/go/xdr"

	"github.com/stretchr/testify/assert"
)

func TestMemoFromXDR(t *testing.T) {
	// memo text
	xdrMemo, err := xdr.NewMemo(xdr.MemoTypeMemoText, "abc123")
	assert.NoError(t, err)
	memo, err := memoFromXDR(xdrMemo)
	if assert.NoError(t, err) {
		assert.Equal(t, MemoText("abc123"), memo, "memo text should match")
	}

	// memo id
	xdrMemo, err = xdr.NewMemo(xdr.MemoTypeMemoId, xdr.Uint64(1234))
	assert.NoError(t, err)
	memo, err = memoFromXDR(xdrMemo)
	if assert.NoError(t, err) {
		assert.Equal(t, MemoID(1234), memo, "memo id should match")
	}

	// memo hash
	xdrMemo, err = xdr.NewMemo(xdr.MemoTypeMemoHash, xdr.Hash([32]byte{0x10}))
	assert.NoError(t, err)
	memo, err = memoFromXDR(xdrMemo)
	if assert.NoError(t, err) {
		assert.Equal(t, MemoHash([32]byte{0x10}), memo, "memo hash should match")
	}

	// memo return
	xdrMemo, err = xdr.NewMemo(xdr.MemoTypeMemoReturn, xdr.Hash([32]byte{0x01}))
	assert.NoError(t, err)
	memo, err = memoFromXDR(xdrMemo)
	if assert.NoError(t, err) {
		assert.Equal(t, MemoReturn([32]byte{0x01}), memo, "memo return should match")
	}

	// memo none
	xdrMemo, err = xdr.NewMemo(xdr.MemoTypeMemoNone, "")
	assert.NoError(t, err)
	memo, err = memoFromXDR(xdrMemo)
	if assert.NoError(t, err) {
		assert.Equal(t, nil, memo, "memo should be nil")
	}
}
