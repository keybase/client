package engine

import (
	"github.com/keybase/client/go/libkb"
	"strings"
)

// PGPSave is an engine to submit pgp keys to keyring and
// optionally to keybase.io.
type PGPSave struct {
	libkb.Contextified
	key         []byte
	pushPrivate bool
}

// NewPGPSaveRaw creates a PGPSave engine that will save a raw
// pgp key.
func NewPGPSave(key []byte, pushPrivate bool) *PGPSave {
	return &PGPSave{
		key:         key,
		pushPrivate: pushPrivate,
	}
}

// Name is engine name.
func (p *PGPSave) Name() string {
	return "PGPSave"
}

// GetPrereqs returns any requirements for this engine to run.
func (p *PGPSave) GetPrereqs() EnginePrereqs {
	return EnginePrereqs{Session: true}
}

// RequiredUIs returns any ui requirements.
func (p *PGPSave) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{libkb.LogUIKind, libkb.SecretUIKind}
}

// SubConsumers returns and ui consumers that this engine uses.
func (p *PGPSave) SubConsumers() []libkb.UIConsumer {
	return nil
}

func (p *PGPSave) isArmored() bool {
	tmp := strings.TrimSpace(string(p.key))
	return strings.HasPrefix(tmp, "-----")
}

// Run executes the engine.
func (p *PGPSave) Run(ctx *Context) error {
	var bundle *libkb.PgpKeyBundle
	var err error
	if p.isArmored() {
		bundle, err = libkb.ReadOneKeyFromString(string(p.key))
	} else {
		bundle, err = libkb.ReadOneKeyFromBytes(p.key)
	}
	if err != nil {
		return err
	}
	arg := PGPKeyImportEngineArg{
		Pregen:     bundle,
		PushSecret: p.pushPrivate,
		AllowMulti: true,
		DoExport:   false,
	}

	eng := NewPGPKeyImportEngine(arg)
	return RunEngine(eng, ctx)
}
