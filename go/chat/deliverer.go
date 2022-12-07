package chat

import (
	"context"
	"errors"
	"fmt"
	"net"
	"sync"
	"time"

	"github.com/keybase/client/go/chat/attachments"
	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/storage"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/clockwork"
	"golang.org/x/sync/errgroup"
)

const deliverMaxAttempts = 180           // fifteen minutes in default mode
const deliverDisconnectLimitMinutes = 10 // need to be offline for at least 10 minutes before auto failing a send

type DelivererInfoError interface {
	IsImmediateFail() (chat1.OutboxErrorType, bool)
}

type senderError struct {
	msg       string
	permanent bool
}

func newSenderError(msg string, permanent bool) *senderError {
	return &senderError{
		msg:       msg,
		permanent: permanent,
	}
}

func (e *senderError) Error() string {
	return fmt.Sprintf("senderError: %v, permanent: %v", e.msg, e.permanent)
}

func (e *senderError) IsImmediateFail() (chat1.OutboxErrorType, bool) {
	return chat1.OutboxErrorType_MISC, e.permanent
}

// delivererExpireError is used when a message fails because it has languished
// in the outbox for too long.
type delivererExpireError struct{}

func (e delivererExpireError) Error() string {
	return "message failed to send"
}

func (e delivererExpireError) IsImmediateFail() (chat1.OutboxErrorType, bool) {
	return chat1.OutboxErrorType_EXPIRED, true
}

type Deliverer struct {
	globals.Contextified
	sync.Mutex
	utils.DebugLabeler

	sender           types.Sender
	serverConn       types.ServerConnection
	outbox           *storage.Outbox
	identNotifier    types.IdentifyNotifier
	shutdownCh       chan struct{}
	msgSentCh        chan struct{}
	reconnectCh      chan struct{}
	kbfsDeliverQueue chan chat1.OutboxRecord
	delivering       bool
	connected        bool
	disconnTime      time.Time
	clock            clockwork.Clock
	eg               errgroup.Group

	notifyFailureChsMu sync.Mutex
	notifyFailureChs   map[string]chan []chat1.OutboxRecord

	// Testing
	testingNameInfoSource types.NameInfoSource
}

var _ types.MessageDeliverer = (*Deliverer)(nil)

func NewDeliverer(g *globals.Context, sender types.Sender, serverConn types.ServerConnection) *Deliverer {
	d := &Deliverer{
		Contextified:     globals.NewContextified(g),
		DebugLabeler:     utils.NewDebugLabeler(g.ExternalG(), "Deliverer", false),
		msgSentCh:        make(chan struct{}, 100),
		reconnectCh:      make(chan struct{}, 100),
		kbfsDeliverQueue: make(chan chat1.OutboxRecord, 100),
		sender:           sender,
		identNotifier:    NewCachingIdentifyNotifier(g),
		clock:            clockwork.NewRealClock(),
		notifyFailureChs: make(map[string]chan []chat1.OutboxRecord),
		serverConn:       serverConn,
	}

	d.identNotifier.ResetOnGUIConnect()
	return d
}

func (s *Deliverer) setTestingNameInfoSource(ni types.NameInfoSource) {
	s.testingNameInfoSource = ni
}

func (s *Deliverer) presentUIItem(ctx context.Context, uid gregor1.UID, conv *chat1.ConversationLocal) (res *chat1.InboxUIItem) {
	if conv != nil {
		pc := utils.PresentConversationLocal(ctx, s.G(), uid, *conv, utils.PresentParticipantsModeSkip)
		res = &pc
	}
	return res
}

