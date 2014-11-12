package libkb

import (
	"crypto"
	"golang.org/x/crypto/openpgp"
	"golang.org/x/crypto/openpgp/armor"
	"golang.org/x/crypto/openpgp/errors"
	"golang.org/x/crypto/openpgp/packet"
	"hash"
	"io"
	"time"
)

//
// Portions of this file are copied from here:
//
//   https://code.google.com/p/go/source/browse/openpgp/keys.go
//
//  Included under the Go software License, URI is here:
//     https://code.google.com/p/go/source/browse/LICENSE?repo=crypto
//
//  And exact text is here:
//
//--------------------------------------------------------------------
//  Copyright (c) 2009 The Go Authors. All rights reserved.
//
//  Redistribution and use in source and binary forms, with or without
//  modification, are permitted provided that the following conditions are
//  met:
//
//     * Redistributions of source code must retain the above copyright
//  notice, this list of conditions and the following disclaimer.
//     * Redistributions in binary form must reproduce the above
//  copyright notice, this list of conditions and the following disclaimer
//  in the documentation and/or other materials provided with the
//  distribution.
//     * Neither the name of Google Inc. nor the names of its
//  contributors may be used to endorse or promote products derived from
//  this software without specific prior written permission.
//
//  THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
//  "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
//  LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
//  A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
//  OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
//  SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
//  LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
//  DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
//  THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
//  (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
//  OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
//
//--------------------------------------------------------------------
//
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

	// We don't want the literal serializer to closer the output stream
	// since we're going to need to write to it when we finish up the
	// signature stuff.
	in, err = packet.SerializeLiteral(noOpCloser{out}, hints.IsBinary, hints.FileName, epochSeconds)

	if err != nil {
		return
	}

	// If we need to write a signature packet after the literal
	// data then we need to stop literalData from closing
	// encryptedData.
	in = signatureWriter{out, in, hasher, hasher.New(), signer, config}

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
//
// From here:
//     https://code.google.com/p/go/source/browse/openpgp/write.go?repo=crypto&r=1e7a3e301825bf9cb32e0535f3761d62d2d369d1#364
//
type noOpCloser struct {
	w io.Writer
}

func (c noOpCloser) Write(data []byte) (n int, err error) {
	return c.w.Write(data)
}

func (c noOpCloser) Close() error {
	return nil
}
