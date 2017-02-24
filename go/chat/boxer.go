// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package chat

import (
	"bytes"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"flag"
	"fmt"
	"time"

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
	utils.DebugLabeler
	libkb.Contextified

	tlf func() keybase1.TlfInterface

	// Replaceable for testing.
	// Normally set to normal implementations.
	hashV1 func(data []byte) chat1.Hash
	sign   func(msg []byte, kp libkb.NaclSigningKeyPair, prefix libkb.SignaturePrefix) (chat1.SignatureInfo, error) // replaceable for testing

	// Slots for replacing with with test implementations.
	// These are normally nil.
	testingValidSenderKey     func(context.Context, gregor1.UID, []byte, gregor1.Time) (found, validAtCTime bool, revoked *gregor1.Time, unboxingErr UnboxingError)
	testingGetSenderInfoLocal func(context.Context, gregor1.UID, gregor1.DeviceID) (senderUsername string, senderDeviceName string, senderDeviceType string)
}

func NewBoxer(g *libkb.GlobalContext, tlf func() keybase1.TlfInterface) *Boxer {
	return &Boxer{
		DebugLabeler: utils.NewDebugLabeler(g, "Boxer", false),
		tlf:          tlf,
		hashV1:       hashSha256V1,
		sign:         sign,
		Contextified: libkb.NewContextified(g),
	}
}

func (b *Boxer) log() logger.Logger {
	return b.G().GetLog()
}

func (b *Boxer) makeErrorMessage(msg chat1.MessageBoxed, err UnboxingError) chat1.MessageUnboxed {
	return chat1.NewMessageUnboxedWithError(chat1.MessageUnboxedError{
		ErrType:     err.ExportType(),
		ErrMsg:      err.Error(),
		MessageID:   msg.GetMessageID(),
		MessageType: msg.GetMessageType(),
		Ctime:       msg.ServerHeader.Ctime,
	})
}

// UnboxMessage unboxes a chat1.MessageBoxed into a keybase1.Message.  It finds
// the appropriate keybase1.CryptKey.
// The first return value is unusable if the err != nil
// Returns (_, err) for non-permanent errors, and (MessageUnboxedError, nil) for permanent errors.
// Permanent errors can be cached and must be treated as a value to deal with.
// Whereas temporary errors are transient failures.
func (b *Boxer) UnboxMessage(ctx context.Context, boxed chat1.MessageBoxed, finalizeInfo *chat1.ConversationFinalizeInfo) (chat1.MessageUnboxed, UnboxingError) {
	tlfName := boxed.ClientHeader.TLFNameExpanded(finalizeInfo)
	tlfPublic := boxed.ClientHeader.TlfPublic
	keys, err := CtxKeyFinder(ctx).Find(ctx, b.tlf(), tlfName, tlfPublic)
	if err != nil {
		// transient error. Rekey errors come through here
		return chat1.MessageUnboxed{}, NewTransientUnboxingError(err)
	}

	var encryptionKey *keybase1.CryptKey
	for _, key := range keys.CryptKeys {
		if key.KeyGeneration == boxed.KeyGeneration {
			encryptionKey = &key
			break
		}
	}

	if encryptionKey == nil {
		err := fmt.Errorf("no key found for generation %d", boxed.KeyGeneration)
		return chat1.MessageUnboxed{}, NewTransientUnboxingError(err)
	}

	unboxed, ierr := b.unbox(ctx, boxed, encryptionKey)
	if ierr != nil {
		b.Debug(ctx, "failed to unbox message: msgID: %d err: %s", boxed.ServerHeader.MessageID,
			ierr.Error())
		if ierr.IsPermanent() {
			return b.makeErrorMessage(boxed, ierr), nil
		}
		return chat1.MessageUnboxed{}, ierr
	}
	return chat1.NewMessageUnboxedWithValid(*unboxed), nil
}

func (b *Boxer) unbox(ctx context.Context, boxed chat1.MessageBoxed, encryptionKey *keybase1.CryptKey) (*chat1.MessageUnboxedValid, UnboxingError) {
	switch boxed.Version {
	case chat1.MessageBoxedVersion_VNONE, chat1.MessageBoxedVersion_V1:
		return b.unboxV1(ctx, boxed, encryptionKey)
	case chat1.MessageBoxedVersion_V2:
		return b.unboxV2(ctx, boxed, encryptionKey)
	default:
		return nil,
			NewPermanentUnboxingError(NewMessageBoxedVersionError(boxed.Version))
	}
}

