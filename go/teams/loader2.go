package teams

import (
	"fmt"

	"golang.org/x/net/context"

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
	me keybase1.UserVersion, teamID keybase1.TeamID, state *keybase1.TeamData,
	needSeqnos []keybase1.Seqno, readSubteamID keybase1.TeamID,
	proofSet *proofSetT, parentChildOperations []*parentChildOperation) (
	*keybase1.TeamData, *proofSetT, []*parentChildOperation, error) {

	upperLimit := keybase1.Seqno(0)
	if state != nil {
		upperLimit = state.Chain.LastSeqno
	}

	// seqnos needed from the server
	var requestSeqnos []keybase1.Seqno
	for _, seqno := range needSeqnos {
		linkIsAlreadyFilled := TeamSigChainState{inner: state.Chain}.IsLinkFullyPresent(seqno)
		if seqno <= upperLimit && !linkIsAlreadyFilled {
			requestSeqnos = append(requestSeqnos, seqno)
		}
	}
	if len(requestSeqnos) == 0 {
		// early out
		return state, proofSet, parentChildOperations, nil
	}

	teamUpdate, err := l.world.getLinksFromServer(ctx, state.Chain.Id, requestSeqnos, &readSubteamID)
	if err != nil {
		return state, proofSet, parentChildOperations, err
	}
	newLinks, err := l.unpackLinks(ctx, teamUpdate)
	if err != nil {
		return state, proofSet, parentChildOperations, err
	}

	for _, link := range newLinks {
		if link.isStubbed() {
			return state, proofSet, parentChildOperations, NewStubbedErrorWithNote(
				link, "filling stubbed link")
		}

		var signer *signerX
		signer, err = l.verifyLink(ctx, teamID, state, me, link, readSubteamID, proofSet)
		if err != nil {
			return state, proofSet, parentChildOperations, err
		}

		if signer == nil || !signer.signer.Uid.Exists() {
			return state, proofSet, parentChildOperations, fmt.Errorf("blank signer for full link: %v", signer)
		}

		state, err = l.inflateLink(ctx, state, link, *signer, me)
		if err != nil {
			return state, proofSet, parentChildOperations, err
		}

		if l.isParentChildOperation(ctx, link) {
			pco, err := l.toParentChildOperation(ctx, link)
			if err != nil {
				return state, proofSet, parentChildOperations, err
			}
			parentChildOperations = append(parentChildOperations, pco)
		}
	}

	return state, proofSet, parentChildOperations, nil

}

type getLinksLows struct {
	// Latest seqno on file
	Seqno keybase1.Seqno
	// Latest PTK generation on file
	PerTeamKey keybase1.PerTeamKeyGeneration
	// Latest RKM generation on file
	ReaderKeyMask keybase1.PerTeamKeyGeneration
}

// checkStubbed checks if it's OK that a link is stubbed.
func (l *TeamLoader) checkStubbed(ctx context.Context, arg load2ArgT, link *chainLinkUnpacked) error {
	if !link.isStubbed() {
		return nil
	}
	if l.seqnosContains(arg.needSeqnos, link.Seqno()) {
		return NewStubbedErrorWithNote(link, "Need seqno")
	}
	if arg.needAdmin || !link.outerLink.LinkType.TeamAllowStubWithAdminFlag(arg.needAdmin) {
		return NewStubbedErrorWithNote(link, "Need admin privilege for this action")
	}
	return nil
}

func (l *TeamLoader) loadUserAndKeyFromLinkInner(ctx context.Context,
	inner SCChainLinkPayload) (
	signerUV keybase1.UserVersion, key *keybase1.PublicKeyV2NaCl, linkMap map[keybase1.Seqno]keybase1.LinkID, err error) {

	defer l.G().CTrace(ctx, fmt.Sprintf("TeamLoader#loadUserForSigVerification(%d)", int(inner.Seqno)), func() error { return err })()
	keySection := inner.Body.Key
	if keySection == nil {
		return signerUV, nil, nil, libkb.NoUIDError{}
	}
	uid := keySection.UID
	kid := keySection.KID
	signerUV, key, linkMap, err = l.world.loadKeyV2(ctx, uid, kid)
	if err != nil {
		return signerUV, nil, nil, err
	}
	return signerUV, key, linkMap, nil
}

func (l *TeamLoader) verifySignatureAndExtractKID(ctx context.Context, outer libkb.OuterLinkV2WithMetadata) (keybase1.KID, error) {
	return outer.Verify(l.G().Log)
}

