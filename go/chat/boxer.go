// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package chat

import (
	"bytes"
	"crypto/rand"
	"crypto/sha256"
	"encoding/binary"
	"encoding/hex"
	"errors"
	"flag"
	"fmt"
	"time"

	"golang.org/x/crypto/nacl/secretbox"
	"golang.org/x/net/context"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/signencrypt"
	"github.com/keybase/client/go/chat/storage"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-codec/codec"
	"github.com/keybase/go-crypto/ed25519"
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
	globals.Contextified

	boxWithVersion chat1.MessageBoxedVersion

	// TLF info source
	tlfInfoSource types.TLFInfoSource

	// Replaceable for testing.
	// Normally set to normal implementations.
	hashV1 func(data []byte) chat1.Hash

	// Slots for replacing with with test implementations.
	// These are normally nil.
	testingValidSenderKey     func(context.Context, gregor1.UID, []byte, gregor1.Time) (found, validAtCTime bool, revoked *gregor1.Time, unboxingErr UnboxingError)
	testingGetSenderInfoLocal func(context.Context, gregor1.UID, gregor1.DeviceID) (senderUsername string, senderDeviceName string, senderDeviceType string)
	// Post-process signatures and signencrypts
	testingSignatureMangle func([]byte) []byte
}

func NewBoxer(g *globals.Context, tlfInfoSource types.TLFInfoSource) *Boxer {
	return &Boxer{
		DebugLabeler:   utils.NewDebugLabeler(g, "Boxer", false),
		boxWithVersion: chat1.MessageBoxedVersion_V1,
		hashV1:         hashSha256V1,
		Contextified:   globals.NewContextified(g),
		tlfInfoSource:  tlfInfoSource,
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

func (b *Boxer) detectKBFSPermanentServerError(err error) bool {
	// Banned folders are only detectable by the error string currently, hopefully
	// we can do something better in the future.
	if err.Error() == "Operations for this folder are temporarily throttled (error 2800)" {
		return true
	}
	return false
}

// UnboxMessage unboxes a chat1.MessageBoxed into a chat1.MessageUnboxed. It
// finds the appropriate keybase1.CryptKey, decrypts the message, and verifies
// several things:
//   - The message's signature is valid.
//   - (TODO) The signing KID was valid when the signature was made.
//   - (TODO) The signing KID belongs to the sending device.
//   - (TODO) The sending device belongs to the sender.
//     [Note that we do currently check the KID -> UID relationship,
//     independent of the device ID.]
//   - (TODO) The sender has write permission in the TLF.
//   - (TODO) The TLF name, public flag, and finalized info resolve to the TLF ID.
//   - The conversation ID derives from the ConversationIDTriple.
//   - The body hash is not a replay from another message we know about.
//   - The prev pointers are consistent with other messages we know about.
//   - (TODO) The prev pointers are not absurdly ancient.
//   - The ClientHeader provided with the BoxedMessage matches the one we decrypt.
//
// The first return value is unusable if the err != nil. Returns (_, err) for
// non-permanent errors, and (MessageUnboxedError, nil) for permanent errors.
// Permanent errors can be cached and must be treated as a value to deal with,
// whereas temporary errors are transient failures.
func (b *Boxer) UnboxMessage(ctx context.Context, boxed chat1.MessageBoxed, convID chat1.ConversationID, finalizeInfo *chat1.ConversationFinalizeInfo) (chat1.MessageUnboxed, UnboxingError) {
	tlfName := boxed.ClientHeader.TLFNameExpanded(finalizeInfo)
	tlfPublic := boxed.ClientHeader.TlfPublic
	keys, err := CtxKeyFinder(ctx).Find(ctx, b.tlfInfoSource, tlfName, tlfPublic)
	if err != nil {
		// Check to see if this is a permanent error from the server
		if b.detectKBFSPermanentServerError(err) {
			return chat1.MessageUnboxed{}, NewPermanentUnboxingError(err)
		}
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
	if ierr == nil {
		ierr = b.checkInvariants(ctx, convID, boxed, unboxed)
	}
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

func (b *Boxer) checkInvariants(ctx context.Context, convID chat1.ConversationID, boxed chat1.MessageBoxed, unboxed *chat1.MessageUnboxedValid) UnboxingError {
	// Check that the ConversationIDTriple in the signed message header matches
	// the conversation ID we were expecting.
	if !unboxed.ClientHeader.Conv.Derivable(convID) {
		err := fmt.Errorf("conversation ID mismatch")
		return NewPermanentUnboxingError(err)
	}

	// Make sure the body hash is unique to this message, and then record it.
	// This detects attempts by the server to replay a message. Right now we
	// use a "first writer wins" rule here, though we could also consider a
	// "duplication invalidates both" rule if we wanted to be stricter. Note
	// that this only prevents replays of messages you *know about*. There's
	// currently nothing stopping the server from replaying an ancient message
	// if you're never going to fetch enough history to notice.
	//
	// But...wait...why aren't we using the header hash here? It covers more
	// stuff, and we're using it below, when we check the consistency of
	// messages and prev pointers...
	//
	// The reason we can't use the header hash to prevent replays is that it's
	// a hash *of* a signature, rather than a hash that's *been signed*.
	// Unfortunately, most signature schemes are "malleable" in some way,
	// depending on the implementation. See
	// http://crypto.stackexchange.com/a/14719/21442. If I have the shared
	// encryption key (and recall that in public chats, everyone does), I can
	// decrypt the message, twiddle your signature into another valid signature
	// over the same plaintext, reencrypt the whole thing, and pass it off as a
	// new valid message with a seemingly new signature and therefore a unique
	// header hash. Because the body hash is unique to each message (derived
	// from a random nonce), and because it's *inside* the signature, we use
	// that to detect replays instead.
	replayErr := storage.CheckAndRecordBodyHash(b.G(), unboxed.BodyHash, boxed.ServerHeader.MessageID, convID)
	if replayErr != nil {
		b.Debug(ctx, "UnboxMessage found a replayed body hash: %s", replayErr)
		return NewPermanentUnboxingError(replayErr)
	}

	// Make sure the header hash and prev pointers of this message are
	// consistent with every other message we've seen, and record them.
	//
	// The discussion above explains why we have to use the body hash there to
	// prevent replays. But we need to use the header hash here, because it's
	// the only thing that covers the entire message. The goal isn't to prevent
	// the creation of new messages (as it was above), but to prevent an old
	// message from changing.
	prevPtrErr := storage.CheckAndRecordPrevPointer(b.G(), boxed.ServerHeader.MessageID, convID, unboxed.HeaderHash)
	if prevPtrErr != nil {
		b.Debug(ctx, "UnboxMessage found an inconsistent header hash: %s", prevPtrErr)
		return NewPermanentUnboxingError(prevPtrErr)
	}
	for _, prevPtr := range unboxed.ClientHeader.Prev {
		prevPtrErr := storage.CheckAndRecordPrevPointer(b.G(), prevPtr.Id, convID, prevPtr.Hash)
		if prevPtrErr != nil {
			b.Debug(ctx, "UnboxMessage found an inconsistent prev pointer: %s", prevPtrErr)
			return NewPermanentUnboxingError(prevPtrErr)
		}
	}

	return nil
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

	if len(boxed.VerifyKey) != 0 {
		return nil, NewPermanentUnboxingError(errors.New("populated VerifyKey in MBV1"))
	}

	// compute the header hash
	headerHash := b.hashV1(boxed.HeaderCiphertext.E)

	// Whether the body is missing (deleted)
	skipBodyVerification := (len(boxed.BodyCiphertext.E) == 0)

	// TODO We should check whether the body is allowed to have been deleted by checking
	// the there is in fact a message that deleted it.
	// We should fetch that message and check its signed body.
	// That involves fetching a message whose ID is not known here.

	// decrypt body
	// will remain empty if the body was deleted
	var bodyVersioned chat1.BodyPlaintext
	if !skipBodyVerification {
		packedBody, err := b.open(boxed.BodyCiphertext, libkb.NaclSecretBoxKey(encryptionKey.Key))
		if err != nil {
			return nil, NewPermanentUnboxingError(err)
		}
		if err := b.unmarshal(packedBody, &bodyVersioned); err != nil {
			return nil, NewPermanentUnboxingError(err)
		}
	}

	// decrypt header
	packedHeader, err := b.open(boxed.HeaderCiphertext.AsEncrypted(), libkb.NaclSecretBoxKey(encryptionKey.Key))
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
	var clientHeader chat1.MessageClientHeaderVerified
	headerVersion, err := header.Version()
	if err != nil {
		return nil, NewPermanentUnboxingError(err)
	}

	var headerSignature *chat1.SignatureInfo
	var bodyHash chat1.Hash
	switch headerVersion {
	case chat1.HeaderPlaintextVersion_V1:
		// Verified above in verifyMessageV1
		headerSignature = header.V1().HeaderSignature
		hp := header.V1()
		bodyHash = hp.BodyHash
		clientHeader = chat1.MessageClientHeaderVerified{
			Conv:         hp.Conv,
			TlfName:      hp.TlfName,
			TlfPublic:    hp.TlfPublic,
			MessageType:  hp.MessageType,
			Prev:         hp.Prev,
			Sender:       hp.Sender,
			SenderDevice: hp.SenderDevice,
			// CORE-4540: MerkleRoot will be in signed header, but probably not in any V1 messages.
			OutboxID:   hp.OutboxID,
			OutboxInfo: hp.OutboxInfo,
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

	ierr = b.compareHeadersV1(ctx, boxed.ClientHeader, clientHeader)
	if ierr != nil {
		return nil, ierr
	}

	// create an unboxed message
	return &chat1.MessageUnboxedValid{
		ClientHeader:          clientHeader,
		ServerHeader:          *boxed.ServerHeader,
		MessageBody:           body,
		SenderUsername:        senderUsername,
		SenderDeviceName:      senderDeviceName,
		SenderDeviceType:      senderDeviceType,
		BodyHash:              bodyHash,
		HeaderHash:            headerHash,
		HeaderSignature:       headerSignature,
		VerificationKey:       nil,
		SenderDeviceRevokedAt: validity.senderDeviceRevokedAt,
	}, nil
}

func (b *Boxer) unboxV2(ctx context.Context, boxed chat1.MessageBoxed, baseEncryptionKey *keybase1.CryptKey) (*chat1.MessageUnboxedValid, UnboxingError) {
	if boxed.ServerHeader == nil {
		return nil, NewPermanentUnboxingError(errors.New("nil ServerHeader in MessageBoxed"))
	}

	derivedEncryptionKey, err := libkb.DeriveSymmetricKey(
		libkb.NaclSecretBoxKey(baseEncryptionKey.Key), libkb.EncryptionReasonChatMessage)
	if err != nil {
		return nil, NewPermanentUnboxingError(err)
	}

	// Validate verification key against unverified sender id.
	// Later it is asserted that the claimed and signing sender are the same.
	// ValidSenderKey uses the server-given ctime, but emits senderDeviceRevokedAt as a workaround.
	// See ValidSenderKey for details.
	if boxed.VerifyKey == nil {
		return nil, NewPermanentUnboxingError(libkb.NoKeyError{Msg: "sender key missing"})
	}
	senderKeyFound, senderKeyValidAtCtime, senderDeviceRevokedAt, ierr := b.ValidSenderKey(
		ctx, boxed.ClientHeader.Sender, boxed.VerifyKey, boxed.ServerHeader.Ctime)
	if ierr != nil {
		return nil, ierr
	}
	if !senderKeyFound {
		return nil, NewPermanentUnboxingError(libkb.NoKeyError{Msg: "sender key not found"})
	}
	if !senderKeyValidAtCtime {
		return nil, NewPermanentUnboxingError(libkb.NoKeyError{Msg: "key invalid for sender at message ctime"})
	}

	// Open header and verify against VerifyKey
	headerPacked, err := b.signEncryptOpen(boxed.HeaderCiphertext.AsSignEncrypted(), derivedEncryptionKey,
		boxed.VerifyKey, libkb.SignaturePrefixChatMBv2)
	if err != nil {
		return nil, NewPermanentUnboxingError(err)
	}
	var headerVersioned chat1.HeaderPlaintext
	err = b.unmarshal(headerPacked, &headerVersioned)
	if err != nil {
		return nil, NewPermanentUnboxingError(err)
	}

	// Unversion header
	// Also check that the HeaderSignature field from MessageBoxed V1 is nil
	// This object has been signed
	clientHeader, bodyHashSigned, ierr := b.unversionHeader(ctx, headerVersioned)
	if ierr != nil {
		return nil, ierr
	}

	// Whether the body is missing (deleted)
	isBodyDeleted := (len(boxed.BodyCiphertext.E) == 0)

	// TODO We should check whether the body is allowed to have been deleted by checking
	// the there is in fact a message that deleted it.
	// We should fetch that message and check its signed body.
	// That involves fetching a message whose ID is not known here.

	// Verify body hash
	// The hash of the encrypted body must match that signed into the header.
	if !isBodyDeleted {
		ierr = b.verifyBodyHash(ctx, boxed.BodyCiphertext, bodyHashSigned)
		if ierr != nil {
			return nil, ierr
		}
	}

	// Compare the signed and unsigned header.
	// Checks that [Sender, SenderDevice] match, and other things.
	ierr = b.compareHeadersV2(ctx, boxed.ClientHeader, clientHeader)
	if ierr != nil {
		return nil, ierr
	}

	// Decrypt body
	// If the body is deleted, this is left blank.
	var body chat1.MessageBody
	if !isBodyDeleted {
		bodyPacked, err := b.open(boxed.BodyCiphertext, derivedEncryptionKey)
		if err != nil {
			return nil, NewPermanentUnboxingError(err)
		}
		var bodyVersioned chat1.BodyPlaintext
		err = b.unmarshal(bodyPacked, &bodyVersioned)
		if err != nil {
			return nil, NewPermanentUnboxingError(err)
		}

		// Unversion the body
		body, ierr = b.unversionBody(ctx, bodyVersioned)
		if ierr != nil {
			return nil, ierr
		}
	}

	// Compute the header hash
	headerHash, ierr := b.makeHeaderHash(ctx, boxed.HeaderCiphertext.AsSignEncrypted())
	if ierr != nil {
		return nil, ierr
	}

	// Get sender info
	// Any of (senderUsername, senderDeviceName, senderDeviceType) could be empty strings because of non-critical failures.
	senderUsername, senderDeviceName, senderDeviceType := b.getSenderInfoLocal(
		ctx, clientHeader.Sender, clientHeader.SenderDevice)

	// create an unboxed message
	return &chat1.MessageUnboxedValid{
		ClientHeader:          clientHeader,
		ServerHeader:          *boxed.ServerHeader,
		MessageBody:           body,
		SenderUsername:        senderUsername,
		SenderDeviceName:      senderDeviceName,
		SenderDeviceType:      senderDeviceType,
		BodyHash:              bodyHashSigned,
		HeaderHash:            headerHash,
		HeaderSignature:       nil,
		VerificationKey:       &boxed.VerifyKey,
		SenderDeviceRevokedAt: senderDeviceRevokedAt,
	}, nil
}

// Unversions a header.
// Also check that the HeaderSignature field from MessageBoxed V1 is nil.
// Therefore only for use with MessageBoxed V2.
// Returns (header, bodyHash, err)
func (b *Boxer) unversionHeader(ctx context.Context, headerVersioned chat1.HeaderPlaintext) (chat1.MessageClientHeaderVerified, []byte, UnboxingError) {
	headerVersion, err := headerVersioned.Version()
	if err != nil {
		return chat1.MessageClientHeaderVerified{}, nil, NewPermanentUnboxingError(err)
	}
	switch headerVersion {
	case chat1.HeaderPlaintextVersion_V1:
		hp := headerVersioned.V1()
		if hp.HeaderSignature != nil {
			return chat1.MessageClientHeaderVerified{}, nil,
				NewPermanentUnboxingError(fmt.Errorf("HeaderSignature non-nil in MBV2"))
		}
		return chat1.MessageClientHeaderVerified{
			Conv:         hp.Conv,
			TlfName:      hp.TlfName,
			TlfPublic:    hp.TlfPublic,
			MessageType:  hp.MessageType,
			Prev:         hp.Prev,
			Sender:       hp.Sender,
			SenderDevice: hp.SenderDevice,
			// CORE-4540: MerkleRoot will be in signed header.
			OutboxID:   hp.OutboxID,
			OutboxInfo: hp.OutboxInfo,
		}, hp.BodyHash, nil
	default:
		return chat1.MessageClientHeaderVerified{}, nil,
			NewPermanentUnboxingError(NewHeaderVersionError(headerVersion,
				b.headerUnsupported(ctx, headerVersion, headerVersioned)))
	}
}

func (b *Boxer) unversionBody(ctx context.Context, bodyVersioned chat1.BodyPlaintext) (chat1.MessageBody, UnboxingError) {
	bodyVersion, err := bodyVersioned.Version()
	if err != nil {
		return chat1.MessageBody{}, NewPermanentUnboxingError(err)
	}
	switch bodyVersion {
	case chat1.BodyPlaintextVersion_V1:
		return bodyVersioned.V1().MessageBody, nil
	default:
		return chat1.MessageBody{},
			NewPermanentUnboxingError(NewBodyVersionError(bodyVersion,
				b.bodyUnsupported(ctx, bodyVersion, bodyVersioned)))
	}
}

func (b *Boxer) verifyBodyHash(ctx context.Context, bodyEncrypted chat1.EncryptedData, bodyHashSigned []byte) UnboxingError {
	bodyHashObserved, err := b.makeBodyHash(bodyEncrypted)
	if err != nil {
		return err
	}

	if len(bodyHashSigned) == 0 {
		return NewPermanentUnboxingError(BodyHashInvalid{})
	}

	if !libkb.SecureByteArrayEq(bodyHashObserved, bodyHashSigned) {
		return NewPermanentUnboxingError(BodyHashInvalid{})
	}
	return nil
}

// Compare the unsigned and signed header for MessageBoxedVersion_V1.
// The V1 and V2 checks are different methods because they are strict on slightly different things.
// Confirm that fields in the server-supplied ClientHeader match what
// we decrypt. It would be preferable if the server didn't supply this data
// at all (so that we didn't have to worry about anyone trusting it
// *before* we get to this check, for example), but since we have it we
// need to check it.
// The most important check here is that the Sender and SenderDevice match.
// That is the only thing that gives the verification key used credibility.
func (b *Boxer) compareHeadersV2(ctx context.Context, hServer chat1.MessageClientHeader, hSigned chat1.MessageClientHeaderVerified) UnboxingError {
	// Conv
	if !hServer.Conv.Eq(hSigned.Conv) {
		return NewPermanentUnboxingError(NewHeaderMismatchError("Conv"))
	}

	// TlfName
	if hServer.TlfName != hSigned.TlfName {
		return NewPermanentUnboxingError(NewHeaderMismatchError("TlfName"))
	}

	// TlfPublic
	if hServer.TlfPublic != hSigned.TlfPublic {
		return NewPermanentUnboxingError(NewHeaderMismatchError("TlfPublic"))
	}

	// MessageType
	if hServer.MessageType != hSigned.MessageType {
		return NewPermanentUnboxingError(NewHeaderMismatchError("MessageType"))
	}

	// Note: Supersedes and Deletes are not checked because they are not
	//       part of MessageClientHeaderVerified.

	// Prev
	if len(hServer.Prev) != len(hSigned.Prev) {
		return NewPermanentUnboxingError(NewHeaderMismatchError("Prev"))
	}
	for i, a := range hServer.Prev {
		b := hSigned.Prev[i]
		if !a.Eq(b) {
			return NewPermanentUnboxingError(NewHeaderMismatchError("Prev"))
		}
	}

	// Sender
	// This prevents someone from re-using a header for another sender
	if !hServer.Sender.Eq(hSigned.Sender) {
		return NewPermanentUnboxingError(NewHeaderMismatchError("Sender"))
	}

	// SenderDevice
	if !bytes.Equal(hServer.SenderDevice.Bytes(), hSigned.SenderDevice.Bytes()) {
		return NewPermanentUnboxingError(NewHeaderMismatchError("SenderDevice"))
	}

	// MerkleRoot (disabled)
	// CORE-4540: Enable this check.
	//            This check is disabled because MerkleRoot is not yet signed.
	//            Simultaneously with enabling boxing MBV2, it will be added to the signed header.
	//            And will match from then on.
	// if hServer.MerkleRoot.Eq(hSigned.MerkleRoot) {
	// 	return NewPermanentUnboxingError(NewHeaderMismatchError("MerkleRoot"))
	// }

	// OutboxID
	if !hServer.OutboxID.Eq(hSigned.OutboxID) {
		return NewPermanentUnboxingError(NewHeaderMismatchError("OutboxID"))
	}

	// OutboxInfo
	if !hServer.OutboxInfo.Eq(hSigned.OutboxInfo) {
		return NewPermanentUnboxingError(NewHeaderMismatchError("OutboxInfo"))
	}

	return nil
}

func (b *Boxer) makeHeaderHash(ctx context.Context, headerSealed chat1.SignEncryptedData) (chat1.Hash, UnboxingError) {
	buf := bytes.Buffer{}
	err := binary.Write(&buf, binary.BigEndian, int32(headerSealed.V))
	if err != nil {
		return nil, NewPermanentUnboxingError(err)
	}
	_, err = buf.Write(headerSealed.N)
	if err != nil {
		return nil, NewPermanentUnboxingError(err)
	}
	_, err = buf.Write(headerSealed.E)
	if err != nil {
		return nil, NewPermanentUnboxingError(err)
	}
	return b.hashV1(buf.Bytes()), nil
}

func (b *Boxer) makeBodyHash(bodyCiphertext chat1.EncryptedData) (chat1.Hash, UnboxingError) {
	buf := bytes.Buffer{}
	err := binary.Write(&buf, binary.BigEndian, int32(bodyCiphertext.V))
	if err != nil {
		return nil, NewPermanentUnboxingError(err)
	}
	_, err = buf.Write(bodyCiphertext.N)
	if err != nil {
		return nil, NewPermanentUnboxingError(err)
	}
	_, err = buf.Write(bodyCiphertext.E)
	if err != nil {
		return nil, NewPermanentUnboxingError(err)
	}
	return b.hashV1(buf.Bytes()), nil
}

// unboxThread transforms a chat1.ThreadViewBoxed to a keybase1.ThreadView.
func (b *Boxer) UnboxThread(ctx context.Context, boxed chat1.ThreadViewBoxed, convID chat1.ConversationID, finalizeInfo *chat1.ConversationFinalizeInfo) (thread chat1.ThreadView, err error) {

	thread = chat1.ThreadView{
		Pagination: boxed.Pagination,
	}

	if thread.Messages, err = b.UnboxMessages(ctx, boxed.Messages, convID, finalizeInfo); err != nil {
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
		b.assertInTest()
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

func (b *Boxer) UnboxMessages(ctx context.Context, boxed []chat1.MessageBoxed, convID chat1.ConversationID, finalizeInfo *chat1.ConversationFinalizeInfo) (unboxed []chat1.MessageUnboxed, err error) {
	for _, msg := range boxed {
		decmsg, err := b.UnboxMessage(ctx, msg, convID, finalizeInfo)
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

	cres, err := CtxKeyFinder(ctx).Find(ctx, b.tlfInfoSource, tlfName,
		msg.ClientHeader.TlfPublic)

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

	// CORE-4540: MerkleRoot will be in signed header.
	//            It is useless to put it in the unsigned header in the meantime.
	// merkleRoot, err := b.latestMerkleRoot()
	// if err != nil {
	// 	return nil, NewBoxingError(err.Error(), false)
	// }
	// msg.ClientHeader.MerkleRoot = merkleRoot

	if len(msg.ClientHeader.TlfName) == 0 {
		msg := fmt.Sprintf("blank TLF name received: original: %s canonical: %s", tlfName,
			msg.ClientHeader.TlfName)
		return nil, NewBoxingError(msg, true)
	}

	boxed, err := b.box(msg, encryptionKey, signingKeyPair, b.boxWithVersion)
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
	encryptedBody, err := b.seal(plaintextBody, libkb.NaclSecretBoxKey(key.Key))
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
		// CORE-4540: Add MerkleRoot to signed header.
		BodyHash:   bodyHash[:],
		OutboxInfo: messagePlaintext.ClientHeader.OutboxInfo,
		OutboxID:   messagePlaintext.ClientHeader.OutboxID,
	}

	// sign the header and insert the signature
	sig, err := b.signMarshal(header, signingKeyPair, libkb.SignaturePrefixChatMBv1)
	if err != nil {
		return nil, err
	}
	header.HeaderSignature = &sig

	// create a plaintext header
	plaintextHeader := chat1.NewHeaderPlaintextWithV1(header)
	encryptedHeader, err := b.seal(plaintextHeader, libkb.NaclSecretBoxKey(key.Key))
	if err != nil {
		return nil, err
	}

	boxed := &chat1.MessageBoxed{
		Version:          chat1.MessageBoxedVersion_V1,
		ClientHeader:     messagePlaintext.ClientHeader,
		BodyCiphertext:   *encryptedBody,
		HeaderCiphertext: encryptedHeader.AsSealed(),
		KeyGeneration:    key.KeyGeneration,
	}

	return boxed, nil
}

func (b *Boxer) boxV2(messagePlaintext chat1.MessagePlaintext, baseEncryptionKey *keybase1.CryptKey,
	signingKeyPair libkb.NaclSigningKeyPair) (*chat1.MessageBoxed, error) {

	derivedEncryptionKey, err := libkb.DeriveSymmetricKey(
		libkb.NaclSecretBoxKey(baseEncryptionKey.Key), libkb.EncryptionReasonChatMessage)
	if err != nil {
		return nil, err
	}

	bodyVersioned := chat1.NewBodyPlaintextWithV1(chat1.BodyPlaintextV1{
		MessageBody: messagePlaintext.MessageBody,
	})
	bodyEncrypted, err := b.seal(bodyVersioned, derivedEncryptionKey)
	if err != nil {
		return nil, err
	}

	bodyHash, err := b.makeBodyHash(*bodyEncrypted)
	if err != nil {
		return nil, err
	}

	// create the v1 header, adding hash
	headerVersioned := chat1.NewHeaderPlaintextWithV1(chat1.HeaderPlaintextV1{
		Conv:         messagePlaintext.ClientHeader.Conv,
		TlfName:      messagePlaintext.ClientHeader.TlfName,
		TlfPublic:    messagePlaintext.ClientHeader.TlfPublic,
		MessageType:  messagePlaintext.ClientHeader.MessageType,
		Prev:         messagePlaintext.ClientHeader.Prev,
		Sender:       messagePlaintext.ClientHeader.Sender,
		SenderDevice: messagePlaintext.ClientHeader.SenderDevice,
		// CORE-4540: Add MerkleRoot to signed header.
		BodyHash:   bodyHash,
		OutboxInfo: messagePlaintext.ClientHeader.OutboxInfo,
		OutboxID:   messagePlaintext.ClientHeader.OutboxID,
		// In MessageBoxed.V2 HeaderSignature is nil.
		HeaderSignature: nil,
	})

	// signencrypt the header
	headerSealed, err := b.signEncryptMarshal(headerVersioned, derivedEncryptionKey,
		signingKeyPair, libkb.SignaturePrefixChatMBv2)
	if err != nil {
		return nil, err
	}

	// verify
	verifyKey := signingKeyPair.GetBinaryKID()

	boxed := &chat1.MessageBoxed{
		Version:          chat1.MessageBoxedVersion_V2,
		ServerHeader:     nil,
		ClientHeader:     messagePlaintext.ClientHeader,
		HeaderCiphertext: headerSealed.AsSealed(),
		BodyCiphertext:   *bodyEncrypted,
		VerifyKey:        verifyKey,
		KeyGeneration:    baseEncryptionKey.KeyGeneration,
	}

	return boxed, nil
}

// seal encrypts data into chat1.EncryptedData.
func (b *Boxer) seal(data interface{}, key libkb.NaclSecretBoxKey) (*chat1.EncryptedData, error) {
	s, err := b.marshal(data)
	if err != nil {
		return nil, err
	}

	var nonce [libkb.NaclDHNonceSize]byte
	if _, err := rand.Read(nonce[:]); err != nil {
		return nil, err
	}

	var encKey [libkb.NaclSecretBoxKeySize]byte = key

	sealed := secretbox.Seal(nil, []byte(s), &nonce, &encKey)
	enc := &chat1.EncryptedData{
		V: 1,
		E: sealed,
		N: nonce[:],
	}

	return enc, nil
}

// open decrypts chat1.EncryptedData.
func (b *Boxer) open(data chat1.EncryptedData, key libkb.NaclSecretBoxKey) ([]byte, error) {
	if len(data.N) != libkb.NaclDHNonceSize {
		return nil, libkb.DecryptBadNonceError{}
	}
	var nonce [libkb.NaclDHNonceSize]byte
	copy(nonce[:], data.N)

	plain, ok := secretbox.Open(nil, data.E, &nonce, (*[32]byte)(&key))
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

// signEncryptMarshal signencrypts data given an encryption and signing key, returning a chat1.SignEncryptedData.
// It marshals data before signing.
func (b *Boxer) signEncryptMarshal(data interface{}, encryptionKey libkb.NaclSecretBoxKey,
	signingKeyPair libkb.NaclSigningKeyPair, prefix libkb.SignaturePrefix) (chat1.SignEncryptedData, error) {
	encoded, err := b.marshal(data)
	if err != nil {
		return chat1.SignEncryptedData{}, err
	}

	return b.signEncrypt(encoded, encryptionKey, signingKeyPair, prefix)
}

// sign signs msg with a NaclSigningKeyPair, returning a chat1.SignatureInfo.
func (b *Boxer) sign(msg []byte, kp libkb.NaclSigningKeyPair, prefix libkb.SignaturePrefix) (chat1.SignatureInfo, error) {
	sig, err := kp.SignV2(msg, prefix)
	if err != nil {
		return chat1.SignatureInfo{}, err
	}
	sigInfo := chat1.SignatureInfo{
		V: sig.Version,
		S: sig.Sig[:],
		K: sig.Kid,
	}

	if b.testingSignatureMangle != nil {
		b.assertInTest()
		sigInfo.S = b.testingSignatureMangle(sigInfo.S)
	}

	return sigInfo, nil
}

// signEncrypt signencrypts msg.
func (b *Boxer) signEncrypt(msg []byte, encryptionKey libkb.NaclSecretBoxKey,
	signingKeyPair libkb.NaclSigningKeyPair, prefix libkb.SignaturePrefix) (chat1.SignEncryptedData, error) {
	if signingKeyPair.Private == nil {
		return chat1.SignEncryptedData{}, libkb.NoSecretKeyError{}
	}

	var nonce [signencrypt.NonceSize]byte
	if _, err := rand.Read(nonce[:]); err != nil {
		return chat1.SignEncryptedData{}, err
	}

	var encKey [signencrypt.SecretboxKeySize]byte = encryptionKey
	var signKey [ed25519.PrivateKeySize]byte = *signingKeyPair.Private

	signEncryptedBytes := signencrypt.SealWhole(
		msg, &encKey, &signKey, prefix, &nonce)
	signEncryptedInfo := chat1.SignEncryptedData{
		V: 1,
		E: signEncryptedBytes,
		N: nonce[:],
	}

	if b.testingSignatureMangle != nil {
		b.assertInTest()
		signEncryptedInfo.E = b.testingSignatureMangle(signEncryptedInfo.E)
	}

	return signEncryptedInfo, nil
}

// signEncryptOpen opens and verifies chat1.SignEncryptedData.
func (b *Boxer) signEncryptOpen(data chat1.SignEncryptedData, encryptionKey libkb.NaclSecretBoxKey,
	verifyKID []byte, prefix libkb.SignaturePrefix) ([]byte, error) {
	var encKey [signencrypt.SecretboxKeySize]byte = encryptionKey

	verifyKey := libkb.KIDToNaclSigningKeyPublic(verifyKID)
	if verifyKey == nil {
		return nil, libkb.BadKeyError{}
	}
	var verKey [ed25519.PublicKeySize]byte = *verifyKey

	var nonce [signencrypt.NonceSize]byte
	if copy(nonce[:], data.N) != signencrypt.NonceSize {
		return nil, libkb.DecryptBadNonceError{}
	}

	plain, err := signencrypt.OpenWhole(data.E, &encKey, &verKey, prefix, &nonce)
	if err != nil {
		return nil, err
	}
	return plain, nil
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
	// ValidSenderKey uses the server-given ctime, but emits senderDeviceRevokedAt as a workaround.
	// See ValidSenderKey for details.
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
	if !b.verify(hpack, *header.HeaderSignature, libkb.SignaturePrefixChatMBv1) {
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
// This trusts the server for ctime, so a colluding server could use a revoked key and this check erroneously pass.
// But (revoked != nil) if the key was ever revoked, so that is irrespective of ctime.
// Returns (validAtCtime, revoked, err)
func (b *Boxer) ValidSenderKey(ctx context.Context, sender gregor1.UID, key []byte, ctime gregor1.Time) (found, validAtCTime bool, revoked *gregor1.Time, unboxErr UnboxingError) {
	if b.testingValidSenderKey != nil {
		b.assertInTest()
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

func (b *Boxer) assertInTest() {
	b.log().Warning("Using TESTING jig. Not suitable for normal use.")
	if flag.Lookup("test.v") == nil {
		panic("testing jig installed in normal mode")
	}
}

func hashSha256V1(data []byte) chat1.Hash {
	sum := sha256.Sum256(data)
	return sum[:]
}

// See note on compareHeadersV2.
func (b *Boxer) compareHeadersV1(ctx context.Context, hServer chat1.MessageClientHeader, hSigned chat1.MessageClientHeaderVerified) UnboxingError {
	// Conv
	if !hServer.Conv.Eq(hSigned.Conv) {
		return NewPermanentUnboxingError(NewHeaderMismatchError("Conv"))
	}

	// TlfName
	if hServer.TlfName != hSigned.TlfName {
		return NewPermanentUnboxingError(NewHeaderMismatchError("TlfName"))
	}

	// TlfPublic
	if hServer.TlfPublic != hSigned.TlfPublic {
		return NewPermanentUnboxingError(NewHeaderMismatchError("TlfPublic"))
	}

	// MessageType
	if hServer.MessageType != hSigned.MessageType {
		return NewPermanentUnboxingError(NewHeaderMismatchError("MessageType"))
	}

	// Note: Supersedes and Deletes are not checked because they are not
	//       part of MessageClientHeaderVerified.

	// Prev
	if len(hServer.Prev) != len(hSigned.Prev) {
		return NewPermanentUnboxingError(NewHeaderMismatchError("Prev"))
	}
	for i, a := range hServer.Prev {
		b := hSigned.Prev[i]
		if !a.Eq(b) {
			return NewPermanentUnboxingError(NewHeaderMismatchError("Prev"))
		}
	}

	// Sender
	// This prevents someone from re-using a header for another sender
	if !hServer.Sender.Eq(hSigned.Sender) {
		return NewPermanentUnboxingError(NewHeaderMismatchError("Sender"))
	}

	// SenderDevice
	if !bytes.Equal(hServer.SenderDevice.Bytes(), hSigned.SenderDevice.Bytes()) {
		return NewPermanentUnboxingError(NewHeaderMismatchError("SenderDevice"))
	}

	// CORE-4540: _Don't_ enable checking of MerkleRoot matching! There are V1 messages in the wild with
	//            hServer.MerkleRoot set but nothing signed.

	// OutboxID, OutboxInfo: Left unchecked as I'm not sure whether these hold in V1 messages.

	return nil
}

func (b *Boxer) CompareTlfNames(ctx context.Context, tlfName1, tlfName2 string, tlfPublic bool) (bool, error) {
	get1 := func(tlfName string, tlfPublic bool) (string, error) {
		cres, err := CtxKeyFinder(ctx).Find(ctx, b.tlfInfoSource, tlfName, tlfPublic)
		if err != nil {
			return "", err
		}
		return string(cres.NameIDBreaks.CanonicalName), nil
	}

	c1, err := get1(tlfName1, tlfPublic)
	if err != nil {
		return false, err
	}
	c2, err := get1(tlfName2, tlfPublic)
	if err != nil {
		return false, err
	}
	return c1 == c2, nil
}
