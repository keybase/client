package client

import (
	"fmt"
	"io"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/net/context"
)

type contactSettingsAPIHandler struct {
	libkb.Contextified
	accountClient keybase1.AccountClient
	teamsClient   keybase1.TeamsClient
	indent        bool
}

func newContactSettingsAPIHandler(g *libkb.GlobalContext, indentOutput bool) *contactSettingsAPIHandler {
	return &contactSettingsAPIHandler{Contextified: libkb.NewContextified(g), indent: indentOutput}
}

func (t *contactSettingsAPIHandler) handle(ctx context.Context, c Call, w io.Writer) error {
	switch c.Params.Version {
	case 0, 1:
		return t.handleV1(ctx, c, w)
	default:
		return ErrInvalidVersion{version: c.Params.Version}
	}
}

const (
	getMethod = "get"
	setMethod = "set"
)

var validContactSettingsMethodsV1 = map[string]bool{
	getMethod: true,
	setMethod: true,
}

func (t *contactSettingsAPIHandler) handleV1(ctx context.Context, c Call, w io.Writer) error {
	if !validContactSettingsMethodsV1[c.Method] {
		return ErrInvalidMethod{name: c.Method, version: 1}
	}

	accountClient, err := GetAccountClient(t.G())
	if err != nil {
		return err
	}
	t.accountClient = accountClient

	teamsClient, err := GetTeamsClient(t.G())
	if err != nil {
		return err
	}
	t.teamsClient = teamsClient

	switch c.Method {
	case getMethod:
		return t.get(ctx, c, w)
	case setMethod:
		return t.set(ctx, c, w)
	default:
		return ErrInvalidMethod{name: c.Method, version: 1}
	}
}

type TeamContactSettingsWithTeamName struct {
	TeamName string `json:"team_name"`
	Enabled  bool   `json:"enabled"`
}

type ContactSettingsWithTeamNames struct {
	AllowFolloweeDegrees int                               `json:"allow_followee_degrees"`
	AllowGoodTeams       bool                              `json:"allow_good_teams"`
	Enabled              bool                              `json:"enabled"`
	Teams                []TeamContactSettingsWithTeamName `json:"teams"`
}

func (t *contactSettingsAPIHandler) get(ctx context.Context, c Call, w io.Writer) error {
	res, err := t.accountClient.UserGetContactSettings(ctx)
	if err != nil {
		return t.encodeErr(c, err, w)
	}
	cliRes := ContactSettingsWithTeamNames{
		AllowFolloweeDegrees: res.AllowFolloweeDegrees,
		AllowGoodTeams:       res.AllowGoodTeams,
		Enabled:              res.Enabled,
		Teams:                make([]TeamContactSettingsWithTeamName, len(res.Teams)),
	}
	for i, team := range res.Teams {
		name, err := t.teamsClient.GetTeamName(ctx, team.TeamID)
		if err != nil {
			return t.encodeErr(c,
				fmt.Errorf("Unexpected error resolving team ID (%v) to name", team.TeamID), w)
		}
		nameStr := name.String()
		cliRes.Teams[i] = TeamContactSettingsWithTeamName{
			TeamName: nameStr,
			Enabled:  team.Enabled,
		}
	}
	return t.encodeResult(c, cliRes, w)
}

type setOptions struct {
	Settings ContactSettingsWithTeamNames `json:"settings"`
}

func (a *setOptions) Check() error {
	// expect server-side checks
	return nil
}

func (t *contactSettingsAPIHandler) set(ctx context.Context, c Call, w io.Writer) error {
	var opts setOptions
	if err := unmarshalOptions(c, &opts); err != nil {
		return t.encodeErr(c, err, w)
	}
	cliArgs := opts.Settings
	args := keybase1.ContactSettings{
		AllowFolloweeDegrees: cliArgs.AllowFolloweeDegrees,
		AllowGoodTeams:       cliArgs.AllowGoodTeams,
		Enabled:              cliArgs.Enabled,
		Teams:                make([]keybase1.TeamContactSettings, len(cliArgs.Teams)),
	}
	for i, team := range cliArgs.Teams {
		// resolve team name
		tid, err := t.teamsClient.GetTeamID(ctx, team.TeamName)
		if err != nil {
			return t.encodeErr(c, fmt.Errorf("Failed to get team ID from team name %v", team.TeamName), w)
		}
		args.Teams[i] = keybase1.TeamContactSettings{
			TeamID:  tid,
			Enabled: team.Enabled}
	}
	err := t.accountClient.UserSetContactSettings(ctx, args)
	if err != nil {
		return t.encodeErr(c, err, w)
	}
	return t.get(ctx, c, w)
}

func (t *contactSettingsAPIHandler) encodeResult(call Call, result interface{}, w io.Writer) error {
	return encodeResult(call, result, w, t.indent)
}

func (t *contactSettingsAPIHandler) encodeErr(call Call, err error, w io.Writer) error {
	return encodeErr(call, err, w, t.indent)
}
