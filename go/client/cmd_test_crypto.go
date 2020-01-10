package client

import (
	"errors"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
)

func newCmdTestCrypto(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:  "test-crypto",
		Usage: "Test the frontend saltpack protocol",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdTestCrypto{Contextified: libkb.NewContextified(g)}, "test-crypto", c)
		},
		Flags: []cli.Flag{
			cli.StringFlag{
				Name:  "f",
				Usage: "filename to encrypt",
			},
		},
	}
}

type CmdTestCrypto struct {
	libkb.Contextified
	recipients []string
	filename   string
}

func (s *CmdTestCrypto) ParseArgv(ctx *cli.Context) error {
	s.recipients = ctx.Args()
	if len(s.recipients) == 0 {
		return errors.New("need at least one recipient")
	}
	s.filename = ctx.String("f")
	return nil
}

func (s *CmdTestCrypto) GetUsage() libkb.Usage {
	return libkb.Usage{}
}

func (s *CmdTestCrypto) Run() (err error) {
	mctx := libkb.NewMetaContextBackground(s.G())
	cli, err := GetSaltpackClient(s.G())
	if err != nil {
		return err
	}
	protocols := []rpc.Protocol{
		NewSecretUIProtocol(s.G()),
	}
	if err := RegisterProtocolsWithContext(protocols, s.G()); err != nil {
		return err
	}

	plaintext := "hello goodbye"
	dui := s.G().UI.GetDumbOutputUI()

	dui.Printf("encrypting string %q for %v\n", plaintext, s.recipients)
	arg := keybase1.SaltpackEncryptStringArg{
		Plaintext: plaintext,
		Opts: keybase1.SaltpackFrontendEncryptOptions{
			Recipients:  s.recipients,
			IncludeSelf: true,
			Signed:      true,
		},
	}
	ciphertext, err := cli.SaltpackEncryptString(mctx.Ctx(), arg)
	if err != nil {
		return err
	}
	dui.Printf("ciphertext:\n\n")
	dui.Printf("%s\n\n", ciphertext)

	dui.Printf("decrypting ciphertext\n")
	decArg := keybase1.SaltpackDecryptStringArg{
		Ciphertext: ciphertext,
	}
	res, err := cli.SaltpackDecryptString(mctx.Ctx(), decArg)
	if err != nil {
		return err
	}
	dui.Printf("plaintext: %q\n\n", res.Plaintext)
	dui.Printf("info: %+v\n\n", res.Info)

	dui.Printf("signing string %q\n", plaintext)
	signArg := keybase1.SaltpackSignStringArg{Plaintext: plaintext}
	signed, err := cli.SaltpackSignString(mctx.Ctx(), signArg)
	if err != nil {
		return err
	}
	dui.Printf("signed:\n\n")
	dui.Printf("%s\n\n", signed)

	dui.Printf("verifying signed msg\n")
	verifyArg := keybase1.SaltpackVerifyStringArg{SignedMsg: signed}
	vres, err := cli.SaltpackVerifyString(mctx.Ctx(), verifyArg)
	if err != nil {
		return err
	}
	dui.Printf("verify result: %+v\n\n", vres)

	if s.filename == "" {
		dui.Printf("no filename specified, done.\n")
		return nil
	}

	dui.Printf("encrypting file %s\n", s.filename)
	efArg := keybase1.SaltpackEncryptFileArg{
		Filename: s.filename,
		Opts: keybase1.SaltpackFrontendEncryptOptions{
			Recipients:  s.recipients,
			IncludeSelf: true,
			Signed:      true,
		},
	}
	efPath, err := cli.SaltpackEncryptFile(mctx.Ctx(), efArg)
	if err != nil {
		return err
	}
	dui.Printf("encrypted file: %s\n", efPath)

	dui.Printf("decrypting file: %s\n", efPath)
	dfArg := keybase1.SaltpackDecryptFileArg{EncryptedFilename: efPath}
	dfres, err := cli.SaltpackDecryptFile(mctx.Ctx(), dfArg)
	if err != nil {
		return err
	}
	dui.Printf("decrypt result: %+v\n", dfres)

	return nil
}
