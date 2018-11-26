// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package chat

import (
	"bytes"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/binary"
	"encoding/hex"
	"errors"
	"flag"
	"fmt"
	"sort"
	"sync"
	"time"

	"golang.org/x/crypto/nacl/box"
	"golang.org/x/crypto/nacl/secretbox"
	"golang.org/x/net/context"
	"golang.org/x/sync/errgroup"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/signencrypt"
	"github.com/keybase/client/go/chat/storage"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/ephemeral"
	"github.com/keybase/client/go/kbcrypto"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/teams"
	"github.com/keybase/clockwork"
	"github.com/keybase/go-codec/codec"
	"github.com/keybase/go-crypto/ed25519"
)

const CurrentMessageBoxedVersion = chat1.MessageBoxedVersion_V2

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

	boxVersionForTesting *chat1.MessageBoxedVersion

	// Replaceable for testing.
	// Normally set to normal implementations.
	hashV1 func(data []byte) chat1.Hash

	// Slots for replacing with test implementations.
	// These are normally nil.
	testingValidSenderKey     func(context.Context, gregor1.UID, []byte, gregor1.Time) (found, validAtCTime bool, revoked *gregor1.Time, unboxingErr types.UnboxingError)
	testingGetSenderInfoLocal func(context.Context, gregor1.UID, gregor1.DeviceID) (senderUsername string, senderDeviceName string, senderDeviceType string)
	// Post-process signatures and signencrypts
	testingSignatureMangle func([]byte) []byte

	clock clockwork.Clock
}

func NewBoxer(g *globals.Context) *Boxer {
	return &Boxer{
		DebugLabeler: utils.NewDebugLabeler(g.GetLog(), "Boxer", false),
		hashV1:       hashSha256V1,
		Contextified: globals.NewContextified(g),
		clock:        clockwork.NewRealClock(),
	}
}

func (b *Boxer) SetClock(clock clockwork.Clock) {
	b.clock = clock
}

func (b *Boxer) log() logger.Logger {
	return b.G().GetLog()
}

func (b *Boxer) makeErrorMessage(ctx context.Context, msg chat1.MessageBoxed, err types.UnboxingError) chat1.MessageUnboxed {
	e := chat1.MessageUnboxedError{
		ErrType:            err.ExportType(),
		ErrMsg:             err.Error(),
		InternalErrMsg:     err.InternalError(),
		VersionKind:        err.VersionKind(),
		VersionNumber:      err.VersionNumber(),
		IsCritical:         err.IsCritical(),
		MessageID:          msg.GetMessageID(),
		MessageType:        msg.GetMessageType(),
		Ctime:              msg.ServerHeader.Ctime,
		IsEphemeral:        msg.IsEphemeral(),
		IsEphemeralExpired: msg.IsEphemeralExpired(b.clock.Now()),
		Etime:              msg.Etime(),
	}
	e.SenderUsername, e.SenderDeviceName, e.SenderDeviceType = b.getSenderInfoLocal(ctx,
		msg.ClientHeader.Sender, msg.ClientHeader.SenderDevice)
	return chat1.NewMessageUnboxedWithError(e)
}

func (b *Boxer) detectPermanentError(err error, tlfName string) types.UnboxingError {
	// Banned folders are only detectable by the error string currently,
	// hopefully we can do something better in the future.
	if err.Error() == "Operations for this folder are temporarily throttled (error 2800)" {
		return NewPermanentUnboxingError(err)
	}

	// Check for team not exist error that is in raw form
	if aerr, ok := err.(libkb.AppStatusError); ok {
		switch keybase1.StatusCode(aerr.Code) {
		case keybase1.StatusCode_SCTeamNotFound:
			return NewPermanentUnboxingError(err)
		case keybase1.StatusCode_SCTeamReadError:
			// These errors get obfuscated by the server on purpose. Just mark this as permanent error
			// since it likely means the team is in bad shape.
			if aerr.Error() == "You are not a member of this team (error 2623)" {
				return NewPermanentUnboxingError(err)
			}
			return NewTransientUnboxingError(err)
		}
	}

	switch err := err.(type) {
	case libkb.UserDeletedError:
		if len(err.Msg) == 0 {
			err.Msg = fmt.Sprintf("user deleted in chat '%v'", tlfName)
		}
		return NewPermanentUnboxingError(err)
	case teams.TeamDoesNotExistError,
		teams.KBFSKeyGenerationError,
		libkb.KeyMaskNotFoundError,
		DecryptionKeyNotFoundError,
		NotAuthenticatedForThisDeviceError,
		InvalidMACError:
		return NewPermanentUnboxingError(err)
	case ephemeral.EphemeralKeyError:
		// Normalize error message with EphemeralUnboxingError
		return NewPermanentUnboxingError(NewEphemeralUnboxingError(err))
	}

	// Check for no space left on device errors
	if libkb.IsNoSpaceOnDeviceError(err) {
		return NewPermanentUnboxingError(err)
	}

	// transient error. Rekey errors come through here
	return NewTransientUnboxingError(err)
}

type basicUnboxConversationInfo struct {
	convID       chat1.ConversationID
	membersType  chat1.ConversationMembersType
	finalizeInfo *chat1.ConversationFinalizeInfo
	visibility   keybase1.TLFVisibility
}

var _ types.UnboxConversationInfo = (*basicUnboxConversationInfo)(nil)

func newBasicUnboxConversationInfo(convID chat1.ConversationID,
	membersType chat1.ConversationMembersType, finalizeInfo *chat1.ConversationFinalizeInfo,
	visibility keybase1.TLFVisibility) *basicUnboxConversationInfo {
	return &basicUnboxConversationInfo{
		convID:       convID,
		membersType:  membersType,
		finalizeInfo: finalizeInfo,
		visibility:   visibility,
	}
}

func (b *basicUnboxConversationInfo) GetConvID() chat1.ConversationID {
	return b.convID
}

func (b *basicUnboxConversationInfo) GetMembersType() chat1.ConversationMembersType {
	return b.membersType
}

func (b *basicUnboxConversationInfo) GetFinalizeInfo() *chat1.ConversationFinalizeInfo {
	return b.finalizeInfo
}

func (b *basicUnboxConversationInfo) GetExpunge() *chat1.Expunge {
	return nil
}

func (b *basicUnboxConversationInfo) GetMaxDeletedUpTo() chat1.MessageID {
	return 0
}

func (b *basicUnboxConversationInfo) IsPublic() bool {
	return b.visibility == keybase1.TLFVisibility_PUBLIC
}

type extraInboxUnboxConversationInfo struct {
	convID      chat1.ConversationID
	membersType chat1.ConversationMembersType
	visibility  keybase1.TLFVisibility
}

var _ types.UnboxConversationInfo = (*extraInboxUnboxConversationInfo)(nil)

func newExtraInboxUnboxConverstionInfo(convID chat1.ConversationID, membersType chat1.ConversationMembersType,
	visibility keybase1.TLFVisibility) *extraInboxUnboxConversationInfo {
	return &extraInboxUnboxConversationInfo{
		convID:      convID,
		membersType: membersType,
		visibility:  visibility,
	}
}

func (p *extraInboxUnboxConversationInfo) GetConvID() chat1.ConversationID {
	return p.convID
}

func (p *extraInboxUnboxConversationInfo) GetMembersType() chat1.ConversationMembersType {
	return p.membersType
}

func (p *extraInboxUnboxConversationInfo) GetFinalizeInfo() *chat1.ConversationFinalizeInfo {
	return nil
}

