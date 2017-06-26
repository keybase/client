package teams

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha512"
	"encoding/base64"
	"errors"
	"fmt"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/crypto/nacl/box"
	"golang.org/x/crypto/nacl/secretbox"
	"golang.org/x/net/context"
)

type PerTeamSharedSecretBoxes struct {
	Generation    keybase1.PerTeamKeyGeneration `json:"generation"`
	EncryptingKid keybase1.KID                  `json:"encrypting_kid"`
	Nonce         string                        `json:"nonce"`
	PrevKey       *prevKeySealedEncoded         `json:"prev"`
	Boxes         map[keybase1.UID]string       `json:"boxes"`
}

type PerTeamSharedSecretBox struct {
	_struct         bool `codec:",toarray"`
	Version         uint
	PerUserKeySeqno keybase1.Seqno
	NonceCounter    uint32
	Ctext           []byte
}

type TeamKeyManager struct {
	libkb.Contextified

	sharedSecret keybase1.PerTeamKeySeed
	generation   keybase1.PerTeamKeyGeneration

	encryptionKey *libkb.NaclDHKeyPair
	signingKey    *libkb.NaclSigningKeyPair
}

type SharedSecretAllGenerations struct {
	currentGeneration keybase1.PerTeamKeyGeneration
	secrets           map[keybase1.PerTeamKeyGeneration]keybase1.PerTeamKeySeed
}

func NewTeamKeyManager(g *libkb.GlobalContext) (*TeamKeyManager, error) {
	sharedSecret, err := newSharedSecret()
	if err != nil {
		return nil, err
	}
	return NewTeamKeyManagerWithSecret(g, sharedSecret, 1)
}

func NewTeamKeyManagerWithSecret(g *libkb.GlobalContext, secret keybase1.PerTeamKeySeed, generation keybase1.PerTeamKeyGeneration) (*TeamKeyManager, error) {
	return &TeamKeyManager{
		Contextified: libkb.NewContextified(g),
		sharedSecret: secret,
		generation:   generation,
	}, nil
}

// SharedSecret returns the team's shared secret.
func (t *TeamKeyManager) SharedSecret() keybase1.PerTeamKeySeed {
	return t.sharedSecret
}

// EncryptionKey returns the derived NaclSigningKeyPair from the team's shared secret.
func (t *TeamKeyManager) SigningKey() (libkb.NaclSigningKeyPair, error) {
	if t.signingKey == nil {
		key, err := libkb.MakeNaclSigningKeyPairFromSecretBytes(derivedSecret(t.sharedSecret, libkb.TeamEdDSADerivationString))
		if err != nil {
			return libkb.NaclSigningKeyPair{}, err
		}
		t.signingKey = &key
	}
	return *t.signingKey, nil
}

// EncryptionKey returns the derived NaclDHKeyPair from the team's shared secret.
func (t *TeamKeyManager) EncryptionKey() (libkb.NaclDHKeyPair, error) {
	if t.encryptionKey == nil {
		key, err := libkb.MakeNaclDHKeyPairFromSecretBytes(derivedSecret(t.sharedSecret, libkb.TeamDHDerivationString))
		if err != nil {
			return libkb.NaclDHKeyPair{}, err
		}
		t.encryptionKey = &key
	}
	return *t.encryptionKey, nil
}

// SharedSecretBoxes creates the PerTeamSharedSecretBoxes for recipients with the
// existing team shared secret.
func (t *TeamKeyManager) SharedSecretBoxes(ctx context.Context, senderKey libkb.GenericKey, recipients map[keybase1.UserVersion]keybase1.PerUserKey) (boxes *PerTeamSharedSecretBoxes, err error) {
	defer t.G().CTrace(ctx, "SharedSecretBoxes", func() error { return err })()

	// make the nonce prefix, skipping the zero counter
	// (0 used for previous key encryption nonce)
	n, err := newNonce24SkipZero()
	if err != nil {
		return nil, err
	}

	// make the recipient boxes with the new secret and the nonce prefix
	return t.sharedBoxes(t.sharedSecret, t.generation, n, senderKey, recipients)
}

