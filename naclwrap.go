package libkb

import (
	"github.com/agl/ed25519"
	// "golang.org/x/crypto/nacl/box"
	// "golang.org/x/crypto/nacl/secretbox"
	"crypto/rand"
	"encoding/base64"
)

type NaclSig struct {
	Kid     KID                         `codec:"key"`
	Payload []byte                      `codec:"payload"`
	Sig     [ed25519.SignatureSize]byte `codec:"sig"`
	Type    int                         `codec:"type"`
}

const NACL_DH_KEYSIZE = 32

type NaclSigningKeyPublic [ed25519.PublicKeySize]byte
type NaclSigningKeyPrivate [ed25519.PrivateKeySize]byte

func (k NaclSigningKeyPrivate) ToNaclLibrary() *[ed25519.PrivateKeySize]byte {
	b := [ed25519.PrivateKeySize]byte(k)
	return &b
}
func (k NaclSigningKeyPublic) ToNaclLibrary() *[ed25519.PublicKeySize]byte {
	b := [ed25519.PublicKeySize]byte(k)
	return &b
}

func (k KID) ToNaclSigningKeyPublic() *NaclSigningKeyPublic {
	if len(k) != 3+ed25519.PublicKeySize {
		return nil
	}
	if k[0] != byte(KEYBASE_KID_V1) || k[1] != byte(KID_NACL_EDDSA) ||
		k[len(k)-1] != byte(ID_SUFFIX_KID) {
		return nil
	}
	var ret NaclSigningKeyPublic
	copy(ret[:], k[2:len(k)-1])
	return &ret
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
		byte(KID_NACL_DH),
	}
	suffix := byte(ID_SUFFIX_KID)
	out := append(prefix, k[:]...)
	out = append(out, suffix)
	return KID(out)
}

func (k NaclSigningKeyPublic) GetKid() KID {
	prefix := []byte{
		byte(KEYBASE_KID_V1),
		byte(KID_NACL_EDDSA),
	}
	suffix := byte(ID_SUFFIX_KID)
	out := append(prefix, k[:]...)
	out = append(out, suffix)
	return KID(out)
}

func (p NaclSigningKeyPair) GetKid() (ret KID) {
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
	sig := ed25519.Sign(k.Private.ToNaclLibrary(), msg)
	ret = &NaclSig{
		Type:    SIG_TYPE_ED25519_SHA512,
		Payload: msg,
		Kid:     k.GetKid(),
	}
	copy(ret.Sig[:], (*sig)[:])
	return
}

func (k NaclSigningKeyPair) SignToString(msg []byte) (sig string, idp *SigId, err error) {
	if tmp, e2 := k.Sign(msg); e2 != nil {
		err = e2
	} else if packet, e2 := tmp.ToPacket(); e2 != nil {
		err = e2
	} else if body, e2 := packet.Encode(); e2 != nil {
		err = e2
	} else {
		id := ComputeSigIdFromSigBody(body)
		idp = &id
		sig = base64.StdEncoding.EncodeToString(body)
	}
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

func (s NaclSig) Verify() (err error) {
	if key := s.Kid.ToNaclSigningKeyPublic(); key == nil {
		err = BadKeyError{}
	} else if !ed25519.Verify(key.ToNaclLibrary(), s.Payload, &s.Sig) {
		err = VerificationError{}
	}
	return
}

func (s *NaclSig) ArmoredEncode() (ret string, err error) {
	return PacketArmoredEncode(s)
}

type NaclKeyPair interface {
	GetKid() KID
}

func GenerateNaclSigningKeyPair() (NaclKeyPair, error) {
	pub, priv, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		return nil, err
	}
	var ret NaclSigningKeyPair
	var npriv NaclSigningKeyPrivate
	copy(ret.Public[:], pub[:])
	copy(npriv[:], priv[:])
	ret.Private = &npriv

	return ret, nil
}

func GenerateNaclDHKeyPair() (NaclKeyPair, error) {
	return nil, nil
}
