// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

//
// engine.PGPKeyImportEngine is a class for optionally generating PGP keys,
// and pushing them into the keybase sigchain via the Delegator.
//

import (
	"bytes"
	"errors"
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
	arg       keybase1.PGPQuery
	encrypted bool
	qtype     queryType
	res       []keybase1.KeyInfo
	me        *libkb.User
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
		encrypted:    arg.Encrypted,
		Contextified: libkb.NewContextified(g),
	}
}

func NewPGPKeyExportByKIDEngine(arg keybase1.PGPExportByKIDArg, g *libkb.GlobalContext) *PGPKeyExportEngine {
	return &PGPKeyExportEngine{
		arg:          arg.Options,
		qtype:        kid,
		encrypted:    arg.Encrypted,
		Contextified: libkb.NewContextified(g),
	}
}

func NewPGPKeyExportByFingerprintEngine(arg keybase1.PGPExportByFingerprintArg, g *libkb.GlobalContext) *PGPKeyExportEngine {
	return &PGPKeyExportEngine{
		arg:          arg.Options,
		qtype:        fingerprint,
		encrypted:    arg.Encrypted,
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
	key, skb, err := e.G().Keyrings.GetSecretKeyAndSKBWithPrompt(ctx.SecretKeyPromptArg(ska, "key export"))
	if err != nil {
		if _, ok := err.(libkb.NoSecretKeyError); ok {
			// if no secret key found, don't return an error, just let
			// the result be empty
			return nil
		}
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

	raw := skb.RawUnlockedKey()
	if raw == nil {
		return libkb.BadKeyError{Msg: "can't get raw representation of key"}
	}

	if e.encrypted {
		// Make encrypted PGP key bundle using provided passphrase.
		// Key will be reimported from bytes so we don't mutate SKB.
		raw, err = e.encryptKey(ctx, raw)
		if err != nil {
			return err
		}
	}

	ret, err := libkb.PGPKeyRawToArmored(raw, true)
	if err != nil {
		return err
	}

	e.pushRes(*fp, ret, "")

	return nil
}

func GetPGPExportPassphrase(g *libkb.GlobalContext, ui libkb.SecretUI, desc string) (keybase1.GetPassphraseRes, error) {
	pRes, err := libkb.GetSecret(g, ui, "PGP key passphrase", desc, "", false)
	if err != nil {
		return keybase1.GetPassphraseRes{}, err
	}

	desc = "Please reenter your passphrase for confirmation"
	pRes2, err := libkb.GetSecret(g, ui, "PGP key passphrase", desc, "", false)
	if pRes.Passphrase != pRes2.Passphrase {
		return keybase1.GetPassphraseRes{}, errors.New("Passphrase mismatch")
	}

	return pRes, nil
}

func (e *PGPKeyExportEngine) encryptKey(ctx *Context, raw []byte) ([]byte, error) {
	entity, _, err := libkb.ReadOneKeyFromBytes(raw)
	if err != nil {
		return nil, err
	}

	if entity.PrivateKey == nil {
		return nil, libkb.BadKeyError{Msg: "No secret part in PGP key."}
	}

	desc := "Enter passphrase to protect your PGP key. Secure passphrases have at least 8 characters."
	pRes, err := GetPGPExportPassphrase(e.G(), ctx.SecretUI, desc)
	if err != nil {
		return nil, err
	}

	if err = libkb.EncryptPGPKey(entity.Entity, pRes.Passphrase); err != nil {
		return nil, err
	}

	var buf bytes.Buffer
	if err = entity.SerializePrivate(&buf); err != nil {
		return nil, err
	}

	return buf.Bytes(), nil
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
