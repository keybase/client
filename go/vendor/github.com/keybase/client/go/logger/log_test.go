// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package logger

import (
	"sync"
	"testing"

	logging "github.com/keybase/go-logging"
)

// This test must pass with -race.
func TestInitLogging(t *testing.T) {
	var l1, l2 *Standard

	var wg sync.WaitGroup
	wg.Add(2)

	// New must be race-free.
	go func() {
		defer wg.Done()
		l1 = New("l1")
		_ = l1
	}()
	go func() {
		defer wg.Done()
		l2 = New("l2")
		_ = l2
	}()

	wg.Wait()

	// New must also initialize the level correctly.
	l1Level := logging.GetLevel("l1")
	if l1Level != logging.INFO {
		t.Errorf("l1 level=%s is unexpectedly not INFO", l1Level)
	}
	l2Level := logging.GetLevel("l2")
	if l2Level != logging.INFO {
		t.Errorf("l2 level=%s is unexpectedly not INFO", l2Level)
	}
}
