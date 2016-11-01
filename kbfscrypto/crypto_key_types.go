// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package kbfscrypto

import (
	"encoding"
	"encoding/hex"
	"encoding/json"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

// All section references below are to https://keybase.io/blog/kbfs-crypto
// (version 1.3).

type kidContainer struct {
	kid keybase1.KID
}

var _ encoding.BinaryMarshaler = kidContainer{}
var _ encoding.BinaryUnmarshaler = (*kidContainer)(nil)

var _ json.Marshaler = kidContainer{}
var _ json.Unmarshaler = (*kidContainer)(nil)

func (k kidContainer) MarshalBinary() (data []byte, err error) {
	if k.kid.IsNil() {
		return nil, nil
	}

	// TODO: Use the more stringent checks from
	// KIDFromStringChecked instead.
	if !k.kid.IsValid() {
		return nil, InvalidKIDError{k.kid}
	}

	return k.kid.ToBytes(), nil
}

func (k *kidContainer) UnmarshalBinary(data []byte) error {
	if len(data) == 0 {
		*k = kidContainer{}
		return nil
	}

	k.kid = keybase1.KIDFromSlice(data)
	// TODO: Use the more stringent checks from
	// KIDFromStringChecked instead.
	if !k.kid.IsValid() {
		err := InvalidKIDError{k.kid}
		*k = kidContainer{}
		return err
	}

	return nil
}

func (k kidContainer) MarshalJSON() ([]byte, error) {
	return k.kid.MarshalJSON()
}

func (k *kidContainer) UnmarshalJSON(s []byte) error {
	return k.kid.UnmarshalJSON(s)
}

func (k kidContainer) KID() keybase1.KID {
	return k.kid
}

func (k kidContainer) String() string {
	return k.kid.String()
}

type byte32Container struct {
	data [32]byte
}

var _ encoding.BinaryMarshaler = byte32Container{}
var _ encoding.BinaryUnmarshaler = (*byte32Container)(nil)

func (c byte32Container) Data() [32]byte {
	return c.data
}

func (c byte32Container) MarshalBinary() (data []byte, err error) {
	return c.data[:], nil
}

func (c *byte32Container) UnmarshalBinary(data []byte) error {
	if len(data) != len(c.data) {
		err := InvalidByte32DataError{data}
		*c = byte32Container{}
		return err
	}

	copy(c.data[:], data)
	return nil
}

func (c byte32Container) String() string {
	return hex.EncodeToString(c.data[:])
}

// A TLFPrivateKey (m_f) is the private half of the permanent
// keypair associated with a TLF. (See 4.1.1, 5.3.)
//
// Copies of TLFPrivateKey objects are deep copies.
type TLFPrivateKey struct {
	// Should only be used by implementations of Crypto.
	byte32Container
}

var _ encoding.BinaryMarshaler = TLFPrivateKey{}
var _ encoding.BinaryUnmarshaler = (*TLFPrivateKey)(nil)

// MakeTLFPrivateKey returns a TLFPrivateKey containing the given
// data.
func MakeTLFPrivateKey(data [32]byte) TLFPrivateKey {
	return TLFPrivateKey{byte32Container{data}}
}

// A TLFPublicKey (M_f) is the public half of the permanent keypair
// associated with a TLF. It is included in the site-wide private-data
// Merkle tree. (See 4.1.1, 5.3.)
//
// Copies of TLFPublicKey objects are deep copies.
type TLFPublicKey struct {
	// Should only be used by implementations of Crypto.
	byte32Container
}

var _ encoding.BinaryMarshaler = TLFPublicKey{}
var _ encoding.BinaryUnmarshaler = (*TLFPublicKey)(nil)

// MakeTLFPublicKey returns a TLFPublicKey containing the given
// data.
func MakeTLFPublicKey(data [32]byte) TLFPublicKey {
	return TLFPublicKey{byte32Container{data}}
}

// TLFEphemeralPrivateKey (m_e) is used (with a CryptPublicKey) to
// encrypt TLFCryptKeyClientHalf objects (t_u^{f,0,i}) for non-public
// directories. (See 4.1.1.)
//
// Copies of TLFEphemeralPrivateKey objects are deep copies.
type TLFEphemeralPrivateKey struct {
	// Should only be used by implementations of Crypto. Meant to
	// be converted to libkb.NaclDHKeyPrivate.
	byte32Container
}

var _ encoding.BinaryMarshaler = TLFEphemeralPrivateKey{}
var _ encoding.BinaryUnmarshaler = (*TLFEphemeralPrivateKey)(nil)

// MakeTLFEphemeralPrivateKey returns a TLFEphemeralPrivateKey
// containing the given data.
func MakeTLFEphemeralPrivateKey(data [32]byte) TLFEphemeralPrivateKey {
	return TLFEphemeralPrivateKey{byte32Container{data}}
}

// CryptPrivateKey is a private key for encryption/decryption.
type CryptPrivateKey struct {
	kp libkb.NaclDHKeyPair
}

// NewCryptPrivateKey returns a CryptPrivateKey using the given key
// pair.
func NewCryptPrivateKey(kp libkb.NaclDHKeyPair) CryptPrivateKey {
	return CryptPrivateKey{kp}
}

// Data returns the private key's data, suitable to be used with
// box.Open or box.Seal.
//
// TODO: Make the CryptPrivateKey handle the Open/Seal itself.
func (k CryptPrivateKey) Data() [32]byte {
	return *k.kp.Private
}

// GetPublicKey returns the public key corresponding to this private
// key.
func (k CryptPrivateKey) GetPublicKey() CryptPublicKey {
	return MakeCryptPublicKey(k.kp.Public.GetKID())
}

// CryptPublicKey (M_u^i) is used (with a TLFEphemeralPrivateKey) to
// encrypt TLFCryptKeyClientHalf objects (t_u^{f,0,i}) for non-public
// directories. (See 4.1.1.)  These are also sometimes known as
// subkeys.
//
// Copies of CryptPublicKey objects are deep copies.
type CryptPublicKey struct {
	// Should only be used by implementations of Crypto.
	//
	// Even though we currently use nacl/box, we use a KID here
	// (which encodes the key type) as we may end up storing other
	// kinds of keys.
	kidContainer
}

var _ encoding.BinaryMarshaler = CryptPublicKey{}
var _ encoding.BinaryUnmarshaler = (*CryptPublicKey)(nil)

var _ json.Marshaler = CryptPublicKey{}
var _ json.Unmarshaler = (*CryptPublicKey)(nil)

// MakeCryptPublicKey returns a CryptPublicKey containing the given KID.
func MakeCryptPublicKey(kid keybase1.KID) CryptPublicKey {
	return CryptPublicKey{kidContainer{kid}}
}

// TLFEphemeralPublicKey (M_e) is used along with a crypt private key
// to decrypt TLFCryptKeyClientHalf objects (t_u^{f,0,i}) for
// non-public directories. (See 4.1.1.)
//
// Copies of TLFEphemeralPublicKey objects are deep copies.
type TLFEphemeralPublicKey struct {
	// Should only be used by implementations of Crypto. Meant to
	// be converted to libkb.NaclDHKeyPublic.
	byte32Container
}

var _ encoding.BinaryMarshaler = TLFEphemeralPublicKey{}
var _ encoding.BinaryUnmarshaler = (*TLFEphemeralPublicKey)(nil)

// MakeTLFEphemeralPublicKey returns a TLFEphemeralPublicKey
// containing the given data.
func MakeTLFEphemeralPublicKey(data [32]byte) TLFEphemeralPublicKey {
	return TLFEphemeralPublicKey{byte32Container{data}}
}

// TLFEphemeralPublicKeys stores a list of TLFEphemeralPublicKey
type TLFEphemeralPublicKeys []TLFEphemeralPublicKey

// TLFCryptKeyServerHalf (s_u^{f,0,i}) is the masked, server-side half
// of a TLFCryptKey, which can be recovered only with both
// halves. (See 4.1.1.)
//
// Copies of TLFCryptKeyServerHalf objects are deep copies.
type TLFCryptKeyServerHalf struct {
	// Should only be used by implementations of Crypto.
	byte32Container
}

var _ encoding.BinaryMarshaler = TLFCryptKeyServerHalf{}
var _ encoding.BinaryUnmarshaler = (*TLFCryptKeyServerHalf)(nil)

// MakeTLFCryptKeyServerHalf returns a TLFCryptKeyServerHalf
// containing the given data.
func MakeTLFCryptKeyServerHalf(data [32]byte) TLFCryptKeyServerHalf {
	return TLFCryptKeyServerHalf{byte32Container{data}}
}

// TLFCryptKeyClientHalf (t_u^{f,0,i}) is the masked, client-side half
// of a TLFCryptKey, which can be recovered only with both
// halves. (See 4.1.1.)
//
// Copies of TLFCryptKeyClientHalf objects are deep copies.
type TLFCryptKeyClientHalf struct {
	// Should only be used by implementations of Crypto.
	byte32Container
}

var _ encoding.BinaryMarshaler = TLFCryptKeyClientHalf{}
var _ encoding.BinaryUnmarshaler = (*TLFCryptKeyClientHalf)(nil)

// MakeTLFCryptKeyClientHalf returns a TLFCryptKeyClientHalf
// containing the given data.
func MakeTLFCryptKeyClientHalf(data [32]byte) TLFCryptKeyClientHalf {
	return TLFCryptKeyClientHalf{byte32Container{data}}
}

// TLFCryptKey (s^{f,0}) is used to encrypt/decrypt the private
// portion of TLF metadata. It is also used to mask
// BlockCryptKeys. (See 4.1.1, 4.1.2.)
//
// Copies of TLFCryptKey objects are deep copies.
type TLFCryptKey struct {
	// Should only be used by implementations of Crypto.
	byte32Container
}

var _ encoding.BinaryMarshaler = TLFCryptKey{}
var _ encoding.BinaryUnmarshaler = (*TLFCryptKey)(nil)

// MakeTLFCryptKey returns a TLFCryptKey containing the given data.
func MakeTLFCryptKey(data [32]byte) TLFCryptKey {
	return TLFCryptKey{byte32Container{data}}
}

// PublicTLFCryptKey is the TLFCryptKey used for all public TLFs. That
// means that anyone with just the block key for a public TLF can
// decrypt that block. This is not the zero TLFCryptKey so that we can
// distinguish it from an (erroneously?) unset TLFCryptKey.
var PublicTLFCryptKey = MakeTLFCryptKey([32]byte{
	0x18, 0x18, 0x18, 0x18, 0x18, 0x18, 0x18, 0x18,
	0x18, 0x18, 0x18, 0x18, 0x18, 0x18, 0x18, 0x18,
	0x18, 0x18, 0x18, 0x18, 0x18, 0x18, 0x18, 0x18,
	0x18, 0x18, 0x18, 0x18, 0x18, 0x18, 0x18, 0x18,
})

// BlockCryptKeyServerHalf is a masked version of a BlockCryptKey,
// which can be recovered only with the TLFCryptKey used to mask the
// server half.
//
// Copies of BlockCryptKeyServerHalf objects are deep copies.
type BlockCryptKeyServerHalf struct {
	// Should only be used by implementations of Crypto.
	byte32Container
}

var _ encoding.BinaryMarshaler = BlockCryptKeyServerHalf{}
var _ encoding.BinaryUnmarshaler = (*BlockCryptKeyServerHalf)(nil)

// MakeBlockCryptKeyServerHalf returns a BlockCryptKeyServerHalf
// containing the given data.
func MakeBlockCryptKeyServerHalf(data [32]byte) BlockCryptKeyServerHalf {
	return BlockCryptKeyServerHalf{byte32Container{data}}
}

// ParseBlockCryptKeyServerHalf returns a BlockCryptKeyServerHalf
// containing the given hex-encoded data, or an error.
func ParseBlockCryptKeyServerHalf(s string) (BlockCryptKeyServerHalf, error) {
	buf, err := hex.DecodeString(s)
	if err != nil {
		return BlockCryptKeyServerHalf{}, err
	}
	var serverHalf BlockCryptKeyServerHalf
	err = serverHalf.UnmarshalBinary(buf)
	if err != nil {
		return BlockCryptKeyServerHalf{}, err
	}
	return serverHalf, nil
}

// BlockCryptKey is used to encrypt/decrypt block data. (See 4.1.2.)
type BlockCryptKey struct {
	// Should only be used by implementations of Crypto.
	byte32Container
}

var _ encoding.BinaryMarshaler = BlockCryptKey{}
var _ encoding.BinaryUnmarshaler = (*BlockCryptKey)(nil)

// MakeBlockCryptKey returns a BlockCryptKey containing the given
// data.
//
// Copies of BlockCryptKey objects are deep copies.
func MakeBlockCryptKey(data [32]byte) BlockCryptKey {
	return BlockCryptKey{byte32Container{data}}
}

func xorKeys(x, y [32]byte) [32]byte {
	var res [32]byte
	for i := 0; i < 32; i++ {
		res[i] = x[i] ^ y[i]
	}
	return res
}

// MaskTLFCryptKey returns the client side of a top-level folder crypt
// key.
func MaskTLFCryptKey(serverHalf TLFCryptKeyServerHalf,
	key TLFCryptKey) TLFCryptKeyClientHalf {
	return MakeTLFCryptKeyClientHalf(xorKeys(serverHalf.data, key.data))
}

// UnmaskTLFCryptKey returns the top-level folder crypt key.
func UnmaskTLFCryptKey(serverHalf TLFCryptKeyServerHalf,
	clientHalf TLFCryptKeyClientHalf) TLFCryptKey {
	return MakeTLFCryptKey(xorKeys(serverHalf.data, clientHalf.data))
}

// UnmaskBlockCryptKey returns the block crypt key.
func UnmaskBlockCryptKey(serverHalf BlockCryptKeyServerHalf,
	tlfCryptKey TLFCryptKey) BlockCryptKey {
	return MakeBlockCryptKey(xorKeys(serverHalf.data, tlfCryptKey.data))
}
