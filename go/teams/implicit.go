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

func LookupImplicitTeam(ctx context.Context, g *libkb.GlobalContext, displayName string, public bool) (
	teamID keybase1.TeamID, impTeamName keybase1.ImplicitTeamDisplayName, err error) {

	teamID, impTeamName, _, err = LookupImplicitTeamAndConflicts(ctx, g, displayName, public)
	return teamID, impTeamName, err
}

func LookupImplicitTeamAndConflicts(ctx context.Context, g *libkb.GlobalContext, displayName string, public bool) (
	res keybase1.TeamID, impTeamName keybase1.ImplicitTeamDisplayName, conflicts []keybase1.ImplicitTeamConflictInfo, err error) {

	impTeamName, err = libkb.ParseImplicitTeamDisplayName(g.MakeAssertionContext(), displayName, public /*isPublic*/)
	if err != nil {
		return res, impTeamName, conflicts, err
	}
	impTeamMembers := make(map[string]bool)
	for _, u := range impTeamName.Writers.KeybaseUsers {
		impTeamMembers[u] = true
	}

	arg := libkb.NewRetryAPIArg("team/implicit")
	arg.NetContext = ctx
	arg.SessionType = libkb.APISessionTypeREQUIRED
	arg.Args = libkb.HTTPArgs{
		"display_name": libkb.S{Val: displayName},
		"public":       libkb.B{Val: public},
	}
	var imp implicitTeam
	if err = g.API.GetDecode(arg, &imp); err != nil {
		if aerr, ok := err.(libkb.AppStatusError); ok &&
			keybase1.StatusCode(aerr.Code) == keybase1.StatusCode_SCTeamReadError {
			return res, impTeamName, conflicts, NewTeamDoesNotExistError(displayName)
		}
		return res, impTeamName, conflicts, err
	}
	if len(imp.Conflicts) > 0 {
		g.Log.CDebugf(ctx, "LookupImplicitTeam found %v conflicts", len(imp.Conflicts))
	}
	for _, conflict := range imp.Conflicts {
		conflictInfo, err := conflict.parse()
		if err != nil {
			// warn, don't fail
			g.Log.CWarningf(ctx, "LookupImplicitTeam got conflict suffix: %v", err)
		} else {
			conflicts = append(conflicts, *conflictInfo)
		}
	}
	team, err := Load(ctx, g, keybase1.LoadTeamArg{
		ID:          imp.TeamID,
		ForceRepoll: true,
	})
	if err != nil {
		return res, impTeamName, conflicts, err
	}

	teamDisplayName, err := team.ImplicitTeamDisplayNameString(ctx)
	if err != nil {
		return res, impTeamName, conflicts, err
	}
	formatImpName, err := FormatImplicitTeamDisplayName(ctx, g, impTeamName)
	if err != nil {
		return res, impTeamName, conflicts, err
	}
	if teamDisplayName != formatImpName {
		return res, impTeamName, conflicts, fmt.Errorf("implicit team name mismatch: %s != %s", teamDisplayName,
			formatImpName)
	}
	if team.IsPublic() != public {
		return res, impTeamName, conflicts, fmt.Errorf("implicit team public-ness mismatch: %v != %v", team.IsPublic(), public)
	}

	return imp.TeamID, impTeamName, conflicts, nil
}

func LookupOrCreateImplicitTeam(ctx context.Context, g *libkb.GlobalContext, displayName string, public bool) (res keybase1.TeamID, impTeamName keybase1.ImplicitTeamDisplayName, err error) {
	res, impTeamName, err = LookupImplicitTeam(ctx, g, displayName, public)
	if err != nil {
		if _, ok := err.(TeamDoesNotExistError); ok {
			// If the team does not exist, then let's create it
			impTeamName, err = libkb.ParseImplicitTeamDisplayName(g.MakeAssertionContext(), displayName, public /*isPublic*/)
			if err != nil {
				return res, impTeamName, err
			}
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
