package teams

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"sync"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/sig3"
	"github.com/keybase/client/go/teams/hidden"
)

// Things TeamLoader uses that are mocked out for tests.
type LoaderContext interface {
	// Get new links from the server.
	getNewLinksFromServer(ctx context.Context,
		teamID keybase1.TeamID, lows getLinksLows,
		readSubteamID *keybase1.TeamID) (*rawTeam, error)
	// Get full links from the server.
	// Does not guarantee that the server returned the correct links, nor that they are unstubbed.
	getLinksFromServer(ctx context.Context,
		teamID keybase1.TeamID, requestSeqnos []keybase1.Seqno,
		readSubteamID *keybase1.TeamID) (*rawTeam, error)
	getMe(context.Context) (keybase1.UserVersion, error)
	// Lookup the eldest seqno of a user. Can use the cache.
	lookupEldestSeqno(context.Context, keybase1.UID) (keybase1.Seqno, error)
	// Get the current user's per-user-key's derived encryption key (full).
	perUserEncryptionKey(ctx context.Context, userSeqno keybase1.Seqno) (*libkb.NaclDHKeyPair, error)
	merkleLookup(ctx context.Context, teamID keybase1.TeamID, public bool) (r1 keybase1.Seqno, r2 keybase1.LinkID, err error)
	merkleLookupWithHidden(ctx context.Context, teamID keybase1.TeamID, public bool) (r1 keybase1.Seqno, r2 keybase1.LinkID, hiddenResp *libkb.MerkleHiddenResponse, err error)
	merkleLookupTripleInPast(ctx context.Context, isPublic bool, leafID keybase1.UserOrTeamID, root keybase1.MerkleRootV2) (triple *libkb.MerkleTriple, err error)
	forceLinkMapRefreshForUser(ctx context.Context, uid keybase1.UID) (linkMap linkMapT, err error)
	loadKeyV2(ctx context.Context, uid keybase1.UID, kid keybase1.KID, lkc *loadKeyCache) (keybase1.UserVersion, *keybase1.PublicKeyV2NaCl, linkMapT, error)
}

// The main LoaderContext is G.
type LoaderContextG struct {
	libkb.Contextified

	// Cache of size=1 for caching merkle leaf lookups at the checkpoint, since in practice
	// we hit this is rapid succession.
	cacheMu     sync.RWMutex
	cachedSeqno keybase1.Seqno
	cachedLeaf  *libkb.MerkleGenericLeaf
}

var _ LoaderContext = (*LoaderContextG)(nil)

func NewLoaderContextFromG(g *libkb.GlobalContext) LoaderContext {
	return &LoaderContextG{
		Contextified: libkb.NewContextified(g),
	}
}

type rawTeam struct {
	ID             keybase1.TeamID                                        `json:"id"`
	Name           keybase1.TeamName                                      `json:"name"`
	Status         libkb.AppStatus                                        `json:"status"`
	Chain          []json.RawMessage                                      `json:"chain"`
	Box            *TeamBox                                               `json:"box"`
	Prevs          map[keybase1.PerTeamKeyGeneration]prevKeySealedEncoded `json:"prevs"`
	ReaderKeyMasks []keybase1.ReaderKeyMask                               `json:"reader_key_masks"`
	// Whether the user is only being allowed to view the chain
	// because they are a member of a descendent team.
	SubteamReader         bool                               `json:"subteam_reader"`
	Showcase              keybase1.TeamShowcase              `json:"showcase"`
	LegacyTLFUpgrade      []keybase1.TeamGetLegacyTLFUpgrade `json:"legacy_tlf_upgrade"`
	HiddenChain           []sig3.ExportJSON                  `json:"hidden"`
	RatchetBlindingKeySet *hidden.RatchetBlindingKeySet      `json:"ratchet_blinding_keys"`
}

func (r *rawTeam) GetAppStatus() *libkb.AppStatus {
	return &r.Status
}

