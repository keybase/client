// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package sources

import (
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
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
	log            logger.Logger
	api            libkb.API
	runMode        libkb.RunMode
	defaultChannel string
}

func NewKeybaseUpdateSource(log logger.Logger, api libkb.API, runMode libkb.RunMode, defaultChannel string) KeybaseUpdateSource {
	return KeybaseUpdateSource{
		log:            log,
		api:            api,
		runMode:        runMode,
		defaultChannel: defaultChannel,
	}
}

func (k KeybaseUpdateSource) Description() string {
	return "Keybase"
}

func (k KeybaseUpdateSource) FindUpdate(options keybase1.UpdateOptions) (update *keybase1.Update, err error) {
	channel := k.defaultChannel
	if options.Channel != "" {
		channel = options.Channel
	}

	APIArgs := libkb.HTTPArgs{
		"version":  libkb.S{Val: options.Version},
		"platform": libkb.S{Val: options.Platform},
		"run_mode": libkb.S{Val: string(k.runMode)},
		"channel":  libkb.S{Val: channel},
	}

	var res updateResponse
	err = k.api.GetDecode(libkb.APIArg{
		Endpoint: "pkg/update",
		Args:     APIArgs,
	}, &res)
	if err != nil {
		return
	}

	update = &res.Update

	return
}
