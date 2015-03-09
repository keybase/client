package engine

//
// engine.PGPEngine is a class for optionally generating PGP keys,
// and pushing them into the keybase sigchain via the Delegator.
//

import (
	"github.com/keybase/client/go/libkb"
	"io"
)

type PGPSignEngine struct {
	libkb.Contextified
}

type PGPSignArg struct {
	Sink     io.WriteCloser
	Source   io.ReadCloser
	KeyQuery string
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

func (p *PGPSignEngine) Run(ctx *Context, args interface{}, reply interface{}) (err error) {
	return
}
