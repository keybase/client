package teams

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
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
	merkleLookupTripleAtHashMeta(ctx context.Context, isPublic bool, leafID keybase1.UserOrTeamID, hm keybase1.HashMeta) (triple *libkb.MerkleTriple, err error)
	forceLinkMapRefreshForUser(ctx context.Context, uid keybase1.UID) (linkMap linkMapT, err error)
	loadKeyV2(ctx context.Context, uid keybase1.UID, kid keybase1.KID, lkc *loadKeyCache) (keybase1.UserVersion, *keybase1.PublicKeyV2NaCl, linkMapT, error)
}

// The main LoaderContext is G.
type LoaderContextG struct {
	libkb.Contextified
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
	SubteamReader    bool                               `json:"subteam_reader"`
	Showcase         keybase1.TeamShowcase              `json:"showcase"`
	LegacyTLFUpgrade []keybase1.TeamGetLegacyTLFUpgrade `json:"legacy_tlf_upgrade"`
}

func (r *rawTeam) GetAppStatus() *libkb.AppStatus {
	return &r.Status
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

	arg := libkb.NewAPIArgWithNetContext(ctx, "team/get")
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
	}
	if len(requestSeqnos) > 0 {
		arg.Args["seqnos"] = libkb.S{Val: seqnosToString(requestSeqnos)}
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
	upak, err := loadUPAKLite(ctx, l.G(), uid, false /*forcePoll */)
	if err != nil {
		return keybase1.Seqno(1), err
	}
	return upak.Current.EldestSeqno, nil
}

func (l *LoaderContextG) perUserEncryptionKey(ctx context.Context, userSeqno keybase1.Seqno) (*libkb.NaclDHKeyPair, error) {
	return perUserEncryptionKey(l.MetaContext(ctx), userSeqno)
}

func perUserEncryptionKey(m libkb.MetaContext, userSeqno keybase1.Seqno) (*libkb.NaclDHKeyPair, error) {
	kr, err := m.G().GetPerUserKeyring()
	if err != nil {
		return nil, err
	}
	return kr.GetEncryptionKeyBySeqnoOrSync(m, userSeqno)
}

func (l *LoaderContextG) merkleLookup(ctx context.Context, teamID keybase1.TeamID, public bool) (r1 keybase1.Seqno, r2 keybase1.LinkID, err error) {
	leaf, err := l.G().GetMerkleClient().LookupTeam(l.MetaContext(ctx), teamID)
	if err != nil {
		return r1, r2, err
	}
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

func (l *LoaderContextG) merkleLookupTripleAtHashMeta(ctx context.Context, isPublic bool, leafID keybase1.UserOrTeamID, hm keybase1.HashMeta) (triple *libkb.MerkleTriple, err error) {
	leaf, err := l.G().MerkleClient.LookupLeafAtHashMeta(l.MetaContext(ctx), leafID, hm)
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
	upak, err := l.G().GetUPAKLoader().LoadLite(arg)
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