func (s *Deliverer) Start(ctx context.Context, uid gregor1.UID) {
	s.Lock()
	defer s.Unlock()

	<-s.doStop(ctx)
	s.outbox = storage.NewOutbox(s.G(), uid,
		storage.PendingPreviewer(func(ctx context.Context, obr *chat1.OutboxRecord) error {
			return attachments.AddPendingPreview(ctx, s.G(), obr)
		}),
		storage.NewMessageNotifier(func(ctx context.Context, obr chat1.OutboxRecord) {
			uid := obr.Msg.ClientHeader.Sender
			convID := obr.ConvID

			// fill in reply
			msg, err := NewReplyFiller(s.G()).FillSingle(ctx, uid, convID,
				chat1.NewMessageUnboxedWithOutbox(obr))
			if err != nil {
				s.Debug(ctx, "outboxNotify: failed to get replyto: %s", err)
			} else {
				obr.ReplyTo = &msg
			}
			emojiText := obr.Msg.MessageBody.TextForDecoration()
			if len(emojiText) > 0 {
				if obr.Msg.Emojis, err = s.G().EmojiSource.Harvest(ctx, emojiText,
					uid, convID, types.EmojiHarvestModeFast); err != nil {
					s.Debug(ctx, "outboxNotify: failed to get emojis: %s", err)
				}
			}

			act := chat1.NewChatActivityWithIncomingMessage(chat1.IncomingMessage{
				Message: utils.PresentMessageUnboxed(ctx, s.G(), chat1.NewMessageUnboxedWithOutbox(obr),
					uid, convID),
				ConvID: convID,
			})
			s.G().ActivityNotifier.Activity(ctx, uid, obr.Msg.ClientHeader.Conv.TopicType, &act,
				chat1.ChatActivitySource_LOCAL)
		}))
	s.outbox.SetClock(s.clock)

	s.delivering = true
	s.shutdownCh = make(chan struct{})
	s.eg.Go(func() error { return s.deliverLoop(s.shutdownCh) })
	s.eg.Go(func() error { return s.kbfsDeliverLoop(s.shutdownCh) })
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
		close(s.shutdownCh)
		s.delivering = false
		go func() {
			if err := s.eg.Wait(); err != nil {
				s.Debug(ctx, "unable to stop loops: %v", err)
			}
			close(cb)
		}()
		return cb
	}
	close(cb)
	return cb
}

func (s *Deliverer) ForceDeliverLoop(ctx context.Context) {
	s.Debug(ctx, "force deliver loop invoked")
	s.msgSentCh <- struct{}{}
}

func (s *Deliverer) SetSender(sender types.Sender) {
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
	s.disconnTime = s.clock.Now()
}

func (s *Deliverer) disconnectedTime() time.Duration {
	if s.connected {
		return 0
	}
	return s.clock.Now().Sub(s.disconnTime)
}

func (s *Deliverer) IsOffline(ctx context.Context) bool {
	return !s.connected
}

func (s *Deliverer) IsDelivering() bool {
	s.Lock()
	defer s.Unlock()
	return s.delivering
}

func (s *Deliverer) Queue(ctx context.Context, convID chat1.ConversationID, msg chat1.MessagePlaintext,
	outboxID *chat1.OutboxID, sendOpts *chat1.SenderSendOptions, prepareOpts *chat1.SenderPrepareOptions,
	identifyBehavior keybase1.TLFIdentifyBehavior) (obr chat1.OutboxRecord, err error) {
	defer s.Trace(ctx, &err, "Queue")()

	// KBFSFILEEDIT msgs skip the traditional outbox
	if msg.ClientHeader.Conv.TopicType == chat1.TopicType_KBFSFILEEDIT {
		obr := chat1.OutboxRecord{
			ConvID: convID,
			Msg:    msg,
		}
		select {
		case s.kbfsDeliverQueue <- obr:
		default:
			s.Debug(ctx, "unable to deliver, kbfs queue full: %v", convID)
		}
		return obr, nil
	}

	// Push onto outbox and immediately return
	obr, err = s.outbox.PushMessage(ctx, convID, msg, outboxID, sendOpts, prepareOpts, identifyBehavior)
	if err != nil {
		return obr, err
	}
	s.Debug(ctx, "Queue: queued new message: convID: %s outboxID: %s uid: %s ident: %v", convID,
		obr.OutboxID, s.outbox.GetUID(), identifyBehavior)

	// Alert the deliver loop it should wake up
	s.msgSentCh <- struct{}{}
	// Only update mtime badgable messages
	if obr.Msg.IsBadgableType() {
		go func(ctx context.Context) {
			update := []chat1.LocalMtimeUpdate{{ConvID: convID, Mtime: obr.Ctime}}
			if err := s.G().InboxSource.UpdateLocalMtime(ctx, s.outbox.GetUID(), update); err != nil {
				s.Debug(ctx, "Queue: unable to update local mtime %v", obr.Ctime.Time())
			}
			time.Sleep(250 * time.Millisecond)
			s.G().InboxSource.NotifyUpdate(ctx, s.outbox.GetUID(), convID)
		}(globals.BackgroundChatCtx(ctx, s.G()))
	}
	return obr, nil
}