func (r *rawTeam) GetHiddenChain() []sig3.ExportJSON {
	if r == nil {
		return nil
	}
	return r.HiddenChain
}

func (r *rawTeam) unpackLinks(ctx context.Context) ([]*ChainLinkUnpacked, error) {
	if r == nil {
		return nil, nil
	}
	parsedLinks, err := r.parseLinks(ctx)
	if err != nil {
		return nil, err
	}
	var links []*ChainLinkUnpacked
	for _, pLink := range parsedLinks {
		pLink2 := pLink
		link, err := unpackChainLink(&pLink2)
		if err != nil {
			return nil, err
		}
		if !link.isStubbed() {
			if !link.innerTeamID.Eq(r.ID) {
				return nil, fmt.Errorf("link has wrong team ID in response: %v != %v", link.innerTeamID, r.ID)
			}
		}
		links = append(links, link)
	}
	return links, nil
}

func (r *rawTeam) parseLinks(ctx context.Context) ([]SCChainLink, error) {
	var links []SCChainLink
	for _, raw := range r.Chain {
		link, err := ParseTeamChainLink(string(raw))
		if err != nil {
			return nil, err
		}
		links = append(links, link)
	}
	return links, nil
}

// Get new links from the server.
func (l *LoaderContextG) getNewLinksFromServer(ctx context.Context,
	teamID keybase1.TeamID, lows getLinksLows,
	readSubteamID *keybase1.TeamID) (*rawTeam, error) {
	return l.getLinksFromServerCommon(ctx, teamID, &lows, nil, readSubteamID)
}

// Get full links from the server.
// Does not guarantee that the server returned the correct links, nor that they are unstubbed.
func (l *LoaderContextG) getLinksFromServer(ctx context.Context,
	teamID keybase1.TeamID, requestSeqnos []keybase1.Seqno, readSubteamID *keybase1.TeamID) (*rawTeam, error) {
	return l.getLinksFromServerCommon(ctx, teamID, nil, requestSeqnos, readSubteamID)
}

func (l *LoaderContextG) getLinksFromServerCommon(ctx context.Context,
	teamID keybase1.TeamID, lows *getLinksLows, requestSeqnos []keybase1.Seqno, readSubteamID *keybase1.TeamID) (*rawTeam, error) {

	mctx := libkb.NewMetaContext(ctx, l.G())
	arg := libkb.NewAPIArg("team/get")
	arg.SessionType = libkb.APISessionTypeREQUIRED
	if teamID.IsPublic() {
		arg.SessionType = libkb.APISessionTypeOPTIONAL
	}

	arg.Args = libkb.HTTPArgs{
		"id":     libkb.S{Val: teamID.String()},
		"public": libkb.B{Val: teamID.IsPublic()},
	}
	if lows != nil {
		arg.Args["low"] = libkb.I{Val: int(lows.Seqno)}
		// At some point to save bandwidth these could be hooked up.
		// "per_team_key_low":    libkb.I{Val: int(lows.PerTeamKey)},
		// "reader_key_mask_low": libkb.I{Val: int(lows.PerTeamKey)},
		arg.Args["hidden_low"] = libkb.I{Val: int(lows.HiddenChainSeqno)}
	}
	if len(requestSeqnos) > 0 {
		arg.Args["seqnos"] = libkb.S{Val: seqnosToString(requestSeqnos)}
	}
	if readSubteamID != nil {
		arg.Args["read_subteam_id"] = libkb.S{Val: readSubteamID.String()}
	}

	var rt rawTeam
	if err := mctx.G().API.GetDecode(mctx, arg, &rt); err != nil {
		return nil, err
	}
	if !rt.ID.Eq(teamID) {
		return nil, fmt.Errorf("server returned wrong team ID: %v != %v", rt.ID, teamID)
	}
	return &rt, nil
}

