package libkb

import (
	"bytes"
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"io"

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

type NaclEncryptionInfo struct {
	Ciphertext     []byte `codec:"ciphertext"`
	EncryptionType int    `codec:"enc_type"`
	Nonce          []byte `codec:"nonce"`
	Receiver       KID    `codec:"receiver_key"`
	Sender         KID    `codec:"sender_key"`
}

const NaclDHKeysize = 32

// TODO: Ideally, ed25519 would expose how many random bytes it needs.
const NaclSigningKeySecretSize = 32

// TODO: Ideally, box would expose how many random bytes it needs.
const NaclDHKeySecretSize = 32

// Todo: Ideally, box would specify nonce size
const NaclDHNonceSize = 24

type NaclSigningKeyPublic [ed25519.PublicKeySize]byte
type NaclSigningKeyPrivate [ed25519.PrivateKeySize]byte

func (k NaclSigningKeyPrivate) Sign(msg []byte) *NaclSignature {
	return (*NaclSignature)(ed25519.Sign((*[ed25519.PrivateKeySize]byte)(&k), msg))
}

func (k NaclSigningKeyPublic) Verify(msg []byte, sig *NaclSignature) bool {
	return ed25519.Verify((*[ed25519.PublicKeySize]byte)(&k), msg, (*[ed25519.SignatureSize]byte)(sig))
}

type NaclSigningKeyPair struct {
	Public  NaclSigningKeyPublic
	Private *NaclSigningKeyPrivate
}

type NaclDHKeyPublic [NaclDHKeysize]byte
type NaclDHKeyPrivate [NaclDHKeysize]byte

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

	if kid[0] != byte(KeybaseKIDV1) || kid[l-1] != byte(IDSuffixKID) || kid[1] != typ {
		err = BadKeyError{"bad header or trailer bytes"}
		return
	}
	ret = kid[2:(l - 1)]
	return
}

