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

const (
	maxPayments = 1000
	maxRequests = 1000
)

type Loader struct {
	libkb.Contextified

	payments  map[stellar1.PaymentID]*stellar1.PaymentLocal
	pmessages map[stellar1.PaymentID]chatMsg
	pqueue    chan stellar1.PaymentID
	plist     []stellar1.PaymentID

	requests  map[stellar1.KeybaseRequestID]*stellar1.RequestDetailsLocal
	rmessages map[stellar1.KeybaseRequestID]chatMsg
	rqueue    chan stellar1.KeybaseRequestID
	rlist     []stellar1.KeybaseRequestID

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

func (p *Loader) GetPaymentLocal(ctx context.Context, paymentID stellar1.PaymentID) (*stellar1.PaymentLocal, bool) {
	pmt, ok := p.payments[paymentID]
	return pmt, ok
}

func (p *Loader) LoadPayment(ctx context.Context, convID chat1.ConversationID, msgID chat1.MessageID, senderUsername string, paymentID stellar1.PaymentID) *chat1.UIPaymentInfo {
	defer libkb.CTrace(ctx, p.G().GetLog(), fmt.Sprintf("Loader.LoadPayment(cid=%s,mid=%s,pid=%s)", convID, msgID, paymentID), func() error { return nil })()

	p.Lock()
	defer p.Unlock()

	m := libkb.NewMetaContext(ctx, p.G())

	if p.done {
		m.Debug("loader shutdown, not loading payment %s", paymentID)
		return nil
	}

	if len(paymentID) == 0 {
		m.Debug("LoadPayment called with empty paymentID for %s/%s", convID, msgID)
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
		m.Warning("existing payment message info does not match load info: (%v, %v) != (%v, %v)", msg.convID, msg.msgID, convID, msgID)
	}

	payment, ok := p.GetPaymentLocal(ctx, paymentID)
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
		m.Debug("loader shutdown, not loading request %s", requestID)
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
		m.Warning("existing request message info does not match load info: (%v, %v) != (%v, %v)", msg.convID, msg.msgID, convID, msgID)
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
		if err := p.loadPayment(libkb.NewMetaContextTODO(p.G()), id); err != nil {
			p.G().GetLog().CDebugf(context.TODO(), "Unable to load payment: %v", err)
		}
		p.cleanPayments(maxPayments)
	}
}

func (p *Loader) runRequests() {
	for id := range p.rqueue {
		p.loadRequest(id)
		p.cleanRequests(maxRequests)
	}
}

func (p *Loader) LoadPaymentSync(ctx context.Context, paymentID stellar1.PaymentID) {
	mctx := libkb.NewMetaContext(ctx, p.G())
	defer mctx.TraceTimed(fmt.Sprintf("LoadPaymentSync(%s)", paymentID), func() error { return nil })()

	backoffPolicy := libkb.BackoffPolicy{
		Millis: []int{2000, 3000, 5000},
	}
	for i := 0; i <= 3; i++ {
		err := p.loadPayment(mctx, paymentID)
		if err == nil {
			break
		}
		mctx.Debug("error on attempt %d to load payment %s: %s. sleep and retry.", i, paymentID, err)
		time.Sleep(backoffPolicy.Duration(i))
	}
}

func (p *Loader) loadPayment(mctx libkb.MetaContext, id stellar1.PaymentID) (err error) {
	mctx, cancel := mctx.BackgroundWithLogTags().WithLogTag("LP").WithTimeout(15 * time.Second)
	defer cancel()
	defer mctx.TraceTimed(fmt.Sprintf("loadPayment(%s)", id), func() error { return nil })()

	s := getGlobal(p.G())
	details, err := s.remoter.PaymentDetailsGeneric(mctx.Ctx(), stellar1.TransactionIDFromPaymentID(id).String())
	if err != nil {
		mctx.Debug("error getting payment details for %s: %s", id, err)
		return err
	}

	oc := NewOwnAccountLookupCache(mctx)
	summary, err := TransformPaymentSummaryGeneric(mctx, details.Summary, oc)
	if err != nil {
		mctx.Debug("error transforming details for %s: %s", id, err)
		return err
	}

	p.storePayment(id, summary)

	p.sendPaymentNotification(mctx, id, summary)
	return nil
}