func (l *TeamLoader) addProofsForKeyInUserSigchain(ctx context.Context, teamID keybase1.TeamID, teamLinkMap map[keybase1.Seqno]keybase1.LinkID, link *chainLinkUnpacked, uid keybase1.UID, key *keybase1.PublicKeyV2NaCl, userLinkMap map[keybase1.Seqno]keybase1.LinkID, proofSet *proofSetT) {
	a := newProofTerm(uid.AsUserOrTeam(), key.Base.Provisioning, userLinkMap)
	b := newProofTerm(teamID.AsUserOrTeam(), link.SignatureMetadata(), teamLinkMap)
	c := key.Base.Revocation
	proofSet.AddNeededHappensBeforeProof(ctx, a, b, "user key provisioned before team link")
	if c != nil {
		proofSet.AddNeededHappensBeforeProof(ctx, b, newProofTerm(uid.AsUserOrTeam(), *c, userLinkMap), "team link before user key revocation")
	}
}

// Verify aspects of a link:
// - Signature must match the outer link
// - Signature must match the inner link if not stubbed
// - Was signed by a key valid for the user at the time of signing
// - Was signed by a user with permissions to make the link at the time of signing
// - Checks outer-inner match
// Some checks are deferred as entries in the returned proofSet
// Does not:
// - Apply the link nor modify state
// - Check the rest of the format of the inner link
// Returns the signer, or nil if the link was stubbed
func (l *TeamLoader) verifyLink(ctx context.Context,
	teamID keybase1.TeamID, state *keybase1.TeamData, me keybase1.UserVersion, link *chainLinkUnpacked,
	readSubteamID keybase1.TeamID, proofSet *proofSetT) (*signerX, error) {

	if link.isStubbed() {
		return nil, nil
	}

	err := link.AssertInnerOuterMatch()
	if err != nil {
		return nil, err
	}

	if !teamID.Eq(link.innerTeamID) {
		return nil, fmt.Errorf("team ID mismatch: %s != %s", teamID, link.innerTeamID)
	}

	kid, err := l.verifySignatureAndExtractKID(ctx, *link.outerLink)
	if err != nil {
		return nil, err
	}

	signerUV, key, linkMap, err := l.loadUserAndKeyFromLinkInner(ctx, *link.inner)
	if err != nil {
		return nil, err
	}

	if !kid.Equal(key.Base.Kid) {
		return nil, libkb.NewWrongKidError(kid, key.Base.Kid)
	}

	teamLinkMap := make(map[keybase1.Seqno]keybase1.LinkID)
	if state != nil {
		// copy over the stored links
		for k, v := range state.Chain.LinkIDs {
			teamLinkMap[k] = v
		}
	}
	// add on the link that is being checked
	teamLinkMap[link.Seqno()] = link.LinkID().Export()

	l.addProofsForKeyInUserSigchain(ctx, teamID, teamLinkMap, link, signerUV.Uid, key, linkMap, proofSet)

	signer := signerX{signer: signerUV}

	// For a root team link, or a subteam_head, there is no reason to check adminship
	// or writership (or readership) for the team.
	if state == nil {
		return &signer, nil
	}

	var isReaderOrAbove bool
	if !link.outerLink.LinkType.RequiresAdminPermission() {
		err = l.verifyWriterOrReaderPermissions(ctx, state, link, signerUV)
		isReaderOrAbove = (err == nil)
	}
	if link.outerLink.LinkType.RequiresAdminPermission() || !isReaderOrAbove {
		// Check for admin permissions if they are not an on-chain reader/writer
		// because they might be an implicit admin.
		// Reassigns signer, might set implicitAdmin.
		signer, err = l.verifyAdminPermissions(ctx, state, me, link, readSubteamID, signerUV, proofSet)
	}
	return &signer, err
}

func (l *TeamLoader) verifyWriterOrReaderPermissions(ctx context.Context,
	state *keybase1.TeamData, link *chainLinkUnpacked, uv keybase1.UserVersion) error {

	return (TeamSigChainState{state.Chain}).AssertWasReaderAt(uv, link.SigChainLocation())
}

