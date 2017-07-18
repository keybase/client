package teams

import (
	"fmt"
	"sort"
	"time"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

// How long until the tail of a team sigchain is considered non-fresh
const freshnessLimit = time.Duration(1) * time.Hour

// Load a Team from the TeamLoader.
// Can be called from inside the teams package.
func Load(ctx context.Context, g *libkb.GlobalContext, lArg keybase1.LoadTeamArg) (*Team, error) {
	teamData, err := g.GetTeamLoader().Load(ctx, lArg)
	if err != nil {
		return nil, err
	}
	return NewTeam(ctx, g, teamData), nil
}

// Loader of keybase1.TeamData objects. Handles caching.
// Because there is one of this global object and it is attached to G,
// its Load interface must return a keybase1.TeamData not a teams.Team.
// To load a teams.Team use the package-level function Load.
// Threadsafe.
type TeamLoader struct {
	libkb.Contextified
	storage *Storage
	// Single-flight locks per team ID.
	locktab libkb.LockTable
}

var _ libkb.TeamLoader = (*TeamLoader)(nil)

func NewTeamLoader(g *libkb.GlobalContext, storage *Storage) *TeamLoader {
	return &TeamLoader{
		Contextified: libkb.NewContextified(g),
		storage:      storage,
	}
}

// NewTeamLoaderAndInstall creates a new loader and installs it into G.
func NewTeamLoaderAndInstall(g *libkb.GlobalContext) *TeamLoader {
	st := NewStorage(g)
	l := NewTeamLoader(g, st)
	g.SetTeamLoader(l)
	return l
}

func (l *TeamLoader) Load(ctx context.Context, lArg keybase1.LoadTeamArg) (res *keybase1.TeamData, err error) {
	me, err := l.getMe(ctx)
	if err != nil {
		return nil, err
	}
	return l.load1(ctx, me, lArg)
}

func (l *TeamLoader) getMe(ctx context.Context) (res keybase1.UserVersion, err error) {
	return loadUserVersionByUID(ctx, l.G(), l.G().Env.GetUID())
}

// Load1 unpacks the loadArg, calls load2, and does some final checks.
// The key difference between load1 and load2 is that load2 is recursive (for subteams).
func (l *TeamLoader) load1(ctx context.Context, me keybase1.UserVersion, lArg keybase1.LoadTeamArg) (*keybase1.TeamData, error) {
	err := l.checkArg(ctx, lArg)
	if err != nil {
		return nil, err
	}

	var teamName *keybase1.TeamName
	if len(lArg.Name) > 0 {
		teamNameParsed, err := keybase1.TeamNameFromString(lArg.Name)
		if err != nil {
			return nil, fmt.Errorf("invalid team name: %v", err)
		}
		teamName = &teamNameParsed
	}

	teamID := lArg.ID
	// Resolve the name to team ID. Will always hit the server for subteams.
	// It is safe for the answer to be wrong because the name is checked on the way out,
	// and the merkle tree check guarantees one sigchain per team id.
	if !teamID.Exists() {
		teamID, err = l.resolveNameToIDUntrusted(ctx, *teamName)
		if err != nil {
			return nil, err
		}
	}

	mungedForceRepoll := lArg.ForceRepoll
	mungedWantMembers, err := l.mungeWantMembers(ctx, lArg.Refreshers.WantMembers)
	if err != nil {
		l.G().Log.CDebugf(ctx, "TeamLoader munge failed: %v", err)
		// drop the error and just force a repoll.
		mungedForceRepoll = true
	}

	var ret *keybase1.TeamData
	ret, err = l.load2(ctx, load2ArgT{
		teamID: teamID,

		needAdmin:         lArg.NeedAdmin,
		needKeyGeneration: lArg.Refreshers.NeedKeyGeneration,
		wantMembers:       mungedWantMembers,
		wantMembersRole:   lArg.Refreshers.WantMembersRole,
		forceFullReload:   lArg.ForceFullReload,
		forceRepoll:       mungedForceRepoll,
		staleOK:           lArg.StaleOK,

		needSeqnos:    nil,
		readSubteamID: nil,

		me: me,
	})
	if err != nil {
		return nil, err
	}
	if ret == nil {
		return nil, fmt.Errorf("team loader fault: got nil from load2")
	}

	// Sanity check that secretless teams never escape.
	// They are meant only to be returned by recursively called load2's.
	if ret.Secretless {
		return nil, fmt.Errorf("team loader fault: got secretless team")
	}

	// Check team name on the way out
	// The snapshot may have already been written to cache, but that should be ok,
	// because the cache is keyed by ID.
	if teamName != nil {
		// (TODO: this won't work for renamed level 3 teams or above. There's work on this in miles/teamloader-names)
		if !teamName.Eq(ret.Name) {
			return nil, fmt.Errorf("team name mismatch: %v != %v", ret.Name, teamName.String())
		}
	}

	return ret, nil
}

func (l *TeamLoader) checkArg(ctx context.Context, lArg keybase1.LoadTeamArg) error {
	// TODO: stricter check on team ID format.
	hasID := lArg.ID.Exists()
	hasName := len(lArg.Name) > 0
	if !hasID && !hasName {
		return fmt.Errorf("team load arg must have either ID or Name")
	}
	return nil
}

// Resolve a team name to a team ID.
// Will always hit the server for subteams. The server can lie in this return value.
func (l *TeamLoader) resolveNameToIDUntrusted(ctx context.Context, teamName keybase1.TeamName) (id keybase1.TeamID, err error) {
	// For root team names, just hash.
	if teamName.IsRootTeam() {
		return teamName.ToTeamID(), nil
	}

	arg := libkb.NewRetryAPIArg("team/get")
	arg.NetContext = ctx
	arg.SessionType = libkb.APISessionTypeREQUIRED
	arg.Args = libkb.HTTPArgs{
		"name":        libkb.S{Val: teamName.String()},
		"lookup_only": libkb.B{Val: true},
	}

	var rt rawTeam
	if err := l.G().API.GetDecode(arg, &rt); err != nil {
		return id, err
	}
	id = rt.ID
	if !id.Exists() {
		return id, fmt.Errorf("could not resolve team name: %v", teamName.String())
	}
	return id, nil
}

// Mostly the same as the public keybase.LoadTeamArg
// but only supports loading by ID, and has neededSeqnos.
type load2ArgT struct {
	teamID keybase1.TeamID

	needAdmin         bool
	needKeyGeneration keybase1.PerTeamKeyGeneration
	// wantMembers here is different from wantMembers on LoadTeamArg:
	// The EldestSeqno's should not be 0.
	wantMembers     []keybase1.UserVersion
	wantMembersRole keybase1.TeamRole
	forceFullReload bool
	forceRepoll     bool
	staleOK         bool

	needSeqnos []keybase1.Seqno
	// Non-nil if we are loading an ancestor for the greater purpose of
	// loading a subteam. This parameter helps the server figure out whether
	// to give us a subteam-reader version of the team.
	// If and only if this is set, load2 is allowed to return a secret-less TeamData.
	// Load1 should never ever return a secret-less TeamData.
	readSubteamID *keybase1.TeamID

	me keybase1.UserVersion
}

// Load2 does the rest of the work loading a team.
// It is `playchain` described in the pseudocode in teamplayer.txt
func (l *TeamLoader) load2(ctx context.Context, arg load2ArgT) (ret *keybase1.TeamData, err error) {
	ctx = libkb.WithLogTag(ctx, "LT")
	defer l.G().CTraceTimed(ctx, fmt.Sprintf("TeamLoader#load2(%v)", arg.teamID), func() error { return err })()
	ret, err = l.load2Inner(ctx, arg)
	return ret, err
}

func (l *TeamLoader) load2Inner(ctx context.Context, arg load2ArgT) (*keybase1.TeamData, error) {
	var err error

	// Single-flight lock by team ID.
	lock := l.locktab.AcquireOnName(ctx, l.G(), arg.teamID.String())
	defer lock.Release(ctx)

	// Fetch from cache
	var ret *keybase1.TeamData
	if !arg.forceFullReload {
		// Load from cache
		ret = l.storage.Get(ctx, arg.teamID)
	}

	if ret != nil && !ret.Chain.Reader.Eq(arg.me) {
		// Check that we are the same person as when this team was last loaded as a courtesy.
		// This should never happen. We shouldn't be able to decrypt someone else's snapshot.
		l.G().Log.CWarningf(ctx, "team loader discarding snapshot for wrong user: (%v, %v) != (%v, %v)",
			arg.me.Uid, arg.me.EldestSeqno, ret.Chain.Reader.Uid, ret.Chain.Reader.EldestSeqno)
		ret = nil
	}

	var cachedName *keybase1.TeamName
	if ret != nil && !ret.Name.IsNil() {
		cachedName = &ret.Name
	}

	// Throw out the cache result if it is secretless and this is not a recursive load
	if ret != nil && arg.readSubteamID == nil && ret.Secretless {
		ret = nil
	}

	// Determine whether to repoll merkle.
	discardCache, repoll := l.load2DecideRepoll(ctx, arg, ret)
	if discardCache {
		ret = nil
		repoll = true
	}

	if ret != nil {
		l.G().Log.CDebugf(ctx, "TeamLoader found cached snapshot")
	}

	var lastSeqno keybase1.Seqno
	var lastLinkID keybase1.LinkID
	if (ret == nil) || repoll {
		l.G().Log.CDebugf(ctx, "TeamLoader looking up merkle leaf (force:%v)", arg.forceRepoll)
		// Reference the merkle tree to fetch the sigchain tail leaf for the team.
		lastSeqno, lastLinkID, err = l.lookupMerkle(ctx, arg.teamID)
	} else {
		lastSeqno = ret.Chain.LastSeqno
		lastLinkID = ret.Chain.LastLinkID
	}

	// For child calls to load2, the subteam reader ID is carried up
	// or if it doesn't exist, start at this team.
	readSubteamID := arg.teamID
	if arg.readSubteamID != nil {
		readSubteamID = *arg.readSubteamID
	}

	proofSet := newProofSet()
	var parentChildOperations []*parentChildOperation

	// Backfill stubbed links that need to be filled now.
	if ret != nil && len(arg.needSeqnos) > 0 {
		ret, proofSet, parentChildOperations, err = l.fillInStubbedLinks(
			ctx, arg.me, arg.teamID, ret, arg.needSeqnos, readSubteamID, proofSet, parentChildOperations)
		if err != nil {
			return nil, err
		}
	}

	// Pull new links from the server
	var teamUpdate *rawTeam
	if ret == nil || ret.Chain.LastSeqno < lastSeqno {
		lowSeqno := keybase1.Seqno(0)
		lowGen := keybase1.PerTeamKeyGeneration(0)
		if ret != nil {
			lowSeqno = ret.Chain.LastSeqno
			lowGen = TeamSigChainState{inner: ret.Chain}.GetLatestGeneration()
		}
		l.G().Log.CDebugf(ctx, "TeamLoader getting links from server (lowSeqno:%v, lowGen:%v)",
			lowSeqno, lowGen)
		teamUpdate, err = l.getNewLinksFromServer(ctx, arg.teamID, lowSeqno, lowGen, arg.readSubteamID)
		if err != nil {
			return nil, err
		}
		l.G().Log.CDebugf(ctx, "TeamLoader got %v links", len(teamUpdate.Chain))
	}

	links, err := l.unpackLinks(ctx, teamUpdate)
	if err != nil {
		return nil, err
	}
	var prev libkb.LinkID
	if ret != nil {
		prev, err = TeamSigChainState{ret.Chain}.GetLatestLibkbLinkID()
		if err != nil {
			return nil, err
		}
	}
	for i, link := range links {
		l.G().Log.CDebugf(ctx, "TeamLoader processing link seqno:%v", link.Seqno())

		if err := l.checkStubbed(ctx, arg, link); err != nil {
			return nil, err
		}

		if !link.Prev().Eq(prev) {
			return nil, fmt.Errorf("team replay failed: prev chain broken at link %d", i)
		}

		var signer *keybase1.UserVersion
		signer, proofSet, err = l.verifyLink(ctx, arg.teamID, ret, arg.me, link, readSubteamID, proofSet)
		if err != nil {
			return nil, err
		}

		if l.isParentChildOperation(ctx, link) {
			pco, err := l.toParentChildOperation(ctx, link)
			if err != nil {
				return nil, err
			}
			parentChildOperations = append(parentChildOperations, pco)
		}

		ret, err = l.applyNewLink(ctx, ret, link, signer, arg.me)
		if err != nil {
			return nil, err
		}
		prev = link.LinkID()
	}

	if ret == nil {
		return nil, fmt.Errorf("team loader fault: got nil from load2")
	}

	if !ret.Chain.LastLinkID.Eq(lastLinkID) {
		return nil, fmt.Errorf("wrong sigchain link ID: %v != %v",
			ret.Chain.LastLinkID, lastLinkID)
	}

	err = l.checkParentChildOperations(ctx,
		arg.me, arg.teamID, ret.Chain.ParentID, readSubteamID, parentChildOperations)
	if err != nil {
		return nil, err
	}

	err = l.checkProofs(ctx, ret, proofSet)
	if err != nil {
		return nil, err
	}

	if teamUpdate != nil {
		if teamUpdate.SubteamReader {
			// Only allow subteam-reader results if we are in a recursive load.
			if arg.readSubteamID == nil {
				return nil, fmt.Errorf("unexpected subteam reader result")
			}
			// This is now a secretless team. This TeamData will never again contain up to date secrets.
			// A full reload is required to get secrets back into sync.
			ret.Secretless = true
		} else {
			ret, err = l.addSecrets(ctx, ret, teamUpdate.Box, teamUpdate.Prevs, teamUpdate.ReaderKeyMasks)
			if err != nil {
				return nil, fmt.Errorf("loading team secrets: %v", err)
			}
		}
	}

	// Sanity check the id
	if !ret.Chain.Id.Eq(arg.teamID) {
		return nil, fmt.Errorf("team id mismatch: %v != %v", ret.Chain.Id.String(), arg.teamID.String())
	}

	// Recalculate the team name.
	// This must always run to pick up changes in chain and off-chain with ancestor renames.
	// Also because without this a subteam could claim any parent in its name.
	newName, err := l.calculateName(ctx, ret, arg.me, readSubteamID, arg.staleOK)
	if err != nil {
		return nil, fmt.Errorf("error recalculating name for %v: %v", ret.Name, err)
	}
	if !ret.Name.Eq(newName) {
		// This deep copy is an absurd price to pay, but these mid-team renames should be quite rare.
		copy := ret.DeepCopy()
		ret = &copy
		ret.Name = newName
	}

	// Cache the validated result
	// Mutating this field is safe because only TeamLoader
	// while holding the single-flight lock reads or writes this field.
	ret.CachedAt = keybase1.ToTime(l.G().Clock().Now())
	l.storage.Put(ctx, ret)

	if cachedName != nil && !cachedName.Eq(newName) {
		chain := TeamSigChainState{inner: ret.Chain}
		// Send a notification if we used to have the name cached and it has changed at all.
		go l.G().NotifyRouter.HandleTeamChanged(context.Background(), chain.GetID(), newName.String(), chain.GetLatestSeqno(),
			keybase1.TeamChangeSet{
				Renamed: true,
			})
	}

	// Check request constraints
	err = l.load2CheckReturn(ctx, arg, ret)
	if err != nil {
		return nil, err
	}

	return ret, nil
}

// Decide whether to repoll merkle based on load arg.
// Returns (discardCache, repoll)
// If discardCache is true, the caller should throw out their cached copy and repoll.
// Considers:
// - NeedAdmin
// - NeedKeyGeneration
// - WantMembers
// - ForceRepoll
// - Cache freshness / StaleOK
// - NeedSeqnos
func (l *TeamLoader) load2DecideRepoll(ctx context.Context, arg load2ArgT, fromCache *keybase1.TeamData) (bool, bool) {
	// NeedAdmin is a special constraint where we start from scratch.
	// Because of admin-only invite links.
	if arg.needAdmin {
		if !l.satisfiesNeedAdmin(ctx, arg.me, fromCache) {
			// Start from scratch if we are newly admin
			return true, true
		}
	}

	// Whether to hit up merkle for the latest tail.
	// This starts out false and then there are many reasons for turning it true.
	repoll := false

	if arg.forceRepoll {
		repoll = true
	}

	// Repoll to get a new key generation
	if arg.needKeyGeneration > 0 {
		if l.satisfiesNeedKeyGeneration(ctx, arg.needKeyGeneration, fromCache) != nil {
			repoll = true
		}
	}

	// Repoll because it might help get the wanted members
	if len(arg.wantMembers) > 0 {
		if l.satisfiesWantMembers(ctx, arg.wantMembers, arg.wantMembersRole, fromCache) != nil {
			repoll = true
		}
	}

	// Repoll if we need a seqno not in the cache.
	// Does not force a repoll if we just need to fill in previous links
	if len(arg.needSeqnos) > 0 {
		if fromCache == nil {
			repoll = true
		} else {
			if fromCache.Chain.LastSeqno < l.seqnosMax(arg.needSeqnos) {
				repoll = true
			}
		}
	}

	if fromCache == nil {
		// We need a merkle leaf when starting from scratch.
		repoll = true
	}

	cacheIsOld := (fromCache != nil) && !l.isFresh(ctx, fromCache.CachedAt)
	if cacheIsOld && !arg.staleOK {
		// We need a merkle leaf
		repoll = true
	}

	return false, repoll
}

// Check whether the load produced a snapshot that can be returned to the caller.
// This should not check anything that is critical to validity of the snapshot
// because the snapshot is put into the cache before this check.
// Considers:
// - NeedAdmin
// - NeedKeyGeneration
// - NeedSeqnos
func (l *TeamLoader) load2CheckReturn(ctx context.Context, arg load2ArgT, res *keybase1.TeamData) error {
	if arg.needAdmin {
		if !l.satisfiesNeedAdmin(ctx, arg.me, res) {
			l.G().Log.CDebugf(ctx, "user %v is not an admin of team %v at seqno:%v",
				arg.me, arg.teamID, res.Chain.LastSeqno)
			return fmt.Errorf("user %v is not an admin of the team", arg.me)
		}
	}

	// Repoll to get a new key generation
	if arg.needKeyGeneration > 0 {
		err := l.satisfiesNeedKeyGeneration(ctx, arg.needKeyGeneration, res)
		if err != nil {
			return err
		}
	}

	if len(arg.needSeqnos) > 0 {
		err := l.checkNeededSeqnos(ctx, res, arg.needSeqnos)
		if err != nil {
			return err
		}
	}

	return nil
}

// Whether the user is an admin at the snapshot and there are no stubbed links.
func (l *TeamLoader) satisfiesNeedAdmin(ctx context.Context, me keybase1.UserVersion, teamData *keybase1.TeamData) bool {
	if teamData == nil {
		return false
	}
	role, err := TeamSigChainState{inner: teamData.Chain}.GetUserRole(me)
	if err != nil {
		l.G().Log.CDebugf(ctx, "TeamLoader error getting my role: %v", err)
		return false
	}
	if !(role == keybase1.TeamRole_OWNER || role == keybase1.TeamRole_ADMIN) {
		return false
	}
	if (TeamSigChainState{inner: teamData.Chain}.HasAnyStubbedLinks()) {
		return false
	}
	return true
}

// Whether the snapshot has loaded at least up to the key generation.
func (l *TeamLoader) satisfiesNeedKeyGeneration(ctx context.Context, needKeyGeneration keybase1.PerTeamKeyGeneration, state *keybase1.TeamData) error {
	if needKeyGeneration == 0 {
		return nil
	}
	if state == nil {
		return fmt.Errorf("nil team does not contain key generation: %v", needKeyGeneration)
	}
	key, err := TeamSigChainState{inner: state.Chain}.GetLatestPerTeamKey()
	if err != nil {
		return err
	}
	if needKeyGeneration > key.Gen {
		return fmt.Errorf("team key generation too low: %v < %v", key.Gen, needKeyGeneration)
	}
	return nil
}

// Whether the snapshot has each of `wantMembers` as a member.
func (l *TeamLoader) satisfiesWantMembers(ctx context.Context,
	wantMembers []keybase1.UserVersion, wantMembersRole keybase1.TeamRole, state *keybase1.TeamData) error {

	if wantMembersRole == keybase1.TeamRole_NONE {
		// Default to writer.
		wantMembersRole = keybase1.TeamRole_WRITER
	}
	if len(wantMembers) == 0 {
		return nil
	}
	if state == nil {
		return fmt.Errorf("nil team does not have wanted members")
	}
	for _, uv := range wantMembers {
		role, err := TeamSigChainState{inner: state.Chain}.GetUserRole(uv)
		if err != nil {
			return fmt.Errorf("could not get wanted user role: %v", err)
		}
		if !role.IsOrAbove(wantMembersRole) {
			return fmt.Errorf("wanted user %v is a %v which is not at least %v", uv, role, wantMembersRole)
		}
	}
	return nil
}

func (l *TeamLoader) lookupMerkle(ctx context.Context, teamID keybase1.TeamID) (r1 keybase1.Seqno, r2 keybase1.LinkID, err error) {
	leaf, err := l.G().GetMerkleClient().LookupTeam(ctx, teamID)
	if err != nil {
		return r1, r2, err
	}
	if !leaf.TeamID.Eq(teamID) {
		return r1, r2, fmt.Errorf("merkle returned wrong leaf: %v != %v", leaf.TeamID.String(), teamID.String())
	}
	if leaf.Private == nil {
		return r1, r2, fmt.Errorf("merkle returned nil leaf")
	}
	return leaf.Private.Seqno, leaf.Private.LinkID.Export(), nil
}

func (l *TeamLoader) mungeWantMembers(ctx context.Context, wantMembers []keybase1.UserVersion) (res []keybase1.UserVersion, err error) {
	for _, uv1 := range wantMembers {
		uv2 := uv1
		if uv2.EldestSeqno == 0 {
			// Lookup the latest eldest seqno for that uid.
			// This value may come from a cache.
			upak, err := loadUPAK2(ctx, l.G(), uv2.Uid, false /*forcePoll */)
			if err != nil {
				return res, err
			}
			uv2.EldestSeqno = upak.Current.EldestSeqno
			l.G().Log.CDebugf(ctx, "TeamLoader resolved wantMember %v -> %v", uv2.Uid, uv2.EldestSeqno)
		}
		res = append(res, uv2)
	}
	return res, err
}

// Whether y is in xs.
func (l *TeamLoader) seqnosContains(xs []keybase1.Seqno, y keybase1.Seqno) bool {
	for _, x := range xs {
		if x.Eq(y) {
			return true
		}
	}
	return false
}

// Return the max in a list of positive seqnos. Returns 0 if the list is empty
func (l *TeamLoader) seqnosMax(seqnos []keybase1.Seqno) (ret keybase1.Seqno) {
	for _, x := range seqnos {
		if x > ret {
			ret = x
		}
	}
	return ret
}

// Whether a TeamData from the cache is fresh.
func (l *TeamLoader) isFresh(ctx context.Context, cachedAt keybase1.Time) bool {
	if cachedAt.IsZero() {
		// This should never happen.
		l.G().Log.CWarningf(ctx, "TeamLoader encountered zero cached time")
		return false
	}
	diff := l.G().Clock().Now().Sub(cachedAt.Time())
	fresh := (diff <= freshnessLimit)
	if !fresh {
		l.G().Log.CDebugf(ctx, "TeamLoader cached snapshot is old: %v", diff)
	}
	return fresh
}

func (l *TeamLoader) OnLogout() {
	l.storage.onLogout()
}

func (l *TeamLoader) VerifyTeamName(ctx context.Context, id keybase1.TeamID, name keybase1.TeamName) error {
	if name.IsRootTeam() {
		if !name.ToTeamID().Eq(id) {
			return NewResolveError(name, id)
		}
		return nil
	}
	teamData, err := l.Load(ctx, keybase1.LoadTeamArg{
		ID: id,
	})
	if err != nil {
		return err
	}
	gotName := teamData.Name
	if !gotName.Eq(name) {
		return NewResolveError(name, id)
	}
	return nil
}

func (l *TeamLoader) MapIDToName(ctx context.Context, id keybase1.TeamID) (keybase1.TeamName, error) {
	return keybase1.TeamName{}, nil
}

func (l *TeamLoader) NotifyTeamRename(ctx context.Context, id keybase1.TeamID, newName string) error {
	// ignore newName from the server

	// Load up the ancestor chain with ForceRepoll.
	// Then load down the ancestor chain without it (expect cache hits).
	// Not the most elegant way, but it will get the job done.
	// Each load on the way down will recalculate that team's name.

	var ancestorIDs []keybase1.TeamID

	me, err := l.getMe(ctx)
	if err != nil {
		return err
	}

	loopID := &id
	if loopID != nil {
		team, err := l.load2(ctx, load2ArgT{
			teamID:        *loopID,
			forceRepoll:   true,
			readSubteamID: &id,
			me:            me,
		})
		if err != nil {
			return err
		}
		ancestorIDs = append(ancestorIDs, *loopID)
		chain := TeamSigChainState{inner: team.Chain}
		if chain.IsSubteam() {
			loopID = chain.GetParentID()
		} else {
			loopID = nil
		}
	}

	// reverse ancestorIDs so the root team appears first
	sort.SliceStable(ancestorIDs, func(i, j int) bool { return i > j })

	for _, loopID := range ancestorIDs {
		_, err := l.load2(ctx, load2ArgT{
			teamID:        loopID,
			readSubteamID: &id,
			me:            me,
		})
		if err != nil {
			return err
		}
	}

	return nil
}
