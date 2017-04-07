package chat

import (
	"encoding/hex"
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/keybase/client/go/chat/msgchecker"
	"github.com/keybase/client/go/chat/storage"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/clockwork"
	context "golang.org/x/net/context"
)

type Sender interface {
	Send(ctx context.Context, convID chat1.ConversationID, msg chat1.MessagePlaintext, clientPrev chat1.MessageID) (chat1.OutboxID, chat1.MessageID, *chat1.RateLimit, error)
	Prepare(ctx context.Context, msg chat1.MessagePlaintext, convID *chat1.ConversationID) (*chat1.MessageBoxed, []chat1.Asset, error)
}

type BlockingSender struct {
	libkb.Contextified
	utils.DebugLabeler

	boxer *Boxer
	store *AttachmentStore
	getRi func() chat1.RemoteInterface
}

func NewBlockingSender(g *libkb.GlobalContext, boxer *Boxer, store *AttachmentStore,
	getRi func() chat1.RemoteInterface) *BlockingSender {
	return &BlockingSender{
		Contextified: libkb.NewContextified(g),
		DebugLabeler: utils.NewDebugLabeler(g, "BlockingSender", false),
		getRi:        getRi,
		boxer:        boxer,
		store:        store,
	}
}

func (s *BlockingSender) addSenderToMessage(msg chat1.MessagePlaintext) (chat1.MessagePlaintext, error) {
	uid := s.G().Env.GetUID()
	if uid.IsNil() {
		return chat1.MessagePlaintext{}, libkb.LoginRequiredError{}
	}
	did := s.G().Env.GetDeviceID()
	if did.IsNil() {
		return chat1.MessagePlaintext{}, libkb.DeviceRequiredError{}
	}

	huid := uid.ToBytes()
	if huid == nil {
		return chat1.MessagePlaintext{}, errors.New("invalid UID")
	}

	hdid := make([]byte, libkb.DeviceIDLen)
	if err := did.ToBytes(hdid); err != nil {
		return chat1.MessagePlaintext{}, err
	}

	header := msg.ClientHeader
	header.Sender = gregor1.UID(huid)
	header.SenderDevice = gregor1.DeviceID(hdid)
	updated := chat1.MessagePlaintext{
		ClientHeader: header,
		MessageBody:  msg.MessageBody,
	}
	return updated, nil
}

func (s *BlockingSender) addPrevPointersAndCheckConvID(ctx context.Context, msg chat1.MessagePlaintext,
	convID chat1.ConversationID) (chat1.MessagePlaintext, error) {

	// Make sure the caller hasn't already assembled this list. For now, this
	// should never happen, and we'll return an error just in case we make a
	// mistake in the future. But if there's some use case in the future where
	// a caller wants to specify custom prevs, we can relax this.
	if len(msg.ClientHeader.Prev) != 0 {
		return chat1.MessagePlaintext{}, fmt.Errorf("addPrevPointersToMessage expects an empty prev list")
	}

	var prevs []chat1.MessagePreviousPointer

	res, _, err := s.G().ConvSource.Pull(ctx, convID, msg.ClientHeader.Sender,
		&chat1.GetThreadQuery{
			DisableResolveSupersedes: true,
		},
		&chat1.Pagination{
			Num: 50,
		})
	if err != nil {
		return chat1.MessagePlaintext{}, err
	}

	if len(res.Messages) == 0 {
		s.Debug(ctx, "no local messages found for prev pointers")
	}
	prevs, err = CheckPrevPointersAndGetUnpreved(&res)
	if err != nil {
		return chat1.MessagePlaintext{}, err
	}

	if len(prevs) == 0 {
		return chat1.MessagePlaintext{}, fmt.Errorf("Could not find previous messsages for prev pointers (of %v)", len(res.Messages))
	}

	for _, msg2 := range res.Messages {
		if msg2.IsValid() {
			err = s.checkConvID(ctx, convID, msg, msg2)
			if err != nil {
				return chat1.MessagePlaintext{}, err
			}
		}
	}

	// Make an attempt to avoid changing anything in the input message. There
	// are a lot of shared pointers though, so this is
	header := msg.ClientHeader
	header.Prev = prevs
	updated := chat1.MessagePlaintext{
		ClientHeader: header,
		MessageBody:  msg.MessageBody,
	}
	return updated, nil
}