// Does not return a full TeamData because it might get a subteam-reader version.
func (l *TeamLoader) walkUpToAdmin(
	ctx context.Context, team *keybase1.TeamData, me keybase1.UserVersion, readSubteamID keybase1.TeamID,
	uv keybase1.UserVersion, admin SCTeamAdmin) (*TeamSigChainState, error) {

	target, err := admin.TeamID.ToTeamID()
	if err != nil {
		return nil, err
	}

	for team != nil && !team.Chain.Id.Eq(target) {
		parent := team.Chain.ParentID
		if parent == nil {
			return nil, NewAdminNotFoundError(admin)
		}
		arg := load2ArgT{
			teamID:        *parent,
			reason:        "walkUpToAdmin",
			me:            me,
			staleOK:       true,
			readSubteamID: &readSubteamID,
		}
		if target.Eq(*parent) {
			arg.needSeqnos = []keybase1.Seqno{admin.Seqno}
		}
		load2Res, err := l.load2(ctx, arg)
		if err != nil {
			return nil, err
		}
		team = &load2Res.team
	}
	if team == nil {
		return nil, fmt.Errorf("teamloader fault: nil team after admin walk")
	}
	return &TeamSigChainState{inner: team.Chain}, nil
}

func (l *TeamLoader) addProofsForAdminPermission(ctx context.Context, t keybase1.TeamSigChainState, link *chainLinkUnpacked, bookends proofTermBookends, proofSet *proofSetT) {
	a := bookends.left
	b := newProofTerm(t.Id.AsUserOrTeam(), link.SignatureMetadata(), t.LinkIDs)
	c := bookends.right
	proofSet.AddNeededHappensBeforeProof(ctx, a, b, "became admin before team link")
	if c != nil {
		proofSet.AddNeededHappensBeforeProof(ctx, b, *c, "team link before adminship demotion")
	}
}

func (l *TeamLoader) verifyAdminPermissions(ctx context.Context,
	state *keybase1.TeamData, me keybase1.UserVersion, link *chainLinkUnpacked, readSubteamID keybase1.TeamID,
	uv keybase1.UserVersion, proofSet *proofSetT) (signerX, error) {

	signer := signerX{signer: uv}
	explicitAdmin := link.inner.TeamAdmin()
	teamChain := TeamSigChainState{inner: state.Chain}

	// In the simple case, we don't ask for explicit adminship, so we have to be admins of
	// the current chain at or before the signature in question.
	if explicitAdmin == nil {
		err := teamChain.AssertWasAdminAt(uv, link.SigChainLocation())
		return signer, err
	}

	// The more complicated case is that there's an explicit admin permssion given, perhaps
	// of a parent team.
	adminTeam, err := l.walkUpToAdmin(ctx, state, me, readSubteamID, uv, *explicitAdmin)
	if err != nil {
		return signer, err
	}
	adminBookends, err := adminTeam.assertBecameAdminAt(uv, explicitAdmin.SigChainLocation())
	if err != nil {
		return signer, err
	}

	// This was an implicit admin action if the team from which admin-power was derived (adminTeam)
	// is not the link's team (state).
	if !adminTeam.GetID().Eq(teamChain.GetID()) {
		signer.implicitAdmin = true
	}

	l.addProofsForAdminPermission(ctx, state.Chain, link, adminBookends, proofSet)
	return signer, nil
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
	link *chainLinkUnpacked) (*parentChildOperation, error) {

	if !l.isParentChildOperation(ctx, link) {
		return nil, fmt.Errorf("link is not a parent-child operation: (seqno:%v, type:%v)",
			link.Seqno(), link.LinkType())
	}

	if link.isStubbed() {
		return nil, fmt.Errorf("child half of parent-child operation cannot be stubbed: (seqno:%v, type:%v)",
			link.Seqno(), link.LinkType())
	}

	switch link.LinkType() {
	case libkb.SigchainV2TypeTeamSubteamHead, libkb.SigchainV2TypeTeamRenameUpPointer:
		if link.inner.Body.Team == nil {
			return nil, fmt.Errorf("bad parent-child operation missing team section: (seqno:%v, type:%v)",
				link.Seqno(), link.LinkType())
		}
		if link.inner.Body.Team.Parent == nil {
			return nil, fmt.Errorf("parent-child operation missing team parent: (seqno:%v, type:%v)",
				link.Seqno(), link.LinkType())
		}
		parentSeqno := link.inner.Body.Team.Parent.Seqno
		if parentSeqno < 1 {
			return nil, fmt.Errorf("bad parent-child up seqno: %v", parentSeqno)
		}
		if link.inner.Body.Team.Name == nil {
			return nil, fmt.Errorf("parent-child operation %v missing new name", link.LinkType())
		}
		newName, err := keybase1.TeamNameFromString((string)(*link.inner.Body.Team.Name))
		if err != nil {
			return nil, fmt.Errorf("parent-child operation %v has invalid new name: %v",
				link.LinkType(), *link.inner.Body.Team.Name)
		}
		return &parentChildOperation{
			parentSeqno: parentSeqno,
			linkType:    link.LinkType(),
			newName:     newName,
		}, nil
	default:
		return nil, fmt.Errorf("unsupported parent-child operation: %v", link.LinkType())
	}

}

