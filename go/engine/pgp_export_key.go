package engine

//
// engine.PGPKeyImportEngine is a class for optionally generating PGP keys,
// and pushing them into the keybase sigchain via the Delegator.
//

import (
	"github.com/keybase/client/go/libkb"
	keybase_1 "github.com/keybase/client/protocol/go"
)

type PGPKeyExportEngine struct {
	libkb.Contextified
	arg keybase_1.PgpExportArg
	res []keybase_1.FingerprintAndKey
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

func (e *PGPKeyExportEngine) Results() []keybase_1.FingerprintAndKey {
	return e.res
}

func NewPGPKeyExportEngine(arg keybase_1.PgpExportArg) *PGPKeyExportEngine {
	return &PGPKeyExportEngine{arg: arg}
}

func (e *PGPKeyExportEngine) pushRes(fp libkb.PgpFingerprint, key string, desc string) {
	e.res = append(e.res, keybase_1.FingerprintAndKey{
		Fingerprint: fp.String(),
		Key:         key,
		Desc:        desc,
	})
}

func (e *PGPKeyExportEngine) exportPublic() (err error) {
	keys := e.me.GetActivePgpKeys(false)
	for _, k := range keys {
		fp := k.GetFingerprintP()
		s, err := k.Encode()
		if fp == nil || err != nil {
			continue
		}
		if len(e.arg.Query) > 0 && !libkb.KeyMatchesQuery(k, e.arg.Query) {
			continue
		}
		e.pushRes(*fp, s, k.VerboseDescription())
	}
	return
}

func (e *PGPKeyExportEngine) exportSecret(ctx *Context) (err error) {
	ska := libkb.SecretKeyArg{
		PGPOnly:      true,
		KeyQuery:     e.arg.Query,
		SyncedPGPKey: true,
		Me:           e.me,
	}
	var key libkb.GenericKey
	var skb *libkb.SKB
	var ok bool
	var ret string

	key, skb, err = e.G().Keyrings.GetSecretKeyWithPrompt(ska, ctx.SecretUI, "key export")
	if err != nil {
		return
	}
	fp := key.GetFingerprintP()
	if fp == nil {
		err = libkb.BadKeyError{Msg: "no fingerprint found"}
		return
	}

	if _, ok = key.(*libkb.PgpKeyBundle); !ok {
		err = libkb.BadKeyError{Msg: "Expected a PGP key"}
		return
	}

	raw := skb.RawUnlockedKey()
	if raw == nil {
		err = libkb.BadKeyError{Msg: "can't get raw representation of key"}
		return
	}

	if ret, err = libkb.PgpKeyRawToArmored(raw, true); err != nil {
		return
	}

	e.pushRes(*fp, ret, "")

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
