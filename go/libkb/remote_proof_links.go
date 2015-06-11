package libkb

import (
	keybase1 "github.com/keybase/client/protocol/go"
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
			if l.link.LastWriterWins() {
				break
			}
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

// AddProofsToSet adds the active proofs to an existing ProofSet.
func (r *RemoteProofLinks) AddProofsToSet(existing *ProofSet) {
	for _, a := range r.active() {
		if a.state != keybase1.ProofState_OK {
			continue
		}
		k, v := a.link.ToKeyValuePair()
		existing.Add(Proof{Key: k, Value: v})
	}
}

func (r *RemoteProofLinks) active() []ProofLinkWithState {
	var links []ProofLinkWithState
	seen := make(map[string]bool)
	for _, list := range r.links {
		for i := len(list) - 1; i >= 0; i-- {
			both := list[i]
			link := both.link
			if link.IsRevoked() {
				continue
			}

			// We only want to use the last proof in the list
			// if we have several (like for dns://chriscoyne.com)
			id := link.ToDisplayString()
			if seen[id] {
				continue
			}

			links = append(links, both)
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

func (p ProofLinkWithState) ToIdString() string {
	return p.link.ToIdString()
}

func (p ProofLinkWithState) ToKeyValuePair() (string, string) {
	return p.link.ToKeyValuePair()
}
