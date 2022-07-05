// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"bytes"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"testing"
	"time"

	"github.com/keybase/clockwork"

	"github.com/stretchr/testify/require"
)

type cmpTest struct {
	a, b string
	eq   bool
}

var nameCmpTest = []cmpTest{
	{a: "UpperCase", b: "uppercase", eq: true},
	{a: " Space prefix", b: "Space prefix", eq: true},
	{a: "Space suffix ", b: "Space suffix", eq: true},
	{a: "Space Inside", b: "SpaceInside", eq: true},
	{a: "work iPad", b: "work ipad", eq: true},
	{a: "my_ipad", b: "MY IPAD", eq: true},
	{a: "device a", b: "device b", eq: false},
	{a: "mike's computer", b: "mikes computer", eq: true},
	{a: "my+-'_device", b: "my device", eq: true},
}

func TestNameCmp(t *testing.T) {
	for _, test := range nameCmpTest {
		eq := NameCmp(test.a, test.b)
		if eq != test.eq {
			t.Errorf("name compare %q == %q => %v, expected %v", test.a, test.b, eq, test.eq)
		}
	}
}

func TestCombineErrors(t *testing.T) {
	err := CombineErrors(fmt.Errorf("error1"), nil, fmt.Errorf("error3"))
	expected := "There were multiple errors: error1; error3"
	if err.Error() != expected {
		t.Errorf("Wrong output for combine errors: %#v != %#v", err.Error(), expected)
	}
}

func TestWhitespaceNormalize(t *testing.T) {

	data := []struct {
		in, out string
	}{
		{" ab   cd    ef   gh ", "ab cd ef gh"},
		{"a\nb  c\nd", "a b c d"},
		{" a ", "a"},
		{"\na\nb ", "a b"},
		{
			" Verifying myself: I am pomf on Keybase.io. 8a6cewzit2o7zuLKGbDqQADhzfOlGerGuBpq\n/ https://keybase.io/pomf/sigs/8a6cewzit2o7zuLKGbDqQADhzfOlGerGuBpq ",
			"Verifying myself: I am pomf on Keybase.io. 8a6cewzit2o7zuLKGbDqQADhzfOlGerGuBpq / https://keybase.io/pomf/sigs/8a6cewzit2o7zuLKGbDqQADhzfOlGerGuBpq",
		},
	}

	for i, p := range data {
		out := WhitespaceNormalize(p.in)
		if out != p.out {
			t.Errorf("Failed on test %d: %s != %s", i, out, p.out)
		}
	}

}

func TestMakeByte24(t *testing.T) {
	var x1 [24]byte
	var x2 [31]byte
	var x3 [33]byte

	x1[3] = 5

	y := MakeByte24(x1[:])
	require.Equal(t, x1, y)

	require.Panics(t, func() {
		MakeByte24(x2[:])
	})

	require.Panics(t, func() {
		MakeByte24(x3[:])
	})
}

func TestMakeByte32(t *testing.T) {
	var x1 [32]byte
	var x2 [31]byte
	var x3 [33]byte

	x1[3] = 5

	y := MakeByte32(x1[:])
	require.Equal(t, x1, y)

	require.Panics(t, func() {
		MakeByte32(x2[:])
	})

	require.Panics(t, func() {
		MakeByte32(x3[:])
	})
}

func TestAppDataDir(t *testing.T) {
	dir, err := AppDataDir()
	if err != nil {
		// Non-Windows case.
		require.True(t, strings.HasPrefix(err.Error(), "unsupported"))
		return
	}

	// Windows case. AppDataDir should exist, at least on our test
	// machines.
	require.NoError(t, err)
	exists, err := FileExists(dir)
	require.NoError(t, err)
	require.True(t, exists)
}

func TestLocalDataDir(t *testing.T) {
	dir, err := LocalDataDir()
	if err != nil {
		// Non-Windows case.
		require.True(t, strings.HasPrefix(err.Error(), "unsupported"))
		return
	}

	// Windows case. LocalDataDir should exist, at least on our
	// test machines.
	require.NoError(t, err)
	exists, err := FileExists(dir)
	require.NoError(t, err)
	require.True(t, exists)
}

func hasMonotonicClock(t time.Time) bool {
	re := regexp.MustCompile(" m=[-+]([.0-9]+)$")
	return re.FindString(t.String()) != ""
}

func TestForceWallClock(t *testing.T) {
	n := time.Now()
	require.True(t, hasMonotonicClock(n))
	require.False(t, hasMonotonicClock(ForceWallClock(n)))
}

