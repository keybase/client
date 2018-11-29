package stellarsvc

import (
	"errors"
	"fmt"
	"time"

	lru "github.com/hashicorp/golang-lru"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/stellar1"
)

var ErrNotCached = errors.New("not cached")

type Memo struct {
	libkb.Contextified
	lru *lru.Cache
}

func NewMemo(g *libkb.GlobalContext) *Memo {
	c, err := lru.New(10)
	if err != nil {
		// couldn't make LRU, so don't use it
		return &Memo{}
	}
	return &Memo{
		lru:          c,
		Contextified: libkb.NewContextified(g),
	}
}

func pendingKey(accountID stellar1.AccountID) string {
	return pendingKeyAt(accountID, time.Now())
}

func pendingKeyAt(accountID stellar1.AccountID, at time.Time) string {
	at = at.Truncate(10 * time.Second)
	return fmt.Sprintf("pending:%s:%d", accountID, at.Unix())
}

func (m *Memo) PendingPayments(accountID stellar1.AccountID) (payments []stellar1.PaymentOrErrorLocal, err error) {
	return m.pendingPaymentsAt(accountID, time.Now())
}

func (m *Memo) pendingPaymentsAt(accountID stellar1.AccountID, at time.Time) (payments []stellar1.PaymentOrErrorLocal, err error) {
	if m.lru == nil {
		return nil, ErrNotCached
	}

	m.G().Log.Debug("pendingPaymentsAt key: %s", pendingKeyAt(accountID, at))

	v, ok := m.lru.Get(pendingKeyAt(accountID, at))
	if !ok {
		return nil, ErrNotCached
	}
	payments, ok = v.([]stellar1.PaymentOrErrorLocal)
	if !ok {
		return nil, ErrNotCached
	}

	return payments, nil
}

func (m *Memo) InsertPendingPayments(accountID stellar1.AccountID, payments []stellar1.PaymentOrErrorLocal) {
	m.insertPendingPaymentsAt(accountID, payments, time.Now())
}

func (m *Memo) insertPendingPaymentsAt(accountID stellar1.AccountID, payments []stellar1.PaymentOrErrorLocal, at time.Time) {
	if m.lru == nil {
		return
	}
	m.G().Log.Debug("insertPendingPaymentsAt key: %s", pendingKeyAt(accountID, at))
	m.lru.Add(pendingKeyAt(accountID, at), payments)
}

func (m *Memo) InvalidatePendingPayments(accountID stellar1.AccountID) {
	m.invalidatePendingPaymentsAt(accountID, time.Now())
}

func (m *Memo) invalidatePendingPaymentsAt(accountID stellar1.AccountID, at time.Time) {
	if m.lru == nil {
		return
	}
	m.lru.Remove(pendingKeyAt(accountID, at))
}
