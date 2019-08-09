package teams

import (
	"fmt"
	"sort"
	"strings"

	lru "github.com/hashicorp/golang-lru"
	"github.com/keybase/client/go/kbfs/tlf"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/net/context"
)

type implicitTeamConflict struct {
	// Note this TeamID is not validated by LookupImplicitTeam. Be aware of server trust.
	TeamID       keybase1.TeamID `json:"team_id"`
	Generation   int             `json:"generation"`
	ConflictDate string          `json:"conflict_date"`
}

func (i *implicitTeamConflict) parse() (*keybase1.ImplicitTeamConflictInfo, error) {
	return libkb.ParseImplicitTeamDisplayNameSuffix(fmt.Sprintf("(conflicted copy %s #%d)", i.ConflictDate, i.Generation))
}

type implicitTeam struct {
	TeamID      keybase1.TeamID        `json:"team_id"`
	DisplayName string                 `json:"display_name"`
	Private     bool                   `json:"is_private"`
	Conflicts   []implicitTeamConflict `json:"conflicts,omitempty"`
	Status      libkb.AppStatus        `json:"status"`
}

func (i *implicitTeam) GetAppStatus() *libkb.AppStatus {
	return &i.Status
}

type ImplicitTeamOptions struct {
	NoForceRepoll bool
}

// Lookup an implicit team by name like "alice,bob+bob@twitter (conflicted copy 2017-03-04 #1)"
// Resolves social assertions.
func LookupImplicitTeam(ctx context.Context, g *libkb.GlobalContext, displayName string, public bool, opts ImplicitTeamOptions) (
	team *Team, teamName keybase1.TeamName, impTeamName keybase1.ImplicitTeamDisplayName, err error) {
	team, teamName, impTeamName, _, err = LookupImplicitTeamAndConflicts(ctx, g, displayName, public, opts)
	return team, teamName, impTeamName, err
}

// Lookup an implicit team by name like "alice,bob+bob@twitter (conflicted copy 2017-03-04 #1)"
// Resolves social assertions.
func LookupImplicitTeamAndConflicts(ctx context.Context, g *libkb.GlobalContext, displayName string, public bool, opts ImplicitTeamOptions) (
	team *Team, teamName keybase1.TeamName, impTeamName keybase1.ImplicitTeamDisplayName, conflicts []keybase1.ImplicitTeamConflictInfo, err error) {
	impName, err := ResolveImplicitTeamDisplayName(ctx, g, displayName, public)
	if err != nil {
		return team, teamName, impTeamName, conflicts, err
	}
	return lookupImplicitTeamAndConflicts(ctx, g, displayName, impName, opts)
}

func LookupImplicitTeamIDUntrusted(ctx context.Context, g *libkb.GlobalContext, displayName string,
	public bool) (res keybase1.TeamID, err error) {
	imp, _, err := loadImpteam(ctx, g, displayName, public, false /* skipCache */)
	if err != nil {
		return res, err
	}
	return imp.TeamID, nil
}

func loadImpteam(ctx context.Context, g *libkb.GlobalContext, displayName string, public bool, skipCache bool) (imp implicitTeam, hitCache bool, err error) {
	cacheKey := impTeamCacheKey(displayName, public)
	cacher := g.GetImplicitTeamCacher()
	if !skipCache && cacher != nil {
		if cv, ok := cacher.Get(cacheKey); ok {
			if imp, ok := cv.(implicitTeam); ok {
				g.Log.CDebugf(ctx, "using cached iteam")
				return imp, true, nil
			}
			g.Log.CDebugf(ctx, "Bad element of wrong type from cache: %T", cv)
		}
	}
	imp, err = loadImpteamFromServer(ctx, g, displayName, public)
	if err != nil {
		return imp, false, err
	}
	// If the team has any assertions skip caching.
	if cacher != nil && !strings.Contains(imp.DisplayName, "@") {
		cacher.Put(cacheKey, imp)
	}
	return imp, false, nil
}

func loadImpteamFromServer(ctx context.Context, g *libkb.GlobalContext, displayName string, public bool) (imp implicitTeam, err error) {
	mctx := libkb.NewMetaContext(ctx, g)
	arg := libkb.NewAPIArg("team/implicit")
	arg.SessionType = libkb.APISessionTypeOPTIONAL
	arg.Args = libkb.HTTPArgs{
		"display_name": libkb.S{Val: displayName},
		"public":       libkb.B{Val: public},
	}
	if err = mctx.G().API.GetDecode(mctx, arg, &imp); err != nil {
		if aerr, ok := err.(libkb.AppStatusError); ok {
			code := keybase1.StatusCode(aerr.Code)
			switch code {
			case keybase1.StatusCode_SCTeamReadError:
				return imp, NewTeamDoesNotExistError(public, displayName)
			case keybase1.StatusCode_SCTeamProvisionalCanKey, keybase1.StatusCode_SCTeamProvisionalCannotKey:
				return imp, libkb.NewTeamProvisionalError(
					(code == keybase1.StatusCode_SCTeamProvisionalCanKey), public, displayName)
			}
		}
		return imp, err
	}
	return imp, nil
}

