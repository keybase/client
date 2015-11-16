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
	}
}

type CmdTestFSNotify struct {
	libkb.Contextified
}

func (s *CmdTestFSNotify) ParseArgv(ctx *cli.Context) error {
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

	err = cli.Encrypting(context.TODO(), keybase1.EncryptingArg{TopLevelFolder: "private/t_alice", Filename: "user.go"})
	return err
}
