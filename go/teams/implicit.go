package teams

import (
	"fmt"
	"sort"

	"github.com/keybase/client/go/kbfs"
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

// Lookup an implicit team by name like "alice,bob+bob@twitter (conflicted copy 2017-03-04 #1)"
// Resolves social assertions.
func LookupImplicitTeam(ctx context.Context, g *libkb.GlobalContext, displayName string, public bool) (
	team *Team, teamName keybase1.TeamName, impTeamName keybase1.ImplicitTeamDisplayName, err error) {

	team, teamName, impTeamName, _, err = LookupImplicitTeamAndConflicts(ctx, g, displayName, public)
	return team, teamName, impTeamName, err
}

// Lookup an implicit team by name like "alice,bob+bob@twitter (conflicted copy 2017-03-04 #1)"
// Resolves social assertions.
func LookupImplicitTeamAndConflicts(ctx context.Context, g *libkb.GlobalContext, displayName string, public bool) (
	team *Team, teamName keybase1.TeamName, impTeamName keybase1.ImplicitTeamDisplayName, conflicts []keybase1.ImplicitTeamConflictInfo, err error) {
	impName, err := ResolveImplicitTeamDisplayName(ctx, g, displayName, public)
	if err != nil {
		return team, teamName, impTeamName, conflicts, err
	}
	return lookupImplicitTeamAndConflicts(ctx, g, displayName, impName)
}

func LookupImplicitTeamIDUntrusted(ctx context.Context, g *libkb.GlobalContext, displayName string,
	public bool) (res keybase1.TeamID, err error) {
	imp, err := loadImpteamFromServer(ctx, g, displayName, public)
	if err != nil {
		return res, err
	}
	return imp.TeamID, nil
}

func loadImpteamFromServer(ctx context.Context, g *libkb.GlobalContext, displayName string, public bool) (imp implicitTeam, err error) {
	arg := libkb.NewAPIArgWithNetContext(ctx, "team/implicit")
	arg.SessionType = libkb.APISessionTypeOPTIONAL
	arg.Args = libkb.HTTPArgs{
		"display_name": libkb.S{Val: displayName},
		"public":       libkb.B{Val: public},
	}
	if err = g.API.GetDecode(arg, &imp); err != nil {
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

// Lookup an implicit team by name like "alice,bob+bob@twitter (conflicted copy 2017-03-04 #1)"
// Does not resolve social assertions.
// preResolveDisplayName is used for logging and errors
func lookupImplicitTeamAndConflicts(ctx context.Context, g *libkb.GlobalContext,
	preResolveDisplayName string, impTeamNameInput keybase1.ImplicitTeamDisplayName) (
	team *Team, teamName keybase1.TeamName, impTeamName keybase1.ImplicitTeamDisplayName, conflicts []keybase1.ImplicitTeamConflictInfo, err error) {

	defer g.CTraceTimed(ctx, fmt.Sprintf("lookupImplicitTeamAndConflicts(%v)", preResolveDisplayName), func() error { return err })()

	impTeamName = impTeamNameInput

	// Use a copy without the conflict info to hit the api endpoint
	var impTeamNameWithoutConflict keybase1.ImplicitTeamDisplayName
	impTeamNameWithoutConflict = impTeamName
	impTeamNameWithoutConflict.ConflictInfo = nil
	lookupNameWithoutConflict, err := FormatImplicitTeamDisplayName(ctx, g, impTeamNameWithoutConflict)
	if err != nil {
		return team, teamName, impTeamName, conflicts, err
	}
	imp, err := loadImpteamFromServer(ctx, g, lookupNameWithoutConflict, impTeamName.IsPublic)
	if err != nil {
		return team, teamName, impTeamName, conflicts, err
	}
	if len(imp.Conflicts) > 0 {
		g.Log.CDebugf(ctx, "LookupImplicitTeam found %v conflicts", len(imp.Conflicts))
	}
	// We will use this team. Changed later if we selected a conflict.
	var foundSelectedConflict bool
	teamID := imp.TeamID
	for i, conflict := range imp.Conflicts {
		g.Log.CDebugf(ctx, "| checking conflict: %+v (iter %d)", conflict, i)
		conflictInfo, err := conflict.parse()

		if err != nil {
			// warn, don't fail
			g.Log.CWarningf(ctx, "LookupImplicitTeam got conflict suffix: %v", err)
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
		return team, teamName, impTeamName, conflicts, NewTeamDoesNotExistError(
			impTeamName.IsPublic, "could not find team with suffix: %v", preResolveDisplayName)
	}
	team, err = Load(ctx, g, keybase1.LoadTeamArg{
		ID:          teamID,
		Public:      impTeamName.IsPublic,
		ForceRepoll: true,
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

func isDupImplicitTeamError(ctx context.Context, err error) bool {
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

// LookupOrCreateImplicitTeam by name like "alice,bob+bob@twitter (conflicted copy 2017-03-04 #1)"
// Resolves social assertions.
func LookupOrCreateImplicitTeam(ctx context.Context, g *libkb.GlobalContext, displayName string, public bool) (res *Team, teamName keybase1.TeamName, impTeamName keybase1.ImplicitTeamDisplayName, err error) {
	defer g.CTraceTimed(ctx, fmt.Sprintf("LookupOrCreateImplicitTeam(%v)", displayName),
		func() error { return err })()
	lookupName, err := ResolveImplicitTeamDisplayName(ctx, g, displayName, public)
	if err != nil {
		return res, teamName, impTeamName, err
	}

	res, teamName, impTeamName, _, err = lookupImplicitTeamAndConflicts(ctx, g, displayName, lookupName)
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
				if isDupImplicitTeamError(ctx, err) {
					g.Log.CDebugf(ctx, "LookupOrCreateImplicitTeam: duplicate team, trying to lookup again: err: %s", err)
					res, teamName, impTeamName, _, err = lookupImplicitTeamAndConflicts(ctx, g, displayName,
						lookupName)
				}
				return res, teamName, impTeamName, err
			}
			res, err = Load(ctx, g, keybase1.LoadTeamArg{
				ID:          teamID,
				Public:      impTeamName.IsPublic,
				ForceRepoll: true,
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
	if impTeamName.ConflictInfo != nil && impTeamName.ConflictInfo.IsConflict() {
		suffix = libkb.FormatImplicitTeamDisplayNameSuffix(*impTeamName.ConflictInfo)
	}

	if len(writerNames) == 0 {
		return "", fmt.Errorf("invalid implicit team name: no writers")
	}

	return kbfs.NormalizeNamesInTLF(g, writerNames, readerNames, suffix)
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