func (s *Deliverer) ActiveDeliveries(ctx context.Context) (res []chat1.OutboxRecord, err error) {
	defer s.Trace(ctx, &err, "ActiveDeliveries")()
	if !s.IsDelivering() {
		s.Debug(ctx, "ActiveDeliveries: not delivering, returning empty")
		return nil, nil
	}
	obrs, err := s.outbox.PullAllConversations(ctx, false, false)
	if err != nil {
		s.Debug(ctx, "ActiveDeliveries: failed to pull convs: %s", err)
		return res, err
	}

	for _, obr := range obrs {
		styp, err := obr.State.State()
		if err != nil {
			s.Debug(ctx, "ActiveDeliveries: bogus state: outboxID: %s err: %s", obr.OutboxID, err)
			continue
		}
		if styp == chat1.OutboxStateType_SENDING {
			res = append(res, obr)
		}
	}
	return res, nil
}

func (s *Deliverer) NextFailure() (chan []chat1.OutboxRecord, func()) {
	s.notifyFailureChsMu.Lock()
	defer s.notifyFailureChsMu.Unlock()
	ch := make(chan []chat1.OutboxRecord, 1)
	id := libkb.RandStringB64(3)
	s.notifyFailureChs[id] = ch
	return ch, func() {
		s.notifyFailureChsMu.Lock()
		defer s.notifyFailureChsMu.Unlock()
		delete(s.notifyFailureChs, id)
	}
}

func (s *Deliverer) alertFailureChannels(obrs []chat1.OutboxRecord) {
	s.notifyFailureChsMu.Lock()
	defer s.notifyFailureChsMu.Unlock()
	for _, ch := range s.notifyFailureChs {
		ch <- obrs
	}
	s.notifyFailureChs = make(map[string]chan []chat1.OutboxRecord)
}

func (s *Deliverer) doNotRetryFailure(ctx context.Context, obr chat1.OutboxRecord, err error) (resType chat1.OutboxErrorType, resErr error, resFail bool) {
	defer func() {
		if resErr != nil && resFail {
			s.Debug(ctx, "doNotRetryFailure: sending back to not retry: err: %s: typ: %T", resErr, resErr)
		}
	}()
	// Check attempts
	if obr.State.Sending() >= deliverMaxAttempts {
		return chat1.OutboxErrorType_TOOMANYATTEMPTS, errors.New("max send attempts reached"), true
	}
	if !s.connected {
		// Check to see how long we have been disconnected to see if this
		// should be retried
		if disconnTime := s.disconnectedTime(); disconnTime.Minutes() > deliverDisconnectLimitMinutes {
			s.Debug(ctx, "doNotRetryFailure: not retrying offline failure, disconnected for: %v",
				disconnTime)
			return chat1.OutboxErrorType_OFFLINE, err, true
		}
	}
	// Check for any errors that should cause us to give up right away
	switch berr := err.(type) {
	case types.UnboxingError:
		return chat1.OutboxErrorType_MISC, err, berr.IsPermanent()
	case DelivererInfoError:
		if typ, ok := berr.IsImmediateFail(); ok {
			return typ, err, true
		}
		return 0, err, false
	case net.Error:
		s.Debug(ctx, "doNotRetryFailure: generic net error, reconnecting to the server: %s(%T)", berr, berr)
		if _, rerr := s.serverConn.Reconnect(ctx); rerr != nil {
			s.Debug(ctx, "doNotRetryFailure: failed to reconnect: %s", rerr)
		}
		return chat1.OutboxErrorType_OFFLINE, err, !berr.Temporary() //nolint
	}
	switch err {
	case ErrChatServerTimeout, ErrDuplicateConnection, ErrKeyServerTimeout:
		return 0, err, false
	}
	return 0, err, true
}

