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

	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
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
	udc    *utils.UserDeviceCache
	kbCtx  utils.KeybaseContext
}

func NewBoxer(kbCtx utils.KeybaseContext, tlf keybase1.TlfInterface, udc *utils.UserDeviceCache) *Boxer {
	return &Boxer{
		tlf:    tlf,
		hashV1: hashSha256V1,
		sign:   sign,
		udc:    udc,
		kbCtx:  kbCtx,
	}
}

func (b *Boxer) log() logger.Logger {
	return b.kbCtx.GetLog()
}

func (b *Boxer) makeErrorMessage(msg chat1.MessageBoxed, err error) chat1.MessageUnboxed {
	return chat1.NewMessageUnboxedWithError(chat1.MessageUnboxedError{
		ErrMsg:      err.Error(),
		MessageID:   msg.GetMessageID(),
		MessageType: msg.GetMessageType(),
	})
}

// UnboxMessage unboxes a chat1.MessageBoxed into a keybase1.Message.  It finds
// the appropriate keybase1.CryptKey.
// The first return value is unusable if the err != nil
// Returns (_, err) for non-permanent errors, and (MessageUnboxedError, nil) for permanent errors.
// Permanent errors can be cached and must be treated as a value to deal with.
// Whereas temporary errors are transient failures.
func (b *Boxer) UnboxMessage(ctx context.Context, finder KeyFinder, boxed chat1.MessageBoxed) (chat1.MessageUnboxed, libkb.ChatUnboxingError) {
	tlfName := boxed.ClientHeader.TlfName
	tlfPublic := boxed.ClientHeader.TlfPublic
	keys, err := finder.Find(ctx, b.tlf, tlfName, tlfPublic)
	if err != nil {
		// transient error
		return chat1.MessageUnboxed{}, libkb.NewTransientChatUnboxingError(err)
	}

	var matchKey *keybase1.CryptKey
	for _, key := range keys.CryptKeys {
		if key.KeyGeneration == boxed.KeyGeneration {
			matchKey = &key
			break
		}
	}

	if matchKey == nil {
		err := fmt.Errorf("no key found for generation %d", boxed.KeyGeneration)
		return chat1.MessageUnboxed{}, libkb.NewTransientChatUnboxingError(err)
	}

	pt, headerHash, ierr := b.unboxMessageWithKey(ctx, boxed, matchKey)
	if ierr != nil {
		b.log().Warning("failed to unbox message: msgID: %d err: %s", boxed.ServerHeader.MessageID,
			ierr.Error())
		if ierr.IsPermanent() {
			return b.makeErrorMessage(boxed, ierr.Inner()), nil
		}
		return chat1.MessageUnboxed{}, ierr
	}

	_, uimap := utils.GetUserInfoMapper(ctx, b.kbCtx)
	username, deviceName, err := b.getSenderInfoLocal(uimap, pt.ClientHeader)
	if err != nil {
		b.log().Warning("unable to fetch sender informaton: UID: %s deviceID: %s",
			pt.ClientHeader.Sender, pt.ClientHeader.SenderDevice)
		// ignore non-fatal error
	}

	return chat1.NewMessageUnboxedWithValid(chat1.MessageUnboxedValid{
		ClientHeader:     pt.ClientHeader,
		ServerHeader:     *boxed.ServerHeader,
		MessageBody:      pt.MessageBody,
		SenderUsername:   username,
		SenderDeviceName: deviceName,
		HeaderHash:       headerHash,
	}), nil

}

