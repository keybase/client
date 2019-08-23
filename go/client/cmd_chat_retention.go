// Copyright 2018 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"fmt"
	"strings"
	"time"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	gregor1 "github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/net/context"
)

type CmdChatSetRetention struct {
	libkb.Contextified
	resolvingRequest chatConversationResolvingRequest
	policy           *chat1.RetentionPolicy

	setPolicy  *chat1.RetentionPolicy
	setChannel bool // whether to set team-wide or just channel
}

func NewCmdChatSetRetentionRunner(g *libkb.GlobalContext) *CmdChatSetRetention {
	return &CmdChatSetRetention{
		Contextified: libkb.NewContextified(g),
	}
}

func newCmdChatSetRetention(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:  "retention-policy",
		Usage: "Manage the chat retention policy for a conversation or team",
		Examples: `
View the policy for a conversation or team:
    keybase chat retention-policy patrick,mlsteele
    keybase chat retention-policy keybasefriends
    keybase chat retention-policy keybasefriends --channel '#general'

Keep messages indefinitely:
    keybase chat retention-policy patrick --keep

Keep messages for a week:
    keybase chat retention-policy patrick --expire 1w

Require messages to be exploding and have a maxmimum lifetime of a week:
    keybase chat retention-policy patrick --explode 1w

Change the team-wide policy:
    keybase chat retention-policy ateam --expire 1y

Use the team policy for this channel:
    keybase chat retention-policy ateam --channel '#general' --inherit
`,
		ArgumentHelp: "[conversation]",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(NewCmdChatSetRetentionRunner(g), "retention-policy", c)
			cl.SetLogForward(libcmdline.LogForwardNone)
		},
		Flags: append(getConversationResolverFlags(), []cli.Flag{
			cli.BoolFlag{
				Name:  "keep",
				Usage: `Keep messages indefinitely`,
			},
			cli.StringFlag{
				Name:  "expire",
				Usage: `Delete messages after one of [1d, 1w, 30d, 3m, 1y]`,
			},
			cli.StringFlag{
				Name:  "explode",
				Usage: `Require all messages to be exploding with a maximum lifetime of one of [30s, 5m, 1h, 6h, 1d, 3d, 1w]`,
			},
			cli.BoolFlag{
				Name:  "inherit",
				Usage: `Use the team's policy for a channel`,
			},
		}...),
	}
}

func (c *CmdChatSetRetention) Run() (err error) {
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

	if c.setPolicy != nil {
		err = c.postPolicy(context.TODO(), conv, *c.setPolicy, c.setChannel)
		if err != nil {
			return err
		}
		// Reload the conv to show the new setting.
		conv, err = c.resolve(context.TODO())
		if err != nil {
			return err
		}
	}

	switch conv.Info.MembersType {
	case chat1.ConversationMembersType_TEAM:
		c.showTeamChannel(conv)
	default:
		c.showNonTeamConv(conv)
	}
	return nil
}

func (c *CmdChatSetRetention) ParseArgv(ctx *cli.Context) (err error) {
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

	var age gregor1.DurationSec
	var keep bool
	var inherit bool
	var exclusiveChoices []string
	if timeStr := ctx.String("expire"); len(timeStr) > 0 {
		age, err = c.parseExpireAgeLimited(timeStr)
		if err != nil {
			return err
		}
		exclusiveChoices = append(exclusiveChoices, "expire")
	}
	if timeStr := ctx.String("explode"); len(timeStr) > 0 {
		age, err = c.parseEphemeralAgeLimited(timeStr)
		if err != nil {
			return err
		}
		exclusiveChoices = append(exclusiveChoices, "explode")
	}
	keep = ctx.Bool("keep")
	if keep {
		exclusiveChoices = append(exclusiveChoices, "keep")
	}
	inherit = ctx.Bool("inherit")
	if inherit {
		exclusiveChoices = append(exclusiveChoices, "inherit")
	}
	if len(exclusiveChoices) > 1 {
		return fmt.Errorf("only one of [%v] allowed", strings.Join(exclusiveChoices, ", "))
	}
	if len(exclusiveChoices) > 0 {
		var p chat1.RetentionPolicy
		switch exclusiveChoices[0] {
		case "inherit":
			p = chat1.NewRetentionPolicyWithInherit(chat1.RpInherit{})
		case "keep":
			p = chat1.NewRetentionPolicyWithRetain(chat1.RpRetain{})
		case "expire":
			p = chat1.NewRetentionPolicyWithExpire(chat1.RpExpire{
				Age: age,
			})
		case "explode":
			p = chat1.NewRetentionPolicyWithEphemeral(chat1.RpEphemeral{
				Age: age,
			})
		}
		c.setPolicy = &p
		c.setChannel = len(ctx.String("channel")) > 0
	}

	return nil
}

