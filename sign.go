package libkb

import (
	"code.google.com/p/go.crypto/openpgp"
	"code.google.com/p/go.crypto/openpgp/armor"
	"code.google.com/p/go.crypto/openpgp/errors"
	"code.google.com/p/go.crypto/openpgp/packet"
	"code.google.com/p/go.crypto/openpgp/s2k"
	"crypto"
	"hash"
	"io"
	"strconv"
	"time"
)

//
// primaryIdentity returns the Identity marked as primary or the first identity
// if none are so marked.
//
// Copy-paste imported from:
//   https://code.google.com/p/go/source/browse/openpgp/keys.go?repo=crypto&r=1e7a3e301825bf9cb32e0535f3761d62d2d369d1#75
//   func (e *Entity) primaryIdentity() *Identity
//
func getPrimaryIdentity(e *openpgp.Entity) *openpgp.Identity {
	var firstIdentity *openpgp.Identity
	for _, ident := range e.Identities {
		if firstIdentity == nil {
			firstIdentity = ident
		}
		if ident.SelfSignature.IsPrimaryId != nil && *ident.SelfSignature.IsPrimaryId {
			return ident
		}
	}
	return firstIdentity
}

//
// signingKey return the best candidate Key for signing a message with this Entity.
//
// Copy-paste imported from:
//   https://code.google.com/p/go/source/browse/openpgp/keys.go?repo=crypto&r=1e7a3e301825bf9cb32e0535f3761d62d2d369d1#125
//   func (e *Entity) signingKey(now time.Time) (Key, bool)
//
func getSigningKey(e *openpgp.Entity, now time.Time) (openpgp.Key, bool) {
	candidateSubkey := -1

	for i, subkey := range e.Subkeys {
		if subkey.Sig.FlagsValid &&
			subkey.Sig.FlagSign &&
			subkey.PublicKey.PubKeyAlgo.CanSign() &&
			!subkey.Sig.KeyExpired(now) {
			candidateSubkey = i
			break
		}
	}

	if candidateSubkey != -1 {
		subkey := e.Subkeys[candidateSubkey]
		return openpgp.Key{e, subkey.PublicKey, subkey.PrivateKey, subkey.Sig}, true
	}

	// If we have no candidate subkey then we assume that it's ok to sign
	// with the primary key.
	i := getPrimaryIdentity(e)
	if !i.SelfSignature.FlagsValid || i.SelfSignature.FlagSign &&
		!i.SelfSignature.KeyExpired(now) {
		return openpgp.Key{e, e.PrimaryKey, e.PrivateKey, i.SelfSignature}, true
	}

	return openpgp.Key{}, false
}

// Copy-paste imported from here:
//
//  https://code.google.com/p/go/source/browse/openpgp/write.go?repo=crypto&r=1e7a3e301825bf9cb32e0535f3761d62d2d369d1
//
func hashToHashId(h crypto.Hash) uint8 {
	v, ok := s2k.HashToHashId(h)
	if !ok {
		panic("tried to convert unknown hash")
	}
	return v
}

// Like openpgp.Encrypt (as in p.crypto/openpgp/write.go), but
// don't encrypt at all, just sign the literal unencrypted data.
// Unfortunately we need to duplicate some code here that's already
// in write.go
func Encrypt(signedtext io.Writer, signed openpgp.Entity, hints *openpgp.FileHints,
	config *packet.Config) (plaintext io.WriteCloser, err error) {

	var signer *packet.PrivateKey

	if signKey, ok := getSigningKey(&signed, config.Now()); !ok {
		err = errors.InvalidArgumentError("no valid signing keys")
		return
	} else if signer = signKey.PrivateKey; signer.Encrypted {
		err = errors.InvalidArgumentError("signing key must be decrypted")
		return
	}

	return
}