func (b *Boxer) headerUnsupported(ctx context.Context, headerVersion chat1.HeaderPlaintextVersion,
	header chat1.HeaderPlaintext) chat1.HeaderPlaintextUnsupported {
	switch headerVersion {
	case chat1.HeaderPlaintextVersion_V2:
		return header.V2()
	case chat1.HeaderPlaintextVersion_V3:
		return header.V3()
	case chat1.HeaderPlaintextVersion_V4:
		return header.V4()
	case chat1.HeaderPlaintextVersion_V5:
		return header.V5()
	case chat1.HeaderPlaintextVersion_V6:
		return header.V6()
	case chat1.HeaderPlaintextVersion_V7:
		return header.V7()
	case chat1.HeaderPlaintextVersion_V8:
		return header.V8()
	case chat1.HeaderPlaintextVersion_V9:
		return header.V9()
	case chat1.HeaderPlaintextVersion_V10:
		return header.V10()
	default:
		b.Debug(ctx, "headerUnsupported: unknown version: %v", headerVersion)
		return chat1.HeaderPlaintextUnsupported{
			Mi: chat1.HeaderPlaintextMetaInfo{
				Crit: true,
			},
		}
	}
}

func (b *Boxer) bodyUnsupported(ctx context.Context, bodyVersion chat1.BodyPlaintextVersion,
	body chat1.BodyPlaintext) chat1.BodyPlaintextUnsupported {
	switch bodyVersion {
	case chat1.BodyPlaintextVersion_V2:
		return body.V2()
	case chat1.BodyPlaintextVersion_V3:
		return body.V3()
	case chat1.BodyPlaintextVersion_V4:
		return body.V4()
	case chat1.BodyPlaintextVersion_V5:
		return body.V5()
	case chat1.BodyPlaintextVersion_V6:
		return body.V6()
	case chat1.BodyPlaintextVersion_V7:
		return body.V7()
	case chat1.BodyPlaintextVersion_V8:
		return body.V8()
	case chat1.BodyPlaintextVersion_V9:
		return body.V9()
	case chat1.BodyPlaintextVersion_V10:
		return body.V10()
	default:
		b.Debug(ctx, "bodyUnsupported: unknown version: %v", bodyVersion)
		return chat1.BodyPlaintextUnsupported{
			Mi: chat1.BodyPlaintextMetaInfo{
				Crit: true,
			},
		}
	}
}