// unboxMessageWithKey unboxes a chat1.MessageBoxed into a keybase1.Message given
// a keybase1.CryptKey.
func (b *Boxer) unboxMessageWithKey(ctx context.Context, msg chat1.MessageBoxed, key *keybase1.CryptKey) (chat1.MessagePlaintext, chat1.Hash, libkb.ChatUnboxingError) {

	var err error
	if msg.ServerHeader == nil {
		return chat1.MessagePlaintext{}, nil, libkb.NewPermanentChatUnboxingError(errors.New("nil ServerHeader in MessageBoxed"))
	}

	// compute the header hash
	headerHash := b.hashV1(msg.HeaderCiphertext.E)

	// decrypt body
	var body chat1.BodyPlaintext
	skipBodyVerification := false
	if len(msg.BodyCiphertext.E) == 0 {
		if msg.ServerHeader.SupersededBy == 0 {
			return chat1.MessagePlaintext{}, nil, libkb.NewPermanentChatUnboxingError(errors.New("empty body and not superseded in MessageBoxed"))
		}
		skipBodyVerification = true
	} else {
		packedBody, err := b.open(msg.BodyCiphertext, key)
		if err != nil {
			return chat1.MessagePlaintext{}, nil, libkb.NewPermanentChatUnboxingError(err)
		}
		if err := b.unmarshal(packedBody, &body); err != nil {
			return chat1.MessagePlaintext{}, nil, libkb.NewPermanentChatUnboxingError(err)
		}
	}

	// decrypt header
	packedHeader, err := b.open(msg.HeaderCiphertext, key)
	if err != nil {
		return chat1.MessagePlaintext{}, nil, libkb.NewPermanentChatUnboxingError(err)
	}
	var header chat1.HeaderPlaintext
	if err := b.unmarshal(packedHeader, &header); err != nil {
		return chat1.MessagePlaintext{}, nil, libkb.NewPermanentChatUnboxingError(err)
	}

	// verify the message
	if ierr := b.verifyMessage(ctx, header, msg, skipBodyVerification); ierr != nil {
		return chat1.MessagePlaintext{}, nil, ierr
	}

	// create a chat1.MessageClientHeader from versioned HeaderPlaintext
	var clientHeader chat1.MessageClientHeader
	headerVersion, err := header.Version()
	if err != nil {
		return chat1.MessagePlaintext{}, nil, libkb.NewPermanentChatUnboxingError(err)
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
		return chat1.MessagePlaintext{}, nil, libkb.NewPermanentChatUnboxingError(libkb.NewChatHeaderVersionError(headerVersion))
	}
	clientHeader.OutboxInfo = msg.ClientHeader.OutboxInfo
	clientHeader.OutboxID = msg.ClientHeader.OutboxID

	if skipBodyVerification {
		// body was deleted, so return empty body that matches header version
		switch headerVersion {
		case chat1.HeaderPlaintextVersion_V1:
			return chat1.MessagePlaintext{ClientHeader: clientHeader}, headerHash, nil
		default:
			return chat1.MessagePlaintext{}, nil, libkb.NewPermanentChatUnboxingError(libkb.NewChatHeaderVersionError(headerVersion))
		}
	}

	// create an unboxed message from versioned BodyPlaintext and clientHeader
	bodyVersion, err := body.Version()
	if err != nil {
		return chat1.MessagePlaintext{}, nil, libkb.NewPermanentChatUnboxingError(err)
	}
	switch bodyVersion {
	case chat1.BodyPlaintextVersion_V1:
		return chat1.MessagePlaintext{
			ClientHeader: clientHeader,
			MessageBody:  body.V1().MessageBody,
		}, headerHash, nil
	default:
		return chat1.MessagePlaintext{}, nil, libkb.NewPermanentChatUnboxingError(libkb.NewChatBodyVersionError(bodyVersion))
	}
}

// unboxThread transforms a chat1.ThreadViewBoxed to a keybase1.ThreadView.
func (b *Boxer) UnboxThread(ctx context.Context, boxed chat1.ThreadViewBoxed, convID chat1.ConversationID) (thread chat1.ThreadView, err error) {
	thread = chat1.ThreadView{
		Pagination: boxed.Pagination,
	}

	if thread.Messages, err = b.UnboxMessages(ctx, boxed.Messages); err != nil {
		return chat1.ThreadView{}, err
	}

	return thread, nil
}

func (b *Boxer) getUsernameAndDeviceName(uid keybase1.UID, deviceID keybase1.DeviceID,
	uimap *utils.UserInfoMapper) (string, string, error) {

	username, deviceName, err := b.udc.LookupUsernameAndDeviceName(uimap, uid, deviceID)
	return username, deviceName, err
}

func (b *Boxer) getSenderInfoLocal(uimap *utils.UserInfoMapper, clientHeader chat1.MessageClientHeader) (senderUsername string, senderDeviceName string, err error) {
	uid := keybase1.UID(clientHeader.Sender.String())
	did := keybase1.DeviceID(clientHeader.SenderDevice.String())
	username, deviceName, err := b.getUsernameAndDeviceName(uid, did, uimap)
	if err != nil {
		return "", "", err
	}

	return username, deviceName, nil
}

func (b *Boxer) UnboxMessages(ctx context.Context, boxed []chat1.MessageBoxed) (unboxed []chat1.MessageUnboxed, err error) {
	finder := NewKeyFinder()
	ctx, _ = utils.GetUserInfoMapper(ctx, b.kbCtx)
	for _, msg := range boxed {
		decmsg, err := b.UnboxMessage(ctx, finder, msg)
		if err != nil {
			return unboxed, err
		}
		unboxed = append(unboxed, decmsg)
	}

	return unboxed, nil
}

