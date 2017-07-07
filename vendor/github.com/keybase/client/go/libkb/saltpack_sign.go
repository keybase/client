// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"fmt"
	"io"

	"github.com/keybase/go-crypto/ed25519"

	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/saltpack"
)

type streamfn func(io.Writer, saltpack.SigningSecretKey, string) (io.WriteCloser, error)

func SaltpackSign(g *GlobalContext, source io.ReadCloser, sink io.WriteCloser, key NaclSigningKeyPair, binary bool, saltpackVersion saltpack.Version) error {
	var s streamfn
	if binary {
		s = func(w io.Writer, k saltpack.SigningSecretKey, _ string) (io.WriteCloser, error) {
			return saltpack.NewSignStream(saltpackVersion, w, k)
		}
	} else {
		s = func(w io.Writer, k saltpack.SigningSecretKey, brand string) (io.WriteCloser, error) {
			return saltpack.NewSignArmor62Stream(saltpackVersion, w, k, brand)
		}
	}
	return saltpackSign(g, source, sink, key, s)
}

func SaltpackSignDetached(g *GlobalContext, source io.ReadCloser, sink io.WriteCloser, key NaclSigningKeyPair, binary bool, saltpackVersion saltpack.Version) error {
	var s streamfn
	if binary {
		s = func(w io.Writer, k saltpack.SigningSecretKey, _ string) (io.WriteCloser, error) {
			return saltpack.NewSignDetachedStream(saltpackVersion, w, k)
		}
	} else {
		s = func(w io.Writer, k saltpack.SigningSecretKey, brand string) (io.WriteCloser, error) {
			return saltpack.NewSignDetachedArmor62Stream(saltpackVersion, w, k, brand)
		}
	}
	return saltpackSign(g, source, sink, key, s)
}

func saltpackSign(g *GlobalContext, source io.ReadCloser, sink io.WriteCloser, key NaclSigningKeyPair, streamer streamfn) error {
	defer func() {
		if err := source.Close(); err != nil {
			g.Log.Warning("error closing source: %s", err)
		}
		if err := sink.Close(); err != nil {
			g.Log.Warning("error closing sink: %s", err)
		}
	}()

	stream, err := streamer(sink, saltSigner{key}, KeybaseSaltpackBrand)
	if err != nil {
		return err
	}

	if _, err := io.Copy(stream, source); err != nil {
		return err
	}

	if err = stream.Close(); err != nil {
		return err
	}

	return nil
}

type saltSigner struct {
	NaclSigningKeyPair
}

func (s saltSigner) GetPublicKey() saltpack.SigningPublicKey {
	return saltSignerPublic{key: s.Public}
}

func (s saltSigner) Sign(msg []byte) ([]byte, error) {
	sig := s.Private.Sign(msg)
	return sig[:], nil
}

type saltSignerPublic struct {
	key NaclSigningKeyPublic
}

func (s saltSignerPublic) ToKID() []byte {
	return s.key[:]
}

func (s saltSignerPublic) Verify(msg, sig []byte) error {
	if len(sig) != ed25519.SignatureSize {
		return fmt.Errorf("signature size: %d, expected %d", len(sig), ed25519.SignatureSize)
	}

	var fixed NaclSignature
	copy(fixed[:], sig)
	if !s.key.Verify(msg, &fixed) {
		return BadSigError{E: "bad signature"}
	}

	return nil
}

func SigningPublicKeyToKeybaseKID(k saltpack.SigningPublicKey) (ret keybase1.KID) {
	if k == nil {
		return ret
	}
	p := k.ToKID()
	return keybase1.KIDFromRawKey(p, KIDNaclEddsa)
}
