// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"net"
	"net/url"
	"sync"
	"time"

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

func (h *reachabilityHandler) ReachabilityChanged(_ context.Context, _ keybase1.Reachability) error {
	return nil
}

func (h *reachabilityHandler) StartReachability(_ context.Context) (keybase1.Reachability, error) {
	return h.reachability.start(), nil
}

func (h *reachabilityHandler) CheckReachability(_ context.Context) (keybase1.Reachability, error) {
	return h.reachability.check(), nil
}

type reachability struct {
	libkb.Contextified
	sync.Mutex
	lastReachability keybase1.Reachability
	started          bool
	shutdownCh       chan bool
}

func newReachability(g *libkb.GlobalContext) *reachability {
	return &reachability{
		Contextified: libkb.NewContextified(g),
		shutdownCh:   make(chan bool),
	}
}

func (h *reachability) setReachability(r keybase1.Reachability) {
	if h.lastReachability.Reachable != r.Reachable {
		h.G().Log.Info("Reachability changed: %#v", r)
		h.G().NotifyRouter.HandleReachability(r)
	}
	h.lastReachability = r
}

func (h *reachability) start() keybase1.Reachability {
	h.Lock()
	if !h.started {
		h.started = true
		go func() {
			// Do check right away
			h.check()
			for {
				select {
				case <-h.G().Clock().After(time.Second * 30):
					h.check()
				case <-h.shutdownCh:
					h.G().Log.Debug("Shutdown")
					h.setReachability(keybase1.Reachability{Reachable: keybase1.Reachable_NO})
					return
				}
			}
		}()
	}
	h.Unlock()
	return h.lastReachability
}

func (h *reachability) check() (k keybase1.Reachability) {
	// When gregor connection issues are resolved, we might want to use the
	// status of the gregorHandler connection to determine reachability, since
	// it would be a more accurate indicator or the ability of the app to receive
	// notifications.
	u, err := url.Parse(h.G().Env.GetGregorURI())
	if err != nil {
		return
	}

	h.G().Log.Debug("Reachability host: %s", u.Host)
	conn, err := net.DialTimeout("tcp", u.Host, 10*time.Second)
	if conn != nil {
		conn.Close()
	}

	if err != nil {
		k.Reachable = keybase1.Reachable_NO
	} else {
		k.Reachable = keybase1.Reachable_YES
	}
	h.setReachability(k)
	return k
}