func seqnosToString(v []keybase1.Seqno) string {
	var s []string
	for _, e := range v {
		s = append(s, fmt.Sprintf("%d", int(e)))
	}
	return strings.Join(s, ",")
}

func (l *LoaderContextG) getMe(ctx context.Context) (res keybase1.UserVersion, err error) {
	uid := l.G().ActiveDevice.UID()
	// If we're logged out, we still should be able to access the team loader
	// for public teams. So we'll just return a nil UID here, and it should just work.
	if uid.IsNil() {
		return res, nil
	}
	return l.G().GetMeUV(ctx)
}

func (l *LoaderContextG) lookupEldestSeqno(ctx context.Context, uid keybase1.UID) (keybase1.Seqno, error) {
	// Lookup the latest eldest seqno for that uid.
	// This value may come from a cache.
	upak, err := loadUPAK2(ctx, l.G(), uid, false /*forcePoll */)
	if err != nil {
		return keybase1.Seqno(1), err
	}
	return upak.Current.EldestSeqno, nil
}

func (l *LoaderContextG) perUserEncryptionKey(ctx context.Context, userSeqno keybase1.Seqno) (*libkb.NaclDHKeyPair, error) {
	return perUserEncryptionKey(l.MetaContext(ctx), userSeqno)
}

func perUserEncryptionKey(m libkb.MetaContext, userSeqno keybase1.Seqno) (*libkb.NaclDHKeyPair, error) {
	kr, err := m.G().GetPerUserKeyring(m.Ctx())
	if err != nil {
		return nil, err
	}
	return kr.GetEncryptionKeyBySeqnoOrSync(m, userSeqno)
}

func (l *LoaderContextG) merkleLookupWithHidden(ctx context.Context, teamID keybase1.TeamID, public bool) (r1 keybase1.Seqno, r2 keybase1.LinkID, hiddenResp *libkb.MerkleHiddenResponse, err error) {
	leaf, hiddenResp, err := l.G().GetMerkleClient().LookupTeamWithHidden(l.MetaContext(ctx), teamID, hidden.ProcessHiddenResponseFunc)
	if err != nil {
		return r1, r2, nil, err
	}
	r1, r2, err = l.processMerkleReply(ctx, teamID, public, leaf)
	if err != nil {
		return r1, r2, nil, err
	}

	return r1, r2, hiddenResp, err
}

func (l *LoaderContextG) merkleLookup(ctx context.Context, teamID keybase1.TeamID, public bool) (r1 keybase1.Seqno, r2 keybase1.LinkID, err error) {
	leaf, err := l.G().GetMerkleClient().LookupTeam(l.MetaContext(ctx), teamID)
	if err != nil {
		return r1, r2, err
	}
	r1, r2, err = l.processMerkleReply(ctx, teamID, public, leaf)
	return r1, r2, err
}

func (l *LoaderContextG) processMerkleReply(ctx context.Context, teamID keybase1.TeamID, public bool, leaf *libkb.MerkleTeamLeaf) (r1 keybase1.Seqno, r2 keybase1.LinkID, err error) {

	if !leaf.TeamID.Eq(teamID) {
		return r1, r2, fmt.Errorf("merkle returned wrong leaf: %v != %v", leaf.TeamID.String(), teamID.String())
	}

	if public {
		if leaf.Public == nil {
			l.G().Log.CDebugf(ctx, "TeamLoader hidden error: merkle returned nil leaf")
			return r1, r2, NewTeamDoesNotExistError(public, teamID.String())
		}
		return leaf.Public.Seqno, leaf.Public.LinkID.Export(), nil
	}
	if leaf.Private == nil {
		l.G().Log.CDebugf(ctx, "TeamLoader hidden error: merkle returned nil leaf")
		return r1, r2, NewTeamDoesNotExistError(public, teamID.String())
	}
	return leaf.Private.Seqno, leaf.Private.LinkID.Export(), nil
}

