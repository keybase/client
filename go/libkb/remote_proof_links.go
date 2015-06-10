package libkb

// RemoteProofLinks holds a set of RemoteProofChainLinks,
// organized by service.
type RemoteProofLinks struct {
	links map[string][]RemoteProofChainLink
}

// NewRemoteProofLinks creates a new empty collection of proof
// links.
func NewRemoteProofLinks() *RemoteProofLinks {
	return &RemoteProofLinks{}
}

// Insert adds a link to the collection of proof links.
func (r *RemoteProofLinks) Insert(link RemoteProofChainLink) {
	if r.links == nil {
		r.links = make(map[string][]RemoteProofChainLink)
	}
	key := link.TableKey()
	if len(key) == 0 {
		return
	}
	r.links[key] = append(r.links[key], link)
}

// ForService returns all the active proof links for a service.
func (r *RemoteProofLinks) ForService(st ServiceType) []RemoteProofChainLink {
	var links []RemoteProofChainLink
	for _, k := range st.AllStringKeys() {
		for _, link := range r.links[k] {
			if !link.IsRevoked() {
				links = append(links, link)
				if link.LastWriterWins() {
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
	var links []RemoteProofChainLink
	seen := make(map[string]bool)
	for _, list := range r.links {
		for i := len(list) - 1; i >= 0; i-- {
			link := list[i]
			if link.IsRevoked() {
				continue
			}

			// We only want to use the last proof in the list
			// if we have several (like for dns://chriscoyne.com)
			id := link.ToDisplayString()
			if seen[id] {
				continue
			}

			links = append(links, link)
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
