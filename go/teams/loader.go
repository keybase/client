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
	world   LoaderContext
	storage *Storage
	// Single-flight locks per team ID.
	// (Private and public loads of the same ID will block each other, should be fine)
	locktab libkb.LockTable
}

var _ libkb.TeamLoader = (*TeamLoader)(nil)

func NewTeamLoader(g *libkb.GlobalContext, world LoaderContext, storage *Storage) *TeamLoader {
	return &TeamLoader{
		Contextified: libkb.NewContextified(g),
		world:        world,
		storage:      storage,
	}
}

// NewTeamLoaderAndInstall creates a new loader and installs it into G.
func NewTeamLoaderAndInstall(g *libkb.GlobalContext) *TeamLoader {
	world := NewLoaderContextFromG(g)
	st := NewStorage(g)
	l := NewTeamLoader(g, world, st)
	g.SetTeamLoader(l)
	return l
}

func (l *TeamLoader) Load(ctx context.Context, lArg keybase1.LoadTeamArg) (res *keybase1.TeamData, err error) {
	me, err := l.world.getMe(ctx)
	if err != nil {
		return nil, err
	}
	return l.load1(ctx, me, lArg)
}

func (l *TeamLoader) Delete(ctx context.Context, teamID keybase1.TeamID, public bool) (err error) {
	defer l.G().CTraceTimed(ctx, fmt.Sprintf("TeamLoader#Delete(%v,public:%v)", teamID, public), func() error { return err })()

	// Single-flight lock by team ID.
	lock := l.locktab.AcquireOnName(ctx, l.G(), teamID.String())
	defer lock.Release(ctx)

	return l.storage.Delete(ctx, teamID, public)
}