// boxMessage encrypts a keybase1.MessagePlaintext into a chat1.MessageBoxed.  It
// finds the most recent key for the TLF.
func (b *Boxer) BoxMessage(ctx context.Context, msg chat1.MessagePlaintext, signingKeyPair libkb.NaclSigningKeyPair) (*chat1.MessageBoxed, error) {
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
			return nil, libkb.ChatBoxingError{Msg: "PublicCanonicalTLFNameAndID: " + err.Error()}
		}
		msg.ClientHeader.TlfName = string(res.CanonicalName)
	} else {
		keys, err := b.tlf.CryptKeys(ctx, keybase1.TLFQuery{
			TlfName:          tlfName,
			IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_CLI,
		})
		if err != nil {
			return nil, libkb.ChatBoxingError{Msg: "CryptKeys: " + err.Error()}
		}
		msg.ClientHeader.TlfName = string(keys.NameIDBreaks.CanonicalName)

		for _, key := range keys.CryptKeys {
			if recentKey == nil || key.KeyGeneration > recentKey.KeyGeneration {
				recentKey = &key
			}
		}
	}

	if len(msg.ClientHeader.TlfName) == 0 {
		return nil, libkb.ChatBoxingError{Msg: fmt.Sprintf("blank TLF name received: original: %s canonical: %s", tlfName, msg.ClientHeader.TlfName)}
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
func (b *Boxer) boxMessageWithKeysV1(msg chat1.MessagePlaintext, key *keybase1.CryptKey,
	signingKeyPair libkb.NaclSigningKeyPair) (*chat1.MessageBoxed, error) {

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
func (b *Boxer) verifyMessage(ctx context.Context, header chat1.HeaderPlaintext, msg chat1.MessageBoxed, skipBodyVerification bool) libkb.ChatUnboxingError {
	headerVersion, err := header.Version()
	if err != nil {
		return libkb.NewPermanentChatUnboxingError(err)
	}

	switch headerVersion {
	case chat1.HeaderPlaintextVersion_V1:
		return b.verifyMessageHeaderV1(ctx, header.V1(), msg, skipBodyVerification)
	default:
		return libkb.NewPermanentChatUnboxingError(libkb.NewChatHeaderVersionError(headerVersion))
	}
}

// verifyMessageHeaderV1 checks the body hash, header signature, and signing key validity.
func (b *Boxer) verifyMessageHeaderV1(ctx context.Context, header chat1.HeaderPlaintextV1, msg chat1.MessageBoxed, skipBodyVerification bool) libkb.ChatUnboxingError {
	if !skipBodyVerification {
		// check body hash
		bh := b.hashV1(msg.BodyCiphertext.E)
		if !libkb.SecureByteArrayEq(bh[:], header.BodyHash) {
			return libkb.NewPermanentChatUnboxingError(libkb.ChatBodyHashInvalid{})
		}
	}

	// check signature
	hcopy := header
	hcopy.HeaderSignature = nil
	hpack, err := b.marshal(hcopy)
	if err != nil {
		return libkb.NewPermanentChatUnboxingError(err)
	}
	if !b.verify(hpack, *header.HeaderSignature, libkb.SignaturePrefixChat) {
		return libkb.NewPermanentChatUnboxingError(libkb.BadSigError{E: "header signature invalid"})
	}

	// check key validity
	valid, ierr := b.validSenderKey(ctx, header.Sender, header.HeaderSignature.K, msg.ServerHeader.Ctime)
	if ierr != nil {
		return ierr
	}
	if !valid {
		return libkb.NewPermanentChatUnboxingError(errors.New("key invalid for sender at message ctime"))
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
func (b *Boxer) validSenderKey(ctx context.Context, sender gregor1.UID, key []byte, ctime gregor1.Time) (bool, libkb.ChatUnboxingError) {
	kbSender, err := keybase1.UIDFromString(hex.EncodeToString(sender.Bytes()))
	if err != nil {
		return false, libkb.NewPermanentChatUnboxingError(err)
	}
	kid := keybase1.KIDFromSlice(key)
	t := gregor1.FromTime(ctime)

	var uimap *utils.UserInfoMapper
	ctx, uimap = utils.GetUserInfoMapper(ctx, b.kbCtx)
	user, err := uimap.User(kbSender)
	if err != nil {
		return false, libkb.NewTransientChatUnboxingError(err)
	}
	ckf := user.GetComputedKeyFamily()
	if ckf == nil {
		return false, libkb.NewPermanentChatUnboxingError(errors.New("no computed key family"))
	}
	activeKey, _, err := ckf.FindActiveSibkeyAtTime(kid, t)
	if err != nil {
		return false, libkb.NewPermanentChatUnboxingError(err)
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
