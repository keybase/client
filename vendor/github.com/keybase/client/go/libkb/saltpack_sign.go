// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"fmt"
	"io"

	"github.com/agl/ed25519"

	keybase1 "github.com/keybase/client/go/protocol"
	"github.com/keybase/client/go/saltpack"
)

func SaltpackSign(g *GlobalContext, source io.ReadCloser, sink io.WriteCloser, key NaclSigningKeyPair) error {
	return saltpackSign(g, source, sink, key, saltpack.NewSignArmor62Stream)
}

func SaltpackSignDetached(g *GlobalContext, source io.ReadCloser, sink io.WriteCloser, key NaclSigningKeyPair) error {
	return saltpackSign(g, source, sink, key, saltpack.NewSignDetachedArmor62Stream)
}

func saltpackSign(g *GlobalContext, source io.ReadCloser, sink io.WriteCloser, key NaclSigningKeyPair, streamer func(io.Writer, saltpack.SigningSecretKey) (io.WriteCloser, error)) error {
	defer func() {
		if err := source.Close(); err != nil {
			g.Log.Warning("error closing source: %s", err)
		}
		if err := sink.Close(); err != nil {
			g.Log.Warning("error closing sink: %s", err)
		}
	}()

	stream, err := streamer(sink, saltSigner{key})
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

func (s saltSigner) PublicKey() saltpack.SigningPublicKey {
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