// Check that the {ConvID,ConvTriple,TlfName} of msgToSend matches both the ConvID and a an existing message from the questionable ConvID.
// This check is necessary because msgToSend may have been constructed with an untrusted Conv{ID,Triple}.
func (s *BlockingSender) checkConvID(ctx context.Context, convID chat1.ConversationID,
	msgToSend chat1.MessagePlaintext, msgReference chat1.MessageUnboxed) error {

	headerQ := msgToSend.ClientHeader
	headerRef := msgReference.Valid().ClientHeader

	fmtConv := func(conv chat1.ConversationIDTriple) string { return hex.EncodeToString(conv.Hash()) }

	if !headerQ.Conv.Derivable(convID) {
		s.Debug(ctx, "checkConvID: ConvID %s </- %s", fmtConv(headerQ.Conv), convID)
		return fmt.Errorf("ConversationID does not match reference message")
	}

	if !headerQ.Conv.Eq(headerRef.Conv) {
		s.Debug(ctx, "checkConvID: Conv %s != %s", fmtConv(headerQ.Conv), fmtConv(headerRef.Conv))
		return fmt.Errorf("ConversationID does not match reference message")
	}

	if headerQ.TlfPublic != headerRef.TlfPublic {
		s.Debug(ctx, "checkConvID: TlfPublic %s != %s", headerQ.TlfPublic, headerRef.TlfPublic)
		return fmt.Errorf("Chat public-ness does not match reference message")
	}
	if headerQ.TlfName != headerRef.TlfName {
		// Try normalizing both tlfnames if simple comparison fails because they may have resolved.
		namesEq, err := s.boxer.CompareTlfNames(ctx, headerQ.TlfName, headerRef.TlfName, headerQ.TlfPublic)
		if err != nil {
			return err
		}
		if !namesEq {
			s.Debug(ctx, "checkConvID: TlfName %s != %s", headerQ.TlfName, headerRef.TlfName)
			return fmt.Errorf("TlfName does not match reference message")
		}
	}

	return nil
}

