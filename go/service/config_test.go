// Copyright 2015 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package service

import (
	"testing"

	"golang.org/x/net/context"
)

func TestGetConfig(t *testing.T) {
	setupServiceTest(t)
	configHandler := ConfigHandler{}
	config, err := configHandler.GetConfig(context.TODO(), 0)
	if err != nil {
		t.Fatal(err)
	}
	if config.ServerURI == "" {
		t.Fatal("No service URI")
	}
}
