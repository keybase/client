// Copyright 2019 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package data

import (
	"encoding/json"
	"strings"
	"testing"

	"github.com/keybase/client/go/libkb"
	"github.com/stretchr/testify/require"
)

func TestPathPartStringBasic(t *testing.T) {
	secret := NodeObfuscatorSecret([]byte{1, 2, 3, 4})
	no := NewNodeObfuscator(secret)

	t.Log("Check String() without extensions")
	pps := NewPathPartString("test", no)
	obs := pps.String()
	words := strings.Split(obs, separator)
	require.Len(t, words, 2)
	require.True(t, libkb.ValidSecWord(words[0]), words[0])
	require.True(t, libkb.ValidSecWord(words[1]), words[1])

	t.Log("Check String() with short extension")
	pps2 := NewPathPartString("test.txt", no)
	obs2 := pps2.String()
	require.True(t, strings.HasSuffix(obs2, ".txt"))
	words2 := strings.Split(strings.Replace(obs2, ".txt", "", 1), separator)
	require.Len(t, words2, 2)
	require.True(t, libkb.ValidSecWord(words2[0]), words2[0])
	require.True(t, libkb.ValidSecWord(words2[1]), words2[1])
	t.Log("Make sure that the words aren't the same")
	require.False(t, words[0] == words2[0] && words[1] == words2[1])

	t.Log("Check String() with longer, but still valid, extension")
	pps3 := NewPathPartString("test.tar.gz", no)
	obs3 := pps3.String()
	require.True(t, strings.HasSuffix(obs3, ".tar.gz"))
	words3 := strings.Split(strings.Replace(obs3, ".tar.gz", "", 1), separator)
	require.Len(t, words3, 2)
	require.True(t, libkb.ValidSecWord(words3[0]), words3[0])
	require.True(t, libkb.ValidSecWord(words3[1]), words3[1])

	t.Log("Check String() with a too-long extension")
	pps4 := NewPathPartString("test.longextension", no)
	obs4 := pps4.String()
	require.False(t, strings.HasSuffix(obs4, ".longextension"))
	words4 := strings.Split(obs4, separator)
	require.Len(t, words4, 2)
	require.True(t, libkb.ValidSecWord(words4[0]), words4[0])
	require.True(t, libkb.ValidSecWord(words4[1]), words4[1])

	t.Log("Check String() with a conflicted suffix")
	cSuffix := ".conflicted (alice's device copy 2019-06-10).txt"
	pps5 := NewPathPartString("test"+cSuffix, no)
	obs5 := pps5.String()
	require.True(t, strings.HasSuffix(obs5, cSuffix))
	words5 := strings.Split(strings.Replace(obs5, cSuffix, "", 1), separator)
	require.Len(t, words5, 2)
	require.True(t, libkb.ValidSecWord(words5[0]), words5[0])
	require.True(t, libkb.ValidSecWord(words5[1]), words5[1])
}

func TestPathPartStringEquality(t *testing.T) {
	secret := NodeObfuscatorSecret([]byte{1, 2, 3, 4})
	no := NewNodeObfuscator(secret)

	t.Log("Check equal PathPartStrings")
	pps1 := NewPathPartString("test", no)
	pps2 := NewPathPartString("test", no)
	require.True(t, pps1 == pps2)

	t.Log("Check as a map key")
	pps3 := NewPathPartString("test2", no)
	val1 := 50
	val3 := 100
	m := map[PathPartString]int{
		pps1: val1,
		pps3: val3,
	}
	require.Equal(t, val1, m[pps1])
	require.Equal(t, val1, m[pps2])
	require.Equal(t, val3, m[pps3])

	t.Log("Check unequal PathPartStrings with different strings")
	pps1 = NewPathPartString("test", no)
	pps2 = NewPathPartString("test2", no)
	require.False(t, pps1 == pps2)

	t.Log("Check unequal PathPartStrings with different obfuscators")
	no2 := NewNodeObfuscator(secret)
	pps1 = NewPathPartString("test", no)
	pps2 = NewPathPartString("test", no2)
	require.False(t, pps1 == pps2)

}

func TestPathPartStringMarshal(t *testing.T) {
	secret := NodeObfuscatorSecret([]byte{1, 2, 3, 4})
	no := NewNodeObfuscator(secret)
	pps := NewPathPartString("test", no)
	require.Panics(t, func() {
		_, _ = json.Marshal(pps)
	})

	type m struct {
		PPS   PathPartString
		Other string
	}
	m1 := m{pps, "test"}
	require.Panics(t, func() {
		_, _ = json.Marshal(m1)
	})
}