// Apply a new link to the sigchain state.
// `signer` may be nil iff link is stubbed.
func (l *TeamLoader) applyNewLink(ctx context.Context,
	state *keybase1.TeamData, link *chainLinkUnpacked,
	signer *signerX, me keybase1.UserVersion) (*keybase1.TeamData, error) {

	l.G().Log.CDebugf(ctx, "TeamLoader applying link seqno:%v", link.Seqno())

	var player *TeamSigChainPlayer
	if state == nil {
		player = NewTeamSigChainPlayer(l.G(), me)
	} else {
		player = NewTeamSigChainPlayerWithState(l.G(), me, TeamSigChainState{inner: state.Chain})
	}

	err := player.AppendChainLink(ctx, link, signer)
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
			// Name is left blank until calculateName updates it.
			// It shall not be blank by the time it is returned from load2.
			Name:            keybase1.TeamName{},
			Chain:           newChainState.inner,
			PerTeamKeySeeds: make(map[keybase1.PerTeamKeyGeneration]keybase1.PerTeamKeySeedItem),
			ReaderKeyMasks:  make(map[keybase1.TeamApplication]map[keybase1.PerTeamKeyGeneration]keybase1.MaskB64),
		}
	} else {
		newState2 := state.DeepCopy()
		newState2.Chain = newChainState.inner
		newState = &newState2
	}

	return newState, nil
}

// Inflate a link that was stubbed with its non-stubbed data.
func (l *TeamLoader) inflateLink(ctx context.Context,
	state *keybase1.TeamData, link *chainLinkUnpacked,
	signer signerX, me keybase1.UserVersion) (
	*keybase1.TeamData, error) {

	l.G().Log.CDebugf(ctx, "TeamLoader inflating link seqno:%v", link.Seqno())

	if state == nil {
		// The only reason state would be nil is if this is link 1.
		// But link 1 can't be stubbed.
		return nil, NewInflateErrorWithNote(link, "no prior state")
	}

	player := NewTeamSigChainPlayerWithState(l.G(), me, TeamSigChainState{inner: state.Chain})

	err := player.InflateLink(link, signer)
	if err != nil {
		return nil, err
	}

	newChainState, err := player.GetState()
	if err != nil {
		return nil, err
	}

	newState := state.DeepCopy()
	newState.Chain = newChainState.inner

	return &newState, nil
}

// Check that the parent-child operations appear in the parent sigchains.
func (l *TeamLoader) checkParentChildOperations(ctx context.Context,
	me keybase1.UserVersion, loadingTeamID keybase1.TeamID, parentID *keybase1.TeamID, readSubteamID keybase1.TeamID,
	parentChildOperations []*parentChildOperation) error {

	if len(parentChildOperations) == 0 {
		return nil
	}
	if parentID == nil {
		return fmt.Errorf("cannot check parent-child operations with no parent")
	}

	var needParentSeqnos []keybase1.Seqno
	for _, pco := range parentChildOperations {
		needParentSeqnos = append(needParentSeqnos, pco.parentSeqno)
	}

	parent, err := l.load2(ctx, load2ArgT{
		teamID: *parentID,

		reason: "checkParentChildOperations-parent",

		needAdmin:         false,
		needKeyGeneration: 0,
		wantMembers:       nil,
		wantMembersRole:   keybase1.TeamRole_NONE,
		forceFullReload:   false,
		forceRepoll:       false,
		staleOK:           true, // stale is fine, as long as get those seqnos.

		needSeqnos:    needParentSeqnos,
		readSubteamID: &readSubteamID,

		me: me,
	})
	if err != nil {
		return fmt.Errorf("error loading parent: %v", err)
	}

	for _, pco := range parentChildOperations {
		parentChain := TeamSigChainState{inner: parent.team.Chain}
		err = l.checkOneParentChildOperation(ctx, pco, loadingTeamID, &parentChain)
		if err != nil {
			return err
		}
	}

	return nil
}