func (p *extraInboxUnboxConversationInfo) GetExpunge() *chat1.Expunge {
	return nil
}

func (p *extraInboxUnboxConversationInfo) GetMaxDeletedUpTo() chat1.MessageID {
	return 0
}

func (p *extraInboxUnboxConversationInfo) IsPublic() bool {
	return p.visibility == keybase1.TLFVisibility_PUBLIC
}

func (b *Boxer) getEffectiveMembersType(ctx context.Context, boxed chat1.MessageBoxed,
	convMembersType chat1.ConversationMembersType) chat1.ConversationMembersType {
	switch convMembersType {
	case chat1.ConversationMembersType_IMPTEAMUPGRADE:
		if boxed.KBFSEncrypted() {
			b.Debug(ctx, "getEffectiveMembersType: overruling %v conv with KBFS keys", convMembersType)
			return chat1.ConversationMembersType_KBFS
		}
	}
	return convMembersType
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
func (b *Boxer) UnboxMessage(ctx context.Context, boxed chat1.MessageBoxed, conv types.UnboxConversationInfo) (m chat1.MessageUnboxed, uberr types.UnboxingError) {
	defer b.Trace(ctx, func() error { return uberr }, "UnboxMessage(%s, %d)", conv.GetConvID(),
		boxed.GetMessageID())()

	// Check to see if the context has been cancelled
	select {
	case <-ctx.Done():
		return m, NewTransientUnboxingError(ctx.Err())
	default:
	}

	// If we don't have an rtime, add one.
	if boxed.ServerHeader.Rtime == nil {
		now := gregor1.ToTime(b.clock.Now())
		boxed.ServerHeader.Rtime = &now
	}
	tlfName := boxed.ClientHeader.TLFNameExpanded(conv.GetFinalizeInfo())
	if conv.IsPublic() != boxed.ClientHeader.TlfPublic {
		return b.makeErrorMessage(ctx, boxed,
			NewPermanentUnboxingError(fmt.Errorf("visibility mismatch: %v != %v", conv.IsPublic(),
				boxed.ClientHeader.TlfPublic))), nil
	}
	keyMembersType := b.getEffectiveMembersType(ctx, boxed, conv.GetMembersType())
	encryptionKey, err := CtxKeyFinder(ctx, b.G()).FindForDecryption(ctx,
		tlfName, boxed.ClientHeader.Conv.Tlfid, conv.GetMembersType(),
		conv.IsPublic(), boxed.KeyGeneration, keyMembersType == chat1.ConversationMembersType_KBFS)
	if err != nil {
		// Post-process error from this
		uberr = b.detectPermanentError(err, tlfName)
		if uberr.IsPermanent() {
			return b.makeErrorMessage(ctx, boxed, uberr), nil
		}
		return chat1.MessageUnboxed{}, uberr
	}

	// If the message is exploding, load the ephemeral key.
	var ephemeralSeed *keybase1.TeamEk
	if boxed.IsEphemeral() {
		// Don't bother if the message is already expired.
		if boxed.IsEphemeralExpired(b.clock.Now()) {
			return b.makeErrorMessage(ctx, boxed, NewPermanentUnboxingError(NewEphemeralAlreadyExpiredError())), nil
		}
		ek, err := CtxKeyFinder(ctx, b.G()).EphemeralKeyForDecryption(
			ctx, tlfName, boxed.ClientHeader.Conv.Tlfid, conv.GetMembersType(), boxed.ClientHeader.TlfPublic,
			boxed.EphemeralMetadata().Generation)
		if err != nil {
			b.Debug(ctx, "failed to get a key for ephemeral message: msgID: %d err: %v", boxed.ServerHeader.MessageID, err)
			uberr = b.detectPermanentError(err, tlfName)
			if uberr.IsPermanent() {
				return b.makeErrorMessage(ctx, boxed, uberr), nil
			}
			return chat1.MessageUnboxed{}, uberr
		}
		ephemeralSeed = &ek
	}

	unboxed, ierr := b.unbox(ctx, boxed, conv.GetMembersType(), encryptionKey, ephemeralSeed)
	if ierr == nil {
		ierr = b.checkInvariants(ctx, conv.GetConvID(), boxed, unboxed)
	}
	if ierr != nil {
		b.Debug(ctx, "failed to unbox message: msgID: %d err: %s", boxed.ServerHeader.MessageID,
			ierr.Error())
		if ierr.IsPermanent() {
			return b.makeErrorMessage(ctx, boxed, ierr), nil
		}
		return chat1.MessageUnboxed{}, ierr
	}
	return chat1.NewMessageUnboxedWithValid(*unboxed), nil
}

func (b *Boxer) checkInvariants(ctx context.Context, convID chat1.ConversationID, boxed chat1.MessageBoxed, unboxed *chat1.MessageUnboxedValid) types.UnboxingError {
	// Check that the ConversationIDTriple in the signed message header matches
	// the conversation ID we were expecting.
	if !unboxed.ClientHeader.Conv.Derivable(convID) {
		err := fmt.Errorf("conversation ID mismatch: header: %x convID: %s",
			unboxed.ClientHeader.Conv.Hash(), convID)
		return NewPermanentUnboxingError(err)
	}

	// Check that message type on the client header matches the body
	body := unboxed.MessageBody
	if !body.IsNil() {
		bodyTyp, err := body.MessageType()
		if err != nil {
			return NewPermanentUnboxingError(err)
		}
		if unboxed.ClientHeader.MessageType != bodyTyp {
			err := fmt.Errorf("client header message type does not match body: %v(header) != %v(body)",
				unboxed.ClientHeader.MessageType, bodyTyp)
			return NewPermanentUnboxingError(err)
		}
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
	replayErr := storage.CheckAndRecordBodyHash(ctx, b.G(), unboxed.BodyHash, boxed.ServerHeader.MessageID, convID)
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
	prevPtrErr := storage.CheckAndRecordPrevPointer(ctx, b.G(), boxed.ServerHeader.MessageID, convID, unboxed.HeaderHash)
	if prevPtrErr != nil {
		b.Debug(ctx, "UnboxMessage found an inconsistent header hash: %s", prevPtrErr)
		return NewPermanentUnboxingError(prevPtrErr)
	}
	for _, prevPtr := range unboxed.ClientHeader.Prev {
		prevPtrErr := storage.CheckAndRecordPrevPointer(ctx, b.G(), prevPtr.Id, convID, prevPtr.Hash)
		if prevPtrErr != nil {
			b.Debug(ctx, "UnboxMessage found an inconsistent prev pointer: %s", prevPtrErr)
			return NewPermanentUnboxingError(prevPtrErr)
		}
	}

	return nil
}

func (b *Boxer) unbox(ctx context.Context, boxed chat1.MessageBoxed,
	membersType chat1.ConversationMembersType, encryptionKey types.CryptKey,
	ephemeralSeed *keybase1.TeamEk) (*chat1.MessageUnboxedValid, types.UnboxingError) {
	switch boxed.Version {
	case chat1.MessageBoxedVersion_VNONE, chat1.MessageBoxedVersion_V1:
		res, err := b.unboxV1(ctx, boxed, membersType, encryptionKey)
		if err != nil {
			b.Debug(ctx, "error unboxing message version: %v", boxed.Version)
		}
		return res, err
	// V3 is the same as V2, except that it indicates exploding message support.
	// V4 is the same as V3, except if pairwise MACs are included, then the sender signing key is a dummy.
	case chat1.MessageBoxedVersion_V2, chat1.MessageBoxedVersion_V3, chat1.MessageBoxedVersion_V4:
		res, err := b.unboxV2orV3orV4(ctx, boxed, membersType, encryptionKey, ephemeralSeed)
		if err != nil {
			b.Debug(ctx, "error unboxing message version: %v, %s", boxed.Version, err)
		}
		return res, err
	// NOTE: When adding new versions here, you must also update
	// chat1/extras.go so MessageUnboxedError.ParseableVersion understands the
	// new max version
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
func (b *Boxer) unboxV1(ctx context.Context, boxed chat1.MessageBoxed,
	membersType chat1.ConversationMembersType, encryptionKey types.CryptKey) (*chat1.MessageUnboxedValid, types.UnboxingError) {
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
	// that there is in fact a message that deleted it.
	// We should fetch that message and check its signed body.
	// That involves fetching a message whose ID is not known here.

	// decrypt body
	// will remain empty if the body was deleted
	var bodyVersioned chat1.BodyPlaintext
	if !skipBodyVerification {
		packedBody, err := b.open(boxed.BodyCiphertext, libkb.NaclSecretBoxKey(encryptionKey.Material()))
		if err != nil {
			return nil, NewPermanentUnboxingError(err)
		}
		if err := b.unmarshal(packedBody, &bodyVersioned); err != nil {
			return nil, NewPermanentUnboxingError(err)
		}
	}

	// decrypt header
	packedHeader, err := b.open(boxed.HeaderCiphertext.AsEncrypted(), libkb.NaclSecretBoxKey(encryptionKey.Material()))
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

	rtime := gregor1.ToTime(b.clock.Now())
	if boxed.ServerHeader.Rtime != nil {
		rtime = *boxed.ServerHeader.Rtime
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
			// MerkleRoot is not expected to be in any v1 messages. Ignore it.
			MerkleRoot:        nil,
			OutboxID:          hp.OutboxID,
			OutboxInfo:        hp.OutboxInfo,
			KbfsCryptKeysUsed: hp.KbfsCryptKeysUsed,
			Rtime:             rtime,
		}
	// NOTE: When adding new versions here, you must also update
	// chat1/extras.go so MessageUnboxedError.ParseableVersion understands the
	// new max version
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
		// NOTE: When adding new versions here, you must also update
		// chat1/extras.go so MessageUnboxedError.ParseableVersion understands the
		// new max version
		default:
			return nil,
				NewPermanentUnboxingError(NewBodyVersionError(bodyVersion,
					b.bodyUnsupported(ctx, bodyVersion, bodyVersioned)))
		}
	}

	// Get at mention usernames
	atMentions, atMentionUsernames, chanMention, channelNameMentions :=
		b.getAtMentionInfo(ctx, clientHeader.Conv.Tlfid, membersType, body)

	ierr = b.compareHeadersMBV1(ctx, boxed.ClientHeader, clientHeader)
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
		AtMentions:            atMentions,
		AtMentionUsernames:    atMentionUsernames,
		ChannelMention:        chanMention,
		ChannelNameMentions:   channelNameMentions,
	}, nil
}

func (b *Boxer) validatePairwiseMAC(ctx context.Context, boxed chat1.MessageBoxed, headerHash chat1.Hash) (senderKey []byte, err error) {
	defer b.Trace(ctx, func() error { return err }, "validatePairwiseMAC")()

	// First, find a MAC that matches our receiving device encryption KID.
	ourDeviceKeyNacl, err := b.G().ActiveDevice.NaclEncryptionKey()
	if err != nil {
		return nil, err
	}
	messageMAC, found := boxed.ClientHeader.PairwiseMacs[ourDeviceKeyNacl.GetKID()]
	if !found {
		// This is an error users will actually see when they've just joined a
		// team or added a new device.
		return nil, NewNotAuthenticatedForThisDeviceError()
	}

	// Second, load the device encryption KID for the sender.
	senderUID, err := keybase1.UIDFromSlice(boxed.ClientHeader.Sender)
	if err != nil {
		return nil, err
	}
	senderDeviceID, err := keybase1.DeviceIDFromSlice(boxed.ClientHeader.SenderDevice)
	if err != nil {
		return nil, err
	}
	// Use the loading function that hits the server if-and-only-if we don't
	// have the given deviceID in cache.
	senderUPAK, err := b.G().GetUPAKLoader().LoadUPAKWithDeviceID(ctx, senderUID, senderDeviceID)
	if err != nil {
		return nil, err
	}
	senderEncryptionKID := senderUPAK.Current.FindEncryptionKIDFromDeviceID(senderDeviceID)
	if senderEncryptionKID.IsNil() {
		for _, upk := range senderUPAK.PastIncarnations {
			senderEncryptionKID = upk.FindEncryptionKIDFromDeviceID(senderDeviceID)
			if !senderEncryptionKID.IsNil() {
				break
			}
		}
		if senderEncryptionKID.IsNil() {
			return nil, fmt.Errorf("failed to find encryption key for device %s", senderDeviceID.String())
		}
	}
	senderDeviceDHKeyNacl, err := libkb.ImportDHKeypairFromKID(senderEncryptionKID)
	if err != nil {
		return nil, err
	}

	// Finally, validate the MAC.
	computedMAC := makeOnePairwiseMAC(*ourDeviceKeyNacl.Private, senderDeviceDHKeyNacl.Public, headerHash)
	if !hmac.Equal(messageMAC, computedMAC) {
		return nil, NewInvalidMACError()
	}

	return senderEncryptionKID.ToBytes(), nil
}

func (b *Boxer) unboxV2orV3orV4(ctx context.Context, boxed chat1.MessageBoxed,
	membersType chat1.ConversationMembersType, baseEncryptionKey types.CryptKey,
	ephemeralSeed *keybase1.TeamEk) (*chat1.MessageUnboxedValid, types.UnboxingError) {
	if boxed.ServerHeader == nil {
		return nil, NewPermanentUnboxingError(errors.New("nil ServerHeader in MessageBoxed"))
	}

	// Compute the header hash
	headerHash, ierr := b.makeHeaderHash(boxed.HeaderCiphertext.AsSignEncrypted())
	if ierr != nil {
		return nil, ierr
	}

	// Regular messages use the same encryption key for the header and for the
	// body. Exploding messages use a derived ephemeral key for the body.
	headerEncryptionKey, err := libkb.DeriveSymmetricKey(
		libkb.NaclSecretBoxKey(baseEncryptionKey.Material()), libkb.EncryptionReasonChatMessage)
	if err != nil {
		return nil, NewPermanentUnboxingError(err)
	}
	bodyEncryptionKey := headerEncryptionKey
	if boxed.IsEphemeral() {
		bodyEncryptionKey, err = libkb.DeriveFromSecret(ephemeralSeed.Seed, libkb.DeriveReasonTeamEKExplodingChat)
		if err != nil {
			return nil, NewPermanentUnboxingError(err)
		}
	}

	// Validate verification key against unverified sender id.
	// Later it is asserted that the claimed and signing sender are the same.
	// ValidSenderKey uses the server-given ctime, but emits senderDeviceRevokedAt as a workaround.
	// See ValidSenderKey for details.
	if boxed.VerifyKey == nil {
		return nil, NewPermanentUnboxingError(libkb.NoKeyError{Msg: "sender key missing"})
	}

	// This will be the message's signing key in the normal case, and the
	// sending device's encryption key in the pairwise MAC case.
	senderKeyToValidate := boxed.VerifyKey

	// When pairwise MACs are present (in practice only on exploding messages,
	// but in theory we support them anywhere), we validate the one that's
	// intended for our device, and error out if it's missing or invalid. If it
	// is valid, then we *don't* validate the message signing key. That is,
	// even though signEncryptOpen will check a signature in the end, we no
	// longer care what signing key it's using.
	if len(boxed.ClientHeader.PairwiseMacs) > 0 {
		if boxed.Version != chat1.MessageBoxedVersion_V3 && !bytes.Equal(boxed.VerifyKey, dummySigningKey().GetKID().ToBytes()) {
			return nil, NewPermanentUnboxingError(fmt.Errorf("expected dummy signing key (%s), got %s", dummySigningKey().GetKID(), hex.EncodeToString(boxed.VerifyKey)))
		}
		senderKeyToValidate, err = b.validatePairwiseMAC(ctx, boxed, headerHash)
		if err != nil {
			// Return a transient error if possible
			return nil, b.detectPermanentError(err, boxed.ClientHeader.TlfName)
		}
	} else if bytes.Equal(boxed.VerifyKey, dummySigningKey().GetKID().ToBytes()) {
		// Note that this can happen if the server is stripping MACs for some
		// reason, for example if you're testing against an out-of-date server
		// version.
		return nil, NewPermanentUnboxingError(fmt.Errorf("unexpected dummy signing key with no pairwise MACs present"))
	}

	// If we validated a pairwise MAC above, then senderKeyToValidate will be
	// the sender's device encryption key, instead of the VerifyKey from the
	// message. In this case, ValidSenderKey is just fetching revocation info for us.
	senderKeyFound, senderKeyValidAtCtime, senderDeviceRevokedAt, ierr := b.ValidSenderKey(
		ctx, boxed.ClientHeader.Sender, senderKeyToValidate, boxed.ServerHeader.Ctime)
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
	headerPacked, err := b.signEncryptOpen(boxed.HeaderCiphertext.AsSignEncrypted(), headerEncryptionKey,
		boxed.VerifyKey, kbcrypto.SignaturePrefixChatMBv2)
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
	clientHeader, bodyHashSigned, ierr := b.unversionHeaderMBV2(ctx, boxed.ServerHeader, headerVersioned)
	if ierr != nil {
		return nil, ierr
	}

	// Whether the body is missing (deleted)
	isBodyDeleted := (len(boxed.BodyCiphertext.E) == 0)

	// TODO We should check whether the body is allowed to have been deleted by checking
	// that there is in fact a message that deleted it.
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
	ierr = b.compareHeadersMBV2orV3(ctx, boxed.ClientHeader, clientHeader, boxed.Version)
	if ierr != nil {
		return nil, ierr
	}

	// Decrypt body
	// If the body is deleted, this is left blank.
	var body chat1.MessageBody
	if !isBodyDeleted {
		bodyPacked, err := b.open(boxed.BodyCiphertext, bodyEncryptionKey)
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

	// Get sender info
	// Any of (senderUsername, senderDeviceName, senderDeviceType) could be empty strings because of non-critical failures.
	senderUsername, senderDeviceName, senderDeviceType := b.getSenderInfoLocal(
		ctx, clientHeader.Sender, clientHeader.SenderDevice)

	// Get at mention usernames
	atMentions, atMentionUsernames, chanMention, channelNameMentions :=
		b.getAtMentionInfo(ctx, clientHeader.Conv.Tlfid, membersType, body)

	clientHeader.HasPairwiseMacs = len(boxed.ClientHeader.PairwiseMacs) > 0

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
		AtMentions:            atMentions,
		AtMentionUsernames:    atMentionUsernames,
		ChannelMention:        chanMention,
		ChannelNameMentions:   channelNameMentions,
	}, nil
}

// Unversions a header.
// Also check that the HeaderSignature field from MessageBoxed V1 is nil.
// Therefore only for use with MessageBoxed V2.
// Returns (header, bodyHash, err)
func (b *Boxer) unversionHeaderMBV2(ctx context.Context, serverHeader *chat1.MessageServerHeader, headerVersioned chat1.HeaderPlaintext) (chat1.MessageClientHeaderVerified, []byte, types.UnboxingError) {
	if serverHeader == nil {
		return chat1.MessageClientHeaderVerified{}, nil, NewPermanentUnboxingError(errors.New("nil ServerHeader in MessageBoxed"))
	}

	rtime := gregor1.ToTime(b.clock.Now())
	if serverHeader.Rtime != nil {
		rtime = *serverHeader.Rtime
	}

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
			Conv:              hp.Conv,
			TlfName:           hp.TlfName,
			TlfPublic:         hp.TlfPublic,
			MessageType:       hp.MessageType,
			Prev:              hp.Prev,
			Sender:            hp.Sender,
			SenderDevice:      hp.SenderDevice,
			MerkleRoot:        hp.MerkleRoot,
			OutboxID:          hp.OutboxID,
			OutboxInfo:        hp.OutboxInfo,
			KbfsCryptKeysUsed: hp.KbfsCryptKeysUsed,
			EphemeralMetadata: hp.EphemeralMetadata,
			Rtime:             rtime,
		}, hp.BodyHash, nil
	// NOTE: When adding new versions here, you must also update
	// chat1/extras.go so MessageUnboxedError.ParseableVersion understands the
	// new max version
	default:
		return chat1.MessageClientHeaderVerified{}, nil,
			NewPermanentUnboxingError(NewHeaderVersionError(headerVersion,
				b.headerUnsupported(ctx, headerVersion, headerVersioned)))
	}
}

