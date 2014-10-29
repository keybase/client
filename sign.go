package libkb

import (
	"code.google.com/p/go.crypto/openpgp"
	"code.google.com/p/go.crypto/openpgp/armor"
	"code.google.com/p/go.crypto/openpgp/errors"
	"code.google.com/p/go.crypto/openpgp/packet"
	"crypto"
	"hash"
	"io"
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

// Like openpgp.Encrypt (as in p.crypto/openpgp/write.go), but
// don't encrypt at all, just sign the literal unencrypted data.
// Unfortunately we need to duplicate some code here that's already
// in write.go
func AttachedSign(out io.WriteCloser, signed openpgp.Entity, hints *openpgp.FileHints,
	config *packet.Config) (in io.WriteCloser, err error) {

	if hints == nil {
		hints = &openpgp.FileHints{}
	}

	if config == nil {
		config = &packet.Config{}
	}

	var signer *packet.PrivateKey

	if signKey, ok := getSigningKey(&signed, config.Now()); !ok {
		err = errors.InvalidArgumentError("no valid signing keys")
		return
	} else if signer = signKey.PrivateKey; signer.Encrypted {
		err = errors.InvalidArgumentError("signing key must be decrypted")
		return
	}

	hasher := crypto.SHA512

	ops := &packet.OnePassSignature{
		SigType:    packet.SigTypeBinary,
		Hash:       hasher,
		PubKeyAlgo: signer.PubKeyAlgo,
		KeyId:      signer.KeyId,
		IsLast:     true,
	}

	if err = ops.Serialize(out); err != nil {
		return
	}

	var epochSeconds uint32
	if !hints.ModTime.IsZero() {
		epochSeconds = uint32(hints.ModTime.Unix())
	}

	in, err = packet.SerializeLiteral(out, hints.IsBinary, hints.FileName, epochSeconds)

	if err != nil {
		return
	}

	in = signatureWriter{out, noOpCloser{in}, hasher, hasher.New(), signer, config}

	return
}

type DebugWriteCloser struct {
	targ io.WriteCloser
}

func (dbc DebugWriteCloser) Write(buf []byte) (int, error) {
	G.Log.Debug("dbc write: %v", buf)
	return dbc.targ.Write(buf)
}

func (dbc DebugWriteCloser) Close() error {
	G.Log.Debug("dbc Close!")
	return dbc.targ.Close()
}

func ArmoredAttachedSign(out io.WriteCloser, signed openpgp.Entity, hints *openpgp.FileHints,
	config *packet.Config) (in io.WriteCloser, err error) {

	var aout io.WriteCloser
	aout, err = armor.Encode(out, "PGP MESSAGE", PgpArmorHeaders())
	if err != nil {
		return
	}
	return AttachedSign(DebugWriteCloser{aout}, signed, hints, config)
}

func AttachedSignWrapper(out io.WriteCloser, key PgpKeyBundle, armored bool) (
	in io.WriteCloser, err error) {

	if armored {
		return ArmoredAttachedSign(out, openpgp.Entity(key), nil, nil)
	} else {
		return AttachedSign(out, openpgp.Entity(key), nil, nil)
	}
}

// From here:
//   https://code.google.com/p/go/source/browse/openpgp/write.go?repo=crypto&r=1e7a3e301825bf9cb32e0535f3761d62d2d369d1#326
//
// signatureWriter hashes the contents of a message while passing it along to
// literalData. When closed, it closes literalData, writes a signature packet
// to encryptedData and then also closes encryptedData.
type signatureWriter struct {
	signedData  io.WriteCloser
	literalData io.WriteCloser
	hashType    crypto.Hash
	h           hash.Hash
	signer      *packet.PrivateKey
	config      *packet.Config
}

func (s signatureWriter) Write(data []byte) (int, error) {
	s.h.Write(data)
	return s.literalData.Write(data)
}

func (s signatureWriter) Close() error {
	sig := &packet.Signature{
		SigType:      packet.SigTypeBinary,
		PubKeyAlgo:   s.signer.PubKeyAlgo,
		Hash:         s.hashType,
		CreationTime: s.config.Now(),
		IssuerKeyId:  &s.signer.KeyId,
	}

	if err := sig.Sign(s.h, s.signer, s.config); err != nil {
		return err
	}
	if err := s.literalData.Close(); err != nil {
		return err
	}
	if err := sig.Serialize(s.signedData); err != nil {
		return err
	}
	return s.signedData.Close()
}

// noOpCloser is like an ioutil.NopCloser, but for an io.Writer.
// TODO: we have two of these in OpenPGP packages alone. This probably needs
// to be promoted somewhere more common.
type noOpCloser struct {
	w io.Writer
}

func (c noOpCloser) Write(data []byte) (n int, err error) {
	return c.w.Write(data)
}

func (c noOpCloser) Close() error {
	return nil
}
