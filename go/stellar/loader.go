package stellar

import (
	"fmt"
	"sync"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/stellar1"
)

type msgPair struct {
	convID chat1.ConversationID
	msgID  chat1.MessageID
	sender libkb.NormalizedUsername
}

type PaymentLoader struct {
	libkb.Contextified
	payments map[stellar1.PaymentID]*stellar1.PaymentLocal
	messages map[stellar1.PaymentID]msgPair
	queue    chan stellar1.PaymentID
	sync.Mutex
	shutdownOnce sync.Once
}

var defaultPaymentLoader *PaymentLoader
var defaultLock sync.Mutex

func NewPaymentLoader(g *libkb.GlobalContext) *PaymentLoader {
	p := &PaymentLoader{
		Contextified: libkb.NewContextified(g),
		payments:     make(map[stellar1.PaymentID]*stellar1.PaymentLocal),
		messages:     make(map[stellar1.PaymentID]msgPair),
		queue:        make(chan stellar1.PaymentID, 50),
	}

	go p.run()

	return p
}

func DefaultPaymentLoader(g *libkb.GlobalContext) *PaymentLoader {
	defaultLock.Lock()
	defer defaultLock.Unlock()

	if defaultPaymentLoader == nil {
		defaultPaymentLoader = NewPaymentLoader(g)
		g.PushShutdownHook(defaultPaymentLoader.Shutdown)
	}

	return defaultPaymentLoader
}

func (p *PaymentLoader) Load(ctx context.Context, convID chat1.ConversationID, msgID chat1.MessageID, senderUsername string, paymentID stellar1.PaymentID) *chat1.UIPaymentInfo {
	defer libkb.CTrace(ctx, p.G().GetLog(), fmt.Sprintf("PaymentLoader.Load(cid=%s,mid=%s,pid=%s)", convID, msgID, paymentID), func() error { return nil })()

	p.Lock()
	defer p.Unlock()

	m := libkb.NewMetaContext(ctx, p.G())

	pair, ok := p.messages[paymentID]
	// store the msg info if necessary
	if !ok {
		pair = msgPair{
			convID: convID,
			msgID:  msgID,
			sender: libkb.NewNormalizedUsername(senderUsername),
		}
		p.messages[paymentID] = pair
	} else if !pair.convID.Eq(convID) || pair.msgID != msgID {
		m.CWarningf("existing message info does not match load info: (%v, %v) != (%v, %v)", pair.convID, pair.msgID, convID, msgID)
	}

	payment, ok := p.payments[paymentID]
	if ok {
		info := p.uiInfo(m, payment, pair)
		if info.Status != stellar1.PaymentStatus_COMPLETED {
			// to be safe, schedule a reload of the payment in case it has
			// changed since stored
			p.queue <- paymentID
		}

		return info
	}

	// not found, need to load payment in background
	p.queue <- paymentID

	return nil
}

// status notification handlers should call this
func (p *PaymentLoader) Update(ctx context.Context, paymentID stellar1.PaymentID) {
	p.queue <- paymentID
}

func (p *PaymentLoader) Shutdown() error {
	p.shutdownOnce.Do(func() { close(p.queue) })
	return nil
}

func (p *PaymentLoader) run() {
	for id := range p.queue {
		p.load(id)
	}
}

func (p *PaymentLoader) load(id stellar1.PaymentID) {
	ctx := context.Background()
	s := getGlobal(p.G())
	details, err := s.remoter.PaymentDetails(ctx, id.TxID.String())
	if err != nil {
		p.G().GetLog().CDebugf(ctx, "error getting payment details for %s: %s", id.TxID, err)
		return
	}

	m := libkb.NewMetaContext(ctx, p.G())
	summary, err := TransformPaymentSummary(m, "", details.Summary)
	if err != nil {
		p.G().GetLog().CDebugf(ctx, "error transforming details for %s: %s", id.TxID, err)
		return
	}

	p.Lock()
	p.payments[id] = summary
	p.Unlock()

	p.sendNotification(m, id, summary)
}

func (p *PaymentLoader) uiInfo(m libkb.MetaContext, summary *stellar1.PaymentLocal, pair msgPair) *chat1.UIPaymentInfo {
	info := chat1.UIPaymentInfo{
		AmountDescription: summary.AmountDescription,
		Worth:             summary.Worth,
		Delta:             summary.Delta,
		Note:              summary.Note,
		Status:            summary.StatusSimplified,
		StatusDescription: summary.StatusDescription,
	}

	// calculate the payment delta
	username := p.G().ActiveDevice.Username(m)
	if pair.sender.Eq(username) {
		info.Delta = stellar1.BalanceDelta_DECREASE
		// check if sending to self
		if summary.TargetType == stellar1.ParticipantType_KEYBASE {
			if libkb.NewNormalizedUsername(summary.Target).Eq(username) {
				info.Delta = stellar1.BalanceDelta_NONE
			}
		}
	} else {
		info.Delta = stellar1.BalanceDelta_INCREASE
	}

	return &info
}

func (p *PaymentLoader) sendNotification(m libkb.MetaContext, id stellar1.PaymentID, summary *stellar1.PaymentLocal) {
	p.Lock()
	pair, ok := p.messages[id]
	p.Unlock()

	if !ok {
		m.CDebugf("not sending chat notification for %s (no associated convID, msgID)", id.TxID)
		return
	}

	m.CDebugf("sending chat notification for payment %s to %s, %s", id.TxID, pair.convID, pair.msgID)
	uid := p.G().ActiveDevice.UID()
	info := p.uiInfo(m, summary, pair)
	p.G().NotifyRouter.HandleChatPaymentInfo(m.Ctx(), uid, pair.convID, pair.msgID, *info)
}
