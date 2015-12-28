// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package sources

import (
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
)

type updateResponse struct {
	Status libkb.AppStatus `json:"status"`
	Update keybase1.Update `codec:"update" json:"update"`
}

func (k *updateResponse) GetAppStatus() *libkb.AppStatus {
	return &k.Status
}

// KeybaseUpdateSource finds releases/updates from custom url (used primarily for testing)
type KeybaseUpdateSource struct {
	libkb.Contextified
}

func NewKeybaseUpdateSource(g *libkb.GlobalContext) KeybaseUpdateSource {
	return KeybaseUpdateSource{
		Contextified: libkb.NewContextified(g),
	}
}

func (k KeybaseUpdateSource) Description() string {
	return "Keybase"
}

func (k KeybaseUpdateSource) FindUpdate(options keybase1.UpdateOptions) (update *keybase1.Update, err error) {
	APIArgs := libkb.HTTPArgs{
		"version":  libkb.S{Val: options.Version},
		"platform": libkb.S{Val: options.Platform},
		"run_mode": libkb.S{Val: string(k.G().Env.GetRunMode())},
		"channel":  libkb.S{Val: options.Channel},
	}

	var res updateResponse
	err = k.G().API.GetDecode(libkb.APIArg{
		Endpoint: "pkg/update",
		Args:     APIArgs,
	}, &res)
	if err != nil {
		return
	}

	update = &res.Update

	return
}
