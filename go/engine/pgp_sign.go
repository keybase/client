package engine

import (
	"fmt"
	"io"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/protocol/go"

	"golang.org/x/crypto/openpgp"
	"golang.org/x/crypto/openpgp/clearsign"
)

type PGPSignEngine struct {
	arg *PGPSignArg
	libkb.Contextified
}

type PGPSignArg struct {
	Sink   io.WriteCloser
	Source io.ReadCloser
	Opts   keybase1.PgpSignOptions
}

func (p *PGPSignEngine) GetPrereqs() EnginePrereqs {
	return EnginePrereqs{
		Session: true,
	}
}

func (p *PGPSignEngine) Name() string {
	return "PGPSignEngine"
}

func (p *PGPSignEngine) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{
		libkb.SecretUIKind,
	}
}

func (p *PGPSignEngine) SubConsumers() []libkb.UIConsumer {
	return nil
}

func NewPGPSignEngine(arg *PGPSignArg, g *libkb.GlobalContext) *PGPSignEngine {
	return &PGPSignEngine{
		arg:          arg,
		Contextified: libkb.NewContextified(g),
	}
}

func (p *PGPSignEngine) Run(ctx *Context) (err error) {
	var key libkb.GenericKey
	var pgp *libkb.PgpKeyBundle
	var ok bool
	var dumpTo io.WriteCloser
	var written int64

	defer func() {
		if dumpTo != nil {
			dumpTo.Close()
		}
		p.arg.Sink.Close()
		p.arg.Source.Close()
	}()

	me, err := libkb.LoadMe(libkb.LoadUserArg{})
	if err != nil {
		return err
	}

	ska := libkb.SecretKeyArg{
		Me:       me,
		KeyType:  libkb.PGPKeyType,
		KeyQuery: p.arg.Opts.KeyQuery,
	}

	key, _, err = p.G().Keyrings.GetSecretKeyWithPrompt(ctx.LoginContext, ska, ctx.SecretUI, "command-line signature")

	if err != nil {
		return
	} else if pgp, ok = key.(*libkb.PgpKeyBundle); !ok {
		err = fmt.Errorf("Can only sign with PGP keys (for now)")
		return
	}

	bo := p.arg.Opts.BinaryOut
	bi := p.arg.Opts.BinaryIn
	pgpe := (*openpgp.Entity)(pgp)
	mode := p.arg.Opts.Mode

	switch mode {
	case keybase1.SignMode_ATTACHED:
		dumpTo, err = libkb.AttachedSignWrapper(p.arg.Sink, *pgp, !bo)
	case keybase1.SignMode_DETACHED:
		if bi && bo {
			err = openpgp.DetachSign(p.arg.Sink, pgpe, p.arg.Source, nil)
		} else if bi && !bo {
			err = openpgp.ArmoredDetachSign(p.arg.Sink, pgpe, p.arg.Source, nil)
		} else if !bi && bo {
			err = openpgp.DetachSignText(p.arg.Sink, pgpe, p.arg.Source, nil)
		} else {
			err = openpgp.ArmoredDetachSignText(p.arg.Sink, pgpe, p.arg.Source, nil)
		}
	case keybase1.SignMode_CLEAR:
		dumpTo, err = clearsign.Encode(p.arg.Sink, pgp.PrivateKey, nil)
	default:
		err = fmt.Errorf("unrecognized sign mode: %d", int(mode))
	}

	if err != nil {
		return
	}

	if dumpTo != nil {
		written, err = io.Copy(dumpTo, p.arg.Source)
		if err == nil && written == 0 {
			err = fmt.Errorf("Empty source file, nothing to sign")
		}
	}

	return
}
