package libkb

import (
	"bytes"
	"crypto"
	"fmt"
	"io"

	"github.com/keybase/go-crypto/openpgp/armor"

	"github.com/keybase/go-crypto/openpgp"
	"github.com/keybase/go-crypto/openpgp/errors"
	"github.com/keybase/go-crypto/openpgp/packet"
)

func ExtractPGPSignatureHashMethod(keyring openpgp.KeyRing, sig []byte) (crypto.Hash, uint64, error) {
	var (
		rd io.Reader

		p                 packet.Packet
		hashFunc          crypto.Hash
		issuerFingerprint []byte
		issuerKeyID       uint64
		err               error
	)

	if IsArmored(sig) {
		armored, err := armor.Decode(bytes.NewReader(sig))
		if err != nil {
			return 0, 0, err
		}
		rd = armored.Body
	} else {
		rd = bytes.NewReader(sig)
	}

	packets := packet.NewReader(rd)
	for {
		p, err = packets.Next()
		if err == io.EOF {
			if hashFunc != 0 {
				return hashFunc, 0, nil
			}

			return 0, 0, errors.ErrUnknownIssuer
		}
		if err != nil {
			return 0, 0, err
		}

		switch sig := p.(type) {
		case *packet.Signature:
			if sig.IssuerKeyId == nil {
				return 0, 0, errors.StructuralError("signature doesn't have an issuer")
			}
			issuerKeyID = *sig.IssuerKeyId
			hashFunc = sig.Hash
			issuerFingerprint = sig.IssuerFingerprint
		case *packet.SignatureV3:
			issuerKeyID = sig.IssuerKeyId
			hashFunc = sig.Hash
		default:
			return 0, 0, errors.StructuralError("non signature packet found")
		}

		if keyring != nil {
			keys := keyring.KeysByIdUsage(issuerKeyID, issuerFingerprint, packet.KeyFlagSign)
			if len(keys) > 0 {
				return hashFunc, issuerKeyID, nil
			}
		}
	}
}

var HashToName = map[crypto.Hash]string{
	crypto.MD4:         "MD4",
	crypto.MD5:         "MD5",
	crypto.SHA1:        "SHA1",
	crypto.SHA224:      "SHA2-224",
	crypto.SHA256:      "SHA2-256",
	crypto.SHA384:      "SHA2-384",
	crypto.SHA512:      "SHA2-512",
	crypto.RIPEMD160:   "RIPEMD-160",
	crypto.SHA3_224:    "SHA3-224",
	crypto.SHA3_256:    "SHA3-256",
	crypto.SHA3_384:    "SHA3-384",
	crypto.SHA3_512:    "SHA3-512",
	crypto.SHA512_224:  "SHA2-512/224",
	crypto.SHA512_256:  "SHA2-512/256",
	crypto.BLAKE2s_256: "BLAKE2s-256",
	crypto.BLAKE2b_256: "BLAKE2b-256",
	crypto.BLAKE2b_384: "BLAKE2b-384",
	crypto.BLAKE2b_512: "BLAKE2b-512",
}

func IsHashSecure(hash crypto.Hash) bool {
	switch hash {
	case crypto.SHA224,
		crypto.SHA256,
		crypto.SHA384,
		crypto.SHA512,
		crypto.SHA3_224,
		crypto.SHA3_256,
		crypto.SHA3_384,
		crypto.SHA3_512,
		crypto.SHA512_224,
		crypto.SHA512_256,
		crypto.BLAKE2s_256,
		crypto.BLAKE2b_256,
		crypto.BLAKE2b_384,
		crypto.BLAKE2b_512:
		return true
	default:
		return false
	}
}

type HashSecurityWarningType uint8

const (
	HashSecurityWarningUnknown HashSecurityWarningType = iota
	HashSecurityWarningSignatureHash
	HashSecurityWarningSignersIdentityHash
	HashSecurityWarningRecipientsIdentityHash
	HashSecurityWarningOurIdentityHash
)

type HashSecurityWarning struct {
	kind        HashSecurityWarningType
	hash        crypto.Hash
	fingerprint *PGPFingerprint
}

func NewHashSecurityWarning(kind HashSecurityWarningType, hash crypto.Hash, fp *PGPFingerprint) HashSecurityWarning {
	return HashSecurityWarning{kind: kind, hash: hash, fingerprint: fp}
}

func (h HashSecurityWarning) String() string {
	switch h.kind {
	case HashSecurityWarningSignatureHash:
		return fmt.Sprintf("Message was signed using an insecure hash scheme (%s)", HashToName[h.hash])
	case HashSecurityWarningSignersIdentityHash:
		return fmt.Sprintf("Signer's key %s uses an insecure hash scheme (%s)", h.fingerprint.String(), HashToName[h.hash])
	case HashSecurityWarningRecipientsIdentityHash:
		return fmt.Sprintf("Recipient's key %s uses an insecure hash scheme (%s)", h.fingerprint.String(), HashToName[h.hash])
	case HashSecurityWarningOurIdentityHash:
		return fmt.Sprintf("Our PGP key %s uses an insecure hash scheme (%s)", h.fingerprint.String(), HashToName[h.hash])
	default:
		return fmt.Sprintf("Hash security warning was passed an incorrect kind, got %d", h.kind)
	}
}

type HashSecurityWarnings []HashSecurityWarning

func (hs HashSecurityWarnings) Strings() (res []string) {
	for _, h := range hs {
		res = append(res, h.String())
	}
	return
}