func (s *Deliverer) failMessage(ctx context.Context, obr chat1.OutboxRecord,
	oserr chat1.OutboxStateError) (err error) {
	var marked []chat1.OutboxRecord
	uid := s.outbox.GetUID()
	convID := obr.ConvID
	switch oserr.Typ {
	case chat1.OutboxErrorType_TOOMANYATTEMPTS:
		s.Debug(ctx, "failMessage: too many attempts failure, marking conv as failed")
		if marked, err = s.outbox.MarkConvAsError(ctx, convID, oserr); err != nil {
			s.Debug(ctx, "failMessage: unable to mark conv as error on outbox: uid: %s convID: %v, err: %v",
				s.outbox.GetUID(), obr.ConvID, err)
			return err
		}
	case chat1.OutboxErrorType_DUPLICATE, chat1.OutboxErrorType_ALREADY_DELETED:
		// Here we don't send a notification to the frontend, we just want
		// these to go away
		if _, err = s.outbox.RemoveMessage(ctx, obr.OutboxID); err != nil {
			s.Debug(ctx, "deliverLoop: failed to remove duplicate delete msg: %v", err)
			return err
		}
	default:
		var m chat1.OutboxRecord
		if m, err = s.outbox.MarkAsError(ctx, obr, oserr); err != nil {
			s.Debug(ctx, "failMessage: unable to mark as error: %v", err)
			return err
		}
		marked = []chat1.OutboxRecord{m}
	}

	if len(marked) > 0 {
		convLocal, err := s.G().InboxSource.IncrementLocalConvVersion(ctx, uid, convID)
		if err != nil {
			s.Debug(ctx, "failMessage: failed to get IncrementLocalConvVersion")
		}
		act := chat1.NewChatActivityWithFailedMessage(chat1.FailedMessageInfo{
			OutboxRecords: marked,
			Conv:          s.presentUIItem(ctx, uid, convLocal),
		})
		s.G().ActivityNotifier.Activity(context.Background(), uid, chat1.TopicType_NONE, &act,
			chat1.ChatActivitySource_LOCAL)
		s.alertFailureChannels(marked)
		if err := s.G().Badger.Send(context.Background()); err != nil {
			s.Debug(ctx, "failMessage: unable to update badger: %v", err)
			return err
		}
	}
	return nil
}

type delivererBackgroundTaskError struct {
	Typ string
}

var _ (DelivererInfoError) = (*delivererBackgroundTaskError)(nil)

func (e delivererBackgroundTaskError) Error() string {
	return fmt.Sprintf("%s in progress", e.Typ)
}

func (e delivererBackgroundTaskError) IsImmediateFail() (chat1.OutboxErrorType, bool) {
	return chat1.OutboxErrorType_MISC, false
}

var errDelivererUploadInProgress = delivererBackgroundTaskError{Typ: "attachment upload"}
var errDelivererUnfurlInProgress = delivererBackgroundTaskError{Typ: "unfurl"}
var errDelivererFlipConvCreationInProgress = delivererBackgroundTaskError{Typ: "flip"}

func (s *Deliverer) processAttachment(ctx context.Context, obr chat1.OutboxRecord) (chat1.OutboxRecord, error) {
	if !obr.IsAttachment() {
		return obr, nil
	}
	status, res, err := s.G().AttachmentUploader.Status(ctx, obr.OutboxID)
	if err != nil {
		return obr, NewAttachmentUploadError(err.Error(), false)
	}
	switch status {
	case types.AttachmentUploaderTaskStatusSuccess:
		// Modify the attachment message
		att := chat1.MessageAttachment{
			Object:   res.Object,
			Metadata: res.Metadata,
			Uploaded: true,
			Preview:  res.Preview,
		}
		if res.Preview != nil {
			att.Previews = []chat1.Asset{*res.Preview}
		}
		obr.Msg.MessageBody = chat1.NewMessageBodyWithAttachment(att)
		if _, err := s.outbox.UpdateMessage(ctx, obr); err != nil {
			return obr, err
		}
	case types.AttachmentUploaderTaskStatusFailed:
		errStr := "<unknown>"
		if res.Error != nil {
			errStr = *res.Error
		}
		// register this as a failure, but still attempt a retry
		if _, err := s.G().AttachmentUploader.Retry(ctx, obr.OutboxID); err != nil {
			s.Debug(ctx, "processAttachment: failed to retry upload on in progress task: %s", err)
			return obr, NewAttachmentUploadError(err.Error(), true)
		}
		return obr, NewAttachmentUploadError(errStr, false)
	case types.AttachmentUploaderTaskStatusUploading:
		// Make sure we are actually trying to upload this guy
		if _, err := s.G().AttachmentUploader.Retry(ctx, obr.OutboxID); err != nil {
			s.Debug(ctx, "processAttachment: failed to retry upload on in progress task: %s", err)
			return obr, NewAttachmentUploadError(err.Error(), true)
		}
		return obr, errDelivererUploadInProgress
	}
	return obr, nil
}

type unfurlError struct {
	status types.UnfurlerTaskStatus
}