func (c *CmdChatSetRetention) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
		API:    true,
	}
}

func (c *CmdChatSetRetention) resolve(ctx context.Context) (*chat1.ConversationLocal, error) {
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

func (c *CmdChatSetRetention) postPolicy(ctx context.Context, conv *chat1.ConversationLocal, policy chat1.RetentionPolicy, setChannel bool) (err error) {
	lcli, err := GetChatLocalClient(c.G())
	if err != nil {
		return err
	}
	return postRetentionPolicy(ctx, lcli, c.G().UI.GetTerminalUI(), conv, policy, setChannel, true /*doPrompt*/)
}

// Show a non-team conv policy
func (c *CmdChatSetRetention) showNonTeamConv(conv *chat1.ConversationLocal) {
	dui := c.G().UI.GetDumbOutputUI()
	if conv.TeamRetention != nil {
		c.println(dui, "Unexpected team policy set on non-team conversation.\n")
	}
	policy := chat1.RetentionPolicy{}
	if conv.ConvRetention != nil {
		policy = *conv.ConvRetention
	}
	c.println(dui, policy.HumanSummary())
}

func (c *CmdChatSetRetention) showTeamChannel(conv *chat1.ConversationLocal) {
	c.showTeamChannelHTeam(conv)
	c.showTeamChannelHChannel(conv)
}

// Show the team policy
func (c *CmdChatSetRetention) showTeamChannelHTeam(conv *chat1.ConversationLocal) {
	dui := c.G().UI.GetDumbOutputUI()
	policy := chat1.RetentionPolicy{}
	if conv.TeamRetention != nil {
		policy = *conv.TeamRetention
	}
	c.println(dui, "Team policy: %v", policy.HumanSummary())
}

// Show the channel's policy
func (c *CmdChatSetRetention) showTeamChannelHChannel(conv *chat1.ConversationLocal) {
	dui := c.G().UI.GetDumbOutputUI()
	policy := chat1.RetentionPolicy{}
	if conv.ConvRetention != nil {
		policy = *conv.ConvRetention
	}
	typ, err := policy.Typ()
	if err != nil {
		c.println(dui, "unable to get retention type: %v", err)
		return
	}
	var description string
	switch typ {
	case chat1.RetentionPolicyType_NONE, chat1.RetentionPolicyType_INHERIT:
		description = "Uses the team policy"
	default:
		description = policy.HumanSummary()
	}
	c.println(dui, "#%v channel: %v", conv.Info.TopicName, description)
}

// Parse an age string from a limited set of choices
func (c *CmdChatSetRetention) parseEphemeralAgeLimited(s string) (gregor1.DurationSec, error) {
	var d time.Duration
	var err error
	switch s {
	case "30s",
		"5m",
		"1h",
		"6h":
		d, err = time.ParseDuration(s)
	case "1d", "24h":
		d = 24 * time.Hour
	case "3d":
		d = 3 * 24 * time.Hour
	case "7d", "1w":
		d = 7 * 24 * time.Hour
	default:
		return 0, fmt.Errorf("invalid expiration age: %v", s)
	}
	return gregor1.DurationSec(d.Seconds()), err
}

// Parse an age string from a limited set of choices
func (c *CmdChatSetRetention) parseExpireAgeLimited(s string) (gregor1.DurationSec, error) {
	var d time.Duration
	switch s {
	case "1d", "24h":
		d = 24 * time.Hour
	case "7d", "1w":
		d = 7 * 24 * time.Hour
	case "30d", "1m":
		d = 30 * 24 * time.Hour
	case "3m":
		d = 90 * 24 * time.Hour
	case "12m", "1y":
		d = 365 * 24 * time.Hour
	default:
		return 0, fmt.Errorf("invalid expiration age: %v", s)
	}
	return gregor1.DurationSec(d.Seconds()), nil
}

func (c *CmdChatSetRetention) println(dui libkb.DumbOutputUI, format string, args ...interface{}) {
	dui.Printf(fmt.Sprintf(format, args...) + "\n")
}
