package teams

import (
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"fmt"

	"golang.org/x/crypto/nacl/secretbox"
	"golang.org/x/net/context"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/teams/hidden"
	"github.com/keybase/go-codec/codec"
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
	proofSet *proofSetT, parentChildOperations []*parentChildOperation, lkc *loadKeyCache) (
	*keybase1.TeamData, *proofSetT, []*parentChildOperation, error) {

	upperLimit := keybase1.Seqno(0)
	if state != nil {
		upperLimit = state.Chain.LastSeqno
	}

	// seqnos needed from the server
	var requestSeqnos []keybase1.Seqno
	for _, seqno := range needSeqnos {
		linkIsAlreadyFilled := TeamSigChainState{inner: state.Chain}.IsLinkFilled(seqno)
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
	newLinks, err := teamUpdate.unpackLinks(ctx)
	if err != nil {
		return state, proofSet, parentChildOperations, err
	}

	parentsCache := make(parentChainCache)
	for _, link := range newLinks {
		if link.isStubbed() {
			return state, proofSet, parentChildOperations, NewStubbedErrorWithNote(
				link, "filling stubbed link")
		}

		var signer *SignerX
		var fullVerifyCutoff keybase1.Seqno // Always fullVerify when inflating. No reasoning has been done on whether it could be skipped.
		signer, err = l.verifyLink(ctx, teamID, state, me, link, fullVerifyCutoff, readSubteamID,
			proofSet, lkc, parentsCache)
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
	// Latest PTK generation secret we have
	PerTeamKey keybase1.PerTeamKeyGeneration
	// Latest RKM semi-secret we have
	ReaderKeyMask keybase1.PerTeamKeyGeneration
	// Latest hidden chain seqno on file
	HiddenChainSeqno keybase1.Seqno
	// Ratcheted chain tail
	HiddenChainRatchet keybase1.Seqno
}

// checkStubbed checks if it's OK if a link is stubbed.
func (l *TeamLoader) checkStubbed(ctx context.Context, arg load2ArgT, link *ChainLinkUnpacked) error {
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
	inner SCChainLinkPayload, lkc *loadKeyCache) (
	signerUV keybase1.UserVersion, key *keybase1.PublicKeyV2NaCl, linkMap linkMapT, err error) {
	if !ShouldSuppressLogging(ctx) {
		defer l.G().CTraceTimed(ctx, fmt.Sprintf("TeamLoader#loadUserForSigVerification(%d)", int(inner.Seqno)), func() error { return err })()
	}
	keySection := inner.Body.Key
	if keySection == nil {
		return signerUV, nil, nil, libkb.NoUIDError{}
	}
	uid := keySection.UID
	kid := keySection.KID
	signerUV, key, linkMap, err = l.world.loadKeyV2(ctx, uid, kid, lkc)
	if err != nil {
		return signerUV, nil, nil, err
	}
	return signerUV, key, linkMap, nil
}

// Get the UV from a link but using server-trust and without verifying anything.
func (l *TeamLoader) loadUserAndKeyFromLinkInnerNoVerify(ctx context.Context,
	link *ChainLinkUnpacked) (signerUV keybase1.UserVersion, err error) {
	if !ShouldSuppressLogging(ctx) {
		defer l.G().CTraceTimed(ctx, fmt.Sprintf("TeamLoader#loadUserAndKeyFromLinkInnerNoVerify(%d)", int(link.inner.Seqno)), func() error { return err })()
	}
	keySection := link.inner.Body.Key
	if keySection == nil {
		return signerUV, libkb.NoUIDError{}
	}
	// Use the UID from the link body and EldestSeqno from the server-trust API response.
	if link.source.EldestSeqno == 0 {
		// We should never hit this case
		return signerUV, fmt.Errorf("missing server hint for team sigchain link signer")
	}
	return NewUserVersion(keySection.UID, link.source.EldestSeqno), nil
}

func (l *TeamLoader) verifySignatureAndExtractKID(ctx context.Context, outer libkb.OuterLinkV2WithMetadata) (keybase1.KID, error) {
	return outer.Verify(l.G().Log)
}

// These exceptional sigchain links are not checked dynamically. We assert that they are good.
var whitelistedTeamLinkSigsForKeyInUserSigchain = []keybase1.SigID{
	// For the privacy of the users involved the issue is described only vaguely here.
	// See CORE-8233 for more details.
	// This team had a rotate_key link signed seconds before the revocation of the key that signed the link.
	// Due to a bug the signing device was allowed to be revoked with a signature that pointed to a merkle
	// root prior to the team link signature. This makes it impossible for the client to independently
	// verify that the team link was signed before the device was revoked. But it was, it's all good.
	"e8279d7c73b8defab299094b73800262239e5a03812040ed381cc613a3db515622",

	// See https://github.com/keybase/client/issues/17573; a server bug allowed a rotate after a revoke, which
	// has been fixed in CORE-10942.
	"070e6d737607109ba17d1d43419d950cde6d206b66c555c837566913a31ca59122",

	// See https://github.com/keybase/client/issues/20503; a server bug allowed a team leave to interleave
	// with a downgrade lease acquisition for a key revoke on a slow connection. The acquisition should have
	// been blocked until the merkle tree reflected the leave, but the acquistion actually happened before the
	// team leave transation was committed to the DB. The fix on the server is to check for leases before and
	// after the team change is commited (in the same transaction). We were previously only checking before.
	// It has been fixed in Y2K-891.
	"c641d1246493cf04ec2c6141acdb569a457c02d577b392d4eb1872118c563c2822",
}

// These exceptional sigchain links are not checked dynamically. We assert that they are good.
var whitelistedTeamLinkSigsForAdminPermissionDemote = []keybase1.SigID{
	// A server bug allowed a change_membership to be posted that demoted an adminship
	// that had just been referenced by a rotate_key that was still settling.
	// Timeline: Before the ':' are merkle seqnos minus a base offset.
	// 5: referenced by rotate_key.
	// 6: referenced by change_membership.
	// 7: rotate_key first appeared in the merkle tree.
	// 9: change_membership first appeared in the merkle tree.
	// The problem is that change_membership did not reference a merkle tree that included rotate_key.
	// So the client can't prove (in the way it does) that rotate_key occurred before change_membership.
	// See PICNIC-654 for more details.
	"69cea033758d152c9736596f0a7e544444ec1944843172692db01be1c6fb6ee622",
}

func (l *TeamLoader) addProofsForKeyInUserSigchain(ctx context.Context, teamID keybase1.TeamID, link *ChainLinkUnpacked, uid keybase1.UID, key *keybase1.PublicKeyV2NaCl, userLinkMap linkMapT, proofSet *proofSetT) {
	for _, okSigID := range whitelistedTeamLinkSigsForKeyInUserSigchain {
		if link.SigID().EqualIgnoreLastByte(okSigID) {
			// This proof is whitelisted, so don't check it.
			l.G().Log.CDebugf(ctx, "addProofsForKeyInUserSigchain: skipping exceptional link: %v", link.SigID())
			return
		}
	}

	event1Link := newProofTerm(teamID.AsUserOrTeam(), link.SignatureMetadata(), nil)
	event2Revoke := key.Base.Revocation
	if event2Revoke != nil {
		proofSet.AddNeededHappensBeforeProof(ctx, event1Link, newProofTerm(uid.AsUserOrTeam(), *event2Revoke, userLinkMap), "team link before user key revocation")
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
	teamID keybase1.TeamID, state *keybase1.TeamData, me keybase1.UserVersion, link *ChainLinkUnpacked,
	fullVerifyCutoff keybase1.Seqno, readSubteamID keybase1.TeamID, proofSet *proofSetT, lkc *loadKeyCache,
	parentsCache parentChainCache) (*SignerX, error) {
	ctx, tbs := l.G().CTimeBuckets(ctx)
	defer tbs.Record("TeamLoader.verifyLink")()

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

	signedByKID, err := l.verifySignatureAndExtractKID(ctx, *link.outerLink)
	if err != nil {
		return nil, err
	}

	// FullVerify all links except for `team.leave` links for which there is
	// an admin link later in the chain.
	// Such a link has effectively been verified for us by the admin who signed on top.
	// This trick can be used on `team.leave` links because they do not add admins.
	fullVerify := (link.LinkType() != libkb.SigchainV2TypeTeamLeave) ||
		(link.Seqno() >= fullVerifyCutoff) ||
		(link.source.EldestSeqno == 0)

	var signerUV keybase1.UserVersion
	if fullVerify {
		signerUV, err = l.loadUserAndKeyFromLinkInnerAndVerify(ctx, teamID, state, link, signedByKID, proofSet, lkc)
		if err != nil {
			return nil, err
		}
	} else {
		signerUV, err = l.loadUserAndKeyFromLinkInnerNoVerify(ctx, link)
		if err != nil {
			return nil, err
		}
	}

	signer := SignerX{signer: signerUV}

	// For a root team link, or a subteam_head, there is no reason to check adminship
	// or writership (or readership) for the team.
	if state == nil {
		return &signer, nil
	}

	minRole := link.outerLink.LinkType.RequiresAtLeastRole()
	linkType := link.outerLink.LinkType
	// Note: If minRole is OWNER it will be treated as ADMIN here (weaker check).
	if !ShouldSuppressLogging(ctx) {
		l.G().Log.CDebugf(ctx, "verifyLink: %v minRole:%v", linkType, minRole)
	}

	switch minRole {
	case keybase1.TeamRole_NONE:
		// Anyone can make this link. These didn't exist at the time.
		return &signer, nil
	case keybase1.TeamRole_RESTRICTEDBOT:
		err = l.verifyExplicitPermission(ctx, state, link, signerUV, keybase1.TeamRole_RESTRICTEDBOT)
		if err == nil {
			return &signer, err
		}
		if !ShouldSuppressLogging(ctx) {
			l.G().Log.CDebugf(ctx, "verifyLink: %v not a %v: %v", linkType, keybase1.TeamRole_RESTRICTEDBOT, err)
		}
		// Fall through to a higher role check
		fallthrough
	case keybase1.TeamRole_BOT:
		err = l.verifyExplicitPermission(ctx, state, link, signerUV, keybase1.TeamRole_BOT)
		if err == nil {
			return &signer, err
		}
		if !ShouldSuppressLogging(ctx) {
			l.G().Log.CDebugf(ctx, "verifyLink: %v not a %v: %v", linkType, keybase1.TeamRole_BOT, err)
		}
		// Fall through to a higher role check
		fallthrough
	case keybase1.TeamRole_READER:
		err = l.verifyExplicitPermission(ctx, state, link, signerUV, keybase1.TeamRole_READER)
		if err == nil {
			return &signer, err
		}
		if !ShouldSuppressLogging(ctx) {
			l.G().Log.CDebugf(ctx, "verifyLink: %v not a %v: %v", linkType, keybase1.TeamRole_READER, err)
		}
		// Fall through to a higher role check
		fallthrough
	case keybase1.TeamRole_WRITER:
		err = l.verifyExplicitPermission(ctx, state, link, signerUV, keybase1.TeamRole_WRITER)
		if err == nil {
			return &signer, err
		}
		if !ShouldSuppressLogging(ctx) {
			l.G().Log.CDebugf(ctx, "verifyLink: %v not a %v: %v", linkType, keybase1.TeamRole_WRITER, err)
		}
		// Fall through to a higher role check
		fallthrough
	case keybase1.TeamRole_OWNER, keybase1.TeamRole_ADMIN:
		// Check for admin permissions if they are not an on-chain reader/writer
		// because they might be an implicit admin.
		// Reassigns signer, might set implicitAdmin.
		signer, err = l.verifyAdminPermissions(ctx, state, me, link, readSubteamID, signerUV, proofSet, parentsCache)
		if !ShouldSuppressLogging(ctx) {
			l.G().Log.CDebugf(ctx, "verifyLink: not a %v: %v", minRole, err)
		}
		return &signer, err
	default:
		return nil, fmt.Errorf("unrecognized role %v required for link", minRole)
	}
}

func (l *TeamLoader) loadUserAndKeyFromLinkInnerAndVerify(ctx context.Context, teamID keybase1.TeamID, state *keybase1.TeamData,
	link *ChainLinkUnpacked, signedByKID keybase1.KID, proofSet *proofSetT, lkc *loadKeyCache) (signer keybase1.UserVersion, err error) {
	signer, key, linkMap, err := l.loadUserAndKeyFromLinkInner(ctx, *link.inner, lkc)
	if err != nil {
		return keybase1.UserVersion{}, err
	}
	if !signedByKID.Equal(key.Base.Kid) {
		return keybase1.UserVersion{}, libkb.NewWrongKidError(signedByKID, key.Base.Kid)
	}
	l.addProofsForKeyInUserSigchain(ctx, teamID, link, signer.Uid, key, linkMap, proofSet)
	return signer, nil
}

// Verify that the user had the explicit on-chain role just before this `link`.
func (l *TeamLoader) verifyExplicitPermission(ctx context.Context, state *keybase1.TeamData,
	link *ChainLinkUnpacked, uv keybase1.UserVersion, atOrAbove keybase1.TeamRole) error {
	return (TeamSigChainState{inner: state.Chain}).AssertWasRoleOrAboveAt(uv, atOrAbove, link.SigChainLocation().Sub1())
}

type parentChainCache map[keybase1.TeamID]*keybase1.TeamData

// Does not return a full TeamData because it might get a subteam-reader version.
func (l *TeamLoader) walkUpToAdmin(
	ctx context.Context, team *keybase1.TeamData, me keybase1.UserVersion, readSubteamID keybase1.TeamID,
	uv keybase1.UserVersion, admin SCTeamAdmin, parentsCache parentChainCache) (*TeamSigChainState, error) {

	target, err := admin.TeamID.ToTeamID()
	if err != nil {
		return nil, err
	}

	if t, ok := parentsCache[target]; ok {
		return &TeamSigChainState{inner: t.Chain}, nil
	}

	for team != nil && !team.Chain.Id.Eq(target) {
		parent := team.Chain.ParentID
		if parent == nil {
			return nil, NewAdminNotFoundError(admin)
		}
		if t, ok := parentsCache[*parent]; ok {
			team = t
			continue
		}
		arg := load2ArgT{
			teamID: *parent,
			reason: "walkUpToAdmin",
			me:     me,
			// Get the latest so that the linkmap is up to date for the proof order checker.
			// But do it only once (hence the `parentsCache`) per team.
			forceRepoll:   true,
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
		parentsCache[*parent] = team
	}
	if team == nil {
		return nil, fmt.Errorf("teamloader fault: nil team after admin walk")
	}
	return &TeamSigChainState{inner: team.Chain}, nil
}

func (l *TeamLoader) addProofsForAdminPermission(ctx context.Context, teamID keybase1.TeamID, link *ChainLinkUnpacked, bookends proofTermBookends, proofSet *proofSetT) {
	event1Promote := bookends.left
	event2Link := newProofTerm(teamID.AsUserOrTeam(), link.SignatureMetadata(), nil)
	event3Demote := bookends.right
	proofSet.AddNeededHappensBeforeProof(ctx, event1Promote, event2Link, "became admin before team link")
	if event3Demote != nil {
		for _, okSigID := range whitelistedTeamLinkSigsForAdminPermissionDemote {
			if link.SigID().EqualIgnoreLastByte(okSigID) {
				// This proof is whitelisted, so don't check it.
				l.G().Log.CDebugf(ctx, "addProofsForAdminPermission: [demote] skipping exceptional link: %v", link.SigID())
				return
			}
		}
		proofSet.AddNeededHappensBeforeProof(ctx, event2Link, *event3Demote, "team link before adminship demotion")
	}
}

// Verify that a user has admin permissions.
// Because this uses the proofSet, if it is called may return success and fail later.
func (l *TeamLoader) verifyAdminPermissions(ctx context.Context,
	state *keybase1.TeamData, me keybase1.UserVersion, link *ChainLinkUnpacked, readSubteamID keybase1.TeamID,
	uv keybase1.UserVersion, proofSet *proofSetT, parentsCache parentChainCache) (SignerX, error) {

	signer := SignerX{signer: uv}
	explicitAdmin := link.inner.TeamAdmin()
	teamChain := TeamSigChainState{inner: state.Chain}

	// In the simple case, we don't ask for explicit adminship, so we have to be admins of
	// the current chain at or before the signature in question.
	if explicitAdmin == nil {
		err := teamChain.AssertWasAdminAt(uv, link.SigChainLocation().Sub1())
		return signer, err
	}

	// The more complicated case is that there's an explicit admin permission given, perhaps
	// of a parent team.
	adminTeam, err := l.walkUpToAdmin(ctx, state, me, readSubteamID, uv, *explicitAdmin, parentsCache)
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

	l.addProofsForAdminPermission(ctx, state.Chain.Id, link, adminBookends, proofSet)
	return signer, nil
}

// Whether the chain link is of a (child-half) type
// that affects a parent and child chain in lockstep.
// So far these events: subteam create, and subteam rename
// Technically subteam delete is one of these too, but we don't
// bother because the subteam is rendered inaccessible.
func (l *TeamLoader) isParentChildOperation(ctx context.Context,
	link *ChainLinkUnpacked) bool {

	switch link.LinkType() {
	case libkb.SigchainV2TypeTeamSubteamHead, libkb.SigchainV2TypeTeamRenameUpPointer:
		return true
	default:
		return false
	}
}

func (l *TeamLoader) toParentChildOperation(ctx context.Context,
	link *ChainLinkUnpacked) (*parentChildOperation, error) {

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
// `state` is moved into this function. There must exist no live references into it from now on.
// `signer` may be nil iff link is stubbed.
func (l *TeamLoader) applyNewLink(ctx context.Context,
	state *keybase1.TeamData, hiddenChainState *keybase1.HiddenTeamChain, link *ChainLinkUnpacked,
	signer *SignerX, me keybase1.UserVersion) (*keybase1.TeamData, error) {
	ctx, tbs := l.G().CTimeBuckets(ctx)
	defer tbs.Record("TeamLoader.applyNewLink")()

	if !ShouldSuppressLogging(ctx) {
		l.G().Log.CDebugf(ctx, "TeamLoader applying link seqno:%v", link.Seqno())
	}

	var chainState *TeamSigChainState
	var newState *keybase1.TeamData
	if state == nil {
		newState = &keybase1.TeamData{
			// Name is left blank until calculateName updates it.
			// It shall not be blank by the time it is returned from load2.
			Subversion:                2, // see storage/std.go for more info on this
			Name:                      keybase1.TeamName{},
			PerTeamKeySeedsUnverified: make(map[keybase1.PerTeamKeyGeneration]keybase1.PerTeamKeySeedItem),
			ReaderKeyMasks:            make(map[keybase1.TeamApplication]map[keybase1.PerTeamKeyGeneration]keybase1.MaskB64),
		}
	} else {
		chainState = &TeamSigChainState{inner: state.Chain, hidden: hiddenChainState}
		newState = state
		state = nil
	}

	newChainState, err := AppendChainLink(ctx, l.G(), me, chainState, link, signer)
	if err != nil {
		return nil, err
	}
	newState.Chain = newChainState.inner

	return newState, nil
}

// Inflate a link that was stubbed with its non-stubbed data.
func (l *TeamLoader) inflateLink(ctx context.Context,
	state *keybase1.TeamData, link *ChainLinkUnpacked,
	signer SignerX, me keybase1.UserVersion) (
	*keybase1.TeamData, error) {

	l.G().Log.CDebugf(ctx, "TeamLoader inflating link seqno:%v", link.Seqno())

	if state == nil {
		// The only reason state would be nil is if this is link 1.
		// But link 1 can't be stubbed.
		return nil, NewInflateErrorWithNote(link, "no prior state")
	}

	newState := state.DeepCopy() // Clone the state and chain so that our parameters don't get consumed.
	newChainState, err := InflateLink(ctx, l.G(), me, TeamSigChainState{inner: newState.Chain}, link, signer)
	if err != nil {
		return nil, err
	}
	newState.Chain = newChainState.inner

	return &newState, nil
}

// Check that the parent-child operations appear in the parent sigchains.
func (l *TeamLoader) checkParentChildOperations(ctx context.Context,
	me keybase1.UserVersion, loadingTeamID keybase1.TeamID, parentID *keybase1.TeamID, readSubteamID keybase1.TeamID,
	parentChildOperations []*parentChildOperation, proofSet *proofSetT) error {

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

		needAdmin:                             false,
		needKeyGeneration:                     0,
		needApplicationsAtGenerations:         nil,
		needApplicationsAtGenerationsWithKBFS: nil,
		wantMembers:                           nil,
		wantMembersRole:                       keybase1.TeamRole_NONE,
		forceFullReload:                       false,
		forceRepoll:                           false,
		staleOK:                               true, // stale is fine, as long as get those seqnos.
		skipSeedCheck:                         true,
		auditMode:                             keybase1.AuditMode_SKIP,

		needSeqnos:    needParentSeqnos,
		readSubteamID: &readSubteamID,

		me: me,
	})
	if err != nil {
		return fmt.Errorf("error loading parent: %v", err)
	}

	parentChain := TeamSigChainState{inner: parent.team.Chain}

	for _, pco := range parentChildOperations {
		err = l.checkOneParentChildOperation(ctx, pco, loadingTeamID, &parentChain)
		if err != nil {
			return err
		}
	}

	// Give a more up-to-date linkmap to the ordering checker for the parent.
	// Without this it could fail if the parent is new.
	// Because the team linkmap in the proof objects is stale.
	proofSet.SetTeamLinkMap(ctx, parentChain.inner.Id, parentChain.inner.LinkIDs)

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
	if !proofSet.checkRequired() {
		return nil
	}
	return proofSet.check(ctx, l.world, teamEnv.ProofSetParallel)
}

func (l *TeamLoader) unboxKBFSCryptKeys(ctx context.Context, key keybase1.TeamApplicationKey,
	keysetHash keybase1.TeamEncryptedKBFSKeysetHash, encryptedKeyset string) ([]keybase1.CryptKey, error) {

	// Check hash
	sbytes := sha256.Sum256([]byte(encryptedKeyset))
	if !keysetHash.SecureEqual(keybase1.TeamEncryptedKBFSKeysetHashFromBytes(sbytes[:])) {
		return nil, errors.New("encrypted TLF upgrade does not match sigchain hash")
	}

	// Decode
	packed, err := base64.StdEncoding.DecodeString(encryptedKeyset)
	if err != nil {
		return nil, err
	}
	var keysetRecord keybase1.TeamEncryptedKBFSKeyset
	mh := codec.MsgpackHandle{WriteExt: true}
	decoder := codec.NewDecoderBytes(packed, &mh)
	if err = decoder.Decode(&keysetRecord); err != nil {
		return nil, err
	}

	// Decrypt
	var encKey [libkb.NaclSecretBoxKeySize]byte = key.Material()
	var nonce [libkb.NaclDHNonceSize]byte
	if len(keysetRecord.N) != libkb.NaclDHNonceSize {
		return nil, libkb.DecryptBadNonceError{}
	}
	copy(nonce[:], keysetRecord.N)
	plain, ok := secretbox.Open(nil, keysetRecord.E, &nonce, &encKey)
	if !ok {
		return nil, libkb.DecryptOpenError{}
	}

	// Decode again
	var cryptKeys []keybase1.CryptKey
	decoder = codec.NewDecoderBytes(plain, &mh)
	if err = decoder.Decode(&cryptKeys); err != nil {
		return nil, err
	}

	return cryptKeys, nil
}

// AddKBFSCryptKeys mutates `state`
func (l *TeamLoader) addKBFSCryptKeys(mctx libkb.MetaContext, team Teamer, upgrades []keybase1.TeamGetLegacyTLFUpgrade) error {
	m := make(map[keybase1.TeamApplication][]keybase1.CryptKey)
	for _, upgrade := range upgrades {
		key, err := ApplicationKeyAtGeneration(mctx, team, upgrade.AppType, upgrade.TeamGeneration)
		if err != nil {
			return err
		}

		chainInfo, ok := team.MainChain().Chain.TlfLegacyUpgrade[upgrade.AppType]
		if !ok {
			return errors.New("legacy tlf upgrade payload present without chain link")
		}
		if chainInfo.TeamGeneration != upgrade.TeamGeneration {
			return fmt.Errorf("legacy tlf upgrade team generation mismatch: %d != %d",
				chainInfo.TeamGeneration, upgrade.TeamGeneration)
		}

		cryptKeys, err := l.unboxKBFSCryptKeys(mctx.Ctx(), key, chainInfo.KeysetHash, upgrade.EncryptedKeyset)
		if err != nil {
			return err
		}
		if chainInfo.LegacyGeneration != cryptKeys[len(cryptKeys)-1].KeyGeneration {
			return fmt.Errorf("legacy tlf upgrade legacy generation mismatch: %d != %d",
				chainInfo.LegacyGeneration, cryptKeys[len(cryptKeys)-1].KeyGeneration)
		}

		m[upgrade.AppType] = cryptKeys
	}
	team.MainChain().TlfCryptKeys = m
	return nil
}

// Add data to the state that is not included in the sigchain:
// - per team keys
// - reader key masks
// Checks that the off-chain data ends up exactly in sync with the chain, generation-wise.
// Does _not_ check that keys match the sigchain.
// Mutates `state`
func (l *TeamLoader) addSecrets(mctx libkb.MetaContext,
	team Teamer, me keybase1.UserVersion, box *TeamBox, prevs map[keybase1.PerTeamKeyGeneration]prevKeySealedEncoded,
	readerKeyMasks []keybase1.ReaderKeyMask) error {

	state := team.MainChain()

	latestReceivedGen, seeds, err := l.unboxPerTeamSecrets(mctx, box, prevs)
	if err != nil {
		return err
	}
	mctx.Debug("TeamLoader#addSecrets at %d", latestReceivedGen)

	// Earliest generation received.
	earliestReceivedGen := latestReceivedGen - keybase1.PerTeamKeyGeneration(len(seeds)-1)

	stateWrapper := newTeamSigChainState(team)

	// Latest generation from the sigchain or the hidden chain...
	latestChainGen := stateWrapper.GetLatestGeneration()

	mctx.Debug("TeamLoader.addSecrets: received:%v->%v nseeds:%v nprevs:%v",
		earliestReceivedGen, latestReceivedGen, len(seeds), len(prevs))

	// Check that each key matches the chain.
	for i, seed := range seeds {
		gen := int(latestReceivedGen) + i + 1 - len(seeds)
		if gen < 1 {
			return fmt.Errorf("gen < 1")
		}

		ptkGen := keybase1.PerTeamKeyGeneration(gen)

		chainKey, err := stateWrapper.GetPerTeamKeyAtGeneration(ptkGen)
		if err != nil {
			return err
		}

		// Add it to the snapshot
		state.PerTeamKeySeedsUnverified[ptkGen] = keybase1.PerTeamKeySeedItem{
			Seed:       seed,
			Generation: ptkGen,
			Seqno:      chainKey.Seqno,
		}
	}

	// Make sure there is not a gap between the latest local key and the earliest received key.
	if earliestReceivedGen > keybase1.PerTeamKeyGeneration(1) {
		// We should have the seed for the generation preceeding the earliest received.
		checkGen := earliestReceivedGen - 1
		if _, ok := state.PerTeamKeySeedsUnverified[earliestReceivedGen-1]; !ok {
			return fmt.Errorf("gap in per-team-keys: latestRecvd:%v earliestRecvd:%v missing:%v",
				latestReceivedGen, earliestReceivedGen, checkGen)
		}
	}

	role, err := stateWrapper.GetUserRole(me)
	if err != nil {
		role = keybase1.TeamRole_NONE
	}
	if role.IsBotOrAbove() {
		// Insert all reader key masks
		// Then scan to make sure there are no gaps in generations and no missing application masks.
		checkMaskGens := make(map[keybase1.PerTeamKeyGeneration]bool)
		for _, rkm := range readerKeyMasks {
			if rkm.Generation < 1 {
				return fmt.Errorf("reader key mask has generation: %v < 0", rkm.Generation)
			}
			if _, ok := state.ReaderKeyMasks[rkm.Application]; !ok {
				state.ReaderKeyMasks[rkm.Application] = make(
					map[keybase1.PerTeamKeyGeneration]keybase1.MaskB64)
			}
			state.ReaderKeyMasks[rkm.Application][rkm.Generation] = rkm.Mask

			checkMaskGens[rkm.Generation] = true
			if rkm.Generation > 1 {
				// Check for the previous rkm to make sure there are no gaps
				checkMaskGens[rkm.Generation-1] = true
			}
		}
		mctx.Debug("TeamLoader.addSecrets: loop1")
		// Check that we are all the way up to date
		checkMaskGens[latestChainGen] = true
		for gen := range checkMaskGens {
			err = l.checkReaderKeyMaskCoverage(mctx, state, gen)
			if err != nil {
				return err
			}
		}
		mctx.Debug("TeamLoader.addSecrets: loop2")
	} else {
		// Discard all cached reader key masks if we are not an explicit member of the team.
		state.ReaderKeyMasks = make(map[keybase1.TeamApplication]map[keybase1.PerTeamKeyGeneration]keybase1.MaskB64)

		// Also we shouldn't have gotten any from the server.
		if len(readerKeyMasks) > 0 {
			mctx.Warning("TeamLoader got %v reader-key-masks but not an explicit member",
				len(readerKeyMasks))
		}
	}
	return nil
}

// Check that the RKMs for a generation are covered for all apps.
func (l *TeamLoader) checkReaderKeyMaskCoverage(mctx libkb.MetaContext,
	state *keybase1.TeamData, gen keybase1.PerTeamKeyGeneration) error {

	for _, app := range keybase1.TeamApplicationMap {
		switch app {
		case keybase1.TeamApplication_STELLAR_RELAY, keybase1.TeamApplication_KVSTORE:
			// TODO CORE-7718 Allow clients to be missing these RKMs for now.
			//                Will need a team cache bust to repair.
			continue
		}
		if _, ok := state.ReaderKeyMasks[app]; !ok {
			return fmt.Errorf("missing reader key mask for gen:%v app:%v", gen, app)
		}
		if _, ok := state.ReaderKeyMasks[app][gen]; !ok {
			return fmt.Errorf("missing reader key mask for gen:%v app:%v", gen, app)
		}
	}

	return nil
}

// Unbox per team keys
// Does not check that the keys match the chain
// TODO: return the signer and have the caller check it. Not critical because the public half is checked anyway.
// Returns the generation of the box (the greatest generation),
// and a list of the seeds in ascending generation order.
func (l *TeamLoader) unboxPerTeamSecrets(mctx libkb.MetaContext,
	box *TeamBox, prevs map[keybase1.PerTeamKeyGeneration]prevKeySealedEncoded) (keybase1.PerTeamKeyGeneration, []keybase1.PerTeamKeySeed, error) {

	return unboxPerTeamSecrets(mctx, l.world, box, prevs)
}

func unboxPerTeamSecrets(m libkb.MetaContext, world LoaderContext, box *TeamBox, prevs map[keybase1.PerTeamKeyGeneration]prevKeySealedEncoded) (keybase1.PerTeamKeyGeneration, []keybase1.PerTeamKeySeed, error) {

	if box == nil {
		return 0, nil, fmt.Errorf("no key box from server")
	}

	userKey, err := world.perUserEncryptionKey(m.Ctx(), box.PerUserKeySeqno)

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
		secret, err := decryptPrevSingle(m.Ctx(), prev, secrets[len(secrets)-1])
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

	// Load the parent. The parent load will recalculate its own name,
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

// computeSeedChecks looks at the PerTeamKeySeedsUnverified for the given team and adds the
// PerTeamSeedChecks to the sequence. We make the assumption that, potentially, all such links are
// null because it's a legacy team. OR only the new links are null since they were just added.
// In either case, after this function runs, all seeds get seed checks computed.
func (l *TeamLoader) computeSeedChecks(ctx context.Context, state *keybase1.TeamData) (err error) {
	mctx := libkb.NewMetaContext(ctx, l.G())
	defer mctx.Trace(fmt.Sprintf("TeamLoader#computeSeedChecks(%s)", state.ID()), func() error { return err })()

	latestChainGen := keybase1.PerTeamKeyGeneration(len(state.PerTeamKeySeedsUnverified))
	err = computeSeedChecks(
		ctx,
		state.ID(),
		latestChainGen,
		func(g keybase1.PerTeamKeyGeneration) (*keybase1.PerTeamSeedCheck, keybase1.PerTeamKeySeed, error) {
			ptksu, ok := state.PerTeamKeySeedsUnverified[g]
			if !ok {
				return nil, keybase1.PerTeamKeySeed{}, fmt.Errorf("unexpected nil PerTeamKeySeedsUnverified at %d", g)
			}
			return ptksu.Check, ptksu.Seed, nil
		},
		func(g keybase1.PerTeamKeyGeneration, check keybase1.PerTeamSeedCheck) {
			ptksu := state.PerTeamKeySeedsUnverified[g]
			ptksu.Check = &check
			state.PerTeamKeySeedsUnverified[g] = ptksu
		},
	)
	return err
}

// consumeRatchets finds the hidden chain ratchets in the given link (if it's not stubbed), and adds them
// into the hidden.LoaderPackage via the AddRatchets call. This call, in turn, attempts to unblind the ratchet
// and then checks the ratchets against current state and ratchets. Thus, it can fail in many ways if the server
// is buggy or dishonest.
func consumeRatchets(mctx libkb.MetaContext, hiddenPackage *hidden.LoaderPackage, link *ChainLinkUnpacked) (err error) {
	if link.isStubbed() {
		return nil
	}
	err = hiddenPackage.AddRatchets(mctx, link.inner.Ratchets(), link.inner.Ctime, keybase1.RatchetType_MAIN)
	return err
}

func checkPTKGenerationNotOnHiddenChain(mctx libkb.MetaContext, hiddenPackage *hidden.LoaderPackage, link *ChainLinkUnpacked) (err error) {
	gen := link.PTKGeneration()
	if gen == keybase1.PerTeamKeyGeneration(0) {
		return nil
	}
	return hiddenPackage.CheckNoPTK(mctx, gen)
}
