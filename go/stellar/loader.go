package stellar

import (
	"fmt"
	"sync"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/stellar1"
)

type chatMsg struct {
	convID chat1.ConversationID
	msgID  chat1.MessageID
	sender libkb.NormalizedUsername
}

type Loader struct {
	libkb.Contextified

	payments  map[stellar1.PaymentID]*stellar1.PaymentLocal
	pmessages map[stellar1.PaymentID]chatMsg
	pqueue    chan stellar1.PaymentID

	requests  map[stellar1.KeybaseRequestID]*stellar1.RequestDetailsLocal
	rmessages map[stellar1.KeybaseRequestID]chatMsg
	rqueue    chan stellar1.KeybaseRequestID

	shutdownOnce sync.Once
	done         bool

	sync.Mutex
}

var defaultLoader *Loader
var defaultLock sync.Mutex

func NewLoader(g *libkb.GlobalContext) *Loader {
	p := &Loader{
		Contextified: libkb.NewContextified(g),
		payments:     make(map[stellar1.PaymentID]*stellar1.PaymentLocal),
		pmessages:    make(map[stellar1.PaymentID]chatMsg),
		pqueue:       make(chan stellar1.PaymentID, 50),
		requests:     make(map[stellar1.KeybaseRequestID]*stellar1.RequestDetailsLocal),
		rmessages:    make(map[stellar1.KeybaseRequestID]chatMsg),
		rqueue:       make(chan stellar1.KeybaseRequestID, 50),
	}

	go p.runPayments()
	go p.runRequests()

	return p
}

func DefaultLoader(g *libkb.GlobalContext) *Loader {
	defaultLock.Lock()
	defer defaultLock.Unlock()

	if defaultLoader == nil {
		defaultLoader = NewLoader(g)
		g.PushShutdownHook(func() error {
			defaultLock.Lock()
			err := defaultLoader.Shutdown()
			defaultLoader = nil
			defaultLock.Unlock()
			return err
		})
	}

	return defaultLoader
}

func (p *Loader) LoadPayment(ctx context.Context, convID chat1.ConversationID, msgID chat1.MessageID, senderUsername string, paymentID stellar1.PaymentID) *chat1.UIPaymentInfo {
	defer libkb.CTrace(ctx, p.G().GetLog(), fmt.Sprintf("Loader.LoadPayment(cid=%s,mid=%s,pid=%s)", convID, msgID, paymentID), func() error { return nil })()

	p.Lock()
	defer p.Unlock()

	m := libkb.NewMetaContext(ctx, p.G())

	if p.done {
		m.CDebugf("loader shutdown, not loading payment %s", paymentID)
		return nil
	}

	msg, ok := p.pmessages[paymentID]
	// store the msg info if necessary
	if !ok {
		msg = chatMsg{
			convID: convID,
			msgID:  msgID,
			sender: libkb.NewNormalizedUsername(senderUsername),
		}
		p.pmessages[paymentID] = msg
	} else if !msg.convID.Eq(convID) || msg.msgID != msgID {
		m.CWarningf("existing payment message info does not match load info: (%v, %v) != (%v, %v)", msg.convID, msg.msgID, convID, msgID)
	}

	payment, ok := p.payments[paymentID]
	if ok {
		info := p.uiPaymentInfo(m, payment, msg)
		if info.Status != stellar1.PaymentStatus_COMPLETED {
			// to be safe, schedule a reload of the payment in case it has
			// changed since stored
			p.pqueue <- paymentID
		}

		return info
	}

	// not found, need to load payment in background
	p.pqueue <- paymentID

	return nil
}

func (p *Loader) LoadRequest(ctx context.Context, convID chat1.ConversationID, msgID chat1.MessageID, senderUsername string, requestID stellar1.KeybaseRequestID) *chat1.UIRequestInfo {
	defer libkb.CTrace(ctx, p.G().GetLog(), fmt.Sprintf("Loader.LoadRequest(cid=%s,mid=%s,rid=%s)", convID, msgID, requestID), func() error { return nil })()

	p.Lock()
	defer p.Unlock()

	m := libkb.NewMetaContext(ctx, p.G())

	if p.done {
		m.CDebugf("loader shutdown, not loading request %s", requestID)
		return nil
	}

	m.CDebugf("*************** loading %s", requestID)

	msg, ok := p.rmessages[requestID]
	// store the msg info if necessary
	if !ok {
		msg = chatMsg{
			convID: convID,
			msgID:  msgID,
			sender: libkb.NewNormalizedUsername(senderUsername),
		}
		p.rmessages[requestID] = msg
	} else if !msg.convID.Eq(convID) || msg.msgID != msgID {
		m.CWarningf("existing request message info does not match load info: (%v, %v) != (%v, %v)", msg.convID, msg.msgID, convID, msgID)
	}

	request, ok := p.requests[requestID]
	var info *chat1.UIRequestInfo
	if ok {
		info = p.uiRequestInfo(m, request, msg)
	}

	// always load request in background (even if found) to make sure stored value is up-to-date.
	p.rqueue <- requestID

	return info
}

// UpdatePayment schedules a load of paymentID. Gregor status notification handlers
// should call this to update the payment data.
func (p *Loader) UpdatePayment(ctx context.Context, paymentID stellar1.PaymentID) {
	if p.done {
		return
	}

	p.pqueue <- paymentID
}

