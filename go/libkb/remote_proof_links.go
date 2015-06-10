package libkb

import (
	keybase1 "github.com/keybase/client/protocol/go"
)

// RemoteProofLinks holds a set of RemoteProofChainLinks,
// organized by service.
type RemoteProofLinks struct {
	links map[string][]remoteLinkAndErr
}

type remoteLinkAndErr struct {
	link RemoteProofChainLink
	err  ProofError
}

// NewRemoteProofLinks creates a new empty collection of proof
// links.
func NewRemoteProofLinks() *RemoteProofLinks {
	return &RemoteProofLinks{}
}

// Insert adds a link to the collection of proof links.
func (r *RemoteProofLinks) Insert(link RemoteProofChainLink, err ProofError) {
	if r.links == nil {
		r.links = make(map[string][]remoteLinkAndErr)
	}
	key := link.TableKey()
	if len(key) == 0 {
		return
	}
	r.links[key] = append(r.links[key], remoteLinkAndErr{link: link, err: err})
}

// ForService returns all the active proof links for a service.
func (r *RemoteProofLinks) ForService(st ServiceType) []RemoteProofChainLink {
	var links []RemoteProofChainLink
	for _, k := range st.AllStringKeys() {
		for _, l := range r.links[k] {
			if !l.link.IsRevoked() {
				links = append(links, l.link)
				if l.link.LastWriterWins() {
					break
				}
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

// StateOKAndActive returns all the active proofs that are also
// ProofState_OK.
//
// Note that I'm implementing this the same way it existed before
// when GetProofState() existed.  Another option would be to check
// the status within Active(), then if there was an OK link before
// an error link, it would be used.  But I'm not sure that is
// desired.
func (r *RemoteProofLinks) StateOKAndActive() []RemoteProofChainLink {
	a := r.active()
	var links []RemoteProofChainLink
	for _, b := range a {
		if ProofErrorToState(b.err) != keybase1.ProofState_OK {
			continue
		}
		links = append(links, b.link)
	}
	return links
}

func (r *RemoteProofLinks) active() []remoteLinkAndErr {
	var links []remoteLinkAndErr
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
