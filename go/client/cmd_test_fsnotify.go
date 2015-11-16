package client

import (
	"golang.org/x/net/context"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
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
				Name:  "t, tlf",
				Usage: "top level folder",
			},
			cli.StringFlag{
				Name:  "f, filename",
				Usage: "filename",
			},
			cli.StringFlag{
				Name:  "a, action",
				Usage: "[encrypting|decrypting|signing|rekeying]",
			},
		},
	}
}

type CmdTestFSNotify struct {
	libkb.Contextified
	tlf      string
	filename string
	action   keybase1.FSNotificationType
}

func (s *CmdTestFSNotify) ParseArgv(ctx *cli.Context) error {
	s.tlf = ctx.String("tlf")
	if len(s.tlf) == 0 {
		s.tlf = "private/t_alice"
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
	case "rekeying":
		s.action = keybase1.FSNotificationType_REKEYING
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

	switch s.action {
	case keybase1.FSNotificationType_ENCRYPTING:
		err = cli.Encrypting(context.TODO(), keybase1.EncryptingArg{TopLevelFolder: s.tlf, Filename: s.filename})
	case keybase1.FSNotificationType_DECRYPTING:
		err = cli.Decrypting(context.TODO(), keybase1.DecryptingArg{TopLevelFolder: s.tlf, Filename: s.filename})
	case keybase1.FSNotificationType_SIGNING:
		err = cli.Signing(context.TODO(), keybase1.SigningArg{TopLevelFolder: s.tlf, Filename: s.filename})
	case keybase1.FSNotificationType_REKEYING:
		err = cli.Rekeying(context.TODO(), keybase1.RekeyingArg{TopLevelFolder: s.tlf, Filename: s.filename})
	default:
		panic("unknown action type")
	}

	return err
}
