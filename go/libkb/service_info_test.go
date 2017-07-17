// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"fmt"
	"testing"
	"time"
)

func TestWaitForServiceInfoOK(t *testing.T) {
	fn := func() (*ServiceInfo, error) {
		return &ServiceInfo{Label: "ok", Pid: 1}, nil
	}
	info, err := waitForServiceInfo(time.Second, time.Millisecond, fn)
	if err != nil {
		t.Fatal(err)
	}
	if info == nil || info.Label != "ok" {
		t.Fatalf("Invalid info")
	}
}

func TestWaitForServiceInfoDelayed(t *testing.T) {
	i := 0
	fn := func() (*ServiceInfo, error) {
		i++
		if i == 5 {
			return &ServiceInfo{Label: "ok_delayed", Pid: 1}, nil
		}
		return nil, nil
	}
	info, err := waitForServiceInfo(time.Second, time.Millisecond, fn)
	if err != nil {
		t.Fatal(err)
	}
	if info == nil || info.Label != "ok_delayed" {
		t.Fatalf("Invalid status")
	}
}

func TestWaitForServiceInfoErrored(t *testing.T) {
	fn := func() (*ServiceInfo, error) {
		return nil, fmt.Errorf("info error")
	}
	_, err := waitForServiceInfo(time.Second, time.Millisecond, fn)
	if err == nil {
		t.Fatal("Expected error")
	}
	if err.Error() != "info error" {
		t.Fatal("Expected error returned from fn above")
	}
}

func TestWaitForServiceInfoTimeout(t *testing.T) {
	fn := func() (*ServiceInfo, error) {
		return nil, nil
	}
	status, err := waitForServiceInfo(5*time.Millisecond, time.Millisecond, fn)
	if err != nil {
		t.Fatal(err)
	}
	if status != nil {
		t.Fatalf("Info should be nil (timed out): %#v", status)
	}
}
