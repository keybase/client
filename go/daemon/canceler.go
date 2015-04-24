package main

import (
	"sync"

	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
)

// Cancelers are types with a Cancel method.  This is currently
// being used for engines whose Run() can be canceled.
type Canceler interface {
	Cancel() error
}

// CancelHandler embeds BaseHandler but also maintains a map of
// sessionIDs to Cancelers.  This is used by handlers that allow a
// long-running operation to be cancelled by a cancel rpc.
// CancelHandler is safe for use by multiple concurrent
// goroutines.
type CancelHandler struct {
	*BaseHandler
	mapMu     sync.RWMutex
	cancelers map[int]Canceler
}

func NewCancelHandler(xp *rpc2.Transport) *CancelHandler {
	return &CancelHandler{BaseHandler: NewBaseHandler(xp)}
}

func (h *CancelHandler) setCanceler(sessionID int, c Canceler) {
	h.mapMu.Lock()
	if h.cancelers == nil {
		h.cancelers = make(map[int]Canceler)
	}
	h.cancelers[sessionID] = c
	h.mapMu.Unlock()
}

func (h *CancelHandler) removeCanceler(sessionID int) {
	h.mapMu.Lock()
	delete(h.cancelers, sessionID)
	h.mapMu.Unlock()
}

func (h *CancelHandler) canceler(sessionID int) Canceler {
	h.mapMu.RLock()
	c, ok := h.cancelers[sessionID]
	h.mapMu.RUnlock()
	if !ok {
		return nil
	}
	return c
}