func (l *TeamLoader) checkOneParentChildOperation(ctx context.Context,
	pco *parentChildOperation, teamID keybase1.TeamID, parent *TeamSigChainState) error {

	switch pco.linkType {
	case libkb.SigchainV2TypeTeamSubteamHead:
		return parent.SubteamRenameOccurred(teamID, pco.newName, pco.parentSeqno)
	case libkb.SigchainV2TypeTeamRenameUpPointer:
		return parent.SubteamRenameOccurred(teamID, pco.newName, pco.parentSeqno)
	}
	return fmt.Errorf("unrecognized parent-child operation could not be checked: %v", pco.linkType)
}

// Check all the proofs and ordering constraints in proofSet
func (l *TeamLoader) checkProofs(ctx context.Context,
	state *keybase1.TeamData, proofSet *proofSetT) error {

	if state == nil {
		return fmt.Errorf("teamloader fault: nil team for proof ordering check")
	}
	// Give the most up-to-date linkmap to the ordering checker.
	// Without this it would fail in some cases when the team is on the left.
	// Because the team linkmap in the proof objects is stale.
	proofSet.SetTeamLinkMap(ctx, state.Chain.Id, state.Chain.LinkIDs)
	return proofSet.check(ctx, l.world)
}

// Add data to the state that is not included in the sigchain:
// - per team keys
// - reader key masks
// Checks that the team keys match the published values on the chain.
// Checks that the off-chain data ends up exactly in sync with the chain, generation-wise.
func (l *TeamLoader) addSecrets(ctx context.Context,
	state *keybase1.TeamData, me keybase1.UserVersion, box *TeamBox, prevs map[keybase1.PerTeamKeyGeneration]prevKeySealedEncoded,
	readerKeyMasks []keybase1.ReaderKeyMask) (*keybase1.TeamData, error) {

	latestReceivedGen, seeds, err := l.unboxPerTeamSecrets(ctx, box, prevs)
	if err != nil {
		return nil, err
	}
	// Earliest generation received.
	earliestReceivedGen := latestReceivedGen - keybase1.PerTeamKeyGeneration(len(seeds)-1)
	// Latest generation from the sigchain
	latestChainGen := keybase1.PerTeamKeyGeneration(len(state.Chain.PerTeamKeys))

	l.G().Log.CDebugf(ctx, "TeamLoader#addSecrets: received:%v->%v nseeds:%v nprevs:%v",
		earliestReceivedGen, latestReceivedGen, len(seeds), len(prevs))

	if latestReceivedGen != latestChainGen {
		return nil, fmt.Errorf("wrong latest key generation: %v != %v",
			latestReceivedGen, latestChainGen)
	}

	ret := state.DeepCopy()

	// Check that each key matches the chain.
	var gotOldKeys bool
	for i, seed := range seeds {
		gen := int(latestReceivedGen) + i + 1 - len(seeds)
		if gen < 1 {
			return nil, fmt.Errorf("gen < 1")
		}

		if gen <= int(latestChainGen) {
			gotOldKeys = true
		}

		item, err := l.checkPerTeamKeyAgainstChain(ctx, state, keybase1.PerTeamKeyGeneration(gen), seed)
		if err != nil {
			return nil, err
		}

		// Add it to the snapshot
		ret.PerTeamKeySeeds[item.Generation] = *item
	}

	if gotOldKeys {
		l.G().Log.CDebugf(ctx, "TeamLoader got old keys, re-checking as if new")
	}

	// Make sure there is not a gap between the latest local key and the earliest received key.
	if earliestReceivedGen != keybase1.PerTeamKeyGeneration(1) {
		// Use `state` instead of `ret` to get the state before loading this round of secrets.
		if _, ok := state.PerTeamKeySeeds[earliestReceivedGen]; !ok {
			return nil, fmt.Errorf("gap in per-team-keys: latestRecvd:%v earliestRecvd:%v",
				latestReceivedGen, earliestReceivedGen)
		}
	}

	chain := TeamSigChainState{inner: state.Chain}
	role, err := chain.GetUserRole(me)
	if err != nil {
		role = keybase1.TeamRole_NONE
	}
	if role.IsReaderOrAbove() {
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
				// Check for the previous rkm to make sure there are no gaps
				checkMaskGens[rkm.Generation-1] = true
			}
		}
		// Check that we are all the way up to date
		checkMaskGens[latestChainGen] = true
		for gen := range checkMaskGens {
			err = l.checkReaderKeyMaskCoverage(ctx, &ret, gen)
			if err != nil {
				return nil, err
			}
		}

	} else {
		// Discard all cached reader key masks if we are not an explicit member of the team.
		ret.ReaderKeyMasks = make(map[keybase1.TeamApplication]map[keybase1.PerTeamKeyGeneration]keybase1.MaskB64)

		// Also we shouldn't have gotten any from the server.
		if len(readerKeyMasks) > 0 {
			l.G().Log.CWarningf(ctx, "TeamLoader got %v reader-key-masks but not an explicit member",
				len(readerKeyMasks))
		}
	}

	return &ret, nil
}

