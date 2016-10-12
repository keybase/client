// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package chat

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"

	"golang.org/x/crypto/nacl/secretbox"
	"golang.org/x/net/context"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-codec/codec"
)

var publicCryptKey keybase1.CryptKey

func init() {
	// publicCryptKey is a zero key used for public chat messages.
	var zero [libkb.NaclDHKeySecretSize]byte
	publicCryptKey = keybase1.CryptKey{
		KeyGeneration: 1,
		Key:           keybase1.Bytes32(zero),
	}
}

type Boxer struct {
	tlf    keybase1.TlfInterface
	hashV1 func(data []byte) chat1.Hash
	sign   func(msg []byte, kp libkb.NaclSigningKeyPair, prefix libkb.SignaturePrefix) (chat1.SignatureInfo, error) // replaceable for testing
	libkb.Contextified
}

func NewBoxer(g *libkb.GlobalContext, tlf keybase1.TlfInterface) *Boxer {
	return &Boxer{
		tlf:          tlf,
		hashV1:       hashSha256V1,
		sign:         sign,
		Contextified: libkb.NewContextified(g),
	}
}

// unboxMessage unboxes a chat1.MessageBoxed into a keybase1.Message.  It finds
// the appropriate keybase1.CryptKey.
func (b *Boxer) UnboxMessage(ctx context.Context, finder *KeyFinder, boxed chat1.MessageBoxed) (messagePlaintext chat1.MessagePlaintext, headerHash chat1.Hash, err error) {
	tlfName := boxed.ClientHeader.TlfName
	tlfPublic := boxed.ClientHeader.TlfPublic
	keys, err := finder.Find(ctx, b.tlf, tlfName, tlfPublic)
	if err != nil {
		return chat1.MessagePlaintext{}, nil, libkb.ChatUnboxingError{Msg: err.Error()}
	}

	var matchKey *keybase1.CryptKey
	for _, key := range keys.CryptKeys {
		if key.KeyGeneration == boxed.KeyGeneration {
			matchKey = &key
			break
		}
	}

	if matchKey == nil {
		return chat1.MessagePlaintext{}, nil, libkb.ChatUnboxingError{Msg: fmt.Sprintf("no key found for generation %d", boxed.KeyGeneration)}
	}

	if messagePlaintext, headerHash, err = b.unboxMessageWithKey(ctx, boxed, matchKey); err != nil {
		return chat1.MessagePlaintext{}, nil, libkb.ChatUnboxingError{Msg: err.Error()}
	}

	return messagePlaintext, headerHash, nil
}

