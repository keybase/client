package libkb

import (
	"github.com/agl/ed25519"
	"golang.org/x/crypto/nacl/box"
	// "golang.org/x/crypto/nacl/secretbox"
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"github.com/keybase/go-triplesec"
)

type NaclSig struct {
	Kid      KID                         `codec:"key"`
	Payload  []byte                      `codec:"payload,omitempty"`
	Sig      [ed25519.SignatureSize]byte `codec:"sig"`
	SigType  int                         `codec:"sig_type"`
	HashType int                         `codec:"hash_type"`
	Detached bool                        `codec:"detached"`
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
	Public  NaclDHKeyPublic
	Private *NaclDHKeyPrivate
}

func importNaclHex(s string, typ byte, bodyLen int) (ret []byte, err error) {
	var kid KID
	if kid, err = ImportKID(s); err != nil {
		return
	}
	return importNaclKid(kid, typ, bodyLen)
}

func importNaclKid(kid KID, typ byte, bodyLen int) (ret []byte, err error) {
	l := len(kid)
	if l != bodyLen+3 {
		err = BadKeyError{fmt.Sprintf("Wrong length; wanted %d, got %d", l, bodyLen+3)}
		return
	}

	if kid[0] != byte(KEYBASE_KID_V1) || kid[l-1] != byte(ID_SUFFIX_KID) || kid[1] != typ {
		err = BadKeyError{"bad header or trailer bytes"}
		return
	}
	ret = kid[2:(l - 1)]
	return
}

func ImportNaclSigningKeyPairFromBytes(pub []byte, priv []byte) (ret NaclSigningKeyPair, err error) {
	var body []byte
	if body, err = importNaclKid(KID(pub), byte(KID_NACL_EDDSA), ed25519.PublicKeySize); err != nil {
		return
	}
	copy(ret.Public[:], body)
	if priv == nil {
	} else if len(priv) != ed25519.PrivateKeySize {
		err = BadKeyError{"Secret key was wrong size"}
	} else {
		ret.Private = &NaclSigningKeyPrivate{}
		copy(ret.Private[:], priv)
	}
	return
}

func ImportNaclSigningKeyPairFromHex(s string) (ret NaclSigningKeyPair, err error) {
	var body []byte
	if body, err = importNaclHex(s, byte(KID_NACL_EDDSA), ed25519.PublicKeySize); err != nil {
		return
	}
	copy(ret.Public[:], body)
	return
}

func ImportNaclDHKeyPairFromBytes(pub []byte, priv []byte) (ret NaclDHKeyPair, err error) {
	var body []byte
	if body, err = importNaclKid(KID(pub), byte(KID_NACL_DH), NACL_DH_KEYSIZE); err != nil {
		return
	}
	copy(ret.Public[:], body)
	if priv == nil {
	} else if len(priv) != NACL_DH_KEYSIZE {
		err = BadKeyError{"Secret key was wrong size"}
	} else {
		ret.Private = &NaclDHKeyPrivate{}
		copy(ret.Private[:], priv)
	}
	return
}

