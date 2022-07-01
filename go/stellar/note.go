package stellar

import (
	"context"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"fmt"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/msgpack"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/protocol/stellar1"
	"golang.org/x/crypto/nacl/box"
	"golang.org/x/crypto/nacl/secretbox"
)

type noteBuildSecret struct {
	symmetricKey libkb.NaclSecretBoxKey
	sender       stellar1.NoteRecipient
	recipient    *stellar1.NoteRecipient
}

// noteSymmetricKey returns a symmetric key to be used in encrypting a note.
// The key is available to the current user and to the optional `other` recipient.
// If `other` is nil the key is derived from the latest PUK seed.
// If `other` is non-nil the key is derived from the nacl shared key of both users' latest PUK encryption keys.
func noteSymmetricKey(mctx libkb.MetaContext, other *keybase1.UserVersion) (res noteBuildSecret, err error) {
	meUV, err := mctx.G().GetMeUV(mctx.Ctx())
	if err != nil {
		return res, err
	}
	puk1Gen, puk1Seed, err := loadOwnLatestPuk(mctx)
	if err != nil {
		return res, err
	}
	symmetricKey, err := puk1Seed.DeriveSymmetricKey(libkb.DeriveReasonPUKStellarNoteSelf)
	if err != nil {
		return res, err
	}
	var recipient *stellar1.NoteRecipient
	if other != nil && !other.Eq(meUV) {
		u2, err := loadUvUpk(mctx, *other)
		if err != nil {
			return res, fmt.Errorf("error loading recipient: %v", err)
		}
		puk2 := u2.GetLatestPerUserKey()
		if puk2 == nil {
			return res, fmt.Errorf("recipient has no per-user key")
		}
		// Overwite symmetricKey with the shared key.
		symmetricKey, err = noteMixKeys(mctx, puk1Seed, puk2.EncKID)
		if err != nil {
			return res, err
		}
		recipient = &stellar1.NoteRecipient{
			User:   *other,
			PukGen: keybase1.PerUserKeyGeneration(puk2.Gen),
		}
	}
	return noteBuildSecret{
		symmetricKey: symmetricKey,
		sender: stellar1.NoteRecipient{
			User:   meUV,
			PukGen: puk1Gen,
		},
		recipient: recipient,
	}, nil
}

func noteSymmetricKeyForDecryption(mctx libkb.MetaContext, encNote stellar1.EncryptedNote) (res libkb.NaclSecretBoxKey, err error) {
	meUV, err := mctx.G().GetMeUV(mctx.Ctx())
	if err != nil {
		return res, err
	}
	var mePukGen keybase1.PerUserKeyGeneration
	var them *stellar1.NoteRecipient
	if encNote.Sender.User.Eq(meUV) {
		mePukGen = encNote.Sender.PukGen
		them = encNote.Recipient
	}
	if encNote.Recipient != nil && encNote.Recipient.User.Eq(meUV) {
		mePukGen = encNote.Recipient.PukGen
		them = &encNote.Sender
	}
	if mePukGen == 0 {
		return res, fmt.Errorf("note not encrypted for logged-in user")
	}
	pukring, err := mctx.G().GetPerUserKeyring(mctx.Ctx())
	if err != nil {
		return res, err
	}
	pukSeed, err := pukring.GetSeedByGenerationOrSync(mctx, mePukGen)
	if err != nil {
		return res, err
	}
	if them == nil {
		return pukSeed.DeriveSymmetricKey(libkb.DeriveReasonPUKStellarNoteSelf)
	}
	u2, err := loadUvUpk(mctx, them.User)
	if err != nil {
		return res, err
	}
	puk2 := u2.GetPerUserKeyByGen(them.PukGen)
	if puk2 == nil {
		return res, fmt.Errorf("could not find other user's key: %v %v", them.User.String(), them.PukGen)
	}
	return noteMixKeys(mctx, pukSeed, puk2.EncKID)
}

// noteMixKeys derives a shared symmetric key for two DH keys.
// The key is the last 32 bytes of the nacl box of 32 zeros with a use-specific nonce.
func noteMixKeys(mctx libkb.MetaContext, puk1 libkb.PerUserKeySeed, puk2EncKID keybase1.KID) (res libkb.NaclSecretBoxKey, err error) {
	puk1Enc, err := puk1.DeriveDHKey()
	if err != nil {
		return res, err
	}
	puk2EncGeneric, err := libkb.ImportKeypairFromKID(puk2EncKID)
	if err != nil {
		return res, err
	}
	puk2Enc, ok := puk2EncGeneric.(libkb.NaclDHKeyPair)
	if !ok {
		return res, fmt.Errorf("recipient per-user key was not a DH key")
	}
	var zeros [32]byte
	// This is a constant nonce used for key derivation.
	// The derived key will be used with one-time random nonces for the actual encryption/decryption.
	nonce := noteMixPukNonce()
	sharedSecretBox := box.Seal(nil, zeros[:], &nonce, (*[32]byte)(&puk2Enc.Public), (*[32]byte)(puk1Enc.Private))
	return libkb.MakeByte32Soft(sharedSecretBox[len(sharedSecretBox)-32:])
}