func (l *LoaderContextG) getCachedCheckpointLookup(leafID keybase1.UserOrTeamID, seqno keybase1.Seqno) *libkb.MerkleGenericLeaf {
	l.cacheMu.RLock()
	defer l.cacheMu.RUnlock()
	if l.cachedLeaf == nil || !l.cachedLeaf.LeafID.Equal(leafID) || !l.cachedSeqno.Eq(seqno) {
		return nil
	}
	ret := l.cachedLeaf.PartialClone()
	return &ret
}

func (l *LoaderContextG) putCachedCheckpoint(seqno keybase1.Seqno, leaf *libkb.MerkleGenericLeaf) {
	l.cacheMu.Lock()
	defer l.cacheMu.Unlock()
	tmp := leaf.PartialClone()
	l.cachedLeaf = &tmp
	l.cachedSeqno = seqno
}

func (l *LoaderContextG) merkleLookupTripleAtCheckpoint(mctx libkb.MetaContext, leafID keybase1.UserOrTeamID, seqno keybase1.Seqno) (leaf *libkb.MerkleGenericLeaf, err error) {

	ret := l.getCachedCheckpointLookup(leafID, seqno)
	if ret != nil {
		mctx.VLogf(libkb.VLog0, "hit checkpoint cache")
		return ret, nil
	}

	mc := l.G().MerkleClient
	leaf, _, err = mc.LookupLeafAtSeqno(mctx, leafID, seqno)
	if leaf != nil && err == nil {
		l.putCachedCheckpoint(seqno, leaf)
	}
	return leaf, err
}

func (l *LoaderContextG) merkleLookupTripleInPast(ctx context.Context, isPublic bool, leafID keybase1.UserOrTeamID, root keybase1.MerkleRootV2) (triple *libkb.MerkleTriple, err error) {
	mctx := l.MetaContext(ctx)

	mc := l.G().MerkleClient
	checkpoint := mc.FirstExaminableHistoricalRoot(mctx)
	var leaf *libkb.MerkleGenericLeaf

	// If we're trying to lookup a leaf from before the checkpoint, just bump forward to the checkpoint.
	// The checkpoint is consindered to be a legitimate version of Tree.
	if checkpoint != nil && root.Seqno < *checkpoint {
		mctx.Debug("Bumping up pre-checkpoint merkle fetch to checkpoint at %d for %s", *checkpoint, leafID)
		leaf, err = l.merkleLookupTripleAtCheckpoint(mctx, leafID, *checkpoint)
	} else {
		leaf, err = mc.LookupLeafAtHashMeta(mctx, leafID, root.HashMeta)
	}

	if err != nil {
		return nil, err
	}
	if isPublic {
		triple = leaf.Public
	} else {
		triple = leaf.Private
	}
	if triple == nil {
		return nil, fmt.Errorf("unexpected nil leaf for %v", leafID)
	}
	return triple, nil
}

func (l *LoaderContextG) forceLinkMapRefreshForUser(ctx context.Context, uid keybase1.UID) (linkMap linkMapT, err error) {
	arg := libkb.NewLoadUserArg(l.G()).WithNetContext(ctx).WithUID(uid).WithForcePoll(true)
	upak, _, err := l.G().GetUPAKLoader().LoadV2(arg)
	if err != nil {
		return nil, err
	}
	return upak.SeqnoLinkIDs, nil
}

func (l *LoaderContextG) loadKeyV2(ctx context.Context, uid keybase1.UID, kid keybase1.KID, lkc *loadKeyCache) (
	uv keybase1.UserVersion, pubKey *keybase1.PublicKeyV2NaCl, linkMap linkMapT, err error) {
	ctx, tbs := l.G().CTimeBuckets(ctx)
	defer tbs.Record("LoaderContextG.loadKeyV2")()

	return lkc.loadKeyV2(l.MetaContext(ctx), uid, kid)
}
