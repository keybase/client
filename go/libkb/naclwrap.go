package libkb

import (
	"crypto/rand"
	"encoding/base64"
	"fmt"

	"github.com/agl/ed25519"
	triplesec "github.com/keybase/go-triplesec"
	"golang.org/x/crypto/nacl/box"
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
	Contextified
}

type NaclDHKeyPublic [NACL_DH_KEYSIZE]byte
type NaclDHKeyPrivate [NACL_DH_KEYSIZE]byte

type NaclDHKeyPair struct {
	Public  NaclDHKeyPublic
	Private *NaclDHKeyPrivate
	Contextified
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
		err = BadKeyError{fmt.Sprintf("Wrong length; wanted %d, got %d", bodyLen+3, l)}
		return
	}

	if kid[0] != byte(KEYBASE_KID_V1) || kid[l-1] != byte(ID_SUFFIX_KID) || kid[1] != typ {
		err = BadKeyError{"bad header or trailer bytes"}
		return
	}
	ret = kid[2:(l - 1)]
	return
}

func ImportNaclSigningKeyPairFromBytes(pub []byte, priv []byte, gc *GlobalContext) (ret NaclSigningKeyPair, err error) {
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
	ret.SetGlobalContext(gc)
	return
}

func ImportKeypairFromKID(kid KID, gc *GlobalContext) (key GenericKey, err error) {
	l := len(kid)
	if l < 3 {
		err = BadKeyError{"KID was way too short"}
		return
	}
	if kid[0] != byte(KEYBASE_KID_V1) || kid[l-1] != byte(ID_SUFFIX_KID) {
		err = BadKeyError{"bad header or trailer found"}
		return
	}
	raw := kid[2:(l - 1)]
	switch kid[1] {
	case byte(KID_NACL_EDDSA):
		if len(raw) != ed25519.PublicKeySize {
			err = BadKeyError{"Bad EdDSA key size"}
		} else {
			tmp := NaclSigningKeyPair{Contextified: NewContextified(gc)}
			copy(tmp.Public[:], raw)
			key = tmp
		}
	case byte(KID_NACL_DH):
		if len(raw) != NACL_DH_KEYSIZE {
			err = BadKeyError{"Bad DH key size"}
		} else {
			tmp := NaclDHKeyPair{Contextified: NewContextified(gc)}
			copy(tmp.Public[:], raw)
			key = tmp
		}
	default:
		err = BadKeyError{fmt.Sprintf("Bad key prefix: %d", kid[1])}
	}
	return
}

func ImportNaclSigningKeyPairFromHex(s string, gc *GlobalContext) (ret NaclSigningKeyPair, err error) {
	var body []byte
	if body, err = importNaclHex(s, byte(KID_NACL_EDDSA), ed25519.PublicKeySize); err != nil {
		return
	}
	copy(ret.Public[:], body)
	ret.SetGlobalContext(gc)
	return
}

func ImportNaclSigningKeyPairFromKid(k KID, gc *GlobalContext) (ret NaclSigningKeyPair, err error) {
	return ImportNaclSigningKeyPairFromBytes([]byte(k), nil, gc)
}

func ImportNaclDHKeyPairFromBytes(pub []byte, priv []byte, gc *GlobalContext) (ret NaclDHKeyPair, err error) {
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
	ret.SetGlobalContext(gc)
	return
}

func ImportNaclDHKeyPairFromHex(s string, gc *GlobalContext) (ret NaclDHKeyPair, err error) {
	var body []byte
	if body, err = importNaclHex(s, byte(KID_NACL_DH), NACL_DH_KEYSIZE); err != nil {
		return
	}
	copy(ret.Public[:], body)
	ret.SetGlobalContext(gc)
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

func (k NaclDHKeyPair) GetAlgoType() AlgoType {
	return KID_NACL_DH
}

func (k NaclSigningKeyPair) GetAlgoType() AlgoType {
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
		err = NoSecretKeyError{}
	}
	return
}

func (k NaclSigningKeyPair) HasSecretKey() bool {
	return k.Private != nil
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
		err = NoSecretKeyError{}
	}
	return
}

func (k NaclDHKeyPair) HasSecretKey() bool {
	return k.Private != nil
}

func (k NaclSigningKeyPair) CanSign() bool { return k.Private != nil }
func (k NaclDHKeyPair) CanSign() bool      { return false }

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
	sigBytes, idp, err := k.SignToBytes(msg)
	if err != nil {
		return
	}
	sig = base64.StdEncoding.EncodeToString(sigBytes)
	return
}

func (k NaclSigningKeyPair) SignToBytes(msg []byte) (sig []byte, idp *SigId, err error) {
	if tmp, e2 := k.Sign(msg); e2 != nil {
		err = e2
	} else if packet, e2 := tmp.ToPacket(); e2 != nil {
		err = e2
	} else if body, e2 := packet.Encode(); e2 != nil {
		err = e2
	} else {
		id := ComputeSigIdFromSigBody(body)
		idp = &id
		sig = body
	}
	return
}

