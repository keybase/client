// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestWaitForServiceInfoOK(t *testing.T) {
	fn := func() (*ServiceInfo, error) {
		return &ServiceInfo{Label: "ok", Pid: 1}, nil
	}
	info, err := waitForServiceInfo(time.Second, time.Millisecond, fn)
	require.NoError(t, err)
	require.False(t, info == nil || info.Label != "ok",
		"Invalid info")
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
	require.NoError(t, err)
	require.False(t, info == nil || info.Label != "ok_delayed",
		"Invalid status")
}

func TestWaitForServiceInfoErrored(t *testing.T) {
	fn := func() (*ServiceInfo, error) {
		return nil, fmt.Errorf("info error")
	}
	_, err := waitForServiceInfo(time.Second, time.Millisecond, fn)
	require.Error(t, err,
		"Expected error")
	require.Equal(t, "info error", err.Error(), "Expected error returned from fn above")
}

func TestWaitForServiceInfoTimeout(t *testing.T) {
	fn := func() (*ServiceInfo, error) {
		return nil, nil
	}
	status, err := waitForServiceInfo(5*time.Millisecond, time.Millisecond, fn)
	require.NoError(t, err)
	require.Nil(t, status,
		"Info should be nil (timed out): %#v", status)
}
