// Copyright 2026 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

//go:build darwin

package mounter

import (
	"syscall"
	"testing"

	"github.com/stretchr/testify/require"
)

func statfs(fstype string, owner uint32) syscall.Statfs_t {
	var st syscall.Statfs_t
	for i := 0; i < len(fstype); i++ {
		st.Fstypename[i] = int8(fstype[i])
	}
	st.Owner = owner
	return st
}

func TestIsOwnKBFSMount(t *testing.T) {
	require.True(t, isOwnKBFSMount(statfs("macfuse", 501), 501))
	require.True(t, isOwnKBFSMount(statfs("kbfuse", 501), 501))
	require.False(t, isOwnKBFSMount(statfs("macfuse", 502), 501))
	require.False(t, isOwnKBFSMount(statfs("apfs", 501), 501))
}
