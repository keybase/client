package libkb

import (
	sha512 "crypto/sha512"
	json "encoding/json"
	fmt "fmt"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	jsonw "github.com/keybase/go-jsonw"
	context "golang.org/x/net/context"
)

type resetLinkAndHash struct {
	link keybase1.ResetLink
	hash keybase1.SHA512
}

type unverifiedResetChain []resetLinkAndHash

func importResetLinkAndHash(s string) (ret *resetLinkAndHash, err error) {
	b := []byte(s)
	hash := sha512.Sum512(b)
	var link keybase1.ResetLink
	err = json.Unmarshal(b, &link)
	if err != nil {
		return nil, err
	}
	ret = &resetLinkAndHash{
		hash: hash[:],
		link: link,
	}
	return ret, nil
}

func importResetChainFromServer(ctx context.Context, g *GlobalContext, jw *jsonw.Wrapper) (urc unverifiedResetChain, err error) {
	defer g.CVTrace(ctx, VLog0, "importResetChainFromServer", func() error { return err })()
	if jw == nil || jw.IsNil() {
		return nil, nil
	}
	var ret unverifiedResetChain
	chainLen, err := jw.Len()
	if err != nil {
		return nil, err
	}
	for i := 0; i < chainLen; i++ {
		s, err := jw.AtIndex(i).GetString()
		if err != nil {
			return nil, err
		}
		link, err := importResetLinkAndHash(s)
		if err != nil {
			return nil, err
		}
		ret = append(ret, *link)
	}
	return ret, nil
}

func parseV2LeafResetChainTail(jw *jsonw.Wrapper) (*MerkleResets, error) {
	if jw == nil || jw.IsNil() {
		return nil, nil
	}
	l, err := jw.Len()
	if err != nil {
		return nil, err
	}
	if l == 0 {
		return nil, nil
	}
	if l != 2 {
		return nil, MerkleClientError{m: "bad reset chain tail; expecting 2 items", t: merkleErrorBadResetChain}
	}
	var ct MerkleResetChainTail
	if err := jw.AtIndex(0).UnmarshalAgain(&ct.Seqno); err != nil {
		return nil, err
	}
	if err := jw.AtIndex(1).UnmarshalAgain(&ct.Hash); err != nil {
		return nil, err
	}
	ret := &MerkleResets{chainTail: ct}
	return ret, nil
}

type MerkleResetChainTail struct {
	Seqno keybase1.Seqno
	Hash  keybase1.SHA512
}

type MerkleResets struct {
	chainTail MerkleResetChainTail
	chain     []keybase1.ResetLink
}

func (mr *MerkleResets) verifyAndLoad(ctx context.Context, g *GlobalContext, urc unverifiedResetChain) (err error) {

	// Don't even both a trace if the user hasn't reset at all
	if mr == nil {
		return nil
	}

	defer g.CVTrace(ctx, VLog0, "MerkleResets#verifyAndLoad", func() error { return err })()

	mkerr := func(f string, a ...interface{}) error {
		return MerkleClientError{m: fmt.Sprintf(f, a...), t: merkleErrorBadResetChain}
	}

	hashEq := func(a, b keybase1.SHA512) bool {
		if a == nil || b == nil {
			return (a == nil && b == nil)
		}
		return a.Eq(b)
	}

	if int(mr.chainTail.Seqno) != len(urc) {
		err = mkerr("bad reset chain length: %d != %d", int(mr.chainTail.Seqno), len(urc))
		return err
	}

	// Verify the chain starting at the tail and going to the front.
	curr := mr.chainTail.Hash
	last := true
	for i := len(urc) - 1; i >= 0; i-- {
		resetSeqno := i + 1
		link := urc[i].link
		hash := urc[i].hash
		if !hashEq(curr, hash) {
			err = mkerr("hash chain mismatch at seqno %d", resetSeqno)
			return err
		}
		if int(link.ResetSeqno) != resetSeqno {
			err = mkerr("wrong seqno at seqno %d", resetSeqno)
			return err
		}
		if link.Type == keybase1.ResetType_DELETE && !last {
			err = mkerr("delete can only happen at the end of a reset chain")
			return err
		}
		curr = link.Prev.Reset
		last = false
	}

	// It all verified, now load it up, going front to back.
	for _, e := range urc {
		mr.chain = append(mr.chain, e.link)
	}

	return nil
}
