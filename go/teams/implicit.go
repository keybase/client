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
	return libkb.ParseImplicitTeamDisplayNameSuffix(fmt.Sprintf("(conflicted %s #%d)", i.ConflictDate, i.Generation))
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

// does resolve
func LookupImplicitTeam(ctx context.Context, g *libkb.GlobalContext, displayName string, public bool) (
	teamID keybase1.TeamID, impTeamName keybase1.ImplicitTeamDisplayName, err error) {

	teamID, impTeamName, _, err = LookupImplicitTeamAndConflicts(ctx, g, displayName, public)
	return teamID, impTeamName, err
}

// does resolve
func LookupImplicitTeamAndConflicts(ctx context.Context, g *libkb.GlobalContext, displayName string, public bool) (
	teamID keybase1.TeamID, impTeamName keybase1.ImplicitTeamDisplayName, conflicts []keybase1.ImplicitTeamConflictInfo, err error) {
	impName, err := ResolveImplicitTeamDisplayName(ctx, g, displayName, public)
	if err != nil {
		return teamID, impTeamName, conflicts, err
	}
	return lookupImplicitTeamAndConflicts(ctx, g, displayName, impName)
}

// does not resolve
func lookupImplicitTeamAndConflicts(ctx context.Context, g *libkb.GlobalContext,
	preResolveDisplayName string, impTeamNameInput keybase1.ImplicitTeamDisplayName) (
	teamID keybase1.TeamID, impTeamName keybase1.ImplicitTeamDisplayName, conflicts []keybase1.ImplicitTeamConflictInfo, err error) {

	defer g.CTraceTimed(ctx, fmt.Sprintf("lookupImplicitTeamAndConflicts(%v)", preResolveDisplayName), func() error { return err })()

	impTeamName = impTeamNameInput

	// Use a copy without the conflict info to hit the api endpoint
	var impTeamNameWithoutConflict keybase1.ImplicitTeamDisplayName
	impTeamNameWithoutConflict = impTeamName
	impTeamNameWithoutConflict.ConflictInfo = nil
	lookupNameWithoutConflict, err := FormatImplicitTeamDisplayName(ctx, g, impTeamNameWithoutConflict)
	if err != nil {
		return teamID, impTeamName, conflicts, err
	}

	arg := libkb.NewRetryAPIArg("team/implicit")
	arg.NetContext = ctx
	arg.SessionType = libkb.APISessionTypeREQUIRED
	arg.Args = libkb.HTTPArgs{
		"display_name": libkb.S{Val: lookupNameWithoutConflict},
		"public":       libkb.B{Val: impTeamName.IsPublic},
	}
	var imp implicitTeam
	if err = g.API.GetDecode(arg, &imp); err != nil {
		if aerr, ok := err.(libkb.AppStatusError); ok &&
			keybase1.StatusCode(aerr.Code) == keybase1.StatusCode_SCTeamReadError {
			return teamID, impTeamName, conflicts, NewTeamDoesNotExistError(preResolveDisplayName)
		}
		return teamID, impTeamName, conflicts, err
	}
	if len(imp.Conflicts) > 0 {
		g.Log.CDebugf(ctx, "LookupImplicitTeam found %v conflicts", len(imp.Conflicts))
	}
	// We will use this team. Changed later if we selected a conflict.
	var foundSelectedConflict bool
	teamID = imp.TeamID
	for _, conflict := range imp.Conflicts {
		conflictInfo, err := conflict.parse()
		if err != nil {
			// warn, don't fail
			g.Log.CWarningf(ctx, "LookupImplicitTeam got conflict suffix: %v", err)
		} else {
			conflicts = append(conflicts, *conflictInfo)
		}
		if impTeamName.ConflictInfo != nil {
			match := libkb.FormatImplicitTeamDisplayNameSuffix(*impTeamName.ConflictInfo) == libkb.FormatImplicitTeamDisplayNameSuffix(*conflictInfo)
			if match {
				teamID = conflict.TeamID
				foundSelectedConflict = true
			}
		}
	}
	if impTeamName.ConflictInfo != nil && !foundSelectedConflict {
		// We got the team but didn't find the specific conflict requested.
		return teamID, impTeamName, conflicts, NewTeamDoesNotExistError("could not find team with suffix: %v", preResolveDisplayName)
	}
	team, err := Load(ctx, g, keybase1.LoadTeamArg{
		ID:          imp.TeamID,
		ForceRepoll: true,
	})
	if err != nil {
		return teamID, impTeamName, conflicts, err
	}

	// Check the display names. This is how we make sure the server returned a team with the right members.
	teamDisplayName, err := team.ImplicitTeamDisplayNameString(ctx)
	if err != nil {
		return teamID, impTeamName, conflicts, err
	}
	referenceImpName, err := FormatImplicitTeamDisplayName(ctx, g, impTeamNameWithoutConflict)
	if err != nil {
		return teamID, impTeamName, conflicts, err
	}
	if teamDisplayName != referenceImpName {
		return teamID, impTeamName, conflicts, fmt.Errorf("implicit team name mismatch: %s != %s",
			teamDisplayName, referenceImpName)
	}
	if team.IsPublic() != impTeamName.IsPublic {
		return teamID, impTeamName, conflicts, fmt.Errorf("implicit team public-ness mismatch: %v != %v", team.IsPublic(), impTeamName.IsPublic)
	}

	return teamID, impTeamName, conflicts, nil
}

// does resolve
func LookupOrCreateImplicitTeam(ctx context.Context, g *libkb.GlobalContext, displayName string, public bool) (res keybase1.TeamID, impTeamName keybase1.ImplicitTeamDisplayName, err error) {
	lookupName, err := ResolveImplicitTeamDisplayName(ctx, g, displayName, public)
	if err != nil {
		return res, impTeamName, err
	}

	res, impTeamName, _, err = lookupImplicitTeamAndConflicts(ctx, g, displayName, lookupName)
	if err != nil {
		if _, ok := err.(TeamDoesNotExistError); ok {
			if lookupName.ConflictInfo != nil {
				// Don't create it if a conflict is specified.
				// Unlikely a caller would know the conflict info if it didn't exist.
				return res, impTeamName, err
			}
			// If the team does not exist, then let's create it
			impTeamName = lookupName
			res, err = CreateImplicitTeam(ctx, g, impTeamName)
			return res, impTeamName, err
		}
		return res, impTeamName, err
	}
	return res, impTeamName, nil
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
	if impTeamName.ConflictInfo != nil {
		suffix = libkb.FormatImplicitTeamDisplayNameSuffix(*impTeamName.ConflictInfo)
	}

	if len(writerNames) == 0 {
		return "", fmt.Errorf("invalid implicit team name: no writers")
	}

	return kbfs.NormalizeNamesInTLF(writerNames, readerNames, suffix)
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