func (l *TeamLoader) DeleteBoth(ctx context.Context, teamID keybase1.TeamID) (err error) {
	defer l.G().CTraceTimed(ctx, fmt.Sprintf("TeamLoader#Delete(%v)", teamID), func() error { return err })()

	// Single-flight lock by team ID.
	lock := l.locktab.AcquireOnName(ctx, l.G(), teamID.String())
	defer lock.Release(ctx)

	return libkb.PickFirstError(
		l.storage.Delete(ctx, teamID, true),
		l.storage.Delete(ctx, teamID, false),
	)
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
		teamID, err = l.world.resolveNameToIDUntrusted(ctx, *teamName, lArg.Public)
		if err != nil {
			l.G().Log.CDebugf(ctx, "TeamLoader looking up team by name failed: %v -> %v", *teamName, err)
			return nil, err
		}
	}

	mungedForceRepoll := lArg.ForceRepoll
	mungedWantMembers, err := l.mungeWantMembers(ctx, lArg.Refreshers.WantMembers)
	if err != nil {
		l.G().Log.CDebugf(ctx, "TeamLoader munge failed: %v", err)
		// drop the error and just force a repoll.
		mungedForceRepoll = true
		mungedWantMembers = nil
	}

	ret, err := l.load2(ctx, load2ArgT{
		teamID: teamID,

		needAdmin:         lArg.NeedAdmin,
		needKeyGeneration: lArg.Refreshers.NeedKeyGeneration,
		wantMembers:       mungedWantMembers,
		wantMembersRole:   lArg.Refreshers.WantMembersRole,
		forceFullReload:   lArg.ForceFullReload,
		forceRepoll:       mungedForceRepoll,
		staleOK:           lArg.StaleOK,
		public:            lArg.Public,

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

	// Only public teams are allowed to be behind on secrets.
	// This is allowed because you can load a public team you're not in.
	if !l.hasSyncedSecrets(&ret.team) && !ret.team.Chain.Public {
		// this should not happen
		return nil, fmt.Errorf("team is missing secrets")
	}

	// Check team name on the way out
	// The snapshot may have already been written to cache, but that should be ok,
	// because the cache is keyed by ID.
	if teamName != nil {
		// (TODO: this won't work for renamed level 3 teams or above. There's work on this in miles/teamloader-names)
		if !teamName.Eq(ret.team.Name) {
			return nil, fmt.Errorf("team name mismatch: %v != %v", ret.team.Name, teamName.String())
		}
	}

	return &ret.team, nil
}

func (l *TeamLoader) checkArg(ctx context.Context, lArg keybase1.LoadTeamArg) error {
	hasID := lArg.ID.Exists()
	hasName := len(lArg.Name) > 0
	if hasID {
		_, err := keybase1.TeamIDFromString(lArg.ID.String())
		if err != nil {
			return fmt.Errorf("team load arg has invalid ID: %v", lArg.ID)
		}
	}
	if !hasID && !hasName {
		return fmt.Errorf("team load arg must have either ID or Name")
	}
	return nil
}

// Mostly the same as the public keybase.LoadTeamArg
// but only supports loading by ID, and has neededSeqnos.
type load2ArgT struct {
	teamID keybase1.TeamID

	reason string // optional tag for debugging why this load is happening

	needAdmin         bool
	needKeyGeneration keybase1.PerTeamKeyGeneration
	// wantMembers here is different from wantMembers on LoadTeamArg:
	// The EldestSeqno's should not be 0.
	wantMembers     []keybase1.UserVersion
	wantMembersRole keybase1.TeamRole
	forceFullReload bool
	forceRepoll     bool
	staleOK         bool
	public          bool

	needSeqnos []keybase1.Seqno
	// Non-nil if we are loading an ancestor for the greater purpose of
	// loading a subteam. This parameter helps the server figure out whether
	// to give us a subteam-reader version of the team.
	// If and only if this is set, load2 is allowed to return a secret-less TeamData.
	// Load1 should never ever return a secret-less TeamData.
	readSubteamID *keybase1.TeamID

	me keybase1.UserVersion
}

type load2ResT struct {
	team      keybase1.TeamData
	didRepoll bool
}

// Load2 does the rest of the work loading a team.
// It is `playchain` described in the pseudocode in teamplayer.txt
func (l *TeamLoader) load2(ctx context.Context, arg load2ArgT) (ret *load2ResT, err error) {
	ctx = libkb.WithLogTag(ctx, "LT") // Load Team
	traceLabel := fmt.Sprintf("TeamLoader#load2(%v, public:%v)", arg.teamID, arg.public)
	if len(arg.reason) > 0 {
		traceLabel = traceLabel + " '" + arg.reason + "'"
	}
	defer l.G().CTraceTimed(ctx, traceLabel, func() error { return err })()
	ret, err = l.load2Inner(ctx, arg)
	return ret, err
}

func (l *TeamLoader) load2Inner(ctx context.Context, arg load2ArgT) (*load2ResT, error) {
	var err error
	var didRepoll bool

	// Single-flight lock by team ID.
	lock := l.locktab.AcquireOnName(ctx, l.G(), arg.teamID.String())
	defer lock.Release(ctx)

	// Fetch from cache
	var ret *keybase1.TeamData
	if !arg.forceFullReload {
		// Load from cache
		ret = l.storage.Get(ctx, arg.teamID, arg.public)
	}

	if ret != nil && !ret.Chain.Reader.Eq(arg.me) {
		// Check that we are the same person as when this team was last loaded as a courtesy.
		// This should never happen. We shouldn't be able to decrypt someone else's snapshot.
		l.G().Log.CWarningf(ctx, "TeamLoader discarding snapshot for wrong user: (%v, %v) != (%v, %v)",
			arg.me.Uid, arg.me.EldestSeqno, ret.Chain.Reader.Uid, ret.Chain.Reader.EldestSeqno)
		ret = nil
	}

	var cachedName *keybase1.TeamName
	if ret != nil && !ret.Name.IsNil() {
		cachedName = &ret.Name
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
		lastSeqno, lastLinkID, err = l.world.merkleLookup(ctx, arg.teamID, arg.public)
		if err != nil {
			return nil, err
		}
		didRepoll = true
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

	proofSet := newProofSet(l.G())
	var parentChildOperations []*parentChildOperation

	// Backfill stubbed links that need to be filled now.
	if ret != nil && len(arg.needSeqnos) > 0 {
		ret, proofSet, parentChildOperations, err = l.fillInStubbedLinks(
			ctx, arg.me, arg.teamID, ret, arg.needSeqnos, readSubteamID, proofSet, parentChildOperations)
		if err != nil {
			return nil, err
		}
	}

	var fetchLinksAndOrSecrets bool
	if ret == nil {
		l.G().Log.CDebugf(ctx, "TeamLoader fetching: no cache")
		// We have no cache
		fetchLinksAndOrSecrets = true
	} else if ret.Chain.LastSeqno < lastSeqno {
		l.G().Log.CDebugf(ctx, "TeamLoader fetching: chain update")
		// The cache is definitely behind
		fetchLinksAndOrSecrets = true
	} else if !l.hasSyncedSecrets(ret) {
		// The cached secrets are behind the cached chain.
		// We may need to hit the server for secrets, even though there are no new links.

		if arg.needAdmin {
			l.G().Log.CDebugf(ctx, "TeamLoader fetching: NeedAdmin")
			// Admins should always have up-to-date secrets
			fetchLinksAndOrSecrets = true
		}
		if err := l.satisfiesNeedKeyGeneration(ctx, arg.needKeyGeneration, ret); err != nil {
			l.G().Log.CDebugf(ctx, "TeamLoader fetching: NeedKeyGeneration: %v", err)
			fetchLinksAndOrSecrets = true
		}
		if arg.readSubteamID == nil {
			// This is not a recursive load.
			// If we are in the team, we should have the keys.
			myCachedRole, err := TeamSigChainState{ret.Chain}.GetUserRole(arg.me)
			if err != nil {
				myCachedRole = keybase1.TeamRole_NONE
			}
			if myCachedRole.IsReaderOrAbove() {
				l.G().Log.CDebugf(ctx, "TeamLoader fetching: role: %v", myCachedRole)
				fetchLinksAndOrSecrets = true
			}
		}
	}

	// Pull new links from the server
	var teamUpdate *rawTeam
	if fetchLinksAndOrSecrets {
		lows := l.lows(ctx, ret)
		l.G().Log.CDebugf(ctx, "TeamLoader getting links from server (%+v)", lows)
		teamUpdate, err = l.world.getNewLinksFromServer(ctx, arg.teamID, arg.public, lows, arg.readSubteamID)
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
			return nil, NewPrevError("team replay failed: prev chain broken at link %d (%v != %v)",
				i, link.Prev(), prev)
		}

		var signer *signerX
		signer, err = l.verifyLink(ctx, arg.teamID, ret, arg.me, link, readSubteamID, proofSet)
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
		arg.me, arg.teamID, ret.Chain.ParentID, readSubteamID, parentChildOperations, proofSet)
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
		} else {
			// Add the secrets.
			// If it's a public team, there might not be secrets. (If we're not in the team)
			if !ret.Chain.Public || (teamUpdate.Box != nil) {
				ret, err = l.addSecrets(ctx, ret, arg.me, teamUpdate.Box, teamUpdate.Prevs, teamUpdate.ReaderKeyMasks)
				if err != nil {
					return nil, fmt.Errorf("loading team secrets: %v", err)
				}
			}
		}
	}

	// Make sure public works out
	if ret.Chain.Public != arg.public {
		return nil, fmt.Errorf("team public mismatch: %v != %v", ret.Chain.Public, arg.public)
	}

	// Sanity check the id
	if !ret.Chain.Id.Eq(arg.teamID) {
		return nil, fmt.Errorf("team id mismatch: %v != %v", ret.Chain.Id.String(), arg.teamID.String())
	}

	// Recalculate the team name.
	// This must always run to pick up changes on chain and off-chain with ancestor renames.
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

	l.logIfUnsyncedSecrets(ctx, ret)

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

	return &load2ResT{
		team:      *ret,
		didRepoll: didRepoll,
	}, nil
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

