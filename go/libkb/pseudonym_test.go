// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkb

import (
	"encoding/hex"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"
)

func testPseudonymName(name, idStr string, keyGen KeyGen,
	keyStr, expectedPseudonymStr string) string {
	return fmt.Sprintf("%s,%s,%d,%s,%s", name, idStr, keyGen, keyStr, expectedPseudonymStr)
}

func testMakePseudonym(t *testing.T, name, idStr string, keyGen KeyGen,
	keyStr, expectedPseudonymStr string) {
	idBytes, err := hex.DecodeString(idStr)
	require.NoError(t, err)
	var id tlfID
	require.Equal(t, 16, copy(id[:], idBytes))

	keyBytes, err := hex.DecodeString(keyStr)
	require.NoError(t, err)
	require.Equal(t, 32, len(keyBytes))
	var key [32]byte
	copy(key[:], keyBytes)

	pseudonym, err := MakePseudonym(TlfPseudonymInfo{
		Name:    name,
		ID:      id,
		KeyGen:  keyGen,
		HmacKey: key,
	})
	require.NoError(t, err)
	pseudonymStr := hex.EncodeToString(pseudonym[:])
	require.Equal(t, expectedPseudonymStr, pseudonymStr)
}

func TestMakePseudonym(t *testing.T) {
	names := []string{"/keybase/private/a1", "/keybase/private/zz"}
	idStrs := []string{
		"b070f968fdc9d1c8827d7e4953659416",
		"0d399cb03bd1b59a07f92fffaaffa516",
	}
	keyGens := []KeyGen{1, 50}
	keyStrs := []string{
		"9d13584d962bf1acebd1ccee109c8bb5d4a014e77f125302455477c53307cc14",
		"ca7014befa7470d87129841c0f41c5b6ed548b9a6431d205b4ff44556bd51a42",
	}

	expectedPseudonymStrs := []string{
		"dcec9bccde1b859cb355a9264bca56b91f07e7c831710ca945a0f7fe7b7e1191",
		"66b38986a207c00b5f6b835af0ae8403f8bd07f7ef520dbbd4addf53d2b58edb",
		"3d3cbb61788f87bfbc9d1d6c528600eccf4bbde4c3925b3f05a7692e54fd74ff",
		"94c8152fb780041bbbb62df29a47f2579392927af73fa2dcfbccaac8718cce75",
		"085075dc9ef14821e61c8e669286ad5031faa2ebf1b6e2b63d4f2d74fc7bb861",
		"eeca52e9fe0b4699fe2f2baa834603ed5badc769bf99dd1f33d2863796d50142",
		"42dcd4ce7eb97d6bea874bb2af2c7b3f5414c131decfd7e47213524dfd0c90a3",
		"ebd2ff9eba99a09a5723f1dfab563596eef05213ab1af5f10d40ff102c4f0d69",
		"d0e0031b1dc21fbb03312f26e6e8b4c1e5b5bed0a7b8902bffdbe467af7ee81c",
		"2ddf845eebd66816f8f07aaf23901aa7a3ebb60b3be340573f2b05e8246d096d",
		"4240789d970b301d3ede262f6f81f97efe42296ac83145d5c6de340188f73b2d",
		"51786cb8605a4be7373363ed1a7a98b54df8c49e31397294996bf37de57f2f40",
		"9046fac921597b06332a2655647f22eb7955b34a21a6d97e8e3a74e92ad9f149",
		"529085af3111d1a64186e01f3a8b2607586060116b3db092e79b943a133ebb32",
		"700cebb5f5e4360f12d97028e7ac96582a0f733aa54db23f9a19740efbf8d626",
		"7531de864cbc313817c0107cfadaaddf01350f1b1cd8f1e497358166048b1a64",
	}

	i := 0
	for _, name := range names {
		for _, idStr := range idStrs {
			for _, keyGen := range keyGens {
				for _, keyStr := range keyStrs {
					epStr := expectedPseudonymStrs[i]
					t.Run(testPseudonymName(name, idStr, keyGen, keyStr, epStr),
						func(t *testing.T) {
							testMakePseudonym(t, name, idStr, keyGen, keyStr, epStr)
						})
					i++
				}
			}
		}
	}
}
