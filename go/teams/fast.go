package teams

import (
	"fmt"
	lru "github.com/hashicorp/golang-lru"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

//
// fast.go
//
// Routines for fast-team loading. In fast team loading, we ignore most signatures
// and use the Merkle Tree as a source of truth. This is good enough for getting
// directly into a chat, where it's not necessary to see a list of team members.
//

// FastTeamChainLoader loads teams using the "fast approach." It doesn't compute
// membership or check any signatures. It just checks for consistency against the merkle
// tree, and audits that the merkle tree is being faithfully constructed.
type FastTeamChainLoader struct {

	// single-flight lock on TeamID
	locktab libkb.LockTable

	// Hold onto FastTeamLoad by-products as long as we have room
	// We don't store them to disk (as we do slow Load objects).
	// LRU of TeamID -> keybase1.FastTeamData
	lru *lru.Cache
}

// Load fast-loads the given team. Provide some hints as to how to load it. You can specify an application
// and key generations needed, if you are entering chat. Those links will be returned unstubbed
// from the server, and then the keys can be output in the result. Or, if you're doing a fast-load for
// the purposes of loading parent teams to compute a name, then you can specify "seqnosNeeded" to say that certain
// sigchain sequence numbers are neeeded unstubbed.
func (f *FastTeamChainLoader) Load(m libkb.MetaContext, arg keybase1.FastTeamLoadArg) (res keybase1.FastTeamLoadRes, err error) {

	defer m.CTrace(fmt.Sprintf("FastTeamChainLoader#Load(%+v)", arg), func() error { return err })()

	flr, err := f.load(m, fastLoadArg{FastTeamLoadArg: arg})
	if err != nil {
		return res, err
	}

	res = flr.FastTeamLoadRes

	res.Name, err = f.verifyTeamNameViaParentLoad(m, arg.Id, arg.Public, flr.unverifiedName, flr.upPointer)
	if err != nil {
		return res, err
	}

	return res, nil
}

// verifyTeamNameViaParentLoad takes a team ID, and a pointer to a parent team's sigchain, and computes
// the full resolved team name. If the pointer is null, we'll assume this is a root team and do the
// verification via hash-comparison.
func (f *FastTeamChainLoader) verifyTeamNameViaParentLoad(m libkb.MetaContext, id keybase1.TeamID, isPublic bool, unverifiedName keybase1.TeamName, parent *keybase1.LinkTriple) (res keybase1.TeamName, err error) {

	defer m.CTrace(fmt.Sprintf("FastTeamChainLoader#verifyTeamNameViaParentLoad(%s,%s)", id, unverifiedName), func() error { return err })()

	if parent == nil {
		if !unverifiedName.IsRootTeam() {
			return res, NewBadNameError("expected a root team")
		}
		if !unverifiedName.ToTeamID(isPublic).Eq(id) {
			return res, NewBadNameError("root team v. team ID mismatch")
		}
		return unverifiedName, nil
	}

	parentRes, err := f.load(m, fastLoadArg{
		FastTeamLoadArg: keybase1.FastTeamLoadArg{
			Id:     parent.Id,
			Public: isPublic,
		},
		seqnosNeeded: []keybase1.Seqno{parent.Pair.Seqno},
	})
	if err != nil {
		return res, err
	}
	downPointer, ok := parentRes.downPointers[parent.Pair.Seqno]
	if !ok {
		return res, NewBadNameError("down pointer not found in parent")
	}
	suffix := downPointer.NameComponent

	parentName, err := f.verifyTeamNameViaParentLoad(m, parent.Id, isPublic, parentRes.unverifiedName, parentRes.upPointer)
	if err != nil {
		return res, err
	}

	return parentName.Append(suffix)
}

type fastLoadRes struct {
	keybase1.FastTeamLoadRes
	unverifiedName keybase1.TeamName
	downPointers   map[keybase1.Seqno]keybase1.DownPointer
	upPointer      *keybase1.LinkTriple
}

type fastLoadArg struct {
	keybase1.FastTeamLoadArg
	seqnosNeeded []keybase1.Seqno
}

func (f *FastTeamChainLoader) load(m libkb.MetaContext, arg fastLoadArg) (res *fastLoadRes, err error) {

	// this should be the meat.

	return nil, nil
}
