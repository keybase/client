// Copyright 2019 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package data

import (
	"strings"
	"testing"

	"github.com/keybase/client/go/libkb"
	"github.com/stretchr/testify/require"
)

func TestNodeObfuscatorBasic(t *testing.T) {
	secret := NodeObfuscatorSecret([]byte{1, 2, 3, 4})
	no := NewNodeObfuscator(secret)

	t.Log("Obfuscate with the default hasher")
	obs := no.Obfuscate("test")
	require.NotEqual(t, "", obs)

	t.Log("Make sure it has two valid sec words")
	words := strings.Split(obs, separator)
	require.Len(t, words, 2)
	require.True(t, libkb.ValidSecWord(words[0]), words[0])
	require.True(t, libkb.ValidSecWord(words[1]), words[1])

	t.Log("Make sure caching works")
	obs2 := no.obfuscateWithHasher("test", func(_ string) []byte {
		panic("Hash called")
	})
	require.Equal(t, obs, obs2)
}

func TestNodeObfuscatorCollisions(t *testing.T) {
	secret := NodeObfuscatorSecret([]byte{1, 2, 3, 4})
	no := NewNodeObfuscator(secret)

	t.Log("Obfuscate with a test hash to get a known string")
	hasher1 := func(_ string) []byte {
		return []byte{0, 0, 4} // first = 0, second = 1
	}
	obs := no.obfuscateWithHasher("test", hasher1)
	first := libkb.SecWord(0)
	second := libkb.SecWord(1)
	expectedObs := strings.Join([]string{first, second}, separator)
	require.Equal(t, expectedObs, obs)

	t.Log("Obfuscate a new plaintext string with the same hash")
	obs2 := no.obfuscateWithHasher("test2", hasher1)
	expectedObs2 := strings.Join([]string{first, second, "2"}, separator)
	require.Equal(t, expectedObs2, obs2)

	t.Log("And one more, with a different hash but the same first 3 bytes")
	hasher2 := func(_ string) []byte {
		return []byte{0, 0, 7} // first = 0, second = 1
	}
	obs3 := no.obfuscateWithHasher("test3", hasher2)
	expectedObs3 := strings.Join([]string{first, second, "3"}, separator)
	require.Equal(t, expectedObs3, obs3)

	t.Log("Make sure we get the original result again for the first string")
	obs4 := no.obfuscateWithHasher("test", hasher1)
	require.Equal(t, obs, obs4)
}
