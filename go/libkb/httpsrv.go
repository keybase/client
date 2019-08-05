// Copyright 2018 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

// TODO: Remove this file once libkbfs doesn't use it anymore.

import "github.com/keybase/client/go/kbhttp"

type HTTPSrvListenerSource = kbhttp.ListenerSource

type HTTPSrv = kbhttp.Srv

func NewHTTPSrv(g *GlobalContext, listenerSource HTTPSrvListenerSource) *kbhttp.Srv {
	return kbhttp.NewSrv(g.GetLog(), listenerSource)
}

func NewPortRangeListenerSource(low, high int) *kbhttp.PortRangeListenerSource {
	return kbhttp.NewPortRangeListenerSource(low, high)
}
