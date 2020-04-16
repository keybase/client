package engine

import (
	"fmt"
	"strings"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

type UserBlocksGet struct {
	keybase1.GetUserBlocksArg
	libkb.Contextified

	blocks []keybase1.UserBlock
}

func NewUserBlocksGet(g *libkb.GlobalContext, args keybase1.GetUserBlocksArg) *UserBlocksGet {
	return &UserBlocksGet{
		GetUserBlocksArg: args,
		Contextified:     libkb.NewContextified(g),
	}
}

// Name is the unique engine name.
func (e *UserBlocksGet) Name() string {
	return "UserBlocksGet"
}

// GetPrereqs returns the engine prereqs.
func (e *UserBlocksGet) Prereqs() Prereqs {
	return Prereqs{}
}

// RequiredUIs returns the required UIs.
func (e *UserBlocksGet) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{}
}

// SubConsumers returns the other UI consumers for this engine.
func (e *UserBlocksGet) SubConsumers() []libkb.UIConsumer {
	return nil
}

// Run starts the engine.
func (e *UserBlocksGet) Run(mctx libkb.MetaContext) (err error) {
	var usernameLog string
	if len(e.Usernames) < 5 {
		usernameLog = strings.Join(e.Usernames, ",")
	} else {
		usernameLog = fmt.Sprintf("%s... %d total", strings.Join(e.Usernames[:5], ","), len(e.Usernames))
	}
	defer mctx.Trace(
		fmt.Sprintf("UserBlocksGet#Run(%s)", usernameLog),
		&err)()

	httpArgs := libkb.HTTPArgs{}
	if len(e.Usernames) > 0 {
		uids := make([]keybase1.UID, len(e.Usernames))
		for i, v := range e.Usernames {
			uids[i] = libkb.GetUIDByUsername(e.G(), v)
		}
		httpArgs["uids"] = libkb.S{Val: libkb.UidsToString(uids)}
	}

	apiArg := libkb.APIArg{
		Endpoint:    "user/get_blocks",
		Args:        httpArgs,
		SessionType: libkb.APISessionTypeREQUIRED,
	}

	type getBlockResult struct {
		libkb.AppStatusEmbed
		Blocks []struct {
			BlockUID      keybase1.UID   `json:"block_uid"`
			BlockUsername string         `json:"block_username"`
			CTime         *keybase1.Time `json:"ctime,omitempty"`
			MTime         *keybase1.Time `json:"mtime,omitempty"`
			Chat          bool           `json:"chat"`
			Follow        bool           `json:"follow"`
		} `json:"blocks"`
	}

	var apiRes getBlockResult

	err = mctx.G().API.GetDecode(mctx, apiArg, &apiRes)
	if err != nil {
		return err
	}

	e.blocks = make([]keybase1.UserBlock, len(apiRes.Blocks))
	for i, v := range apiRes.Blocks {
		if err := libkb.AssertUsernameMatchesUID(e.G(), v.BlockUID, v.BlockUsername); err != nil {
			return err
		}
		e.blocks[i] = keybase1.UserBlock{
			Username:      v.BlockUsername,
			ChatBlocked:   v.Chat,
			FollowBlocked: v.Follow,
			CreateTime:    v.CTime,
			ModifyTime:    v.MTime,
		}
	}

	return nil
}

func (e *UserBlocksGet) Blocks() []keybase1.UserBlock {
	return e.blocks
}
