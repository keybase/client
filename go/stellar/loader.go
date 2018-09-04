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
}

type PaymentLoader struct {
	libkb.Contextified
	payments map[stellar1.PaymentID]*chat1.UIPaymentInfo
	messages map[stellar1.PaymentID]msgPair
	queue    chan stellar1.PaymentID
	sync.Mutex
	shutdownOnce sync.Once
}

func NewPaymentLoader(g *libkb.GlobalContext) *PaymentLoader {
	p := &PaymentLoader{
		Contextified: libkb.NewContextified(g),
		payments:     make(map[stellar1.PaymentID]*chat1.UIPaymentInfo),
		messages:     make(map[stellar1.PaymentID]msgPair),
		queue:        make(chan stellar1.PaymentID, 50),
	}

	go p.run()

	return p
}

func (p *PaymentLoader) Load(ctx context.Context, convID chat1.ConversationID, msgID chat1.MessageID, paymentID stellar1.PaymentID) *chat1.UIPaymentInfo {
	defer libkb.CTrace(ctx, p.G().GetLog(), fmt.Sprintf("PaymentLoader.Load(cid=%s,mid=%s,pid=%s)", convID, msgID, paymentID), func() error { return nil })()

	p.Lock()
	defer p.Unlock()

	pair, ok := p.messages[paymentID]
	// store the msg info if necessary
	if !ok {
		p.messages[paymentID] = msgPair{convID: convID, msgID: msgID}
	} else if !pair.convID.Eq(convID) || pair.msgID != msgID {
		p.G().GetLog().CWarningf(ctx, "existing message info does not match load info: (%v, %v) != (%v, %v)", pair.convID, pair.msgID, convID, msgID)
	}

	info, ok := p.payments[paymentID]
	if ok {
		return info
	}

	// need to load payment in background
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

	info, err := p.uiInfo(details)
	if err != nil {
		p.G().GetLog().CDebugf(ctx, "error getting ui info from details for %s: %s", id.TxID, err)
		return
	}

	p.Lock()
	p.payments[id] = info
	p.Unlock()

	p.sendNotification(ctx, id, info)
}

func (p *PaymentLoader) uiInfo(details stellar1.PaymentDetails) (*chat1.UIPaymentInfo, error) {
	return &chat1.UIPaymentInfo{}, nil
}

func (p *PaymentLoader) sendNotification(ctx context.Context, id stellar1.PaymentID, info *chat1.UIPaymentInfo) {
	p.Lock()
	pair, ok := p.messages[id]
	p.Unlock()

	if !ok {
		p.G().GetLog().CDebugf(ctx, "not sending chat notification for %s (no associated convID, msgID)", id.TxID)
		return
	}

	p.G().GetLog().CDebugf(ctx, "sending chat notification for payment %s to %s, %s", id.TxID, pair.convID, pair.msgID)
	uid := p.G().ActiveDevice.UID()
	p.G().NotifyRouter.HandleChatPaymentInfo(ctx, uid, pair.convID, pair.msgID, *info)
}
