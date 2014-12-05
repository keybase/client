package libkb

import (
	"github.com/agl/ed25519"
	// "golang.org/x/crypto/nacl/box"
	// "golang.org/x/crypto/nacl/secretbox"
)

type NaclSig struct {
	Key     NaclSigningKeyPublic        `codec:"key"`
	Payload []byte                      `codec:"payload"`
	Sig     [ed25519.SignatureSize]byte `codec:"sig"`
	Type    int                         `codec:"type"`
}

const NACL_DH_KEYSIZE = 32

type NaclSigningKeyPublic [ed25519.PublicKeySize]byte
type NaclSigningKeyPrivate [ed25519.PrivateKeySize]byte

func (k NaclSigningKeyPrivate) ToNacl() *[ed25519.PrivateKeySize]byte {
	b := [ed25519.PrivateKeySize]byte(k)
	return &b
}
func (k NaclSigningKeyPublic) ToNacl() *[ed25519.PublicKeySize]byte {
	b := [ed25519.PublicKeySize]byte(k)
	return &b
}

type NaclSigningKeyPair struct {
	Public  NaclSigningKeyPublic
	Private *NaclSigningKeyPrivate
}

type NaclDHKeyPublic [NACL_DH_KEYSIZE]byte
type NaclDHKeyPrivate [NACL_DH_KEYSIZE]byte

type NaclDHKeyPair struct {
	Public  *NaclDHKeyPublic
	Private *NaclDHKeyPrivate
}

func (k NaclDHKeyPublic) GetKid() KID {
	prefix := []byte{
		byte(KEYBASE_KID_V1),
		byte(KID_DH_CURVE25519),
	}
	suffix := byte(ID_SUFFIX_KID)
	out := append(prefix, k[:]...)
	out = append(out, suffix)
	return KID(out)
}

func (k NaclSigningKeyPublic) GetKid() KID {
	prefix := []byte{
		byte(KEYBASE_KID_V1),
		byte(KID_ED25519),
	}
	suffix := byte(ID_SUFFIX_KID)
	out := append(prefix, k[:]...)
	out = append(out, suffix)
	return KID(out)
}

func (p NaclSigningKeyPair) GetId() (ret KID) {
	return p.Public.GetKid()
}

func (p NaclDHKeyPair) GetId() (ret KID) {
	if p.Public != nil {
		ret = p.Public.GetKid()
	}
	return
}

func (k NaclSigningKeyPair) Sign(msg []byte) (ret *NaclSig, err error) {
	if k.Private == nil {
		err = NoSecretKeyError{}
		return
	}
	sig := ed25519.Sign(k.Private.ToNacl(), msg)
	ret = &NaclSig{
		Type:    SIG_TYPE_ED25519_SHA512,
		Payload: msg,
		Key:     k.Public,
	}
	copy(ret.Sig[:], (*sig)[:])
	return
}

func (s *NaclSig) ToPacket() (ret *KeybasePacket, err error) {
	ret = &KeybasePacket{
		Version: KEYBASE_PACKET_V1,
		Tag:     TAG_SIGNATURE,
	}
	ret.Body = s
	return
}

func (p KeybasePacket) ToNaclSig() (*NaclSig, error) {
	ret, ok := p.Body.(*NaclSig)
	if !ok {
		return nil, UnmarshalError{"Signature"}
	} else {
		return ret, nil
	}
}

func (s NaclSig) Verify() bool {
	return ed25519.Verify(s.Key.ToNacl(), s.Payload, &s.Sig)
}

func (s *NaclSig) ArmoredEncode() (ret string, err error) {
	return PacketArmoredEncode(s)
}
