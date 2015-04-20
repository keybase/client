package main

import (
	"sync"

	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
)

type Canceler interface {
	Cancel() error
}

type CancelHandler struct {
	BaseHandler
	mapMu     sync.RWMutex
	cancelers map[int]Canceler
}

func NewCancelHandler(xp *rpc2.Transport) *CancelHandler {
	return &CancelHandler{BaseHandler: BaseHandler{xp: xp}}
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
