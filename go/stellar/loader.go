package stellar

import (
	"fmt"
	"sync"
	"time"

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

type PaymentStatusUpdate struct {
	AccountID stellar1.AccountID
	TxID      stellar1.TransactionID
	Status    stellar1.PaymentStatus
}

type Loader struct {
	libkb.Contextified

	payments  map[stellar1.PaymentID]*stellar1.PaymentLocal
	pmessages map[stellar1.PaymentID]chatMsg
	pqueue    chan stellar1.PaymentID

	requests  map[stellar1.KeybaseRequestID]*stellar1.RequestDetailsLocal
	rmessages map[stellar1.KeybaseRequestID]chatMsg
	rqueue    chan stellar1.KeybaseRequestID

	listeners map[string]chan PaymentStatusUpdate

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
		pqueue:       make(chan stellar1.PaymentID, 100),
		requests:     make(map[stellar1.KeybaseRequestID]*stellar1.RequestDetailsLocal),
		rmessages:    make(map[stellar1.KeybaseRequestID]chatMsg),
		rqueue:       make(chan stellar1.KeybaseRequestID, 100),
		listeners:    make(map[string]chan PaymentStatusUpdate),
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

	if len(paymentID) == 0 {
		m.CDebugf("LoadPayment called with empty paymentID for %s/%s", convID, msgID)
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
		p.G().NotifyRouter.HandleChatPaymentInfo(m.Ctx(), p.G().ActiveDevice.UID(), convID, msgID, *info)
		if info.Status != stellar1.PaymentStatus_COMPLETED {
			// to be safe, schedule a reload of the payment in case it has
			// changed since stored
			p.enqueuePayment(paymentID)
		}
		return info
	}

	// not found, need to load payment in background
	p.enqueuePayment(paymentID)

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
	p.enqueueRequest(requestID)

	return info
}

// UpdatePayment schedules a load of paymentID. Gregor status notification handlers
// should call this to update the payment data.
func (p *Loader) UpdatePayment(ctx context.Context, paymentID stellar1.PaymentID) {
	if p.done {
		return
	}

	p.enqueuePayment(paymentID)
}

// UpdateRequest schedules a load for requestID. Gregor status notification handlers
// should call this to update the request data.
func (p *Loader) UpdateRequest(ctx context.Context, requestID stellar1.KeybaseRequestID) {
	if p.done {
		return
	}

	p.enqueueRequest(requestID)
}

// GetListener returns a channel and an ID for a payment status listener.  The ID
// can be used to remove the listener from the loader.
func (p *Loader) GetListener() (id string, ch chan PaymentStatusUpdate, err error) {
	ch = make(chan PaymentStatusUpdate, 100)
	id, err = libkb.RandString("", 8)
	if err != nil {
		return id, ch, err
	}
	p.Lock()
	p.listeners[id] = ch
	p.Unlock()

	return id, ch, nil
}

// RemoveListener removes a listener from the loader when it is no longer needed.
func (p *Loader) RemoveListener(id string) {
	p.Lock()
	delete(p.listeners, id)
	p.Unlock()
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
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	mctx := libkb.NewMetaContext(ctx, p.G())
	defer mctx.CTraceTimed(fmt.Sprintf("loadPayment(%s)", id), func() error { return nil })()

	s := getGlobal(p.G())
	details, err := s.remoter.PaymentDetails(ctx, stellar1.TransactionIDFromPaymentID(id).String())
	if err != nil {
		mctx.CDebugf("error getting payment details for %s: %s", id, err)
		return
	}

	oc := NewOwnAccountLookupCache(mctx)
	summary, err := TransformPaymentSummaryGeneric(mctx, details.Summary, oc)
	if err != nil {
		mctx.CDebugf("error transforming details for %s: %s", id, err)
		return
	}

	p.Lock()
	p.payments[id] = summary
	p.Unlock()

	p.sendPaymentNotification(mctx, id, summary)
}

func (p *Loader) loadRequest(id stellar1.KeybaseRequestID) {
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	m := libkb.NewMetaContext(ctx, p.G())
	defer m.CTraceTimed(fmt.Sprintf("loadRequest(%s)", id), func() error { return nil })()

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

	isUpdate := false
	p.Lock()
	existing, ok := p.requests[id]
	if !ok || local.Status != existing.Status {
		// must be a newly loaded request or the status changed for
		// a notification to be sent below
		isUpdate = true
	}
	p.requests[id] = local
	p.Unlock()

	if isUpdate {
		p.sendRequestNotification(m, id, local)
	}
}

func (p *Loader) uiPaymentInfo(m libkb.MetaContext, summary *stellar1.PaymentLocal, msg chatMsg) *chat1.UIPaymentInfo {
	info := chat1.UIPaymentInfo{
		AccountID:         &summary.FromAccountID,
		AmountDescription: summary.AmountDescription,
		Worth:             summary.Worth,
		WorthAtSendTime:   summary.WorthAtSendTime,
		Delta:             summary.Delta,
		Note:              summary.Note,
		PaymentID:         summary.Id,
		Status:            summary.StatusSimplified,
		StatusDescription: summary.StatusDescription,
		StatusDetail:      summary.StatusDetail,
		ShowCancel:        summary.ShowCancel,
		FromUsername:      summary.FromUsername,
		ToUsername:        summary.ToUsername,
	}

	info.Delta = stellar1.BalanceDelta_NONE

	// Calculate the payment delta & relevant accountID
	if summary.FromType == stellar1.ParticipantType_OWNACCOUNT && summary.ToType == stellar1.ParticipantType_OWNACCOUNT {
		// This is a transfer between the user's own accounts.
		info.Delta = stellar1.BalanceDelta_NONE
	} else {
		info.Delta = stellar1.BalanceDelta_INCREASE
		if msg.sender != "" {
			// this is related to a chat message
			if msg.sender.Eq(p.G().ActiveDevice.Username(m)) {
				info.Delta = stellar1.BalanceDelta_DECREASE
			} else {
				// switch the account ID to the recipient
				info.AccountID = summary.ToAccountID
			}
		}
	}

	return &info
}

func (p *Loader) sendPaymentNotification(m libkb.MetaContext, id stellar1.PaymentID, summary *stellar1.PaymentLocal) {
	p.Lock()
	msg, ok := p.pmessages[id]
	p.Unlock()

	if !ok {
		// this is ok: frontend only needs the payment ID
		m.CDebugf("sending chat notification for payment %s using empty msg info", id)
		msg = chatMsg{}
	} else {
		m.CDebugf("sending chat notification for payment %s to %s, %s", id, msg.convID, msg.msgID)
	}

	uid := p.G().ActiveDevice.UID()
	info := p.uiPaymentInfo(m, summary, msg)

	if info.AccountID != nil && summary.StatusSimplified != stellar1.PaymentStatus_PENDING {
		// let WalletState know
		p.G().GetStellar().RemovePendingTx(m, *info.AccountID, stellar1.TransactionIDFromPaymentID(id))
		p.Lock()
		for _, ch := range p.listeners {
			ch <- PaymentStatusUpdate{AccountID: *info.AccountID, TxID: stellar1.TransactionIDFromPaymentID(id), Status: summary.StatusSimplified}
		}
		p.Unlock()
	}

	p.G().NotifyRouter.HandleChatPaymentInfo(m.Ctx(), uid, msg.convID, msg.msgID, *info)
}

func (p *Loader) uiRequestInfo(m libkb.MetaContext, details *stellar1.RequestDetailsLocal, msg chatMsg) *chat1.UIRequestInfo {
	info := chat1.UIRequestInfo{
		Amount:             details.Amount,
		AmountDescription:  details.AmountDescription,
		Asset:              details.Asset,
		Currency:           details.Currency,
		Status:             details.Status,
		WorthAtRequestTime: details.WorthAtRequestTime,
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

func (p *Loader) enqueuePayment(paymentID stellar1.PaymentID) {
	select {
	case p.pqueue <- paymentID:
	default:
		p.G().Log.Debug("stellar.Loader payment queue full")
	}
}

func (p *Loader) enqueueRequest(requestID stellar1.KeybaseRequestID) {
	select {
	case p.rqueue <- requestID:
	default:
		p.G().Log.Debug("stellar.Loader request queue full")
	}
}
