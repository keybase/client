package libkb

import (
	"crypto/rand"
	"encoding/base64"
	"fmt"

	"github.com/agl/ed25519"
	keybase1 "github.com/keybase/client/protocol/go"
	triplesec "github.com/keybase/go-triplesec"
	"golang.org/x/crypto/nacl/box"
)

type NaclSignature [ed25519.SignatureSize]byte

type NaclSigInfo struct {
	Kid      KID           `codec:"key"`
	Payload  []byte        `codec:"payload,omitempty"`
	Sig      NaclSignature `codec:"sig"`
	SigType  int           `codec:"sig_type"`
	HashType int           `codec:"hash_type"`
	Detached bool          `codec:"detached"`
}

const NACL_DH_KEYSIZE = 32

type NaclSigningKeyPublic [ed25519.PublicKeySize]byte
type NaclSigningKeyPrivate [ed25519.PrivateKeySize]byte

func (k NaclSigningKeyPrivate) Sign(msg []byte) *NaclSignature {
	return (*NaclSignature)(ed25519.Sign((*[ed25519.PrivateKeySize]byte)(&k), msg))
}

func (k NaclSigningKeyPublic) Verify(msg []byte, sig *NaclSignature) bool {
	return ed25519.Verify((*[ed25519.PublicKeySize]byte)(&k), msg, (*[ed25519.SignatureSize]byte)(sig))
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

func ImportKeypairFromKID(kid KID) (key GenericKey, err error) {
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
			tmp := NaclSigningKeyPair{}
			copy(tmp.Public[:], raw)
			key = tmp
		}
	case byte(KID_NACL_DH):
		if len(raw) != NACL_DH_KEYSIZE {
			err = BadKeyError{"Bad DH key size"}
		} else {
			tmp := NaclDHKeyPair{}
			copy(tmp.Public[:], raw)
			key = tmp
		}
	default:
		err = BadKeyError{fmt.Sprintf("Bad key prefix: %d", kid[1])}
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

func (k NaclSigningKeyPair) GetKid() (ret KID) {
	return k.Public.GetKid()
}

func (k NaclSigningKeyPair) ToShortIdString() string {
	return k.Public.GetKid().ToShortIdString()
}

func (k NaclDHKeyPair) ToShortIdString() string {
	return k.Public.GetKid().ToShortIdString()
}

func (k NaclSigningKeyPair) VerboseDescription() string {
	return fmt.Sprintf("255-bit EdDSA signing key (%s)", k.ToShortIdString())
}
func (k NaclDHKeyPair) VerboseDescription() string {
	return fmt.Sprintf("255-bit Curve25519 DH key (%s)", k.ToShortIdString())
}

func (k NaclSigningKeyPair) GetFingerprintP() *PgpFingerprint {
	return nil
}

func (k NaclDHKeyPair) GetKid() KID {
	return k.Public.GetKid()
}

func (k NaclSigningKeyPair) CheckSecretKey() error {
	if k.Private == nil {
		return NoSecretKeyError{}
	}
	return nil
}

func (k NaclSigningKeyPair) HasSecretKey() bool {
	return k.Private != nil
}

func (k NaclSigningKeyPair) Encode() (string, error) {
	return k.GetKid().String(), nil
}

func (k NaclDHKeyPair) Encode() (string, error) {
	return k.GetKid().String(), nil
}

func (k NaclDHKeyPair) CheckSecretKey() error {
	if k.Private == nil {
		return NoSecretKeyError{}
	}
	return nil
}

func (k NaclDHKeyPair) HasSecretKey() bool {
	return k.Private != nil
}

func (k NaclSigningKeyPair) CanSign() bool { return k.Private != nil }
func (k NaclDHKeyPair) CanSign() bool      { return false }

func (k NaclSigningKeyPair) Sign(msg []byte) (ret *NaclSigInfo, err error) {
	if k.Private == nil {
		err = NoSecretKeyError{}
		return
	}
	ret = &NaclSigInfo{
		Kid:      k.GetKid(),
		Payload:  msg,
		Sig:      *k.Private.Sign(msg),
		SigType:  SIG_KB_EDDSA,
		HashType: HASH_PGP_SHA512,
		Detached: true,
	}
	return
}

func (k NaclSigningKeyPair) SignToString(msg []byte) (sig string, id keybase1.SigID, err error) {
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
	id = ComputeSigIDFromSigBody(body)
	return
}

func (k NaclSigningKeyPair) VerifyStringAndExtract(sig string) (msg []byte, id keybase1.SigID, err error) {
	body, err := base64.StdEncoding.DecodeString(sig)
	if err != nil {
		return
	}

	packet, err := DecodePacket(body)
	if err != nil {
		return
	}

	naclSig, ok := packet.Body.(*NaclSigInfo)
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
	id = ComputeSigIDFromSigBody(body)
	return
}

func (k NaclSigningKeyPair) VerifyString(sig string, msg []byte) (id keybase1.SigID, err error) {
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

func (k NaclSigningKeyPair) GetVerifyingKid() KID {
	return k.GetKid()
}

func (k NaclDHKeyPair) SignToString(msg []byte) (sig string, id keybase1.SigID, err error) {
	err = KeyCannotSignError{}
	return
}

func (k NaclDHKeyPair) VerifyStringAndExtract(sig string) (msg []byte, id keybase1.SigID, err error) {
	err = KeyCannotVerifyError{}
	return
}

func (k NaclDHKeyPair) VerifyString(sig string, msg []byte) (id keybase1.SigID, err error) {
	err = KeyCannotVerifyError{}
	return
}

func (s *NaclSigInfo) ToPacket() (ret *KeybasePacket, err error) {
	ret = &KeybasePacket{
		Version: KEYBASE_PACKET_V1,
		Tag:     TAG_SIGNATURE,
	}
	ret.Body = s
	return
}

func (p KeybasePacket) ToNaclSigInfo() (*NaclSigInfo, error) {
	ret, ok := p.Body.(*NaclSigInfo)
	if !ok {
		return nil, UnmarshalError{"Signature"}
	}
	return ret, nil
}

func (s NaclSigInfo) Verify() error {
	key := s.Kid.ToNaclSigningKeyPublic()
	if key == nil {
		return BadKeyError{}
	}
	if !key.Verify(s.Payload, &s.Sig) {
		return VerificationError{}
	}
	return nil
}

func (s *NaclSigInfo) ArmoredEncode() (ret string, err error) {
	return PacketArmoredEncode(s)
}

func (k NaclSigningKeyPair) ToSKB(gc *GlobalContext, t *triplesec.Cipher) (*SKB, error) {
	ret := &SKB{}
	ret.SetGlobalContext(gc)
	ret.Pub = k.GetKid()
	ret.Type = KID_NACL_EDDSA
	ret.Priv.Encryption = 0
	ret.Priv.Data = (*k.Private)[:]
	return ret, nil
}

func (k NaclDHKeyPair) ToSKB(gc *GlobalContext, t *triplesec.Cipher) (*SKB, error) {
	ret := &SKB{}
	ret.SetGlobalContext(gc)
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
	ret := &SKB{Contextified: lks.Contextified}
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
	ret := &SKB{Contextified: lks.Contextified}
	ret.Pub = k.GetKid()
	ret.Type = KID_NACL_DH
	ret.Priv.Encryption = LKSecVersion
	ret.Priv.Data = data
	return ret, nil
}

func GenerateNaclSigningKeyPair() (NaclSigningKeyPair, error) {
	pub, priv, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		return NaclSigningKeyPair{}, err
	}
	var ret NaclSigningKeyPair
	var npriv NaclSigningKeyPrivate
	copy(ret.Public[:], pub[:])
	copy(npriv[:], priv[:])
	ret.Private = &npriv

	return ret, nil
}

func GenerateNaclDHKeyPair() (NaclDHKeyPair, error) {
	pub, priv, err := box.GenerateKey(rand.Reader)
	if err != nil {
		return NaclDHKeyPair{}, err
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

func SigAssertKbPayload(armored string, expected []byte) (sigID keybase1.SigID, err error) {
	var byt []byte
	var packet *KeybasePacket
	var sig *NaclSigInfo
	var ok bool

	if byt, err = KbOpenSig(armored); err != nil {
		return
	}

	if packet, err = DecodePacket(byt); err != nil {
		return
	}
	if sig, ok = packet.Body.(*NaclSigInfo); !ok {
		err = UnmarshalError{"NaCl Signature"}
		return
	}
	if !FastByteArrayEq(expected, sig.Payload) {
		err = BadSigError{"wrong payload"}
	}
	sigID = ComputeSigIDFromSigBody(byt)
	return
}