// unboxV1 unboxes a chat1.MessageBoxed into a keybase1.Message given
// a keybase1.CryptKey.
func (b *Boxer) unboxV1(ctx context.Context, boxed chat1.MessageBoxed, encryptionKey *keybase1.CryptKey) (*chat1.MessageUnboxedValid, UnboxingError) {
	var err error
	if boxed.ServerHeader == nil {
		return nil, NewPermanentUnboxingError(errors.New("nil ServerHeader in MessageBoxed"))
	}

	// compute the header hash
	headerHash := b.hashV1(boxed.HeaderCiphertext.E)

	// decrypt body
	// will remain empty if the body was deleted
	var bodyVersioned chat1.BodyPlaintext
	skipBodyVerification := false
	if len(boxed.BodyCiphertext.E) == 0 {
		if boxed.ServerHeader.SupersededBy == 0 {
			return nil, NewPermanentUnboxingError(errors.New("empty body and not superseded in MessageBoxed"))
		}
		skipBodyVerification = true
	} else {
		packedBody, err := b.open(boxed.BodyCiphertext, encryptionKey)
		if err != nil {
			return nil, NewPermanentUnboxingError(err)
		}
		if err := b.unmarshal(packedBody, &bodyVersioned); err != nil {
			return nil, NewPermanentUnboxingError(err)
		}
	}

	// decrypt header
	packedHeader, err := b.open(boxed.HeaderCiphertext, encryptionKey)
	if err != nil {
		return nil, NewPermanentUnboxingError(err)
	}
	var header chat1.HeaderPlaintext
	if err := b.unmarshal(packedHeader, &header); err != nil {
		return nil, NewPermanentUnboxingError(err)
	}

	// verify the message
	validity, ierr := b.verifyMessageV1(ctx, header, boxed, skipBodyVerification)
	if ierr != nil {
		return nil, ierr
	}

	// create a chat1.MessageClientHeader from versioned HeaderPlaintext
	var clientHeader chat1.MessageClientHeader
	headerVersion, err := header.Version()
	if err != nil {
		return nil, NewPermanentUnboxingError(err)
	}

	var headerSignature *chat1.SignatureInfo
	switch headerVersion {
	case chat1.HeaderPlaintextVersion_V1:
		headerSignature = header.V1().HeaderSignature
		hp := header.V1()
		clientHeader = chat1.MessageClientHeader{
			Conv:         hp.Conv,
			TlfName:      hp.TlfName,
			TlfPublic:    hp.TlfPublic,
			MessageType:  hp.MessageType,
			Prev:         hp.Prev,
			Sender:       hp.Sender,
			SenderDevice: hp.SenderDevice,
			OutboxInfo:   hp.OutboxInfo,
			OutboxID:     hp.OutboxID,
		}
	default:
		return nil,
			NewPermanentUnboxingError(NewHeaderVersionError(headerVersion,
				b.headerUnsupported(ctx, headerVersion, header)))
	}

	// Check for sender match on the inner and outer header.
	if !clientHeader.Sender.Eq(boxed.ClientHeader.Sender) {
		return nil, NewPermanentUnboxingError(fmt.Errorf("sender does not match"))
	}
	if !bytes.Equal(clientHeader.SenderDevice.Bytes(), boxed.ClientHeader.SenderDevice.Bytes()) {
		return nil, NewPermanentUnboxingError(fmt.Errorf("sender device does not match"))
	}

	// Any of (senderUsername, senderDeviceName, senderDeviceType) could be empty strings because of non-critical failures.
	senderUsername, senderDeviceName, senderDeviceType := b.getSenderInfoLocal(
		ctx, clientHeader.Sender, clientHeader.SenderDevice)

	// create a chat1.MessageBody from versioned chat1.BodyPlaintext
	// Will remain empty if the body was deleted.
	var body chat1.MessageBody
	if !skipBodyVerification {
		bodyVersion, err := bodyVersioned.Version()
		if err != nil {
			return nil, NewPermanentUnboxingError(err)
		}
		switch bodyVersion {
		case chat1.BodyPlaintextVersion_V1:
			body = bodyVersioned.V1().MessageBody
		default:
			return nil,
				NewPermanentUnboxingError(NewBodyVersionError(bodyVersion,
					b.bodyUnsupported(ctx, bodyVersion, bodyVersioned)))
		}
	}

	// create an unboxed message
	return &chat1.MessageUnboxedValid{
		ClientHeader:          clientHeader,
		ServerHeader:          *boxed.ServerHeader,
		MessageBody:           body,
		SenderUsername:        senderUsername,
		SenderDeviceName:      senderDeviceName,
		SenderDeviceType:      senderDeviceType,
		HeaderHash:            headerHash,
		HeaderSignature:       headerSignature,
		VerificationKey:       nil,
		SenderDeviceRevokedAt: validity.senderDeviceRevokedAt,
	}, nil
}

func (b *Boxer) unboxV2(ctx context.Context, msg chat1.MessageBoxed, encryptionKey *keybase1.CryptKey) (*chat1.MessageUnboxedValid, UnboxingError) {
	return nil, NewTransientUnboxingError(fmt.Errorf("unboxV2 not implemented"))
}

// unboxThread transforms a chat1.ThreadViewBoxed to a keybase1.ThreadView.
func (b *Boxer) UnboxThread(ctx context.Context, boxed chat1.ThreadViewBoxed, convID chat1.ConversationID, finalizeInfo *chat1.ConversationFinalizeInfo) (thread chat1.ThreadView, err error) {

	thread = chat1.ThreadView{
		Pagination: boxed.Pagination,
	}

	if thread.Messages, err = b.UnboxMessages(ctx, boxed.Messages, finalizeInfo); err != nil {
		return chat1.ThreadView{}, err
	}

	return thread, nil
}

func (b *Boxer) getUsernameAndDevice(ctx context.Context, uid keybase1.UID, deviceID keybase1.DeviceID) (string, string, string, error) {
	nun, devName, devType, err := b.G().GetUPAKLoader().LookupUsernameAndDevice(ctx, uid, deviceID)
	if err != nil {
		return "", "", "", err
	}
	return nun.String(), devName, devType, nil
}

