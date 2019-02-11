// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

// +build !windows

package winacl

import (
	"errors"
)

// SID is defined as syscall.SID on Windows.
type SID syscallSID

type syscallSID struct{}

var errNotWin = errors.New("winacl does not work outside Windows")

func currentProcessUserSid() (*SID, error)         { return nil, errNotWin }
func currentProcessPrimaryGroupSid() (*SID, error) { return nil, errNotWin }