// UpdateRequest schedules a load for requestID. Gregor status notification handlers
// should call this to update the request data.
func (p *Loader) UpdateRequest(ctx context.Context, requestID stellar1.KeybaseRequestID) {
	if p.done {
		return
	}

	p.rqueue <- requestID
}

func (p *Loader) Shutdown() error {
	p.shutdownOnce.Do(func() {
		p.Lock()
		p.G().GetLog().Debug("shutting down stellar loader")
		p.done = true
		close(p.pqueue)
		close(p.rqueue)
		p.Unlock()
	})
	return nil
}

func (p *Loader) runPayments() {
	for id := range p.pqueue {
		p.loadPayment(id)
	}
}

func (p *Loader) runRequests() {
	for id := range p.rqueue {
		p.loadRequest(id)
	}
}

func (p *Loader) loadPayment(id stellar1.PaymentID) {
	ctx := context.Background()
	s := getGlobal(p.G())
	details, err := s.remoter.PaymentDetails(ctx, id.TxID.String())
	if err != nil {
		p.G().GetLog().CDebugf(ctx, "error getting payment details for %s: %s", id.TxID, err)
		return
	}

	m := libkb.NewMetaContext(ctx, p.G())
	oc := NewOwnAccountLookupCache(ctx, m.G())
	summary, err := TransformPaymentSummary(m, "", details.Summary, oc)
	if err != nil {
		p.G().GetLog().CDebugf(ctx, "error transforming details for %s: %s", id.TxID, err)
		return
	}

	p.Lock()
	p.payments[id] = summary
	p.Unlock()

	p.sendPaymentNotification(m, id, summary)
}

func (p *Loader) loadRequest(id stellar1.KeybaseRequestID) {
	ctx := context.Background()
	m := libkb.NewMetaContext(ctx, p.G())
	s := getGlobal(p.G())
	details, err := s.remoter.RequestDetails(ctx, id)
	if err != nil {
		m.CDebugf("error getting request details for %s: %s", id, err)
		return
	}
	local, err := TransformRequestDetails(m, details)
	if err != nil {
		m.CDebugf("error transforming request details for %s: %s", id, err)
		return
	}

	p.Lock()
	p.requests[id] = local
	p.Unlock()

	p.sendRequestNotification(m, id, local)
}

func (p *Loader) uiPaymentInfo(m libkb.MetaContext, summary *stellar1.PaymentLocal, msg chatMsg) *chat1.UIPaymentInfo {
	info := chat1.UIPaymentInfo{
		AmountDescription: summary.AmountDescription,
		Worth:             summary.Worth,
		Delta:             summary.Delta,
		Note:              summary.Note,
		Status:            summary.StatusSimplified,
		StatusDescription: summary.StatusDescription,
	}

	info.Delta = stellar1.BalanceDelta_NONE

	// Calculate the payment delta
	if summary.FromType == stellar1.ParticipantType_OWNACCOUNT {
		// This is a transfer between the user's own accounts.
		info.Delta = stellar1.BalanceDelta_NONE
	} else {
		info.Delta = stellar1.BalanceDelta_INCREASE
		if msg.sender.Eq(p.G().ActiveDevice.Username(m)) {
			info.Delta = stellar1.BalanceDelta_DECREASE
		}
	}

	return &info
}

func (p *Loader) sendPaymentNotification(m libkb.MetaContext, id stellar1.PaymentID, summary *stellar1.PaymentLocal) {
	p.Lock()
	msg, ok := p.pmessages[id]
	p.Unlock()

	if !ok {
		m.CDebugf("not sending payment chat notification for %s (no associated convID, msgID)", id.TxID)
		return
	}

	m.CDebugf("sending chat notification for payment %s to %s, %s", id.TxID, msg.convID, msg.msgID)
	uid := p.G().ActiveDevice.UID()
	info := p.uiPaymentInfo(m, summary, msg)
	p.G().NotifyRouter.HandleChatPaymentInfo(m.Ctx(), uid, msg.convID, msg.msgID, *info)
}

func (p *Loader) uiRequestInfo(m libkb.MetaContext, details *stellar1.RequestDetailsLocal, msg chatMsg) *chat1.UIRequestInfo {
	info := chat1.UIRequestInfo{
		Amount:            details.Amount,
		AmountDescription: details.AmountDescription,
		Asset:             details.Asset,
		Currency:          details.Currency,
	}

	return &info
}

func (p *Loader) sendRequestNotification(m libkb.MetaContext, id stellar1.KeybaseRequestID, details *stellar1.RequestDetailsLocal) {
	p.Lock()
	msg, ok := p.rmessages[id]
	p.Unlock()

	if !ok {
		m.CDebugf("not sending request chat notification for %s (no associated convID, msgID)", id)
		return
	}

	m.CDebugf("sending chat notification for request %s to %s, %s", id, msg.convID, msg.msgID)
	uid := p.G().ActiveDevice.UID()
	info := p.uiRequestInfo(m, details, msg)
	p.G().NotifyRouter.HandleChatRequestInfo(m.Ctx(), uid, msg.convID, msg.msgID, *info)
}
