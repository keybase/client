package teams

import (
	"github.com/keybase/client/go/protocol/keybase1"
)

// Collection of ordering constraints waiting to be verified.
// TODO implement
type proofSetT struct{}

func newProofSet() *proofSetT {
	return &proofSetT{}
}

func (p *proofSetT) HappensBefore(a keybase1.SignatureMetadata, b keybase1.SignatureMetadata) *proofSetT {
	// TODO!
	return p
}
