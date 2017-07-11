package teams

import (
	"encoding/json"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

type rawTeam struct {
	ID             keybase1.TeamID                                        `json:"id"`
	Name           keybase1.TeamName                                      `json:"name"`
	Status         libkb.AppStatus                                        `json:"status"`
	Chain          []json.RawMessage                                      `json:"chain"`
	Box            *TeamBox                                               `json:"box"`
	Prevs          map[keybase1.PerTeamKeyGeneration]prevKeySealedEncoded `json:"prevs"`
	ReaderKeyMasks []keybase1.ReaderKeyMask                               `json:"reader_key_masks"`
	// Whether the user is only being allowed to view the chain
	// because they are a member of a descendent team.
	SubteamReader bool `json:"subteam_reader"`
}

func (r *rawTeam) GetAppStatus() *libkb.AppStatus {
	return &r.Status
}

func (r *rawTeam) parseLinks(ctx context.Context) ([]SCChainLink, error) {
	var links []SCChainLink
	for _, raw := range r.Chain {
		link, err := ParseTeamChainLink(string(raw))
		if err != nil {
			return nil, err
		}
		links = append(links, link)
	}
	return links, nil
}

// needAdmin must be set when interacting with links that have a possibility of being stubbed.
func GetForTeamManagementByStringName(ctx context.Context, g *libkb.GlobalContext, name string, needAdmin bool) (*Team, error) {
	return Load(ctx, g, keybase1.LoadTeamArg{
		Name:        name,
		ForceRepoll: true,
		NeedAdmin:   needAdmin,
	})
}

// Get a team with no stubbed links if we are an admin. Use this instead of NeedAdmin when you don't
// know whether you are an admin. This always causes roundtrips.
func GetMaybeAdminByStringName(ctx context.Context, g *libkb.GlobalContext, name string) (*Team, error) {
	// Find out our up-to-date role.
	team, err := Load(ctx, g, keybase1.LoadTeamArg{
		Name:        name,
		ForceRepoll: true,
	})
	if err != nil {
		return nil, err
	}
	me, err := loadUserVersionByUID(ctx, g, g.Env.GetUID())
	if err != nil {
		return nil, err
	}
	role, err := team.MemberRole(ctx, me)
	if err != nil {
		return nil, err
	}
	if role.IsAdminOrAbove() {
		// Will hit the cache _unless_ we had a cached non-admin team
		// and are now an admin.
		team, err = Load(ctx, g, keybase1.LoadTeamArg{
			Name:      name,
			NeedAdmin: true,
		})
		if err != nil {
			return nil, err
		}
	}
	return team, nil
}
