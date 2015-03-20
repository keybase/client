package engine

//
// engine.PGPKeyImportEngine is a class for optionally generating PGP keys,
// and pushing them into the keybase sigchain via the Delegator.
//

import (
	"github.com/keybase/client/go/libkb"
	keybase_1 "github.com/keybase/client/protocol/go"
)

type PGPKeyExportEngineArg struct {
	Secret bool
	Query  string
}

type PGPKeyExportEngine struct {
	libkb.Contextified
	arg PGPKeyExportEngineArg
	res []*keybase_1.FingerprintAndKey
	me  *libkb.User
}

func (p *PGPKeyExportEngine) GetPrereqs() EnginePrereqs {
	return EnginePrereqs{
		Session: true,
	}
}

func (p *PGPKeyExportEngine) Name() string {
	return "PGPKeyExportEngine"
}

func (p *PGPKeyExportEngine) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{
		libkb.SecretUIKind,
	}
}

func (s *PGPKeyExportEngine) SubConsumers() []libkb.UIConsumer {
	return nil
}

func NewPGPKexExportEngine(arg PGPKeyExportEngineArg) *PGPKeyExportEngine {
	return &PGPKeyExportEngine{arg: arg}
}

func (e *PGPKeyExportEngine) exportPublic() (err error) {
	var me *libkb.User
	keys := me.GetActivePgpKeys(false)
	for _, k := range keys {
		fp := k.GetFingerprintP()
		s, err := k.Encode()
		if fp == nil || err != nil {
			continue
		}
		e.res = append(e.res, &keybase_1.FingerprintAndKey{
			Fingerprint: fp.String(),
			Key:         s,
		})
	}
	return
}

func (e *PGPKeyExportEngine) exportSecret(ctx *Context) (err error) {
	ska := libkb.SecretKeyArg{
		PGPOnly:      true,
		KeyQuery:     e.arg.Query,
		Reason:       "key export",
		Ui:           ctx.SecretUI,
		SyncedPGPKey: true,
	}
	var key libkb.GenericKey
	key, err = e.G().Keyrings.GetSecretKey(ska)
	if err != nil {
		return
	}
	fp := key.GetFingerprintP()
	if fp != nil {
		err = libkb.BadKeyError{Msg: "no fingerprint found"}
		return
	}
	// XXX find a way to just dump the result from the SKB raw
	// file.
	return
}

func (e *PGPKeyExportEngine) loadMe() (err error) {
	e.me, err = libkb.LoadMe(libkb.LoadUserArg{PublicKeyOptional: true})
	return
}

func (e *PGPKeyExportEngine) Run(ctx *Context) (err error) {

	e.G().Log.Debug("+ PGPKeyExportEngine::Run")
	defer func() {
		e.G().Log.Debug("- PGPKeyExportEngine::Run -> %s", libkb.ErrToOk(err))
	}()

	if err = e.loadMe(); err != nil {
		return
	}

	if e.arg.Secret {
		err = e.exportSecret(ctx)
	} else {
		err = e.exportPublic()
	}

	return
}
