// Copyright 2015 Keybase, Inc. All rights reserved. Use of
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

	"github.com/keybase/client/go/kbcrypto"
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
		Device: true,
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

func NewPGPKeyExportEngine(g *libkb.GlobalContext, arg keybase1.PGPExportArg) *PGPKeyExportEngine {
	return &PGPKeyExportEngine{
		arg:          arg.Options,
		qtype:        either,
		encrypted:    arg.Encrypted,
		Contextified: libkb.NewContextified(g),
	}
}

func NewPGPKeyExportByKIDEngine(g *libkb.GlobalContext, arg keybase1.PGPExportByKIDArg) *PGPKeyExportEngine {
	return &PGPKeyExportEngine{
		arg:          arg.Options,
		qtype:        kid,
		encrypted:    arg.Encrypted,
		Contextified: libkb.NewContextified(g),
	}
}

func NewPGPKeyExportByFingerprintEngine(g *libkb.GlobalContext, arg keybase1.PGPExportByFingerprintArg) *PGPKeyExportEngine {
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

func (e *PGPKeyExportEngine) exportSecret(m libkb.MetaContext) error {
	ska := libkb.SecretKeyArg{
		Me:         e.me,
		KeyType:    libkb.PGPKeyType,
		KeyQuery:   e.arg.Query,
		ExactMatch: e.arg.ExactMatch,
	}
	key, skb, err := m.G().Keyrings.GetSecretKeyAndSKBWithPrompt(m, m.SecretKeyPromptArg(ska, "key export"))
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
		return kbcrypto.BadKeyError{Msg: "no fingerprint found"}
	}

	if !e.queryMatch(key) {
		return nil
	}

	if _, ok := key.(*libkb.PGPKeyBundle); !ok {
		return kbcrypto.BadKeyError{Msg: "Expected a PGP key"}
	}

	raw := skb.RawUnlockedKey()
	if raw == nil {
		return kbcrypto.BadKeyError{Msg: "can't get raw representation of key"}
	}

	if e.encrypted {
		// Make encrypted PGP key bundle using provided passphrase.
		// Key will be reimported from bytes so we don't mutate SKB.
		raw, err = e.encryptKey(m, raw)
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

func GetPGPExportPassphrase(m libkb.MetaContext, ui libkb.SecretUI, desc string) (keybase1.GetPassphraseRes, error) {
	pRes, err := libkb.GetSecret(m, ui, "PGP key passphrase", desc, "", false)
	if err != nil {
		return keybase1.GetPassphraseRes{}, err
	}

	desc = "Please reenter your passphrase for confirmation"
	pRes2, err := libkb.GetSecret(m, ui, "PGP key passphrase", desc, "", false)
	if err != nil {
		return keybase1.GetPassphraseRes{}, err
	}
	if pRes.Passphrase != pRes2.Passphrase {
		return keybase1.GetPassphraseRes{}, errors.New("Passphrase mismatch")
	}

	return pRes, nil
}

func (e *PGPKeyExportEngine) encryptKey(m libkb.MetaContext, raw []byte) ([]byte, error) {
	entity, _, err := libkb.ReadOneKeyFromBytes(raw)
	if err != nil {
		return nil, err
	}

	if entity.PrivateKey == nil {
		return nil, kbcrypto.BadKeyError{Msg: "No secret part in PGP key."}
	}

	desc := "Enter passphrase to protect your PGP key. Secure passphrases have at least 8 characters."
	pRes, err := GetPGPExportPassphrase(m, m.UIs().SecretUI, desc)
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

func (e *PGPKeyExportEngine) loadMe(m libkb.MetaContext) (err error) {
	e.me, err = libkb.LoadMe(libkb.NewLoadUserArgWithMetaContext(m).WithPublicKeyOptional())
	return
}

func (e *PGPKeyExportEngine) Run(m libkb.MetaContext) (err error) {
	defer m.Trace("PGPKeyExportEngine::Run", func() error { return err })()

	if e.qtype == unset {
		return fmt.Errorf("PGPKeyExportEngine: query type not set")
	}

	if err = e.loadMe(m); err != nil {
		return
	}

	if e.arg.Secret {
		err = e.exportSecret(m)
	} else {
		err = e.exportPublic()
	}

	return
}
