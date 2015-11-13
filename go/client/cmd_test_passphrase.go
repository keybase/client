package client

import (
	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
)

func NewCmdTestPassphrase(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:  "test-passphrase",
		Usage: "Test the GetPassphrase protocol",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdTestPassphrase{Contextified: libkb.NewContextified(g)}, "test-passphrase", c)
		},
	}
}

type CmdTestPassphrase struct {
	libkb.Contextified
}

func (s *CmdTestPassphrase) ParseArgv(ctx *cli.Context) error {
	return nil
}

func (s *CmdTestPassphrase) GetUsage() libkb.Usage {
	return libkb.Usage{}
}

func (s *CmdTestPassphrase) Run() (err error) {
	s.G().Log.Debug("+ CmdTestPassphrase.Run")
	defer func() { s.G().Log.Debug("- CmdTestPassphrase.Run -> %s", libkb.ErrToOk(err)) }()

	guiArg := keybase1.GUIEntryArg{
		WindowTitle: "Keybase Test Passphrase",
		Prompt:      "Enter a test passphrase",
		Features: keybase1.GUIEntryFeatures{
			SecretStorage: keybase1.SecretStorageFeature{
				Allow: true,
				Label: "store your test passphrase",
			},
		},
	}
	res, err := s.G().UI.GetSecretUI().GetPassphrase(guiArg, nil)
	if err != nil {
		return err
	}

	s.G().Log.Debug("result: %+v", res)

	return nil
}
