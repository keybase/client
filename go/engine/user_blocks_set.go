package engine

import (
	"fmt"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

type UserBlocksSet struct {
	keybase1.SetUserBlocksArg
	libkb.Contextified

	uids []keybase1.UID
}

func NewUserBlocksSet(g *libkb.GlobalContext, args keybase1.SetUserBlocksArg) *UserBlocksSet {
	return &UserBlocksSet{
		SetUserBlocksArg: args,
		Contextified:     libkb.NewContextified(g),
	}
}

// Name is the unique engine name.
func (e *UserBlocksSet) Name() string {
	return "UserBlocksSet"
}

// GetPrereqs returns the engine prereqs.
func (e *UserBlocksSet) Prereqs() Prereqs {
	return Prereqs{}
}

// RequiredUIs returns the required UIs.
func (e *UserBlocksSet) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{}
}

// SubConsumers returns the other UI consumers for this engine.
func (e *UserBlocksSet) SubConsumers() []libkb.UIConsumer {
	return nil
}

// Run starts the engine.
func (e *UserBlocksSet) Run(mctx libkb.MetaContext) (err error) {
	defer mctx.Trace(
		fmt.Sprintf("UserBlocksSet#Run(len=%d)", len(e.Blocks)),
		&err)()

	type setBlockArg struct {
		BlockUID string `json:"block_uid"`
		Chat     *bool  `json:"chat,omitempty"`
		Follow   *bool  `json:"follow,omitempty"`
	}

	for _, block := range e.Blocks {
		mctx.Debug("SetUserBlocks: adding block: %+v", block)
	}
	payloadBlocks := make([]setBlockArg, len(e.Blocks))
	e.uids = make([]keybase1.UID, len(e.Blocks))
	for i, v := range e.Blocks {
		uid := libkb.GetUIDByUsername(mctx.G(), v.Username)
		payloadBlocks[i] = setBlockArg{
			BlockUID: uid.String(),
			Chat:     v.SetChatBlock,
			Follow:   v.SetFollowBlock,
		}
		e.uids[i] = uid
	}

	payload := make(libkb.JSONPayload)
	payload["blocks"] = payloadBlocks

	apiArg := libkb.APIArg{
		Endpoint:    "user/set_blocks",
		JSONPayload: payload,
		SessionType: libkb.APISessionTypeREQUIRED,
	}

	_, err = mctx.G().API.Post(mctx, apiArg)
	return err
}

func (e *UserBlocksSet) UIDs() []keybase1.UID {
	return e.uids
}
