package stellarcommon

import (
	"context"
	"fmt"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/teams"
	"github.com/keybase/stellarnet"
)

type RecipientInput string

type Recipient struct {
	Input RecipientInput
	// These 3 fields are nullable.
	User      *libkb.User
	Assertion *keybase1.SocialAssertion
	// Recipient may not have a stellar wallet ready to receive
	AccountID *stellarnet.AddressStr // User entered G... OR target has receiving address
}

func GetImplicitTeamForRecipient(ctx context.Context, g *libkb.GlobalContext,
	recipient Recipient) (displayName string, teamID keybase1.TeamID, err error) {
	meUsername, err := g.GetUPAKLoader().LookupUsername(ctx, g.ActiveDevice.UID())
	if err != nil {
		return displayName, teamID, err
	}
	impTeamNameStruct := keybase1.ImplicitTeamDisplayName{
		Writers: keybase1.ImplicitTeamUserSet{
			KeybaseUsers: []string{meUsername.String()},
		},
	}
	switch {
	case recipient.User != nil:
		impTeamNameStruct.Writers.KeybaseUsers = append(impTeamNameStruct.Writers.KeybaseUsers, recipient.User.GetNormalizedName().String())
	case recipient.Assertion != nil:
		impTeamNameStruct.Writers.UnresolvedUsers = append(impTeamNameStruct.Writers.UnresolvedUsers, *recipient.Assertion)
	default:
		return displayName, teamID, fmt.Errorf("recipient unexpectly not user nor assertion: %v", recipient.Input)
	}
	impTeamDisplayName, err := teams.FormatImplicitTeamDisplayName(ctx, g, impTeamNameStruct)
	if err != nil {
		return displayName, teamID, err
	}
	team, _, _, err := teams.LookupOrCreateImplicitTeam(ctx, g, impTeamDisplayName, false /*public*/)
	if err != nil {
		return displayName, teamID, err
	}
	return impTeamDisplayName, team.ID, err
}
