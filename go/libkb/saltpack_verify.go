// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"crypto/hmac"
	"io"

	"github.com/keybase/client/go/saltpack"
)

func SaltPackVerify(g *GlobalContext, source io.Reader, sink io.WriteCloser, checkSender func(saltpack.SigningPublicKey) error) error {
	kr := echoKeyring{Contextified: NewContextified(g)}
	skey, vs, frame, err := saltpack.NewDearmor62VerifyStream(source, kr)
	if err != nil {
		g.Log.Debug("saltpack.NewDearmor62VerifyStream error: %s", err)
		return err
	}

	if checkSender != nil {
		if err = checkSender(skey); err != nil {
			return err
		}
	}

	n, err := io.Copy(sink, vs)
	if err != nil {
		return err
	}

	if err := saltpack.CheckArmor62Frame(frame, saltpack.SignedArmorHeader, saltpack.SignedArmorFooter); err != nil {
		return err
	}

	g.Log.Debug("Verify: read %d bytes", n)

	if err := sink.Close(); err != nil {
		return err
	}

	return nil
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
	if s.PublicKey() == nil {
		return nil
	}

	if hmac.Equal(s.PublicKey().ToKID(), kid) {
		return s.PublicKey()
	}

	return nil
}
