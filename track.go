package libkb

// Can either be a RemoteProofChainLink or one of the identities
// listed in a tracking statement
type TrackIdComponent interface {
	GetIdString() string
}

type TrackSet map[string]bool

func (ts TrackSet) Add(t TrackIdComponent) {
	ts[t.GetIdString()] = true
}

func (a TrackSet) SubsetOf(b TrackSet) bool {
	for k,_ := range(a) {
		if inset, found := b[k]; !inset || !found {
			return false
		}
	}	
	return true
}

func (a TrackSet) Equal(b TrackSet) bool {
	return ((len(a) == len(b)) && a.SubsetOf(b))
}