// attemptLoadImpteamAndConflits attempts to lead the implicit team with
// conflict, but it might find the team but not the specific conflict if the
// conflict was not in cache. This can be detected with `hitCache` return
// value, and mitigated by passing skipCache=false argument.
func attemptLoadImpteamAndConflict(ctx context.Context, g *libkb.GlobalContext, impTeamName keybase1.ImplicitTeamDisplayName,
	nameWithoutConflict string, preResolveDisplayName string, skipCache bool) (conflicts []keybase1.ImplicitTeamConflictInfo, teamID keybase1.TeamID, hitCache bool, err error) {

	defer g.CTraceTimed(ctx,
		fmt.Sprintf("attemptLoadImpteamAndConflict(impName=%q,woConflict=%q,preResolve=%q,skipCache=%t)", impTeamName, nameWithoutConflict, preResolveDisplayName, skipCache),
		func() error { return err })()
	imp, hitCache, err := loadImpteam(ctx, g, nameWithoutConflict, impTeamName.IsPublic, skipCache)
	if err != nil {
		return conflicts, teamID, hitCache, err
	}
	if len(imp.Conflicts) > 0 {
		g.Log.CDebugf(ctx, "LookupImplicitTeam found %v conflicts", len(imp.Conflicts))
	}
	// We will use this team. Changed later if we selected a conflict.
	var foundSelectedConflict bool
	teamID = imp.TeamID
	// We still need to iterate over Conflicts because we are returning parsed
	// conflict list. So even if caller is not requesting a conflict team, go
	// through this loop.
	for i, conflict := range imp.Conflicts {
		g.Log.CDebugf(ctx, "| checking conflict: %+v (iter %d)", conflict, i)
		conflictInfo, err := conflict.parse()

		if err != nil {
			// warn, don't fail
			g.Log.CDebugf(ctx, "LookupImplicitTeam got conflict suffix: %v", err)
			err = nil
			continue
		}
		conflicts = append(conflicts, *conflictInfo)

		if conflictInfo == nil {
			g.Log.CDebugf(ctx, "| got unexpected nil conflictInfo (iter %d)", i)
			continue
		}

		g.Log.CDebugf(ctx, "| parsed conflict into conflictInfo: %+v", *conflictInfo)

		if impTeamName.ConflictInfo != nil {
			match := libkb.FormatImplicitTeamDisplayNameSuffix(*impTeamName.ConflictInfo) == libkb.FormatImplicitTeamDisplayNameSuffix(*conflictInfo)
			if match {
				teamID = conflict.TeamID
				foundSelectedConflict = true
				g.Log.CDebugf(ctx, "| found conflict suffix match: %v", teamID)
			} else {
				g.Log.CDebugf(ctx, "| conflict suffix didn't match (teamID %v)", conflict.TeamID)
			}
		}
	}
	if impTeamName.ConflictInfo != nil && !foundSelectedConflict {
		// We got the team but didn't find the specific conflict requested.
		return conflicts, teamID, hitCache, NewTeamDoesNotExistError(
			impTeamName.IsPublic, "could not find team with suffix: %v", preResolveDisplayName)
	}
	return conflicts, teamID, hitCache, nil
}