// Get all messages to be deleted, and attachments to delete.
// Returns (message, assetsToDelete, error)
// If the entire conversation is cached locally, this will find all messages that should be deleted.
// If the conversation is not cached, this relies on the server to get old messages, so the server
// could omit messages. Those messages would then not be signed into the `Deletes` list. And their
// associated attachment assets would be left undeleted.
func (s *BlockingSender) getAllDeletedEdits(ctx context.Context, msg chat1.MessagePlaintext,
	convID chat1.ConversationID) (chat1.MessagePlaintext, []chat1.Asset, error) {

	var pendingAssetDeletes []chat1.Asset

	// Make sure this is a valid delete message
	if msg.ClientHeader.MessageType != chat1.MessageType_DELETE {
		return msg, nil, nil
	}

	deleteTargetID := msg.ClientHeader.Supersedes
	if deleteTargetID == 0 {
		return msg, nil, fmt.Errorf("getAllDeletedEdits: no supersedes specified")
	}

	// Get the one message to be deleted by ID.
	var uid gregor1.UID = s.G().Env.GetUID().ToBytes()
	deleteTargets, err := s.G().ConvSource.GetMessages(ctx, convID, uid, []chat1.MessageID{deleteTargetID}, nil)
	if err != nil {
		return msg, nil, err
	}
	if len(deleteTargets) != 1 {
		return msg, nil, fmt.Errorf("getAllDeletedEdits: wrong number of delete targets found (%v but expected 1)", len(deleteTargets))
	}
	deleteTarget := deleteTargets[0]
	state, err := deleteTarget.State()
	switch state {
	case chat1.MessageUnboxedState_VALID:
		// pass
	case chat1.MessageUnboxedState_ERROR:
		return msg, nil, fmt.Errorf("getAllDeletedEdits: delete target: %s", deleteTarget.Error().ErrMsg)
	case chat1.MessageUnboxedState_OUTBOX:
		// TODO You should be able to delete messages that haven't been sent yet. But through a different mechanism.
		return msg, nil, fmt.Errorf("getAllDeletedEdits: delete target still in outbox")
	default:
		return msg, nil, fmt.Errorf("getAllDeletedEdits: delete target invalid (state:%v)", state)
	}

	// Delete all assets on the deleted message.
	// assetsForMessage logs instead of failing.
	pads2, err := s.assetsForMessage(ctx, deleteTarget.Valid().MessageBody)
	if err != nil {
		return msg, nil, err
	}
	pendingAssetDeletes = append(pendingAssetDeletes, pads2...)

	// Time of the first message to be deleted.
	timeOfFirst := gregor1.FromTime(deleteTarget.Valid().ServerHeader.Ctime)
	// Time a couple seconds before that, because After querying is exclusive.
	timeBeforeFirst := gregor1.ToTime(timeOfFirst.Add(-2 * time.Second))

	// Get all the affected edits/AUs since just before the delete target.
	// Use ConvSource with an `After` which query. Fetches from a combination of local cache
	// and the server. This is an opportunity for the server to retain messages that should
	// have been deleted without getting caught.
	tv, _, err := s.G().ConvSource.Pull(ctx, convID, msg.ClientHeader.Sender, &chat1.GetThreadQuery{
		MarkAsRead:   false,
		MessageTypes: []chat1.MessageType{chat1.MessageType_EDIT, chat1.MessageType_ATTACHMENTUPLOADED},
		After:        &timeBeforeFirst,
	}, nil)
	if err != nil {
		return msg, nil, err
	}

	// Get all affected messages to be deleted
	deletes := []chat1.MessageID{deleteTargetID}
	for _, m := range tv.Messages {
		if !m.IsValid() {
			continue
		}
		body := m.Valid().MessageBody
		typ, err := body.MessageType()
		if err != nil {
			s.Debug(ctx, "getAllDeletedEdits: error getting message type: convID: %s msgID: %d err: %s", convID, m.GetMessageID(), err.Error())
			continue
		}
		switch typ {
		case chat1.MessageType_EDIT:
			if body.Edit().MessageID == deleteTargetID {
				deletes = append(deletes, m.GetMessageID())
			}
		case chat1.MessageType_ATTACHMENTUPLOADED:
			if body.Attachmentuploaded().MessageID == deleteTargetID {
				deletes = append(deletes, m.GetMessageID())

				// Delete all assets on AttachmentUploaded's for the deleted message.
				// assetsForMessage logs instead of failing.
				pads2, err = s.assetsForMessage(ctx, body)
				if err != nil {
					return msg, nil, err
				}
				pendingAssetDeletes = append(pendingAssetDeletes, pads2...)
			}
		default:
			s.Debug(ctx, "getAllDeletedEdits: unexpected message type: convID: %s msgID: %d typ: %v", convID, m.GetMessageID(), typ)
			continue
		}
	}

	// Modify original delete message
	msg.ClientHeader.Deletes = deletes
	// NOTE: If we ever add more fields to MessageDelete, we'll need to be
	//       careful to preserve them here.
	msg.MessageBody = chat1.NewMessageBodyWithDelete(chat1.MessageDelete{MessageIDs: deletes})

	return msg, pendingAssetDeletes, nil
}

