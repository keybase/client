package teams

import (
	"context"
	"fmt"

	"github.com/keybase/client/go/libkb"
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
	teamID keybase1.TeamID, low keybase1.Seqno) (*rawTeam, error) {

	arg := libkb.NewRetryAPIArg("team/get")
	arg.NetContext = ctx
	arg.SessionType = libkb.APISessionTypeREQUIRED
	arg.Args = libkb.HTTPArgs{
		"id": libkb.S{Val: teamID.String()},
	}

	var rt rawTeam

	if err := l.G().API.GetDecode(arg, &rt); err != nil {
		return nil, err
	}
	return &rt, nil
}

// Verify aspects of a link:
// - If it is stubbed, that must be allowed for its type and the needAdmin value.
//   - Stubbed links
// - Signature must match the inner link
// - Was signed by a key valid for the user at the time of signing
// - Was signed by a user with permissions to make the link at the time of signing
// Some checks are deferred as entries in the returned proofSet
// Does not:
// - Apply the link nor modify state
// - Check the rest of the format of the inner link
func (l *TeamLoader) verifyLinkSig(ctx context.Context,
	state *keybase1.TeamData, needAdmin bool, link *chainLinkUnpacked, proofSet *proofSetT) (*proofSetT, error) {

	return nil, l.unimplementedVerificationTODO(ctx, nil)
}

// Whether the chain link is of a (child-half) type
// that affects a parent and child chain in lockstep.
// So far these events: subteam create, and subteam rename
func (l *TeamLoader) isParentChildOperation(ctx context.Context,
	link *chainLinkUnpacked) bool {

	switch link.LinkType() {
	case libkb.SigchainV2TypeTeamSubteamHead, libkb.SigchainV2TypeTeamRenameUpPointer:
		return true
	default:
		return false
	}
}

func (l *TeamLoader) toParentChildOperation(ctx context.Context,
	link *chainLinkUnpacked) *parentChildOperation {

	panic("TODO: implement")
}

// Apply a new link to the sigchain state.
// TODO: verify all sorts of things.
func (l *TeamLoader) applyNewLink(ctx context.Context,
	state *keybase1.TeamData, link *chainLinkUnpacked,
	me keybase1.UserVersion) (*keybase1.TeamData, error) {

	// TODO: This uses chain.go now. But chain.go is not in line
	// with the new approach. It has TODOs to check things that
	// are check by proofSet etc now.
	// And it does not use pre-unpacked types.

	var player *TeamSigChainPlayer
	if state == nil {
		player = NewTeamSigChainPlayer(l.G(), me)
	} else {
		player = NewTeamSigChainPlayerWithState(l.G(), me, TeamSigChainState{inner: state.Chain})
	}

	err := player.AddChainLinks(ctx, []SCChainLink{*link.source})
	if err != nil {
		return nil, err
	}

	newChainState, err := player.GetState()
	if err != nil {
		return nil, err
	}

	var newState *keybase1.TeamData
	if state == nil {
		newState = &keybase1.TeamData{
			Chain:           newChainState.inner,
			PerTeamKeySeeds: make(map[keybase1.PerTeamKeyGeneration]keybase1.PerTeamKeySeedItem),
			ReaderKeyMasks:  make(map[keybase1.TeamApplication]map[keybase1.PerTeamKeyGeneration]keybase1.MaskB64),
		}
	} else {
		newState := state.DeepCopy()
		newState.Chain = newChainState.inner
	}

	return newState, nil
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

	return l.unimplementedVerificationTODO(ctx, nil)
}

// Add data to the state that is not included in the sigchain:
// - per team keys
// - reader key masks
// Checks that the team keys match the published values on the chain.
// Checks that the off-chain data ends up exactly in sync with the chain, generation-wise.
func (l *TeamLoader) addSecrets(ctx context.Context,
	state *keybase1.TeamData, box *TeamBox, prevs map[keybase1.PerTeamKeyGeneration]prevKeySealedEncoded,
	readerKeyMasks []keybase1.ReaderKeyMask) (*keybase1.TeamData, error) {

	latestReceivedGen, seeds, err := l.unboxPerTeamSecrets(ctx, box, prevs)
	if err != nil {
		return nil, err
	}

	ret := state.DeepCopy()

	// Check that each key matches the chain.
	for i, seed := range seeds {
		gen := int(latestReceivedGen) + i + 1 - len(seeds)
		if gen < 1 {
			return nil, fmt.Errorf("gen < 1")
		}

		latestChainGen := len(state.PerTeamKeySeeds)
		if gen <= latestChainGen {
			l.G().Log.CDebugf(ctx, "TeamLoader got old key, dropping without checking")
			continue
		}
		if gen != latestChainGen+1 {
			return nil, fmt.Errorf("wrong key generation: %v != %v", gen, latestChainGen+1)
		}

		item, err := l.checkPerTeamKeyAgainstChain(ctx, state, keybase1.PerTeamKeyGeneration(gen), seed)
		if err != nil {
			return nil, err
		}

		ret.PerTeamKeySeeds[item.Generation] = *item
	}

	// Insert all reader key masks
	// Then scan to make sure there are no gaps in generations and no missing application masks.
	checkMaskGens := make(map[keybase1.PerTeamKeyGeneration]bool)
	for _, rkm := range readerKeyMasks {
		if rkm.Generation < 1 {
			return nil, fmt.Errorf("reader key mask has generation: %v < 0", rkm.Generation)
		}
		if _, ok := ret.ReaderKeyMasks[rkm.Application]; !ok {
			ret.ReaderKeyMasks[rkm.Application] = make(
				map[keybase1.PerTeamKeyGeneration]keybase1.MaskB64)
		}
		ret.ReaderKeyMasks[rkm.Application][rkm.Generation] = rkm.Mask

		checkMaskGens[rkm.Generation] = true
		if rkm.Generation > 1 {
			checkMaskGens[rkm.Generation-1] = true
		}
	}
	for gen := range checkMaskGens {
		err = l.checkReaderKeyMaskCoverage(ctx, &ret, gen)
		if err != nil {
			return nil, err
		}
	}

	return &ret, nil
}

