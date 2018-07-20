package client

import (
	"errors"
	"fmt"
	"time"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"golang.org/x/net/context"
)

type CmdChatUpload struct {
	libkb.Contextified
	tlf               string
	filename          string
	public            bool
	nonblock          bool
	title             string
	ephemeralLifetime ephemeralLifetime
	cancel            func()
	done              chan bool
}

func newCmdChatUpload(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	flags := []cli.Flag{
		cli.BoolFlag{
			Name:  "public",
			Usage: "Send to public conversation (default private)",
		},
		cli.StringFlag{
			Name:  "title",
			Usage: "Title of attachment (defaults to filename)",
		},
		cli.BoolFlag{
			Name:  "nonblock",
			Usage: "Queue attachment upload and return immediately",
		},
	}
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
		},
		Flags: flags,
	}
}

func (c *CmdChatUpload) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) != 2 {
		return errors.New("usage: keybase chat upload <conversation> <filename>")
	}
	c.tlf = ctx.Args()[0]
	c.filename = ctx.Args()[1]
	c.public = ctx.Bool("public")
	c.title = ctx.String("title")
	c.nonblock = ctx.Bool("nonblock")
	c.ephemeralLifetime = ephemeralLifetime{ctx.Duration("exploding-lifetime")}

	return nil
}

func (c *CmdChatUpload) Run() error {
	// Verify that we are not trying to send an ephemeral message to a public
	// chat.
	if c.ephemeralLifetime.Duration > 0 && c.public {
		return fmt.Errorf("Cannot send ephemeral messages with --public set.")
	}

	opts := attachOptionsV1{
		Channel: ChatChannel{
			Name:   c.tlf,
			Public: c.public,
		},
		Filename:          c.filename,
		Title:             c.title,
		EphemeralLifetime: c.ephemeralLifetime,
		Nonblock:          c.nonblock,
	}

	ctx, cancel := context.WithCancel(context.Background())
	c.cancel = cancel
	defer func() {
		c.cancel()
		c.cancel = nil
	}()

	h := newChatServiceHandler(c.G())
	reply := h.AttachV1(ctx, opts)

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