func TestDecodeHexFixed(t *testing.T) {
	units := []struct {
		src string
		dst []byte
		err string
	}{
		{"", []byte{}, ""},
		{"aa", []byte{170}, ""},
		{"abcd", []byte{171, 205}, ""},

		{"a", []byte{}, "encoding/hex: odd length hex string"},
		{"aaa", []byte{170}, "encoding/hex: odd length hex string"},
		{"aa", []byte{}, "error decoding fixed-length hex: expected 0 bytes but got 1"},
		{"", []byte{170}, "error decoding fixed-length hex: expected 1 bytes but got 0"},
		{"abcd", []byte{171, 205, 0}, "error decoding fixed-length hex: expected 3 bytes but got 2"},
		{"abcd", []byte{171}, "error decoding fixed-length hex: expected 1 bytes but got 2"},
	}
	for i, unit := range units {
		t.Logf("units[%v]", i)
		buf := make([]byte, len(unit.dst))
		err := DecodeHexFixed(buf, []byte(unit.src))
		if unit.err != "" {
			require.Error(t, err)
			require.Equal(t, unit.err, err.Error())
			empty := make([]byte, len(unit.dst))
			require.True(t, bytes.Equal(empty, buf))
		} else {
			require.NoError(t, err)
			require.Equal(t, unit.dst, buf)
		}
	}
}

func TestDownloadGetFilenames(t *testing.T) {
	var tests = map[string]string{
		"abc.def":       "abc.def",
		"文件.def":        "文件.def",
		"abc.\u202edef": "abc.%E2%80%AEdef",
		"abc.\u200fdef": "abc.%E2%80%8Fdef",
	}
	for original, expected := range tests {
		safeFilename := GetSafeFilename(original)
		require.Equal(t, expected, safeFilename)
	}
}

func TestSecureRandomRndRange(t *testing.T) {
	s := SecureRandom{}

	var tests = []struct {
		lo        int64
		hi        int64
		shouldErr bool
	}{
		{0, 0, false},
		{1, 1, false},
		{-1, -1, false},
		{1, 0, true},
		{-1, -2, true},
		{2, 5, false},
		{-1, 10, false},
		{1, 50, false},
		{-40, -1, false},
	}

	for _, test := range tests {
		for i := 0; i < 10; i++ {
			r, err := s.RndRange(test.lo, test.hi)
			if test.shouldErr {
				require.Error(t, err)
				continue
			}
			require.True(t, r >= test.lo)
			require.True(t, r <= test.hi)
		}
	}

	// basic consistency check that sampled random numbers are different (the
	// random function is not a constant). Duplicate outputs should happen very
	// infrequently on a large range. In this case, the test will flake with
	// probability exactly 1/10^12.
	r1, err := s.RndRange(0, 1000000000000)
	require.NoError(t, err)
	r2, err := s.RndRange(0, 1000000000000)
	require.NoError(t, err)
	require.NotEqual(t, r1, r2)
}

func TestThrottleBatch(t *testing.T) {
	clock := clockwork.NewFakeClock()
	throttleBatchClock = clock
	ch := make(chan int, 100)
	handler := func(arg interface{}) {
		v, ok := arg.(int)
		require.True(t, ok)
		ch <- v
	}
	getVal := func(expected int) {
		select {
		case v := <-ch:
			require.Equal(t, expected, v)
		case <-time.After(2 * time.Second):
			require.Fail(t, "no value received")
		}
	}
	noVal := func() {
		time.Sleep(10 * time.Millisecond)
		select {
		case <-ch:
			require.Fail(t, "no value should have been received")
		default:
		}
	}
	batcher := func(batchedInt interface{}, singleInt interface{}) interface{} {
		batched, ok := batchedInt.(int)
		require.True(t, ok)
		single, ok := singleInt.(int)
		require.True(t, ok)
		return batched + single
	}
	reset := func() interface{} {
		return 0
	}

	f, cancel := ThrottleBatch(handler, batcher, reset, 200, true)
	f(2)
	getVal(2)
	f(3)
	f(2)
	noVal()
	clock.Advance(300 * time.Millisecond)
	getVal(5)

	clock.Advance(time.Hour)
	f(2)
	getVal(2)

	f(2)
	noVal()
	cancel()
	time.Sleep(100 * time.Millisecond)
	clock.Advance(300 * time.Millisecond)
	noVal()
}

func TestFindFilePathWithNumberSuffix(t *testing.T) {
	parentDir := os.TempDir()
	path, err := FindFilePathWithNumberSuffix(parentDir, "", true)
	require.NoError(t, err)
	require.True(t, strings.HasPrefix(path, parentDir))

	path, err = FindFilePathWithNumberSuffix(parentDir, "test.txt", true)
	require.NoError(t, err)
	require.True(t, strings.HasPrefix(path, parentDir))
	require.True(t, strings.HasSuffix(path, ".txt"))

	path, err = FindFilePathWithNumberSuffix(parentDir, "", false)
	require.NoError(t, err)
	require.Equal(t, filepath.Join(parentDir, " (1)"), path)

	path, err = FindFilePathWithNumberSuffix(parentDir, "test.txt", false)
	require.NoError(t, err)
	require.Equal(t, filepath.Join(parentDir, "test.txt"), path)

	path, err = FindFilePathWithNumberSuffix(parentDir, ".txt", false)
	require.NoError(t, err)
	require.Equal(t, filepath.Join(parentDir, ".txt"), path)
}