func (l *TeamLoader) checkReaderKeyMaskCoverage(ctx context.Context,
	state *keybase1.TeamData, gen keybase1.PerTeamKeyGeneration) error {

	for _, app := range keybase1.TeamApplicationMap {
		if _, ok := state.ReaderKeyMasks[app]; !ok {
			return fmt.Errorf("missing reader key mask for gen:%v app:%v", gen, app)
		}
		if _, ok := state.ReaderKeyMasks[app][gen]; !ok {
			return fmt.Errorf("missing reader key mask for gen:%v app:%v", gen, app)
		}
	}

	return nil
}

func (l *TeamLoader) checkPerTeamKeyAgainstChain(ctx context.Context,
	state *keybase1.TeamData, gen keybase1.PerTeamKeyGeneration, seed keybase1.PerTeamKeySeed) (*keybase1.PerTeamKeySeedItem, error) {

	km, err := NewTeamKeyManagerWithSecret(l.G(), seed[:], gen)
	if err != nil {
		return nil, err
	}

	chainKey, err := TeamSigChainState{inner: state.Chain}.GetPerTeamKeyAtGeneration(gen)
	if err != nil {
		return nil, err
	}

	newSigKey, err := km.SigningKey()
	if err != nil {
		return nil, err
	}

	newEncKey, err := km.EncryptionKey()
	if err != nil {
		return nil, err
	}

	if !chainKey.SigKID.SecureEqual(newSigKey.GetKID()) {
		return nil, fmt.Errorf("import per-team-key: wrong sigKID expected: %v", chainKey.SigKID.String())
	}

	if !chainKey.EncKID.SecureEqual(newEncKey.GetKID()) {
		return nil, fmt.Errorf("import per-team-key: wrong encKID expected: %v", chainKey.EncKID.String())
	}

	return &keybase1.PerTeamKeySeedItem{
		Seed:       seed,
		Generation: gen,
		Seqno:      chainKey.Seqno,
	}, nil
}

// Unbox per team keys
// Does not check that the keys match the chain
// TODO: return the signer and have the caller check it. Not critical because the public half is check anyway.
// Returns the generation of the box (the greatest generation),
// and a list of the seeds in ascending generation order.
func (l *TeamLoader) unboxPerTeamSecrets(ctx context.Context,
	box *TeamBox, prevs map[keybase1.PerTeamKeyGeneration]prevKeySealedEncoded) (keybase1.PerTeamKeyGeneration, []keybase1.PerTeamKeySeed, error) {

	if box == nil {
		return 0, nil, fmt.Errorf("no key box from server")
	}

	userKey, err := l.perUserEncryptionKey(ctx, box.PerUserKeySeqno)
	if err != nil {
		return 0, nil, err
	}

	secret, err := box.Open(userKey)
	if err != nil {
		return 0, nil, err
	}

	// Secrets starts as descending
	secrets := []keybase1.PerTeamKeySeed{secret}

	for _, prev := range prevs {
		_ = prev
		panic("TODO: implement unboxing prevs")
	}

	// Reverse the list
	// After this secrets is ascending
	// https://github.com/golang/go/wiki/SliceTricks#reversing
	for i := len(secrets)/2 - 1; i >= 0; i-- {
		// opp is the index of the opposite element
		opp := len(secrets) - 1 - i
		secrets[i], secrets[opp] = secrets[opp], secrets[i]
	}

	return box.Generation, secrets, nil
}

func (l *TeamLoader) perUserEncryptionKey(ctx context.Context, userSeqno keybase1.Seqno) (*libkb.NaclDHKeyPair, error) {
	kr, err := l.G().GetPerUserKeyring()
	if err != nil {
		return nil, err
	}
	// Try to get it locally, if that fails try again after syncing.
	encKey, err := kr.GetEncryptionKeyBySeqno(ctx, userSeqno)
	if err == nil {
		return encKey, err
	}
	if err := kr.Sync(ctx); err != nil {
		return nil, err
	}
	encKey, err = kr.GetEncryptionKeyBySeqno(ctx, userSeqno)
	return encKey, err
}

func (l *TeamLoader) unimplementedVerificationTODO(ctx context.Context, meanwhile error) error {
	if l.G().Env.GetRunMode() != libkb.DevelRunMode {
		return fmt.Errorf("team verification not implemented")
	}
	l.G().Log.Warning("TODO: team verification not implemented, skipping verification")
	return meanwhile
}

func (l *TeamLoader) unpackLinks(ctx context.Context, teamUpdate *rawTeam) ([]*chainLinkUnpacked, error) {
	if teamUpdate == nil {
		return nil, nil
	}
	parsedLinks, err := teamUpdate.parseLinks(ctx)
	if err != nil {
		return nil, err
	}
	var links []*chainLinkUnpacked
	for _, pLink := range parsedLinks {
		link, err := unpackChainLink(&pLink)
		if err != nil {
			return nil, err
		}
		links = append(links, link)
	}
	return links, nil
}

func (l *TeamLoader) checkNeededSeqnos(ctx context.Context,
	state *keybase1.TeamData, needSeqnos []keybase1.Seqno) error {

	panic("TODO: implement")
}
