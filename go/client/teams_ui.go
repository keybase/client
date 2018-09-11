package client

import (
	"fmt"
	"strings"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
)

type TeamsUI struct {
	libkb.Contextified
}

func NewTeamsUIProtocol(g *libkb.GlobalContext) rpc.Protocol {
	ui := &TeamsUI{
		Contextified: libkb.NewContextified(g),
	}
	return keybase1.TeamsUiProtocol(ui)
}

func (t *TeamsUI) ConfirmRootTeamDelete(ctx context.Context, arg keybase1.ConfirmRootTeamDeleteArg) (bool, error) {
	term := t.G().UI.GetTerminalUI()
	term.Printf("WARNING: This will:\n\n")
	term.Printf("(1) destroy all data in %s's chats, KBFS folders, and git repositories.\n", arg.TeamName)
	term.Printf("(2) prevent %q from being used again as a team name.\n\n", arg.TeamName)
	confirm := fmt.Sprintf("nuke %s", arg.TeamName)
	response, err := term.Prompt(PromptDescriptorDeleteRootTeam,
		fmt.Sprintf("** if you are sure, please type: %q > ", confirm))
	if err != nil {
		return false, err
	}
	return strings.TrimSpace(response) == confirm, nil
}

func (t *TeamsUI) ConfirmSubteamDelete(ctx context.Context, arg keybase1.ConfirmSubteamDeleteArg) (bool, error) {
	term := t.G().UI.GetTerminalUI()
	term.Printf("WARNING: This will destroy all data in %s's chats, KBFS folders, and git repositories.\n\n", arg.TeamName)
	confirm := fmt.Sprintf("nuke %s", arg.TeamName)
	response, err := term.Prompt(PromptDescriptorDeleteSubteam,
		fmt.Sprintf("** if you are sure, please type: %q > ", confirm))
	if err != nil {
		return false, err
	}
	return strings.TrimSpace(response) == confirm, nil
}