// RotateSharedSecretBoxes creates a new shared secret for the team and the
// required PerTeamKey section.
func (t *TeamKeyManager) RotateSharedSecretBoxes(ctx context.Context, senderKey libkb.GenericKey, recipients map[keybase1.UserVersion]keybase1.PerUserKey) (boxes *PerTeamSharedSecretBoxes, keySection *SCPerTeamKey, err error) {
	defer t.G().CTrace(ctx, "RotateSharedSecretBoxes", func() error { return err })()

	// make a new secret
	nextSecret, err := newSharedSecret()
	if err != nil {
		return nil, nil, err
	}

	// derive new key from new secret for PrevKey
	key := derivedSecret(nextSecret, libkb.TeamPrevKeySecretBoxDerivationString)
	var keyb [32]byte
	copy(keyb[:], key)

	// encrypt existing secret with derived key and nonce counter 0
	nonce, err := newNonce24()
	if err != nil {
		return nil, nil, err
	}
	nonceBytes, counter := nonce.Nonce()
	if counter != 0 {
		// this should never happen, but might as well make sure it is zero
		return nil, nil, errors.New("nonce counter not 0 for first use")
	}
	sealed := secretbox.Seal(nil, t.sharedSecret.ToBytes(), &nonceBytes, &keyb)

	// encode encrypted prev key
	prevKeyEncoded, err := encodeSealedPrevKey(nonceBytes, sealed)
	if err != nil {
		return nil, nil, err
	}

	// make the recipient boxes with the new secret and the incrementing nonce24
	t.setNextSharedSecret(ctx, nextSecret)
	boxes, err = t.sharedBoxes(t.sharedSecret, t.generation, nonce, senderKey, recipients)
	if err != nil {
		return nil, nil, err
	}

	// insert encoded encrypted PrevKey
	boxes.PrevKey = &prevKeyEncoded

	// need a new PerTeamKey section since the key was rotated
	keySection, err = t.perTeamKeySection()
	if err != nil {
		return nil, nil, err
	}

	return boxes, keySection, nil
}

func (t *TeamKeyManager) sharedBoxes(secret keybase1.PerTeamKeySeed, generation keybase1.PerTeamKeyGeneration, nonce *nonce24, senderKey libkb.GenericKey, recipients map[keybase1.UserVersion]keybase1.PerUserKey) (*PerTeamSharedSecretBoxes, error) {
	senderNaclDHKey, ok := senderKey.(libkb.NaclDHKeyPair)
	if !ok {
		return nil, fmt.Errorf("got an unexpected key type for device encryption key: %T", senderKey)
	}

	boxes, err := t.recipientBoxes(secret, nonce, senderNaclDHKey, recipients)
	if err != nil {
		return nil, err
	}

	return &PerTeamSharedSecretBoxes{
		Generation:    generation,
		EncryptingKid: senderNaclDHKey.GetKID(),
		Nonce:         nonce.PrefixEncoded(),
		Boxes:         boxes,
	}, nil
}

func (t *TeamKeyManager) recipientBoxes(secret keybase1.PerTeamKeySeed, nonce *nonce24, senderKey libkb.NaclDHKeyPair, recipients map[keybase1.UserVersion]keybase1.PerUserKey) (map[keybase1.UID]string, error) {
	boxes := make(map[keybase1.UID]string)
	for uv, recipientPerUserKey := range recipients {
		boxStruct, err := t.recipientBox(secret, nonce, senderKey, recipientPerUserKey)
		if err != nil {
			return nil, err
		}

		encodedArray, err := libkb.MsgpackEncode(boxStruct)
		if err != nil {
			return nil, err
		}

		boxes[uv.Uid] = base64.StdEncoding.EncodeToString(encodedArray)
	}

	return boxes, nil
}

func (t *TeamKeyManager) recipientBox(secret keybase1.PerTeamKeySeed, nonce *nonce24, senderKey libkb.NaclDHKeyPair, recipient keybase1.PerUserKey) (*PerTeamSharedSecretBox, error) {
	recipientPerUserGenericKeypair, err := libkb.ImportKeypairFromKID(recipient.EncKID)
	if err != nil {
		return nil, err
	}
	recipientPerUserNaclKeypair, ok := recipientPerUserGenericKeypair.(libkb.NaclDHKeyPair)
	if !ok {
		return nil, fmt.Errorf("got an unexpected key type for recipient KID in sharedTeamKeyBox: %T", recipientPerUserGenericKeypair)
	}

	nonceBytes, nonceCounter := nonce.Nonce()
	ctext := box.Seal(nil, secret[:], &nonceBytes, ((*[32]byte)(&recipientPerUserNaclKeypair.Public)), ((*[32]byte)(senderKey.Private)))

	boxStruct := PerTeamSharedSecretBox{
		Version:         libkb.SharedTeamKeyBoxVersion1,
		PerUserKeySeqno: recipient.Seqno,
		NonceCounter:    nonceCounter,
		Ctext:           ctext,
	}

	return &boxStruct, nil
}

func (t *TeamKeyManager) perTeamKeySection() (*SCPerTeamKey, error) {
	sigKey, err := t.SigningKey()
	if err != nil {
		return nil, err
	}
	encKey, err := t.EncryptionKey()
	if err != nil {
		return nil, err
	}
	return &SCPerTeamKey{
		Generation: keybase1.PerTeamKeyGeneration(t.generation),
		SigKID:     sigKey.GetKID(),
		EncKID:     encKey.GetKID(),
	}, nil
}

func (t *TeamKeyManager) setNextSharedSecret(ctx context.Context, secret keybase1.PerTeamKeySeed) {
	t.sharedSecret = secret

	// bump generation number
	t.generation = t.generation + 1

	// clear out derived keys
	t.signingKey = nil
	t.encryptionKey = nil

	t.G().Log.CDebugf(ctx, "TeamKeyManager: set next shared secret, generation %d", t.generation)
}