func (b *Boxer) getUsername(ctx context.Context, uid keybase1.UID) (string, error) {
	name, err := b.G().GetUPAKLoader().LookupUsername(ctx, uid)
	if err != nil {
		return "", err
	}
	return name.String(), nil
}

// Any of (senderUsername, senderDeviceName, senderDeviceType) could be empty strings because of non-critical failures.
// This first tries to username and device info, falling back to just username, falling back to empty strings.
// The reason for this soft error handling is that a permanent failure would be inappropriate, a transient
// failure could cause an entire thread not to load, and loading the names of revoked devices may not work this way.
// This deserves to be reconsidered.
func (b *Boxer) getSenderInfoLocal(ctx context.Context, uid1 gregor1.UID, deviceID1 gregor1.DeviceID) (senderUsername string, senderDeviceName string, senderDeviceType string) {
	if b.testingGetSenderInfoLocal != nil {
		b.log().Warning("Using TESTING jig. Not suitable for normal use.")
		if flag.Lookup("test.v") == nil {
			panic("testing jig installed in normal mode")
		}
		return b.testingGetSenderInfoLocal(ctx, uid1, deviceID1)
	}

	uid := keybase1.UID(uid1.String())
	did := keybase1.DeviceID(deviceID1.String())

	username, deviceName, deviceType, err := b.getUsernameAndDevice(ctx, uid, did)
	if err != nil {
		b.Debug(ctx, "unable to fetch sender and device informaton: UID: %s deviceID: %s",
			uid1, deviceID1)
		// try to just get username
		username, err = b.getUsername(ctx, uid)
		if err != nil {
			b.Debug(ctx, "failed to fetch sender username after initial error: err: %s", err.Error())
		}
	}
	return username, deviceName, deviceType
}

func (b *Boxer) UnboxMessages(ctx context.Context, boxed []chat1.MessageBoxed, finalizeInfo *chat1.ConversationFinalizeInfo) (unboxed []chat1.MessageUnboxed, err error) {
	for _, msg := range boxed {
		decmsg, err := b.UnboxMessage(ctx, msg, finalizeInfo)
		if err != nil {
			return unboxed, err
		}
		unboxed = append(unboxed, decmsg)
	}

	return unboxed, nil
}

// Can return (nil, nil) if there is no saved merkle root.
func (b *Boxer) latestMerkleRoot() (*chat1.MerkleRoot, error) {
	merkleClient := b.G().GetMerkleClient()
	if merkleClient == nil {
		return nil, fmt.Errorf("no MerkleClient available")
	}
	merkleRoot, err := merkleClient.LastRootInfo()
	if err != nil {
		return nil, err
	}
	if merkleRoot == nil {
		b.log().Debug("No merkle root available for chat header")
	}
	return merkleRoot, nil
}

// boxMessage encrypts a keybase1.MessagePlaintext into a chat1.MessageBoxed.  It
// finds the most recent key for the TLF.
func (b *Boxer) BoxMessage(ctx context.Context, msg chat1.MessagePlaintext, signingKeyPair libkb.NaclSigningKeyPair) (*chat1.MessageBoxed, error) {
	tlfName := msg.ClientHeader.TlfName
	var encryptionKey *keybase1.CryptKey

	if len(tlfName) == 0 {
		return nil, NewBoxingError("blank TLF name given", true)
	}

	cres, err := CtxKeyFinder(ctx).Find(ctx, b.tlf(), tlfName, msg.ClientHeader.TlfPublic)
	if err != nil {
		return nil, NewBoxingCryptKeysError(err)
	}
	msg.ClientHeader.TlfName = string(cres.NameIDBreaks.CanonicalName)
	if msg.ClientHeader.TlfPublic {
		encryptionKey = &publicCryptKey
	} else {
		for _, key := range cres.CryptKeys {
			if encryptionKey == nil || key.KeyGeneration > encryptionKey.KeyGeneration {
				encryptionKey = &key
			}
		}
	}

	if encryptionKey == nil {
		msg := fmt.Sprintf("no key found for tlf %q (public: %v)", tlfName, msg.ClientHeader.TlfPublic)
		return nil, NewBoxingError(msg, false)
	}

	merkleRoot, err := b.latestMerkleRoot()
	if err != nil {
		return nil, NewBoxingError(err.Error(), false)
	}
	msg.ClientHeader.MerkleRoot = merkleRoot

	if len(msg.ClientHeader.TlfName) == 0 {
		msg := fmt.Sprintf("blank TLF name received: original: %s canonical: %s", tlfName,
			msg.ClientHeader.TlfName)
		return nil, NewBoxingError(msg, true)
	}

	boxed, err := b.box(msg, encryptionKey, signingKeyPair, chat1.MessageBoxedVersion_V1)
	if err != nil {
		return nil, NewBoxingError(err.Error(), true)
	}

	return boxed, nil
}