// unboxMessageWithKey unboxes a chat1.MessageBoxed into a keybase1.Message given
// a keybase1.CryptKey.
func (b *Boxer) unboxMessageWithKey(ctx context.Context, msg chat1.MessageBoxed, key *keybase1.CryptKey) (messagePlaintext chat1.MessagePlaintext, headerHash chat1.Hash, err error) {
	if msg.ServerHeader == nil {
		return chat1.MessagePlaintext{}, nil, errors.New("nil ServerHeader in MessageBoxed")
	}

	// compute the header hash
	headerHash = b.hashV1(msg.HeaderCiphertext.E)

	// decrypt body
	var body chat1.BodyPlaintext
	skipBodyVerification := false
	if len(msg.BodyCiphertext.E) == 0 {
		if msg.ServerHeader.SupersededBy == 0 {
			return chat1.MessagePlaintext{}, nil, errors.New("empty body and not superseded in MessageBoxed")
		}
		skipBodyVerification = true
	} else {
		packedBody, err := b.open(msg.BodyCiphertext, key)
		if err != nil {
			return chat1.MessagePlaintext{}, nil, err
		}
		if err := b.unmarshal(packedBody, &body); err != nil {
			return chat1.MessagePlaintext{}, nil, err
		}
	}

	// decrypt header
	packedHeader, err := b.open(msg.HeaderCiphertext, key)
	if err != nil {
		return chat1.MessagePlaintext{}, nil, err
	}
	var header chat1.HeaderPlaintext
	if err := b.unmarshal(packedHeader, &header); err != nil {
		return chat1.MessagePlaintext{}, nil, err
	}

	// verify the message
	if err := b.verifyMessage(ctx, header, msg, skipBodyVerification); err != nil {
		return chat1.MessagePlaintext{}, nil, err
	}

	// create a chat1.MessageClientHeader from versioned HeaderPlaintext
	var clientHeader chat1.MessageClientHeader
	headerVersion, err := header.Version()
	if err != nil {
		return chat1.MessagePlaintext{}, nil, err
	}
	switch headerVersion {
	case chat1.HeaderPlaintextVersion_V1:
		hp := header.V1()
		clientHeader = chat1.MessageClientHeader{
			Conv:         hp.Conv,
			TlfName:      hp.TlfName,
			TlfPublic:    hp.TlfPublic,
			MessageType:  hp.MessageType,
			Prev:         hp.Prev,
			Sender:       hp.Sender,
			SenderDevice: hp.SenderDevice,
		}
	default:
		return chat1.MessagePlaintext{}, nil, libkb.NewChatHeaderVersionError(headerVersion)
	}

	if skipBodyVerification {
		// body was deleted, so return empty body that matches header version
		switch headerVersion {
		case chat1.HeaderPlaintextVersion_V1:
			msgPlainV1 := chat1.MessagePlaintextV1{
				ClientHeader: clientHeader,
			}
			return chat1.NewMessagePlaintextWithV1(msgPlainV1), headerHash, nil
		default:
			return chat1.MessagePlaintext{}, nil, libkb.NewChatHeaderVersionError(headerVersion)
		}
	}

	// create an unboxed message from versioned BodyPlaintext and clientHeader
	bodyVersion, err := body.Version()
	if err != nil {
		return chat1.MessagePlaintext{}, nil, err
	}
	switch bodyVersion {
	case chat1.BodyPlaintextVersion_V1:
		msgPlainV1 := chat1.MessagePlaintextV1{
			ClientHeader: clientHeader,
			MessageBody:  body.V1().MessageBody,
		}
		return chat1.NewMessagePlaintextWithV1(msgPlainV1), headerHash, nil
	default:
		return chat1.MessagePlaintext{}, nil, libkb.NewChatBodyVersionError(bodyVersion)
	}
}

// boxMessage encrypts a keybase1.MessagePlaintext into a chat1.MessageBoxed.  It
// finds the most recent key for the TLF.
func (b *Boxer) BoxMessage(ctx context.Context, msg chat1.MessagePlaintext, signingKeyPair libkb.NaclSigningKeyPair) (*chat1.MessageBoxed, error) {
	version, err := msg.Version()
	if err != nil {
		return nil, err
	}

	switch version {
	case chat1.MessagePlaintextVersion_V1:
		return b.boxMessageV1(ctx, msg.V1(), signingKeyPair)
	default:
		return nil, fmt.Errorf("invalid MessagePlaintext version %v", version)
	}
}

// boxMessageV1 encrypts and signs a keybase1.MessagePlaintextV1 into a chat1.MessageBoxed.
func (b *Boxer) boxMessageV1(ctx context.Context, msg chat1.MessagePlaintextV1, signingKeyPair libkb.NaclSigningKeyPair) (*chat1.MessageBoxed, error) {
	tlfName := msg.ClientHeader.TlfName
	var recentKey *keybase1.CryptKey

	if len(tlfName) == 0 {
		return nil, libkb.ChatBoxingError{Msg: "blank TLF name given"}
	}
	if msg.ClientHeader.TlfPublic {
		recentKey = &publicCryptKey
		res, err := b.tlf.PublicCanonicalTLFNameAndID(ctx, keybase1.TLFQuery{
			TlfName:          tlfName,
			IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_CLI,
		})
		if err != nil {
			return nil, libkb.ChatBoxingError{Msg: err.Error()}
		}
		msg.ClientHeader.TlfName = string(res.CanonicalName)
	} else {
		keys, err := b.tlf.CryptKeys(ctx, keybase1.TLFQuery{
			TlfName:          tlfName,
			IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_CLI,
		})
		if err != nil {
			return nil, libkb.ChatBoxingError{Msg: err.Error()}
		}
		msg.ClientHeader.TlfName = string(keys.NameIDBreaks.CanonicalName)
		if len(msg.ClientHeader.TlfName) == 0 {
			return nil, libkb.ChatBoxingError{Msg: fmt.Sprintf("blank TLF name received: original: %s canonical: %s", tlfName, msg.ClientHeader.TlfName)}
		}

		for _, key := range keys.CryptKeys {
			if recentKey == nil || key.KeyGeneration > recentKey.KeyGeneration {
				recentKey = &key
			}
		}
	}

	if recentKey == nil {
		return nil, libkb.ChatBoxingError{Msg: fmt.Sprintf("no key found for tlf %q (public: %v)", tlfName, msg.ClientHeader.TlfPublic)}
	}

	boxed, err := b.boxMessageWithKeysV1(msg, recentKey, signingKeyPair)
	if err != nil {
		return nil, libkb.ChatBoxingError{Msg: err.Error()}
	}

	return boxed, nil
}

