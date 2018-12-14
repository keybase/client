// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package kbfssync

import (
	"sync"
	"testing"

	"golang.org/x/net/context"
)

func testRepeatedWaitGroupSimpleWait(t *testing.T, rwg *RepeatedWaitGroup) {
	// Start 10 tasks, wait for them all to complete
	rwg.Add(10)
	errChan := make(chan error)
	go func() {
		errChan <- rwg.Wait(context.Background())
	}()
	for i := 0; i < 10; i++ {
		rwg.Done()
	}
	err := <-errChan
	if err != nil {
		t.Fatalf("Error on wait: %v", err)
	}
}

func TestRepeatedWaitGroupSimpleWait(t *testing.T) {
	var rwg RepeatedWaitGroup
	testRepeatedWaitGroupSimpleWait(t, &rwg)
}

func TestRepeatedWaitGroupCanceledWait(t *testing.T) {
	// Start 10 tasks, wait for them all to complete
	var rwg RepeatedWaitGroup
	rwg.Add(10)
	errChan := make(chan error)
	ctx, cancel := context.WithCancel(context.Background())
	go func() {
		errChan <- rwg.Wait(ctx)
	}()
	// Only finish half the tasks
	for i := 0; i < 5; i++ {
		rwg.Done()
	}
	cancel()
	err := <-errChan
	if err != context.Canceled {
		t.Fatalf("Unexpected error on wait: %v", err)
	}
}

func TestRepeatedWaitGroupMultiWait(t *testing.T) {
	var rwg RepeatedWaitGroup
	// Three in serial
	for i := 0; i < 3; i++ {
		testRepeatedWaitGroupSimpleWait(t, &rwg)
	}

	// Three in parallel!
	var wg sync.WaitGroup
	for i := 0; i < 3; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			testRepeatedWaitGroupSimpleWait(t, &rwg)
		}()
	}
	wg.Wait()
}
