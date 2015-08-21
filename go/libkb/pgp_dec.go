package libkb

import (
	"bytes"
	"fmt"
	"io"
	"io/ioutil"

	"golang.org/x/crypto/openpgp"
	"golang.org/x/crypto/openpgp/armor"
	"golang.org/x/crypto/openpgp/clearsign"
	"golang.org/x/crypto/openpgp/errors"
)

type SignatureStatus struct {
	IsSigned       bool
	Verified       bool
	SignatureError error
	KeyID          uint64
	Entity         *openpgp.Entity
}

func PGPDecryptWithBundles(source io.Reader, sink io.Writer, keys []*PGPKeyBundle) (*SignatureStatus, error) {
	opkr := make(openpgp.EntityList, len(keys))
	for i, k := range keys {
		opkr[i] = (*openpgp.Entity)(k)
	}
	return PGPDecrypt(source, sink, opkr)
}

func PGPDecrypt(source io.Reader, sink io.Writer, kr openpgp.KeyRing) (*SignatureStatus, error) {
	peeker := NewPeeker(source)

	var r io.Reader = peeker

	armored, clearsigned := PGPDetect(peeker)
	if clearsigned {
		return pgpDecryptClearsign(peeker, sink, kr)
	}

	if armored {
		b, err := armor.Decode(r)
		if err != nil {
			return nil, err
		}
		r = b.Body
	}

	G.Log.Debug("Calling into openpgp ReadMessage for decryption")
	md, err := openpgp.ReadMessage(r, kr, nil, nil)
	if err != nil {
		if err == errors.ErrKeyIncorrect {
			return nil, PGPDecError{Msg: "unable to find decryption key for this message"}
		}
		return nil, err
	}

	if md.IsSigned {
		G.Log.Debug("message is signed (SignedByKeyId: %+v) (have key? %v)", md.SignedByKeyId, md.SignedBy != nil)
	}

	n, err := io.Copy(sink, md.UnverifiedBody)
	if err != nil {
		return nil, err
	}
	G.Log.Debug("PGPDecrypt: copied %d bytes to writer", n)

	var status SignatureStatus
	if md.IsSigned {
		status.IsSigned = true
		status.KeyID = md.SignedByKeyId
		if md.SignedBy != nil {
			status.Entity = md.SignedBy.Entity
		}
		if md.SignatureError != nil {
			status.SignatureError = md.SignatureError
		} else {
			status.Verified = true
		}
	}

	return &status, nil
}

func pgpDecryptClearsign(source io.Reader, sink io.Writer, kr openpgp.KeyRing) (*SignatureStatus, error) {
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
	G.Log.Debug("PGPDecrypt: copied %d bytes to writer", n)

	var status SignatureStatus
	if signer == nil {
		return &status, nil
	}

	status.IsSigned = true
	status.Verified = true
	status.Entity = signer

	return &status, nil
}
