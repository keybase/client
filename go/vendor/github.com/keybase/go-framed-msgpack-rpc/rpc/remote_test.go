// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package rpc

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestPrioritizedRoundRobinRemote(t *testing.T) {
	_, err := ParsePrioritizedRoundRobinRemote(";,,;")
	require.Error(t, err)

	r, err := NewPrioritizedRoundRobinRemote([][]string{
		[]string{}, // should be ignored
		[]string{"a0", "a1", "a2", "a3"},
		[]string{"b0", "b1"},
	})
	require.NoError(t, err)
	require.Equal(t, "a0,a1,a2,a3;b0,b1", r.String())

	_, err = NewPrioritizedRoundRobinRemote(nil)
	require.Error(t, err)
	_, err = NewPrioritizedRoundRobinRemote([][]string{[]string{}, []string{}})
	require.Error(t, err)

	r, err = ParsePrioritizedRoundRobinRemote(`
	;;
	a0,a1,a2,a3;
	;;b0,
	b1;
	`)
	require.NoError(t, err)

	getAndConfirmA := func() {
		seen := make(map[string]bool)
		for i := 0; i < 4; i++ {
			seen[r.GetAddress()] = true
		}

		require.True(t, seen["a0"])
		require.True(t, seen["a1"])
		require.True(t, seen["a2"])
		require.True(t, seen["a3"])
	}

	getAndConfirmB := func() {
		seen := make(map[string]bool)
		for i := 0; i < 2; i++ {
			seen[r.GetAddress()] = true
		}

		require.True(t, seen["b0"])
		require.True(t, seen["b1"])
	}

	getAndConfirmA()
	getAndConfirmB()
	getAndConfirmA()
	r.Reset()
	getAndConfirmA()
	getAndConfirmB()
}
