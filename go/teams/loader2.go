package teams

import (
	"context"
	"fmt"
	"strings"

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

	teamUpdate, err := l.getLinksFromServer(ctx, state.Chain.Id, requestSeqnos, &readSubteamID)
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

		var signer *keybase1.UserVersion
		signer, proofSet, err = l.verifyLink(ctx, teamID, state, me, link, readSubteamID, proofSet)
		if err != nil {
			return state, proofSet, parentChildOperations, err
		}

		if signer == nil || !signer.Uid.Exists() {
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

// Get new links from the server.
func (l *TeamLoader) getNewLinksFromServer(ctx context.Context,
	teamID keybase1.TeamID, lowSeqno keybase1.Seqno, lowGen keybase1.PerTeamKeyGeneration,
	readSubteamID *keybase1.TeamID) (*rawTeam, error) {

	arg := libkb.NewRetryAPIArg("team/get")
	arg.NetContext = ctx
	arg.SessionType = libkb.APISessionTypeREQUIRED
	arg.Args = libkb.HTTPArgs{
		"id":               libkb.S{Val: teamID.String()},
		"low":              libkb.I{Val: int(lowSeqno)},
		"per_team_key_low": libkb.I{Val: int(lowGen)},
	}
	if readSubteamID != nil {
		arg.Args["read_subteam_id"] = libkb.S{Val: readSubteamID.String()}
	}

	var rt rawTeam
	if err := l.G().API.GetDecode(arg, &rt); err != nil {
		return nil, err
	}
	if !rt.ID.Eq(teamID) {
		return nil, fmt.Errorf("server returned wrong team ID: %v != %v", rt.ID, teamID)
	}
	return &rt, nil
}

// Get full links from the server.
// Does not guarantee that the server returned the correct links, nor that they are unstubbed.
func (l *TeamLoader) getLinksFromServer(ctx context.Context,
	teamID keybase1.TeamID, requestSeqnos []keybase1.Seqno, readSubteamID *keybase1.TeamID) (*rawTeam, error) {

	var seqnoStrs []string
	for _, seqno := range requestSeqnos {
		seqnoStrs = append(seqnoStrs, fmt.Sprintf("%d", int(seqno)))
	}
	seqnoCommas := strings.Join(seqnoStrs, ",")

	arg := libkb.NewRetryAPIArg("team/get")
	arg.NetContext = ctx
	arg.SessionType = libkb.APISessionTypeREQUIRED
	arg.Args = libkb.HTTPArgs{
		"id":     libkb.S{Val: teamID.String()},
		"seqnos": libkb.S{Val: seqnoCommas},
	}
	if readSubteamID != nil {
		arg.Args["read_subteam_id"] = libkb.S{Val: readSubteamID.String()}
	}

	var rt rawTeam
	if err := l.G().API.GetDecode(arg, &rt); err != nil {
		return nil, err
	}
	if !rt.ID.Eq(teamID) {
		return nil, fmt.Errorf("server returned wrong team ID: %v != %v", rt.ID, teamID)
	}
	return &rt, nil
}

// checkStubbed checks if it's OK that a link is stubbed.
func (l *TeamLoader) checkStubbed(ctx context.Context, arg load2ArgT, link *chainLinkUnpacked) error {
	if !link.isStubbed() {
		return nil
	}
	if l.seqnosContains(arg.needSeqnos, link.Seqno()) {
		return NewStubbedErrorWithNote(link, "need seqno")
	}
	if arg.needAdmin {
		return NewStubbedErrorWithNote(link, "need admin")
	}
	if !link.outerLink.LinkType.TeamAllowStubWithAdminFlag(arg.needAdmin) {
		return NewStubbedErrorWithNote(link, "disallowed")
	}
	return nil
}

func (l *TeamLoader) loadUserAndKeyFromLinkInner(ctx context.Context, inner SCChainLinkPayload) (user *keybase1.UserPlusKeysV2, key *keybase1.PublicKeyV2NaCl, linkMap map[keybase1.Seqno]keybase1.LinkID, err error) {
	defer l.G().CTrace(ctx, fmt.Sprintf("TeamLoader#loadUserForSigVerification(%d)", int(inner.Seqno)), func() error { return err })()
	keySection := inner.Body.Key
	if keySection == nil {
		return nil, nil, nil, libkb.NoUIDError{}
	}
	uid := keySection.UID
	kid := keySection.KID
	user, key, linkMap, err = l.G().GetUPAKLoader().LoadKeyV2(ctx, uid, kid)
	if err != nil {
		return nil, nil, nil, err
	}
	return user, key, linkMap, nil
}

func forceLinkMapRefreshForUser(ctx context.Context, g *libkb.GlobalContext, uid keybase1.UID) (linkMap map[keybase1.Seqno]keybase1.LinkID, err error) {
	arg := libkb.NewLoadUserArgBase(g).WithNetContext(ctx).WithUID(uid).WithForcePoll()
	upak, _, err := g.GetUPAKLoader().LoadV2(*arg)
	if err != nil {
		return nil, err
	}
	return upak.SeqnoLinkIDs, nil
}

func (l *TeamLoader) verifySignatureAndExtractKID(ctx context.Context, outer libkb.OuterLinkV2WithMetadata) (keybase1.KID, error) {
	return outer.Verify(l.G().Log)
}

func addProofsForKeyInUserSigchain(teamID keybase1.TeamID, teamLinkMap map[keybase1.Seqno]keybase1.LinkID, link *chainLinkUnpacked, uid keybase1.UID, key *keybase1.PublicKeyV2NaCl, userLinkMap map[keybase1.Seqno]keybase1.LinkID, proofSet *proofSetT) *proofSetT {
	a := newProofTerm(uid.AsUserOrTeam(), key.Base.Provisioning, userLinkMap)
	b := newProofTerm(teamID.AsUserOrTeam(), link.SignatureMetadata(), teamLinkMap)
	c := key.Base.Revocation
	proofSet = proofSet.AddNeededHappensBeforeProof(a, b)
	if c != nil {
		proofSet = proofSet.AddNeededHappensBeforeProof(b, newProofTerm(uid.AsUserOrTeam(), *c, userLinkMap))
	}
	return proofSet
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
	readSubteamID keybase1.TeamID, proofSet *proofSetT) (*keybase1.UserVersion, *proofSetT, error) {

	if link.isStubbed() {
		return nil, proofSet, nil
	}

	err := link.AssertInnerOuterMatch()
	if err != nil {
		return nil, proofSet, err
	}

	if !teamID.Eq(link.innerTeamID) {
		return nil, proofSet, fmt.Errorf("team ID mismatch: %s != %s", teamID, link.innerTeamID)
	}

	kid, err := l.verifySignatureAndExtractKID(ctx, *link.outerLink)
	if err != nil {
		return nil, proofSet, err
	}

	user, key, linkMap, err := l.loadUserAndKeyFromLinkInner(ctx, *link.inner)
	if err != nil {
		return nil, proofSet, err
	}
	uv := user.ToUserVersion()

	if !kid.Equal(key.Base.Kid) {
		return nil, proofSet, libkb.NewWrongKidError(kid, key.Base.Kid)
	}

	var teamLinkMap map[keybase1.Seqno]keybase1.LinkID
	if state != nil {
		teamLinkMap = state.Chain.LinkIDs
	}

	proofSet = addProofsForKeyInUserSigchain(teamID, teamLinkMap, link, user.Uid, key, linkMap, proofSet)

	// For a root team link, or a subteam_head, there is no reason to check adminship
	// or writership (or readership) for the team.
	if state == nil {
		return &uv, proofSet, nil
	}

	if link.outerLink.LinkType.RequiresAdminPermission() {
		proofSet, err = l.verifyAdminPermissions(ctx, state, me, link, readSubteamID, user.ToUserVersion(), proofSet)
	} else {
		err = l.verifyWriterOrReaderPermissions(ctx, state, link, user.ToUserVersion())
	}
	return &uv, proofSet, err
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
			me:            me,
			staleOK:       true,
			readSubteamID: &readSubteamID,
		}
		if target.Eq(*parent) {
			arg.needSeqnos = []keybase1.Seqno{admin.Seqno}
		}
		team, err = l.load2(ctx, arg)
		if err != nil {
			return nil, err
		}
	}
	if team == nil {
		return nil, fmt.Errorf("teamloader fault: nil team after admin walk")
	}
	return &TeamSigChainState{inner: team.Chain}, nil
}

