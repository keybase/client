// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"errors"
	"io"

	"github.com/keybase/saltpack"
)

type SaltpackEncryptArg struct {
	Source             io.Reader
	Sink               io.WriteCloser
	Receivers          []NaclDHKeyPublic
	Sender             NaclDHKeyPair
	SenderSigning      NaclSigningKeyPair
	Binary             bool
	EncryptionOnlyMode bool
	SymmetricReceivers []saltpack.ReceiverSymmetricKey
	SaltpackVersion    saltpack.Version

	VisibleRecipientsForTesting bool
}

// SaltpackEncrypt reads from the given source, encrypts it for the given
// receivers from the given sender, and writes it to sink.  If
// Binary is false, the data written to sink will be armored.
func SaltpackEncrypt(g *GlobalContext, arg *SaltpackEncryptArg) error {
	var receiverBoxKeys []saltpack.BoxPublicKey
	for _, k := range arg.Receivers {
		// Since signcryption became the default, we never use visible
		// recipients in encryption mode, except in tests.
		if arg.VisibleRecipientsForTesting {
			receiverBoxKeys = append(receiverBoxKeys, naclBoxPublicKey(k))
		} else {
			receiverBoxKeys = append(receiverBoxKeys, hiddenNaclBoxPublicKey(k))
		}
	}

	var bsk saltpack.BoxSecretKey
	if !arg.Sender.IsNil() {
		bsk = naclBoxSecretKey(arg.Sender)
	}

	// If the version is unspecified, default to the current version.
	saltpackVersion := arg.SaltpackVersion
	if saltpackVersion == (saltpack.Version{}) {
		saltpackVersion = saltpack.CurrentVersion()
	}

	var plainsink io.WriteCloser
	var err error
	if !arg.EncryptionOnlyMode {
		if arg.SaltpackVersion.Major == 1 {
			return errors.New("specifying the saltpack version 1 requires --current-devices-only")
		}
		var signer saltpack.SigningSecretKey
		if !arg.SenderSigning.IsNil() {
			signer = saltSigner{arg.SenderSigning}
		}
		if arg.Binary {
			plainsink, err = saltpack.NewSigncryptSealStream(arg.Sink, emptyKeyring{}, signer, receiverBoxKeys, arg.SymmetricReceivers)
		} else {
			plainsink, err = saltpack.NewSigncryptArmor62SealStream(arg.Sink, emptyKeyring{}, signer, receiverBoxKeys, arg.SymmetricReceivers, KeybaseSaltpackBrand)
		}
	} else {
		if arg.Binary {
			plainsink, err = saltpack.NewEncryptStream(saltpackVersion, arg.Sink, bsk, receiverBoxKeys)
		} else {
			plainsink, err = saltpack.NewEncryptArmor62Stream(saltpackVersion, arg.Sink, bsk, receiverBoxKeys, KeybaseSaltpackBrand)
		}
	}
	if err != nil {
		return err
	}

	n, err := io.Copy(plainsink, arg.Source)
	if err != nil {
		return err
	}

	g.Log.Debug("Encrypt: wrote %d bytes", n)

	if err := plainsink.Close(); err != nil {
		return err
	}
	if err := arg.Sink.Close(); err != nil {
		return err
	}

	return nil
}
