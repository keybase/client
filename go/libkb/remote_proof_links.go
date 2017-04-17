// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	jsonw "github.com/keybase/go-jsonw"
)

// RemoteProofLinks holds a set of RemoteProofChainLinks,
// organized by service.
type RemoteProofLinks struct {
	links map[string][]ProofLinkWithState
}

// ProofLinkWithState contains a RemoteProofChainLink and the
// proof state.  In addition, it satisfies the TrackIdComponent interface.
type ProofLinkWithState struct {
	link  RemoteProofChainLink
	state keybase1.ProofState
}

// NewRemoteProofLinks creates a new empty collection of proof
// links.
func NewRemoteProofLinks() *RemoteProofLinks {
	return &RemoteProofLinks{}
}

// Insert adds a link to the collection of proof links.
func (r *RemoteProofLinks) Insert(link RemoteProofChainLink, err ProofError) {
	if r.links == nil {
		r.links = make(map[string][]ProofLinkWithState)
	}
	key := link.TableKey()
	if len(key) == 0 {
		return
	}
	r.links[key] = append(r.links[key], ProofLinkWithState{link: link, state: ProofErrorToState(err)})
}

// ForService returns all the active proof links for a service.
func (r *RemoteProofLinks) ForService(st ServiceType) []RemoteProofChainLink {
	var links []RemoteProofChainLink
	for _, k := range st.AllStringKeys() {
		for _, l := range r.links[k] {
			if l.link.IsRevoked() {
				continue
			}
			links = append(links, l.link)
		}
	}

	// Chop the array off if it's a last-writer wins service
	// (like many social networks).
	for i := len(links) - 1; i >= 0; i-- {
		if links[i].LastWriterWins() {
			links = links[i:]
			break
		}

	}

	return links
}

// Active returns all the active proof links, deduplicating any and
// honoring the LastWriterWins option.
func (r *RemoteProofLinks) Active() []RemoteProofChainLink {
	a := r.active()
	links := make([]RemoteProofChainLink, len(a))
	for i, b := range a {
		links[i] = b.link
	}
	return links
}

// TrackingStatement generates the remote proofs portions of the
// tracking statement from the active proofs.
func (r *RemoteProofLinks) TrackingStatement() *jsonw.Wrapper {
	var proofs []*jsonw.Wrapper
	for _, x := range r.active() {
		d, err := x.link.ToTrackingStatement(x.state)
		if err != nil {
			G.Log.Warning("Problem with a proof: %s", err)
			continue
		}
		if d != nil {
			proofs = append(proofs, d)
		}
	}

	res := jsonw.NewArray(len(proofs))
	for i, proof := range proofs {
		res.SetIndex(i, proof)
	}
	return res
}

// TrackSet creates a new TrackSet with all the active proofs.
func (r *RemoteProofLinks) TrackSet() *TrackSet {
	ret := NewTrackSet()
	for _, ap := range r.active() {
		ret.Add(ap)
	}
	return ret
}

// AddProofsToSet adds the active proofs to an existing ProofSet, if they're one of the
// given OkStates. If okStates is nil, then we check only against keybase1.ProofState_OK.
func (r *RemoteProofLinks) AddProofsToSet(existing *ProofSet, okStates []keybase1.ProofState) {
	if okStates == nil {
		okStates = []keybase1.ProofState{keybase1.ProofState_OK}
	}
	isOkState := func(s1 keybase1.ProofState) bool {
		for _, s2 := range okStates {
			if s1 == s2 {
				return true
			}
		}
		return false
	}
	for _, a := range r.active() {
		if !isOkState(a.state) {
			continue
		}
		AddToProofSetNoChecks(a.link, existing)
	}
}

func RemoteProofChainLinkToProof(r RemoteProofChainLink) Proof {
	k, v := r.ToKeyValuePair()
	return Proof{Key: k, Value: v}
}

func AddToProofSetNoChecks(r RemoteProofChainLink, ps *ProofSet) {
	ps.Add(RemoteProofChainLinkToProof(r))
}

func (r *RemoteProofLinks) active() []ProofLinkWithState {
	var links []ProofLinkWithState
	seen := make(map[string]bool)

	// Loop over all types of services
	for _, list := range r.links {

		// Loop over all proofs for that type, from most recent,
		// to oldest.
		for i := len(list) - 1; i >= 0; i-- {
			both := list[i]
			link := both.link
			id := CanonicalProofName(link)

			if !link.IsRevoked() && !seen[id] {
				links = append(links, both)
			}

			// We only want to use the last proof in the list
			// if we have several (like for dns://chriscoyne.com)
			seen[id] = true

			// Things like Twitter, Github, etc, are last-writer wins.
			// Things like dns/https can have multiples
			if link.LastWriterWins() {
				break
			}
		}
	}
	return links
}

// TrackIdComponent interface functions:

func (p ProofLinkWithState) GetProofState() keybase1.ProofState {
	return p.state
}

func (p ProofLinkWithState) LastWriterWins() bool {
	return p.link.LastWriterWins()
}

func (p ProofLinkWithState) ToIDString() string {
	return p.link.ToIDString()
}

func (p ProofLinkWithState) ToImpliedIDStrings() []string {
	return []string{}
}

func (p ProofLinkWithState) ToKeyValuePair() (string, string) {
	return p.link.ToKeyValuePair()
}

func (p ProofLinkWithState) GetProofType() keybase1.ProofType { return p.link.GetProofType() }
