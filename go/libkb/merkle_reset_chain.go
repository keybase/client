package libkb

import (
	sha512 "crypto/sha512"
	json "encoding/json"
	fmt "fmt"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	jsonw "github.com/keybase/go-jsonw"
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

func importResetChainFromServer(m MetaContext, jw *jsonw.Wrapper) (urc unverifiedResetChain, err error) {
	defer m.CVTrace(VLog0, "importResetChainFromServer", func() error { return err })()
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

func (mr *MerkleResets) verifyAndLoad(m MetaContext, urc unverifiedResetChain) (err error) {

	// Don't even bother to do a CVTrace if the user hasn't reset at all
	if mr == nil {
		return nil
	}

	defer m.CVTrace(VLog0, "MerkleResets#verifyAndLoad", func() error { return err })()

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
	foundDelete := false
	lastWasDelete := false

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
		if link.Type == keybase1.ResetType_DELETE {
			if last {
				lastWasDelete = true
			}
			foundDelete = true
		}
		curr = link.Prev.Reset
		last = false
	}

	// NOTE(max) 2018-03-19
	// We should have checked that deletes were only visible at the end of the reset chain.
	// However, there was a bug in the migrate script, and if you had an account that did
	// several resets and then a delete, all were marked as deletes! This check isn't ideal, but
	// it's good enough -- we just want to make sure that a delete is indeed a tombstone,
	// and that if there are any deletes in the chain, then the last must be a delete.
	if foundDelete && !lastWasDelete {
		err = mkerr("found a delete that didn't tombstone the user")
		return err
	}

	if curr != nil {
		err = mkerr("expected first link in reset chain to have a null prev")
		return err
	}

	// It all verified, now load it up, going front to back.
	for _, e := range urc {
		mr.chain = append(mr.chain, e.link)
	}

	return nil
}
