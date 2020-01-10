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
	dui.Printf("signed: %v\n", res.Signed)

	decArg = keybase1.SaltpackDecryptStringArg{
		Ciphertext: `BEGIN KEYBASE SALTPACK ENCRYPTED MESSAGE. kiOZCh3HHJ67ruW BqTLwK4O4wu3rYb nqNg6NDZgFvmpuq I5WS7gm9v6c5G5c jTVWHsEGJwNNAfg JyJguAd07Dlns9X e5bA2n0Vn5z4ZfW OnP54P88sWJuH2Y C4cZouKLhR4h1sw bNiA1XKMaypkN3q 4F811KyR5M29kgT O2AJCMc0rpbWQqT oisyKNPyfpsbi0e sP4QhYQj5rrOiUS 3BBPw5ZDYGTpa3P Yd5PaYH3cxXA8Ym u5k3nFbsAgnt4mM lruQb4LNAz7ZwSD 8SoDqvYygGXRLVF YuPrLFyZIptNSAN htWKDhheWwUP9RM orOzspVIGB9ngOU QCKrW1xQjLQ3Q43 AKOtTWfyce2r4jp 109C40cguaDuUl5 XsygTcdDeEirm54 2fPEiDhu4DjBOCc KmdGpZxe1BzVKvI 7PlLT9KVT8THxqL VgTZzONc0swyGcn yOLW3BKZscEtNSs uPOs4y77PWVUET7 IUpddqEvbKiyLin w9nT60rWV5kQXtx J7QgINM7Z6EMHEq DavAYzeLHvY3wpb tuYYg1JAjN6lRMs vNx7oG6Vpr0brrj UBKEjG8ODaQCQOs vTpEVDAg8IVqpMN 55OPZll2JnHe35l bQpVHzUrEua7URk tBclMiFmXy72iVS OQvLjrs6UTypsFc Oe2gYNAP9u0SP3z hI6S6qFY07JdlQM MMGIuurd9Rf9J5c QfG96NzRoV8f00F BxwscX8FF9b1i4W OhXcMQrTtjNsaCN . END KEYBASE SALTPACK ENCRYPTED MESSAGE.`,
	}
	res, err = cli.SaltpackDecryptString(mctx.Ctx(), decArg)
	if err != nil {
		return err
	}
	dui.Printf("plaintext: %q\n\n", res.Plaintext)
	dui.Printf("info: %+v\n\n", res.Info)
	dui.Printf("signed: %v\n", res.Signed)

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

	dui.Printf("signing file %s\n", s.filename)
	sfArg := keybase1.SaltpackSignFileArg{Filename: s.filename}
	sfPath, err := cli.SaltpackSignFile(mctx.Ctx(), sfArg)
	if err != nil {
		return err
	}
	dui.Printf("signed file: %s\n", sfPath)

	dui.Printf("verifying file %s\n", sfPath)
	vfArg := keybase1.SaltpackVerifyFileArg{SignedFilename: sfPath}
	vfres, err := cli.SaltpackVerifyFile(mctx.Ctx(), vfArg)
	if err != nil {
		return err
	}
	dui.Printf("verified result: %+v\n", vfres)

	return nil
}
