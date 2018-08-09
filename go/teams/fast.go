package teams

import (
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

	// will load via call to .load below

	return res, err
}

// resolveIDToNameViaMerkelTree takes a team ID, and a pointer to a parent team's sigchain, and computes
// the full resolved team name. If the pointer is null, we'll assume this is a root team and do the
// verification via hash-comparison.
func (f *FastTeamChainLoader) resolveIDToNameViaParentLoad(m libkb.MetaContext, id keybase1.TeamID, parent *keybase1.LinkTriple) (res keybase1.TeamName, err error) {

	// will load via call to .load below

	return res, err
}

type fastLoadRes struct {
	keybase1.FastTeamLoadRes
	downPointers map[keybase1.Seqno]keybase1.DownPointer
}

type fastLoadArg struct {
	keybase1.FastTeamLoadArg
	seqnosNeeded []keybase1.Seqno
}

func (f *FastTeamChainLoader) load(m libkb.MetaContext, arg fastLoadArg) (res *fastLoadRes, err error) {

	// this should be the meat.

	return nil, nil
}
