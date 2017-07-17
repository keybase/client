// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"sync"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
)

type reachabilityHandler struct {
	*BaseHandler
	libkb.Contextified
	reachability *reachability
}

func newReachabilityHandler(xp rpc.Transporter, g *libkb.GlobalContext, reachability *reachability) *reachabilityHandler {
	return &reachabilityHandler{
		BaseHandler:  NewBaseHandler(xp),
		Contextified: libkb.NewContextified(g),
		reachability: reachability,
	}
}

func (h *reachabilityHandler) ReachabilityChanged(_ context.Context, _ keybase1.Reachability) (err error) {
	h.G().Trace("ReachabilityChanged", func() error { return err })()
	return nil
}

func (h *reachabilityHandler) StartReachability(_ context.Context) (res keybase1.Reachability, err error) {
	h.G().Trace("StartReachability", func() error { return err })()
	return keybase1.Reachability{
		Reachable: keybase1.Reachable_UNKNOWN,
	}, nil
}

func (h *reachabilityHandler) CheckReachability(_ context.Context) (res keybase1.Reachability, err error) {
	h.G().Trace("CheckReachability", func() error { return err })()
	return h.reachability.check(), nil
}

type reachability struct {
	libkb.Contextified
	lastReachability keybase1.Reachability
	setMutex         sync.Mutex

	gh *gregorHandler
}

func newReachability(g *libkb.GlobalContext, gh *gregorHandler) *reachability {
	return &reachability{
		Contextified: libkb.NewContextified(g),
		gh:           gh,
	}
}

func (h *reachability) setReachability(r keybase1.Reachability) {
	h.setMutex.Lock()
	defer h.setMutex.Unlock()

	if h.lastReachability.Reachable != r.Reachable {
		h.G().Log.Debug("Reachability changed: %#v", r)
		h.G().NotifyRouter.HandleReachability(r)
	}
	h.lastReachability = r
}

func (h *reachability) check() (k keybase1.Reachability) {
	reachable := h.gh.isReachable()
	if reachable {
		k.Reachable = keybase1.Reachable_YES
	} else {
		k.Reachable = keybase1.Reachable_NO
	}
	h.setReachability(k)
	return k
}

func (h *reachability) IsConnected(ctx context.Context) libkb.ConnectivityMonitorResult {
	switch h.lastReachability.Reachable {
	case keybase1.Reachable_YES:
		return libkb.ConnectivityMonitorYes
	case keybase1.Reachable_NO:
		return libkb.ConnectivityMonitorNo
	default:
		return libkb.ConnectivityMonitorUnknown
	}
}
