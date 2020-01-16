package libkb

import (
	"crypto"
	"io"

	"github.com/keybase/go-crypto/openpgp"
	"github.com/keybase/go-crypto/openpgp/errors"
	"github.com/keybase/go-crypto/openpgp/packet"
)

func ExtractPGPSignatureHashMethod(keyring openpgp.KeyRing, sig io.Reader) (crypto.Hash, error) {
	var (
		p                 packet.Packet
		hashFunc          crypto.Hash
		issuerFingerprint []byte
		issuerKeyID       uint64
		err               error
	)

	packets := packet.NewReader(sig)
	for {
		p, err = packets.Next()
		if err == io.EOF {
			return 0, errors.ErrUnknownIssuer
		}
		if err != nil {
			return 0, err
		}

		switch sig := p.(type) {
		case *packet.Signature:
			if sig.IssuerKeyId == nil {
				return 0, errors.StructuralError("signature doesn't have an issuer")
			}
			issuerKeyID = *sig.IssuerKeyId
			hashFunc = sig.Hash
			issuerFingerprint = sig.IssuerFingerprint
		case *packet.SignatureV3:
			issuerKeyID = sig.IssuerKeyId
			hashFunc = sig.Hash
		default:
			return 0, errors.StructuralError("non signature packet found")
		}

		keys := keyring.KeysByIdUsage(issuerKeyID, issuerFingerprint, packet.KeyFlagSign)
		if len(keys) > 0 {
			return hashFunc, nil
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
