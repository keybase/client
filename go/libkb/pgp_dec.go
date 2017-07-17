// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"bytes"
	"fmt"
	"io"
	"io/ioutil"
	"time"

	"github.com/keybase/go-crypto/openpgp"
	"github.com/keybase/go-crypto/openpgp/armor"
	"github.com/keybase/go-crypto/openpgp/clearsign"
	"github.com/keybase/go-crypto/openpgp/errors"
)

type SignatureStatus struct {
	IsSigned        bool
	Verified        bool
	SignatureError  error
	KeyID           uint64
	Entity          *openpgp.Entity
	SignatureTime   time.Time
	RecipientKeyIDs []uint64
}

func PGPDecryptWithBundles(g *GlobalContext, source io.Reader, sink io.Writer, keys []*PGPKeyBundle) (*SignatureStatus, error) {
	opkr := make(openpgp.EntityList, len(keys))
	for i, k := range keys {
		opkr[i] = k.Entity
	}
	return PGPDecrypt(g, source, sink, opkr)
}

func PGPDecrypt(g *GlobalContext, source io.Reader, sink io.Writer, kr openpgp.KeyRing) (*SignatureStatus, error) {

	var sc StreamClassification
	var err error

	sc, source, err = ClassifyStream(source)
	if err != nil {
		return nil, err
	}

	if sc.Format != CryptoMessageFormatPGP {
		return nil, WrongCryptoFormatError{
			Wanted:    CryptoMessageFormatPGP,
			Received:  sc.Format,
			Operation: "decrypt",
		}
	}

	if sc.Type == CryptoMessageTypeClearSignature {
		return pgpDecryptClearsign(g, source, sink, kr)
	}

	if sc.Armored {
		b, err := armor.Decode(source)
		if err != nil {
			return nil, err
		}
		source = b.Body
	}

	g.Log.Debug("Calling into openpgp ReadMessage for decryption")
	md, err := openpgp.ReadMessage(source, kr, nil, nil)
	if err != nil {
		if err == errors.ErrKeyIncorrect {
			return nil, NoDecryptionKeyError{Msg: "unable to find a PGP decryption key for this message"}
		}
		return nil, err
	}

	if md.IsSigned {
		g.Log.Debug("message is signed (SignedByKeyId: %+v) (have key? %v)", md.SignedByKeyId, md.SignedBy != nil)
	}

	n, err := io.Copy(sink, md.UnverifiedBody)
	if err != nil {
		return nil, err
	}
	g.Log.Debug("PGPDecrypt: copied %d bytes to writer", n)

	var status SignatureStatus
	if md.IsSigned {
		status.IsSigned = true
		status.KeyID = md.SignedByKeyId
		if md.Signature != nil {
			status.SignatureTime = md.Signature.CreationTime
		}
		if md.SignedBy != nil {
			status.Entity = md.SignedBy.Entity
		}
		if md.SignatureError != nil {
			status.SignatureError = md.SignatureError
		} else {
			status.Verified = true
		}
	}

	status.RecipientKeyIDs = md.EncryptedToKeyIds

	return &status, nil
}

func pgpDecryptClearsign(g *GlobalContext, source io.Reader, sink io.Writer, kr openpgp.KeyRing) (*SignatureStatus, error) {
	// clearsign decode only works with the whole data slice, not a reader
	// so have to read it all here:
	msg, err := ioutil.ReadAll(source)
	if err != nil {
		return nil, err
	}
	b, _ := clearsign.Decode(msg)
	if b == nil {
		return nil, fmt.Errorf("Unable to decode clearsigned message")
	}

	signer, err := openpgp.CheckDetachedSignature(kr, bytes.NewReader(b.Bytes), b.ArmoredSignature.Body)
	if err != nil {
		return nil, fmt.Errorf("Check sig error: %s", err)
	}

	n, err := io.Copy(sink, bytes.NewReader(b.Plaintext))
	if err != nil {
		return nil, err
	}
	g.Log.Debug("PGPDecrypt: copied %d bytes to writer", n)

	var status SignatureStatus
	if signer == nil {
		return &status, nil
	}

	status.IsSigned = true
	status.Verified = true
	status.Entity = signer

	return &status, nil
}