// Lookup an implicit team by name like "alice,bob+bob@twitter (conflicted copy 2017-03-04 #1)"
// Does not resolve social assertions.
// preResolveDisplayName is used for logging and errors
func lookupImplicitTeamAndConflicts(ctx context.Context, g *libkb.GlobalContext,
	preResolveDisplayName string, impTeamNameInput keybase1.ImplicitTeamDisplayName, opts ImplicitTeamOptions) (
	team *Team, teamName keybase1.TeamName, impTeamName keybase1.ImplicitTeamDisplayName, conflicts []keybase1.ImplicitTeamConflictInfo, err error) {

	defer g.CTraceTimed(ctx, fmt.Sprintf("lookupImplicitTeamAndConflicts(%v,opts=%+v)", preResolveDisplayName, opts), func() error { return err })()

	impTeamName = impTeamNameInput

	// Use a copy without the conflict info to hit the api endpoint
	var impTeamNameWithoutConflict keybase1.ImplicitTeamDisplayName
	impTeamNameWithoutConflict = impTeamName
	impTeamNameWithoutConflict.ConflictInfo = nil
	lookupNameWithoutConflict, err := FormatImplicitTeamDisplayName(ctx, g, impTeamNameWithoutConflict)
	if err != nil {
		return team, teamName, impTeamName, conflicts, err
	}

	// Try the load first -- once with a cache, and once nameWithoutConflict.
	var teamID keybase1.TeamID
	var hitCache bool
	conflicts, teamID, hitCache, err = attemptLoadImpteamAndConflict(ctx, g, impTeamName, lookupNameWithoutConflict, preResolveDisplayName, false /* skipCache */)
	if _, dne := err.(TeamDoesNotExistError); dne && hitCache {
		// We are looking for conflict team that we didn't find. Maybe we have the team
		// cached from before another team was resolved and this team became conflicted.
		// Try again skipping cache.
		g.Log.CDebugf(ctx, "attemptLoadImpteamAndConflict failed to load team %q from cache, trying again skipping cache", preResolveDisplayName)
		conflicts, teamID, _, err = attemptLoadImpteamAndConflict(ctx, g, impTeamName, lookupNameWithoutConflict, preResolveDisplayName, true /* skipCache */)
	}
	if err != nil {
		return team, teamName, impTeamName, conflicts, err
	}

	team, err = Load(ctx, g, keybase1.LoadTeamArg{
		ID:          teamID,
		Public:      impTeamName.IsPublic,
		ForceRepoll: !opts.NoForceRepoll,
	})
	if err != nil {
		return team, teamName, impTeamName, conflicts, err
	}

	// Check the display names. This is how we make sure the server returned a team with the right members.
	teamDisplayName, err := team.ImplicitTeamDisplayNameString(ctx)
	if err != nil {
		return team, teamName, impTeamName, conflicts, err
	}
	referenceImpName, err := FormatImplicitTeamDisplayName(ctx, g, impTeamName)
	if err != nil {
		return team, teamName, impTeamName, conflicts, err
	}
	if teamDisplayName != referenceImpName {
		return team, teamName, impTeamName, conflicts, fmt.Errorf("implicit team name mismatch: %s != %s",
			teamDisplayName, referenceImpName)
	}
	if team.IsPublic() != impTeamName.IsPublic {
		return team, teamName, impTeamName, conflicts, fmt.Errorf("implicit team public-ness mismatch: %v != %v", team.IsPublic(), impTeamName.IsPublic)
	}

	return team, team.Name(), impTeamName, conflicts, nil
}

func isDupImplicitTeamError(err error) bool {
	if err != nil {
		if aerr, ok := err.(libkb.AppStatusError); ok {
			code := keybase1.StatusCode(aerr.Code)
			switch code {
			case keybase1.StatusCode_SCTeamImplicitDuplicate:
				return true
			}
		}
	}
	return false
}

func assertIsDisplayNameNormalized(displayName keybase1.ImplicitTeamDisplayName) error {
	var errs []error
	for _, userSet := range []keybase1.ImplicitTeamUserSet{displayName.Writers, displayName.Readers} {
		for _, username := range userSet.KeybaseUsers {
			if !libkb.IsLowercase(username) {
				errs = append(errs, fmt.Errorf("Keybase username %q has mixed case", username))
			}
		}
		for _, assertion := range userSet.UnresolvedUsers {
			if !libkb.IsLowercase(assertion.User) {
				errs = append(errs, fmt.Errorf("User %q in assertion %q has mixed case", assertion.User, assertion.String()))
			}
		}
	}
	return libkb.CombineErrors(errs...)
}

// LookupOrCreateImplicitTeam by name like "alice,bob+bob@twitter (conflicted copy 2017-03-04 #1)"
// Resolves social assertions.
func LookupOrCreateImplicitTeam(ctx context.Context, g *libkb.GlobalContext, displayName string, public bool) (res *Team, teamName keybase1.TeamName, impTeamName keybase1.ImplicitTeamDisplayName, err error) {
	ctx = libkb.WithLogTag(ctx, "LOCIT")
	defer g.CTraceTimed(ctx, fmt.Sprintf("LookupOrCreateImplicitTeam(%v)", displayName),
		func() error { return err })()
	lookupName, err := ResolveImplicitTeamDisplayName(ctx, g, displayName, public)
	if err != nil {
		return res, teamName, impTeamName, err
	}

	if err := assertIsDisplayNameNormalized(lookupName); err != nil {
		// Do not allow display names with mixed letter case - while it's legal
		// to create them, it will not be possible to load them because API
		// server always downcases during normalization.
		return res, teamName, impTeamName, fmt.Errorf("Display name is not normalized: %s", err)
	}

	res, teamName, impTeamName, _, err = lookupImplicitTeamAndConflicts(ctx, g, displayName, lookupName, ImplicitTeamOptions{})
	if err != nil {
		if _, ok := err.(TeamDoesNotExistError); ok {
			if lookupName.ConflictInfo != nil {
				// Don't create it if a conflict is specified.
				// Unlikely a caller would know the conflict info if it didn't exist.
				return res, teamName, impTeamName, err
			}
			// If the team does not exist, then let's create it
			impTeamName = lookupName
			var teamID keybase1.TeamID
			teamID, teamName, err = CreateImplicitTeam(ctx, g, impTeamName)
			if err != nil {
				if isDupImplicitTeamError(err) {
					g.Log.CDebugf(ctx, "LookupOrCreateImplicitTeam: duplicate team, trying to lookup again: err: %s", err)
					res, teamName, impTeamName, _, err = lookupImplicitTeamAndConflicts(ctx, g, displayName,
						lookupName, ImplicitTeamOptions{})
				}
				return res, teamName, impTeamName, err
			}
			res, err = Load(ctx, g, keybase1.LoadTeamArg{
				ID:          teamID,
				Public:      impTeamName.IsPublic,
				ForceRepoll: true,
				SkipAudit:   true,
			})
			return res, teamName, impTeamName, err
		}
		return res, teamName, impTeamName, err
	}
	return res, teamName, impTeamName, nil
}

