package teams

import (
	"errors"
	"fmt"
	"os"
	"sort"
	"sync"
	"time"

	"github.com/keybase/client/go/sig3"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/gregor"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	hidden "github.com/keybase/client/go/teams/hidden"
	storage "github.com/keybase/client/go/teams/storage"
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
	teamData, hidden, err := g.GetTeamLoader().Load(ctx, lArg)
	if err != nil {
		return nil, err
	}
	ret := NewTeam(ctx, g, teamData, hidden)

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
	world         LoaderContext
	storage       *storage.Storage
	merkleStorage *storage.Merkle
	// Single-flight locks per team ID.
	// (Private and public loads of the same ID will block each other, should be fine)
	locktab *libkb.LockTable

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

func NewTeamLoader(g *libkb.GlobalContext, world LoaderContext, storage *storage.Storage, merkleStorage *storage.Merkle) *TeamLoader {
	return &TeamLoader{
		Contextified:         libkb.NewContextified(g),
		world:                world,
		storage:              storage,
		merkleStorage:        merkleStorage,
		nameLookupBurstCache: libkb.NewBurstCache(g, 100, 10*time.Second, "SubteamNameToID"),
		locktab:              libkb.NewLockTable(),
	}
}

// NewTeamLoaderAndInstall creates a new loader and installs it into G.
func NewTeamLoaderAndInstall(g *libkb.GlobalContext) *TeamLoader {
	world := NewLoaderContextFromG(g)
	st := storage.NewStorage(g)
	mst := storage.NewMerkle()
	l := NewTeamLoader(g, world, st, mst)
	g.SetTeamLoader(l)
	g.AddLogoutHook(l, "teamLoader")
	g.AddDbNukeHook(l, "teamLoader")
	return l
}

func (l *TeamLoader) Load(ctx context.Context, lArg keybase1.LoadTeamArg) (res *keybase1.TeamData, hidden *keybase1.HiddenTeamChain, err error) {
	me, err := l.world.getMe(ctx)
	if err != nil {
		return nil, nil, err
	}
	if me.IsNil() && !lArg.Public {
		return nil, nil, libkb.NewLoginRequiredError("login required to load a private team")
	}
	return l.load1(ctx, me, lArg)
}

func newFrozenChain(chain *keybase1.TeamSigChainState) keybase1.TeamSigChainState {
	return keybase1.TeamSigChainState{
		Id:         chain.Id,
		Public:     chain.Public,
		LastSeqno:  chain.LastSeqno,
		LastLinkID: chain.LastLinkID,
	}
}

func (l *TeamLoader) Freeze(ctx context.Context, teamID keybase1.TeamID) (err error) {
	defer l.G().CTraceTimed(ctx, fmt.Sprintf("TeamLoader#Freeze(%s)", teamID), func() error { return err })()
	lock := l.locktab.AcquireOnName(ctx, l.G(), teamID.String())
	defer lock.Release(ctx)
	mctx := libkb.NewMetaContext(ctx, l.G())
	td, frozen, tombstoned := l.storage.Get(mctx, teamID, teamID.IsPublic())
	if frozen || td == nil {
		return nil
	}
	newTD := &keybase1.TeamData{
		Frozen:     true,
		Tombstoned: tombstoned,
		Chain:      newFrozenChain(&td.Chain),
	}
	l.storage.Put(mctx, newTD)
	return nil
}

func (l *TeamLoader) Tombstone(ctx context.Context, teamID keybase1.TeamID) (err error) {
	defer l.G().CTraceTimed(ctx, fmt.Sprintf("TeamLoader#Tombstone(%s)", teamID), func() error { return err })()
	lock := l.locktab.AcquireOnName(ctx, l.G(), teamID.String())
	defer lock.Release(ctx)
	mctx := libkb.NewMetaContext(ctx, l.G())
	td, frozen, tombstoned := l.storage.Get(mctx, teamID, teamID.IsPublic())
	if tombstoned || td == nil {
		return nil
	}
	newTD := &keybase1.TeamData{
		Frozen:     frozen,
		Tombstoned: true,
		Chain:      newFrozenChain(&td.Chain),
	}
	l.storage.Put(mctx, newTD)
	return nil
}

func (l *TeamLoader) HintLatestSeqno(ctx context.Context, teamID keybase1.TeamID, seqno keybase1.Seqno) error {
	// Single-flight lock by team ID.
	lock := l.locktab.AcquireOnName(ctx, l.G(), teamID.String())
	defer lock.Release(ctx)
	mctx := libkb.NewMetaContext(ctx, l.G())

	// Load from the cache
	td, frozen, tombstoned := l.storage.Get(mctx, teamID, teamID.IsPublic())
	if frozen || tombstoned || td == nil {
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
	mctx := libkb.NewMetaContext(ctx, g)
	arg := libkb.NewAPIArg("team/get")
	arg.SessionType = libkb.APISessionTypeREQUIRED
	arg.Args = libkb.HTTPArgs{
		"name":        libkb.S{Val: teamName.String()},
		"lookup_only": libkb.B{Val: true},
		"public":      libkb.B{Val: public},
	}

	var rt rawTeam
	if err := mctx.G().API.GetDecode(mctx, arg, &rt); err != nil {
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
func (l *TeamLoader) load1(ctx context.Context, me keybase1.UserVersion, lArg keybase1.LoadTeamArg) (*keybase1.TeamData, *keybase1.HiddenTeamChain, error) {
	mctx := libkb.NewMetaContext(ctx, l.G())
	err := l.checkArg(ctx, lArg)
	if err != nil {
		return nil, nil, err
	}

	var teamName *keybase1.TeamName
	if len(lArg.Name) > 0 {
		teamNameParsed, err := keybase1.TeamNameFromString(lArg.Name)
		if err != nil {
			return nil, nil, fmt.Errorf("invalid team name: %v", err)
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
			mctx.Debug("TeamLoader looking up team by name failed: %v -> %v", *teamName, err)
			if code, ok := libkb.GetAppStatusCode(err); ok && code == keybase1.StatusCode_SCTeamNotFound {
				mctx.Debug("replacing error: %v", err)
				return nil, nil, NewTeamDoesNotExistError(lArg.Public, teamName.String())
			}
			return nil, nil, err
		}
	}

	mungedForceRepoll := lArg.ForceRepoll
	mungedWantMembers, err := l.mungeWantMembers(ctx, lArg.Refreshers.WantMembers)
	if err != nil {
		mctx.Debug("TeamLoader munge failed: %v", err)
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
		auditMode:                             lArg.AuditMode,
		skipNeedHiddenRotateCheck:             lArg.SkipNeedHiddenRotateCheck,

		needSeqnos:    nil,
		readSubteamID: nil,

		me: me,
	})
	switch err := err.(type) {
	case TeamDoesNotExistError:
		if teamName == nil {
			return nil, nil, err
		}
		// Replace the not found error so that it has a name instead of team ID.
		// If subteams are involved the name might not correspond to the ID
		// but it's better to have this understandable error message that's accurate
		// most of the time than one with an ID that's always accurate.
		mctx.Debug("replacing error: %v", err)
		return nil, nil, NewTeamDoesNotExistError(lArg.Public, teamName.String())
	case nil:
	default:
		return nil, nil, err
	}
	if ret == nil {
		return nil, nil, fmt.Errorf("team loader fault: got nil from load2")
	}

	// Public teams are allowed to be behind on secrets since you can load a
	// public team you're not in. Restricted bot members don't have any secrets
	// and are also exempt.
	if !l.hasSyncedSecrets(mctx, ret.teamShim()) &&
		!(ret.team.Chain.Public || ret.team.Chain.UserRole(me).IsRestrictedBot()) {
		// this should not happen
		return nil, nil, fmt.Errorf("missing secrets for team")
	}

	// Check team name on the way out
	// The snapshot may have already been written to cache, but that should be ok,
	// because the cache is keyed by ID.
	if teamName != nil {
		// (TODO: this won't work for renamed level 3 teams or above. There's work on this in miles/teamloader-names)
		if !teamName.Eq(ret.team.Name) {
			return nil, nil, fmt.Errorf("team name mismatch: %v != %v", ret.team.Name, teamName.String())
		}
	}

	if ShouldRunBoxAudit(mctx) {
		newMctx, shouldReload := VerifyBoxAudit(mctx, teamID)
		if shouldReload {
			return l.load1(newMctx.Ctx(), me, lArg)
		}
	} else {
		mctx.Debug("Box auditor feature flagged off; not checking jail during team load...")
	}

	return &ret.team, ret.hidden, nil
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
	wantMembers               []keybase1.UserVersion
	wantMembersRole           keybase1.TeamRole
	forceFullReload           bool
	forceRepoll               bool
	staleOK                   bool
	public                    bool
	skipNeedHiddenRotateCheck bool
	skipSeedCheck             bool

	auditMode keybase1.AuditMode

	needSeqnos []keybase1.Seqno
	// Non-nil if we are loading an ancestor for the greater purpose of
	// loading a subteam. This parameter helps the server figure out whether
	// to give us a subteam-reader version of the team.
	// If and only if this is set, load2 is allowed to return a secret-less TeamData.
	// Load1 can return secret-less TeamData if the team is public or the
	// current user is a restricted bot member.
	readSubteamID *keybase1.TeamID

	// If the user is logged out, this will be a nil UserVersion, meaning
	/// me.IsNil() will be true.
	me keybase1.UserVersion
}

type load2ResT struct {
	team      keybase1.TeamData
	hidden    *keybase1.HiddenTeamChain
	didRepoll bool
}

func (l load2ResT) teamShim() *TeamShim {
	return &TeamShim{Data: &l.team, Hidden: l.hidden}
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
	mctx := libkb.NewMetaContext(ctx, l.G())
	tracer := l.G().CTimeTracer(ctx, "TeamLoader.load2ILR", teamEnv.Profile)
	defer tracer.Finish()

	defer tbs.LogIfNonZero(ctx, "API.request")

	var err error
	var didRepoll bool
	lkc := newLoadKeyCache()

	// Fetch from cache
	tracer.Stage("cache load")
	tailCheckRet, frozen, tombstoned := l.storage.Get(mctx, arg.teamID, arg.public)
	if tombstoned {
		return nil, NewTeamTombstonedError()
	}

	// Fetch last polled time from merkle cache
	merklePolledAt := l.merkleStorage.Get(mctx, arg.teamID, arg.public)

	var ret *keybase1.TeamData
	if !frozen && !arg.forceFullReload {
		// Load from cache
		ret = tailCheckRet
	}

	if ret != nil && !ret.Chain.Reader.Eq(arg.me) {
		// Check that we are the same person as when this team was last loaded as a courtesy.
		// This should never happen. We shouldn't be able to decrypt someone else's snapshot.
		mctx.Warning("TeamLoader discarding snapshot for wrong user: (%v, %v) != (%v, %v)",
			arg.me.Uid, arg.me.EldestSeqno, ret.Chain.Reader.Uid, ret.Chain.Reader.EldestSeqno)
		ret = nil
	}

	var cachedName *keybase1.TeamName
	if ret != nil && !ret.Name.IsNil() {
		cachedName = &ret.Name
	}

	hiddenPackage, err := l.hiddenPackage(mctx, arg.teamID, ret, arg.me)
	if err != nil {
		return nil, err
	}

	teamShim := func() *TeamShim {
		return &TeamShim{Data: ret, Hidden: hiddenPackage.ChainData()}
	}

	// Determine whether to repoll merkle.
	discardCache, repoll := l.load2DecideRepoll(mctx, arg, teamShim(), merklePolledAt)
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
		mctx.Debug("TeamLoader not using snapshot")
	}

	tracer.Stage("merkle")
	var lastSeqno keybase1.Seqno
	var lastLinkID keybase1.LinkID
	var hiddenIsFresh bool

	// hiddenResp will be nill iff we do not make the merkleLookupWithHidden
	// call. If the server does not return any hidden data, we will encode that
	// as a non nil response whose RespType is MerkleHiddenResponseTypeNONE.
	var hiddenResp *libkb.MerkleHiddenResponse

	if (ret == nil) || repoll {
		mctx.Debug("TeamLoader looking up merkle leaf (force:%v)", arg.forceRepoll)

		// Reference the merkle tree to fetch the sigchain tail leaf for the team.
		lastSeqno, lastLinkID, hiddenResp, err = l.world.merkleLookupWithHidden(ctx, arg.teamID, arg.public)
		if err != nil {
			return nil, err
		}

		if hiddenResp.CommittedHiddenTail != nil {
			mctx.Debug("lastSeqno %v, lastLinkID %v, hiddenResp: %+v uncS %+v cS %v err %v", lastSeqno, lastLinkID, hiddenResp, hiddenResp.UncommittedSeqno, hiddenResp.CommittedHiddenTail.Seqno, err)

		} else {
			mctx.Debug("lastSeqno %v, lastLinkID %v, hiddenResp: %+v uncS %+v err %v", lastSeqno, lastLinkID, hiddenResp, hiddenResp.UncommittedSeqno, err)
		}

		switch hiddenResp.RespType {
		case libkb.MerkleHiddenResponseTypeNONE:
			mctx.Debug("Skipping CheckHiddenMerklePathResponseAndAddRatchets as no hidden data was received. If the server had to show us the hidden chain and didn't, we will error out later (once we can establish our role in the team).")
		case libkb.MerkleHiddenResponseTypeFLAGOFF:
			mctx.Debug("Skipping CheckHiddenMerklePathResponseAndAddRatchets as the hidden flag is off.")
		default:
			hiddenIsFresh, err = hiddenPackage.CheckHiddenMerklePathResponseAndAddRatchets(mctx, hiddenResp)
			if err != nil {
				return nil, err
			}
		}

		didRepoll = true
	} else {
		lastSeqno = ret.Chain.LastSeqno
		lastLinkID = ret.Chain.LastLinkID
		hiddenIsFresh = true
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
	var filledInStubbedLinks bool
	if ret != nil && len(arg.needSeqnos) > 0 {
		ret, proofSet, parentChildOperations, err = l.fillInStubbedLinks(
			ctx, arg.me, arg.teamID, ret, arg.needSeqnos, readSubteamID, proofSet, parentChildOperations, lkc)
		if err != nil {
			return nil, err
		}
		filledInStubbedLinks = true
	}

	tracer.Stage("pre-fetch")
	var fetchLinksAndOrSecrets bool
	if ret == nil {
		mctx.Debug("TeamLoader fetching: no cache")
		// We have no cache
		fetchLinksAndOrSecrets = true
	} else if ret.Chain.LastSeqno < lastSeqno {
		mctx.Debug("TeamLoader fetching: chain update")
		// The cache is definitely behind
		fetchLinksAndOrSecrets = true
	} else if !hiddenIsFresh {
		mctx.Debug("TeamLoader fetching: hidden chain wasn't fresh")
		fetchLinksAndOrSecrets = true
	} else if !l.hasSyncedSecrets(mctx, teamShim()) {
		// The cached secrets are behind the cached chain.
		// We may need to hit the server for secrets, even though there are no new links.
		if arg.needAdmin {
			mctx.Debug("TeamLoader fetching: NeedAdmin")
			// Admins should always have up-to-date secrets. But not necessarily RKMs.
			fetchLinksAndOrSecrets = true
		}
		if err := l.satisfiesNeedKeyGeneration(mctx, arg.needKeyGeneration, teamShim()); err != nil {
			mctx.Debug("TeamLoader fetching: NeedKeyGeneration: %v", err)
			fetchLinksAndOrSecrets = true
		}
		if err := l.satisfiesNeedsKBFSKeyGeneration(mctx, arg.needKBFSKeyGeneration, teamShim()); err != nil {
			mctx.Debug("TeamLoader fetching: KBFSNeedKeyGeneration: %v", err)
			fetchLinksAndOrSecrets = true
		}
		if arg.readSubteamID == nil {
			// This is not a recursive load. We should have the keys.
			// This may be an extra round trip for public teams you're not in.
			mctx.Debug("TeamLoader fetching: primary load")
			fetchLinksAndOrSecrets = true
		}
	}
	// hasSyncedSecrets does not account for RKMs. So check RKM refreshers separeately.

	if err := l.satisfiesNeedApplicationsAtGenerations(mctx, arg.needApplicationsAtGenerations, teamShim()); err != nil {
		mctx.Debug("TeamLoader fetching: NeedApplicationsAtGenerations: %v", err)
		fetchLinksAndOrSecrets = true
	}
	if err := l.satisfiesNeedApplicationsAtGenerationsWithKBFS(mctx,
		arg.needApplicationsAtGenerationsWithKBFS, teamShim()); err != nil {
		mctx.Debug("TeamLoader fetching: NeedApplicationsAtGenerationsWithKBFS: %v", err)
		fetchLinksAndOrSecrets = true
	}

	// Pull new links from the server
	tracer.Stage("fetch")
	var teamUpdate *rawTeam
	if fetchLinksAndOrSecrets {
		lows := l.lows(mctx, ret, hiddenPackage)
		mctx.Debug("TeamLoader getting links from server (%+v)", lows)
		teamUpdate, err = l.world.getNewLinksFromServer(ctx, arg.teamID, lows, arg.readSubteamID)
		if err != nil {
			return nil, err
		}
		mctx.Debug("TeamLoader got %v links", len(teamUpdate.Chain))
		hiddenPackage.SetRatchetBlindingKeySet(teamUpdate.RatchetBlindingKeySet)
	}

	tracer.Stage("unpack")
	links, err := teamUpdate.unpackLinks(ctx)
	if err != nil {
		return nil, err
	}
	var prev libkb.LinkID
	if ret != nil {
		prev, err = TeamSigChainState{inner: ret.Chain}.GetLatestLibkbLinkID()
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
		mctx.Debug("fullVerifyCutoff: %v", fullVerifyCutoff)
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
		var err error
		ret, prev, err = l.doOneLink(mctx, arg, ret, hiddenPackage, link, i, suppressLoggingStart, suppressLoggingUpto, lastSeqno, &parentChildOperations, prev, fullVerifyCutoff, readSubteamID, proofSet, lkc, &parentsCache)
		if err != nil {
			return nil, err
		}
	}

	if ret == nil {
		return nil, fmt.Errorf("team loader fault: got nil from load2")
	}

	encKID, gen, role, err := l.hiddenPackageGetter(mctx, arg.teamID, ret, arg.me)()
	if err != nil {
		return nil, err
	}

	// If we did get an update from the server (hiddenResp != nil) are not a
	// restricted bot AND this is not a recursive load (arg.readSubteamID == nil),
	// then the server should have given us hidden chain data.
	if hiddenResp != nil && hiddenResp.RespType == libkb.MerkleHiddenResponseTypeNONE && !role.IsRestrictedBot() && arg.readSubteamID == nil {
		return nil, libkb.NewHiddenChainDataMissingError("Not a restricted bot or recursive load, but the server did not return merkle hidden chain data")
	}

	// Update the hidden package with team metadata once we process all of the
	// links. This is necessary since we need the role to be up to date to know
	// if we should skip seed checks on the hidden chain if we are loading as a
	// RESTRICTEDBOT.
	hiddenPackage.UpdateTeamMetadata(encKID, gen, role)

	// Be sure to update the hidden chain after the main chain, since the latter can "ratchet" the former
	if teamUpdate != nil {
		err = hiddenPackage.Update(mctx, teamUpdate.GetHiddenChain())
	} else {
		err = hiddenPackage.Update(mctx, []sig3.ExportJSON{})
	}

	if err != nil {
		return nil, err
	}
	err = hiddenPackage.CheckPTKsForDuplicates(mctx, func(g keybase1.PerTeamKeyGeneration) bool {
		_, ok := ret.Chain.PerTeamKeys[g]
		return ok
	})
	if err != nil {
		return nil, err
	}

	// Ensure that the state of the hidden chain is consistent with
	// what we got from the merkle/path endpoint.
	if hiddenResp != nil && hiddenResp.RespType != libkb.MerkleHiddenResponseTypeFLAGOFF && hiddenResp.RespType != libkb.MerkleHiddenResponseTypeNONE {
		err = hiddenPackage.CheckChainHasMinLength(mctx, hiddenResp.UncommittedSeqno)
		if err != nil {
			return nil, err
		}
	}

	// The hidden team has pointers from the hidden chain up to the visible chain; check that they
	// match the loaded team. We should have a full load of the team, so all parent pointers
	// better hit their mark.
	err = hiddenPackage.CheckParentPointersOnFullLoad(mctx, ret)
	if err != nil {
		return nil, err
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
			mctx.Debug("TeamLoader lkc cache hits: %v", lkc.cacheHits)
		}
	}

	if !ret.Chain.LastLinkID.Eq(lastLinkID) {
		return nil, fmt.Errorf("wrong sigchain link ID: %v != %v",
			ret.Chain.LastLinkID, lastLinkID)
	}

	if tailCheckRet != nil {
		// If we previously discarded cache due to forceFullReload, or left the
		// team, froze it, and are rejoining, make sure the previous tail is
		// still in the chain.
		// The chain loader ensures it is part of a well-formed chain with correct prevs.
		linkID := ret.Chain.LinkIDs[tailCheckRet.Chain.LastSeqno]
		if !linkID.Eq(tailCheckRet.Chain.LastLinkID) {
			return nil, fmt.Errorf("got wrong sigchain link ID for seqno %d: expected %v from previous cache entry (frozen=%t); got %v in new chain", tailCheckRet.Chain.LastSeqno,
				tailCheckRet.Chain.LastLinkID, ret.Frozen, linkID)
		}
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
			stateWrapper := newTeamSigChainState(teamShim())
			role, err := stateWrapper.GetUserRole(arg.me)
			if err != nil {
				role = keybase1.TeamRole_NONE
			}
			// Add the secrets.
			// If it's a public team, there might not be secrets. (If we're not in the team)
			// Restricted bots don't have any team secrets, so we also short circuit.
			if !role.IsRestrictedBot() && (!ret.Chain.Public || (teamUpdate.Box != nil)) {
				err = l.addSecrets(mctx, teamShim(), arg.me, teamUpdate.Box, teamUpdate.Prevs, teamUpdate.ReaderKeyMasks)
				if err != nil {
					return nil, fmt.Errorf("loading team secrets: %v", err)
				}

				err = l.computeSeedChecks(ctx, ret)
				if err != nil {
					return nil, err
				}

				if teamUpdate.LegacyTLFUpgrade != nil {
					err = l.addKBFSCryptKeys(mctx, teamShim(), teamUpdate.LegacyTLFUpgrade)
					if err != nil {
						return nil, fmt.Errorf("loading KBFS crypt keys: %v", err)
					}
				}
			}
			if role.IsRestrictedBot() {
				// Clear out any secrets we may have had in memory if we were a
				// previous role that had PTK access.
				state := teamShim().MainChain()
				state.PerTeamKeySeedsUnverified = make(map[keybase1.PerTeamKeyGeneration]keybase1.PerTeamKeySeedItem)
				state.ReaderKeyMasks = make(map[keybase1.TeamApplication]map[keybase1.PerTeamKeyGeneration]keybase1.MaskB64)
				state.TlfCryptKeys = make(map[keybase1.TeamApplication][]keybase1.CryptKey)
			}
		}
	}

	// Note that we might have done so just above after adding secrets, but before adding
	// KBFS crypt keys. But it's cheap to run this method twice in a row.
	tracer.Stage("computeSeedChecks")
	err = l.computeSeedChecks(ctx, ret)
	if err != nil {
		return nil, err
	}

	if !arg.skipSeedCheck && arg.readSubteamID == nil {
		err = hiddenPackage.CheckUpdatesAgainstSeedsWithMap(mctx, ret.PerTeamKeySeedsUnverified)
		if err != nil {
			return nil, err
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

	var needHiddenRotate bool
	if !arg.skipNeedHiddenRotateCheck {
		needHiddenRotate, err = l.checkNeedRotate(mctx, ret, arg.me, hiddenPackage)
		if err != nil {
			return nil, err
		}
	}

	err = hiddenPackage.Commit(mctx)
	if err != nil {
		return nil, err
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
	err = l.audit(ctx, readSubteamID, &ret.Chain, arg.auditMode)
	if err != nil {
		return nil, err
	}

	// Cache the validated result if it was actually updated via the team/get endpoint. In many cases, we're not
	// actually mutating the teams. Also, if we wound up filling in stubbed links, let's also restore the cache.
	if teamUpdate != nil || filledInStubbedLinks {
		tracer.Stage("put")
		l.storage.Put(mctx, ret)
	}

	// If we wound up repolling the merkle tree for this team, say that we did.
	if didRepoll {
		l.merkleStorage.Put(mctx, arg.teamID, arg.public, keybase1.ToTime(mctx.G().Clock().Now()))
	}

	tracer.Stage("notify")
	if cachedName != nil && !cachedName.Eq(newName) {
		chain := TeamSigChainState{inner: ret.Chain, hidden: hiddenPackage.ChainData()}
		// Send a notification if we used to have the name cached and it has changed at all.
		changeSet := keybase1.TeamChangeSet{Renamed: true}
		go l.G().NotifyRouter.HandleTeamChangedByID(context.Background(),
			chain.GetID(), chain.GetLatestSeqno(), chain.IsImplicit(), changeSet, chain.GetLatestHiddenSeqno(), keybase1.Seqno(0))
		go l.G().NotifyRouter.HandleTeamChangedByName(context.Background(),
			cachedName.String(), chain.GetLatestSeqno(), chain.IsImplicit(), changeSet, chain.GetLatestHiddenSeqno(), keybase1.Seqno(0))
		go l.G().NotifyRouter.HandleTeamChangedByName(context.Background(),
			newName.String(), chain.GetLatestSeqno(), chain.IsImplicit(), changeSet, chain.GetLatestHiddenSeqno(), keybase1.Seqno(0))
	}

	// Check request constraints
	tracer.Stage("postcheck")
	err = l.load2CheckReturn(mctx, arg, teamShim())
	if err != nil {
		return nil, err
	}

	load2res := load2ResT{
		team:      *ret,
		didRepoll: didRepoll,
	}

	if hd := hiddenPackage.ChainData(); hd != nil {
		hd.NeedRotate = needHiddenRotate
		load2res.hidden = hd
	}

	if needHiddenRotate {
		l.G().GetTeamBoxAuditor().MaybeScheduleDelayedBoxAuditTeam(mctx, arg.teamID)
	}

	return &load2res, nil
}

func (l *TeamLoader) hiddenPackageGetter(mctx libkb.MetaContext, id keybase1.TeamID, team *keybase1.TeamData, me keybase1.UserVersion) func() (encKID keybase1.KID, gen keybase1.PerTeamKeyGeneration, role keybase1.TeamRole, err error) {
	return func() (encKID keybase1.KID, gen keybase1.PerTeamKeyGeneration,
		role keybase1.TeamRole, err error) {
		if team == nil {
			return encKID, gen, keybase1.TeamRole_NONE, nil
		}
		state := TeamSigChainState{inner: team.Chain}

		ptk, err := state.GetLatestPerTeamKey(mctx)
		if err != nil {
			return encKID, gen, keybase1.TeamRole_NONE, err
		}
		role, err = state.GetUserRole(me)
		if err != nil {
			return encKID, gen, keybase1.TeamRole_NONE, err
		}
		return ptk.EncKID, ptk.Gen, role, nil
	}
}

func (l *TeamLoader) hiddenPackage(mctx libkb.MetaContext, id keybase1.TeamID, team *keybase1.TeamData, me keybase1.UserVersion) (ret *hidden.LoaderPackage, err error) {
	getter := l.hiddenPackageGetter(mctx, id, team, me)
	return hidden.NewLoaderPackage(mctx, id, getter)
}

func (l *TeamLoader) isAllowedKeyerOf(mctx libkb.MetaContext, chain *keybase1.TeamData, me keybase1.UserVersion, them keybase1.UserVersion) (ret bool, err error) {
	state := TeamSigChainState{inner: chain.Chain}
	mctx = mctx.WithLogTag("IAKO")
	defer mctx.Trace(fmt.Sprintf("TeamLoader#isAllowedKeyerOf(%s, %s)", state.GetID(), them), func() error { return err })()

	role, err := state.GetUserRole(them)
	if err != nil {
		return false, err
	}
	switch role {
	case keybase1.TeamRole_WRITER, keybase1.TeamRole_ADMIN, keybase1.TeamRole_OWNER:
		mctx.Debug("user fits explicit role (%s)", role)
		return true, nil
	}

	if state.GetParentID() == nil {
		mctx.Debug("user is not an allowed keyer of the team")
		return false, nil
	}

	// now check implict adminship
	yes, err := l.isImplicitAdminOf(mctx.Ctx(), state.GetID(), state.GetParentID(), me, them)
	if err != nil {
		return false, err
	}

	if yes {
		mctx.Debug("user is an implicit admin of the team")
		return true, err
	}

	mctx.Debug("user is not an allowed keyer of the team")

	return false, nil

}

func (l *TeamLoader) checkNeedRotate(mctx libkb.MetaContext, chain *keybase1.TeamData, me keybase1.UserVersion, hiddenPackage *hidden.LoaderPackage) (ret bool, err error) {
	signer := hiddenPackage.LastReaderKeyRotator(mctx)
	if signer == nil {
		mctx.Debug("not checking need rotate, since last signer of hidden chain was nil")
		return false, nil
	}
	return l.checkNeedRotateWithSigner(mctx, chain, me, *signer)
}

func (l *TeamLoader) checkNeedRotateWithSigner(mctx libkb.MetaContext, chain *keybase1.TeamData, me keybase1.UserVersion, signer keybase1.Signer) (ret bool, err error) {

	defer mctx.Trace(fmt.Sprintf("TeamLoader::checkNeedRotateWithSigner(%+v)", signer), func() error { return err })()

	uv := signer.UserVersion()

	var isKeyer, amIKeyer bool

	amIKeyer, err = l.isAllowedKeyerOf(mctx, chain, me, me)
	if err != nil {
		return false, err
	}
	if !amIKeyer {
		mctx.Debug("I am not a keyer for this team, so I can't rotate it even if required")
		return false, nil
	}

	isKeyer, err = l.isAllowedKeyerOf(mctx, chain, me, uv)
	if err != nil {
		return false, err
	}

	if !isKeyer {
		mctx.Debug("need rotate since %+v isn't an allowed keyer of the team", uv)
		return true, nil
	}

	var found bool
	var revokedAt *keybase1.KeybaseTime

	found, revokedAt, _, err = mctx.G().GetUPAKLoader().CheckKIDForUID(mctx.Ctx(), uv.Uid, signer.K)
	if err != nil {
		return false, err
	}

	if !found || revokedAt != nil {
		var s string
		if revokedAt != nil {
			tm := revokedAt.Unix.Time()
			s = fmt.Sprintf(" (revoked at %s [%s ago])", tm, mctx.G().Clock().Now().Sub(tm))
		}
		mctx.Debug("KID %s wasn't found for %+v%s", signer, s)
		return true, nil
	}

	return false, nil
}

func (l *TeamLoader) doOneLink(mctx libkb.MetaContext, arg load2ArgT, ret *keybase1.TeamData, hiddenPackage *hidden.LoaderPackage, link *ChainLinkUnpacked, i int, suppressLoggingStart int, suppressLoggingUpto int, lastSeqno keybase1.Seqno, parentChildOperations *[](*parentChildOperation), prev libkb.LinkID, fullVerifyCutoff keybase1.Seqno, readSubteamID keybase1.TeamID, proofSet *proofSetT, lkc *loadKeyCache, parentsCache *parentChainCache) (*keybase1.TeamData, libkb.LinkID, error) {

	var nilPrev libkb.LinkID

	ctx := mctx.Ctx()
	if suppressLoggingStart <= i && i < suppressLoggingUpto {
		if i == suppressLoggingStart {
			mctx.Debug("TeamLoader suppressing logs until %v", suppressLoggingUpto)
		}
		ctx = WithSuppressLogging(ctx, true)
		mctx = mctx.WithContext(ctx)
	}

	if !ShouldSuppressLogging(ctx) {
		mctx.Debug("TeamLoader processing link seqno:%v", link.Seqno())
	}

	if link.Seqno() > lastSeqno {
		// This link came from a point in the chain after when we checked the merkle leaf.
		// Processing it would require re-checking merkle.
		// It would be tricky to ignore it because off-chain data is asserted to be in sync with the chain.
		// So, return an error that the caller will retry.
		mctx.Debug("TeamLoader found green link seqno:%v", link.Seqno())
		return nil, nilPrev, NewGreenLinkError(link.Seqno())
	}

	if err := l.checkStubbed(ctx, arg, link); err != nil {
		return nil, nilPrev, err
	}

	if !link.Prev().Eq(prev) {
		return nil, nilPrev, NewPrevError("team replay failed: prev chain broken at link %d (%v != %v)",
			i, link.Prev(), prev)
	}

	if err := consumeRatchets(mctx, hiddenPackage, link); err != nil {
		return nil, nilPrev, err
	}

	if err := checkPTKGenerationNotOnHiddenChain(mctx, hiddenPackage, link); err != nil {
		return nil, nilPrev, err
	}

	var signer *SignerX
	var err error
	signer, err = l.verifyLink(ctx, arg.teamID, ret, arg.me, link, fullVerifyCutoff,
		readSubteamID, proofSet, lkc, *parentsCache)
	if err != nil {
		return nil, nilPrev, err
	}

	if l.isParentChildOperation(ctx, link) {
		pco, err := l.toParentChildOperation(ctx, link)
		if err != nil {
			return nil, nilPrev, err
		}
		*parentChildOperations = append(*parentChildOperations, pco)
	}

	ret, err = l.applyNewLink(ctx, ret, hiddenPackage.ChainData(), link, signer, arg.me)
	if err != nil {
		return nil, nilPrev, err
	}

	return ret, link.LinkID(), nil
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
// discardCache - the caller should throw out their cached copy and repoll.
// repoll - hit up merkle for the latest tail
// Considers:
// - NeedAdmin
// - NeedKeyGeneration
// - NeedApplicationsAtGenerations
// - WantMembers
// - ForceRepoll
// - Cache freshness / StaleOK
// - NeedSeqnos
// - JustUpdated
// - If this user is in global "force repoll" mode, where it would be too spammy to
//   push out individual team changed notifications, so all team loads need a repoll.
func (l *TeamLoader) load2DecideRepoll(mctx libkb.MetaContext, arg load2ArgT, fromCache Teamer, cachedPolledAt *keybase1.Time) (discardCache bool, repoll bool) {
	var reason string
	defer func() {
		if discardCache || repoll || reason != "" {
			mctx.Debug("load2DecideRepoll -> (discardCache:%v, repoll:%v) %v", discardCache, repoll, reason)
		}
	}()
	// NeedAdmin is a special constraint where we start from scratch.
	// Because of admin-only invite links.
	if arg.needAdmin {
		if !l.satisfiesNeedAdmin(mctx, arg.me, fromCache) {
			// Start from scratch if we are newly admin
			reason = "!satisfiesNeedAdmin"
			return true, true
		}
	}

	if arg.forceRepoll {
		reason = "forceRepoll"
		return false, true
	}

	// Repoll if the server has previously hinted that the team has new links.
	if fromCache != nil && fromCache.MainChain() != nil && fromCache.MainChain().Chain.LastSeqno < fromCache.MainChain().LatestSeqnoHint {
		reason = "behind seqno hint"
		return false, true
	}

	if fromCache != nil && fromCache.HiddenChain() != nil && fromCache.HiddenChain().IsStale() {
		reason = "behind hidden seqno hint"
		return false, true
	}

	// Repoll to get a new key generation
	if arg.needKeyGeneration > 0 {
		if err := l.satisfiesNeedKeyGeneration(mctx, arg.needKeyGeneration, fromCache); err != nil {
			reason = fmt.Sprintf("satisfiesNeedKeyGeneration -> %v", err)
			return false, true
		}
	}
	// Repoll to get new applications at generations
	if len(arg.needApplicationsAtGenerations) > 0 {
		if err := l.satisfiesNeedApplicationsAtGenerations(mctx, arg.needApplicationsAtGenerations, fromCache); err != nil {
			reason = fmt.Sprintf("satisfiesNeedApplicationsAtGenerations -> %v", err)
			return false, true
		}
	}
	if arg.needKBFSKeyGeneration.Generation > 0 {
		if err := l.satisfiesNeedsKBFSKeyGeneration(mctx, arg.needKBFSKeyGeneration, fromCache); err != nil {
			reason = fmt.Sprintf("satisfiesNeedsKBFSKeyGeneration -> %v", err)
			return false, true
		}
	}

	if len(arg.needApplicationsAtGenerationsWithKBFS) > 0 {
		if err := l.satisfiesNeedApplicationsAtGenerationsWithKBFS(mctx,
			arg.needApplicationsAtGenerationsWithKBFS, fromCache); err != nil {
			reason = fmt.Sprintf("satisfiesNeedApplicationsAtGenerationsWithKBFS -> %v", err)
			return false, true
		}
	}

	// Repoll because it might help get the wanted members
	if len(arg.wantMembers) > 0 {
		if err := l.satisfiesWantMembers(mctx, arg.wantMembers, arg.wantMembersRole, fromCache); err != nil {
			reason = fmt.Sprintf("satisfiesWantMembers -> %v", err)
			return false, true
		}
	}

	// Repoll if we need a seqno not in the cache.
	// Does not force a repoll if we just need to fill in previous links
	if len(arg.needSeqnos) > 0 {
		if fromCache == nil || fromCache.MainChain() == nil {
			reason = "need seqnos and no cache"
			return false, true
		}
		if fromCache.MainChain().Chain.LastSeqno < l.seqnosMax(arg.needSeqnos) {
			reason = "need seqnos"
			return false, true
		}
	}

	if fromCache == nil || fromCache.MainChain() == nil {
		reason = "no cache"
		// We need a merkle leaf when starting from scratch.
		return false, true
	}

	cachedAt := fromCache.MainChain().CachedAt
	if cachedPolledAt != nil && *cachedPolledAt > cachedAt {
		cachedAt = *cachedPolledAt
	}

	cacheIsOld := !l.isFresh(mctx, cachedAt)
	if cacheIsOld && !arg.staleOK {
		// We need a merkle leaf
		reason = "cacheIsOld"
		return false, true
	}

	// InForceRepoll needs to a acquire a lock, so avoid it by checking it last.
	if l.InForceRepollMode(mctx) {
		reason = "InForceRepollMode"
		return false, true
	}

	return false, false
}

// Check whether the load produced a snapshot that can be returned to the caller.
// This should not check anything that is critical to the validity of the snapshot
// because the snapshot is put into the cache before this check.
// Considers:
// - NeedAdmin
// - NeedKeyGeneration
// - NeedSeqnos
func (l *TeamLoader) load2CheckReturn(mctx libkb.MetaContext, arg load2ArgT, shim Teamer) error {
	if arg.needAdmin {
		if !l.satisfiesNeedAdmin(mctx, arg.me, shim) {
			mctx.Debug("user %v is not an admin of team %v at seqno:%v", arg.me, arg.teamID, shim.MainChain().Chain.LastSeqno)
			return fmt.Errorf("user %v is not an admin of the team", arg.me)
		}
	}

	// Repoll to get a new key generation
	if arg.needKeyGeneration > 0 {
		if err := l.satisfiesNeedKeyGeneration(mctx, arg.needKeyGeneration, shim); err != nil {
			return err
		}
	}
	if len(arg.needApplicationsAtGenerations) > 0 {
		if err := l.satisfiesNeedApplicationsAtGenerations(mctx, arg.needApplicationsAtGenerations, shim); err != nil {
			return err
		}
	}
	if arg.needKBFSKeyGeneration.Generation > 0 {
		if err := l.satisfiesNeedsKBFSKeyGeneration(mctx, arg.needKBFSKeyGeneration, shim); err != nil {
			return err
		}
	}
	if len(arg.needApplicationsAtGenerationsWithKBFS) > 0 {
		if err := l.satisfiesNeedApplicationsAtGenerationsWithKBFS(mctx, arg.needApplicationsAtGenerationsWithKBFS, shim); err != nil {
			return err
		}
	}

	if len(arg.needSeqnos) > 0 {
		if err := l.checkNeededSeqnos(mctx.Ctx(), shim.MainChain(), arg.needSeqnos); err != nil {
			return err
		}
	}

	return nil
}

// Whether the user is an admin at the snapshot, and there are no stubbed links, and keys are up to date.
func (l *TeamLoader) satisfiesNeedAdmin(mctx libkb.MetaContext, me keybase1.UserVersion, team Teamer) bool {
	if team == nil || team.MainChain() == nil {
		return false
	}
	state := newTeamSigChainState(team)
	if state.HasAnyStubbedLinks() {
		return false
	}
	if !l.hasSyncedSecrets(mctx, team) {
		return false
	}
	role, err := state.GetUserRole(me)
	if err != nil {
		mctx.Debug("TeamLoader error getting my role: %v", err)
		return false
	}
	if !role.IsAdminOrAbove() {
		if !state.IsSubteam() {
			return false
		}
		yes, err := l.isImplicitAdminOf(mctx.Ctx(), state.GetID(), state.GetParentID(), me, me)
		if err != nil {
			mctx.Debug("TeamLoader error getting checking implicit admin: %s", err)
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

func (l *TeamLoader) satisfiesNeedsKBFSKeyGeneration(mctx libkb.MetaContext,
	kbfs keybase1.TeamKBFSKeyRefresher, state Teamer) error {
	if kbfs.Generation == 0 {
		return nil
	}
	if state == nil {
		return fmt.Errorf("nil team does not contain KBFS key generation: %#v", kbfs)
	}

	gen, err := newTeamSigChainState(state).GetLatestKBFSGeneration(kbfs.AppType)
	if err != nil {
		return err
	}
	if kbfs.Generation > gen {
		return NewKBFSKeyGenerationError(kbfs.Generation, gen)
	}
	return nil
}

// Whether the snapshot has loaded at least up to the key generation and has the secret.
func (l *TeamLoader) satisfiesNeedKeyGeneration(mctx libkb.MetaContext, needKeyGeneration keybase1.PerTeamKeyGeneration, state Teamer) error {
	if needKeyGeneration == 0 {
		return nil
	}
	if state == nil {
		return fmt.Errorf("nil team does not contain key generation: %v", needKeyGeneration)
	}
	key, err := newTeamSigChainState(state).GetLatestPerTeamKey(mctx)
	if err != nil {
		return err
	}
	if needKeyGeneration > key.Gen {
		return fmt.Errorf("team key generation too low: %v < %v", key.Gen, needKeyGeneration)
	}
	_, ok := state.MainChain().PerTeamKeySeedsUnverified[needKeyGeneration]
	if !ok {
		return fmt.Errorf("team key secret missing for generation: %v", needKeyGeneration)
	}
	return nil
}

// Whether the snapshot has loaded the reader key masks and key generations we
// need.
func (l *TeamLoader) satisfiesNeedApplicationsAtGenerations(mctx libkb.MetaContext,
	needApplicationsAtGenerations map[keybase1.PerTeamKeyGeneration][]keybase1.TeamApplication, team Teamer) error {
	if len(needApplicationsAtGenerations) == 0 {
		return nil
	}
	if team == nil || team.MainChain() == nil {
		return fmt.Errorf("nil team does not contain applications: %v", needApplicationsAtGenerations)
	}
	for ptkGen, apps := range needApplicationsAtGenerations {
		for _, app := range apps {
			if _, err := ApplicationKeyAtGeneration(mctx, team, app, ptkGen); err != nil {
				return err
			}
		}
	}
	return nil
}

func (l *TeamLoader) satisfiesNeedApplicationsAtGenerationsWithKBFS(mctx libkb.MetaContext,
	needApplicationsAtGenerations map[keybase1.PerTeamKeyGeneration][]keybase1.TeamApplication,
	state Teamer) error {
	if len(needApplicationsAtGenerations) == 0 {
		return nil
	}
	if state == nil || state.MainChain() == nil {
		return fmt.Errorf("nil team does not contain applications: %v", needApplicationsAtGenerations)
	}
	for ptkGen, apps := range needApplicationsAtGenerations {
		for _, app := range apps {
			if _, err := ApplicationKeyAtGenerationWithKBFS(mctx, state, app, ptkGen); err != nil {
				return err
			}
		}
	}
	return nil
}

// Whether the snapshot has each of `wantMembers` as a member.
func (l *TeamLoader) satisfiesWantMembers(mctx libkb.MetaContext,
	wantMembers []keybase1.UserVersion, wantMembersRole keybase1.TeamRole, state Teamer) error {

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
		role, err := newTeamSigChainState(state).GetUserRole(uv)
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
func (l *TeamLoader) isFresh(mctx libkb.MetaContext, cachedAt keybase1.Time) bool {
	if cachedAt.IsZero() {
		// This should never happen.
		mctx.Warning("TeamLoader encountered zero cached time")
		return false
	}
	diff := mctx.G().Clock().Now().Sub(cachedAt.Time())
	fresh := (diff <= freshnessLimit)
	if !fresh {
		mctx.Debug("TeamLoader cached snapshot is old: %v", diff)
	}
	return fresh
}

// Whether the teams secrets are synced to the same point as its sigchain
// Does not check RKMs.
func (l *TeamLoader) hasSyncedSecrets(mctx libkb.MetaContext, team Teamer) bool {
	state := team.MainChain()
	n := len(team.MainChain().Chain.PerTeamKeys)
	offChainGen := len(state.PerTeamKeySeedsUnverified)
	mctx.Debug("TeamLoader#hasSyncedSecrets: found %d PTKs on the main chain (versus %d seeds)", n, offChainGen)
	if team.HiddenChain() != nil {
		m := len(team.HiddenChain().ReaderPerTeamKeys)
		mctx.Debug("TeamLoader#hasSyncedSecrets: found another %d PTKs on the hidden chain", m)
		n += m
	}
	return (n == offChainGen)
}

func (l *TeamLoader) logIfUnsyncedSecrets(ctx context.Context, state *keybase1.TeamData) {
	onChainGen := keybase1.PerTeamKeyGeneration(len(state.Chain.PerTeamKeys))
	offChainGen := keybase1.PerTeamKeyGeneration(len(state.PerTeamKeySeedsUnverified))
	if onChainGen != offChainGen {
		l.G().Log.CDebugf(ctx, "TeamLoader unsynced secrets local:%v != chain:%v ", offChainGen, onChainGen)
	}
}

func (l *TeamLoader) lows(mctx libkb.MetaContext, state *keybase1.TeamData, hp *hidden.LoaderPackage) getLinksLows {
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
	if hp != nil {
		lows.HiddenChainSeqno = hp.LastFullSeqno()
	}
	return lows
}

func (l *TeamLoader) OnLogout(mctx libkb.MetaContext) error {
	l.storage.ClearMem()
	return nil
}

func (l *TeamLoader) OnDbNuke(mctx libkb.MetaContext) error {
	l.storage.ClearMem()
	return nil
}

// Clear the in-memory cache.
func (l *TeamLoader) ClearMem() {
	l.storage.ClearMem()
}

func (l *TeamLoader) VerifyTeamName(ctx context.Context, id keybase1.TeamID, name keybase1.TeamName) error {
	if name.IsRootTeam() {
		if !name.ToTeamID(id.IsPublic()).Eq(id) {
			return NewResolveError(name, id)
		}
		return nil
	}
	teamData, _, err := l.Load(ctx, keybase1.LoadTeamArg{
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
	impAdminsMap := make(map[string]keybase1.UserVersion) // map to remove dups
	err = l.MapTeamAncestors(ctx, func(t keybase1.TeamSigChainState) error {
		ancestorChain := TeamSigChainState{inner: t}
		// Gather the admins.
		adminRoles := []keybase1.TeamRole{keybase1.TeamRole_OWNER, keybase1.TeamRole_ADMIN}
		for _, role := range adminRoles {
			uvs, err := ancestorChain.GetUsersWithRole(role)
			if err != nil {
				return err
			}
			for _, uv := range uvs {
				impAdminsMap[uv.String()] = uv
			}
		}
		return nil
	}, teamID, "implicitAdminsAncestor", func(keybase1.TeamSigChainState) bool { return true })
	if err != nil {
		return nil, err
	}
	for _, uv := range impAdminsMap {
		impAdmins = append(impAdmins, uv)
	}
	return impAdmins, nil
}

// MapTeamAncestors does NOT map over the team itself.
func (l *TeamLoader) MapTeamAncestors(ctx context.Context, f func(t keybase1.TeamSigChainState) error, teamID keybase1.TeamID, reason string, forceFullReloadOnceToAssert func(t keybase1.TeamSigChainState) bool) (err error) {
	me, err := l.world.getMe(ctx)
	if err != nil {
		return err
	}

	// Load the argument team
	team, _, err := l.load1(ctx, me, keybase1.LoadTeamArg{
		ID:      teamID,
		Public:  teamID.IsPublic(),
		StaleOK: true, // We only use immutable fields.
	})
	if err != nil {
		return err
	}
	teamChain := TeamSigChainState{inner: team.Chain}
	if !teamChain.IsSubteam() {
		return fmt.Errorf("cannot map over parents of a root team: %v", teamID)
	}
	return l.mapTeamAncestorsHelper(ctx, f, teamID, teamChain.GetParentID(), reason, forceFullReloadOnceToAssert)
}

func (l *TeamLoader) mapTeamAncestorsHelper(ctx context.Context, f func(t keybase1.TeamSigChainState) error, teamID keybase1.TeamID, ancestorID *keybase1.TeamID, reason string, forceFullReloadOnceToAssert func(t keybase1.TeamSigChainState) bool) (err error) {
	me, err := l.world.getMe(ctx)
	if err != nil {
		return err
	}

	i := 0
	for {
		i++
		if i >= 100 {
			// Break in case there's a bug in this loop.
			return fmt.Errorf("stuck in a loop while mapping over team parents: %v", ancestorID)
		}

		load2Arg := load2ArgT{
			teamID:        *ancestorID,
			reason:        reason,
			me:            me,
			forceRepoll:   true, // Get the latest info.
			readSubteamID: &teamID,
		}

		var ancestor *load2ResT
		for {
			var err error
			// Use load2 so that we can use subteam-reader and get secretless teams.
			ancestor, err = l.load2(ctx, load2Arg)
			if err != nil {
				return err
			}

			if forceFullReloadOnceToAssert(ancestor.team.Chain) {
				break
			}
			if load2Arg.forceFullReload {
				return fmt.Errorf("failed to assert predicate in ancestor %v after full force reload", ancestor.team.ID())
			}
			load2Arg.forceFullReload = true
		}

		// Be wary, `ancestor` could be, and is likely, a secretless team.
		// Do not let it out of sight.
		ancestorChain := TeamSigChainState{inner: ancestor.team.Chain}

		err = f(ancestor.team.Chain)
		if err != nil {
			return err
		}

		if !ancestorChain.IsSubteam() {
			break
		}
		// Get the next level up.
		ancestorID = ancestorChain.GetParentID()
	}

	return nil
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
	defer mctx.Trace("TeamLoader#getHeadMerkleSeqno", func() error { return err })()

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
		return ret, NewInvalidLink(headLink, "wrong head link hash: %s != %s", headLink.LinkID(), expectedLink)
	}
	if headLink.isStubbed() {
		return ret, NewInvalidLink(headLink, "got a stubbed head link, but wasn't expecting that")
	}
	headMerkle := headLink.inner.Body.MerkleRoot.ToMerkleRootV2()
	state.HeadMerkle = &headMerkle
	return headMerkle.Seqno, nil
}

func (l *TeamLoader) audit(ctx context.Context, readSubteamID keybase1.TeamID, state *keybase1.TeamSigChainState, auditMode keybase1.AuditMode) (err error) {
	mctx := libkb.NewMetaContext(ctx, l.G())

	if l.G().Env.Test.TeamSkipAudit {
		mctx.Debug("skipping audit in test due to flag")
		return nil
	}

	headMerklSeqno, err := l.getHeadMerkleSeqno(mctx, readSubteamID, state)
	if err != nil {
		return err
	}

	err = mctx.G().GetTeamAuditor().AuditTeam(mctx, state.Id, state.Public, headMerklSeqno, state.LinkIDs, state.LastSeqno, auditMode)
	return err
}

func (l *TeamLoader) ForceRepollUntil(ctx context.Context, dtime gregor.TimeOrOffset) error {
	l.G().Log.CDebugf(ctx, "TeamLoader#ForceRepollUntil(%+v)", dtime)
	l.forceRepollMutex.Lock()
	defer l.forceRepollMutex.Unlock()
	l.forceRepollUntil = dtime
	return nil
}

func (l *TeamLoader) InForceRepollMode(mctx libkb.MetaContext) bool {
	l.forceRepollMutex.Lock()
	defer l.forceRepollMutex.Unlock()
	if l.forceRepollUntil == nil {
		return false
	}
	if !l.forceRepollUntil.Before(mctx.G().Clock().Now()) {
		mctx.Debug("TeamLoader#InForceRepollMode: returning true")
		return true
	}
	l.forceRepollUntil = nil
	return false
}
