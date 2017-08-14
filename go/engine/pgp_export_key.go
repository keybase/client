// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

//
// engine.PGPKeyImportEngine is a class for optionally generating PGP keys,
// and pushing them into the keybase sigchain via the Delegator.
//

import (
	"bytes"
	"fmt"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

type queryType int

const (
	unset queryType = iota
	fingerprint
	kid
	either
)

type PGPKeyExportEngine struct {
	libkb.Contextified
	arg         keybase1.PGPQuery
	unencrypted bool
	qtype       queryType
	res         []keybase1.KeyInfo
	me          *libkb.User
}

func (e *PGPKeyExportEngine) Prereqs() Prereqs {
	return Prereqs{
		Session: true,
	}
}

func (e *PGPKeyExportEngine) Name() string {
	return "PGPKeyExportEngine"
}

func (e *PGPKeyExportEngine) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{
		libkb.SecretUIKind,
	}
}

func (e *PGPKeyExportEngine) SubConsumers() []libkb.UIConsumer {
	return nil
}

func (e *PGPKeyExportEngine) Results() []keybase1.KeyInfo {
	return e.res
}

func NewPGPKeyExportEngine(arg keybase1.PGPExportArg, g *libkb.GlobalContext) *PGPKeyExportEngine {
	return &PGPKeyExportEngine{
		arg:          arg.Options,
		qtype:        either,
		unencrypted:  arg.Unencrypted,
		Contextified: libkb.NewContextified(g),
	}
}

func NewPGPKeyExportByKIDEngine(arg keybase1.PGPExportByKIDArg, g *libkb.GlobalContext) *PGPKeyExportEngine {
	return &PGPKeyExportEngine{
		arg:          arg.Options,
		qtype:        kid,
		unencrypted:  arg.Unencrypted,
		Contextified: libkb.NewContextified(g),
	}
}

func NewPGPKeyExportByFingerprintEngine(arg keybase1.PGPExportByFingerprintArg, g *libkb.GlobalContext) *PGPKeyExportEngine {
	return &PGPKeyExportEngine{
		arg:          arg.Options,
		qtype:        fingerprint,
		unencrypted:  arg.Unencrypted,
		Contextified: libkb.NewContextified(g),
	}
}

func (e *PGPKeyExportEngine) pushRes(fp libkb.PGPFingerprint, key string, desc string) {
	e.res = append(e.res, keybase1.KeyInfo{
		Fingerprint: fp.String(),
		Key:         key,
		Desc:        desc,
	})
}

func (e *PGPKeyExportEngine) queryMatch(k libkb.GenericKey) bool {
	if len(e.arg.Query) == 0 {
		return true
	}
	var match bool
	switch e.qtype {
	case either:
		match = libkb.KeyMatchesQuery(k, e.arg.Query, e.arg.ExactMatch)
	case fingerprint:
		if fp := libkb.GetPGPFingerprintFromGenericKey(k); fp != nil {
			match = fp.Match(e.arg.Query, e.arg.ExactMatch)
		}
	case kid:
		match = k.GetKID().Match(e.arg.Query, e.arg.ExactMatch)
	}
	return match
}

func (e *PGPKeyExportEngine) exportPublic() (err error) {
	keys := e.me.GetActivePGPKeys(false)
	for _, k := range keys {
		fp := k.GetFingerprintP()
		s, err := k.Encode()
		if fp == nil || err != nil {
			continue
		}
		if !e.queryMatch(k) {
			continue
		}
		e.pushRes(*fp, s, k.VerboseDescription())
	}
	return
}

func (e *PGPKeyExportEngine) exportSecret(ctx *Context) error {
	ska := libkb.SecretKeyArg{
		Me:         e.me,
		KeyType:    libkb.PGPKeyType,
		KeyQuery:   e.arg.Query,
		ExactMatch: e.arg.ExactMatch,
	}

	var passphrase string

	skb, err := e.G().Keyrings.GetSecretKeyLocked(ctx.LoginContext, ska)
	if err != nil {
		return nil
	}

	skb.SetUID(e.me.GetUID())
	secretStore := libkb.NewSecretStore(e.G(), e.me.GetNormalizedName())

	unlockDesc, err := skb.HumanDescription(e.me)
	if err != nil {
		return nil
	}

	unlocker := func(pw string, storeSecret bool) (ret libkb.GenericKey, err error) {
		var secretStorer libkb.SecretStorer
		if storeSecret {
			secretStorer = secretStore
		}
		if !e.unencrypted {
			// save passphrase to encrypt key later
			passphrase = pw
		}
		if skb.RawUnlockedKey() != nil {
			e.G().Log.Debug("exportSecret: Key is already unlocked, unlocking again to verify passphrase.")
		}
		return skb.UnlockSecretKey(ctx.LoginContext, pw, nil, nil, secretStorer)
	}

	reason := "key unlock for export "
	if e.unencrypted {
		reason += "(not encrypted)"
	} else {
		reason += "(encrypted with passphrase)"
	}

	keyUnlocker := libkb.NewKeyUnlocker(e.G(), 4, reason, unlockDesc, libkb.PassphraseTypeKeybase, (secretStore != nil), ctx.SecretUI, unlocker)

	key, err := keyUnlocker.Run()
	if err != nil {
		return err
	}

	fp := libkb.GetPGPFingerprintFromGenericKey(key)
	if fp == nil {
		return libkb.BadKeyError{Msg: "no fingerprint found"}
	}

	if !e.queryMatch(key) {
		return nil
	}

	if _, ok := key.(*libkb.PGPKeyBundle); !ok {
		return libkb.BadKeyError{Msg: "Expected a PGP key"}
	}

	var raw []byte

	if e.unencrypted {
		// User wanted un-encrypted key. Just pass raw bytes
		raw = skb.RawUnlockedKey()

		if raw == nil {
			return libkb.BadKeyError{Msg: "can't get raw representation of key"}
		}
	} else {
		// Make encrypted PGP key bundle using user's passphrase
		// provided at the beginning. Reimport key so we don't mutate
		// key entity stored in SKB.
		entity, _, err := libkb.ReadOneKeyFromBytes(skb.RawUnlockedKey())
		if err != nil {
			return err
		}

		if entity.PrivateKey == nil {
			return libkb.BadKeyError{Msg: "No secret part in PGP key."}
		}

		if err = entity.PrivateKey.Encrypt([]byte(passphrase), nil); err != nil {
			return err
		}

		var buf bytes.Buffer
		if err = entity.SerializePrivate(&buf); err != nil {
			return err
		}

		raw = buf.Bytes()
	}

	ret, err := libkb.PGPKeyRawToArmored(raw, true)
	if err != nil {
		return err
	}

	e.pushRes(*fp, ret, "")

	return nil
}

func (e *PGPKeyExportEngine) loadMe() (err error) {
	e.me, err = libkb.LoadMe(libkb.NewLoadUserPubOptionalArg(e.G()))
	return
}

func (e *PGPKeyExportEngine) Run(ctx *Context) (err error) {

	e.G().Log.Debug("+ PGPKeyExportEngine::Run")
	defer func() {
		e.G().Log.Debug("- PGPKeyExportEngine::Run -> %s", libkb.ErrToOk(err))
	}()

	if e.qtype == unset {
		return fmt.Errorf("PGPKeyExportEngine: query type not set")
	}

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
