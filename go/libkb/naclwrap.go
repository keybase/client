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

func (k NaclSigningKeyPrivate) Sign(msg []byte) *[ed25519.SignatureSize]byte {
	privateKey := [ed25519.PrivateKeySize]byte(k)
	return ed25519.Sign(&privateKey, msg)
}

func (k NaclSigningKeyPublic) Verify(msg []byte, sig *[ed25519.SignatureSize]byte) error {
	publicKey := [ed25519.PublicKeySize]byte(k)
	if !ed25519.Verify(&publicKey, msg, sig) {
		return VerificationError{}
	}
	return nil
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
	ret = &NaclSig{
		Kid:      k.GetKid(),
		Payload:  msg,
		Sig:      *k.Private.Sign(msg),
		SigType:  SIG_KB_EDDSA,
		HashType: HASH_PGP_SHA512,
		Detached: true,
	}
	return
}

func (k NaclSigningKeyPair) SignToString(msg []byte) (sig string, id *SigId, err error) {
	naclSig, err := k.Sign(msg)
	if err != nil {
		return
	}

	packet, err := naclSig.ToPacket()
	if err != nil {
		return
	}

	body, err := packet.Encode()
	if err != nil {
		return
	}

	sig = base64.StdEncoding.EncodeToString(body)
	sigId := ComputeSigIdFromSigBody(body)
	id = &sigId
	return
}

func (k NaclSigningKeyPair) VerifyStringAndExtract(sig string) (msg []byte, id *SigId, err error) {
	body, err := base64.StdEncoding.DecodeString(sig)
	if err != nil {
		return
	}

	packet, err := DecodePacket(body)
	if err != nil {
		return
	}

	naclSig, ok := packet.Body.(*NaclSig)
	if !ok {
		err = UnmarshalError{"NACL signature"}
		return
	}

	err = naclSig.Verify()
	if err != nil {
		return
	}

	if !naclSig.Kid.Eq(k.GetKid()) {
		err = WrongKidError{naclSig.Kid, k.GetKid()}
		return
	}

	msg = naclSig.Payload
	sigId := ComputeSigIdFromSigBody(body)
	id = &sigId
	return
}

func (k NaclSigningKeyPair) VerifyString(sig string, msg []byte) (id *SigId, err error) {
	extractedMsg, resId, err := k.VerifyStringAndExtract(sig)
	if err != nil {
		return
	}
	if !FastByteArrayEq(extractedMsg, msg) {
		err = BadSigError{"wrong payload"}
		return
	}
	id = resId
	return
}

func (k NaclSigningKeyPair) SignToBytes(msg []byte) (sig []byte, err error) {
	if k.Private == nil {
		err = NoSecretKeyError{}
		return
	}
	sig = k.Private.Sign(msg)[:]
	return
}

func (k NaclSigningKeyPair) VerifyBytes(sig, msg []byte) (err error) {
	var sigArr [ed25519.SignatureSize]byte
	if len(sig) != len(sigArr) {
		return VerificationError{}
	}
	copy(sigArr[:], sig)
	return k.Public.Verify(msg, &sigArr)
}

func (k NaclDHKeyPair) SignToString(msg []byte) (sig string, id *SigId, err error) {
	err = KeyCannotSignError{}
	return
}

func (k NaclDHKeyPair) VerifyStringAndExtract(sig string) (msg []byte, id *SigId, err error) {
	err = KeyCannotVerifyError{}
	return
}

func (k NaclDHKeyPair) VerifyString(sig string, msg []byte) (id *SigId, err error) {
	err = KeyCannotVerifyError{}
	return
}

func (k NaclDHKeyPair) SignToBytes(msg []byte) (sig []byte, err error) {
	err = KeyCannotSignError{}
	return
}

func (k NaclDHKeyPair) VerifyBytes(sig, msg []byte) (err error) {
	return KeyCannotVerifyError{}
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

func (s NaclSig) Verify() error {
	key := s.Kid.ToNaclSigningKeyPublic()
	if key == nil {
		return BadKeyError{}
	}
	return key.Verify(s.Payload, &s.Sig)
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
