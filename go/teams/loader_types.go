package teams

import "github.com/keybase/client/go/protocol/keybase1"

// Collection of ordering constraints waiting to be verified.
// TODO implement
type proofSetT struct{}

func newProofSet() *proofSetT {
	return &proofSetT{}
}

// --------------------------------------------------

// An operation that occurs simultaneously on the child and parent team chains
// TODO implement
type parentChildOperation struct {
}

// --------------------------------------------------

// A server response containing new links
// as well as readerKeyMasks and per-team-keys.
// TODO implement (may be exactly rawTeam)
type teamUpdateT struct {
	Box            *TeamBox
	Prevs          []interface{} // TODO figure out this type
	ReaderKeyMasks []keybase1.ReaderKeyMask
}

func (t *teamUpdateT) links() ([]SCChainLink, error) {
	panic("TODO: implement")
}
