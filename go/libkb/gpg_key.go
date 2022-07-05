// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"crypto/sha256"
	"errors"

	"github.com/keybase/client/go/kbcrypto"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/net/context"
)

// GPGKey is a shell around gpg cli commands that implements the
// GenericKey interface.
type GPGKey struct {
	fp  *PGPFingerprint
	kid keybase1.KID
	ui  GPGUI
	ct  keybase1.ClientType
	Contextified
}

// GPGKey implements the GenericKey interface.
var _ GenericKey = (*GPGKey)(nil)

func NewGPGKey(g *GlobalContext, fp *PGPFingerprint, kid keybase1.KID, ui GPGUI, ct keybase1.ClientType) *GPGKey {
	return &GPGKey{Contextified: NewContextified(g), fp: fp, kid: kid, ui: ui, ct: ct}
}

func (g *GPGKey) GetKID() keybase1.KID {
	return g.kid
}

func (g *GPGKey) GetBinaryKID() keybase1.BinaryKID {
	return g.GetKID().ToBinaryKID()
}

func (g *GPGKey) GetFingerprintP() *PGPFingerprint {
	return g.fp
}

func (g *GPGKey) GetAlgoType() kbcrypto.AlgoType {
	return kbcrypto.KIDPGPBase
}

func (g *GPGKey) SignToString(msg []byte) (sig string, id keybase1.SigIDBase, err error) {
	return g.SignToStringMctx(NewMetaContext(context.TODO(), g.G()), msg)
}

func (g *GPGKey) SignToStringMctx(mctx MetaContext, msg []byte) (sig string, id keybase1.SigIDBase, err error) {
	mctx.Debug("+ GPGKey Signing %s", string(msg))
	defer func() {
		mctx.Debug("- GPGKey Signing -> %s", err)
	}()

	if g.ct == keybase1.ClientType_CLI {
		mctx.Debug("| GPGKey reverse delegate to CLI")
		sig, err = g.ui.Sign(mctx.Ctx(), keybase1.SignArg{Fingerprint: (*g.fp)[:], Msg: msg})
	} else {
		mctx.Debug("| GPGKey sign in-process; let's hope for the best!")
		sig, err = g.G().GetGpgClient().Sign(mctx, *g.fp, msg)
	}

	if err != nil {
		return sig, id, err
	}

	// compute sig id:
	h := sha256.New()
	_, err = h.Write(msg)
	if err != nil {
		return sig, id, err
	}
	var hsh [32]byte
	var tmp = h.Sum(nil)
	copy(hsh[:], tmp)
	id = keybase1.SigIDBaseFromBytes(hsh)
	return sig, id, nil
}

func (g *GPGKey) VerifyStringAndExtract(ctx VerifyContext, sig string) (msg []byte, id keybase1.SigIDBase, err error) {
	return msg, id, errors.New("VerifyStringAndExtract not implemented")
}

func (g *GPGKey) VerifyString(ctx VerifyContext, sig string, msg []byte) (id keybase1.SigIDBase, err error) {
	return id, errors.New("VerifyString not implemented")
}

func (g *GPGKey) EncryptToString(plaintext []byte, sender GenericKey) (ciphertext string, err error) {
	return ciphertext, errors.New("EncryptToString not implemented")
}

func (g *GPGKey) DecryptFromString(ciphertext string) (msg []byte, sender keybase1.KID, err error) {
	return msg, sender, errors.New("DecryptFromString not implemented")
}

func (g *GPGKey) ExportPublicAndPrivate() (RawPublicKey, RawPrivateKey, error) {
	return nil, nil, errors.New("ExportPublicAndPrivate not implemented for GPGKey")
}

func (g *GPGKey) VerboseDescription() string {
	return ""
}

func (g *GPGKey) CheckSecretKey() error {
	return nil
}

func (g *GPGKey) CanSign() bool {
	return true
}

func (g *GPGKey) CanEncrypt() bool {
	return false
}

func (g *GPGKey) CanDecrypt() bool {
	return false
}

func (g *GPGKey) HasSecretKey() bool {
	return true
}

func (g *GPGKey) Encode() (string, error) {
	return "", errors.New("Encode not implemented")
}

func (g *GPGKey) SecretSymmetricKey(reason EncryptionReason) (NaclSecretBoxKey, error) {
	return NaclSecretBoxKey{}, KeyCannotEncryptError{}
}
