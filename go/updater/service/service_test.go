// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package main

import (
	"testing"
	"time"

	"github.com/keybase/client/go/updater/keybase"
	"github.com/keybase/go-logging"
	"github.com/stretchr/testify/assert"
)

var testLog = &logging.Logger{Module: "test"}

func TestService(t *testing.T) {
	ctx, upd := keybase.NewUpdaterContext("KeybaseTest", "keybase", testLog, keybase.Service)
	svc := newService(upd, ctx, testLog, "KeybaseTest")
	assert.NotNil(t, svc)

	go func() {
		t.Log("Waiting")
		time.Sleep(10 * time.Millisecond)
		svc.Quit()
	}()
	svc.Run()
}
