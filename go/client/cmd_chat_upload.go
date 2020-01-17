package client

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	isatty "github.com/mattn/go-isatty"
	"golang.org/x/net/context"
)

type CmdChatUpload struct {
	libkb.Contextified
	hasTTY            bool
	resolvingRequest  chatConversationResolvingRequest
	filename          string
	title             string
	ephemeralLifetime ephemeralLifetime
	cancel            func()
	done              chan bool
}

func newCmdChatUpload(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	flags := []cli.Flag{
		cli.StringFlag{
			Name:  "title",
			Usage: "Title of attachment (defaults to filename)",
		},
	}
	flags = append(flags, getConversationResolverFlags()...)
	flags = append(flags, mustGetChatFlags("exploding-lifetime")...)
	return cli.Command{
		Name:         "upload",
		Usage:        "Upload an attachment to a conversation",
		ArgumentHelp: "<conversation> <filename>",
		Action: func(c *cli.Context) {
			cmd := &CmdChatUpload{
				Contextified: libkb.NewContextified(g),
				done:         make(chan bool, 1),
			}
			cl.ChooseCommand(cmd, "upload", c)
			cl.SetLogForward(libcmdline.LogForwardNone)
		},
		Flags: flags,
	}
}

func (c *CmdChatUpload) ParseArgv(ctx *cli.Context) (err error) {
	if len(ctx.Args()) != 2 {
		return errors.New("usage: keybase chat upload <conversation> <filename>")
	}

	tlfName := ctx.Args()[0]
	if c.resolvingRequest, err = parseConversationResolvingRequest(ctx, tlfName); err != nil {
		return err
	}
	c.filename, err = filepath.Abs(ctx.Args()[1])
	if err != nil {
		return err
	}
	c.title = ctx.String("title")
	c.ephemeralLifetime = ephemeralLifetime{ctx.Duration("exploding-lifetime")}
	c.hasTTY = isatty.IsTerminal(os.Stdin.Fd())
	return nil
}

func (c *CmdChatUpload) Run() (err error) {
	ui := NewChatCLIUI(c.G())
	protocols := []rpc.Protocol{
		chat1.ChatUiProtocol(ui),
	}
	if err := RegisterProtocolsWithContext(protocols, c.G()); err != nil {
		return err
	}

	if err = annotateResolvingRequest(c.G(), &c.resolvingRequest); err != nil {
		return err
	}
	// TLFVisibility_ANY doesn't make any sense for send, so switch that to PRIVATE:
	if c.resolvingRequest.Visibility == keybase1.TLFVisibility_ANY {
		c.resolvingRequest.Visibility = keybase1.TLFVisibility_PRIVATE
	}

	// Verify we can continue with the current options, this will return an
	// error if you try to send to a KBFS chat or have --public set and
	// ephemeralLifetime.
	if c.ephemeralLifetime.Duration > 0 {
		if c.resolvingRequest.Visibility == keybase1.TLFVisibility_PUBLIC {
			return fmt.Errorf("Cannot send ephemeral messages with --public set.")
		}
		if c.resolvingRequest.MembersType == chat1.ConversationMembersType_KBFS {
			return fmt.Errorf("Cannot send ephemeral messages to a KBFS type chat.")
		}
	}

	if err := CheckAndStartStandaloneChat(c.G(), c.resolvingRequest.MembersType); err != nil {
		return err
	}

	resolver, err := newChatConversationResolver(c.G())
	if err != nil {
		return err
	}

	conversation, _, err := resolver.Resolve(context.TODO(), c.resolvingRequest, chatConversationResolvingBehavior{
		CreateIfNotExists: true,
		MustNotExist:      false,
		Interactive:       c.hasTTY,
		IdentifyBehavior:  keybase1.TLFIdentifyBehavior_CHAT_CLI,
	})
	switch err.(type) {
	case nil:
	case libkb.ResolutionError:
		return fmt.Errorf("could not resolve `%s` into Keybase user(s) or a team", c.resolvingRequest.TlfName)
	default:
		return err
	}

	opts := attachOptionsV1{
		ConversationID:    conversation.Info.Id.ConvIDStr(),
		Filename:          c.filename,
		Title:             c.title,
		EphemeralLifetime: c.ephemeralLifetime,
	}

	ctx, cancel := context.WithCancel(context.Background())
	c.cancel = cancel
	defer func() {
		c.cancel()
		c.cancel = nil
	}()

	h := newChatServiceHandler(c.G())
	reply := h.AttachV1(ctx, opts, NewChatCLIUI(c.G()), NewChatCLINotifications(c.G()))

	c.G().Log.Debug("AttachV1 done")
	c.done <- true
	if reply.Error != nil {
		return errors.New(reply.Error.Message)
	}
	return nil
}

func (c *CmdChatUpload) GetUsage() libkb.Usage {
	return libkb.Usage{
		API:       true,
		KbKeyring: true,
		Config:    true,
	}
}

func (c *CmdChatUpload) Cancel() error {
	c.G().Log.Debug("received request to cancel running chat upload command")
	if c.cancel != nil {
		c.G().Log.Debug("command cancel function exists, calling it")
		c.cancel()

		// In go-framed-msgpack-rpc, dispatch.handleCall() starts a goroutine to check the context being
		// canceled.
		// So, need to wait here for call to actually finish in order for the cancel message to make it
		// to the daemon.
		select {
		case <-c.done:
			c.G().Log.Debug("command finished, cancel complete")
		case <-time.After(5 * time.Second):
			c.G().Log.Debug("timed out waiting for command to finish")
		}
	}
	return nil
}