func newUnfurlError(status types.UnfurlerTaskStatus) unfurlError {
	return unfurlError{
		status: status,
	}
}

func (e unfurlError) Error() string {
	if e.status == types.UnfurlerTaskStatusPermFailed {
		return "unfurler permanent error"
	}
	return "unfurler error"
}

func (e unfurlError) IsImmediateFail() (chat1.OutboxErrorType, bool) {
	return chat1.OutboxErrorType_MISC, e.status == types.UnfurlerTaskStatusPermFailed
}

var _ (DelivererInfoError) = (*unfurlError)(nil)

func (s *Deliverer) processUnfurl(ctx context.Context, obr chat1.OutboxRecord) (chat1.OutboxRecord, error) {
	if !obr.IsUnfurl() {
		return obr, nil
	}
	status, res, err := s.G().Unfurler.Status(ctx, obr.OutboxID)
	if err != nil {
		return obr, err
	}
	switch status {
	case types.UnfurlerTaskStatusSuccess:
		if res == nil {
			return obr, errors.New("unfurl success with no result")
		}
		unfurl := chat1.MessageUnfurl{
			MessageID: obr.Msg.ClientHeader.Supersedes,
			Unfurl:    *res,
		}
		obr.Msg.MessageBody = chat1.NewMessageBodyWithUnfurl(unfurl)
		if _, err := s.outbox.UpdateMessage(ctx, obr); err != nil {
			return obr, err
		}
	case types.UnfurlerTaskStatusUnfurling:
		s.G().Unfurler.Retry(ctx, obr.OutboxID)
		return obr, errDelivererUnfurlInProgress
	case types.UnfurlerTaskStatusFailed:
		s.G().Unfurler.Retry(ctx, obr.OutboxID)
		return obr, newUnfurlError(status)
	case types.UnfurlerTaskStatusPermFailed:
		return obr, newUnfurlError(status)
	}
	return obr, nil
}

type flipPermError struct{}

func (e flipPermError) Error() string {
	return "unable to start flip"
}

func (e flipPermError) IsImmediateFail() (chat1.OutboxErrorType, bool) {
	return chat1.OutboxErrorType_MISC, true
}

func (s *Deliverer) processFlip(ctx context.Context, obr chat1.OutboxRecord) (chat1.OutboxRecord, error) {
	if !obr.IsChatFlip() {
		return obr, nil
	}
	body := obr.Msg.MessageBody.Flip()
	flipConvID, status := s.G().CoinFlipManager.IsFlipConversationCreated(ctx, obr.OutboxID)
	switch status {
	case types.FlipSendStatusInProgress:
		return obr, errDelivererFlipConvCreationInProgress
	case types.FlipSendStatusError:
		return obr, flipPermError{}
	case types.FlipSendStatusSent:
		s.Debug(ctx, "processFlip: sending with convID: %s", flipConvID)
		obr.Msg.MessageBody = chat1.NewMessageBodyWithFlip(chat1.MessageFlip{
			Text:       body.Text,
			GameID:     body.GameID,
			FlipConvID: flipConvID,
		})
		if _, err := s.outbox.UpdateMessage(ctx, obr); err != nil {
			return obr, err
		}
		return obr, nil
	}
	return obr, nil
}

func (s *Deliverer) processBackgroundTaskMessage(ctx context.Context, obr chat1.OutboxRecord) (chat1.OutboxRecord, error) {
	switch obr.MessageType() {
	case chat1.MessageType_ATTACHMENT:
		return s.processAttachment(ctx, obr)
	case chat1.MessageType_UNFURL:
		return s.processUnfurl(ctx, obr)
	case chat1.MessageType_FLIP:
		return s.processFlip(ctx, obr)
	default:
		return obr, nil
	}
}

