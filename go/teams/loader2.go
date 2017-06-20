package teams

import (
	"context"
	"fmt"

	"github.com/keybase/client/go/protocol/keybase1"
)

// loader2.go contains methods on TeamLoader.
// It would be normal for them to be in loader.go but:
// These functions do not call any functions in loader.go except for load2.
// They are here so that the files can be more manageable in size and
// people can work on loader.go and loader2.go simultaneously with less conflict.

// If links are needed in full that are stubbed in state, go out and get them from the server.
// Does not ask for any links above state's seqno, those will be fetched by getNewLinksFromServer.
func (l *TeamLoader) fillInStubbedLinks(ctx context.Context,
	state *keybase1.TeamData, needSeqnos []keybase1.Seqno, proofSet *proofSetT) (*keybase1.TeamData, *proofSetT, error) {

	panic("TODO: implement")
}

func (l *TeamLoader) getNewLinksFromServer(ctx context.Context,
	teamID keybase1.TeamID, low keybase1.Seqno) (*teamUpdateT, error) {

	panic("TODO: implement")
}

// Verify that a link:
// - Was signed by a valid key for the user
// - Was signed by a user with permissions to make this link
// - Was signed
// But do not apply the link.
func (l *TeamLoader) verifyLink(ctx context.Context,
	state *keybase1.TeamData, link *SCChainLink, proofSet *proofSetT) (*proofSetT, error) {

	panic("TODO: implement")
}

// Whether the chain link is of a (child-half) type
// that affects a parent and child chain in lockstep.
// So far these events: subteam create, and subteam rename
// TODO: the go-type of `link` here probably won't work out.
func (l *TeamLoader) isParentChildOperation(ctx context.Context,
	link *SCChainLink) bool {

	panic("TODO: implement")
}

func (l *TeamLoader) toParentChildOperation(ctx context.Context,
	link *SCChainLink) *parentChildOperation {

	panic("TODO: implement")
}

// Apply a new link to the sigchain state.
// TODO: verify all sorts of things.
func (l *TeamLoader) applyNewLink(ctx context.Context,
	state *keybase1.TeamData, link *SCChainLink) (*keybase1.TeamData, error) {

	panic("TODO: implement")
}

// Check that the parent-child operations appear in the parent sigchains.
func (l *TeamLoader) checkParentChildOperations(ctx context.Context,
	parent *keybase1.TeamID, parentChildOperations []*parentChildOperation) error {
	if len(parentChildOperations) == 0 {
		return nil
	}
	if parent == nil {
		return fmt.Errorf("cannot check parent-child operations with no parent")
	}

	panic("TODO: implement")
}

// Check all the proofs and ordering constraints in proofSet
func (l *TeamLoader) checkProofs(ctx context.Context,
	state *keybase1.TeamData, proofSet *proofSetT) error {

	panic("TODO: implement")
}

// Add data to the state that is not included in the sigchain.
// This includes
// - per-team-keys
// - reader key masks
// Checks that the team keys match the published values on the chain.
// Checks that the off-chain data ends up exactly in sync with the chain, generation-wise.
func (l *TeamLoader) addSecrets(ctx context.Context,
	state *keybase1.TeamData, box *TeamBox, prev []interface{} /* TODO figure out this type */, readerKeyMasks []keybase1.ReaderKeyMask) (*keybase1.TeamData, error) {

	panic("TODO: implement")
}
