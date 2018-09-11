package client

import (
	"fmt"
	"time"

	"golang.org/x/net/context"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

func NewCmdTestFSNotify(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:  "test-fsnotify",
		Usage: "Test kbfs notifications",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdTestFSNotify{Contextified: libkb.NewContextified(g)}, "test-fsnotify", c)
		},
		Flags: []cli.Flag{
			cli.StringFlag{
				Name:  "t, type",
				Usage: "type of the folder: private [default], public or team",
			},
			cli.StringFlag{
				Name:  "f, filename",
				Usage: "filename",
			},
			cli.StringFlag{
				Name:  "a, action",
				Usage: "[encrypting|decrypting|signing|verifying|rekeying]",
			},
			cli.StringFlag{
				Name:  "delay",
				Usage: "delay between start and finish calls",
			},
		},
	}
}

type CmdTestFSNotify struct {
	libkb.Contextified
	folderType keybase1.FolderType
	filename   string
	action     keybase1.FSNotificationType
	delay      time.Duration
}

func (s *CmdTestFSNotify) ParseArgv(ctx *cli.Context) error {
	s.folderType = keybase1.FolderType_PRIVATE
	switch ctx.String("type") {
	case "private":
		// Already set.
	case "public":
		s.folderType = keybase1.FolderType_PUBLIC
	case "team":
		s.folderType = keybase1.FolderType_TEAM
	default:
		return fmt.Errorf("Unknown folder type: %s", ctx.String("type"))
	}

	s.filename = ctx.String("filename")
	if len(s.filename) == 0 {
		s.filename = "user.go"
	}

	switch ctx.String("action") {
	default:
		s.action = keybase1.FSNotificationType_ENCRYPTING
	case "encrypting":
		s.action = keybase1.FSNotificationType_ENCRYPTING
	case "decrypting":
		s.action = keybase1.FSNotificationType_DECRYPTING
	case "signing":
		s.action = keybase1.FSNotificationType_SIGNING
	case "verifying":
		s.action = keybase1.FSNotificationType_VERIFYING
	case "rekeying":
		s.action = keybase1.FSNotificationType_REKEYING
	}

	delay := ctx.String("delay")
	if len(delay) > 0 {
		dur, err := time.ParseDuration(delay)
		if err != nil {
			return err
		}
		s.delay = dur
	} else {
		s.delay = 1 * time.Second
	}

	return nil
}

func (s *CmdTestFSNotify) GetUsage() libkb.Usage {
	return libkb.Usage{}
}

func (s *CmdTestFSNotify) Run() (err error) {
	s.G().Log.Debug("+ CmdTestFSNotify.Run")
	defer func() { s.G().Log.Debug("- CmdTestFSNotify.Run -> %s", libkb.ErrToOk(err)) }()

	cli, err := GetKBFSClient(s.G())
	if err != nil {
		return err
	}

	arg := keybase1.FSNotification{
		FolderType:       s.folderType,
		Filename:         s.filename,
		NotificationType: s.action,
		StatusCode:       keybase1.FSStatusCode_START,
	}
	s.G().Log.Debug("sending start event")
	err = cli.FSEvent(context.TODO(), arg)
	if err != nil {
		return err
	}
	s.G().Log.Debug("sleeping for %s", s.delay)
	time.Sleep(s.delay)
	arg.StatusCode = keybase1.FSStatusCode_FINISH
	s.G().Log.Debug("sending finish event")
	err = cli.FSEvent(context.TODO(), arg)
	if err != nil {
		return err
	}
	s.G().Log.Debug("done with event")

	return err
}