type prevKeySealedDecoded struct {
	_struct bool `codec:",toarray"`
	Version int
	Nonce   [24]byte
	Key     []byte
}

type prevKeySealedEncoded string

func encodeSealedPrevKey(nonceBytes [24]byte, key []byte) (prevKeySealedEncoded, error) {
	prevKey := prevKeySealedDecoded{
		Version: 1,
		Nonce:   nonceBytes,
		Key:     key,
	}
	packed, err := libkb.MsgpackEncode(prevKey)
	if err != nil {
		return "", err
	}
	encoded := base64.StdEncoding.EncodeToString(packed)
	return prevKeySealedEncoded(encoded), nil
}

func decodeSealedPrevKey(e prevKeySealedEncoded) (nonce [24]byte, ctext []byte, err error) {
	decoded, err := base64.StdEncoding.DecodeString(string(e))
	if err != nil {
		return nonce, nil, err
	}
	var tmp prevKeySealedDecoded
	err = libkb.MsgpackDecode(&tmp, decoded)
	if err != nil {
		return nonce, nil, err
	}
	if tmp.Version != 1 {
		return nonce, nil, fmt.Errorf("can only handle V1 encrypted prevs")
	}
	return tmp.Nonce, tmp.Key, nil
}

func newSharedSecret() (ret keybase1.PerTeamKeySeed, err error) {
	n, err := rand.Read(ret[:])
	if err != nil {
		return ret, err
	}
	if n != len(ret) {
		return ret, errors.New("short random read in newSharedSecret")
	}
	return ret, nil
}

func newSharedSecretAllGenerations(ctx context.Context, currentGeneration keybase1.PerTeamKeyGeneration,
	curr keybase1.PerTeamKeySeed, prevs map[keybase1.PerTeamKeyGeneration]prevKeySealedEncoded) (*SharedSecretAllGenerations, error) {

	ret := &SharedSecretAllGenerations{
		currentGeneration: currentGeneration,
		secrets:           make(map[keybase1.PerTeamKeyGeneration]keybase1.PerTeamKeySeed),
	}
	ret.secrets[ret.currentGeneration] = curr
	return ret.decryptPrevs(ctx, prevs)
}

func (s *SharedSecretAllGenerations) decryptPrevs(ctx context.Context, prevs map[keybase1.PerTeamKeyGeneration]prevKeySealedEncoded) (*SharedSecretAllGenerations, error) {
	for g := s.currentGeneration - 1; g >= 1; g-- {
		if err := s.decryptPrev(ctx, g, prevs); err != nil {
			return nil, err
		}
	}
	return s, nil
}

func (s *SharedSecretAllGenerations) decryptPrev(ctx context.Context, g keybase1.PerTeamKeyGeneration, prevs map[keybase1.PerTeamKeyGeneration]prevKeySealedEncoded) (err error) {
	key, ok := s.secrets[g+1]
	if !ok {
		return fmt.Errorf("in decyrpting prevs, couldn't find decrypted key @ %d", g+1)
	}
	encoded := prevs[g+1]
	if len(encoded) == 0 {
		return fmt.Errorf("can't find encrypted prev key at generation %d", g)
	}
	ret, err := decryptPrevSingle(ctx, encoded, key)
	if err != nil {
		return fmt.Errorf("at generation %d: %v", g, err)
	}
	s.secrets[g] = *ret
	return nil
}

func (s *SharedSecretAllGenerations) At(k keybase1.PerTeamKeyGeneration) keybase1.PerTeamKeySeed {
	return s.secrets[k]
}

func derivedSecret(secret keybase1.PerTeamKeySeed, context string) []byte {
	if secret.IsZero() {
		panic("Should never be using a zero key in derivedSecret; something went terribly wrong")
	}
	digest := hmac.New(sha512.New, secret[:])
	digest.Write([]byte(context))
	return digest.Sum(nil)[:32]
}

// Decrypt a single prev secretbox.
// Takes a prev to decrypt and the seed of the successor generation.
// For example (prev[3], seed[4]) -> seed[3]
func decryptPrevSingle(ctx context.Context,
	prevToDecrypt prevKeySealedEncoded, successor keybase1.PerTeamKeySeed) (*keybase1.PerTeamKeySeed, error) {
	if successor.IsZero() {
		return nil, fmt.Errorf("Got 0 key, which can't be right")
	}
	if len(prevToDecrypt) == 0 {
		return nil, fmt.Errorf("zero-length encoded prev")
	}
	nonce, ctext, err := decodeSealedPrevKey(prevToDecrypt)
	if err != nil {
		return nil, err
	}
	var keyFixed [32]byte
	// prev key to decrypt with
	key := derivedSecret(successor, libkb.TeamPrevKeySecretBoxDerivationString)
	copy(keyFixed[:], key)
	opened, ok := secretbox.Open(nil, ctext, &nonce, &keyFixed)
	if !ok {
		return nil, fmt.Errorf("prev decryption failed")
	}
	ret, err := keybase1.PerTeamKeySeedFromBytes(opened)
	return &ret, err
}