// cancelPendingDuplicateReactions removes duplicate reactions in the outbox.
// If we cancel an odd number of items we cancel ourselves since the current
// reaction state is correct.
func (s *Deliverer) cancelPendingDuplicateReactions(ctx context.Context, obr chat1.OutboxRecord) (bool, error) {
	if obr.Msg.ClientHeader.MessageType != chat1.MessageType_REACTION {
		// nothing to do here
		return false, nil
	}
	// While holding the outbox lock, let's remove any duplicate reaction
	// messages and  make sure we are in the outbox, otherwise someone else
	// canceled us.
	inOutbox := false
	numCanceled, err := s.outbox.CancelMessagesWithPredicate(ctx, func(o chat1.OutboxRecord) bool {
		if !o.ConvID.Eq(obr.ConvID) {
			return false
		}
		if o.Msg.ClientHeader.MessageType != chat1.MessageType_REACTION {
			return false
		}

		idEq := o.OutboxID.Eq(&obr.OutboxID)
		bodyEq := o.Msg.MessageBody.Reaction().Eq(obr.Msg.MessageBody.Reaction())
		// Don't delete ourselves from the outbox, but we want to make sure we
		// are in here.
		inOutbox = inOutbox || idEq
		shouldCancel := bodyEq && !idEq
		if shouldCancel {
			s.Debug(ctx, "canceling outbox message convID: %v obid: %v", o.ConvID, o.OutboxID)
		}
		return shouldCancel
	})

	if err != nil {
		return false, err
	} else if !inOutbox {
		// we were canceled previously, the jig is up
		return true, nil
	} else if numCanceled%2 == 1 {
		// Since we're just toggling the reaction on/off, we should abort here
		// and remove ourselves from the outbox since our message wouldn't
		// change the reaction state.
		_, err = s.outbox.RemoveMessage(ctx, obr.OutboxID)
		return true, err
	}
	return false, nil
}

func (s *Deliverer) shouldRecordError(ctx context.Context, err error) bool {
	// This just happens when threads are racing to reconnect to
	// Gregor, don't count it as an error to send.
	return err != ErrDuplicateConnection
}

func (s *Deliverer) shouldBreakLoop(ctx context.Context, obr chat1.OutboxRecord) bool {
	if obr.Msg.ClientHeader.MessageType == chat1.MessageType_UNFURL {
		s.Debug(ctx, "shouldBreakLoop: not breaking deliverer loop for unfurl failure: outboxID: %s",
			obr.OutboxID)
		return false
	}
	return true
}

func (s *Deliverer) kbfsDeliverLoop(shutdownCh chan struct{}) error {
	bgctx := globals.ChatCtx(context.Background(), s.G(), keybase1.TLFIdentifyBehavior_CHAT_CLI, nil, nil)
	bgctx = libkb.WithLogTag(bgctx, "KDELV")
	s.Debug(bgctx, "deliverLoop: starting non blocking sender kbfs deliver loop: uid: %s",
		s.outbox.GetUID())
	for {
		select {
		case <-shutdownCh:
			s.Debug(bgctx, "deliverLoop: shutting down outbox deliver loop: uid: %s", s.outbox.GetUID())
			return nil
		case obr := <-s.kbfsDeliverQueue:
			s.Debug(bgctx, "deliverLoop: flushing record obr for %v", obr.ConvID)
			if _, _, err := s.sender.Send(bgctx, obr.ConvID, obr.Msg, 0, nil, nil, nil); err != nil {
				s.Debug(bgctx, "Unable to deliver msg: %v", err)
			}
		}
	}
}

func (s *Deliverer) deliverLoop(shutdownCh chan struct{}) error {
	bgctx := libkb.WithLogTag(context.Background(), "DELV")
	s.Debug(bgctx, "deliverLoop: starting non blocking sender deliver loop: uid: %s duration: %v",
		s.outbox.GetUID(), s.G().Env.GetChatDelivererInterval())
	for {
		// Wait for the signal to take action
		select {
		case <-shutdownCh:
			s.Debug(bgctx, "deliverLoop: shutting down outbox deliver loop: uid: %s", s.outbox.GetUID())
			return nil
		case <-s.reconnectCh:
			s.Debug(bgctx, "deliverLoop: flushing outbox on reconnect: uid: %s", s.outbox.GetUID())
		case <-s.msgSentCh:
			s.Debug(bgctx, "deliverLoop: flushing outbox on new message: uid: %s", s.outbox.GetUID())
		case <-s.G().Clock().After(s.G().Env.GetChatDelivererInterval()):
		}

		// Fetch outbox
		obrs, err := s.outbox.PullAllConversations(bgctx, false, false)
		if err != nil {
			if _, ok := err.(storage.MissError); !ok {
				s.Debug(bgctx, "deliverLoop: unable to pull outbox: uid: %s err: %v", s.outbox.GetUID(),
					err)
			}
			continue
		}

		convMap := make(map[chat1.ConvIDStr][]chat1.OutboxRecord)
		for _, o := range obrs {
			obr := o
			convMap[obr.ConvID.ConvIDStr()] = append(convMap[obr.ConvID.ConvIDStr()], obr)
		}

		var eg errgroup.Group
		for _, o := range convMap {
			obrs := o
			eg.Go(func() error { s.deliverForConv(bgctx, obrs); return nil })
		}
		if err := eg.Wait(); err != nil {
			s.Debug(bgctx, "deliverLoop: error in waitgroup %v", err)
		}
	}
}