// assetsForMessage gathers all assets on a message
func (s *BlockingSender) assetsForMessage(ctx context.Context, msgBody chat1.MessageBody) ([]chat1.Asset, error) {
	var assets []chat1.Asset
	typ, err := msgBody.MessageType()
	if err != nil {
		// Log and drop the error for a malformed MessageBody.
		s.G().Log.Warning("error getting assets for message: %s", err)
		return assets, nil
	}
	switch typ {
	case chat1.MessageType_ATTACHMENT:
		body := msgBody.Attachment()
		if body.Object.Path != "" {
			assets = append(assets, body.Object)
		}
		if body.Preview != nil {
			assets = append(assets, *body.Preview)
		}
		assets = append(assets, body.Previews...)
	case chat1.MessageType_ATTACHMENTUPLOADED:
		body := msgBody.Attachmentuploaded()
		if body.Object.Path != "" {
			assets = append(assets, body.Object)
		}
		assets = append(assets, body.Previews...)
	}
	return assets, nil
}

// Prepare a message to be sent.
// Returns (boxedMessage, pendingAssetDeletes, error)
func (s *BlockingSender) Prepare(ctx context.Context, plaintext chat1.MessagePlaintext, convID *chat1.ConversationID) (*chat1.MessageBoxed, []chat1.Asset, error) {
	// Make sure it is a proper length
	if err := msgchecker.CheckMessagePlaintext(plaintext); err != nil {
		return nil, nil, err
	}

	msg, err := s.addSenderToMessage(plaintext)
	if err != nil {
		return nil, nil, err
	}

	// convID will be nil in makeFirstMessage
	if convID != nil {
		msg, err = s.addPrevPointersAndCheckConvID(ctx, msg, *convID)
		if err != nil {
			return nil, nil, err
		}
	}

	// Make sure our delete message gets everything it should
	var pendingAssetDeletes []chat1.Asset
	if convID != nil {
		// Be careful not to shadow (msg, pendingAssetDeletes) with this assignment.
		msg, pendingAssetDeletes, err = s.getAllDeletedEdits(ctx, msg, *convID)
		if err != nil {
			return nil, nil, err
		}
	}

	// encrypt the message
	skp, err := s.getSigningKeyPair(ctx)
	if err != nil {
		return nil, nil, err
	}

	// For now, BoxMessage canonicalizes the TLF name. We should try to refactor
	// it a bit to do it here.
	boxed, err := s.boxer.BoxMessage(ctx, msg, skp)
	if err != nil {
		return nil, nil, err
	}

	return boxed, pendingAssetDeletes, nil
}

func (s *BlockingSender) getSigningKeyPair(ctx context.Context) (kp libkb.NaclSigningKeyPair, err error) {
	// get device signing key for this user
	signingKey, err := engine.GetMySecretKey(ctx, s.G(), storage.DefaultSecretUI,
		libkb.DeviceSigningKeyType, "sign chat message")
	if err != nil {
		return libkb.NaclSigningKeyPair{}, err
	}
	kp, ok := signingKey.(libkb.NaclSigningKeyPair)
	if !ok || kp.Private == nil {
		return libkb.NaclSigningKeyPair{}, libkb.KeyCannotSignError{}
	}

	return kp, nil
}

// deleteAssets deletes assets from s3.
// Logs but does not return errors. Assets may be left undeleted.
func (s *BlockingSender) deleteAssets(ctx context.Context, convID chat1.ConversationID, assets []chat1.Asset) error {
	ri := s.getRi()
	if ri == nil {
		return fmt.Errorf("deleteAssets(): no remote client found")
	}

	// get s3 params from server
	params, err := s.getRi().GetS3Params(ctx, convID)
	if err != nil {
		s.G().Log.Warning("error getting s3 params: %s", err)
		return nil
	}

	if err := s.store.DeleteAssets(ctx, params, s, assets); err != nil {
		s.G().Log.Warning("error deleting assets: %s", err)

		// there's no way to get asset information after this point.
		// any assets not deleted will be stranded on s3.

		return nil
	}

	s.G().Log.Debug("deleted %d assets", len(assets))
	return nil
}