// Whether the user is an admin at the snapshot, and there are no stubbed links, and keys are up to date.
func (l *TeamLoader) satisfiesNeedAdmin(ctx context.Context, me keybase1.UserVersion, teamData *keybase1.TeamData) bool {
	if teamData == nil {
		return false
	}
	if (TeamSigChainState{inner: teamData.Chain}.HasAnyStubbedLinks()) {
		return false
	}
	if !l.hasSyncedSecrets(teamData) {
		return false
	}
	state := TeamSigChainState{inner: teamData.Chain}
	role, err := state.GetUserRole(me)
	if err != nil {
		l.G().Log.CDebugf(ctx, "TeamLoader error getting my role: %v", err)
		return false
	}
	if !role.IsAdminOrAbove() {
		if !state.IsSubteam() {
			return false
		}
		yes, err := l.isImplicitAdminOf(ctx, state.GetID(), state.GetParentID(), me, me)
		if err != nil {
			l.G().Log.CDebugf(ctx, "TeamLoader error getting checking implicit admin: %s", err)
			return false
		}
		if !yes {
			return false
		}
	}
	return true
}

// Check whether a user is an implicit admin of a team.
func (l *TeamLoader) isImplicitAdminOf(ctx context.Context, teamID keybase1.TeamID, ancestorID *keybase1.TeamID,
	me keybase1.UserVersion, uv keybase1.UserVersion) (bool, error) {

	// IDs of ancestors that were not freshly polled.
	// Check them again with forceRepoll if the affirmitive is not found cached.
	checkAgain := make(map[keybase1.TeamID]bool)

	check1 := func(chain *TeamSigChainState) bool {
		role, err := chain.GetUserRole(uv)
		if err != nil {
			return false
		}
		return role.IsAdminOrAbove()
	}

	i := 0
	for {
		i++
		if i >= 100 {
			// Break in case there's a bug in this loop.
			return false, fmt.Errorf("stuck in a loop while checking for implicit admin: %v", ancestorID)
		}

		// Use load2 so that we can use subteam-reader and get secretless teams.
		ancestor, err := l.load2(ctx, load2ArgT{
			teamID:        *ancestorID,
			reason:        "isImplicitAdminOf-1",
			me:            me,
			readSubteamID: &teamID,
		})
		if err != nil {
			return false, err
		}
		// Be wary, `ancestor` could be, and is likely, a secretless team.
		// Do not let it out of sight.
		ancestorChain := TeamSigChainState{inner: ancestor.team.Chain}

		if !ancestor.didRepoll {
			checkAgain[ancestorChain.GetID()] = true
		}

		if check1(&ancestorChain) {
			return true, nil
		}

		if !ancestorChain.IsSubteam() {
			break
		}
		// Get the next level up.
		ancestorID = ancestorChain.GetParentID()
	}

	// The answer was not found to be yes in the cache.
	// Try again with the teams that were not polled as they might have unseen updates.
	for ancestorID := range checkAgain {
		ancestor, err := l.load2(ctx, load2ArgT{
			teamID:        ancestorID,
			reason:        "isImplicitAdminOf-again",
			me:            me,
			forceRepoll:   true, // Get the latest info.
			readSubteamID: &teamID,
		})
		if err != nil {
			return false, err
		}
		// Be wary, `ancestor` could be, and is likely, a secretless team.
		// Do not let it out of sight.
		ancestorChain := TeamSigChainState{inner: ancestor.team.Chain}
		if check1(&ancestorChain) {
			return true, nil
		}
	}

	return false, nil
}

