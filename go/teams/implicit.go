package teams

import (
	"fmt"
	"sort"
	"time"

	"github.com/keybase/client/go/kbfs"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/net/context"
)

type implicitTeamConflict struct {
	TeamID       keybase1.TeamID `json:"team_id"`
	Generation   int             `json:"generation"`
	ConflictDate string          `json:"conflict_date"`
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

func LookupImplicitTeam(ctx context.Context, g *libkb.GlobalContext, name string, public bool) (res keybase1.TeamID, impTeamName keybase1.ImplicitTeamDisplayName, err error) {
	impTeamName, err = libkb.ParseImplicitTeamDisplayName(g.MakeAssertionContext(), name, public /*isPublic*/)
	if err != nil {
		return res, impTeamName, err
	}
	impTeamMembers := make(map[string]bool)
	for _, u := range impTeamName.Writers.KeybaseUsers {
		impTeamMembers[u] = true
	}

	arg := libkb.NewRetryAPIArg("team/implicit")
	arg.NetContext = ctx
	arg.SessionType = libkb.APISessionTypeREQUIRED
	arg.Args = libkb.HTTPArgs{
		"display_name": libkb.S{Val: name},
		"public":       libkb.B{Val: public},
	}
	var imp implicitTeam
	if err = g.API.GetDecode(arg, &imp); err != nil {
		if aerr, ok := err.(libkb.AppStatusError); ok &&
			keybase1.StatusCode(aerr.Code) == keybase1.StatusCode_SCTeamReadError {
			return res, impTeamName, NewTeamDoesNotExistError(name)
		}
		return res, impTeamName, err
	}
	team, err := Load(ctx, g, keybase1.LoadTeamArg{
		ID:          imp.TeamID,
		ForceRepoll: true,
	})
	if err != nil {
		return res, impTeamName, err
	}

	teamDisplayName, err := team.ImplicitTeamDisplayNameString(ctx)
	if err != nil {
		return res, impTeamName, err
	}
	formatImpName, err := FormatImplicitTeamDisplayName(ctx, g, impTeamName)
	if err != nil {
		return res, impTeamName, err
	}
	if teamDisplayName != formatImpName {
		return res, impTeamName, fmt.Errorf("implicit team name mismatch: %s != %s", teamDisplayName,
			formatImpName)
	}

	return imp.TeamID, impTeamName, nil
}

func LookupOrCreateImplicitTeam(ctx context.Context, g *libkb.GlobalContext, name string, public bool) (res keybase1.TeamID, impTeamName keybase1.ImplicitTeamDisplayName, err error) {
	res, impTeamName, err = LookupImplicitTeam(ctx, g, name, public)
	if err != nil {
		if _, ok := err.(TeamDoesNotExistError); ok {
			// If the team does not exist, then let's create it
			impTeamName, err = libkb.ParseImplicitTeamDisplayName(g.MakeAssertionContext(), name, public /*isPublic*/)
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
	var writerNames []string
	for _, u := range impTeamName.Writers.KeybaseUsers {
		writerNames = append(writerNames, u)
	}
	for _, u := range impTeamName.Writers.UnresolvedUsers {
		writerNames = append(writerNames, u.String())
	}
	sort.Slice(writerNames, func(i, j int) bool {
		return writerNames[i] < writerNames[j]
	})

	var readerNames []string
	for _, u := range impTeamName.Readers.KeybaseUsers {
		readerNames = append(readerNames, u)
	}
	for _, u := range impTeamName.Readers.UnresolvedUsers {
		readerNames = append(readerNames, u.String())
	}
	sort.Slice(readerNames, func(i, j int) bool {
		return readerNames[i] < readerNames[j]
	})

	var suffix string
	if impTeamName.ConflictInfo != nil {
		suffix = fmt.Sprintf("(conflicted %v #%v)", formatConflictTime(impTeamName.ConflictInfo.Time.Time()), impTeamName.ConflictInfo.Generation)
	}

	normalized, err := kbfs.NormalizeNamesInTLF(writerNames, readerNames, suffix)
	if err != nil {
		return "", err
	}
	prefix := "private/"
	if impTeamName.IsPublic {
		prefix = "public/"
	}
	return prefix + normalized, nil
}

// time -> "2017-08-22"
func formatConflictTime(thyme time.Time) string {
	year, month, day := thyme.UTC().Date()
	return fmt.Sprintf("%04d-%02d-%02d", year, month, day)
}