// Sign implements github.com/keybase/go/chat/s3.Signer interface.
func (s *BlockingSender) Sign(payload []byte) ([]byte, error) {
	ri := s.getRi()
	if ri == nil {
		return nil, fmt.Errorf("Sign(): no remote client found")
	}
	arg := chat1.S3SignArg{
		Payload: payload,
		Version: 1,
	}
	return ri.S3Sign(context.Background(), arg)
}

func (s *BlockingSender) Send(ctx context.Context, convID chat1.ConversationID,
	msg chat1.MessagePlaintext, clientPrev chat1.MessageID) (chat1.OutboxID, chat1.MessageID, *chat1.RateLimit, error) {

	// Add a bunch of stuff to the message (like prev pointers, sender info, ...)
	boxed, pendingAssetDeletes, err := s.Prepare(ctx, msg, &convID)
	if err != nil {
		s.Debug(ctx, "error in Prepare: %s", err.Error())
		return chat1.OutboxID{}, 0, nil, err
	}

	ri := s.getRi()
	if ri == nil {
		return chat1.OutboxID{}, 0, nil, fmt.Errorf("Send(): no remote client found")
	}

	// Delete assets associated with a delete operation.
	// Logs instead of returning an error. Assets can be left undeleted.
	if len(pendingAssetDeletes) > 0 {
		err = s.deleteAssets(ctx, convID, pendingAssetDeletes)
		if err != nil {
			return chat1.OutboxID{}, 0, nil, err
		}
	}

	rarg := chat1.PostRemoteArg{
		ConversationID: convID,
		MessageBoxed:   *boxed,
	}
	plres, err := ri.PostRemote(ctx, rarg)
	if err != nil {
		return chat1.OutboxID{}, 0, nil, err
	}
	boxed.ServerHeader = &plres.MsgHeader

	// Write new message out to cache
	if _, _, err = s.G().ConvSource.Push(ctx, convID, msg.ClientHeader.Sender, *boxed); err != nil {
		return chat1.OutboxID{}, 0, nil, err
	}
	if _, err = s.G().InboxSource.NewMessage(ctx, boxed.ClientHeader.Sender, 0, convID, *boxed); err != nil {
		return chat1.OutboxID{}, 0, nil, err
	}

	return []byte{}, plres.MsgHeader.MessageID, plres.RateLimit, nil
}

const deliverMaxAttempts = 5

type DelivererInfoError interface {
	IsImmediateFail() (chat1.OutboxErrorType, bool)
}

type Deliverer struct {
	libkb.Contextified
	sync.Mutex
	utils.DebugLabeler

	sender        Sender
	outbox        *storage.Outbox
	identNotifier *IdentifyNotifier
	shutdownCh    chan chan struct{}
	msgSentCh     chan struct{}
	reconnectCh   chan struct{}
	delivering    bool
	connected     bool
	clock         clockwork.Clock
}

func NewDeliverer(g *libkb.GlobalContext, sender Sender) *Deliverer {
	d := &Deliverer{
		Contextified:  libkb.NewContextified(g),
		DebugLabeler:  utils.NewDebugLabeler(g, "Deliverer", false),
		shutdownCh:    make(chan chan struct{}, 1),
		msgSentCh:     make(chan struct{}, 100),
		reconnectCh:   make(chan struct{}, 100),
		sender:        sender,
		identNotifier: NewIdentifyNotifier(g),
		clock:         clockwork.NewRealClock(),
	}

	g.PushShutdownHook(func() error {
		d.Stop(context.Background())
		return nil
	})

	return d
}

