// Copyright 2018 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"fmt"
	"strconv"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	gregor1 "github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/net/context"
)

type CmdChatSetRetentionDev struct {
	libkb.Contextified
	resolvingRequest chatConversationResolvingRequest
	policy           *chat1.RetentionPolicy

	setPolicy  *chat1.RetentionPolicy
	setChannel bool // whether to set team-wide or just channel
}

func NewCmdChatSetRetentionDevRunner(g *libkb.GlobalContext) *CmdChatSetRetentionDev {
	return &CmdChatSetRetentionDev{
		Contextified: libkb.NewContextified(g),
	}
}

func newCmdChatSetRetentionDev(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:  "retention-policy-dev",
		Usage: "Set a retention policy to EXPIRE with an exact seconds count",
		Examples: `
Please don't actually use retention-policy-dev:
    keybase chat retention-policy-dev patrick,mlsteele 86400
    keybase chat retention-policy-dev 10 --channel '#general' ateam
`,
		ArgumentHelp: "<conversation> <seconds>",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(NewCmdChatSetRetentionDevRunner(g), "retention-policy-dev", c)
		},
		Flags: getConversationResolverFlags(),
	}
}

func (c *CmdChatSetRetentionDev) Run() (err error) {
	if c.resolvingRequest.TlfName != "" {
		err = annotateResolvingRequest(c.G(), &c.resolvingRequest)
		if err != nil {
			return err
		}
	}
	// TLFVisibility_ANY doesn't make any sense for send, so switch that to PRIVATE:
	if c.resolvingRequest.Visibility == keybase1.TLFVisibility_ANY {
		c.resolvingRequest.Visibility = keybase1.TLFVisibility_PRIVATE
	}

	if c.G().Standalone {
		switch c.resolvingRequest.MembersType {
		case chat1.ConversationMembersType_TEAM, chat1.ConversationMembersType_IMPTEAMNATIVE, chat1.ConversationMembersType_IMPTEAMUPGRADE:
			c.G().StartStandaloneChat()
		default:
			err = CantRunInStandaloneError{}
			return err
		}
	}

	conv, err := c.resolve(context.TODO())
	if err != nil {
		return err
	}
	return c.postPolicy(context.TODO(), conv, *c.setPolicy, c.setChannel)
}

func (c *CmdChatSetRetentionDev) ParseArgv(ctx *cli.Context) (err error) {
	var tlfName string
	// Get the TLF name from the first position arg
	if len(ctx.Args()) != 2 {
		return fmt.Errorf("conversation or team name required and seconds required")
	}
	tlfName = ctx.Args().Get(0)
	if c.resolvingRequest, err = parseConversationResolvingRequest(ctx, tlfName); err != nil {
		return err
	}

	ageInt, err := strconv.Atoi(ctx.Args().Get(1))
	if err != nil {
		return err
	}
	age := gregor1.DurationSec(ageInt)
	p := chat1.NewRetentionPolicyWithExpire(chat1.RpExpire{
		Age: age,
	})
	c.setPolicy = &p
	c.setChannel = len(ctx.String("channel")) > 0

	return nil
}

func (c *CmdChatSetRetentionDev) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
		API:    true,
	}
}

func (c *CmdChatSetRetentionDev) resolve(ctx context.Context) (*chat1.ConversationLocal, error) {
	resolver, err := newChatConversationResolver(c.G())
	if err != nil {
		return nil, err
	}
	conv, _, err := resolver.Resolve(ctx, c.resolvingRequest, chatConversationResolvingBehavior{
		CreateIfNotExists: false,
		MustNotExist:      false,
		IdentifyBehavior:  keybase1.TLFIdentifyBehavior_CHAT_CLI,
	})
	return conv, err
}

func (c *CmdChatSetRetentionDev) postPolicy(ctx context.Context, conv *chat1.ConversationLocal, policy chat1.RetentionPolicy, setChannel bool) (err error) {
	lcli, err := GetChatLocalClient(c.G())
	if err != nil {
		return err
	}
	return postRetentionPolicy(ctx, lcli, c.G().UI.GetTerminalUI(), conv, policy, setChannel, false /*doPrompt*/)
}
