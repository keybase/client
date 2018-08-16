// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"bytes"
	"crypto/hmac"
	"io"

	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/saltpack"
)

// SaltpackVerifyContext is context for engine calls
type SaltpackVerifyContext interface {
	GetLog() logger.Logger
}

func SaltpackVerify(g SaltpackVerifyContext, source io.Reader, sink io.WriteCloser, checkSender func(saltpack.SigningPublicKey) error) (sender keybase1.SaltpackSender, err error) {
	sc, newSource, err := ClassifyStream(source)
	if err != nil {
		return keybase1.SaltpackSender{}, err
	}
	if sc.Format != CryptoMessageFormatSaltpack {
		return keybase1.SaltpackSender{}, WrongCryptoFormatError{
			Wanted:    CryptoMessageFormatSaltpack,
			Received:  sc.Format,
			Operation: "verify",
		}
	}
	source = newSource

	kr := echoKeyring{}

	var skey saltpack.SigningPublicKey
	var vs io.Reader
	var brand string
	if sc.Armored {
		skey, vs, brand, err = saltpack.NewDearmor62VerifyStream(saltpack.CheckKnownMajorVersion, source, kr)
	} else {
		skey, vs, err = saltpack.NewVerifyStream(saltpack.CheckKnownMajorVersion, source, kr)
	}
	if err != nil {
		g.GetLog().Debug("saltpack.NewDearmor62VerifyStream error: %s", err)
		return keybase1.SaltpackSender{}, VerificationError{Cause: err}
	}

	if checkSender != nil {
		if err = checkSender(skey); err != nil {
			return keybase1.SaltpackSender{}, VerificationError{Cause: err}
		}
	}

	n, err := io.Copy(sink, vs)
	if err != nil {
		return keybase1.SaltpackSender{}, VerificationError{Cause: err}
	}

	if sc.Armored {
		if err = checkSaltpackBrand(brand); err != nil {
			return keybase1.SaltpackSender{}, VerificationError{Cause: err}
		}
	}

	g.GetLog().Debug("Verify: read %d bytes", n)

	if err := sink.Close(); err != nil {
		return keybase1.SaltpackSender{}, VerificationError{Cause: err}
	}
	return sender, nil
}

func SaltpackVerifyDetached(g SaltpackVerifyContext, message io.Reader, signature []byte, checkSender func(saltpack.SigningPublicKey) error) (sender keybase1.SaltpackSender, err error) {
	sc, _, err := ClassifyStream(bytes.NewReader(signature))
	if err != nil {
		return keybase1.SaltpackSender{}, err
	}
	if sc.Format != CryptoMessageFormatSaltpack {
		return keybase1.SaltpackSender{}, WrongCryptoFormatError{
			Wanted:    CryptoMessageFormatSaltpack,
			Received:  sc.Format,
			Operation: "verify detached",
		}
	}

	kr := echoKeyring{}

	var skey saltpack.SigningPublicKey
	if sc.Armored {
		var brand string
		skey, brand, err = saltpack.Dearmor62VerifyDetachedReader(saltpack.CheckKnownMajorVersion, message, string(signature), kr)
		if err != nil {
			g.GetLog().Debug("saltpack.Dearmor62VerifyDetachedReader error: %s", err)
			return keybase1.SaltpackSender{}, VerificationError{Cause: err}
		}
		if err = checkSaltpackBrand(brand); err != nil {
			return keybase1.SaltpackSender{}, VerificationError{Cause: err}
		}
	} else {
		skey, err = saltpack.VerifyDetachedReader(saltpack.CheckKnownMajorVersion, message, signature, kr)
		if err != nil {
			g.GetLog().Debug("saltpack.VerifyDetachedReader error: %s", err)
			return keybase1.SaltpackSender{}, VerificationError{Cause: err}
		}
	}

	if checkSender != nil {
		if err = checkSender(skey); err != nil {
			return keybase1.SaltpackSender{}, VerificationError{Cause: err}
		}
	}

	return sender, nil
}

type echoKeyring struct {
	Contextified
}

func (e echoKeyring) LookupSigningPublicKey(kid []byte) saltpack.SigningPublicKey {
	var k NaclSigningKeyPublic
	copy(k[:], kid)
	return saltSignerPublic{key: k}
}

type sigKeyring struct {
	saltSigner
}

func (s sigKeyring) LookupSigningPublicKey(kid []byte) saltpack.SigningPublicKey {
	if s.GetPublicKey() == nil {
		return nil
	}

	if hmac.Equal(s.GetPublicKey().ToKID(), kid) {
		return s.GetPublicKey()
	}

	return nil
}
