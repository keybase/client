package teams

import (
	lru "github.com/hashicorp/golang-lru"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

// FastTeamChainLoader loads teams using the "fast approach." It doesn't compute
// membership or check any signatures. It just checks for consistency against the merkle
// tree, and audits that the merkle tree is being faithfully constructed.
type FastTeamChainLoader struct {

	// single-flight lock on TeamID
	locktab libkb.LockTable

	// LRU of TeamID -> keybase1.FastTeamData
	lru *lru.Cache
}

// Load fast-loads the given team. Provide some hints as to how to load it. You can specify an application
// and key generations needed, if you are entering chat. Those links will be returned unstubbed
// from the server, and then the keys can be output in the result. Or, if you're doing a fast-load for
// the purposes of loading parent teams to compute a name, then you can specify "seqnosNeeded" to say that certain
// sigchain sequence numbers are neeeded unstubbed.
func (f *FastTeamChainLoader) Load(m libkb.MetaContext, arg keybase1.FastLoadTeamArg) (res keybase1.FastLoadTeamRes, err error) {
	return res, err
}

// ResolveIDToNameViaMerkelTree takes a team ID, and a pointer to a parent team's sigchain, and computes
// the full resolved team name. If the pointer is null, we'll assume this is a root team and do the
// verification via hash-comparison.
func (f *FastTeamChainLoader) ResolveIDToNameViaMerkleTree(m libkb.MetaContext, arg keybase1.FastResolveIDToNameArg) (res keybase1.TeamName, err error) {
	return res, err
}