func addProofsForAdminPermission(t keybase1.TeamSigChainState, link *chainLinkUnpacked, bookends proofTermBookends, proofSet *proofSetT) *proofSetT {
	a := bookends.left
	b := newProofTerm(t.Id.AsUserOrTeam(), link.SignatureMetadata(), t.LinkIDs)
	c := bookends.right
	proofSet = proofSet.AddNeededHappensBeforeProof(a, b)
	if c != nil {
		proofSet = proofSet.AddNeededHappensBeforeProof(b, *c)
	}
	return proofSet
}

func (l *TeamLoader) verifyAdminPermissions(ctx context.Context,
	state *keybase1.TeamData, me keybase1.UserVersion, link *chainLinkUnpacked, readSubteamID keybase1.TeamID,
	uv keybase1.UserVersion, proofSet *proofSetT) (*proofSetT, error) {

	explicitAdmin := link.inner.TeamAdmin()

	// In the simple case, we don't ask for explicit adminship, so we have to be admins of
	// the current chain at or before the signature in question.
	if explicitAdmin == nil {
		err := (TeamSigChainState{inner: state.Chain}).AssertWasAdminAt(uv, link.SigChainLocation())
		return proofSet, err
	}

	// The more complicated case is that there's an explicit admin permssion given, perhaps
	// of a parent team.
	adminTeam, err := l.walkUpToAdmin(ctx, state, me, readSubteamID, uv, *explicitAdmin)
	if err != nil {
		return proofSet, err
	}
	adminBookends, err := adminTeam.AssertBecameAdminAt(uv, explicitAdmin.SigChainLocation())
	if err != nil {
		return proofSet, err
	}

	proofSet = addProofsForAdminPermission(state.Chain, link, adminBookends, proofSet)
	return proofSet, nil
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
	signer *keybase1.UserVersion, me keybase1.UserVersion) (*keybase1.TeamData, error) {

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
	signer keybase1.UserVersion, me keybase1.UserVersion) (
	*keybase1.TeamData, error) {

	l.G().Log.CDebugf(ctx, "TeamLoader inflating link seqno:%v", link.Seqno())

	if state == nil {
		// The only reason state would be nil is if this is link 1.
		// But link 1 can't be stubbed.
		return nil, NewInflateErrorWithNote(link, "no prior state")
	}

	var player *TeamSigChainPlayer
	player = NewTeamSigChainPlayerWithState(l.G(), me, TeamSigChainState{inner: state.Chain})

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
		parentChain := TeamSigChainState{inner: parent.Chain}
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

	return proofSet.check(ctx, l.G())
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
	// Earliest generation received. If there were gaps, the earliest in the consecutive run from the box.
	earliestReceivedGen := latestReceivedGen - keybase1.PerTeamKeyGeneration(len(seeds)-1)
	// Latest generation from the sigchain
	latestChainGen := keybase1.PerTeamKeyGeneration(len(state.Chain.PerTeamKeys))

	if latestReceivedGen != latestChainGen {
		return nil, fmt.Errorf("wrong latest key generation: %v != %v",
			latestReceivedGen, latestChainGen)
	}

	ret := state.DeepCopy()

	// Check that each key matches the chain.
	for i, seed := range seeds {
		gen := int(latestReceivedGen) + i + 1 - len(seeds)
		if gen < 1 {
			return nil, fmt.Errorf("gen < 1")
		}

		if gen <= int(latestChainGen) {
			l.G().Log.CDebugf(ctx, "TeamLoader got old key, re-checking as if new")
		}

		item, err := l.checkPerTeamKeyAgainstChain(ctx, state, keybase1.PerTeamKeyGeneration(gen), seed)
		if err != nil {
			return nil, err
		}

		// Add it to the snapshot
		ret.PerTeamKeySeeds[item.Generation] = *item
	}

	// Make sure there is not a gap between the latest local key and the earliest received key.
	if earliestReceivedGen != keybase1.PerTeamKeyGeneration(1) {
		if _, ok := ret.PerTeamKeySeeds[earliestReceivedGen]; !ok {
			return nil, fmt.Errorf("gap in per-team-keys: latestRecvd:%v earliestRecvd:%v",
				latestReceivedGen, earliestReceivedGen)
		}
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
		return 0, nil, err
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
			return box.Generation, nil, fmt.Errorf("gen %v: %v", openGeneration, err)
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

func (l *TeamLoader) recalculateName(ctx context.Context,
	state *keybase1.TeamData, me keybase1.UserVersion, readSubteamID keybase1.TeamID, staleOK bool) (newName keybase1.TeamName, err error) {

	chain := TeamSigChainState{inner: state.Chain}
	if !chain.IsSubteam() {
		return chain.GetName(), nil
	}

	prevName := chain.GetName()

	// Load the parent. The parent load will recalculate it's own name,
	// so this name recalculation is recursive.
	parent, err := l.load2(ctx, load2ArgT{
		teamID:        *chain.GetParentID(),
		staleOK:       staleOK,
		readSubteamID: &readSubteamID,
		me:            me,
	})
	if err != nil {
		return newName, err
	}

	parentName := TeamSigChainState{inner: parent.Chain}.GetName()

	// Swap out the parent name as the base of this name.
	// For example if:
	// parentName: a.b2.c
	// prevName:   a.b.c
	// newName:    {a.b}.{c}
	//              ^     ^ from prevName
	//              | from parentName
	newName, err = parentName.Append(string(prevName.LastPart()))
	if err != nil {
		return newName, fmt.Errorf("invalid new subteam name: %v", err)
	}

	if newName.Depth() != prevName.Depth() {
		return newName, fmt.Errorf("team changed level: %v -> %v", prevName.Depth(), newName.Depth())
	}

	return newName, nil
}
