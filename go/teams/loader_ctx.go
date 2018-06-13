package teams

import (
	"context"
	"fmt"
	"strings"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

// Things TeamLoader uses that are mocked out for tests.
type LoaderContext interface {
	// Get new links from the server.
	getNewLinksFromServer(ctx context.Context,
		teamID keybase1.TeamID, public bool, lows getLinksLows,
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
	loadKeyV2(ctx context.Context, uid keybase1.UID, kid keybase1.KID) (keybase1.UserVersion, *keybase1.PublicKeyV2NaCl, linkMapT, error)
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

// Get new links from the server.
func (l *LoaderContextG) getNewLinksFromServer(ctx context.Context,
	teamID keybase1.TeamID, public bool, lows getLinksLows,
	readSubteamID *keybase1.TeamID) (*rawTeam, error) {

	arg := libkb.NewAPIArgWithNetContext(ctx, "team/get")
	if public {
		arg.SessionType = libkb.APISessionTypeOPTIONAL
	} else {
		arg.SessionType = libkb.APISessionTypeREQUIRED

	}
	arg.Args = libkb.HTTPArgs{
		"id":     libkb.S{Val: teamID.String()},
		"low":    libkb.I{Val: int(lows.Seqno)},
		"public": libkb.B{Val: public},
		// These don't really work yet on the client or server.
		// "per_team_key_low":    libkb.I{Val: int(lows.PerTeamKey)},
		// "reader_key_mask_low": libkb.I{Val: int(lows.PerTeamKey)},
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
func (l *LoaderContextG) getLinksFromServer(ctx context.Context,
	teamID keybase1.TeamID, requestSeqnos []keybase1.Seqno, readSubteamID *keybase1.TeamID) (*rawTeam, error) {

	var seqnoStrs []string
	for _, seqno := range requestSeqnos {
		seqnoStrs = append(seqnoStrs, fmt.Sprintf("%d", int(seqno)))
	}
	seqnoCommas := strings.Join(seqnoStrs, ",")

	arg := libkb.NewAPIArgWithNetContext(ctx, "team/get")
	arg.SessionType = libkb.APISessionTypeREQUIRED
	arg.Args = libkb.HTTPArgs{
		"id":     libkb.S{Val: teamID.String()},
		"seqnos": libkb.S{Val: seqnoCommas},
		// These don't really work yet on the client or server.
		// "per_team_key_low":    libkb.I{Val: int(lows.PerTeamKey)},
		// "reader_key_mask_low": libkb.I{Val: int(lows.PerTeamKey)},
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

func (l *LoaderContextG) getMe(ctx context.Context) (res keybase1.UserVersion, err error) {
	uid := l.G().ActiveDevice.UID()
	// If we're logged out, we still should be able to access the team loader
	// for public teams. So we'll just return a nil UID here, and it should just work.
	if uid.IsNil() {
		return res, nil
	}
	return getCurrentUserUV(ctx, l.G())
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
	kr, err := l.G().GetPerUserKeyring()
	if err != nil {
		return nil, err
	}
	return kr.GetEncryptionKeyBySeqnoOrSync(l.MetaContext(ctx), userSeqno)
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
	upak, _, err := l.G().GetUPAKLoader().LoadV2(arg)
	if err != nil {
		return nil, err
	}
	return upak.SeqnoLinkIDs, nil
}

func (l *LoaderContextG) loadKeyV2(ctx context.Context, uid keybase1.UID, kid keybase1.KID) (
	uv keybase1.UserVersion, pubKey *keybase1.PublicKeyV2NaCl, linkMap linkMapT,
	err error) {

	user, pubKey, linkMap, err := l.G().GetUPAKLoader().LoadKeyV2(ctx, uid, kid)
	if err != nil {
		return
	}
	if user == nil {
		return uv, pubKey, linkMap, libkb.NotFoundError{}
	}

	return user.ToUserVersion(), pubKey, linkMap, nil
}
