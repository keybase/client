package chat

import (
	"errors"
	"fmt"
	"sync"
	"time"

	"encoding/hex"

	"github.com/keybase/client/go/chat/storage"
	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/net/context"
)

type Sender interface {
	Send(ctx context.Context, convID chat1.ConversationID, msg chat1.MessagePlaintext, clientPrev chat1.MessageID) (chat1.OutboxID, chat1.MessageID, *chat1.RateLimit, error)
	Prepare(ctx context.Context, msg chat1.MessagePlaintext, convID *chat1.ConversationID) (*chat1.MessageBoxed, error)
}

type BlockingSender struct {
	libkb.Contextified

	boxer       *Boxer
	getSecretUI func() libkb.SecretUI
	getRi       func() chat1.RemoteInterface
}

func NewBlockingSender(g *libkb.GlobalContext, boxer *Boxer, getRi func() chat1.RemoteInterface,
	getSecretUI func() libkb.SecretUI) *BlockingSender {
	return &BlockingSender{
		Contextified: libkb.NewContextified(g),
		getRi:        getRi,
		getSecretUI:  getSecretUI,
		boxer:        boxer,
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

func (s *BlockingSender) addPrevPointersToMessage(ctx context.Context, msg chat1.MessagePlaintext,
	convID chat1.ConversationID) (chat1.MessagePlaintext, error) {

	// Make sure the caller hasn't already assembled this list. For now, this
	// should never happen, and we'll return an error just in case we make a
	// mistake in the future. But if there's some use case in the future where
	// a caller wants to specify custom prevs, we can relax this.
	if len(msg.ClientHeader.Prev) != 0 {
		return chat1.MessagePlaintext{}, fmt.Errorf("chatLocalHandler expects an empty prev list")
	}

	var prevs []chat1.MessagePreviousPointer

	res, err := s.G().ConvSource.PullLocalOnly(ctx, convID, msg.ClientHeader.Sender, nil, nil)
	switch err.(type) {
	case libkb.ChatStorageMissError:
		s.G().Log.Debug("No local messages; skipping prev pointers")
	case nil:
		prevs, err = CheckPrevPointersAndGetUnpreved(&res)
		if err != nil {
			return chat1.MessagePlaintext{}, err
		}
	default:
		return chat1.MessagePlaintext{}, err
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

func (s *BlockingSender) getAllDeletedEdits(ctx context.Context, msg chat1.MessagePlaintext,
	convID chat1.ConversationID) (chat1.MessagePlaintext, error) {

	// Make sure this is a valid delete message
	if msg.ClientHeader.MessageType != chat1.MessageType_DELETE {
		return msg, nil
	}
	if msg.ClientHeader.Supersedes == 0 {
		return msg, fmt.Errorf("getAllDeletedEdits: no supersedes specified")
	}

	// Grab all the edits (!)
	tv, _, err := s.G().ConvSource.Pull(ctx, convID, msg.ClientHeader.Sender, &chat1.GetThreadQuery{
		MarkAsRead:   false,
		MessageTypes: []chat1.MessageType{chat1.MessageType_EDIT},
	}, nil)
	if err != nil {
		return msg, err
	}

	// Get all affected edits
	deletes := []chat1.MessageID{msg.ClientHeader.Supersedes}
	for _, m := range tv.Messages {
		if m.IsValid() && m.GetMessageType() == chat1.MessageType_EDIT &&
			m.Valid().MessageBody.Edit().MessageID == msg.ClientHeader.Supersedes {
			deletes = append(deletes, m.GetMessageID())
		}
	}

	// Modify original delete message
	msg.ClientHeader.Deletes = deletes
	msg.MessageBody = chat1.NewMessageBodyWithDelete(chat1.MessageDelete{MessageIDs: deletes})

	return msg, nil
}

func (s *BlockingSender) Prepare(ctx context.Context, plaintext chat1.MessagePlaintext, convID *chat1.ConversationID) (*chat1.MessageBoxed, error) {
	msg, err := s.addSenderToMessage(plaintext)
	if err != nil {
		return nil, err
	}

	// convID will be nil in makeFirstMessage, for example
	if convID != nil {
		msg, err = s.addPrevPointersToMessage(ctx, msg, *convID)
		if err != nil {
			return nil, err
		}
	}

	// Make sure our delete message gets everything it should
	if convID != nil {
		msg, err = s.getAllDeletedEdits(ctx, msg, *convID)
		if err != nil {
			return nil, err
		}
	}

	// encrypt the message
	skp, err := s.getSigningKeyPair()
	if err != nil {
		return nil, err
	}

	// For now, BoxMessage canonicalizes the TLF name. We should try to refactor
	// it a bit to do it here.
	boxed, err := s.boxer.BoxMessage(ctx, msg, skp)
	if err != nil {
		return nil, err
	}

	return boxed, nil
}

func (s *BlockingSender) getSigningKeyPair() (kp libkb.NaclSigningKeyPair, err error) {
	// get device signing key for this user
	signingKey, err := engine.GetMySecretKey(s.G(), s.getSecretUI, libkb.DeviceSigningKeyType, "sign chat message")
	if err != nil {
		return libkb.NaclSigningKeyPair{}, err
	}
	kp, ok := signingKey.(libkb.NaclSigningKeyPair)
	if !ok || kp.Private == nil {
		return libkb.NaclSigningKeyPair{}, libkb.KeyCannotSignError{}
	}

	return kp, nil
}

func (s *BlockingSender) Send(ctx context.Context, convID chat1.ConversationID,
	msg chat1.MessagePlaintext, clientPrev chat1.MessageID) (chat1.OutboxID, chat1.MessageID, *chat1.RateLimit, error) {

	// Add a bunch of stuff to the message (like prev pointers, sender info, ...)
	boxed, err := s.Prepare(ctx, msg, &convID)
	if err != nil {
		return chat1.OutboxID{}, 0, nil, err
	}

	ri := s.getRi()
	if ri == nil {
		return chat1.OutboxID{}, 0, nil, fmt.Errorf("Send(): no remote client found")
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
	// TODO: make this cache write work
	/*if err = storage.NewInbox(s.G(), boxed.ClientHeader.Sender, func() libkb.SecretUI {
		return DelivererSecretUI{}
	}).NewMessage(0, convID, unboxed); err != nil {
		if _, ok := err.(libkb.ChatStorageMissError); !ok {
			return chat1.OutboxID{}, nil, err
		}
	}*/

	return []byte{}, plres.MsgHeader.MessageID, plres.RateLimit, nil
}

type DelivererSecretUI struct {
}

func (d DelivererSecretUI) GetPassphrase(pinentry keybase1.GUIEntryArg, terminal *keybase1.SecretEntryArg) (keybase1.GetPassphraseRes, error) {
	return keybase1.GetPassphraseRes{}, fmt.Errorf("no secret UI available")
}

const deliverMaxAttempts = 5

type Deliverer struct {
	libkb.Contextified
	sync.Mutex

	sender        Sender
	outbox        *storage.Outbox
	storage       *storage.Storage
	identNotifier *IdentifyNotifier
	shutdownCh    chan chan struct{}
	msgSentCh     chan struct{}
	reconnectCh   chan struct{}
	delivering    bool
	connected     bool
}

func NewDeliverer(g *libkb.GlobalContext, sender Sender) *Deliverer {
	d := &Deliverer{
		Contextified:  libkb.NewContextified(g),
		shutdownCh:    make(chan chan struct{}, 1),
		msgSentCh:     make(chan struct{}, 100),
		reconnectCh:   make(chan struct{}, 100),
		sender:        sender,
		storage:       storage.New(g, func() libkb.SecretUI { return DelivererSecretUI{} }),
		identNotifier: NewIdentifyNotifier(g),
	}

	g.PushShutdownHook(func() error {
		d.Stop()
		return nil
	})

	return d
}

func (s *Deliverer) debug(msg string, args ...interface{}) {
	s.G().Log.Debug("Deliverer: "+msg, args...)
}

func (s *Deliverer) Start(uid gregor1.UID) {
	s.Lock()
	defer s.Unlock()

	s.doStop()

	s.outbox = storage.NewOutbox(s.G(), uid, func() libkb.SecretUI {
		return DelivererSecretUI{}
	})

	s.delivering = true
	go s.deliverLoop()
}

func (s *Deliverer) Stop() chan struct{} {
	s.Lock()
	defer s.Unlock()
	return s.doStop()
}

func (s *Deliverer) doStop() chan struct{} {
	cb := make(chan struct{})
	if s.delivering {
		s.debug("stopping")
		s.shutdownCh <- cb
		s.delivering = false
		return cb
	}

	close(cb)
	return cb
}

func (s *Deliverer) ForceDeliverLoop() {
	s.debug("force deliver loop invoked")
	s.msgSentCh <- struct{}{}
}

func (s *Deliverer) SetSender(sender Sender) {
	s.sender = sender
}

func (s *Deliverer) Connected() {
	s.connected = true

	// Wake up deliver loop on reconnect
	s.debug("reconnected: forcing deliver loop run")
	s.reconnectCh <- struct{}{}
}

func (s *Deliverer) Disconnected() {
	s.debug("disconnected: all errors from now on will be permanent")
	s.connected = false
}

func (s *Deliverer) Queue(convID chat1.ConversationID, msg chat1.MessagePlaintext,
	identifyBehavior keybase1.TLFIdentifyBehavior) (chat1.OutboxID, error) {

	s.debug("queued new message: convID: %s uid: %s ident: %v", convID, s.outbox.GetUID(),
		identifyBehavior)

	// Push onto outbox and immediatley return
	oid, err := s.outbox.PushMessage(convID, msg, identifyBehavior)
	if err != nil {
		return oid, err
	}

	// Alert the deliver loop it should wake up
	s.msgSentCh <- struct{}{}

	return oid, nil
}

func (s *Deliverer) deliverLoop() {
	s.debug("starting non blocking sender deliver loop: uid: %s duration: %v", s.outbox.GetUID(),
		s.G().Env.GetChatDelivererInterval())
	for {
		// Wait for the signal to take action
		select {
		case cb := <-s.shutdownCh:
			s.debug("shuttting down outbox deliver loop: uid: %s", s.outbox.GetUID())
			defer close(cb)
			return
		case <-s.reconnectCh:
			s.debug("flushing outbox on reconnect: uid: %s", s.outbox.GetUID())
		case <-s.msgSentCh:
			s.debug("flushing outbox on new message: uid: %s", s.outbox.GetUID())
		case <-s.G().Clock().After(s.G().Env.GetChatDelivererInterval()):
		}

		// Fetch outbox
		obrs, err := s.outbox.PullAllConversations()
		if err != nil {
			if _, ok := err.(libkb.ChatStorageMissError); !ok {
				s.G().Log.Error("unable to pull outbox: uid: %s err: %s", s.outbox.GetUID(),
					err.Error())
			}
			continue
		}
		if len(obrs) > 0 {
			s.debug("flushing %d items from the outbox: uid: %s", len(obrs), s.outbox.GetUID())
		}

		// Send messages
		var breaks []keybase1.TLFIdentifyFailure
		for _, obr := range obrs {

			// Check type
			state, err := obr.State.State()
			if err != nil {
				s.G().Log.Error("skipping strange entry in the outbox, invalid type: %s", err.Error())
				continue
			}
			if state != chat1.OutboxStateType_SENDING {
				s.debug("skipping error state record: id: %s convID: %s uid: %s",
					hex.EncodeToString(obr.OutboxID), obr.ConvID, s.outbox.GetUID())
				continue
			}

			// Do the actual send
			bctx := Context(context.Background(), obr.IdentifyBehavior, &breaks, s.identNotifier)
			if !s.connected {
				err = errors.New("disconnected from chat server")
			} else {
				_, _, _, err = s.sender.Send(bctx, obr.ConvID, obr.Msg, 0)
			}
			if err == nil {
				// Send succeeded
				s.debug("clearing message from outbox: %s uid: %s", obr.OutboxID, s.outbox.GetUID())
				err = s.outbox.RemoveMessage(obr.OutboxID)
				if err != nil {
					s.G().Log.Error("error clearing message from outbox after successful send: uid:%s %s",
						s.outbox.GetUID(), err)
				}
			} else {
				// Send failed
				s.G().Log.Error("Deliverer: failed to send msg: uid: %s convID: %s err: %s attempts: %d",
					s.outbox.GetUID(), obr.ConvID, err.Error(), obr.State.Sending())

				// Process failure. If we have gone over the limit of failure, or we are
				// disconnected from the chat server, mark everything as failed.
				if obr.State.Sending() > deliverMaxAttempts || !s.connected {
					// Mark the entire outbox as an error if we can't send
					s.debug("max failure attempts reached, marking all as errors and notifying")
					deadObrs, err := s.outbox.MarkAllAsError()
					if err != nil {
						s.G().Log.Error("unable to mark as error on outbox: uid: %s err: %s",
							s.outbox.GetUID(), err.Error())
					}
					act := chat1.NewChatActivityWithFailedMessage(chat1.FailedMessageInfo{
						OutboxRecords: deadObrs,
					})
					s.G().NotifyRouter.HandleNewChatActivity(context.Background(),
						keybase1.UID(s.outbox.GetUID().String()), &act)
				} else {
					if err = s.outbox.RecordFailedAttempt(obr.OutboxID); err != nil {
						s.G().Log.Error("unable to record failed attempt on outbox: uid %s err: %s",
							s.outbox.GetUID(), err.Error())
					}
				}

				break
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

func (s *NonblockingSender) Prepare(ctx context.Context, plaintext chat1.MessagePlaintext, convID *chat1.ConversationID) (*chat1.MessageBoxed, error) {
	return s.sender.Prepare(ctx, plaintext, convID)
}

func (s *NonblockingSender) Send(ctx context.Context, convID chat1.ConversationID,
	msg chat1.MessagePlaintext, clientPrev chat1.MessageID) (chat1.OutboxID, chat1.MessageID, *chat1.RateLimit, error) {

	msg.ClientHeader.OutboxInfo = &chat1.OutboxInfo{
		Prev:        clientPrev,
		ComposeTime: gregor1.ToTime(time.Now()),
	}

	identifyBehavior, _, _ := IdentifyMode(ctx)
	oid, err := s.G().MessageDeliverer.Queue(convID, msg, identifyBehavior)
	return oid, 0, &chat1.RateLimit{}, err
}