// noteMixPukNonce is a nonce used in key derivation for shared notes.
// 24-byte prefix of the sha256 hash of a constant string.
func noteMixPukNonce() (res [24]byte) {
	reasonHash := sha256.Sum256([]byte(libkb.DeriveReasonPUKStellarNoteShared))
	copy(res[:], reasonHash[:])
	return res
}

func NoteEncryptB64(mctx libkb.MetaContext, note stellar1.NoteContents, other *keybase1.UserVersion) (noteB64 string, err error) {
	if len(note.Note) > libkb.MaxStellarPaymentNoteLength {
		return "", fmt.Errorf("Note of size %d bytes exceeds the maximum length of %d bytes",
			len(note.Note), libkb.MaxStellarPaymentNoteLength)
	}
	obj, err := noteEncrypt(mctx, note, other)
	if err != nil {
		return "", err
	}
	pack, err := msgpack.Encode(obj)
	if err != nil {
		return "", err
	}
	noteB64 = base64.StdEncoding.EncodeToString(pack)
	if len(noteB64) > libkb.MaxStellarPaymentBoxedNoteLength {
		return "", fmt.Errorf("Encrypted note of size %d bytes exceeds the maximum length of %d bytes",
			len(noteB64), libkb.MaxStellarPaymentBoxedNoteLength)
	}
	return noteB64, nil
}

// noteEncrypt encrypts a note for the logged-in user as well as optionally for `other`.
func noteEncrypt(mctx libkb.MetaContext, note stellar1.NoteContents, other *keybase1.UserVersion) (res stellar1.EncryptedNote, err error) {
	nbs, err := noteSymmetricKey(mctx, other)
	if err != nil {
		return res, fmt.Errorf("error getting encryption key for note: %v", err)
	}
	if nbs.symmetricKey.IsZero() {
		// This should never happen
		return res, fmt.Errorf("unexpected zero key")
	}
	res, err = noteEncryptHelper(mctx.Ctx(), note, nbs.symmetricKey)
	if err != nil {
		return res, err
	}
	res.Sender = nbs.sender
	res.Recipient = nbs.recipient
	return res, nil
}

// noteEncryptHelper does the encryption part and returns a partially populated result.
func noteEncryptHelper(ctx context.Context, note stellar1.NoteContents, symmetricKey libkb.NaclSecretBoxKey) (res stellar1.EncryptedNote, err error) {
	// Msgpack
	clearpack, err := msgpack.Encode(note)
	if err != nil {
		return res, err
	}

	// Secretbox
	var nonce [libkb.NaclDHNonceSize]byte
	nonce, err = libkb.RandomNaclDHNonce()
	if err != nil {
		return res, err
	}
	secbox := secretbox.Seal(nil, clearpack, &nonce, (*[libkb.NaclSecretBoxKeySize]byte)(&symmetricKey))

	return stellar1.EncryptedNote{
		V: 1,
		E: secbox,
		N: nonce,
	}, nil
}

func NoteDecryptB64(mctx libkb.MetaContext, noteB64 string) (res stellar1.NoteContents, err error) {
	pack, err := base64.StdEncoding.DecodeString(noteB64)
	if err != nil {
		return res, err
	}
	var obj stellar1.EncryptedNote
	err = msgpack.Decode(&obj, pack)
	if err != nil {
		return res, err
	}
	return noteDecrypt(mctx, obj)
}

func noteDecrypt(mctx libkb.MetaContext, encNote stellar1.EncryptedNote) (res stellar1.NoteContents, err error) {
	if encNote.V != 1 {
		return res, fmt.Errorf("unsupported note version: %v", encNote.V)
	}
	symmetricKey, err := noteSymmetricKeyForDecryption(mctx, encNote)
	if err != nil {
		return res, err
	}
	return noteDecryptHelper(mctx.Ctx(), encNote, symmetricKey)
}

func noteDecryptHelper(ctx context.Context, encNote stellar1.EncryptedNote, symmetricKey libkb.NaclSecretBoxKey) (res stellar1.NoteContents, err error) {
	// Secretbox
	clearpack, ok := secretbox.Open(nil, encNote.E,
		(*[libkb.NaclDHNonceSize]byte)(&encNote.N),
		(*[libkb.NaclSecretBoxKeySize]byte)(&symmetricKey))
	if !ok {
		return res, errors.New("could not decrypt note secretbox")
	}

	// Msgpack
	err = msgpack.Decode(&res, clearpack)
	return res, err
}
