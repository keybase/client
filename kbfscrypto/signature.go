// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package kbfscrypto

import (
	"encoding"
	"encoding/hex"
	"encoding/json"
	"fmt"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"

	"golang.org/x/net/context"
)

// SigVer denotes a signature version.
type SigVer int

const (
	// SigED25519 is the signature type for ED25519
	SigED25519 SigVer = 1
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

// DeepCopy makes a complete copy of this SignatureInfo.
func (s SignatureInfo) DeepCopy() SignatureInfo {
	signature := make([]byte, len(s.Signature))
	copy(signature[:], s.Signature[:])
	return SignatureInfo{s.Version, signature, s.VerifyingKey}
}

// String implements the fmt.Stringer interface for SignatureInfo.
func (s SignatureInfo) String() string {
	return fmt.Sprintf("SignatureInfo{Version: %d, Signature: %s, "+
		"VerifyingKey: %s}", s.Version, hex.EncodeToString(s.Signature[:]),
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
	return SignatureInfo{
		Version:      SigED25519,
		Signature:    k.kp.Private.Sign(data)[:],
		VerifyingKey: k.GetVerifyingKey(),
	}
}

// SignToString signs the given data and returns a string.
func (k SigningKey) SignToString(data []byte) (sig string, err error) {
	sig, _, err = k.kp.SignToString(data)
	return sig, err
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
	if sigInfo.Version != SigED25519 {
		return UnknownSigVer{sigInfo.Version}
	}

	publicKey := libkb.KIDToNaclSigningKeyPublic(
		sigInfo.VerifyingKey.KID().ToBytes())
	if publicKey == nil {
		return libkb.KeyCannotVerifyError{}
	}

	var naclSignature libkb.NaclSignature
	if len(sigInfo.Signature) != len(naclSignature) {
		return libkb.VerificationError{}
	}
	copy(naclSignature[:], sigInfo.Signature)

	if !publicKey.Verify(msg, &naclSignature) {
		return libkb.VerificationError{}
	}

	return nil
}

// A Signer is something that can sign using an internal private key.
type Signer interface {
	// Sign signs msg with some internal private key.
	Sign(ctx context.Context, msg []byte) (sigInfo SignatureInfo, err error)
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

// SignToString implements Signer for SigningKeySigner.
func (s SigningKeySigner) SignToString(
	ctx context.Context, data []byte) (sig string, err error) {
	return s.Key.SignToString(data)
}
