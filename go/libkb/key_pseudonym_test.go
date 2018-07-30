// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkb

import (
	"encoding/hex"
	"fmt"
	"testing"

	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

func testKeyPseudonymName(id string, app keybase1.TeamApplication, keyGen KeyGen, nonce string, expectedPseudonymStr string) string {
	return fmt.Sprintf("%s,%d,%d,%s,%s", id, app, keyGen, nonce, expectedPseudonymStr)
}

func testMakeKeyPseudonym(t *testing.T, idStr string, app keybase1.TeamApplication, keyGen KeyGen, nonceStr string, expectedPseudonymStr string) {
	nonceBytes, err := hex.DecodeString(nonceStr)
	require.NoError(t, err)
	require.Equal(t, 32, len(nonceBytes))
	var nonce KeyPseudonymNonce
	copy(nonce[:], nonceBytes)

	pseudonym, err := MakeKeyPseudonym(KeyPseudonymInfo{
		ID:          keybase1.UserOrTeamID(idStr),
		Application: app,
		KeyGen:      keyGen,
		Nonce:       nonce,
	})
	require.NoError(t, err)
	pseudonymStr := hex.EncodeToString(pseudonym[:])
	require.Equal(t, expectedPseudonymStr, pseudonymStr)
}

func TestMakeKeyPseudonym(t *testing.T) {
	// The same test cases are used on the server side to make sure the two implementations are consistent.

	idStrs := []string{
		"b070f968fdc9d1c8827d7e4953659416",
		"0d399cb03bd1b59a07f92fffaaffa516",
	}

	appIDs := []keybase1.TeamApplication{
		keybase1.TeamApplication_CHAT,
		keybase1.TeamApplication_SALTPACK,
	}

	keyGens := []KeyGen{1, 50}

	nonceStrs := []string{
		"9d13584d962bf1acebd1ccee109c8bb5d4a014e77f125302455477c53307cc14",
		"ca7014befa7470d87129841c0f41c5b6ed548b9a6431d205b4ff44556bd51a42",
	}

	expectedPseudonymStrs := []string{
		"461b7e97fe6e0f528b3c93777f847d62df177a41032d6f19a3caed9688765828",
		"8c2f852098de7ee47f77b34c9f50c04ee65d1087a5fb0e2f275175eb798ab3a2",
		"da3e1e1098f9dc4a86d88e9efcb2641d70d1b3eb18d4901c6bc304c8b3a69952",
		"86758be09b8cbb98f39ca8aeda77291c47f227d56b355cc95250973dcb5f2061",
		"b4cedbc52c4aeafd7829f68ebf4ecaf32a8286d0f9d99ef9d8da09f5176f86c0",
		"ad8d96755b5065d4c64b1a0345fd55a2d1cf6e88e49b61d4dbe09dae1cf61390",
		"766a8d996069f95885adbc8b3e0128c2058bbd91d98ba23e6212c0a61adf1951",
		"dbfe5fc17281b4c340aee4a710ff1fa8e61f0ef0281dfd018e9b7ef9bc8afc0a",
		"46800ac18b3b8162a9df9a4b54fcef4bd4e6f193a50fd4429784f804c43eacaf",
		"47bc452039478d26daa608a966fca78001aed6838c39adbd9695153407a9cae4",
		"7b3c731a3189b5b6a82322d762a21a624c5a48814a548223958af2094256232a",
		"9323408f25b4a6ce9f370e60cf72cff6340d98efbb323e0a93a4d4c02754964d",
		"d46bfaf2f53054d56f84e719134a154618afeb6b1b539dec6bfdeb4577682af7",
		"71d28c656f7006ce01a33d75b3e517f346a3b73dd745135deb19a8258736149f",
		"2b7a644c193340bdeb6bfe44a6716b2ec01ac056ab87aa626b2a0c228dd21540",
		"aa540035e65a3db887cc0e847e5baaed4f6c7aa16eb3d259318bdf21a1e79c88",
	}

	i := 0
	for _, idStr := range idStrs {
		for _, appID := range appIDs {
			for _, keyGen := range keyGens {
				for _, nonceStr := range nonceStrs {
					epStr := expectedPseudonymStrs[i]
					t.Run(testKeyPseudonymName(idStr, appID, keyGen, nonceStr, epStr),
						func(t *testing.T) {
							testMakeKeyPseudonym(t, idStr, appID, keyGen, nonceStr, epStr)
						})
					i++
				}
			}
		}
	}
}

// Very basic test to check that RandomPseudonym doesn't return a constant.
func TestRandomPseudonymNonce(t *testing.T) {
	require.NotEqual(t, [32]byte(RandomPseudonymNonce()), [32]byte(RandomPseudonymNonce()))
}