func (s *Deliverer) Start(ctx context.Context, uid gregor1.UID) {
	s.Lock()
	defer s.Unlock()

	<-s.doStop(ctx)

	s.outbox = storage.NewOutbox(s.G(), uid)
	s.outbox.SetClock(s.clock)

	s.delivering = true
	go s.deliverLoop()
}

func (s *Deliverer) Stop(ctx context.Context) chan struct{} {
	s.Lock()
	defer s.Unlock()
	return s.doStop(ctx)
}

func (s *Deliverer) doStop(ctx context.Context) chan struct{} {
	cb := make(chan struct{})
	if s.delivering {
		s.Debug(ctx, "stopping")
		s.shutdownCh <- cb
		s.delivering = false
		return cb
	}

	close(cb)
	return cb
}

func (s *Deliverer) ForceDeliverLoop(ctx context.Context) {
	s.Debug(ctx, "force deliver loop invoked")
	s.msgSentCh <- struct{}{}
}

func (s *Deliverer) SetSender(sender Sender) {
	s.sender = sender
}

func (s *Deliverer) SetClock(clock clockwork.Clock) {
	s.clock = clock
}

func (s *Deliverer) Connected(ctx context.Context) {
	s.connected = true

	// Wake up deliver loop on reconnect
	s.Debug(ctx, "reconnected: forcing deliver loop run")
	s.reconnectCh <- struct{}{}
}

func (s *Deliverer) Disconnected(ctx context.Context) {
	s.Debug(ctx, "disconnected: all errors from now on will be permanent")
	s.connected = false
}

func (s *Deliverer) IsOffline() bool {
	return !s.connected
}

func (s *Deliverer) Queue(ctx context.Context, convID chat1.ConversationID, msg chat1.MessagePlaintext,
	identifyBehavior keybase1.TLFIdentifyBehavior) (chat1.OutboxRecord, error) {

	s.Debug(ctx, "queued new message: convID: %s uid: %s ident: %v", convID, s.outbox.GetUID(),
		identifyBehavior)

	// Push onto outbox and immediatley return
	obr, err := s.outbox.PushMessage(ctx, convID, msg, identifyBehavior)
	if err != nil {
		return obr, err
	}

	// Alert the deliver loop it should wake up
	s.msgSentCh <- struct{}{}

	return obr, nil
}

func (s *Deliverer) doNotRetryFailure(obr chat1.OutboxRecord, err error) (chat1.OutboxErrorType, bool) {

	if !s.connected {
		return chat1.OutboxErrorType_OFFLINE, true
	}

	// Check for an identify error
	if berr, ok := err.(DelivererInfoError); ok {
		if typ, ok := berr.IsImmediateFail(); ok {
			return typ, true
		}
	}

	// Check attempts otherwise
	if obr.State.Sending() > deliverMaxAttempts {
		return chat1.OutboxErrorType_MISC, true
	}

	return 0, false
}

func (s *Deliverer) failMessage(ctx context.Context, obr chat1.OutboxRecord,
	oserr chat1.OutboxStateError) error {

	if err := s.outbox.MarkAsError(ctx, obr, oserr); err != nil {
		s.Debug(ctx, "unable to mark as error on outbox: uid: %s err: %s",
			s.outbox.GetUID(), err.Error())
		return err
	}

	obr.State = chat1.NewOutboxStateWithError(oserr)
	act := chat1.NewChatActivityWithFailedMessage(chat1.FailedMessageInfo{
		OutboxRecords: []chat1.OutboxRecord{obr},
	})
	s.G().NotifyRouter.HandleNewChatActivity(context.Background(),
		keybase1.UID(s.outbox.GetUID().String()), &act)

	return nil
}