func (b *Boxer) box(messagePlaintext chat1.MessagePlaintext, encryptionKey *keybase1.CryptKey,
	signingKeyPair libkb.NaclSigningKeyPair, version chat1.MessageBoxedVersion) (*chat1.MessageBoxed, error) {
	switch version {
	case chat1.MessageBoxedVersion_V1:
		return b.boxV1(messagePlaintext, encryptionKey, signingKeyPair)
	case chat1.MessageBoxedVersion_V2:
		return b.boxV2(messagePlaintext, encryptionKey, signingKeyPair)
	default:
		return nil, fmt.Errorf("invalid version for boxing: %v", version)
	}
}

// boxMessageWithKeys encrypts and signs a keybase1.MessagePlaintext into a
// chat1.MessageBoxed given a keybase1.CryptKey.
func (b *Boxer) boxV1(messagePlaintext chat1.MessagePlaintext, key *keybase1.CryptKey,
	signingKeyPair libkb.NaclSigningKeyPair) (*chat1.MessageBoxed, error) {

	body := chat1.BodyPlaintextV1{
		MessageBody: messagePlaintext.MessageBody,
	}
	plaintextBody := chat1.NewBodyPlaintextWithV1(body)
	encryptedBody, err := b.seal(plaintextBody, key)
	if err != nil {
		return nil, err
	}

	bodyHash := b.hashV1(encryptedBody.E)

	// create the v1 header, adding hash
	header := chat1.HeaderPlaintextV1{
		Conv:         messagePlaintext.ClientHeader.Conv,
		TlfName:      messagePlaintext.ClientHeader.TlfName,
		TlfPublic:    messagePlaintext.ClientHeader.TlfPublic,
		MessageType:  messagePlaintext.ClientHeader.MessageType,
		Prev:         messagePlaintext.ClientHeader.Prev,
		Sender:       messagePlaintext.ClientHeader.Sender,
		SenderDevice: messagePlaintext.ClientHeader.SenderDevice,
		BodyHash:     bodyHash[:],
		OutboxInfo:   messagePlaintext.ClientHeader.OutboxInfo,
		OutboxID:     messagePlaintext.ClientHeader.OutboxID,
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
		ClientHeader:     messagePlaintext.ClientHeader,
		BodyCiphertext:   *encryptedBody,
		HeaderCiphertext: *encryptedHeader,
		KeyGeneration:    key.KeyGeneration,
	}

	return boxed, nil
}