func ImportNaclSigningKeyPairFromBytes(pub []byte, priv []byte) (ret NaclSigningKeyPair, err error) {
	var body []byte
	if body, err = importNaclKid(KID(pub), byte(KIDNaclEddsa), ed25519.PublicKeySize); err != nil {
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
	if kid[0] != byte(KeybaseKIDV1) || kid[l-1] != byte(IDSuffixKID) {
		err = BadKeyError{"bad header or trailer found"}
		return
	}
	raw := kid[2:(l - 1)]
	switch kid[1] {
	case byte(KIDNaclEddsa):
		if len(raw) != ed25519.PublicKeySize {
			err = BadKeyError{"Bad EdDSA key size"}
		} else {
			tmp := NaclSigningKeyPair{}
			copy(tmp.Public[:], raw)
			key = tmp
		}
	case byte(KIDNaclDH):
		if len(raw) != NaclDHKeysize {
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
	if body, err = importNaclHex(s, byte(KIDNaclEddsa), ed25519.PublicKeySize); err != nil {
		return
	}
	copy(ret.Public[:], body)
	return
}

func ImportNaclDHKeyPairFromBytes(pub []byte, priv []byte) (ret NaclDHKeyPair, err error) {
	var body []byte
	if body, err = importNaclKid(KID(pub), byte(KIDNaclDH), NaclDHKeysize); err != nil {
		return
	}
	copy(ret.Public[:], body)
	if priv == nil {
	} else if len(priv) != NaclDHKeysize {
		err = BadKeyError{"Secret key was wrong size"}
	} else {
		ret.Private = &NaclDHKeyPrivate{}
		copy(ret.Private[:], priv)
	}
	return
}

func ImportNaclDHKeyPairFromHex(s string) (ret NaclDHKeyPair, err error) {
	var body []byte
	if body, err = importNaclHex(s, byte(KIDNaclDH), NaclDHKeysize); err != nil {
		return
	}
	copy(ret.Public[:], body)
	return
}

func (k NaclDHKeyPublic) GetKid() KID {
	prefix := []byte{
		byte(KeybaseKIDV1),
		byte(KIDNaclDH),
	}
	suffix := byte(IDSuffixKID)
	out := append(prefix, k[:]...)
	out = append(out, suffix)
	return KID(out)
}

func (k NaclDHKeyPair) GetFingerprintP() *PGPFingerprint {
	return nil
}

func (k NaclDHKeyPair) GetAlgoType() AlgoType {
	return KIDNaclDH
}

func (k NaclSigningKeyPair) GetAlgoType() AlgoType {
	return KIDNaclEddsa
}

func (k NaclSigningKeyPublic) GetKid() KID {
	prefix := []byte{
		byte(KeybaseKIDV1),
		byte(KIDNaclEddsa),
	}
	suffix := byte(IDSuffixKID)
	out := append(prefix, k[:]...)
	out = append(out, suffix)
	return KID(out)
}

func (k NaclSigningKeyPair) GetKid() (ret KID) {
	return k.Public.GetKid()
}

func (k NaclSigningKeyPair) ToShortIDString() string {
	return k.Public.GetKid().ToShortIDString()
}

func (k NaclDHKeyPair) ToShortIDString() string {
	return k.Public.GetKid().ToShortIDString()
}

func (k NaclSigningKeyPair) VerboseDescription() string {
	return fmt.Sprintf("255-bit EdDSA signing key (%s)", k.ToShortIDString())
}
func (k NaclDHKeyPair) VerboseDescription() string {
	return fmt.Sprintf("255-bit Curve25519 DH key (%s)", k.ToShortIDString())
}

func (k NaclSigningKeyPair) GetFingerprintP() *PGPFingerprint {
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
		SigType:  SigKbEddsa,
		HashType: HashPGPSha512,
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
	extractedMsg, resID, err := k.VerifyStringAndExtract(sig)
	if err != nil {
		return
	}
	if !FastByteArrayEq(extractedMsg, msg) {
		err = BadSigError{"wrong payload"}
		return
	}
	id = resID
	return
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
		Version: KeybasePacketV1,
		Tag:     TagSignature,
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
	ret.Type = KIDNaclEddsa
	ret.Priv.Encryption = 0
	ret.Priv.Data = (*k.Private)[:]
	return ret, nil
}

func (k NaclDHKeyPair) ToSKB(gc *GlobalContext, t *triplesec.Cipher) (*SKB, error) {
	ret := &SKB{}
	ret.SetGlobalContext(gc)
	ret.Pub = k.GetKid()
	ret.Type = KIDNaclDH
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
	ret.Type = KIDNaclEddsa
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
	ret.Type = KIDNaclDH
	ret.Priv.Encryption = LKSecVersion
	ret.Priv.Data = data
	return ret, nil
}

func makeNaclSigningKeyPair(reader io.Reader) (NaclSigningKeyPair, error) {
	pub, priv, err := ed25519.GenerateKey(reader)
	if err != nil {
		return NaclSigningKeyPair{}, err
	}
	return NaclSigningKeyPair{
		Public:  *pub,
		Private: (*NaclSigningKeyPrivate)(priv),
	}, nil
}

// MakeNaclSigningKeyPairFromSecret makes a signing key pair given a
// secret. Of course, the security of depends entirely on the
// randomness of the bytes in the secret.
func MakeNaclSigningKeyPairFromSecret(secret [NaclSigningKeySecretSize]byte) (NaclSigningKeyPair, error) {
	r := bytes.NewReader(secret[:])

	kp, err := makeNaclSigningKeyPair(r)
	if err != nil {
		return NaclSigningKeyPair{}, err
	}

	if r.Len() > 0 {
		return NaclSigningKeyPair{}, fmt.Errorf("Did not use %d secret byte(s)", r.Len())
	}

	return kp, err
}

func GenerateNaclSigningKeyPair() (NaclSigningKeyPair, error) {
	return makeNaclSigningKeyPair(rand.Reader)
}

func makeNaclDHKeyPair(reader io.Reader) (NaclDHKeyPair, error) {
	pub, priv, err := box.GenerateKey(reader)
	if err != nil {
		return NaclDHKeyPair{}, err
	}
	return NaclDHKeyPair{
		Public:  *pub,
		Private: (*NaclDHKeyPrivate)(priv),
	}, nil
}

// MakeNaclDHKeyPairFromSecret makes a DH key pair given a secret. Of
// course, the security of depends entirely on the randomness of the
// bytes in the secret.
func MakeNaclDHKeyPairFromSecret(secret [NaclDHKeySecretSize]byte) (NaclDHKeyPair, error) {
	r := bytes.NewReader(secret[:])

	kp, err := makeNaclDHKeyPair(r)
	if err != nil {
		return NaclDHKeyPair{}, err
	}

	if r.Len() > 0 {
		return NaclDHKeyPair{}, fmt.Errorf("Did not use %d secret byte(s)", r.Len())
	}

	return kp, err
}

func GenerateNaclDHKeyPair() (NaclDHKeyPair, error) {
	return makeNaclDHKeyPair(rand.Reader)
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

// CanEncrypt always returns false for a signing key pair.
func (n NaclSigningKeyPair) CanEncrypt() bool { return false }

// CanDecrypt always returns false for a signing key pair.
func (n NaclSigningKeyPair) CanDecrypt() bool { return false }

// CanEncrypt always returns true for an encryption key pair.
func (n NaclDHKeyPair) CanEncrypt() bool { return true }

// CanDecrypt returns true if there's a private key available
func (n NaclDHKeyPair) CanDecrypt() bool { return n.Private != nil }

// Encrypt a message for the given sender.  If sender is nil, an ephemeral
// keypair will be invented
func (n NaclDHKeyPair) Encrypt(msg []byte, sender *NaclDHKeyPair) (*NaclEncryptionInfo, error) {
	if sender == nil {
		if tmp, err := GenerateNaclDHKeyPair(); err != nil {
			return nil, err
		} else {
			sender = &tmp
		}
	} else if sender.Private == nil {
		return nil, NoSecretKeyError{}
	}

	var nonce [NaclDHNonceSize]byte
	if nRead, err := rand.Read(nonce[:]); err != nil {
		return nil, err
	} else if nRead != NaclDHNonceSize {
		return nil, fmt.Errorf("Short random read: %d", nRead)
	}

	var ctext []byte
	ctext = box.Seal(ctext, msg, &nonce, ((*[32]byte)(&n.Public)), ((*[32]byte)(sender.Private)))
	ret := &NaclEncryptionInfo{
		Ciphertext:     ctext,
		EncryptionType: KIDNaclDH,
		Nonce:          nonce[:],
		Receiver:       n.GetKid(),
		Sender:         sender.GetKid(),
	}

	return ret, nil
}

// EncryptToString encrypts the plaintext using DiffieHelman; the this object is
// the receiver, and the passed sender is optional.  If not provided, we'll make
// up an ephemeral key.
func (n NaclDHKeyPair) EncryptToString(plaintext []byte, sender GenericKey) (string, error) {
	var senderDh *NaclDHKeyPair
	if sender != nil {
		var ok bool
		if senderDh, ok = sender.(*NaclDHKeyPair); !ok {
			return "", NoSecretKeyError{}
		}
	}

	info, err := n.Encrypt(plaintext, senderDh)
	if err != nil {
		return "", nil
	}

	return PacketArmoredEncode(info)
}

// ToPacket implements the Packetable interface.
func (n *NaclEncryptionInfo) ToPacket() (ret *KeybasePacket, err error) {
	ret = &KeybasePacket{
		Version: KeybasePacketV1,
		Tag:     TagEncryption,
	}
	ret.Body = n
	return
}

// DecryptFromString decrypts the output of EncryptToString above,
// and returns the KID of the other end.
func (n NaclDHKeyPair) DecryptFromString(ciphertext string) (msg []byte, sender KID, err error) {
	var kbp *KeybasePacket
	var nei *NaclEncryptionInfo
	var ok bool

	if kbp, err = DecodeArmoredPacket(ciphertext); err != nil {
		return
	}

	if nei, ok = kbp.Body.(*NaclEncryptionInfo); !ok {
		err = UnmarshalError{"NaCl Encryption"}
		return
	}
	return n.Decrypt(nei)
}

func (n NaclDHKeyPair) Decrypt(nei *NaclEncryptionInfo) (plaintext []byte, sender KID, err error) {
	if n.Private == nil {
		err = NoSecretKeyError{}
		return
	}
	if nei.EncryptionType != KIDNaclDH {
		err = DecryptBadPacketTypeError{}
		return
	}
	var nonce [NaclDHNonceSize]byte
	if len(nei.Nonce) != NaclDHNonceSize {
		err = DecryptBadNonceError{}
		return
	}
	copy(nonce[:], nei.Nonce)

	var gk GenericKey
	if gk, err = ImportKeypairFromKID(nei.Sender); err != nil {
		return
	}

	var senderDH NaclDHKeyPair
	var ok bool
	if senderDH, ok = gk.(NaclDHKeyPair); !ok {
		err = DecryptBadSenderError{}
		return
	}

	if !n.GetKid().Eq(nei.Receiver) {
		err = DecryptWrongReceiverError{}
		return
	}

	if plaintext, ok = box.Open(plaintext, nei.Ciphertext, &nonce,
		((*[32]byte)(&senderDH.Public)), ((*[32]byte)(n.Private))); !ok {
		err = DecryptOpenError{}
		return
	}
	sender = senderDH.GetKid()
	return
}
