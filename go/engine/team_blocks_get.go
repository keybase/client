package engine

import (
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

type TeamBlocksGet struct {
	libkb.Contextified

	blocks []keybase1.TeamBlock
}

func NewTeamBlocksGet(g *libkb.GlobalContext) *TeamBlocksGet {
	return &TeamBlocksGet{
		Contextified: libkb.NewContextified(g),
	}
}

// Name is the unique engine name.
func (e *TeamBlocksGet) Name() string {
	return "TeamBlocksGet"
}

// GetPrereqs returns the engine prereqs.
func (e *TeamBlocksGet) Prereqs() Prereqs {
	return Prereqs{}
}

// RequiredUIs returns the required UIs.
func (e *TeamBlocksGet) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{}
}

// SubConsumers returns the other UI consumers for this engine.
func (e *TeamBlocksGet) SubConsumers() []libkb.UIConsumer {
	return nil
}

// Run starts the engine.
func (e *TeamBlocksGet) Run(mctx libkb.MetaContext) (err error) {
	defer mctx.Trace("TeamBlocksGet#Run", &err)()
	apiArg := libkb.APIArg{
		Endpoint:    "team/blocks",
		SessionType: libkb.APISessionTypeREQUIRED,
	}

	type getBlockResult struct {
		libkb.AppStatusEmbed
		TeamBlocks []keybase1.TeamBlock `json:"team_blocks"`
	}

	var apiRes getBlockResult
	err = mctx.G().API.GetDecode(mctx, apiArg, &apiRes)
	if err != nil {
		return err
	}

	e.blocks = apiRes.TeamBlocks

	return nil
}

func (e *TeamBlocksGet) Blocks() []keybase1.TeamBlock {
	return e.blocks
}