func ImportNaclDHKeyPairFromHex(s string) (ret NaclDHKeyPair, err error) {
	var body []byte
	if body, err = importNaclHex(s, byte(KID_NACL_DH), NACL_DH_KEYSIZE); err != nil {
		return
	}
	copy(ret.Public[:], body)
	return
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

func (k NaclDHKeyPair) GetFingerprintP() *PgpFingerprint {
	return nil
}

func (k NaclDHKeyPair) GetAlgoType() int {
	return KID_NACL_DH
}

func (k NaclSigningKeyPair) GetAlgoType() int {
	return KID_NACL_EDDSA
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

func (p NaclSigningKeyPair) ToShortIdString() string {
	return p.Public.GetKid().ToShortIdString()
}

func (p NaclDHKeyPair) ToShortIdString() string {
	return p.Public.GetKid().ToShortIdString()
}

func (p NaclSigningKeyPair) VerboseDescription() string {
	return fmt.Sprintf("255-bit EdDSA signing key (%s)", p.ToShortIdString())
}
func (p NaclDHKeyPair) VerboseDescription() string {
	return fmt.Sprintf("255-bit Curve25519 DH key (%s)", p.ToShortIdString())
}

func (p NaclSigningKeyPair) GetFingerprintP() *PgpFingerprint {
	return nil
}

func (p NaclDHKeyPair) GetKid() (ret KID) {
	ret = p.Public.GetKid()
	return
}

func (k NaclSigningKeyPair) CheckSecretKey() (err error) {
	if k.Private == nil {
		err = NoKeyError{"no private key found"}
	}
	return
}

func (k NaclSigningKeyPair) Encode() (s string, err error) {
	s = k.GetKid().String()
	return
}

func (k NaclDHKeyPair) Encode() (s string, err error) {
	s = k.GetKid().String()
	return
}

func (k NaclDHKeyPair) CheckSecretKey() (err error) {
	if k.Private == nil {
		err = NoKeyError{"no private key found"}
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
		SigType:  SIG_KB_EDDSA,
		HashType: HASH_PGP_SHA512,
		Payload:  msg,
		Kid:      k.GetKid(),
		Detached: true,
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

func (k NaclDHKeyPair) SignToString(msg []byte) (sig string, idp *SigId, err error) {
	err = KeyCannotSignError{}
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

func (k NaclDHKeyPair) Verify(armored string, expected []byte) (sigId *SigId, err error) {
	err = KeyCannotSignError{}
	return
}

func (k NaclSigningKeyPair) Verify(armored string, expected []byte) (sigId *SigId, err error) {
	var packet *KeybasePacket
	var sig *NaclSig
	var ok bool
	var byt []byte

	if byt, err = base64.StdEncoding.DecodeString(armored); err != nil {
		return
	}
	if packet, err = DecodePacket(byt); err != nil {
		return
	}
	if sig, ok = packet.Body.(*NaclSig); !ok {
		err = UnmarshalError{"NACL signature"}
		return
	}
	if err = sig.Verify(); err != nil {
		return
	}
	if !sig.Kid.Eq(k.GetKid()) {
		err = WrongKidError{sig.Kid, k.GetKid()}
		return
	}
	if !FastByteArrayEq(sig.Payload, expected) {
		err = BadSigError{"wrong payload"}
		return
	}
	id := ComputeSigIdFromSigBody(byt)
	sigId = &id
	return
}

func (s *NaclSig) ArmoredEncode() (ret string, err error) {
	return PacketArmoredEncode(s)
}

type NaclKeyPair interface {
	GenericKey
}

func (k NaclSigningKeyPair) ToP3SKB(t *triplesec.Cipher) (*P3SKB, error) {
	ret := &P3SKB{}
	ret.Pub = k.GetKid()
	ret.Type = KID_NACL_EDDSA
	ret.Priv.Encryption = 0
	ret.Priv.Data = (*k.Private)[:]
	return ret, nil
}

func (k NaclDHKeyPair) ToP3SKB(t *triplesec.Cipher) (*P3SKB, error) {
	ret := &P3SKB{}
	ret.Pub = k.GetKid()
	ret.Type = KID_NACL_DH
	ret.Priv.Encryption = 0
	ret.Priv.Data = (*k.Private)[:]
	return ret, nil
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
	pub, priv, err := box.GenerateKey(rand.Reader)
	if err != nil {
		return nil, err
	}
	var ret NaclDHKeyPair
	var npriv NaclDHKeyPrivate
	copy(ret.Public[:], pub[:])
	copy(npriv[:], priv[:])
	ret.Private = &npriv
	return ret, nil
}

func SigAssertKbPayload(armored string, expected []byte) (sigId *SigId, err error) {
	var byt []byte
	var packet *KeybasePacket
	var sig *NaclSig
	var ok bool

	if byt, err = base64.StdEncoding.DecodeString(armored); err != nil {
		return
	}
	if packet, err = DecodePacket(byt); err != nil {
		return
	}
	if sig, ok = packet.Body.(*NaclSig); !ok {
		err = UnmarshalError{"NaCl Signature"}
		return
	}
	if !FastByteArrayEq(expected, sig.Payload) {
		err = BadSigError{"wrong payload"}
	}
	id := ComputeSigIdFromSigBody(byt)
	sigId = &id
	return
}