func (s *Deliverer) deliverLoop() {
	bgctx := context.Background()
	s.Debug(bgctx, "starting non blocking sender deliver loop: uid: %s duration: %v",
		s.outbox.GetUID(), s.G().Env.GetChatDelivererInterval())
	for {
		// Wait for the signal to take action
		select {
		case cb := <-s.shutdownCh:
			s.Debug(bgctx, "shuttting down outbox deliver loop: uid: %s", s.outbox.GetUID())
			defer close(cb)
			return
		case <-s.reconnectCh:
			s.Debug(bgctx, "flushing outbox on reconnect: uid: %s", s.outbox.GetUID())
		case <-s.msgSentCh:
			s.Debug(bgctx, "flushing outbox on new message: uid: %s", s.outbox.GetUID())
		case <-s.G().Clock().After(s.G().Env.GetChatDelivererInterval()):
		}

		// Fetch outbox
		obrs, err := s.outbox.PullAllConversations(bgctx, false, true)
		if err != nil {
			if _, ok := err.(storage.MissError); !ok {
				s.Debug(bgctx, "unable to pull outbox: uid: %s err: %s", s.outbox.GetUID(),
					err.Error())
			}
			continue
		}
		if len(obrs) > 0 {
			s.Debug(bgctx, "flushing %d items from the outbox: uid: %s", len(obrs), s.outbox.GetUID())
		}

		// Send messages
		var breaks []keybase1.TLFIdentifyFailure
		for _, obr := range obrs {

			bctx := Context(context.Background(), obr.IdentifyBehavior, &breaks, s.identNotifier)
			if !s.connected {
				err = errors.New("disconnected from chat server")
			} else {
				_, _, _, err = s.sender.Send(bctx, obr.ConvID, obr.Msg, 0)
			}
			if err != nil {
				s.Debug(bgctx, "failed to send msg: uid: %s convID: %s err: %s attempts: %d",
					s.outbox.GetUID(), obr.ConvID, err.Error(), obr.State.Sending())

				// Process failure. If we determine that the message is unrecoverable, then bail out.
				if errTyp, ok := s.doNotRetryFailure(obr, err); ok {
					// Record failure if we hit this case, and put the rest of this loop in a
					// mode where all other entries also fail.
					s.Debug(bgctx, "failure condition reached, marking all as errors and notifying: errTyp: %v attempts: %d", errTyp, obr.State.Sending())

					if err := s.failMessage(bgctx, obr, chat1.OutboxStateError{
						Message: err.Error(),
						Typ:     errTyp,
					}); err != nil {
						s.Debug(bgctx, "unable to fail message: err: %s", err.Error())
					}

				} else {
					if err = s.outbox.RecordFailedAttempt(bgctx, obr); err != nil {
						s.Debug(bgctx, "unable to record failed attempt on outbox: uid %s err: %s",
							s.outbox.GetUID(), err.Error())
					}
				}
			}
		}
	}
}

type NonblockingSender struct {
	libkb.Contextified
	sender Sender
}

func NewNonblockingSender(g *libkb.GlobalContext, sender Sender) *NonblockingSender {
	s := &NonblockingSender{
		Contextified: libkb.NewContextified(g),
		sender:       sender,
	}
	return s
}

func (s *NonblockingSender) Prepare(ctx context.Context, plaintext chat1.MessagePlaintext, convID *chat1.ConversationID) (*chat1.MessageBoxed, []chat1.Asset, error) {
	return s.sender.Prepare(ctx, plaintext, convID)
}

func (s *NonblockingSender) Send(ctx context.Context, convID chat1.ConversationID,
	msg chat1.MessagePlaintext, clientPrev chat1.MessageID) (chat1.OutboxID, chat1.MessageID, *chat1.RateLimit, error) {

	msg.ClientHeader.OutboxInfo = &chat1.OutboxInfo{
		Prev:        clientPrev,
		ComposeTime: gregor1.ToTime(time.Now()),
	}

	identifyBehavior, _, _ := IdentifyMode(ctx)
	obr, err := s.G().MessageDeliverer.Queue(ctx, convID, msg, identifyBehavior)
	return obr.OutboxID, 0, &chat1.RateLimit{}, err
}