// boxMessageWithKeysV1 encrypts and signs a keybase1.MessagePlaintextV1 into a
// chat1.MessageBoxed given a keybase1.CryptKey.
func (b *Boxer) boxMessageWithKeysV1(msg chat1.MessagePlaintextV1, key *keybase1.CryptKey, signingKeyPair libkb.NaclSigningKeyPair) (*chat1.MessageBoxed, error) {
	body := chat1.BodyPlaintextV1{
		MessageBody: msg.MessageBody,
	}
	plaintextBody := chat1.NewBodyPlaintextWithV1(body)
	encryptedBody, err := b.seal(plaintextBody, key)
	if err != nil {
		return nil, err
	}

	bodyHash := b.hashV1(encryptedBody.E)

	// create the v1 header, adding hash
	header := chat1.HeaderPlaintextV1{
		Conv:         msg.ClientHeader.Conv,
		TlfName:      msg.ClientHeader.TlfName,
		TlfPublic:    msg.ClientHeader.TlfPublic,
		MessageType:  msg.ClientHeader.MessageType,
		Prev:         msg.ClientHeader.Prev,
		Sender:       msg.ClientHeader.Sender,
		SenderDevice: msg.ClientHeader.SenderDevice,
		BodyHash:     bodyHash[:],
	}

	// sign the header and insert the signature
	sig, err := b.signMarshal(header, signingKeyPair, libkb.SignaturePrefixChat)
	if err != nil {
		return nil, err
	}
	header.HeaderSignature = &sig

	// create a plaintext header
	plaintextHeader := chat1.NewHeaderPlaintextWithV1(header)
	encryptedHeader, err := b.seal(plaintextHeader, key)
	if err != nil {
		return nil, err
	}

	boxed := &chat1.MessageBoxed{
		ClientHeader:     msg.ClientHeader,
		BodyCiphertext:   *encryptedBody,
		HeaderCiphertext: *encryptedHeader,
		KeyGeneration:    key.KeyGeneration,
	}

	return boxed, nil
}

// seal encrypts data into chat1.EncryptedData.
func (b *Boxer) seal(data interface{}, key *keybase1.CryptKey) (*chat1.EncryptedData, error) {
	s, err := b.marshal(data)
	if err != nil {
		return nil, err
	}

	var nonce [libkb.NaclDHNonceSize]byte
	if _, err := rand.Read(nonce[:]); err != nil {
		return nil, err
	}

	sealed := secretbox.Seal(nil, []byte(s), &nonce, ((*[32]byte)(&key.Key)))
	enc := &chat1.EncryptedData{
		V: 1,
		E: sealed,
		N: nonce[:],
	}
	return enc, nil
}

// open decrypts chat1.EncryptedData.
func (b *Boxer) open(data chat1.EncryptedData, key *keybase1.CryptKey) ([]byte, error) {
	if len(data.N) != libkb.NaclDHNonceSize {
		return nil, libkb.DecryptBadNonceError{}
	}
	var nonce [libkb.NaclDHNonceSize]byte
	copy(nonce[:], data.N)

	plain, ok := secretbox.Open(nil, data.E, &nonce, ((*[32]byte)(&key.Key)))
	if !ok {
		return nil, libkb.DecryptOpenError{}
	}
	return plain, nil
}

// signMarshal signs data with a NaclSigningKeyPair, returning a chat1.SignatureInfo.
// It marshals data before signing.
func (b *Boxer) signMarshal(data interface{}, kp libkb.NaclSigningKeyPair, prefix libkb.SignaturePrefix) (chat1.SignatureInfo, error) {
	encoded, err := b.marshal(data)
	if err != nil {
		return chat1.SignatureInfo{}, err
	}

	return b.sign(encoded, kp, prefix)
}

