package teams

import (
	"errors"
	"fmt"
	"os"
	"sort"
	"sync"
	"time"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/gregor"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

// Show detailed team profiling
var teamEnv struct {
	Profile             bool
	UserPreloadEnable   bool
	UserPreloadParallel bool
	UserPreloadWait     bool
	ProofSetParallel    bool
}

func init() {
	teamEnv.Profile = os.Getenv("KEYBASE_TEAM_PROF") == "1"
	teamEnv.UserPreloadEnable = os.Getenv("KEYBASE_TEAM_PE") == "1"
	teamEnv.UserPreloadParallel = os.Getenv("KEYBASE_TEAM_PP") == "1"
	teamEnv.UserPreloadWait = os.Getenv("KEYBASE_TEAM_PW") == "1"
	teamEnv.ProofSetParallel = os.Getenv("KEYBASE_TEAM_SP") == "0"
}

// How long until the tail of a team sigchain is considered non-fresh
const freshnessLimit = time.Duration(1) * time.Hour

// Load a Team from the TeamLoader.
// Can be called from inside the teams package.
func Load(ctx context.Context, g *libkb.GlobalContext, lArg keybase1.LoadTeamArg) (*Team, error) {
	teamData, err := g.GetTeamLoader().Load(ctx, lArg)
	if err != nil {
		return nil, err
	}
	ret := NewTeam(ctx, g, teamData)

	if lArg.RefreshUIDMapper {
		// If we just loaded the group, then inform the UIDMapper of any UID->EldestSeqno
		// mappings, so that we're guaranteed they aren't stale.
		ret.refreshUIDMapper(ctx, g)
	}

	return ret, nil
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

	// Cache lookups of team name -> ID for a few seconds, to absorb bursts of lookups
	// from the frontend
	nameLookupBurstCache *libkb.BurstCache

	// We can get pushed by the server into "force repoll" mode, in which we're
	// not getting cache invalidations. An example: when Coyne or Nojima revokes
	// a device. We want to cut down on notification spam. So instead, all attempts
	// to load a team result in a preliminary poll for freshness, which this state is enabled.
	forceRepollMutex sync.RWMutex
	forceRepollUntil gregor.TimeOrOffset
}

var _ libkb.TeamLoader = (*TeamLoader)(nil)

func NewTeamLoader(g *libkb.GlobalContext, world LoaderContext, storage *Storage) *TeamLoader {
	return &TeamLoader{
		Contextified:         libkb.NewContextified(g),
		world:                world,
		storage:              storage,
		nameLookupBurstCache: libkb.NewBurstCache(g, 100, 10*time.Second, "SubteamNameToID"),
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
	if me.IsNil() && !lArg.Public {
		return nil, libkb.NewLoginRequiredError("login required to load a private team")
	}
	return l.load1(ctx, me, lArg)
}

func (l *TeamLoader) Delete(ctx context.Context, teamID keybase1.TeamID) (err error) {
	defer l.G().CTraceTimed(ctx, fmt.Sprintf("TeamLoader#Delete(%v)", teamID), func() error { return err })()

	// Single-flight lock by team ID.
	lock := l.locktab.AcquireOnName(ctx, l.G(), teamID.String())
	defer lock.Release(ctx)

	return l.storage.Delete(libkb.NewMetaContext(ctx, l.G()), teamID, teamID.IsPublic())
}

func (l *TeamLoader) HintLatestSeqno(ctx context.Context, teamID keybase1.TeamID, seqno keybase1.Seqno) error {
	// Single-flight lock by team ID.
	lock := l.locktab.AcquireOnName(ctx, l.G(), teamID.String())
	defer lock.Release(ctx)
	mctx := libkb.NewMetaContext(ctx, l.G())

	// Load from the cache
	td := l.storage.Get(mctx, teamID, teamID.IsPublic())
	if td == nil {
		// Nothing to store the hint on.
		return nil
	}

	if seqno < td.LatestSeqnoHint {
		// The hint is behind the times, ignore.
		return nil
	}

	td.LatestSeqnoHint = seqno
	l.storage.Put(mctx, td)
	return nil
}

type nameLookupBurstCacheKey struct {
	teamName keybase1.TeamName
	public   bool
}

func (n nameLookupBurstCacheKey) String() string {
	return fmt.Sprintf("%s:%v", n.teamName.String(), n.public)
}

// Resolve a team name to a team ID.
// Will always hit the server for subteams. The server can lie in this return value.
func (l *TeamLoader) ResolveNameToIDUntrusted(ctx context.Context, teamName keybase1.TeamName, public bool, allowCache bool) (id keybase1.TeamID, err error) {

	defer l.G().CVTrace(ctx, libkb.VLog0, fmt.Sprintf("resolveNameToUIDUntrusted(%s,%v,%v)", teamName.String(), public, allowCache), func() error { return err })()

	// For root team names, just hash.
	if teamName.IsRootTeam() {
		return teamName.ToTeamID(public), nil
	}

	if !allowCache {
		return resolveNameToIDUntrustedAPICall(ctx, l.G(), teamName, public)
	}

	var idVoidPointer interface{}
	key := nameLookupBurstCacheKey{teamName, public}
	idVoidPointer, err = l.nameLookupBurstCache.Load(ctx, key, l.makeNameLookupBurstCacheLoader(ctx, l.G(), key))
	if err != nil {
		return keybase1.TeamID(""), err
	}
	if idPointer, ok := idVoidPointer.(*keybase1.TeamID); ok && idPointer != nil {
		id = *idPointer
	} else {
		return keybase1.TeamID(""), errors.New("bad cast out of nameLookupBurstCache")
	}
	return id, nil
}

func resolveNameToIDUntrustedAPICall(ctx context.Context, g *libkb.GlobalContext, teamName keybase1.TeamName, public bool) (id keybase1.TeamID, err error) {
	arg := libkb.NewAPIArgWithNetContext(ctx, "team/get")
	arg.SessionType = libkb.APISessionTypeREQUIRED
	arg.Args = libkb.HTTPArgs{
		"name":        libkb.S{Val: teamName.String()},
		"lookup_only": libkb.B{Val: true},
		"public":      libkb.B{Val: public},
	}

	var rt rawTeam
	if err := g.API.GetDecode(arg, &rt); err != nil {
		return id, err
	}
	id = rt.ID
	if !id.Exists() {
		return id, fmt.Errorf("could not resolve team name: %v", teamName.String())
	}
	return id, nil
}

func (l *TeamLoader) makeNameLookupBurstCacheLoader(ctx context.Context, g *libkb.GlobalContext, key nameLookupBurstCacheKey) libkb.BurstCacheLoader {
	return func() (obj interface{}, err error) {
		id, err := resolveNameToIDUntrustedAPICall(ctx, g, key.teamName, key.public)
		if err != nil {
			return nil, err
		}
		return &id, nil
	}
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
		teamID, err = l.ResolveNameToIDUntrusted(ctx, *teamName, lArg.Public, lArg.AllowNameLookupBurstCache)
		if err != nil {
			l.G().Log.CDebugf(ctx, "TeamLoader looking up team by name failed: %v -> %v", *teamName, err)
			if code, ok := libkb.GetAppStatusCode(err); ok && code == keybase1.StatusCode_SCTeamNotFound {
				l.G().Log.CDebugf(ctx, "replacing error: %v", err)
				return nil, NewTeamDoesNotExistError(lArg.Public, teamName.String())
			}
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

		needAdmin:                             lArg.NeedAdmin,
		needKeyGeneration:                     lArg.Refreshers.NeedKeyGeneration,
		needApplicationsAtGenerations:         lArg.Refreshers.NeedApplicationsAtGenerations,
		needApplicationsAtGenerationsWithKBFS: lArg.Refreshers.NeedApplicationsAtGenerationsWithKBFS,
		needKBFSKeyGeneration:                 lArg.Refreshers.NeedKBFSKeyGeneration,
		wantMembers:                           mungedWantMembers,
		wantMembersRole:                       lArg.Refreshers.WantMembersRole,
		forceFullReload:                       lArg.ForceFullReload,
		forceRepoll:                           mungedForceRepoll,
		staleOK:                               lArg.StaleOK,
		public:                                lArg.Public,

		needSeqnos:    nil,
		readSubteamID: nil,

		me: me,
	})
	switch err := err.(type) {
	case TeamDoesNotExistError:
		if teamName == nil {
			return nil, err
		}
		// Replace the not found error so that it has a name instead of team ID.
		// If subteams are involved the name might not correspond to the ID
		// but it's better to have this understandable error message that's accurate
		// most of the time than one with an ID that's always accurate.
		l.G().Log.CDebugf(ctx, "replacing error: %v", err)
		return nil, NewTeamDoesNotExistError(lArg.Public, teamName.String())
	case nil:
	default:
		return nil, err
	}
	if ret == nil {
		return nil, fmt.Errorf("team loader fault: got nil from load2")
	}

	// Only public teams are allowed to be behind on secrets.
	// This is allowed because you can load a public team you're not in.
	if !l.hasSyncedSecrets(&ret.team) && !ret.team.Chain.Public {
		// this should not happen
		return nil, fmt.Errorf("missing secrets for team")
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
		id, err := keybase1.TeamIDFromString(lArg.ID.String())
		if err != nil {
			return fmt.Errorf("team load arg has invalid ID: %v", lArg.ID)
		}
		if id.IsPublic() != lArg.Public {
			return libkb.NewTeamVisibilityError(lArg.Public, id.IsPublic())
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

	needAdmin                             bool
	needKeyGeneration                     keybase1.PerTeamKeyGeneration
	needApplicationsAtGenerations         map[keybase1.PerTeamKeyGeneration][]keybase1.TeamApplication
	needApplicationsAtGenerationsWithKBFS map[keybase1.PerTeamKeyGeneration][]keybase1.TeamApplication
	needKBFSKeyGeneration                 keybase1.TeamKBFSKeyRefresher
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

	// If the user is logged out, this will be a nil UserVersion, meaning
	/// me.IsNil() will be true.
	me keybase1.UserVersion
}

type load2ResT struct {
	team      keybase1.TeamData
	didRepoll bool
}

// Load2 does the rest of the work loading a team.
// It is `playchain` described in the pseudocode in teamplayer.txt
func (l *TeamLoader) load2(ctx context.Context, arg load2ArgT) (ret *load2ResT, err error) {
	ctx = libkb.WithLogTag(ctx, "LT") // Load team
	if arg.reason != "" {
		ctx = libkb.WithLogTag(ctx, "LT2") // Load team recursive
	}
	traceLabel := fmt.Sprintf("TeamLoader#load2(%v, public:%v)", arg.teamID, arg.public)
	if len(arg.reason) > 0 {
		traceLabel = traceLabel + " '" + arg.reason + "'"
	}

	defer l.G().CTraceTimed(ctx, traceLabel, func() error { return err })()
	ret, err = l.load2Inner(ctx, arg)
	return ret, err
}

func (l *TeamLoader) load2Inner(ctx context.Context, arg load2ArgT) (*load2ResT, error) {

	// Single-flight lock by team ID.
	lock := l.locktab.AcquireOnName(ctx, l.G(), arg.teamID.String())
	defer lock.Release(ctx)

	return l.load2InnerLocked(ctx, arg)
}

func (l *TeamLoader) load2InnerLocked(ctx context.Context, arg load2ArgT) (res *load2ResT, err error) {
	const nRetries = 3
	for i := 0; i < nRetries; i++ {
		res, err = l.load2InnerLockedRetry(ctx, arg)
		switch err.(type) {
		case nil:
			return res, nil
		case ProofError:
			if arg.forceRepoll {
				return res, err
			}
			// Something went wrong, throw out the cache and try again.
			l.G().Log.CDebugf(ctx, "Got proof error (%s); trying again with forceRepoll=true", err.Error())
			arg.forceRepoll = true
			arg.forceFullReload = true
			origErr := err
			res, err = l.load2InnerLockedRetry(ctx, arg)
			if err == nil {
				l.G().Log.CDebugf(ctx, "Found an unexpected TeamLoader case in which busting the cache saved the day (original error was: %s)", origErr.Error())
			}
			return res, err
		case GreenLinkError:
			// Try again
			l.G().Log.CDebugf(ctx, "TeamLoader retrying after green link")
			arg.forceRepoll = true
			continue
		}
		return res, err
	}
	if err == nil {
		// Should never happen
		return res, fmt.Errorf("failed retryable team load")
	}
	// Return the last error
	return res, err
}

func (l *TeamLoader) load2InnerLockedRetry(ctx context.Context, arg load2ArgT) (*load2ResT, error) {
	ctx, tbs := l.G().CTimeBuckets(ctx)
	tracer := l.G().CTimeTracer(ctx, "TeamLoader.load2ILR", teamEnv.Profile)
	defer tracer.Finish()
	mctx := libkb.NewMetaContext(ctx, l.G())

	defer tbs.LogIfNonZero(ctx, "API.request")

	var err error
	var didRepoll bool
	lkc := newLoadKeyCache()

	// Fetch from cache
	tracer.Stage("cache load")
	var ret *keybase1.TeamData
	if !arg.forceFullReload {
		// Load from cache
		ret = l.storage.Get(mctx, arg.teamID, arg.public)
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

	tracer.Stage("deepcopy")
	if ret != nil {
		// If we're pulling from a previous snapshot (that, let's say, we got from a shared cache),
		// then make sure to DeepCopy() data out of it before we start mutating it below. We used
		// to do this every step through the new links, but that was very expensive in terms of CPU
		// for big teams, since it was hidden quadratic behavior.
		tmp := ret.DeepCopy()
		ret = &tmp
	} else {
		l.G().Log.CDebugf(ctx, "TeamLoader not using snapshot")
	}

	tracer.Stage("merkle")
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
	tracer.Stage("backfill")
	if ret != nil && len(arg.needSeqnos) > 0 {
		ret, proofSet, parentChildOperations, err = l.fillInStubbedLinks(
			ctx, arg.me, arg.teamID, ret, arg.needSeqnos, readSubteamID, proofSet, parentChildOperations, lkc)
		if err != nil {
			return nil, err
		}
	}

	tracer.Stage("pre-fetch")
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
		if err := l.satisfiesNeedApplicationsAtGenerations(ctx, arg.needApplicationsAtGenerations, ret); err != nil {
			l.G().Log.CDebugf(ctx, "TeamLoader fetching: NeedApplicationsAtGenerations: %v", err)
			fetchLinksAndOrSecrets = true
		}
		if err := l.satisfiesNeedsKBFSKeyGeneration(ctx, arg.needKBFSKeyGeneration, ret); err != nil {
			l.G().Log.CDebugf(ctx, "TeamLoader fetching: KBFSNeedKeyGeneration: %v", err)
			fetchLinksAndOrSecrets = true
		}
		if err := l.satisfiesNeedApplicationsAtGenerationsWithKBFS(ctx,
			arg.needApplicationsAtGenerationsWithKBFS, ret); err != nil {
			l.G().Log.CDebugf(ctx, "TeamLoader fetching: NeedApplicationsAtGenerationsWithKBFS: %v", err)
			fetchLinksAndOrSecrets = true
		}
		if arg.readSubteamID == nil {
			// This is not a recursive load. We should have the keys.
			// This may be an extra round trip for public teams you're not in.
			l.G().Log.CDebugf(ctx, "TeamLoader fetching: primary load")
			fetchLinksAndOrSecrets = true
		}
	}
	// hasSyncedSecrets does not account for RKMs so we verify it separately.
	if err := l.satisfiesNeedKeyGeneration(ctx, arg.needKeyGeneration, ret); err != nil {
		l.G().Log.CDebugf(ctx, "TeamLoader fetching: NeedKeyGeneration: %v", err)
		fetchLinksAndOrSecrets = true
	}

	// Pull new links from the server
	tracer.Stage("fetch")
	var teamUpdate *rawTeam
	if fetchLinksAndOrSecrets {
		lows := l.lows(ctx, ret)
		l.G().Log.CDebugf(ctx, "TeamLoader getting links from server (%+v)", lows)
		teamUpdate, err = l.world.getNewLinksFromServer(ctx, arg.teamID, lows, arg.readSubteamID)
		if err != nil {
			return nil, err
		}
		l.G().Log.CDebugf(ctx, "TeamLoader got %v links", len(teamUpdate.Chain))
	}

	tracer.Stage("unpack")
	links, err := teamUpdate.unpackLinks(ctx)
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

	// A link which was signed by an admin. Sloppily the latest such link.
	// Sloppy because this calculation misses out on e.g. a rotate_key signed by an admin.
	// This value is used for skipping fullVerify on team.leave links, see `verifyLink`.
	var fullVerifyCutoff keybase1.Seqno
	for i := len(links) - 1; i >= 0; i-- {
		if links[i].LinkType().RequiresAtLeastRole().IsAdminOrAbove() {
			fullVerifyCutoff = links[i].Seqno()
			break
		}
	}
	if fullVerifyCutoff > 0 {
		l.G().Log.CDebugf(ctx, "fullVerifyCutoff: %v", fullVerifyCutoff)
	}

	tracer.Stage("userPreload enable:%v parallel:%v wait:%v",
		teamEnv.UserPreloadEnable, teamEnv.UserPreloadParallel, teamEnv.UserPreloadWait)
	preloadCancel := l.userPreload(ctx, links, fullVerifyCutoff)
	defer preloadCancel()

	tracer.Stage("linkloop (%v)", len(links))
	parentsCache := make(parentChainCache)

	// Don't log in the middle links if there are a great many links.
	suppressLoggingStart := 5
	suppressLoggingUpto := len(links) - 5
	for i, link := range links {
		ctx := ctx // Shadow for log suppression scope
		if suppressLoggingStart <= i && i < suppressLoggingUpto {
			if i == suppressLoggingStart {
				l.G().Log.CDebugf(ctx, "TeamLoader suppressing logs until %v", suppressLoggingUpto)
			}
			ctx = WithSuppressLogging(ctx, true)
		}
		if !ShouldSuppressLogging(ctx) {
			l.G().Log.CDebugf(ctx, "TeamLoader processing link seqno:%v", link.Seqno())
		}

		if link.Seqno() > lastSeqno {
			// This link came from a point in the chain after when we checked the merkle leaf.
			// Processing it would require re-checking merkle.
			// It would be tricky to ignore it because off-chain data is asserted to be in sync with the chain.
			// So, return an error that the caller will retry.
			l.G().Log.CDebugf(ctx, "TeamLoader found green link seqno:%v", link.Seqno())
			return nil, NewGreenLinkError(link.Seqno())
		}

		if err := l.checkStubbed(ctx, arg, link); err != nil {
			return nil, err
		}

		if !link.Prev().Eq(prev) {
			return nil, NewPrevError("team replay failed: prev chain broken at link %d (%v != %v)",
				i, link.Prev(), prev)
		}

		var signer *SignerX
		signer, err = l.verifyLink(ctx, arg.teamID, ret, arg.me, link, fullVerifyCutoff,
			readSubteamID, proofSet, lkc, parentsCache)
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
	preloadCancel()
	if len(links) > 0 {
		tbs.Log(ctx, "TeamLoader.verifyLink")
		tbs.Log(ctx, "TeamLoader.applyNewLink")
		tbs.Log(ctx, "SigChain.LoadFromServer.ReadAll")
		tbs.Log(ctx, "loadKeyCache.loadKeyV2")
		if teamEnv.Profile {
			tbs.Log(ctx, "LoaderContextG.loadKeyV2")
			tbs.Log(ctx, "CachedUPAKLoader.LoadKeyV2") // note LoadKeyV2 calls Load2
			tbs.Log(ctx, "CachedUPAKLoader.LoadV2")
			tbs.Log(ctx, "CachedUPAKLoader.DeepCopy")
			l.G().Log.CDebugf(ctx, "TeamLoader lkc cache hits: %v", lkc.cacheHits)
		}
	}

	if ret == nil {
		return nil, fmt.Errorf("team loader fault: got nil from load2")
	}

	if !ret.Chain.LastLinkID.Eq(lastLinkID) {
		return nil, fmt.Errorf("wrong sigchain link ID: %v != %v",
			ret.Chain.LastLinkID, lastLinkID)
	}

	tracer.Stage("pco")
	err = l.checkParentChildOperations(ctx,
		arg.me, arg.teamID, ret.Chain.ParentID, readSubteamID, parentChildOperations, proofSet)
	if err != nil {
		return nil, err
	}

	tracer.Stage("checkproofs")
	err = l.checkProofs(ctx, ret, proofSet)
	if err != nil {
		return nil, err
	}

	tracer.Stage("secrets")
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
				err = l.addSecrets(ctx, ret, arg.me, teamUpdate.Box, teamUpdate.Prevs, teamUpdate.ReaderKeyMasks)
				if err != nil {
					return nil, fmt.Errorf("loading team secrets: %v", err)
				}

				if teamUpdate.LegacyTLFUpgrade != nil {
					err = l.addKBFSCryptKeys(ctx, ret, teamUpdate.LegacyTLFUpgrade)
					if err != nil {
						return nil, fmt.Errorf("loading KBFS crypt keys: %v", err)
					}
				}
			}
		}
	}

	// Make sure public works out
	if ret.Chain.Public != arg.public {
		return nil, fmt.Errorf("team public mismatch: chain:%v != arg:%v", ret.Chain.Public, arg.public)
	}
	if ret.Chain.Id.IsPublic() != ret.Chain.Public {
		return nil, fmt.Errorf("team public mismatch: id:%v != chain:%v", ret.Chain.Id.IsPublic(), ret.Chain.Public)
	}

	// Sanity check the id
	if !ret.Chain.Id.Eq(arg.teamID) {
		return nil, fmt.Errorf("team id mismatch: %v != %v", ret.Chain.Id.String(), arg.teamID.String())
	}

	// Recalculate the team name.
	// This must always run to pick up changes on chain and off-chain with ancestor renames.
	// Also because without this a subteam could claim any parent in its name.
	tracer.Stage("namecalc")
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

	// Mutating this field is safe because only TeamLoader
	// while holding the single-flight lock reads or writes this field.
	ret.CachedAt = keybase1.ToTime(l.G().Clock().Now())

	// Clear the untrusted seqno hint.
	// Mutating this field is safe because only TeamLoader
	// while holding the single-flight lock reads or writes this field.
	ret.LatestSeqnoHint = 0

	tracer.Stage("audit")
	err = l.audit(ctx, readSubteamID, &ret.Chain)
	if err != nil {
		return nil, err
	}

	// Cache the validated result
	tracer.Stage("put")
	l.storage.Put(mctx, ret)

	tracer.Stage("notify")
	if cachedName != nil && !cachedName.Eq(newName) {
		chain := TeamSigChainState{inner: ret.Chain}
		// Send a notification if we used to have the name cached and it has changed at all.
		changeSet := keybase1.TeamChangeSet{Renamed: true}
		go l.G().NotifyRouter.HandleTeamChangedByID(context.Background(),
			chain.GetID(), chain.GetLatestSeqno(), chain.IsImplicit(), changeSet)
		go l.G().NotifyRouter.HandleTeamChangedByName(context.Background(),
			cachedName.String(), chain.GetLatestSeqno(), chain.IsImplicit(), changeSet)
		go l.G().NotifyRouter.HandleTeamChangedByName(context.Background(),
			newName.String(), chain.GetLatestSeqno(), chain.IsImplicit(), changeSet)
	}

	// Check request constraints
	tracer.Stage("postcheck")
	err = l.load2CheckReturn(ctx, arg, ret)
	if err != nil {
		return nil, err
	}

	return &load2ResT{
		team:      *ret,
		didRepoll: didRepoll,
	}, nil
}

// userPreload warms the upak cache with users who will probably need to be loaded to verify the chain.
// Uses teamEnv and may be disabled.
func (l *TeamLoader) userPreload(ctx context.Context, links []*ChainLinkUnpacked, fullVerifyCutoff keybase1.Seqno) (cancel func()) {
	ctx, cancel = context.WithCancel(ctx)
	if teamEnv.UserPreloadEnable {
		uidSet := make(map[keybase1.UID]struct{})
		for _, link := range links {
			// fullVerify definition copied from verifyLink
			fullVerify := (link.LinkType() != libkb.SigchainV2TypeTeamLeave) ||
				(link.Seqno() >= fullVerifyCutoff) ||
				(link.source.EldestSeqno == 0)
			if !link.isStubbed() && fullVerify {
				uidSet[link.inner.Body.Key.UID] = struct{}{}
			}
		}
		l.G().Log.CDebugf(ctx, "TeamLoader userPreload uids: %v", len(uidSet))
		if teamEnv.UserPreloadParallel {
			// Note this is full-parallel. Probably want pipelining if this is to be turned on by default.
			var wg sync.WaitGroup
			for uid := range uidSet {
				wg.Add(1)
				go func(uid keybase1.UID) {
					_, _, err := l.G().GetUPAKLoader().LoadV2(
						libkb.NewLoadUserArg(l.G()).WithUID(uid).WithPublicKeyOptional().WithNetContext(ctx))
					if err != nil {
						l.G().Log.CDebugf(ctx, "error preloading uid %v", uid)
					}
					wg.Done()
				}(uid)
			}
			if teamEnv.UserPreloadWait {
				wg.Wait()
			}
		} else {
			for uid := range uidSet {
				_, _, err := l.G().GetUPAKLoader().LoadV2(
					libkb.NewLoadUserArg(l.G()).WithUID(uid).WithPublicKeyOptional().WithNetContext(ctx))
				if err != nil {
					l.G().Log.CDebugf(ctx, "error preloading uid %v", uid)
				}
			}
		}
	}
	return cancel
}

// Decide whether to repoll merkle based on load arg.
// Returns (discardCache, repoll)
// If discardCache is true, the caller should throw out their cached copy and repoll.
// Considers:
// - NeedAdmin
// - NeedKeyGeneration
// - NeedApplicationsAtGenerations
// - WantMembers
// - ForceRepoll
// - Cache freshness / StaleOK
// - NeedSeqnos
// - If this user is in global "force repoll" mode, where it would be too spammy to
//   push out individual team changed notifications, so all team loads need a repoll.
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

	// Repoll if the server has previously hinted that the team has new links.
	if fromCache != nil && fromCache.Chain.LastSeqno < fromCache.LatestSeqnoHint {
		repoll = true
	}

	// Repoll to get a new key generation
	if arg.needKeyGeneration > 0 {
		if l.satisfiesNeedKeyGeneration(ctx, arg.needKeyGeneration, fromCache) != nil {
			repoll = true
		}
	}
	// Repoll to get new applications at generations
	if len(arg.needApplicationsAtGenerations) > 0 {
		if l.satisfiesNeedApplicationsAtGenerations(ctx, arg.needApplicationsAtGenerations, fromCache) != nil {
			repoll = true
		}
	}
	if arg.needKBFSKeyGeneration.Generation > 0 {
		if l.satisfiesNeedsKBFSKeyGeneration(ctx, arg.needKBFSKeyGeneration, fromCache) != nil {
			repoll = true
		}
	}

	if len(arg.needApplicationsAtGenerationsWithKBFS) > 0 {
		if l.satisfiesNeedApplicationsAtGenerationsWithKBFS(ctx,
			arg.needApplicationsAtGenerationsWithKBFS, fromCache) != nil {
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

	// InForceRepoll needs to a acquire a lock, so avoid it if we can
	// (i.e., if repoll is already set to true).
	if !repoll && l.InForceRepollMode(ctx) {
		repoll = true
	}

	return false, repoll
}

// Check whether the load produced a snapshot that can be returned to the caller.
// This should not check anything that is critical to the validity of the snapshot
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
		if err := l.satisfiesNeedKeyGeneration(ctx, arg.needKeyGeneration, res); err != nil {
			return err
		}
	}
	if len(arg.needApplicationsAtGenerations) > 0 {
		if err := l.satisfiesNeedApplicationsAtGenerations(ctx, arg.needApplicationsAtGenerations, res); err != nil {
			return err
		}
	}
	if arg.needKBFSKeyGeneration.Generation > 0 {
		if err := l.satisfiesNeedsKBFSKeyGeneration(ctx, arg.needKBFSKeyGeneration, res); err != nil {
			return err
		}
	}
	if len(arg.needApplicationsAtGenerationsWithKBFS) > 0 {
		if err := l.satisfiesNeedApplicationsAtGenerationsWithKBFS(ctx, arg.needApplicationsAtGenerationsWithKBFS, res); err != nil {
			return err
		}
	}

	if len(arg.needSeqnos) > 0 {
		if err := l.checkNeededSeqnos(ctx, res, arg.needSeqnos); err != nil {
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
	// Check them again with forceRepoll if the affirmative is not found cached.
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

func (l *TeamLoader) satisfiesNeedsKBFSKeyGeneration(ctx context.Context,
	kbfs keybase1.TeamKBFSKeyRefresher, state *keybase1.TeamData) error {
	if kbfs.Generation == 0 {
		return nil
	}
	if state == nil {
		return fmt.Errorf("nil team does not contain KBFS key generation: %#v", kbfs)
	}

	gen, err := TeamSigChainState{inner: state.Chain}.GetLatestKBFSGeneration(kbfs.AppType)
	if err != nil {
		return err
	}
	if kbfs.Generation > gen {
		return fmt.Errorf("KBFS key generation too low: %v < %v", gen, kbfs.Generation)
	}
	return nil
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
	_, ok := state.PerTeamKeySeedsUnverified[needKeyGeneration]
	if !ok {
		return fmt.Errorf("team key secret missing for generation: %v", needKeyGeneration)
	}
	return nil
}

// Whether the snapshot has loaded the reader key masks and key generations we
// need.
func (l *TeamLoader) satisfiesNeedApplicationsAtGenerations(ctx context.Context,
	needApplicationsAtGenerations map[keybase1.PerTeamKeyGeneration][]keybase1.TeamApplication, state *keybase1.TeamData) error {
	if len(needApplicationsAtGenerations) == 0 {
		return nil
	}
	if state == nil {
		return fmt.Errorf("nil team does not contain applications: %v", needApplicationsAtGenerations)
	}
	for ptkGen, apps := range needApplicationsAtGenerations {
		for _, app := range apps {
			if _, err := ApplicationKeyAtGeneration(libkb.NewMetaContext(ctx, l.G()), state, app, ptkGen); err != nil {
				return err
			}
		}
	}
	return nil
}

func (l *TeamLoader) satisfiesNeedApplicationsAtGenerationsWithKBFS(ctx context.Context,
	needApplicationsAtGenerations map[keybase1.PerTeamKeyGeneration][]keybase1.TeamApplication,
	state *keybase1.TeamData) error {
	if len(needApplicationsAtGenerations) == 0 {
		return nil
	}
	if state == nil {
		return fmt.Errorf("nil team does not contain applications: %v", needApplicationsAtGenerations)
	}
	for ptkGen, apps := range needApplicationsAtGenerations {
		for _, app := range apps {
			if _, err := ApplicationKeyAtGenerationWithKBFS(libkb.NewMetaContext(ctx, l.G()), state, app,
				ptkGen); err != nil {
				return err
			}
		}
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
	offChainGen := keybase1.PerTeamKeyGeneration(len(state.PerTeamKeySeedsUnverified))
	return onChainGen == offChainGen
}

func (l *TeamLoader) logIfUnsyncedSecrets(ctx context.Context, state *keybase1.TeamData) {
	onChainGen := keybase1.PerTeamKeyGeneration(len(state.Chain.PerTeamKeys))
	offChainGen := keybase1.PerTeamKeyGeneration(len(state.PerTeamKeySeedsUnverified))
	if onChainGen != offChainGen {
		l.G().Log.CDebugf(ctx, "TeamLoader unsynced secrets local:%v != chain:%v ", offChainGen, onChainGen)
	}
}

func (l *TeamLoader) lows(ctx context.Context, state *keybase1.TeamData) getLinksLows {
	var lows getLinksLows
	if state != nil {
		chain := TeamSigChainState{inner: state.Chain}
		lows.Seqno = chain.GetLatestSeqno()
		lows.PerTeamKey = keybase1.PerTeamKeyGeneration(len(state.PerTeamKeySeedsUnverified))
		// Use an arbitrary application to get the number of known RKMs.
		// TODO: using an arbitrary RKM is wrong and could lead to stuck caches.
		//       See CORE-8445
		rkms, ok := state.ReaderKeyMasks[keybase1.TeamApplication_CHAT]
		if ok {
			lows.ReaderKeyMask = keybase1.PerTeamKeyGeneration(len(rkms))
		}
	}
	return lows
}

func (l *TeamLoader) OnLogout() {
	l.storage.clearMem()
}

// Clear the in-memory cache.
func (l *TeamLoader) ClearMem() {
	l.storage.clearMem()
}

func (l *TeamLoader) VerifyTeamName(ctx context.Context, id keybase1.TeamID, name keybase1.TeamName) error {
	if name.IsRootTeam() {
		if !name.ToTeamID(id.IsPublic()).Eq(id) {
			return NewResolveError(name, id)
		}
		return nil
	}
	teamData, err := l.Load(ctx, keybase1.LoadTeamArg{
		ID:     id,
		Public: id.IsPublic(),
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
		Public:  teamID.IsPublic(),
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

func (l *TeamLoader) getHeadMerkleSeqno(mctx libkb.MetaContext, readSubteamID keybase1.TeamID, state *keybase1.TeamSigChainState) (ret keybase1.Seqno, err error) {
	defer mctx.CTrace("TeamLoader#getHeadMerkleSeqno", func() error { return err })()

	if state.HeadMerkle != nil {
		return state.HeadMerkle.Seqno, nil
	}
	headSeqno := keybase1.Seqno(1)
	expectedLinkRaw, ok := state.LinkIDs[headSeqno]
	if !ok {
		return ret, fmt.Errorf("couldn't find head link in team state during audit")
	}
	expectedLink, err := libkb.ImportLinkID(expectedLinkRaw)
	if err != nil {
		return ret, err
	}
	teamUpdate, err := l.world.getLinksFromServer(mctx.Ctx(), state.Id, []keybase1.Seqno{headSeqno}, &readSubteamID)
	if err != nil {
		return ret, err
	}
	newLinks, err := teamUpdate.unpackLinks(mctx.Ctx())
	if err != nil {
		return ret, err
	}
	if len(newLinks) != 1 {
		return ret, fmt.Errorf("expected only one chainlink back; got %d", len(newLinks))
	}
	headLink := newLinks[0]
	err = headLink.AssertInnerOuterMatch()
	if err != nil {
		return ret, err
	}
	if headLink.Seqno() != headSeqno {
		return ret, NewInvalidLink(headLink, "wrong head seqno; wanted 1 but got something else")
	}
	if !headLink.LinkID().Eq(expectedLink) {
		return ret, NewInvalidLink(headLink, "wrong head link hash: %s != %s", headLink.LinkID, expectedLink)
	}
	if headLink.isStubbed() {
		return ret, NewInvalidLink(headLink, "got a stubbed head link, but wasn't expecting that")
	}
	headMerkle := headLink.inner.Body.MerkleRoot.ToMerkleRootV2()
	state.HeadMerkle = &headMerkle
	return headMerkle.Seqno, nil
}

func (l *TeamLoader) audit(ctx context.Context, readSubteamID keybase1.TeamID, state *keybase1.TeamSigChainState) (err error) {
	mctx := libkb.NewMetaContext(ctx, l.G())

	if l.G().Env.Test.TeamSkipAudit {
		mctx.CDebugf("skipping audit in test due to flag")
		return nil
	}

	headMerklSeqno, err := l.getHeadMerkleSeqno(mctx, readSubteamID, state)
	if err != nil {
		return err
	}

	err = mctx.G().GetTeamAuditor().AuditTeam(mctx, state.Id, state.Public, headMerklSeqno, state.LinkIDs, state.LastSeqno)
	return err
}

func (l *TeamLoader) ForceRepollUntil(ctx context.Context, dtime gregor.TimeOrOffset) error {
	l.G().Log.CDebugf(ctx, "TeamLoader#ForceRepollUntil(%+v)", dtime)
	l.forceRepollMutex.Lock()
	defer l.forceRepollMutex.Unlock()
	l.forceRepollUntil = dtime
	return nil
}

func (l *TeamLoader) InForceRepollMode(ctx context.Context) bool {
	l.forceRepollMutex.Lock()
	defer l.forceRepollMutex.Unlock()
	if l.forceRepollUntil == nil {
		return false
	}
	if !l.forceRepollUntil.Before(l.G().Clock().Now()) {
		l.G().Log.CDebugf(ctx, "TeamLoader#InForceRepollMode: returning true")
		return true
	}
	l.forceRepollUntil = nil
	return false
}