func (b *Boxer) boxV2(messagePlaintext chat1.MessagePlaintext, key *keybase1.CryptKey,
	signingKeyPair libkb.NaclSigningKeyPair) (*chat1.MessageBoxed, error) {
	return nil, fmt.Errorf("boxV2 not implemented")
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

type verifyMessageRes struct {
	senderDeviceRevokedAt *gregor1.Time
}

// verifyMessage checks that a message is valid.
// Only works on MessageBoxedVersion_V1
func (b *Boxer) verifyMessageV1(ctx context.Context, header chat1.HeaderPlaintext, msg chat1.MessageBoxed, skipBodyVerification bool) (verifyMessageRes, UnboxingError) {
	headerVersion, err := header.Version()
	if err != nil {
		return verifyMessageRes{}, NewPermanentUnboxingError(err)
	}

	switch headerVersion {
	case chat1.HeaderPlaintextVersion_V1:
		return b.verifyMessageHeaderV1(ctx, header.V1(), msg, skipBodyVerification)
	default:
		return verifyMessageRes{},
			NewPermanentUnboxingError(NewHeaderVersionError(headerVersion,
				b.headerUnsupported(ctx, headerVersion, header)))
	}
}

// verifyMessageHeaderV1 checks the body hash, header signature, and signing key validity.
func (b *Boxer) verifyMessageHeaderV1(ctx context.Context, header chat1.HeaderPlaintextV1, msg chat1.MessageBoxed, skipBodyVerification bool) (verifyMessageRes, UnboxingError) {
	if !skipBodyVerification {
		// check body hash
		bh := b.hashV1(msg.BodyCiphertext.E)
		if !libkb.SecureByteArrayEq(bh[:], header.BodyHash) {
			return verifyMessageRes{}, NewPermanentUnboxingError(BodyHashInvalid{})
		}
	}

	// check key validity
	found, validAtCtime, revoked, ierr := b.ValidSenderKey(ctx, header.Sender, header.HeaderSignature.K, msg.ServerHeader.Ctime)
	if ierr != nil {
		return verifyMessageRes{}, ierr
	}
	if !found {
		return verifyMessageRes{}, NewPermanentUnboxingError(libkb.NoKeyError{Msg: "sender key not found"})
	}
	if !validAtCtime {
		return verifyMessageRes{}, NewPermanentUnboxingError(libkb.NoKeyError{Msg: "key invalid for sender at message ctime"})
	}

	// check signature
	hcopy := header
	hcopy.HeaderSignature = nil
	hpack, err := b.marshal(hcopy)
	if err != nil {
		return verifyMessageRes{}, NewPermanentUnboxingError(err)
	}
	if !b.verify(hpack, *header.HeaderSignature, libkb.SignaturePrefixChat) {
		return verifyMessageRes{}, NewPermanentUnboxingError(libkb.BadSigError{E: "header signature invalid"})
	}

	return verifyMessageRes{
		senderDeviceRevokedAt: revoked,
	}, nil
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

// ValidSenderKey checks that the key was active for sender at ctime.
// This trusts the server for ctime, so a colluding server could use a revoked key and this check wouldn't notice.
// Returns (validAtCtime, revoked, err)
func (b *Boxer) ValidSenderKey(ctx context.Context, sender gregor1.UID, key []byte, ctime gregor1.Time) (found, validAtCTime bool, revoked *gregor1.Time, unboxErr UnboxingError) {
	if b.testingValidSenderKey != nil {
		b.log().Warning("Using TESTING jig. Not suitable for normal use.")
		if flag.Lookup("test.v") == nil {
			panic("testing jig installed in normal mode")
		}
		return b.testingValidSenderKey(ctx, sender, key, ctime)
	}

	kbSender, err := keybase1.UIDFromString(hex.EncodeToString(sender.Bytes()))
	if err != nil {
		return false, false, nil, NewPermanentUnboxingError(err)
	}
	kid := keybase1.KIDFromSlice(key)
	ctime2 := gregor1.FromTime(ctime)

	cachedUserLoader := b.G().GetUPAKLoader()
	if cachedUserLoader == nil {
		return false, false, nil, NewTransientUnboxingError(fmt.Errorf("no CachedUserLoader available in context"))
	}

	found, revokedAt, deleted, err := cachedUserLoader.CheckKIDForUID(ctx, kbSender, kid)
	if err != nil {
		return false, false, nil, NewTransientUnboxingError(err)
	}
	if !found {
		return false, false, nil, nil
	}

	if deleted {
		b.Debug(ctx, "sender %s key %s was deleted", kbSender, kid)
		// Set the key as being revoked since the beginning of time, so all messages will get labeled
		// as suspect
		zeroTime := gregor1.Time(0)
		return true, true, &zeroTime, nil
	}

	validAtCtime := true
	if revokedAt != nil {
		if revokedAt.Unix.IsZero() {
			return true, false, nil, NewPermanentUnboxingError(fmt.Errorf("zero clock time on expired key"))
		}
		t := b.keybase1KeybaseTimeToTime(*revokedAt)
		revokedTime := gregor1.ToTime(t)
		revoked = &revokedTime
		validAtCtime = t.After(ctime2)
	}

	return true, validAtCtime, revoked, nil
}

func (b *Boxer) keybase1KeybaseTimeToTime(t1 keybase1.KeybaseTime) time.Time {
	// u is in milliseconds
	u := int64(t1.Unix)
	t2 := time.Unix(u/1e3, (u%1e3)*1e6)
	return t2
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
