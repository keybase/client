package libkb

import (
	"io"

	"golang.org/x/crypto/openpgp"
	"golang.org/x/crypto/openpgp/armor"
)

type SignatureStatus struct {
	IsSigned       bool
	Verified       bool
	SignatureError error
	KeyID          uint64
	Entity         *openpgp.Entity
}

func PGPDecryptWithBundles(source io.Reader, sink io.Writer, keys []*PgpKeyBundle) (*SignatureStatus, error) {
	opkr := make(openpgp.EntityList, len(keys))
	for i, k := range keys {
		opkr[i] = (*openpgp.Entity)(k)
	}
	return PGPDecrypt(source, sink, opkr)
}

func PGPDecrypt(source io.Reader, sink io.Writer, kr openpgp.KeyRing) (*SignatureStatus, error) {
	peeker := NewPeeker(source)
	head := make([]byte, 10)
	_, err := peeker.Peek(head)
	if err != nil {
		return nil, err
	}

	var r io.Reader = peeker
	if IsArmored(head) {
		b, err := armor.Decode(r)
		if err != nil {
			return nil, err
		}
		r = b.Body
	}

	md, err := openpgp.ReadMessage(r, kr, nil, nil)
	if err != nil {
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