// Whether the snapshot has loaded at least up to the key generation and has the secret.
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
	_, ok := state.PerTeamKeySeeds[needKeyGeneration]
	if !ok {
		return fmt.Errorf("team key secret missing for generation: %v", needKeyGeneration)
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

func (l *TeamLoader) mungeWantMembers(ctx context.Context, wantMembers []keybase1.UserVersion) (res []keybase1.UserVersion, err error) {
	for _, uv1 := range wantMembers {
		uv2 := uv1
		if uv2.EldestSeqno == 0 {
			// Lookup the latest eldest seqno for that uid.
			// This value may come from a cache.
			uv2.EldestSeqno, err = l.world.lookupEldestSeqno(ctx, uv2.Uid)
			if err != nil {
				return res, err
			}
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

// Whether the teams secrets are synced to the same point as its sigchain
func (l *TeamLoader) hasSyncedSecrets(state *keybase1.TeamData) bool {
	onChainGen := keybase1.PerTeamKeyGeneration(len(state.Chain.PerTeamKeys))
	offChainGen := keybase1.PerTeamKeyGeneration(len(state.PerTeamKeySeeds))
	return onChainGen == offChainGen
}

func (l *TeamLoader) logIfUnsyncedSecrets(ctx context.Context, state *keybase1.TeamData) {
	onChainGen := keybase1.PerTeamKeyGeneration(len(state.Chain.PerTeamKeys))
	offChainGen := keybase1.PerTeamKeyGeneration(len(state.PerTeamKeySeeds))
	if onChainGen != offChainGen {
		l.G().Log.CDebugf(ctx, "TeamLoader unsynced secrets local:%v != chain:%v ", offChainGen, onChainGen)
	}
}

func (l *TeamLoader) lows(ctx context.Context, state *keybase1.TeamData) getLinksLows {
	var lows getLinksLows
	if state != nil {
		chain := TeamSigChainState{inner: state.Chain}
		lows.Seqno = chain.GetLatestSeqno()
		lows.PerTeamKey = keybase1.PerTeamKeyGeneration(len(state.PerTeamKeySeeds))
		// Use an arbitrary application to get the number of known RKMs.
		rkms, ok := state.ReaderKeyMasks[keybase1.TeamApplication_CHAT]
		if ok {
			lows.ReaderKeyMask = keybase1.PerTeamKeyGeneration(len(rkms))
		}
	}
	return lows
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

// List all the admins of ancestor teams.
// Includes admins of the specified team only if they are also admins of ancestor teams.
// The specified team must be a subteam, or an error is returned.
// Always sends a flurry of RPCs to get the most up to date info.
func (l *TeamLoader) ImplicitAdmins(ctx context.Context, teamID keybase1.TeamID) (impAdmins []keybase1.UserVersion, err error) {
	me, err := l.world.getMe(ctx)
	if err != nil {
		return nil, err
	}

	// Load the argument team
	team, err := l.load1(ctx, me, keybase1.LoadTeamArg{
		ID:      teamID,
		StaleOK: true, // We only use immutable fields.
	})
	if err != nil {
		return nil, err
	}
	teamChain := TeamSigChainState{inner: team.Chain}
	if !teamChain.IsSubteam() {
		return nil, fmt.Errorf("cannot get implicit admins of a root team: %v", teamID)
	}

	return l.implicitAdminsAncestor(ctx, teamID, teamChain.GetParentID())
}

func (l *TeamLoader) implicitAdminsAncestor(ctx context.Context, teamID keybase1.TeamID, ancestorID *keybase1.TeamID) ([]keybase1.UserVersion, error) {
	me, err := l.world.getMe(ctx)
	if err != nil {
		return nil, err
	}

	impAdminsMap := make(map[string]keybase1.UserVersion) // map to remove dups

	i := 0
	for {
		i++
		if i >= 100 {
			// Break in case there's a bug in this loop.
			return nil, fmt.Errorf("stuck in a loop while getting implicit admins: %v", ancestorID)
		}

		// Use load2 so that we can use subteam-reader and get secretless teams.
		ancestor, err := l.load2(ctx, load2ArgT{
			teamID:        *ancestorID,
			reason:        "implicitAdminsAncestor",
			me:            me,
			forceRepoll:   true, // Get the latest info.
			readSubteamID: &teamID,
		})
		if err != nil {
			return nil, err
		}
		// Be wary, `ancestor` could be, and is likely, a secretless team.
		// Do not let it out of sight.
		ancestorChain := TeamSigChainState{inner: ancestor.team.Chain}

		// Gather the admins.
		adminRoles := []keybase1.TeamRole{keybase1.TeamRole_OWNER, keybase1.TeamRole_ADMIN}
		for _, role := range adminRoles {
			uvs, err := ancestorChain.GetUsersWithRole(role)
			if err != nil {
				return nil, err
			}
			for _, uv := range uvs {
				impAdminsMap[uv.String()] = uv
			}
		}

		if !ancestorChain.IsSubteam() {
			break
		}
		// Get the next level up.
		ancestorID = ancestorChain.GetParentID()
	}

	var impAdmins []keybase1.UserVersion
	for _, uv := range impAdminsMap {
		impAdmins = append(impAdmins, uv)
	}

	return impAdmins, nil
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

	me, err := l.world.getMe(ctx)
	if err != nil {
		return err
	}

	loopID := &id
	for loopID != nil {
		load2Res, err := l.load2(ctx, load2ArgT{
			teamID:        *loopID,
			reason:        "NotifyTeamRename-force",
			forceRepoll:   true,
			readSubteamID: &id,
			me:            me,
		})
		if err != nil {
			return err
		}
		ancestorIDs = append(ancestorIDs, *loopID)
		chain := TeamSigChainState{inner: load2Res.team.Chain}
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
			reason:        "NotifyTeamRename-quick",
			readSubteamID: &id,
			me:            me,
		})
		if err != nil {
			return err
		}
	}

	return nil
}
