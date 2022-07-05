// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package kbfscrypto

import (
	"bytes"
	"encoding"
	"encoding/hex"
	"encoding/json"
	"fmt"

	"github.com/keybase/client/go/kbcrypto"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/pkg/errors"

	"golang.org/x/net/context"
)

// SigVer denotes a signature version.
type SigVer int

const (
	// SigED25519 is the signature type for ED25519
	SigED25519 = SigVer(iota + 1)
	// SigED25519ForKBFS is the signature type for ED25519 with a KBFS prefix.
	SigED25519ForKBFS
)

// IsNil returns true if this SigVer is nil.
func (v SigVer) IsNil() bool {
	return int(v) == 0
}

// SignatureInfo contains all the info needed to verify a signature
// for a message.
type SignatureInfo struct {
	// Exported only for serialization purposes.
	Version      SigVer       `codec:"v"`
	Signature    []byte       `codec:"s"`
	VerifyingKey VerifyingKey `codec:"k"`
}

// IsNil returns true if this SignatureInfo is nil.
func (s SignatureInfo) IsNil() bool {
	return s.Version.IsNil() && len(s.Signature) == 0 && s.VerifyingKey.IsNil()
}

// Equals returns true if this SignatureInfo matches the given one.
func (s SignatureInfo) Equals(other SignatureInfo) bool {
	if s.Version != other.Version {
		return false
	}
	if !bytes.Equal(s.Signature, other.Signature) {
		return false
	}
	if s.VerifyingKey != other.VerifyingKey {
		return false
	}

	return true
}

// DeepCopy makes a complete copy of this SignatureInfo.
func (s SignatureInfo) DeepCopy() SignatureInfo {
	signature := make([]byte, len(s.Signature))
	copy(signature, s.Signature)
	return SignatureInfo{s.Version, signature, s.VerifyingKey}
}

// String implements the fmt.Stringer interface for SignatureInfo.
func (s SignatureInfo) String() string {
	return fmt.Sprintf("SignatureInfo{Version: %d, Signature: %s, "+
		"VerifyingKey: %s}", s.Version, hex.EncodeToString(s.Signature),
		&s.VerifyingKey)
}

// SigningKey is a key pair for signing.
type SigningKey struct {
	kp libkb.NaclSigningKeyPair
}

// NewSigningKey returns a SigningKey using the given key pair.
func NewSigningKey(kp libkb.NaclSigningKeyPair) SigningKey {
	return SigningKey{kp}
}

// Sign signs the given data and returns a SignatureInfo.
func (k SigningKey) Sign(data []byte) SignatureInfo {
	sig := k.kp.Private.Sign(data)
	return SignatureInfo{
		Version:      SigED25519,
		Signature:    sig[:],
		VerifyingKey: k.GetVerifyingKey(),
	}
}

// SignForKBFS signs the given data with the KBFS prefix and returns a SignatureInfo.
func (k SigningKey) SignForKBFS(data []byte) (SignatureInfo, error) {
	sigInfo, err := k.kp.SignV2(data, kbcrypto.SignaturePrefixKBFS)
	if err != nil {
		return SignatureInfo{}, errors.WithStack(err)
	}
	return SignatureInfo{
		Version:      SigVer(sigInfo.Version),
		Signature:    sigInfo.Sig[:],
		VerifyingKey: k.GetVerifyingKey(),
	}, nil
}

// SignToString signs the given data and returns a string.
func (k SigningKey) SignToString(data []byte) (sig string, err error) {
	sig, _, err = k.kp.SignToString(data)
	if err != nil {
		return "", errors.WithStack(err)
	}
	return sig, nil
}

// GetVerifyingKey returns the public key half of this signing key.
func (k SigningKey) GetVerifyingKey() VerifyingKey {
	return MakeVerifyingKey(k.kp.Public.GetKID())
}

// A VerifyingKey is a public key that can be used to verify a
// signature created by the corresponding private signing key. In
// particular, VerifyingKeys are used to authenticate home and public
// TLFs. (See 4.2, 4.3.)
//
// These are also sometimes known as sibkeys.
//
// Copies of VerifyingKey objects are deep copies.
type VerifyingKey struct {
	// Even though we currently use NaclSignatures, we use a KID
	// here (which encodes the key type) as we may end up storing
	// other kinds of signatures.
	kidContainer
}

var _ encoding.BinaryMarshaler = VerifyingKey{}
var _ encoding.BinaryUnmarshaler = (*VerifyingKey)(nil)

var _ json.Marshaler = VerifyingKey{}
var _ json.Unmarshaler = (*VerifyingKey)(nil)

// MakeVerifyingKey returns a VerifyingKey containing the given KID.
func MakeVerifyingKey(kid keybase1.KID) VerifyingKey {
	return VerifyingKey{kidContainer{kid}}
}

// IsNil returns true if the VerifyingKey is nil.
func (k VerifyingKey) IsNil() bool {
	return k.kid.IsNil()
}

// Verify verifies the given message against the given SignatureInfo,
// and returns nil if it verifies successfully, or an error otherwise.
func Verify(msg []byte, sigInfo SignatureInfo) error {
	if sigInfo.Version < SigED25519 || sigInfo.Version > SigED25519ForKBFS {
		return errors.WithStack(UnknownSigVer{sigInfo.Version})
	}

	publicKey := kbcrypto.KIDToNaclSigningKeyPublic(
		sigInfo.VerifyingKey.KID().ToBytes())
	if publicKey == nil {
		return errors.WithStack(libkb.KeyCannotVerifyError{})
	}

	var naclSignature kbcrypto.NaclSignature
	if len(sigInfo.Signature) != len(naclSignature) {
		return errors.WithStack(kbcrypto.VerificationError{})
	}
	copy(naclSignature[:], sigInfo.Signature)

	if sigInfo.Version == SigED25519ForKBFS {
		msg = kbcrypto.SignaturePrefixKBFS.Prefix(msg)
	}

	if !publicKey.Verify(msg, naclSignature) {
		return errors.WithStack(kbcrypto.VerificationError{})
	}

	return nil
}

// A Signer is something that can sign using an internal private key.
type Signer interface {
	// Sign signs msg with some internal private key.
	Sign(ctx context.Context, msg []byte) (sigInfo SignatureInfo, err error)
	// SignForKBFS signs msg with some internal private key on behalf of KBFS.
	SignForKBFS(ctx context.Context, msg []byte) (sigInfo SignatureInfo, err error)
	// SignToString signs msg with some internal private key and
	// outputs the full serialized NaclSigInfo.
	SignToString(ctx context.Context, msg []byte) (signature string, err error)
}

// SigningKeySigner is a Signer wrapper around a SigningKey.
type SigningKeySigner struct {
	Key SigningKey
}

// Sign implements Signer for SigningKeySigner.
func (s SigningKeySigner) Sign(
	ctx context.Context, data []byte) (SignatureInfo, error) {
	return s.Key.Sign(data), nil
}

// SignForKBFS implements Signer for SigningKeySigner.
func (s SigningKeySigner) SignForKBFS(
	ctx context.Context, data []byte) (SignatureInfo, error) {
	return s.Key.SignForKBFS(data)
}

// SignToString implements Signer for SigningKeySigner.
func (s SigningKeySigner) SignToString(
	ctx context.Context, data []byte) (sig string, err error) {
	return s.Key.SignToString(data)
}
