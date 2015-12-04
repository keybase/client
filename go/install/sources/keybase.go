// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package sources

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
)

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
	if config.URL == "" {
		err = fmt.Errorf("No source URL for remote")
		return
	}
	u, err := url.Parse(config.URL)
	if err != nil {
		return
	}
	data := url.Values{}
	data.Set("version", config.Version)
	data.Add("osname", config.OsName)
	data.Add("runmode", string(k.G().Env.GetRunMode()))
	u.RawQuery = data.Encode()

	urlstr := u.String()
	req, err := http.NewRequest("GET", urlstr, nil)
	client := &http.Client{}
	k.G().Log.Info("Request %#v", urlstr)
	resp, err := client.Do(req)
	if resp != nil {
		defer resp.Body.Close()
	}
	if err != nil {
		return
	}

	if resp.StatusCode != http.StatusOK {
		err = fmt.Errorf("Updater remote returned bad status %v", resp.Status)
		return
	}

	var r io.Reader = resp.Body
	var obj keybase1.Update
	if err = json.NewDecoder(r).Decode(&obj); err != nil {
		err = fmt.Errorf("Bad updater remote response %s", err)
		return
	}
	update = &obj

	return update, nil
}
