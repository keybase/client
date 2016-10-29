package chat

import (
	"encoding/binary"
	"errors"
	"fmt"
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
	Send(ctx context.Context, convID chat1.ConversationID, msg chat1.MessagePlaintext) (chat1.OutboxID, *chat1.RateLimit, error)
	Prepare(ctx context.Context, msg chat1.MessagePlaintext, convID *chat1.ConversationID) (*chat1.MessageBoxed, error)
}

type BaseSender struct {
	libkb.Contextified

	boxer       *Boxer
	getSecretUI func() libkb.SecretUI
	getRi       func() chat1.RemoteInterface
}

func NewBaseSender(g *libkb.GlobalContext, boxer *Boxer, getRi func() chat1.RemoteInterface,
	getSecretUI func() libkb.SecretUI) *BaseSender {
	return &BaseSender{
		Contextified: libkb.NewContextified(g),
		getRi:        getRi,
		getSecretUI:  getSecretUI,
		boxer:        boxer,
	}
}

func (s *BaseSender) addSenderToMessage(msg chat1.MessagePlaintext) (chat1.MessagePlaintext, error) {
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

func (s *BaseSender) addPrevPointersToMessage(msg chat1.MessagePlaintext, convID chat1.ConversationID) (chat1.MessagePlaintext, error) {
	// Make sure the caller hasn't already assembled this list. For now, this
	// should never happen, and we'll return an error just in case we make a
	// mistake in the future. But if there's some use case in the future where
	// a caller wants to specify custom prevs, we can relax this.
	if len(msg.ClientHeader.Prev) != 0 {
		return chat1.MessagePlaintext{}, fmt.Errorf("chatLocalHandler expects an empty prev list")
	}

	res, _, err := s.G().ConvSource.Pull(context.Background(), convID, msg.ClientHeader.Sender, nil, nil)
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

func (s *BaseSender) Prepare(ctx context.Context, plaintext chat1.MessagePlaintext, convID *chat1.ConversationID) (*chat1.MessageBoxed, error) {
	msg, err := s.addSenderToMessage(plaintext)
	if err != nil {
		return nil, err
	}

	// convID will be nil in makeFirstMessage, for example
	if convID != nil {
		msg, err = s.addPrevPointersToMessage(msg, *convID)
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

	// TODO: populate plaintext.ClientHeader.Conv

	return boxed, nil
}

func (s *BaseSender) getSigningKeyPair() (kp libkb.NaclSigningKeyPair, err error) {
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

func (s *BaseSender) Send(ctx context.Context, convID chat1.ConversationID,
	msg chat1.MessagePlaintext) (chat1.OutboxID, *chat1.RateLimit, error) {

	// Add a bunch of stuff to the message (like prev pointers, sender info, ...)
	boxed, err := s.Prepare(ctx, msg, &convID)
	if err != nil {
		return chat1.OutboxID{}, nil, err
	}

	rarg := chat1.PostRemoteArg{
		ConversationID: convID,
		MessageBoxed:   *boxed,
	}
	plres, err := s.getRi().PostRemote(ctx, rarg)
	if err != nil {
		return chat1.OutboxID{}, nil, err
	}
	boxed.ServerHeader = &plres.MsgHeader

	// Write new message out to cache
	if _, err := s.G().ConvSource.Push(ctx, convID, msg.ClientHeader.Sender, *boxed); err != nil {
		return chat1.OutboxID{}, nil, err
	}
	res := make([]byte, 4)
	binary.LittleEndian.PutUint32(res, uint32(boxed.GetMessageID()))
	return res, plres.RateLimit, nil
}

type Deliverer struct {
	libkb.Contextified
	outbox     *storage.Outbox
	sender     Sender
	shutdownCh chan struct{}
	msgSentCh  chan struct{}
}

func NewDeliverer(g *libkb.GlobalContext, sender Sender, outbox *storage.Outbox) *Deliverer {
	d := &Deliverer{
		Contextified: libkb.NewContextified(g),
		outbox:       outbox,
		shutdownCh:   make(chan struct{}),
		msgSentCh:    make(chan struct{}),
		sender:       sender,
	}

	// Shut this thing down on service shutdown
	g.PushShutdownHook(func() error {
		d.shutdownCh <- struct{}{}
		return nil
	})

	go d.deliverLoop()

	return d
}

func (s *Deliverer) Queue(convID chat1.ConversationID, msg chat1.MessagePlaintext) (chat1.OutboxID, error) {

	// Push onto outbox and immediatley return
	oid, err := s.outbox.Push(convID, msg)
	if err != nil {
		return oid, err
	}

	// Alert the deliver loop it should wake up
	s.msgSentCh <- struct{}{}

	return oid, nil
}

func (s *Deliverer) deliverLoop() {
	s.G().Log.Debug("starting non blocking sender deliver loop")
	for {
		// Wait for the signal to take action
		select {
		case <-s.shutdownCh:
			s.G().Log.Debug("shuttting down outbox deliver loop")
			return
		case <-s.msgSentCh:
			s.G().Log.Debug("flushing outbox on new message")
		case <-s.G().Clock().After(time.Minute):
		}

		// Fetch outbox
		obrs, err := s.outbox.Pull()
		if err != nil {
			s.G().Log.Error("unable to pull outbox: err: %s", err.Error())
			continue
		}
		if len(obrs) > 0 {
			s.G().Log.Debug("flushing %d items from the outbox", len(obrs))
		}

		// Send messages
		pops := 0
		for _, obr := range obrs {
			_, rl, err := s.sender.Send(context.Background(), obr.ConvID, obr.Msg)
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
			if err = s.outbox.PopN(pops); err != nil {
				s.G().Log.Error("failed to clear messages from outbox: err: %s", err.Error())
			}
		}
	}
}

type NonblockingSender struct {
	libkb.Contextified
	sender Sender
}

func NewNonblockingSender(g *libkb.GlobalContext, sender Sender, outbox *storage.Outbox) *NonblockingSender {

	s := &NonblockingSender{
		Contextified: libkb.NewContextified(g),
		sender:       sender,
	}

	g.StartMessageDeliverer.Do(func() {
		g.MessageDeliverer = NewDeliverer(g, sender, outbox)
	})

	return s
}

func (s *NonblockingSender) Prepare(ctx context.Context, plaintext chat1.MessagePlaintext, convID *chat1.ConversationID) (*chat1.MessageBoxed, error) {
	return s.sender.Prepare(ctx, plaintext, convID)
}

func (s *NonblockingSender) Send(ctx context.Context, convID chat1.ConversationID,
	msg chat1.MessagePlaintext) (chat1.OutboxID, *chat1.RateLimit, error) {
	oid, err := s.G().MessageDeliverer.Queue(convID, msg)
	return oid, &chat1.RateLimit{}, err
}