func (s *Deliverer) deliverForConv(ctx context.Context, obrs []chat1.OutboxRecord) {
	if len(obrs) > 0 {
		s.Debug(ctx, "deliverLoop: flushing %d items from the outbox: uid: %s, convID %v",
			len(obrs), s.outbox.GetUID(), obrs[0].ConvID)
	}

	// Send messages
	var err error
	var breaks []keybase1.TLFIdentifyFailure
	for _, obr := range obrs {
		bctx := globals.ChatCtx(context.Background(), s.G(), obr.IdentifyBehavior, &breaks,
			s.identNotifier)

		if s.testingNameInfoSource != nil {
			bctx = globals.CtxAddOverrideNameInfoSource(bctx, s.testingNameInfoSource)
		}
		if !s.connected {
			err = newSenderError("disconnected from chat server", false)
		} else if s.clock.Now().Sub(obr.Ctime.Time()) > time.Hour {
			// If we are re-trying a message after an hour, let's just give up. These times can
			// get very long if the app is suspended on mobile.
			s.Debug(bctx, "deliverLoop: expiring pending message because it is too old: obid: %s dur: %v",
				obr.OutboxID, s.clock.Now().Sub(obr.Ctime.Time()))
			err = delivererExpireError{}
		} else {
			// Check for special messages and process based on completion status
			obr, err = s.processBackgroundTaskMessage(bctx, obr)
			if err == nil {
				canceled, err := s.cancelPendingDuplicateReactions(bctx, obr)
				if err == nil && canceled {
					s.Debug(bctx, "deliverLoop: aborting send, duplicate send convID: %s, obid: %s",
						obr.ConvID, obr.OutboxID)
					continue
				}
			} else if _, ok := err.(delivererBackgroundTaskError); ok {
				// check for bkg task error and loop around if we hit one
				s.Debug(bctx, "deliverLoop: bkg task in progress, skipping: convID: %s obid: %s task: %v",
					obr.ConvID, obr.OutboxID, err)
				continue
			}
			if err == nil {
				_, _, err = s.sender.Send(bctx, obr.ConvID, obr.Msg, 0, nil, obr.SendOpts,
					obr.PrepareOpts)
			}
		}
		if err != nil {
			s.Debug(bctx,
				"deliverLoop: failed to send msg: uid: %s convID: %s obid: %s err: %v attempts: %d",
				s.outbox.GetUID(), obr.ConvID, obr.OutboxID, err, obr.State.Sending())

			// Process failure. If we determine that the message is unrecoverable, then bail out.
			if errTyp, newErr, ok := s.doNotRetryFailure(bctx, obr, err); ok {
				// Record failure if we hit this case, and put the rest of this loop in a
				// mode where all other entries also fail.
				s.Debug(bctx, "deliverLoop: failure condition reached, marking as error and notifying: obid: %s errTyp: %v attempts: %d", obr.OutboxID, errTyp, obr.State.Sending())

				if err := s.failMessage(bctx, obr, chat1.OutboxStateError{
					Message: newErr.Error(),
					Typ:     errTyp,
				}); err != nil {
					s.Debug(bctx, "deliverLoop: unable to fail message: err: %v", err)
				}
			} else if s.shouldRecordError(bctx, err) {
				if err = s.outbox.RecordFailedAttempt(bctx, obr); err != nil {
					s.Debug(ctx, "deliverLoop: unable to record failed attempt on outbox: uid %s err: %v",
						s.outbox.GetUID(), err)
				}
			}
			// Check if we should break out of the deliverer loop on this failure
			if s.shouldBreakLoop(bctx, obr) {
				break
			}
		} else {
			// BlockingSender actually does this too, so this will likely fail, but to maintain
			// the types.Sender abstraction we will do it here too and likely fail.
			if _, err = s.outbox.RemoveMessage(bctx, obr.OutboxID); err != nil {
				s.Debug(ctx, "deliverLoop: failed to remove successful message send: %v", err)
			}
		}
	}
}
