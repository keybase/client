// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

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