// Check that the RKMs for a generation are covered for all apps.
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

	km, err := NewTeamKeyManagerWithSecret(l.G(), seed, gen)
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
// TODO: return the signer and have the caller check it. Not critical because the public half is checked anyway.
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

	secret1, err := box.Open(userKey)
	if err != nil {
		return 0, nil, fmt.Errorf("opening key box: %v", err)
	}

	// Secrets starts as descending
	secrets := []keybase1.PerTeamKeySeed{secret1}

	// The generation to work on opening
	openGeneration := box.Generation - keybase1.PerTeamKeyGeneration(1)

	// Walk down generations until
	// - the map is exhausted
	// - if malformed, the map has a gap
	// - reach generation 0
	for {
		if int(openGeneration) == 0 || int(openGeneration) < 0 {
			break
		}
		// Prevs is keyed by the generation that can decrypt, not the generation contained.
		prev, ok := prevs[openGeneration+1]
		if !ok {
			break
		}
		secret, err := decryptPrevSingle(ctx, prev, secrets[len(secrets)-1])
		if err != nil {
			return box.Generation, nil, fmt.Errorf("opening prev gen %v: %v", openGeneration, err)
		}
		secrets = append(secrets, *secret)
		openGeneration--
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
	return l.world.perUserEncryptionKey(ctx, userSeqno)
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
		pLink2 := pLink
		link, err := unpackChainLink(&pLink2)
		if err != nil {
			return nil, err
		}
		if !link.isStubbed() {
			if !link.innerTeamID.Eq(teamUpdate.ID) {
				return nil, fmt.Errorf("link has wrong team ID in response: %v != %v",
					link.innerTeamID, teamUpdate.ID)
			}
		}
		links = append(links, link)
	}
	return links, nil
}

// Whether the snapshot has fully loaded, non-stubbed, all of the links.
func (l *TeamLoader) checkNeededSeqnos(ctx context.Context,
	state *keybase1.TeamData, needSeqnos []keybase1.Seqno) error {

	if len(needSeqnos) == 0 {
		return nil
	}
	if state == nil {
		return fmt.Errorf("nil team does not contain needed seqnos")
	}

	for _, seqno := range needSeqnos {
		if (TeamSigChainState{inner: state.Chain}).HasStubbedSeqno(seqno) {
			return fmt.Errorf("needed seqno is stubbed: %v", seqno)
		}
	}
	return nil
}

// Calculates the latest name of the team.
// The last part will be as up to date as the sigchain in state.
// The mid-team parts can be as old as the cache time, unless staleOK is false in which case they will be fetched.
func (l *TeamLoader) calculateName(ctx context.Context,
	state *keybase1.TeamData, me keybase1.UserVersion, readSubteamID keybase1.TeamID, staleOK bool) (newName keybase1.TeamName, err error) {

	chain := TeamSigChainState{inner: state.Chain}
	if !chain.IsSubteam() {
		return chain.inner.RootAncestor, nil
	}

	// Load the parent. The parent load will recalculate it's own name,
	// so this name recalculation is recursive.
	parent, err := l.load2(ctx, load2ArgT{
		teamID:        *chain.GetParentID(),
		reason:        "calculateName",
		staleOK:       staleOK,
		readSubteamID: &readSubteamID,
		me:            me,
	})
	if err != nil {
		return newName, err
	}

	// Swap out the parent name as the base of this name.
	// Check that the root ancestor name and depth still match the subteam chain.

	newName, err = parent.team.Name.Append(string(chain.LatestLastNamePart()))
	if err != nil {
		return newName, fmt.Errorf("invalid new subteam name: %v", err)
	}

	if !newName.RootAncestorName().Eq(chain.inner.RootAncestor) {
		return newName, fmt.Errorf("subteam changed root ancestor: %v -> %v",
			chain.inner.RootAncestor, newName.RootAncestorName())
	}

	if newName.Depth() != chain.inner.NameDepth {
		return newName, fmt.Errorf("subteam changed depth: %v -> %v", chain.inner.NameDepth, newName.Depth())
	}

	return newName, nil
}