func (p *Loader) loadRequest(id stellar1.KeybaseRequestID) {
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	m := libkb.NewMetaContext(ctx, p.G())
	defer m.TraceTimed(fmt.Sprintf("loadRequest(%s)", id), func() error { return nil })()

	s := getGlobal(p.G())
	details, err := s.remoter.RequestDetails(ctx, id)
	if err != nil {
		m.Debug("error getting request details for %s: %s", id, err)
		return
	}
	local, err := TransformRequestDetails(m, details)
	if err != nil {
		m.Debug("error transforming request details for %s: %s", id, err)
		return
	}

	// must be a newly loaded request or the status changed for
	// a notification to be sent below
	isUpdate := p.storeRequest(id, local)

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
		IssuerDescription: summary.IssuerDescription,
		PaymentID:         summary.Id,
		SourceAmount:      summary.SourceAmountActual,
		SourceAsset:       summary.SourceAsset,
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
		m.Debug("sending chat notification for payment %s using empty msg info", id)
		msg = chatMsg{}
	} else {
		m.Debug("sending chat notification for payment %s to %s, %s", id, msg.convID, msg.msgID)
	}

	uid := p.G().ActiveDevice.UID()
	info := p.uiPaymentInfo(m, summary, msg)

	if info.AccountID != nil && summary.StatusSimplified != stellar1.PaymentStatus_PENDING {
		// let WalletState know
		err := p.G().GetStellar().RemovePendingTx(m, *info.AccountID, stellar1.TransactionIDFromPaymentID(id))
		if err != nil {
			m.Debug("ws.RemovePendingTx error: %s", err)
		}
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
		m.Debug("not sending request chat notification for %s (no associated convID, msgID)", id)
		return
	}

	m.Debug("sending chat notification for request %s to %s, %s", id, msg.convID, msg.msgID)
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

func (p *Loader) storePayment(id stellar1.PaymentID, payment *stellar1.PaymentLocal) {
	p.Lock()
	p.payments[id] = payment
	p.plist = append(p.plist, id)
	p.Unlock()
}

// storeRequest returns true if it updated an existing value.
func (p *Loader) storeRequest(id stellar1.KeybaseRequestID, request *stellar1.RequestDetailsLocal) (isUpdate bool) {
	p.Lock()
	x, ok := p.requests[id]
	if !ok || x.Status != request.Status {
		isUpdate = true
	}
	p.requests[id] = request
	p.rlist = append(p.rlist, id)
	p.Unlock()

	return isUpdate
}

func (p *Loader) PaymentsLen() int {
	p.Lock()
	defer p.Unlock()
	return len(p.payments)
}

func (p *Loader) RequestsLen() int {
	p.Lock()
	defer p.Unlock()
	return len(p.requests)
}

func (p *Loader) cleanPayments(n int) int {
	p.Lock()
	defer p.Unlock()

	var deleted int
	toDelete := len(p.payments) - n
	if toDelete <= 0 {
		return 0
	}

	for i := 0; i < toDelete; i++ {
		delete(p.payments, p.plist[i])
		delete(p.pmessages, p.plist[i])
		deleted++
	}

	p.plist = p.plist[toDelete:]

	return deleted
}

func (p *Loader) cleanRequests(n int) int {
	p.Lock()
	defer p.Unlock()

	var deleted int
	toDelete := len(p.requests) - n
	if toDelete <= 0 {
		return 0
	}

	for i := 0; i < toDelete; i++ {
		delete(p.requests, p.rlist[i])
		delete(p.rmessages, p.rlist[i])
		deleted++
	}

	p.rlist = p.rlist[toDelete:]

	return deleted
}
