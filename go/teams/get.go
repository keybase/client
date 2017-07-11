package teams

import (
	"encoding/json"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

func getInternalByStringName(ctx context.Context, g *libkb.GlobalContext, name string) (*Team, error) {
	return Load(ctx, g, keybase1.LoadTeamArg{
		Name:        name,
		ForceRepoll: true,
	})
}

func getInternal(ctx context.Context, g *libkb.GlobalContext, id keybase1.TeamID) (*Team, error) {
	return Load(ctx, g, keybase1.LoadTeamArg{
		ID:          id,
		ForceRepoll: true,
	})
}

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

func GetForTeamManagementByStringName(ctx context.Context, g *libkb.GlobalContext, name string) (*Team, error) {
	return getInternalByStringName(ctx, g, name)
}

func GetForTeamManagement(ctx context.Context, g *libkb.GlobalContext, id keybase1.TeamID) (*Team, error) {
	return getInternal(ctx, g, id)
}

func GetForApplication(ctx context.Context, g *libkb.GlobalContext, id keybase1.TeamID, app keybase1.TeamApplication, refreshers keybase1.TeamRefreshers) (*Team, error) {
	// TODO -- use the `application` and `refreshers` arguments
	return getInternal(ctx, g, id)
}

func GetStale(ctx context.Context, g *libkb.GlobalContext, id keybase1.TeamID) (*Team, error) {
	return Load(ctx, g, keybase1.LoadTeamArg{ID: id, StaleOK: true})
}

func GetStaleByStringName(ctx context.Context, g *libkb.GlobalContext, name string) (*Team, error) {
	return Load(ctx, g, keybase1.LoadTeamArg{Name: name, StaleOK: true})
}

func GetForApplicationByStringName(ctx context.Context, g *libkb.GlobalContext, name string, app keybase1.TeamApplication, refreshers keybase1.TeamRefreshers) (*Team, error) {
	teamName, err := keybase1.TeamNameFromString(name)
	if err != nil {
		return nil, err
	}
	return GetForApplicationByName(ctx, g, teamName, app, refreshers)
}

func GetForApplicationByName(ctx context.Context, g *libkb.GlobalContext, name keybase1.TeamName, app keybase1.TeamApplication, refreshers keybase1.TeamRefreshers) (*Team, error) {
	id, err := ResolveNameToID(ctx, g, name)
	if err != nil {
		return nil, err
	}
	return GetForApplication(ctx, g, id, app, refreshers)
}

func GetForChatByStringName(ctx context.Context, g *libkb.GlobalContext, s string, refreshers keybase1.TeamRefreshers) (*Team, error) {
	return GetForApplicationByStringName(ctx, g, s, keybase1.TeamApplication_CHAT, refreshers)
}
