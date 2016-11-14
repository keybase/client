package chat

import (
	"encoding/binary"
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/keybase/client/go/chat/storage"
	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/net/context"
)

type Sender interface {
	Send(ctx context.Context, convID chat1.ConversationID, msg chat1.MessagePlaintext) (chat1.OutboxID, *chat1.RateLimit, []keybase1.TLFUserBreak, error)
	Prepare(ctx context.Context, msg chat1.MessagePlaintext, convID *chat1.ConversationID) (*chat1.MessageBoxed, []keybase1.TLFUserBreak, error)
}

type BlockingSender struct {
	libkb.Contextified

	boxer            *Boxer
	getSecretUI      func() libkb.SecretUI
	getRi            func() chat1.RemoteInterface
	identifyBehavior keybase1.TLFIdentifyBehavior
}

func NewBlockingSender(g *libkb.GlobalContext, boxer *Boxer, getRi func() chat1.RemoteInterface,
	getSecretUI func() libkb.SecretUI, identifyBehavior keybase1.TLFIdentifyBehavior) *BlockingSender {
	return &BlockingSender{
		Contextified:     libkb.NewContextified(g),
		getRi:            getRi,
		getSecretUI:      getSecretUI,
		boxer:            boxer,
		identifyBehavior: identifyBehavior,
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

func (s *BlockingSender) addPrevPointersToMessage(msg chat1.MessagePlaintext, convID chat1.ConversationID) (chat1.MessagePlaintext, error) {
	// Make sure the caller hasn't already assembled this list. For now, this
	// should never happen, and we'll return an error just in case we make a
	// mistake in the future. But if there's some use case in the future where
	// a caller wants to specify custom prevs, we can relax this.
	if len(msg.ClientHeader.Prev) != 0 {
		return chat1.MessagePlaintext{}, fmt.Errorf("chatLocalHandler expects an empty prev list")
	}

	res, _, _, err := s.G().ConvSource.Pull(context.Background(), convID, msg.ClientHeader.Sender, nil, nil, s.identifyBehavior)
	if err != nil {
		return chat1.MessagePlaintext{}, err
	}

	prevs, err := CheckPrevPointersAndGetUnpreved(&res)
	if err != nil {
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

func (s *BlockingSender) Prepare(ctx context.Context, plaintext chat1.MessagePlaintext, convID *chat1.ConversationID) (*chat1.MessageBoxed, []keybase1.TLFUserBreak, error) {
	msg, err := s.addSenderToMessage(plaintext)
	if err != nil {
		return nil, nil, err
	}

	// convID will be nil in makeFirstMessage, for example
	if convID != nil {
		msg, err = s.addPrevPointersToMessage(msg, *convID)
		if err != nil {
			return nil, nil, err
		}
	}

	// encrypt the message
	skp, err := s.getSigningKeyPair()
	if err != nil {
		return nil, nil, err
	}

	// For now, BoxMessage canonicalizes the TLF name. We should try to refactor
	// it a bit to do it here.
	boxed, breaks, err := s.boxer.BoxMessage(ctx, msg, skp, s.identifyBehavior)
	if err != nil {
		return nil, nil, err
	}

	return boxed, breaks, nil
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
	msg chat1.MessagePlaintext) (chat1.OutboxID, *chat1.RateLimit, []keybase1.TLFUserBreak, error) {

	// Add a bunch of stuff to the message (like prev pointers, sender info, ...)
	boxed, breaks, err := s.Prepare(ctx, msg, &convID)
	if err != nil {
		return chat1.OutboxID{}, nil, nil, err
	}

	ri := s.getRi()
	if ri == nil {
		return chat1.OutboxID{}, nil, breaks, fmt.Errorf("Send(): no remote client found")
	}

	rarg := chat1.PostRemoteArg{
		ConversationID: convID,
		MessageBoxed:   *boxed,
	}
	plres, err := ri.PostRemote(ctx, rarg)
	if err != nil {
		return chat1.OutboxID{}, nil, breaks, err
	}
	boxed.ServerHeader = &plres.MsgHeader

	// Write new message out to cache
	if _, err := s.G().ConvSource.Push(ctx, convID, msg.ClientHeader.Sender, *boxed, s.identifyBehavior); err != nil {
		return chat1.OutboxID{}, nil, breaks, err
	}
	res := make([]byte, 4)
	binary.LittleEndian.PutUint32(res, uint32(boxed.GetMessageID()))
	return res, plres.RateLimit, breaks, nil
}

type DelivererSecretUI struct {
}

func (d DelivererSecretUI) GetPassphrase(pinentry keybase1.GUIEntryArg, terminal *keybase1.SecretEntryArg) (keybase1.GetPassphraseRes, error) {
	return keybase1.GetPassphraseRes{}, fmt.Errorf("no secret UI available")
}

type Deliverer struct {
	libkb.Contextified
	sync.Mutex

	sender     Sender
	outbox     *storage.Outbox
	shutdownCh chan struct{}
	msgSentCh  chan struct{}
	delivering bool
}

func NewDeliverer(g *libkb.GlobalContext, sender Sender) *Deliverer {
	d := &Deliverer{
		Contextified: libkb.NewContextified(g),
		shutdownCh:   make(chan struct{}, 1),
		msgSentCh:    make(chan struct{}, 100),
		sender:       sender,
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

func (s *Deliverer) Stop() {
	s.Lock()
	defer s.Unlock()
	s.doStop()
}

func (s *Deliverer) doStop() {
	if s.delivering {
		s.shutdownCh <- struct{}{}
		s.delivering = false
	}
}

func (s *Deliverer) Queue(convID chat1.ConversationID, msg chat1.MessagePlaintext) (chat1.OutboxID, error) {

	s.debug("queued new message: convID: %s uid: %s", convID, s.outbox.GetUID())

	// Push onto outbox and immediatley return
	oid, err := s.outbox.PushMessage(convID, msg)
	if err != nil {
		return oid, err
	}

	// Alert the deliver loop it should wake up
	s.msgSentCh <- struct{}{}

	return oid, nil
}

func (s *Deliverer) deliverLoop() {
	s.debug("starting non blocking sender deliver loop: uid: %s", s.outbox.GetUID())
	for {
		// Wait for the signal to take action
		select {
		case <-s.shutdownCh:
			s.debug("shuttting down outbox deliver loop: uid: %s", s.outbox.GetUID())
			return
		case <-s.msgSentCh:
			s.debug("flushing outbox on new message: uid: %s", s.outbox.GetUID())
		case <-s.G().Clock().After(time.Minute):
		}

		// Fetch outbox
		obrs, err := s.outbox.PullAllConversations()
		if err != nil {
			s.G().Log.Error("unable to pull outbox: uid: %s err: %s", s.outbox.GetUID(), err.Error())
			continue
		}
		if len(obrs) > 0 {
			s.debug("flushing %d items from the outbox: uid: %s", len(obrs), s.outbox.GetUID())
		}

		// Send messages
		pops := 0
		for _, obr := range obrs {
			_, rl, _, err := s.sender.Send(context.Background(), obr.ConvID, obr.Msg)
			if err != nil {
				s.G().Log.Error("failed to send msg: convID: %s err: %s", obr.ConvID, err.Error())
				break
			}

			// Notify everyone that this sent
			activity := chat1.NewChatActivityWithMessageSent(chat1.MessageSentInfo{
				ConvID:    obr.ConvID,
				OutboxID:  obr.OutboxID,
				RateLimit: *rl,
			})
			s.G().NotifyRouter.HandleNewChatActivity(context.Background(),
				keybase1.UID(obr.Msg.ClientHeader.Sender.String()), &activity)
			pops++
		}

		// Clear out outbox
		if pops > 0 {
			s.debug("clearing %d message from outbox: uid: %s", pops, s.outbox.GetUID())
			if err = s.outbox.PopNOldestMessages(pops); err != nil {
				s.G().Log.Error("failed to clear messages from outbox: uid: %s err: %s",
					s.outbox.GetUID(), err.Error())
			}
			s.debug("messages cleared")
		}
	}
}

type NonblockingSender struct {
	libkb.Contextified
	sender           Sender
	ti               keybase1.TlfInterface
	identifyBehavior keybase1.TLFIdentifyBehavior
}

func NewNonblockingSender(g *libkb.GlobalContext, sender Sender, ti keybase1.TlfInterface, identifyBehavior keybase1.TLFIdentifyBehavior) *NonblockingSender {
	s := &NonblockingSender{
		Contextified:     libkb.NewContextified(g),
		sender:           sender,
		ti:               ti,
		identifyBehavior: identifyBehavior,
	}
	return s
}

func (s *NonblockingSender) Prepare(ctx context.Context, plaintext chat1.MessagePlaintext, convID *chat1.ConversationID) (*chat1.MessageBoxed, []keybase1.TLFUserBreak, error) {
	return s.sender.Prepare(ctx, plaintext, convID)
}

func (s *NonblockingSender) Send(ctx context.Context, convID chat1.ConversationID,
	msg chat1.MessagePlaintext) (chat1.OutboxID, *chat1.RateLimit, []keybase1.TLFUserBreak, error) {
	// The deliverer uses GUI mode all the time, i.e., no errors on identify
	// failure. As a result, we need to do identify here before returning in
	// order to error in case the identifyBehavior is CLI, and collect identify
	// breaks in case of GUI. Also in case of CLI mode, we never queue up the
	// message if identify fails.
	var breaks []keybase1.TLFUserBreak
	if msg.ClientHeader.TlfPublic {
		res, err := s.ti.PublicCanonicalTLFNameAndID(ctx, keybase1.TLFQuery{
			IdentifyBehavior: s.identifyBehavior,
			TlfName:          msg.ClientHeader.TlfName,
		})
		if err != nil {
			return nil, nil, nil, err
		}
		breaks = res.Breaks.Breaks
	} else {
		res, err := s.ti.CryptKeys(ctx, keybase1.TLFQuery{
			IdentifyBehavior: s.identifyBehavior,
			TlfName:          msg.ClientHeader.TlfName,
		})
		if err != nil {
			return nil, nil, nil, err
		}
		breaks = res.NameIDBreaks.Breaks.Breaks
	}
	oid, err := s.G().MessageDeliverer.Queue(convID, msg)
	return oid, &chat1.RateLimit{}, breaks, err
}