func (k NaclDHKeyPair) SignToString(msg []byte) (sig string, idp *SigId, err error) {
	err = KeyCannotSignError{}
	return
}

func (k NaclDHKeyPair) SignToBytes(msg []byte) (sig []byte, idp *SigId, err error) {
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
	}
	return ret, nil
}

func (s NaclSig) Verify() (err error) {
	if key := s.Kid.ToNaclSigningKeyPublic(); key == nil {
		err = BadKeyError{}
	} else if !ed25519.Verify(key.ToNaclLibrary(), s.Payload, &s.Sig) {
		err = VerificationError{}
	}
	return
}

func (k NaclDHKeyPair) VerifyString(armored string, expected []byte) (sigId *SigId, err error) {
	err = KeyCannotVerifyError{}
	return
}

func (k NaclDHKeyPair) VerifyStringAndExtract(armored string) (payload []byte, sigId *SigId, err error) {
	err = KeyCannotVerifyError{}
	return
}

func (k NaclDHKeyPair) VerifyBytes(sig, expected []byte) (sigId *SigId, err error) {
	err = KeyCannotVerifyError{}
	return
}

func (k NaclDHKeyPair) VerifyBytesAndExtract(sig []byte) (payload []byte, sigId *SigId, err error) {
	err = KeyCannotVerifyError{}
	return
}

func (k NaclSigningKeyPair) VerifyStringAndExtract(armored string) (payload []byte, sigId *SigId, err error) {
	sig, err := base64.StdEncoding.DecodeString(armored)
	if err != nil {
		return
	}
	return k.VerifyBytesAndExtract(sig)
}

func (k NaclSigningKeyPair) VerifyString(armored string, expected []byte) (sigId *SigId, err error) {
	var received []byte
	received, sigId, err = k.VerifyStringAndExtract(armored)
	if !FastByteArrayEq(received, expected) {
		err = BadSigError{"wrong payload"}
		return
	}
	return
}

func (k NaclSigningKeyPair) VerifyBytesAndExtract(sigBytes []byte) (payload []byte, sigId *SigId, err error) {
	var packet *KeybasePacket
	var sig *NaclSig
	var ok bool

	if packet, err = DecodePacket(sigBytes); err != nil {
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
	payload = sig.Payload

	id := ComputeSigIdFromSigBody(sigBytes)
	sigId = &id
	return
}

func (k NaclSigningKeyPair) VerifyBytes(sig, expected []byte) (sigId *SigId, err error) {
	var received []byte
	received, sigId, err = k.VerifyBytesAndExtract(sig)
	if !FastByteArrayEq(received, expected) {
		err = BadSigError{"wrong payload"}
		return
	}
	return
}

func (s *NaclSig) ArmoredEncode() (ret string, err error) {
	return PacketArmoredEncode(s)
}

type NaclKeyPair interface {
	GenericKey
}

func (k NaclSigningKeyPair) ToSKB(t *triplesec.Cipher) (*SKB, error) {
	ret := &SKB{Contextified: k.Contextified}
	ret.Pub = k.GetKid()
	ret.Type = KID_NACL_EDDSA
	ret.Priv.Encryption = 0
	ret.Priv.Data = (*k.Private)[:]
	return ret, nil
}

func (k NaclDHKeyPair) ToSKB(t *triplesec.Cipher) (*SKB, error) {
	ret := &SKB{Contextified: k.Contextified}
	ret.Pub = k.GetKid()
	ret.Type = KID_NACL_DH
	ret.Priv.Encryption = 0
	ret.Priv.Data = (*k.Private)[:]
	return ret, nil
}

func (k NaclSigningKeyPair) ToLksSKB(lks *LKSec) (*SKB, error) {
	data, err := lks.Encrypt(k.Private[:])
	if err != nil {
		return nil, err
	}
	ret := &SKB{}
	ret.Pub = k.GetKid()
	ret.Type = KID_NACL_EDDSA
	ret.Priv.Encryption = LKSecVersion
	ret.Priv.Data = data
	return ret, nil
}

func (k NaclDHKeyPair) ToLksSKB(lks *LKSec) (*SKB, error) {
	data, err := lks.Encrypt(k.Private[:])
	if err != nil {
		return nil, err
	}
	ret := &SKB{}
	ret.Pub = k.GetKid()
	ret.Type = KID_NACL_DH
	ret.Priv.Encryption = LKSecVersion
	ret.Priv.Data = data
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

func KbOpenSig(armored string) ([]byte, error) {
	return base64.StdEncoding.DecodeString(armored)
}

func SigAssertKbPayload(armored string, expected []byte) (sigId *SigId, err error) {
	var byt []byte
	var packet *KeybasePacket
	var sig *NaclSig
	var ok bool

	if byt, err = KbOpenSig(armored); err != nil {
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