func (b *Boxer) unversionBody(ctx context.Context, bodyVersioned chat1.BodyPlaintext) (chat1.MessageBody, types.UnboxingError) {
	bodyVersion, err := bodyVersioned.Version()
	if err != nil {
		return chat1.MessageBody{}, NewPermanentUnboxingError(err)
	}
	switch bodyVersion {
	case chat1.BodyPlaintextVersion_V1:
		return bodyVersioned.V1().MessageBody, nil
	// NOTE: When adding new versions here, you must also update
	// chat1/extras.go so MessageUnboxedError.ParseableVersion understands the
	// new max version
	default:
		return chat1.MessageBody{},
			NewPermanentUnboxingError(NewBodyVersionError(bodyVersion,
				b.bodyUnsupported(ctx, bodyVersion, bodyVersioned)))
	}
}

func (b *Boxer) verifyBodyHash(ctx context.Context, bodyEncrypted chat1.EncryptedData, bodyHashSigned []byte) types.UnboxingError {
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

// Compare the unsigned and signed header for MessageBoxedVersion_V2.
// The V1 and V2 checks are different methods because they are strict on slightly different things.
// Confirm that fields in the server-supplied ClientHeader match what
// we decrypt. It would be preferable if the server didn't supply this data
// at all (so that we didn't have to worry about anyone trusting it
// *before* we get to this check, for example), but since we have it we
// need to check it.
// The most important check here is that the Sender and SenderDevice match.
// That is the only thing that gives the verification key used credibility.
func (b *Boxer) compareHeadersMBV2orV3(ctx context.Context, hServer chat1.MessageClientHeader, hSigned chat1.MessageClientHeaderVerified, version chat1.MessageBoxedVersion) types.UnboxingError {
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

	// MerkleRoot
	if !hServer.MerkleRoot.Eq(hSigned.MerkleRoot) {
		return NewPermanentUnboxingError(NewHeaderMismatchError("MerkleRoot"))
	}
	if hSigned.MerkleRoot == nil {
		return NewPermanentUnboxingError(fmt.Errorf("missing MerkleRoot in chat message"))
	}

	// OutboxID
	if !hServer.OutboxID.Eq(hSigned.OutboxID) {
		return NewPermanentUnboxingError(NewHeaderMismatchError("OutboxID"))
	}

	// OutboxInfo
	if !hServer.OutboxInfo.Eq(hSigned.OutboxInfo) {
		return NewPermanentUnboxingError(NewHeaderMismatchError("OutboxInfo"))
	}

	// EphemeralMetadata (only present in V3 and greater)
	if version > chat1.MessageBoxedVersion_V2 && !hServer.EphemeralMetadata.Eq(hSigned.EphemeralMetadata) {
		return NewPermanentUnboxingError(NewHeaderMismatchError("EphemeralMetadata"))
	}

	return nil
}

func (b *Boxer) makeHeaderHash(headerSealed chat1.SignEncryptedData) (chat1.Hash, types.UnboxingError) {
	buf := bytes.Buffer{}
	err := binary.Write(&buf, binary.BigEndian, int32(headerSealed.V))
	if err != nil {
		return nil, NewPermanentUnboxingError(err)
	}
	// Only the ciphertext at the end should be of variable length, otherwise
	// this hash could be ambiguous.
	if len(headerSealed.N) != signencrypt.NonceSize {
		return nil, NewPermanentUnboxingError(fmt.Errorf("unexpected nonce size, %d != %d", len(headerSealed.N), signencrypt.NonceSize))
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

func (b *Boxer) makeBodyHash(bodyCiphertext chat1.EncryptedData) (chat1.Hash, types.UnboxingError) {
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
func (b *Boxer) UnboxThread(ctx context.Context, boxed chat1.ThreadViewBoxed, conv types.UnboxConversationInfo) (thread chat1.ThreadView, err error) {

	thread = chat1.ThreadView{
		Pagination: boxed.Pagination,
	}

	if thread.Messages, err = b.UnboxMessages(ctx, boxed.Messages, conv); err != nil {
		return chat1.ThreadView{}, err
	}

	return thread, nil
}

func (b *Boxer) getUsernameAndDevice(ctx context.Context, uid keybase1.UID, deviceID keybase1.DeviceID) (string, string, string, error) {
	nun, devName, devType, err := CtxUPAKFinder(ctx, b.G()).LookupUsernameAndDevice(ctx, uid, deviceID)
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
		b.Debug(ctx, "unable to fetch sender and device information: UID: %s deviceID: %s",
			uid1, deviceID1)
		// try to just get username
		username, err = b.getUsername(ctx, uid)
		if err != nil {
			b.Debug(ctx, "failed to fetch sender username after initial error: err: %s", err.Error())
		}
	}
	return username, deviceName, deviceType
}

func (b *Boxer) getAtMentionInfo(ctx context.Context, tlfID chat1.TLFID,
	membersType chat1.ConversationMembersType, body chat1.MessageBody) (atMentions []gregor1.UID, atMentionUsernames []string, chanMention chat1.ChannelMention, channelNameMentions []chat1.ChannelNameMention) {
	chanMention = chat1.ChannelMention_NONE
	typ, err := body.MessageType()
	if err != nil {
		return nil, nil, chanMention, nil
	}
	uid := gregor1.UID(b.G().GetEnv().GetUID().ToBytes())
	tcs := b.G().TeamChannelSource
	switch typ {
	case chat1.MessageType_TEXT:
		atMentions, chanMention = utils.ParseAtMentionedUIDs(ctx, body.Text().Body, b.G().GetUPAKLoader(),
			&b.DebugLabeler)
		if membersType == chat1.ConversationMembersType_TEAM {
			channelNameMentions = utils.ParseChannelNameMentions(ctx, body.Text().Body, uid, tlfID, tcs)
		}
	case chat1.MessageType_EDIT:
		atMentions, chanMention = utils.ParseAtMentionedUIDs(ctx, body.Edit().Body, b.G().GetUPAKLoader(),
			&b.DebugLabeler)
		if membersType == chat1.ConversationMembersType_TEAM {
			channelNameMentions = utils.ParseChannelNameMentions(ctx, body.Edit().Body, uid, tlfID, tcs)
		}
	case chat1.MessageType_SYSTEM:
		atMentions, chanMention = utils.SystemMessageMentions(ctx, body.System(), b.G().GetUPAKLoader())
	default:
		return nil, nil, chanMention, nil
	}

	usernames := make(map[string]bool)
	for _, uid := range atMentions {
		name, err := b.G().GetUPAKLoader().LookupUsername(ctx, keybase1.UID(uid.String()))
		if err != nil {
			continue
		}
		usernames[name.String()] = true
	}
	for u := range usernames {
		atMentionUsernames = append(atMentionUsernames, u)
	}
	return atMentions, atMentionUsernames, chanMention, channelNameMentions
}

func (b *Boxer) UnboxMessages(ctx context.Context, boxed []chat1.MessageBoxed, conv types.UnboxConversationInfo) (unboxed []chat1.MessageUnboxed, err error) {
	defer b.Trace(ctx, func() error { return err }, "UnboxMessages: %s, boxed: %d", conv.GetConvID(), len(boxed))()

	// First stamp all of the messages as received
	now := gregor1.ToTime(b.clock.Now())
	for i, msg := range boxed {
		msg.ServerHeader.Rtime = &now
		boxed[i] = msg
	}

	boxCh := make(chan chat1.MessageBoxed)
	eg, ctx := errgroup.WithContext(ctx)
	eg.Go(func() error {
		defer close(boxCh)
		for _, msg := range boxed {
			select {
			case boxCh <- msg:
			case <-ctx.Done():
				return ctx.Err()
			}
		}
		return nil
	})
	var resLock sync.Mutex
	numUnboxThreads := 2
	for i := 0; i < numUnboxThreads; i++ {
		eg.Go(func() error {
			for msg := range boxCh {
				decmsg, err := b.UnboxMessage(ctx, msg, conv)
				if err != nil {
					return err
				}
				resLock.Lock()
				unboxed = append(unboxed, decmsg)
				resLock.Unlock()
			}
			return nil
		})
	}

	if err := eg.Wait(); err != nil {
		return unboxed, err
	}
	sort.Sort(utils.ByMsgUnboxedMsgID(unboxed))
	return unboxed, nil
}

// If no error then MerkleRoot is non-nil.
func (b *Boxer) latestMerkleRoot(ctx context.Context) (*chat1.MerkleRoot, error) {
	merkleClient := b.G().GetMerkleClient()
	if merkleClient == nil {
		return nil, fmt.Errorf("no MerkleClient available")
	}
	mr, err := merkleClient.FetchRootFromServer(b.G().MetaContext(ctx), libkb.ChatBoxerMerkleFreshness)
	if err != nil {
		return nil, err
	}
	if mr == nil {
		return nil, fmt.Errorf("No merkle root available for chat header")
	}
	merkleRoot := mr.ToInfo()
	return &merkleRoot, nil
}

var dummySigningKeyPtr *libkb.NaclSigningKeyPair
var dummySigningKeyOnce sync.Once

// We use this constant key when we already have pairwiseMACs providing
// authentication. Creating a keypair requires a curve multiply, so we cache it
// here, in case someone uses it in a tight loop.
func dummySigningKey() libkb.NaclSigningKeyPair {
	dummySigningKeyOnce.Do(func() {
		var allZeroSecretKey [libkb.NaclSigningKeySecretSize]byte
		dummyKeypair, err := libkb.MakeNaclSigningKeyPairFromSecret(allZeroSecretKey)
		if err != nil {
			panic("errors in key generation should be impossible: " + err.Error())
		}
		dummySigningKeyPtr = &dummyKeypair
	})
	return *dummySigningKeyPtr
}

// BoxMessage encrypts a keybase1.MessagePlaintext into a chat1.MessageBoxed.  It
// finds the most recent key for the TLF.
func (b *Boxer) BoxMessage(ctx context.Context, msg chat1.MessagePlaintext,
	membersType chat1.ConversationMembersType,
	signingKeyPair libkb.NaclSigningKeyPair) (res *chat1.MessageBoxed, err error) {
	defer b.Trace(ctx, func() error { return err }, "BoxMessage")()
	tlfName := msg.ClientHeader.TlfName
	if len(tlfName) == 0 {
		return nil, NewBoxingError("blank TLF name given", true)
	}

	version := CurrentMessageBoxedVersion
	if b.boxVersionForTesting != nil {
		version = *b.boxVersionForTesting
	}

	if msg.IsEphemeral() && version == chat1.MessageBoxedVersion_V1 {
		return nil, fmt.Errorf("cannot use exploding messages with V1")
	}

	encryptionKey, nameInfo, err := CtxKeyFinder(ctx, b.G()).FindForEncryption(ctx,
		tlfName, msg.ClientHeader.Conv.Tlfid, membersType,
		msg.ClientHeader.TlfPublic)
	if err != nil {
		return nil, NewBoxingCryptKeysError(err)
	}
	msg.ClientHeader.TlfName = nameInfo.CanonicalName

	// If the message is exploding, load the ephemeral key, and tweak the
	// version. Make sure we're not using MessageBoxedVersion_V1, since that
	// doesn't support exploding messages.
	var ephemeralSeed *keybase1.TeamEk
	var pairwiseMACRecipients []keybase1.KID
	if msg.IsEphemeral() {
		ek, err := CtxKeyFinder(ctx, b.G()).EphemeralKeyForEncryption(
			ctx, tlfName, msg.ClientHeader.Conv.Tlfid, membersType, msg.ClientHeader.TlfPublic)
		if err != nil {
			return nil, NewBoxingCryptKeysError(err)
		}
		ephemeralSeed = &ek
		// V3 is "V2 plus support for exploding messages", and V4 is "V3 plus
		// support for pairwise MACs". Thus we'll bump all exploding messages
		// from V2 to V3, and all MAC'd messages from V3 to V4. Eventually we
		// can deprecate the old versions and remove these branches, once
		// support is widespread.
		if version == chat1.MessageBoxedVersion_V2 {
			version = chat1.MessageBoxedVersion_V3
		}

		// If this is a team conversation, and the team is small enough, load
		// the list of pairwise MAC recipients. Note that this is all the
		// devices in the team, not just those that can read the current
		// teamEK. There are a few reasons for doing it this way:
		//   - It's probably better performance. Including all devices
		//     makes the message bigger and takes more Curve25519 ops, but
		//     it means we only need to reference the UPAK cache. To get
		//     the set of devices-that-are-not-stale, we'd need to ask the
		//     server and pay the cost of a network round trip. We could
		//     introduce yet another caching layer, but EKs change more
		//     frequently than devices in general.
		//   - It leaves us more flexibility in the future. If say we
		//     introduce a best-effort rekey mechanism for ephmeral keys,
		//     existing pairwise MACs will Just Work™ after a rekey.
		shouldPairwiseMAC, recipients, err := CtxKeyFinder(ctx, b.G()).ShouldPairwiseMAC(
			ctx, tlfName, msg.ClientHeader.Conv.Tlfid, membersType, msg.ClientHeader.TlfPublic)
		if err != nil {
			return nil, err
		} else if shouldPairwiseMAC {
			if len(recipients) == 0 {
				return nil, fmt.Errorf("unexpected empty pairwise recipients list")
			}
			pairwiseMACRecipients = recipients
			// As noted above, bump the version to V4 when we're MAC'ing.
			if version == chat1.MessageBoxedVersion_V3 {
				version = chat1.MessageBoxedVersion_V4
			}
			// Replace the signing key with a dummy. Using the real signing key
			// would sabotage the repudiability that pairwise MACs are
			// providing. We could avoid signing entirely, but this approach
			// keeps the difference between the two modes very small.
			signingKeyPair = dummySigningKey()
		}
	}

	err = b.attachMerkleRoot(ctx, &msg, version)
	if err != nil {
		return nil, err
	}

	if len(msg.ClientHeader.TlfName) == 0 {
		msg := fmt.Sprintf("blank TLF name received: original: %s canonical: %s", tlfName,
			msg.ClientHeader.TlfName)
		return nil, NewBoxingError(msg, true)
	}

	boxed, err := b.box(ctx, msg, encryptionKey, ephemeralSeed, signingKeyPair, version, pairwiseMACRecipients)
	if err != nil {
		return nil, NewBoxingError(err.Error(), true)
	}

	return boxed, nil
}

// Attach a merkle root to the message to send.
// Modifies msg.
// For MessageBoxedV1 makes sure there is no MR.
// For MessageBoxedV2 attaches a MR that is no more out of date than ChatBoxerMerkleFreshness.
func (b *Boxer) attachMerkleRoot(ctx context.Context, msg *chat1.MessagePlaintext, version chat1.MessageBoxedVersion) error {
	switch version {
	case chat1.MessageBoxedVersion_V1:
		if msg.ClientHeader.MerkleRoot != nil {
			return NewBoxingError("cannot send v1 message with merkle root", true)
		}
	case chat1.MessageBoxedVersion_V2, chat1.MessageBoxedVersion_V3, chat1.MessageBoxedVersion_V4:
		merkleRoot, err := b.latestMerkleRoot(ctx)
		if err != nil {
			return NewBoxingError(err.Error(), false)
		}
		msg.ClientHeader.MerkleRoot = merkleRoot
		if msg.ClientHeader.MerkleRoot == nil {
			return NewBoxingError("cannot send message without merkle root", false)
		}
	default:
		return fmt.Errorf("attachMerkleRoot unrecognized version: %s", version)
	}
	return nil
}

func (b *Boxer) preBoxCheck(ctx context.Context, messagePlaintext chat1.MessagePlaintext) error {
	typ, err := messagePlaintext.MessageBody.MessageType()
	if err != nil {
		return err
	}
	e := func(format string, args ...interface{}) error {
		return errors.New(fmt.Sprintf("malformed %v message: ", typ) + fmt.Sprintf(format, args...))
	}
	switch typ {
	case chat1.MessageType_DELETEHISTORY:
		body := messagePlaintext.MessageBody.Deletehistory()
		dhHeader := messagePlaintext.ClientHeader.DeleteHistory
		if dhHeader == nil {
			return e("missing header")
		}
		if *dhHeader != body {
			return e("header-body mismatch")
		}
	default:
		if messagePlaintext.ClientHeader.DeleteHistory != nil {
			return e("cannot have delete-history header")
		}
	}

	return nil
}

func (b *Boxer) box(ctx context.Context, messagePlaintext chat1.MessagePlaintext, encryptionKey types.CryptKey,
	ephemeralSeed *keybase1.TeamEk, signingKeyPair libkb.NaclSigningKeyPair, version chat1.MessageBoxedVersion,
	pairwiseMACRecipients []keybase1.KID) (*chat1.MessageBoxed, error) {
	err := b.preBoxCheck(ctx, messagePlaintext)
	if err != nil {
		return nil, err
	}

	switch version {
	case chat1.MessageBoxedVersion_V1:
		res, err := b.boxV1(messagePlaintext, encryptionKey, signingKeyPair)
		if err != nil {
			b.Debug(ctx, "error boxing message version: %v", version)
		}
		return res, err
	// V3 is the same as V2, except that it indicates exploding message
	// support. V4 is the same as V3, except that it signs with the zero key
	// when pairwise MACs are included.
	case chat1.MessageBoxedVersion_V2, chat1.MessageBoxedVersion_V3, chat1.MessageBoxedVersion_V4:
		res, err := b.boxV2orV3orV4(ctx, messagePlaintext, encryptionKey, ephemeralSeed, signingKeyPair, version, pairwiseMACRecipients)
		if err != nil {
			b.Debug(ctx, "error boxing message version: %v", version)
		}
		return res, err
	default:
		return nil, fmt.Errorf("invalid version for boxing: %v", version)
	}
}

// boxMessageWithKeys encrypts and signs a keybase1.MessagePlaintext into a
// chat1.MessageBoxed given a keybase1.CryptKey.
func (b *Boxer) boxV1(messagePlaintext chat1.MessagePlaintext, key types.CryptKey,
	signingKeyPair libkb.NaclSigningKeyPair) (*chat1.MessageBoxed, error) {

	body := chat1.BodyPlaintextV1{
		MessageBody: messagePlaintext.MessageBody,
	}
	plaintextBody := chat1.NewBodyPlaintextWithV1(body)
	encryptedBody, err := b.seal(plaintextBody, libkb.NaclSecretBoxKey(key.Material()))
	if err != nil {
		return nil, err
	}

	bodyHash := b.hashV1(encryptedBody.E)

	if messagePlaintext.ClientHeader.MerkleRoot != nil {
		return nil, fmt.Errorf("cannot box v1 message with merkle root")
	}

	// create the v1 header, adding hash
	header := chat1.HeaderPlaintextV1{
		Conv:              messagePlaintext.ClientHeader.Conv,
		TlfName:           messagePlaintext.ClientHeader.TlfName,
		TlfPublic:         messagePlaintext.ClientHeader.TlfPublic,
		MessageType:       messagePlaintext.ClientHeader.MessageType,
		Prev:              messagePlaintext.ClientHeader.Prev,
		Sender:            messagePlaintext.ClientHeader.Sender,
		SenderDevice:      messagePlaintext.ClientHeader.SenderDevice,
		MerkleRoot:        nil, // MerkleRoot cannot be sent in MBv1 messages
		BodyHash:          bodyHash[:],
		OutboxInfo:        messagePlaintext.ClientHeader.OutboxInfo,
		OutboxID:          messagePlaintext.ClientHeader.OutboxID,
		KbfsCryptKeysUsed: messagePlaintext.ClientHeader.KbfsCryptKeysUsed,
	}

	// sign the header and insert the signature
	sig, err := b.signMarshal(header, signingKeyPair, kbcrypto.SignaturePrefixChatMBv1)
	if err != nil {
		return nil, err
	}
	header.HeaderSignature = &sig

	// create a plaintext header
	plaintextHeader := chat1.NewHeaderPlaintextWithV1(header)
	encryptedHeader, err := b.seal(plaintextHeader, libkb.NaclSecretBoxKey(key.Material()))
	if err != nil {
		return nil, err
	}

	boxed := &chat1.MessageBoxed{
		Version:          chat1.MessageBoxedVersion_V1,
		ClientHeader:     messagePlaintext.ClientHeader,
		BodyCiphertext:   *encryptedBody,
		HeaderCiphertext: encryptedHeader.AsSealed(),
		KeyGeneration:    key.Generation(),
	}

	return boxed, nil
}

func makeOnePairwiseMAC(private libkb.NaclDHKeyPrivate, public libkb.NaclDHKeyPublic, input []byte) []byte {
	privKeyBytes := [32]byte(private)
	pubKeyBytes := [32]byte(public)
	var rawShared [32]byte
	box.Precompute(&rawShared, &pubKeyBytes, &privKeyBytes)
	derivedShared, err := libkb.DeriveFromSecret(rawShared, libkb.DeriveReasonChatPairwiseMAC)
	if err != nil {
		panic(err) // key derivation should never fail
	}
	hmacState := hmac.New(sha256.New, derivedShared[:])
	hmacState.Write(input)
	return hmacState.Sum(nil)
}

func (b *Boxer) makeAllPairwiseMACs(ctx context.Context, headerSealed chat1.SignEncryptedData, recipients []keybase1.KID) (macs map[keybase1.KID][]byte, err error) {
	defer b.G().CTraceTimed(ctx, fmt.Sprintf("makeAllPairwiseMACs with %d recipients", len(recipients)), func() error { return err })()

	pairwiseMACs := map[keybase1.KID][]byte{}
	headerHash, ierr := b.makeHeaderHash(headerSealed)
	if ierr != nil {
		return nil, ierr
	}
	deviceKeyNacl, err := b.G().ActiveDevice.NaclEncryptionKey()
	if err != nil {
		return nil, err
	}
	for _, recipientKID := range recipients {
		recipientKeyNacl, err := libkb.ImportDHKeypairFromKID(recipientKID)
		if err != nil {
			return nil, err
		}
		pairwiseMACs[recipientKID] = makeOnePairwiseMAC(*deviceKeyNacl.Private, recipientKeyNacl.Public, headerHash)
	}
	return pairwiseMACs, nil
}

// V3 is just V2 but with exploding messages support. V4 is just V3, but it
// signs with the zero key when pairwise MACs are included.
func (b *Boxer) boxV2orV3orV4(ctx context.Context, messagePlaintext chat1.MessagePlaintext, baseEncryptionKey types.CryptKey,
	ephemeralSeed *keybase1.TeamEk, signingKeyPair libkb.NaclSigningKeyPair,
	version chat1.MessageBoxedVersion, pairwiseMACRecipients []keybase1.KID) (*chat1.MessageBoxed, error) {

	if messagePlaintext.ClientHeader.MerkleRoot == nil {
		return nil, NewBoxingError("cannot send message without merkle root", false)
	}

	headerEncryptionKey, err := libkb.DeriveSymmetricKey(
		libkb.NaclSecretBoxKey(baseEncryptionKey.Material()), libkb.EncryptionReasonChatMessage)
	if err != nil {
		return nil, err
	}

	// Regular messages use the same encryption key for the header and for the
	// body. Exploding messages use a derived ephemeral key for the body.
	bodyEncryptionKey := headerEncryptionKey
	if messagePlaintext.IsEphemeral() {
		bodyEncryptionKey, err = libkb.DeriveFromSecret(ephemeralSeed.Seed, libkb.DeriveReasonTeamEKExplodingChat)
		if err != nil {
			return nil, err
		}
		// The MessagePlaintext supplied by the caller has a Lifetime, but we
		// expect the Generation is left uninitialized, and we set it here.
		messagePlaintext.ClientHeader.EphemeralMetadata.Generation = ephemeralSeed.Metadata.Generation
	}

	bodyVersioned := chat1.NewBodyPlaintextWithV1(chat1.BodyPlaintextV1{
		MessageBody: messagePlaintext.MessageBody,
	})
	bodyEncrypted, err := b.seal(bodyVersioned, bodyEncryptionKey)
	if err != nil {
		return nil, err
	}

	bodyHash, err := b.makeBodyHash(*bodyEncrypted)
	if err != nil {
		return nil, err
	}

	// create the v1 header, adding hash
	headerVersioned := chat1.NewHeaderPlaintextWithV1(chat1.HeaderPlaintextV1{
		Conv:              messagePlaintext.ClientHeader.Conv,
		TlfName:           messagePlaintext.ClientHeader.TlfName,
		TlfPublic:         messagePlaintext.ClientHeader.TlfPublic,
		MessageType:       messagePlaintext.ClientHeader.MessageType,
		Prev:              messagePlaintext.ClientHeader.Prev,
		Sender:            messagePlaintext.ClientHeader.Sender,
		SenderDevice:      messagePlaintext.ClientHeader.SenderDevice,
		BodyHash:          bodyHash,
		MerkleRoot:        messagePlaintext.ClientHeader.MerkleRoot,
		OutboxInfo:        messagePlaintext.ClientHeader.OutboxInfo,
		OutboxID:          messagePlaintext.ClientHeader.OutboxID,
		KbfsCryptKeysUsed: messagePlaintext.ClientHeader.KbfsCryptKeysUsed,
		EphemeralMetadata: messagePlaintext.ClientHeader.EphemeralMetadata,
		// In MessageBoxed.V2 HeaderSignature is nil.
		HeaderSignature: nil,
	})

	// signencrypt the header
	headerSealed, err := b.signEncryptMarshal(headerVersioned, headerEncryptionKey,
		signingKeyPair, kbcrypto.SignaturePrefixChatMBv2)
	if err != nil {
		return nil, err
	}

	// Make pairwise MACs if there are any pairwise recipients supplied. Note
	// that we still sign+encrypt with a signing key above. If we want
	// repudiability, it's the caller's responsibility to provide a zero
	// signing key or similar. Signing with a real key and also MAC'ing is
	// redundant, but it will let us test the MAC code in prod in a backwards
	// compatible way.
	if len(pairwiseMACRecipients) > 0 {
		pairwiseMACs, err := b.makeAllPairwiseMACs(ctx, headerSealed, pairwiseMACRecipients)
		if err != nil {
			return nil, err
		}
		messagePlaintext.ClientHeader.PairwiseMacs = pairwiseMACs
	}

	// verify
	verifyKey := signingKeyPair.GetBinaryKID()

	boxed := &chat1.MessageBoxed{
		Version:          version,
		ServerHeader:     nil,
		ClientHeader:     messagePlaintext.ClientHeader,
		HeaderCiphertext: headerSealed.AsSealed(),
		BodyCiphertext:   *bodyEncrypted,
		VerifyKey:        verifyKey,
		KeyGeneration:    baseEncryptionKey.Generation(),
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
func (b *Boxer) signMarshal(data interface{}, kp libkb.NaclSigningKeyPair, prefix kbcrypto.SignaturePrefix) (chat1.SignatureInfo, error) {
	encoded, err := b.marshal(data)
	if err != nil {
		return chat1.SignatureInfo{}, err
	}

	return b.sign(encoded, kp, prefix)
}

// signEncryptMarshal signencrypts data given an encryption and signing key, returning a chat1.SignEncryptedData.
// It marshals data before signing.
func (b *Boxer) signEncryptMarshal(data interface{}, encryptionKey libkb.NaclSecretBoxKey,
	signingKeyPair libkb.NaclSigningKeyPair, prefix kbcrypto.SignaturePrefix) (chat1.SignEncryptedData, error) {
	encoded, err := b.marshal(data)
	if err != nil {
		return chat1.SignEncryptedData{}, err
	}

	return b.signEncrypt(encoded, encryptionKey, signingKeyPair, prefix)
}

// sign signs msg with a NaclSigningKeyPair, returning a chat1.SignatureInfo.
func (b *Boxer) sign(msg []byte, kp libkb.NaclSigningKeyPair, prefix kbcrypto.SignaturePrefix) (chat1.SignatureInfo, error) {
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
	signingKeyPair libkb.NaclSigningKeyPair, prefix kbcrypto.SignaturePrefix) (chat1.SignEncryptedData, error) {
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
	verifyKID []byte, prefix kbcrypto.SignaturePrefix) ([]byte, error) {
	var encKey [signencrypt.SecretboxKeySize]byte = encryptionKey

	verifyKey := kbcrypto.KIDToNaclSigningKeyPublic(verifyKID)
	if verifyKey == nil {
		return nil, kbcrypto.BadKeyError{}
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
func (b *Boxer) verifyMessageV1(ctx context.Context, header chat1.HeaderPlaintext, msg chat1.MessageBoxed, skipBodyVerification bool) (verifyMessageRes, types.UnboxingError) {
	headerVersion, err := header.Version()
	if err != nil {
		return verifyMessageRes{}, NewPermanentUnboxingError(err)
	}

	switch headerVersion {
	case chat1.HeaderPlaintextVersion_V1:
		return b.verifyMessageHeaderV1(ctx, header.V1(), msg, skipBodyVerification)
	// NOTE: When adding new versions here, you must also update
	// chat1/extras.go so MessageUnboxedError.ParseableVersion understands the
	// new max version
	default:
		return verifyMessageRes{},
			NewPermanentUnboxingError(NewHeaderVersionError(headerVersion,
				b.headerUnsupported(ctx, headerVersion, header)))
	}
}

// verifyMessageHeaderV1 checks the body hash, header signature, and signing key validity.
func (b *Boxer) verifyMessageHeaderV1(ctx context.Context, header chat1.HeaderPlaintextV1, msg chat1.MessageBoxed, skipBodyVerification bool) (verifyMessageRes, types.UnboxingError) {
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
	if !b.verify(hpack, *header.HeaderSignature, kbcrypto.SignaturePrefixChatMBv1) {
		return verifyMessageRes{}, NewPermanentUnboxingError(libkb.BadSigError{E: "header signature invalid"})
	}

	return verifyMessageRes{
		senderDeviceRevokedAt: revoked,
	}, nil
}

// verify verifies the signature of data using SignatureInfo.
func (b *Boxer) verify(data []byte, si chat1.SignatureInfo, prefix kbcrypto.SignaturePrefix) bool {
	sigInfo := kbcrypto.NaclSigInfo{
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
func (b *Boxer) ValidSenderKey(ctx context.Context, sender gregor1.UID, key []byte, ctime gregor1.Time) (found, validAtCTime bool, revoked *gregor1.Time, unboxErr types.UnboxingError) {
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

	cachedUserLoader := CtxUPAKFinder(ctx, b.G())
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

// See note on compareHeadersMBV2orV3.
func (b *Boxer) compareHeadersMBV1(ctx context.Context, hServer chat1.MessageClientHeader, hSigned chat1.MessageClientHeaderVerified) types.UnboxingError {
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

	// Note: Supersedes, Deletes, and some other fields are not checked because they are not
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

	// _Don't_ check that the MerkleRoot's match.
	// The signed MerkleRoot should be nil as it was not part of the protocol
	// when clients were writing MBV1. But we just allow anything here.
	// There are V1 messages in the wild with hServer.MerkleRoot set but nothing signed.

	// OutboxID, OutboxInfo: Left unchecked as I'm not sure whether these hold in V1 messages.

	return nil
}

func (b *Boxer) CompareTlfNames(ctx context.Context, tlfName1, tlfName2 string,
	membersType chat1.ConversationMembersType, tlfPublic bool) (bool, error) {
	get1 := func(tlfName string, tlfPublic bool) (string, error) {
		nameInfo, err := CreateNameInfoSource(ctx, b.G(), membersType).LookupID(ctx, tlfName,
			tlfPublic)
		if err != nil {
			return "", err
		}
		return nameInfo.CanonicalName, nil
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
