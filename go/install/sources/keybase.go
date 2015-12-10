// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package sources

import (
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
)

type updateResponse struct {
	Status keybase1.Status `codec:"status" json:"status"`
	Update keybase1.Update `codec:"update" json:"update"`
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

func (k KeybaseUpdateSource) FindUpdate(config keybase1.UpdateConfig) (update *keybase1.Update, err error) {
	APIArgs := libkb.HTTPArgs{
		"version":  libkb.S{Val: config.Version},
		"os_name":  libkb.S{Val: config.OsName},
		"run_mode": libkb.S{Val: string(k.G().Env.GetRunMode())},
		"channel":  libkb.S{Val: config.Channel},
	}

	var res updateResponse
	err = k.G().API.GetDecode(libkb.APIArg{
		Endpoint: "update.json",
		Args:     APIArgs,
	}, res)
	if err != nil {
		return
	}

	update = &res.Update

	return
}