// sign signs msg with a NaclSigningKeyPair, returning a chat1.SignatureInfo.
func sign(msg []byte, kp libkb.NaclSigningKeyPair, prefix libkb.SignaturePrefix) (chat1.SignatureInfo, error) {
	sig, err := kp.SignV2(msg, prefix)
	if err != nil {
		return chat1.SignatureInfo{}, err
	}
	sigInfo := chat1.SignatureInfo{
		V: sig.Version,
		S: sig.Sig[:],
		K: sig.Kid,
	}
	return sigInfo, nil
}

// verifyMessage checks that a message is valid.
func (b *Boxer) verifyMessage(ctx context.Context, header chat1.HeaderPlaintext, msg chat1.MessageBoxed, skipBodyVerification bool) error {
	headerVersion, err := header.Version()
	if err != nil {
		return err
	}

	switch headerVersion {
	case chat1.HeaderPlaintextVersion_V1:
		return b.verifyMessageHeaderV1(ctx, header.V1(), msg, skipBodyVerification)
	default:
		return libkb.NewChatHeaderVersionError(headerVersion)
	}
}

// verifyMessageHeaderV1 checks the body hash, header signature, and signing key validity.
func (b *Boxer) verifyMessageHeaderV1(ctx context.Context, header chat1.HeaderPlaintextV1, msg chat1.MessageBoxed, skipBodyVerification bool) error {
	if !skipBodyVerification {
		// check body hash
		bh := b.hashV1(msg.BodyCiphertext.E)
		if !libkb.SecureByteArrayEq(bh[:], header.BodyHash) {
			return libkb.ChatBodyHashInvalid{}
		}
	}

	// check signature
	hcopy := header
	hcopy.HeaderSignature = nil
	hpack, err := b.marshal(hcopy)
	if err != nil {
		return err
	}
	if !b.verify(hpack, *header.HeaderSignature, libkb.SignaturePrefixChat) {
		return libkb.BadSigError{E: "header signature invalid"}
	}

	// check key validity
	valid, err := b.validSenderKey(ctx, header.Sender, header.HeaderSignature.K, msg.ServerHeader.Ctime)
	if err != nil {
		return err
	}
	if !valid {
		return errors.New("key invalid for sender at message ctime")
	}

	return nil

}

// verify verifies the signature of data using SignatureInfo.
func (b *Boxer) verify(data []byte, si chat1.SignatureInfo, prefix libkb.SignaturePrefix) bool {
	sigInfo := libkb.NaclSigInfo{
		Version: si.V,
		Prefix:  prefix,
		Kid:     si.K,
		Payload: data,
	}
	copy(sigInfo.Sig[:], si.S)
	_, err := sigInfo.Verify()
	return (err == nil)
}

// validSenderKey checks that the key is active for sender at ctime.
func (b *Boxer) validSenderKey(ctx context.Context, sender gregor1.UID, key []byte, ctime gregor1.Time) (bool, error) {
	kbSender, err := keybase1.UIDFromString(hex.EncodeToString(sender.Bytes()))
	if err != nil {
		return false, err
	}
	kid := keybase1.KIDFromSlice(key)
	t := gregor1.FromTime(ctime)

	var uimap *UserInfoMapper
	ctx, uimap = GetUserInfoMapper(ctx, b.G())
	user, err := uimap.User(kbSender)
	if err != nil {
		return false, err
	}
	ckf := user.GetComputedKeyFamily()
	if ckf == nil {
		return false, errors.New("no computed key family")
	}
	activeKey, _, err := ckf.FindActiveSibkeyAtTime(kid, t)
	if err != nil {
		return false, err
	}
	if activeKey == nil {
		return false, nil
	}

	return true, nil
}

func (b *Boxer) marshal(v interface{}) ([]byte, error) {
	mh := codec.MsgpackHandle{WriteExt: true}
	var data []byte
	enc := codec.NewEncoderBytes(&data, &mh)
	if err := enc.Encode(v); err != nil {
		return nil, err
	}
	return data, nil
}

func (b *Boxer) unmarshal(data []byte, v interface{}) error {
	mh := codec.MsgpackHandle{WriteExt: true}
	dec := codec.NewDecoderBytes(data, &mh)
	return dec.Decode(&v)
}

func hashSha256V1(data []byte) chat1.Hash {
	sum := sha256.Sum256(data)
	return sum[:]
}