func FormatImplicitTeamDisplayName(ctx context.Context, g *libkb.GlobalContext, impTeamName keybase1.ImplicitTeamDisplayName) (string, error) {
	return formatImplicitTeamDisplayNameCommon(ctx, g, impTeamName, nil)
}

// Format an implicit display name, but order the specified username first in each of the writer and reader lists if it appears.
func FormatImplicitTeamDisplayNameWithUserFront(ctx context.Context, g *libkb.GlobalContext, impTeamName keybase1.ImplicitTeamDisplayName, frontName libkb.NormalizedUsername) (string, error) {
	return formatImplicitTeamDisplayNameCommon(ctx, g, impTeamName, &frontName)
}

func formatImplicitTeamDisplayNameCommon(ctx context.Context, g *libkb.GlobalContext, impTeamName keybase1.ImplicitTeamDisplayName, optionalFrontName *libkb.NormalizedUsername) (string, error) {
	var writerNames []string
	for _, u := range impTeamName.Writers.KeybaseUsers {
		writerNames = append(writerNames, u)
	}
	for _, u := range impTeamName.Writers.UnresolvedUsers {
		writerNames = append(writerNames, u.String())
	}
	if optionalFrontName == nil {
		sort.Strings(writerNames)
	} else {
		sortStringsFront(writerNames, optionalFrontName.String())
	}

	var readerNames []string
	for _, u := range impTeamName.Readers.KeybaseUsers {
		readerNames = append(readerNames, u)
	}
	for _, u := range impTeamName.Readers.UnresolvedUsers {
		readerNames = append(readerNames, u.String())
	}
	if optionalFrontName == nil {
		sort.Strings(readerNames)
	} else {
		sortStringsFront(readerNames, optionalFrontName.String())
	}

	var suffix string
	if impTeamName.ConflictInfo.IsConflict() {
		suffix = libkb.FormatImplicitTeamDisplayNameSuffix(*impTeamName.ConflictInfo)
	}

	if len(writerNames) == 0 {
		return "", fmt.Errorf("invalid implicit team name: no writers")
	}

	return tlf.NormalizeNamesInTLF(libkb.NewMetaContext(ctx, g), writerNames, readerNames, suffix)
}

// Sort a list of strings but order `front` in front IF it appears.
func sortStringsFront(ss []string, front string) {
	sort.Slice(ss, func(i, j int) bool {
		a := ss[i]
		b := ss[j]
		if a == front {
			return true
		}
		if b == front {
			return false
		}
		return a < b
	})
}

func impTeamCacheKey(displayName string, public bool) string {
	return fmt.Sprintf("%s-%v", displayName, public)
}

type implicitTeamCache struct {
	cache *lru.Cache
}

func newImplicitTeamCache(g *libkb.GlobalContext) *implicitTeamCache {
	cache, err := lru.New(libkb.ImplicitTeamCacheSize)
	if err != nil {
		panic(err)
	}
	return &implicitTeamCache{
		cache: cache,
	}
}

func (i *implicitTeamCache) Get(key interface{}) (interface{}, bool) {
	return i.cache.Get(key)
}

func (i *implicitTeamCache) Put(key, value interface{}) bool {
	return i.cache.Add(key, value)
}

func (i *implicitTeamCache) OnLogout(m libkb.MetaContext) error {
	i.cache.Purge()
	return nil
}

func (i *implicitTeamCache) OnDbNuke(m libkb.MetaContext) error {
	i.cache.Purge()
	return nil
}

var _ libkb.MemLRUer = &implicitTeamCache{}

func NewImplicitTeamCacheAndInstall(g *libkb.GlobalContext) {
	cache := newImplicitTeamCache(g)
	g.SetImplicitTeamCacher(cache)
	g.AddLogoutHook(cache, "implicitTeamCache")
	g.AddDbNukeHook(cache, "implicitTeamCache")
}
