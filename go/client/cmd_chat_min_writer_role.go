// Copyright 2018 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"fmt"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/net/context"
)

type CmdChatSetConvMinWriterRole struct {
	libkb.Contextified
	resolvingRequest chatConversationResolvingRequest
	role             *keybase1.TeamRole
}

func NewCmdChatSetConvMinWriterRoleRunner(g *libkb.GlobalContext) *CmdChatSetConvMinWriterRole {
	return &CmdChatSetConvMinWriterRole{
		Contextified: libkb.NewContextified(g),
	}
}

func newCmdChatSetConvMinWriterRole(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:  "min-writer-role",
		Usage: "Manage the minimum role required to write to a conversation",
		Examples: `
View the policy for a team channel:
    keybase chat min-writer-role keybasefriends

Only allow team admins to write
    keybase chat min-writer-role keybasefriends --role admin

Only allow team admins to write on a specific channel
    keybase chat min-writer-role keybasefriends --channel '#annoucements' --role admin

Disable a previously set policy
    keybase chat min-writer-role keybasefriends --channel '#annoucements' --role none
`,
		ArgumentHelp: "[conversation]",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(NewCmdChatSetConvMinWriterRoleRunner(g), "min-writer-role", c)
		},
		Flags: append(getConversationResolverFlags(), []cli.Flag{
			cli.StringFlag{
				Name:  "r, role",
				Usage: "team role (owner, admin, writer, reader, none)",
			},
		}...),
	}
}

func (c *CmdChatSetConvMinWriterRole) Run() (err error) {
	if c.resolvingRequest.TlfName != "" {
		if err = annotateResolvingRequest(c.G(), &c.resolvingRequest); err != nil {
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
			return CantRunInStandaloneError{}
		}
	}

	conv, err := c.resolve(context.TODO())
	if err != nil {
		return err
	}

	if c.role != nil {
		if err = c.postMinWriterRole(context.TODO(), conv, *c.role); err != nil {
			return err
		}
		// Reload the conv to show the new setting.
		conv, err = c.resolve(context.TODO())
		if err != nil {
			return err
		}
	}
	return c.showMinWriterRole(conv)
}

func (c *CmdChatSetConvMinWriterRole) ParseArgv(ctx *cli.Context) (err error) {
	var tlfName string
	// Get the TLF name from the first position arg
	if len(ctx.Args()) < 1 {
		return fmt.Errorf("conversation or team name required")
	}
	if len(ctx.Args()) >= 1 {
		tlfName = ctx.Args().Get(0)
	}
	if c.resolvingRequest, err = parseConversationResolvingRequest(ctx, tlfName); err != nil {
		return err
	}

	// If no role is set, we just want to read out what the current setting is.
	if ctx.String("role") != "" {
		role, err := ParseRole(ctx)
		if err != nil {
			return err
		}
		c.role = &role
	}

	return nil
}

func (c *CmdChatSetConvMinWriterRole) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
		API:    true,
	}
}

func (c *CmdChatSetConvMinWriterRole) resolve(ctx context.Context) (*chat1.ConversationLocal, error) {
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

func (c *CmdChatSetConvMinWriterRole) postMinWriterRole(ctx context.Context, conv *chat1.ConversationLocal, role keybase1.TeamRole) error {
	lcli, err := GetChatLocalClient(c.G())
	if err != nil {
		return err
	}
	return postConvMinWriterRole(ctx, lcli, c.G().UI.GetTerminalUI(), conv, role, true /*doPrompt*/)
}

func (c *CmdChatSetConvMinWriterRole) showMinWriterRole(conv *chat1.ConversationLocal) (err error) {
	dui := c.G().UI.GetDumbOutputUI()
	var minWriterRoleInfo *chat1.ConversationMinWriterRoleInfoLocal
	if conv.ConvSettings != nil {
		minWriterRoleInfo = conv.ConvSettings.MinWriterRoleInfo
	}
	dui.Printf("%v\n", minWriterRoleInfo)
	return nil
}
