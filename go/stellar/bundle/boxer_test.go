package bundle

import (
	"context"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"os"
	"testing"

	"github.com/davecgh/go-spew/spew"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/protocol/stellar1"
	"github.com/stretchr/testify/require"
)

const v2 = stellar1.BundleVersion_V2

func testBundle(t *testing.T) stellar1.Bundle {
	secretKey := stellar1.SecretKey("SDGCPMBQHYAIWM3PQOEKWICDMLVT7REJ24J26QEYJYGB6FJRPTKDULQX")
	newBundle, err := New(secretKey, "test")
	require.NoError(t, err)
	newBundle.Accounts[0].IsPrimary = true
	return *newBundle
}

func TestBundleRoundtrip(t *testing.T) {
	m := libkb.NewMetaContext(context.Background(), nil)

	ring := newPukRing()
	pukSeed, pukGen := ring.makeGen(t, 1)
	bundle := testBundle(t)
	t.Logf("puk seed (hex): %v", toB64(pukSeed[:]))
	t.Logf("puk gen: %v", pukGen)

	boxed, err := BoxAndEncode(&bundle, pukGen, pukSeed)
	require.NoError(t, err)
	t.Logf("outer enc b64: %v", boxed.EncParentB64)
	t.Logf("outer vis b64: %v", boxed.VisParentB64)
	t.Logf("enc.N b64: %v", toB64(boxed.EncParent.N[:]))
	t.Logf("enc.E b64: %v", toB64(boxed.EncParent.E))
	require.Equal(t, v2, boxed.FormatVersionParent)
	require.NotEmpty(t, boxed.VisParentB64)
	require.NotEmpty(t, boxed.EncParentB64)
	require.Len(t, boxed.AcctBundles, 1)
	require.True(t, len(boxed.EncParentB64) > 100)
	require.NotZero(t, boxed.EncParent.N)
	require.Equal(t, 2, boxed.EncParent.V)
	require.True(t, len(boxed.EncParent.E) > 100)
	require.Equal(t, pukGen, boxed.EncParent.Gen)

	bundle2, version, decodedPukGen, accountGens, err := DecodeAndUnbox(m, ring, boxed.toBundleEncodedB64())
	require.NoError(t, err)
	require.Equal(t, v2, version)
	require.Equal(t, pukGen, decodedPukGen)
	require.Nil(t, bundle2.Prev)
	require.NotNil(t, bundle2.OwnHash)
	require.Equal(t, bundle.Revision, bundle2.Revision)
	require.Equal(t, len(bundle.Accounts), len(bundle2.Accounts))
	for i, acct := range bundle.Accounts {
		acct2 := bundle2.Accounts[i]
		require.Equal(t, acct.AccountID, acct2.AccountID)
		require.Equal(t, acct.Mode, acct2.Mode)
		require.Equal(t, acct.Name, acct2.Name)
		require.Equal(t, acct.IsPrimary, acct2.IsPrimary)
		require.Equal(t, acct.AcctBundleRevision, acct2.AcctBundleRevision)
		signers1 := bundle.AccountBundles[acct.AccountID].Signers
		signers2 := bundle2.AccountBundles[acct2.AccountID].Signers
		require.Equal(t, signers1, signers2)
		require.True(t, len(signers2) == 1) // exactly one signer
		require.True(t, len(signers2[0]) > 0)
		require.Equal(t, keybase1.PerUserKeyGeneration(1), accountGens[acct.AccountID])
	}
}

func TestBundlePrevs(t *testing.T) {
	m := libkb.NewMetaContext(context.Background(), nil)
	ring := newPukRing()
	pukSeed, pukGen := ring.makeGen(t, 1)
	b1 := testBundle(t)

	// encode and decode b1 to populate OwnHash
	b1Boxed, err := BoxAndEncode(&b1, pukGen, pukSeed)
	require.NoError(t, err)
	b1Decoded, _, _, _, err := DecodeAndUnbox(m, ring, b1Boxed.toBundleEncodedB64())
	require.NoError(t, err)

	// make a change, and verify hashes are correct
	b2 := b1Decoded.DeepCopy()
	b2.Accounts[0].Name = "apples"
	b2.Prev = b1Decoded.OwnHash
	b2.OwnHash = nil
	b2.Revision++
	b2Boxed, err := BoxAndEncode(&b2, pukGen, pukSeed)
	require.NoError(t, err)
	b2Decoded, _, _, _, err := DecodeAndUnbox(m, ring, b2Boxed.toBundleEncodedB64())
	require.NoError(t, err)
	require.Equal(t, "apples", b2Decoded.Accounts[0].Name, "change carried thru")
	require.NotNil(t, b2Decoded.Prev)
	require.Equal(t, b2Decoded.Prev, b1Decoded.OwnHash, "b2 prevs to b1")

	// change the keys and do it again
	pukSeed, pukGen = ring.makeGen(t, 2)
	b3 := b2Decoded.DeepCopy()
	b3.Accounts[0].Name = "bananas"
	b3.Prev = b2Decoded.OwnHash
	b3.OwnHash = nil
	b3.Revision++
	b3Boxed, err := BoxAndEncode(&b3, pukGen, pukSeed)
	require.NoError(t, err)
	b3Decoded, _, bundleGen, accountGens, err := DecodeAndUnbox(m, ring, b3Boxed.toBundleEncodedB64())
	require.NoError(t, err)
	require.Equal(t, "bananas", b3Decoded.Accounts[0].Name, "change carried thru")
	require.NotNil(t, b3Decoded.Prev)
	require.Equal(t, b3Decoded.Prev, b2Decoded.OwnHash, "b3 prevs to b2")
	require.Equal(t, keybase1.PerUserKeyGeneration(2), bundleGen)
	for _, acct := range b3Decoded.Accounts {
		require.Equal(t, keybase1.PerUserKeyGeneration(2), accountGens[acct.AccountID])
	}
}

func TestBundleRoundtripCorruptionEnc(t *testing.T) {
	m := libkb.NewMetaContext(context.Background(), nil)
	bundle := testBundle(t)
	ring := newPukRing()
	pukSeed, pukGen := ring.makeGen(t, 4)

	boxed, err := BoxAndEncode(&bundle, pukGen, pukSeed)
	require.NoError(t, err)
	replaceWith := "a"
	if boxed.EncParentB64[85] == 'a' {
		replaceWith = "b"
	}
	boxed.EncParentB64 = boxed.EncParentB64[:85] + replaceWith + boxed.EncParentB64[86:]

	_, _, _, _, err = DecodeAndUnbox(m, ring, boxed.toBundleEncodedB64())
	require.Error(t, err)
	require.Contains(t, err.Error(), "stellar bundle secret box open failed")
}

func TestBundleRoundtripCorruptionVis(t *testing.T) {
	m := libkb.NewMetaContext(context.Background(), nil)
	bundle := testBundle(t)
	ring := newPukRing()
	pukSeed, pukGen := ring.makeGen(t, 3)

	boxed, err := BoxAndEncode(&bundle, pukGen, pukSeed)
	require.NoError(t, err)
	replaceWith := "a"
	if boxed.VisParentB64[85] == 'a' {
		replaceWith = "b"
	}
	boxed.VisParentB64 = boxed.VisParentB64[:85] + replaceWith + boxed.VisParentB64[86:]

	_, _, _, _, err = DecodeAndUnbox(m, ring, boxed.toBundleEncodedB64())
	require.Error(t, err)
	require.Contains(t, err.Error(), "visible hash mismatch")
}

func TestBoxAndEncodeCatchesMalformedBundles(t *testing.T) {
	bundle := testBundle(t)
	ring := newPukRing()
	pukSeed, pukGen := ring.makeGen(t, 3)

	// put a different account and secret in the AccountBundle
	newAcctID, newSecret, err := randomStellarKeypair()
	require.NoError(t, err)
	newAB := map[stellar1.AccountID]stellar1.AccountBundle{
		newAcctID: {
			AccountID: newAcctID,
			Signers:   []stellar1.SecretKey{newSecret},
		},
	}
	bundle.AccountBundles = newAB

	// encode should error because the bundle is invalid
	_, err = BoxAndEncode(&bundle, pukGen, pukSeed)
	require.Contains(t, err.Error(), "account in AccountBundles not in Accounts")
}

type accountCan struct {
	accountID stellar1.AccountID
	encB64    string
}
type canned struct {
	pukSeedB64   string
	pukGen       int
	encParentB64 string
	visParentB64 string
	accounts     []accountCan
}

func (c *canned) puk(t *testing.T) (puk libkb.PerUserKeySeed) {
	bs, err := base64.StdEncoding.DecodeString(c.pukSeedB64)
	require.NoError(t, err)
	require.Equal(t, len(puk), len(bs))
	copy(puk[:], bs)
	return puk
}

func (c *canned) gen() keybase1.PerUserKeyGeneration {
	return keybase1.PerUserKeyGeneration(c.pukGen)
}

func (c *canned) toBundleEncodedB64() BundleEncoded {
	benc := BundleEncoded{
		EncParent:   c.encParentB64,
		VisParent:   c.visParentB64,
		AcctBundles: make(map[stellar1.AccountID]string),
	}
	for _, acct := range c.accounts {
		benc.AcctBundles[acct.accountID] = acct.encB64
	}
	return benc
}

func (c *canned) ring(t *testing.T) *pukRing {
	pukSeed := c.puk(t)
	pukGen := c.gen()
	return &pukRing{
		map[keybase1.PerUserKeyGeneration]libkb.PerUserKeySeed{
			pukGen: pukSeed,
		},
	}
}

var cans = []canned{
	// this one is valid
	{"R81SkpClcSUPMzch6UAstOhS+hbZi4R43HzbRiLQ46o=",
		3,
		"hKFlxPCoH32GB0er08rZF1B2sfZNME3/35sFKWBVSCQTFKiTAuGSe2mK9AKCWMLkXcTvoJojtyu56hBwGbXQCqqSL8eY1sb8UGG7SsuvNBr27hzUtosJmb9tCT0uikOY8YFPYAtWbmqHB9QvqeBEtysd7ZDDJPG0cJ9lckvj9rSAE/wuhcVlHMAWfbOvGvOLDf56VVK46Ms7bGTSedTKHj8IPpF48RF1GrDlvZQRgqD8ydwtqMGZ1ZkqF+DKKXaEQaIhY47L50Ynna7Qzm8ZCEujsuo5W3EKtZtY6XG0RYx7AzdhkXKzFVDmINVHxkZbQi66QpWjZ2VuA6FuxBh9I1ef+UMA9u3rOYAqPzeVm6hlam5ZX62hdgI=",
		"g6hhY2NvdW50c5KFqWFjY291bnRJRNk4R0FXWjdIVlBLUkdDSDJLUDY0NzVYVjZIQTJDQUY0NE1YV1dFNVJLVjRMTU1HQjZGTk5TRVBOUEWyYWNjdEJ1bmRsZVJldmlzaW9uAbFlbmNBY2N0QnVuZGxlSGFzaMQgBgkhqzuIynMJrhIeuSOPTCoS5QutvwDXZr7fHVuCmpipaXNQcmltYXJ5w6Rtb2RlAYWpYWNjb3VudElE2ThHQlBMTEhPS1BSRlNDRTZGUDZEMzdBVVVOWUNKMlRTUE9ITUhBUjU0VEJETFdXUElaQ0Q0UkwzR7JhY2N0QnVuZGxlUmV2aXNpb24BsWVuY0FjY3RCdW5kbGVIYXNoxCCbBuOilM5oKBvC1JaEzJoq8l1W1picV5MxkTEOrPEnpalpc1ByaW1hcnnCpG1vZGUBpHByZXbAqHJldmlzaW9uAQ==",
		[]accountCan{
			{"GAWZ7HVPKRGCH2KP6475XV6HA2CAF44MXWWE5RKV4LMMGB6FNNSEPNPE", "hKFlxKUc3fqMOAYv9m6ycpnpQA4CSriSQoPVNbvsXXEgv4WsixkaTThkKGMlYuWvTJdHeqPdYXo/Mw156xq8MaIbzDTriFplFNcLhNYdi8f1ViHqvVIecX2frU/BOtIsAlqknnhl4+Z1u2kUnZYI5pZRvUV5H1loSWC4tBmEoCgK1S6XrLx1POOIiKkH8EFMXVrB6+BjbieW1w8HTXNp0jWbKkq+QoKz8MCjZ2VuA6FuxBibtfMD40wYqnfPsGePn1RphpzcEqv7mZehdgE="},
			{"GBPLLHOKPRFSCE6FP6D37AUUNYCJ2TSPOHMHAR54TBDLWWPIZCD4RL3G", "hKFlxKX3zqweGMWyl4vOC8ht0jngDnTEpWqGBePh7okF9S003QStjI9Td1d+urqj/k4etwgLiPO8LHaaQ7o2WAwuSXakHJVJ2xIq+T+MYnoobbx5sArk4wsg7AWTX+uw/rXoyN7P9ZAgDSH+4oZ6/0j8dwR6RAoc9c+dog8xnW3eTkeSlj2KYx6XnEOOlOcCBCKsZePi9eoN92CxvB5MRN6tR7w3PH4yynqjZ2VuA6FuxBha4JmmVyysST3avwMxayHfTExp7tnLwHOhdgE="},
		}},
	// bad decryption puk
	{"1111111111111111111111111111111111111111111=",
		3,
		"hKFlxPCoH32GB0er08rZF1B2sfZNME3/35sFKWBVSCQTFKiTAuGSe2mK9AKCWMLkXcTvoJojtyu56hBwGbXQCqqSL8eY1sb8UGG7SsuvNBr27hzUtosJmb9tCT0uikOY8YFPYAtWbmqHB9QvqeBEtysd7ZDDJPG0cJ9lckvj9rSAE/wuhcVlHMAWfbOvGvOLDf56VVK46Ms7bGTSedTKHj8IPpF48RF1GrDlvZQRgqD8ydwtqMGZ1ZkqF+DKKXaEQaIhY47L50Ynna7Qzm8ZCEujsuo5W3EKtZtY6XG0RYx7AzdhkXKzFVDmINVHxkZbQi66QpWjZ2VuA6FuxBh9I1ef+UMA9u3rOYAqPzeVm6hlam5ZX62hdgI=",
		"g6hhY2NvdW50c5KFqWFjY291bnRJRNk4R0FXWjdIVlBLUkdDSDJLUDY0NzVYVjZIQTJDQUY0NE1YV1dFNVJLVjRMTU1HQjZGTk5TRVBOUEWyYWNjdEJ1bmRsZVJldmlzaW9uAbFlbmNBY2N0QnVuZGxlSGFzaMQgBgkhqzuIynMJrhIeuSOPTCoS5QutvwDXZr7fHVuCmpipaXNQcmltYXJ5w6Rtb2RlAYWpYWNjb3VudElE2ThHQlBMTEhPS1BSRlNDRTZGUDZEMzdBVVVOWUNKMlRTUE9ITUhBUjU0VEJETFdXUElaQ0Q0UkwzR7JhY2N0QnVuZGxlUmV2aXNpb24BsWVuY0FjY3RCdW5kbGVIYXNoxCCbBuOilM5oKBvC1JaEzJoq8l1W1picV5MxkTEOrPEnpalpc1ByaW1hcnnCpG1vZGUBpHByZXbAqHJldmlzaW9uAQ==",
		[]accountCan{
			{"GAWZ7HVPKRGCH2KP6475XV6HA2CAF44MXWWE5RKV4LMMGB6FNNSEPNPE", "hKFlxKUc3fqMOAYv9m6ycpnpQA4CSriSQoPVNbvsXXEgv4WsixkaTThkKGMlYuWvTJdHeqPdYXo/Mw156xq8MaIbzDTriFplFNcLhNYdi8f1ViHqvVIecX2frU/BOtIsAlqknnhl4+Z1u2kUnZYI5pZRvUV5H1loSWC4tBmEoCgK1S6XrLx1POOIiKkH8EFMXVrB6+BjbieW1w8HTXNp0jWbKkq+QoKz8MCjZ2VuA6FuxBibtfMD40wYqnfPsGePn1RphpzcEqv7mZehdgE="},
			{"GBPLLHOKPRFSCE6FP6D37AUUNYCJ2TSPOHMHAR54TBDLWWPIZCD4RL3G", "hKFlxKX3zqweGMWyl4vOC8ht0jngDnTEpWqGBePh7okF9S003QStjI9Td1d+urqj/k4etwgLiPO8LHaaQ7o2WAwuSXakHJVJ2xIq+T+MYnoobbx5sArk4wsg7AWTX+uw/rXoyN7P9ZAgDSH+4oZ6/0j8dwR6RAoc9c+dog8xnW3eTkeSlj2KYx6XnEOOlOcCBCKsZePi9eoN92CxvB5MRN6tR7w3PH4yynqjZ2VuA6FuxBha4JmmVyysST3avwMxayHfTExp7tnLwHOhdgE="},
		}},
	// this one has two primary accounts
	{"zZZijzv+D622csZjyzgZHt/avWYJaHH0S42rO29uBh4=",
		3,
		"hKFlxPBByHsjg6VR42RdYX5UsALFZ5XTG348GsP+J1ubWC2Iv+49/NjZtexC9rqQaIVU0yz/oKmJfpBBlB6m3EDjkca/5yszpDPf1WKPQR7tzJMAPpwmbXKC3dWZGO/elRgvGiH3rvq1SVMn5Od20Gkn81rn0w4M2VtiXl23dUqgTPV3zxgnWYgi+qz2MYBQUOCDiIXRQCEoz9uryF36GuI0RhmM5r14zfPTo2Ru6hDqN2FN17aJ/D7xTBiIdQUAlN6cUZS/nQEEEwdxJmlFTzXgoIR7puO0sC9Q1PWMKTfRrCzhUkV/VVyWEMZiQR1VbWii58OjZ2VuA6FuxBh7HP8NWh2qAIdc8bX/gka07BmIGJ6N1BGhdgI=",
		"g6hhY2NvdW50c5KFqWFjY291bnRJRNk4R0FXWjdIVlBLUkdDSDJLUDY0NzVYVjZIQTJDQUY0NE1YV1dFNVJLVjRMTU1HQjZGTk5TRVBOUEWyYWNjdEJ1bmRsZVJldmlzaW9uAbFlbmNBY2N0QnVuZGxlSGFzaMQgYsYYlXdhMYNv+TjdE9jLU/9InY7g9UFovmMZyVX43SipaXNQcmltYXJ5w6Rtb2RlAYWpYWNjb3VudElE2ThHQlBMTEhPS1BSRlNDRTZGUDZEMzdBVVVOWUNKMlRTUE9ITUhBUjU0VEJETFdXUElaQ0Q0UkwzR7JhY2N0QnVuZGxlUmV2aXNpb24BsWVuY0FjY3RCdW5kbGVIYXNoxCAHEbHL2jsIn5lJJCTkKvM24zKMf+Cu7k52bSSNCaOXsqlpc1ByaW1hcnnDpG1vZGUBpHByZXbAqHJldmlzaW9uAQ==",
		[]accountCan{
			{"GAWZ7HVPKRGCH2KP6475XV6HA2CAF44MXWWE5RKV4LMMGB6FNNSEPNPE", "hKFlxKXNijkx4xEPPfrWDSmKzCvDxsaGaqOU+AGRJ21tXT/YiIYVy+Xhqn8ZDA8q7b6NhOLvQQKXao8RaVTyJz2ZPfF4JFdhtB4NW2FvVibNShKFMhpiB2JKKLQ1pe5SWTctKeCMySQEOSuRPYw5h1agWuFSO6G41bjc6tqxSN1Dy3X0NNiTSlV2t+vTKEIxPpslUkraHzX7QzLx0L/UHWgTNSKlDQUFoP2jZ2VuA6FuxBiN3rakOKyhdiI11EnaQh+DJr+OaiDpCwOhdgE="},
			{"GBPLLHOKPRFSCE6FP6D37AUUNYCJ2TSPOHMHAR54TBDLWWPIZCD4RL3G", "hKFlxKU/uVJvah1L9M9DXNzqfHkCafEpxeVPaZ+qi7/yxVrYPxaERZe3vtVpSSj/ubXOCps8PQdNGxryD9IpOHc7nz+a+jfGCrl1j5ka6cLaTtVRVPULm4zpFmtj3AG3OMMx3SERt+9nzwCzFMOhsWkF0qsUJmJb147619qHyYXVX9xBhfadKOnam91qDpeezjfkIJNfsc6wNz1Gq/lnw3NFJsWJKhLRPoyjZ2VuA6FuxBjyJpAx80CdDilh3Aa4kpgr2XpPm90HpwShdgE="},
		}},
	// this one has version 1
	{"WkgRG8Kn+kJ+9E3UOr+2AL/28+1FAHFcuwaXFNn63Bc=",
		3,
		"hKFlxPDOMmhJALH9j+DVPBfgO5o5XoR0e0Wzoohc38H98QuRiDvZdlMSXXVmnXaeESLsdFVvmNBX7LNj8AQ3tsisxuGzUEPnDCIvBQOVqWb0YzCg8hvT5TxuxFaFYr+b7JP+/8JaDfO2ZMZHmwh0bYSy+cveFjmJQu9dqJPrFkaI5M2qE3k9V2d9RDn279l+/tKkXaTADI5si9e8+6ZwccuD+w8YTBhF6pu92Ums9sYwlu1NJhljnzrpnyZHwlkPEuz9bx6gc9flSsTsM+F14z+1/3Mw7dK6/5o3heU6Dp5DRVyYzDm89+Y380nqsdswUItkpDCjZ2VuA6FuxBghv5/O3avrFmYsqX/yOIimwsQV24wATFmhdgE=",
		"g6hhY2NvdW50c5KFqWFjY291bnRJRNk4R0FXWjdIVlBLUkdDSDJLUDY0NzVYVjZIQTJDQUY0NE1YV1dFNVJLVjRMTU1HQjZGTk5TRVBOUEWyYWNjdEJ1bmRsZVJldmlzaW9uAbFlbmNBY2N0QnVuZGxlSGFzaMQgJ46Gf8Q34Oz+SY5WASuyNRbtK9amEwfZeh+cwYMkhu6paXNQcmltYXJ5w6Rtb2RlAYWpYWNjb3VudElE2ThHQlBMTEhPS1BSRlNDRTZGUDZEMzdBVVVOWUNKMlRTUE9ITUhBUjU0VEJETFdXUElaQ0Q0UkwzR7JhY2N0QnVuZGxlUmV2aXNpb24BsWVuY0FjY3RCdW5kbGVIYXNoxCBT04slGTYXYwS3F/NIMocy4hzfdbd6QbuAcu+fQLdk16lpc1ByaW1hcnnCpG1vZGUBpHByZXbAqHJldmlzaW9uAQ==",
		[]accountCan{
			{"GBPLLHOKPRFSCE6FP6D37AUUNYCJ2TSPOHMHAR54TBDLWWPIZCD4RL3G", "hKFlxKVmAT4zpHkRMmxvopFs5dNpPdbLP4Xbuv2vSb3Nb5v+X+5mJCOy+/viCSlFabN0hiLvRA9SNdbhmB0nGGEqr4KTpwI1Igi9kpDHct4WfaO5JKxM9z/c4CKEU+Yp83MwhrfvINFMu/9hvxWfYpIISSQUelfJExn1j+IHaTQje4+bpetdZ8L8aaq0i1JslDBhzuTSut1vDJTOs5IaFUdjmNWlIMFWB8+jZ2VuA6FuxBhp5v8W3hvbFv5pD0YMwazOaadZabL+w9ahdgE="},
			{"GAWZ7HVPKRGCH2KP6475XV6HA2CAF44MXWWE5RKV4LMMGB6FNNSEPNPE", "hKFlxKWaCv93H++U6REJYFrDJ7lIkxkIWxQui3TnWgknVao+Ch2mwBXwlrtJIfTLtisMiDe41Rhg5W2/MVuUahM4SP4/7bch/jaco294xDvt9qSy7gV3Tn6y3kQ4D9sbydP5fTX5b/2TbAsYaxVnNBI9gmWz9WnA1i/oMUVb+z64MdWgBFsYb+3NKq+ckOFBx7lWz06W84XVwFOQkfEa9Z1lHO7dZnnbYR2jZ2VuA6FuxBjfxSfGM/YdSvKrrFMopBR2ZqN+/Ekg3WqhdgE="},
		}},
	// parent visible hash mismatch
	{"33o4U14XU4NFNg99xV3DrW9+JFqux+Qy+9bKPO0CZqw=",
		3,
		"hKFlxPB8pYYB1ikZVIbr42li9xe7uWpnwXj6UzvNl84o1a9BQp32tMp9Os5STGSinCxeKJWThWDEaIkQAhbsIWM5I2f/y5Bakw8qPKdXnPvXzIFdIAKPaL5YOfeH4YqINUy1vLKtmXE4oNN/Re1GI2JJfLHoiwGdfkZ5BwNf8HBMPo+7NQoK72vhmawKoVZ/mhLZWhyWg2o2WLxnI6SvB23zr9S8DuzorjdFyPjMKLoW1cQEvjL89XC3Gh0jVQqtiyY4ztsezSaaK631EgCggKax9TgOMcadtjbSDak4Z4369iPxdPDarifQEH3tCgfQEqfm/FajZ2VuA6FuxBhNSgpvLKdBI1+uyn+AxVitwsUWFOvFv1OhdgI=",
		"g6hhY2NvdW50c5KFqWFjY291bnRJRNk4R0FXWjdIVlBLUkdDSDJLUDY0NzVYVjZIQTJDQUY0NE1YV1dFNVJLVjRMTU1HQjZGTk5TRVBOUEWyYWNjdEJ1bmRsZVJldmlzaW9uAbFlbmNBY2N0QnVuZGxlSGFzaMQgitIh2ZzE+Ee+B5sOTGh6Zykb3HzJm0AGEStUlbqv3gipaXNQcmltYXJ5w6Rtb2RlAYWpYWNjb3VudElE2ThHQlBMTEhPS1BSRlNDRTZGUDZEMzdBVVVOWUNKMlRTUE9ITUhBUjU0VEJETFdXUElaQ0Q0UkwzR7JhY2N0QnVuZGxlUmV2aXNpb24BsWVuY0FjY3RCdW5kbGVIYXNoxCBha3OfRg0rSijM9oc4jHDzkf6U1T1QA/70ZYyOCclIbqlpc1ByaW1hcnnCpG1vZGUBpHByZXbAqHJldmlzaW9uAQ==",
		[]accountCan{
			{"GAWZ7HVPKRGCH2KP6475XV6HA2CAF44MXWWE5RKV4LMMGB6FNNSEPNPE", "hKFlxKVK+UYzZvupFCxmCET7llfg+lz0WgoZjM1A4QwfTrn0SQiyJWUnq25ZHS4yCCkMHt0RZ9nkeNKLdBCW/zbGWl1PazWmRhHrQtnWNxYKn0loHacMxo8XPZrYMJxOzMmAQERYAdKLCCKbX7aSw0fM2f0O0vUakB6G9iMuBkSqLjnItRrw7IDq1nVKfrBKWGA7QndnA+cLU5QRnlc4X3tGnQLqqKiWLDajZ2VuA6FuxBjM4wCrCdDp+PUJMQaXZfid1okMls3wI3ahdgE="},
			{"GBPLLHOKPRFSCE6FP6D37AUUNYCJ2TSPOHMHAR54TBDLWWPIZCD4RL3G", "hKFlxKURh2JrnpBAnRNW2lDvx63Sd5bMMqUvI5bkvkn2CNWcMn+FcPRCK+75EZWv0Jnq+KT6Xp0r4Qm8INe27bLQJa5XOB8JB04XY5zGaAwHPY3hddUUmTFfn9CmY46SGY4bSQ5xejPIlsl+VBLgnM+4ZiuRp3o13YNjn9tBdWOHrJmb7c+err863f43Ttw6L1XxbOvwl81VIA/auHkw1znXr8D2ZleOP92jZ2VuA6FuxBgOiuJnWDcJvlZxaI6MyQCMI3leSfE54GWhdgE="},
		}},
	// account-level hash mismatch
	{"AdhjUfTyNZvZnyWuLrXCJ2XgpfErFwyqmRkg8ZEjAHg=",
		3,
		"hKFlxPAxslJzbyrnYaG4LJUi0hw9jKh6GaM99keZJb7K36pN1whf/bN5iFxrC9J0KQeW7OQAXEp973OdfO2azxzzh3if/SQ9wQN00XQMWLN2Cb0Je98+z9wFWsWdh918Rit5x5hNi61PvTUxQCsahGeO1BqWJxvC3P3XzwBBg2CaesB07KfDZSB5kBP6mruluGgATE4WLmk8LmoyQL4CA6DYpRaWl5Xr6e5tAj5JFzd9wnSCIiKPukONnJqszqfZaF+ZVUznQ1q9MfjIM3huQrOb7wC/NPKtoM+xsTPgCjmIfLZBwY6lD8xiUdaTNGFH6zNvHdCjZ2VuA6FuxBgpHteB4lY/BqjThfRNbn/TNKRfvl0cXv2hdgI=",
		"g6hhY2NvdW50c5KFqWFjY291bnRJRNk4R0FXWjdIVlBLUkdDSDJLUDY0NzVYVjZIQTJDQUY0NE1YV1dFNVJLVjRMTU1HQjZGTk5TRVBOUEWyYWNjdEJ1bmRsZVJldmlzaW9uAbFlbmNBY2N0QnVuZGxlSGFzaMQgH3M1uaaaaa1r684bDx18YGFfqAPCRhgktz/Y3lBUPAapaXNQcmltYXJ5w6Rtb2RlAYWpYWNjb3VudElE2ThHQlBMTEhPS1BSRlNDRTZGUDZEMzdBVVVOWUNKMlRTUE9ITUhBUjU0VEJETFdXUElaQ0Q0UkwzR7JhY2N0QnVuZGxlUmV2aXNpb24BsWVuY0FjY3RCdW5kbGVIYXNoxCAxAujlppppoT+KYBEoHY76Uq1v9rPcf4lbhFW4v+p14alpc1ByaW1hcnnCpG1vZGUBpHByZXbAqHJldmlzaW9uAQ==",
		[]accountCan{
			{"GAWZ7HVPKRGCH2KP6475XV6HA2CAF44MXWWE5RKV4LMMGB6FNNSEPNPE", "hKFlxKWW2fR2MgA3VlejatZlBJ057v0+YFBdSQGuh3V1LkA4XDCYx3fC8+N9FZN7HOlQd1eBYO4gT/7wgg3fk9k2K9BVHCbXAJeKiv8DMV9SbJ7ZWQnXG9BAT1ZQApv4BBVMWTvY9uhao07IU5amC58KC6xlaRZg1BwkRuk4H83ahdvMXWLpzFMlwobtjoD0tiG7u6YGAw3Bpr2N5JUDxdjUAHbdCUSl0BOjZ2VuA6FuxBgk5XMAnRJBS1C7J7g82tAmH85+b2JMWgehdgE="},
			{"GBPLLHOKPRFSCE6FP6D37AUUNYCJ2TSPOHMHAR54TBDLWWPIZCD4RL3G", "hKFlxKUSt6xJveOZtTct6TMN9kBo5/1qmoFIHtpCLJzkYrnu0ciOODqDtwnUmHlbYfT7GjRdyN2jo7xfdw6D2jtTKAyCCGUbehlXLFP2x0+wNo6oiUCCiP5/uk3SuR/QfFtrh1aussrZgx2GzW76ZLEXlVKm6tQ+B+/ARQHeQobUaB2jpTrB9HwsO/ZhEllEyWDtRMtaOzlBl3yXPo9e8E41Wq3mFXQRbMWjZ2VuA6FuxBiKSBv9DEiFTGGcAGUcimPbFWeIFm0n99GhdgE="},
		}},
}

func TestCanningFacility(t *testing.T) {
	if os.Getenv("KEYBASE_CANNING_FACILITY") != "1" {
		t.Skip("this is not really a test but a tool for creating cans for tests")
	}
	a1 := stellar1.AccountID("GAWZ7HVPKRGCH2KP6475XV6HA2CAF44MXWWE5RKV4LMMGB6FNNSEPNPE")
	s1 := stellar1.SecretKey("SBV2JNAJA65LMCZ5HYDXAYWRQK25CD2DZB25YZVNX3OLPALN2EVKO2V2")
	a2 := stellar1.AccountID("GBPLLHOKPRFSCE6FP6D37AUUNYCJ2TSPOHMHAR54TBDLWWPIZCD4RL3G")
	s2 := stellar1.SecretKey("SDZJUFUKEQQU77DCF2VH72XB4S427EGKF6BSOSPUIKLTBCTCMXQQ7JU5")
	bundleLocal := stellar1.Bundle{
		Revision: 1,
		Prev:     nil,
		Accounts: []stellar1.BundleEntry{{
			AccountID:          a1,
			Mode:               stellar1.AccountMode_USER,
			IsPrimary:          true,
			Name:               "p1",
			AcctBundleRevision: 1,
			EncAcctBundleHash:  nil,
		}, {
			AccountID:          a2,
			Mode:               stellar1.AccountMode_USER,
			IsPrimary:          false,
			Name:               "p2",
			AcctBundleRevision: 1,
			EncAcctBundleHash:  nil,
		}},
		AccountBundles: map[stellar1.AccountID]stellar1.AccountBundle{
			a1: {
				AccountID: a1,
				Signers:   []stellar1.SecretKey{s1},
			},
			a2: {
				AccountID: a2,
				Signers:   []stellar1.SecretKey{s2},
			},
		},
	}
	ring := newPukRing()
	pukSeed, pukGen := ring.makeGen(t, 3)
	boxed, err := BoxAndEncode(&bundleLocal, pukGen, pukSeed)
	require.NoError(t, err)
	t.Logf(spew.Sdump(boxed))
	t.Logf("puk seed: %v", toB64(pukSeed[:]))
	t.Logf("puk gen: %v", pukGen)
	t.Logf("nonce: %v", toB64(boxed.EncParent.N[:]))
	t.Logf("enc E: %v", toB64(boxed.EncParent.E))
	t.Logf("\nEncParentB64: %v", boxed.EncParentB64)
	t.Logf("VisParentB64: %v\n", boxed.VisParentB64)
	for acctID, encodedAcct := range boxed.AcctBundles {
		t.Logf("account: %v, EncB64: %v", acctID, encodedAcct.EncB64)
	}
	cipherpack, err := base64.StdEncoding.DecodeString(boxed.EncParentB64)
	require.NoError(t, err)
	encHash := sha256.Sum256(cipherpack)
	t.Logf("actual own hash: %v", toB64(encHash[:]))

	// decode it back again and take a look,
	// especially for generating expected errors
	benc := BundleEncoded{
		EncParent:   boxed.EncParentB64,
		VisParent:   boxed.VisParentB64,
		AcctBundles: make(map[stellar1.AccountID]string),
	}
	for acctID, encodedAcct := range boxed.AcctBundles {
		benc.AcctBundles[acctID] = encodedAcct.EncB64
	}
	m := libkb.NewMetaContext(context.Background(), nil)
	decodedBundle, _, _, _, err := DecodeAndUnbox(m, ring, benc)
	t.Logf("decoded: %+v, err: %v", decodedBundle, err)
}

func toB64(b []byte) string {
	return base64.StdEncoding.EncodeToString(b)
}

func TestCanned(t *testing.T) {
	m := libkb.NewMetaContext(context.Background(), nil)

	// valid can
	c := cans[0]
	bundle, _, _, _, err := DecodeAndUnbox(m, c.ring(t), c.toBundleEncodedB64())
	require.NoError(t, err)
	require.Equal(t, "yJwcMuMxwpFuxt0A+7zYT2iev/1wVB5OeNdJzDSlBDo=", toB64(bundle.OwnHash))
	// hashes match for the first account
	a1BundleHash := bundle.AccountBundles["GAWZ7HVPKRGCH2KP6475XV6HA2CAF44MXWWE5RKV4LMMGB6FNNSEPNPE"].OwnHash
	require.Equal(t, "BgkhqzuIynMJrhIeuSOPTCoS5QutvwDXZr7fHVuCmpg=", toB64(a1BundleHash))
	require.Equal(t, "BgkhqzuIynMJrhIeuSOPTCoS5QutvwDXZr7fHVuCmpg=", toB64(bundle.Accounts[0].EncAcctBundleHash))
	// hashes match for the second account
	a2BundleHash := bundle.AccountBundles["GBPLLHOKPRFSCE6FP6D37AUUNYCJ2TSPOHMHAR54TBDLWWPIZCD4RL3G"].OwnHash
	require.Equal(t, "mwbjopTOaCgbwtSWhMyaKvJdVtaYnFeTMZExDqzxJ6U=", toB64(a2BundleHash))
	require.Equal(t, "mwbjopTOaCgbwtSWhMyaKvJdVtaYnFeTMZExDqzxJ6U=", toB64(bundle.Accounts[1].EncAcctBundleHash))
}

func TestCantOpenWithTheWrongKey(t *testing.T) {
	m := libkb.NewMetaContext(context.Background(), nil)

	c := cans[1]
	pukSeed := c.puk(t)
	pukGen := c.gen()
	ring := &pukRing{
		map[keybase1.PerUserKeyGeneration]libkb.PerUserKeySeed{
			pukGen: pukSeed,
		},
	}
	_, _, _, _, err := DecodeAndUnbox(m, ring, c.toBundleEncodedB64())
	require.Error(t, err)
	require.Contains(t, err.Error(), "secret box open failed")
}

func TestCannedUnboxInvariantViolationMultiplePrimary(t *testing.T) {
	m := libkb.NewMetaContext(context.Background(), nil)

	c := cans[2]
	_, _, _, _, err := DecodeAndUnbox(m, c.ring(t), c.toBundleEncodedB64())
	require.Error(t, err)
	require.Contains(t, err.Error(), "multiple primary accounts")
}

func TestCannedCryptV1(t *testing.T) {
	m := libkb.NewMetaContext(context.Background(), nil)

	c := cans[3]
	_, _, _, _, err := DecodeAndUnbox(m, c.ring(t), c.toBundleEncodedB64())
	require.Error(t, err)
	require.Contains(t, err.Error(), "stellar secret bundle encryption version 1 has been retired")
}

func TestCannedBundleHashMismatch(t *testing.T) {
	m := libkb.NewMetaContext(context.Background(), nil)

	c := cans[4]
	_, _, _, _, err := DecodeAndUnbox(m, c.ring(t), c.toBundleEncodedB64())
	require.Error(t, err)
	require.Contains(t, err.Error(), "corrupted bundle: visible hash mismatch")
}

func TestCannedAccountHashMismatch(t *testing.T) {
	m := libkb.NewMetaContext(context.Background(), nil)

	c := cans[5]
	_, _, _, _, err := DecodeAndUnbox(m, c.ring(t), c.toBundleEncodedB64())
	require.Error(t, err)
	require.Contains(t, err.Error(), "account bundle and parent entry hash mismatch")
}

// TestBoxAccountBundle checks boxing an account bundle and that DecodeAndUnbox
// gets back to the initial bundle.
func TestBoxAccountBundle(t *testing.T) {
	b, err := NewInitial("abc")
	require.NoError(t, err)
	require.NotNil(t, b)

	ring := newPukRing()
	seed, gen := ring.makeGen(t, 1)
	boxed, err := BoxAndEncode(b, gen, seed)
	require.NoError(t, err)
	require.NotNil(t, boxed, "BoxAndEncode() should return something")
	require.Equal(t, stellar1.BundleVersion_V2, boxed.FormatVersionParent, "should be V2")
	require.NotEmpty(t, boxed.VisParentB64)
	require.NotEmpty(t, boxed.EncParentB64)
	require.Equal(t, 2, boxed.EncParent.V)
	require.NotEmpty(t, boxed.EncParent.E)
	require.NotZero(t, boxed.EncParent.N)
	require.Equal(t, gen, boxed.EncParent.Gen)
	require.Len(t, boxed.AcctBundles, 1)

	m := libkb.NewMetaContext(context.Background(), nil)
	bundle, version, pukGen, accountGens, err := DecodeAndUnbox(m, ring, boxed.toBundleEncodedB64())
	require.NoError(t, err)
	require.NotNil(t, bundle)
	require.Equal(t, stellar1.BundleVersion_V2, version)
	require.Len(t, bundle.Accounts, 1)
	require.Equal(t, stellar1.AccountMode_USER, bundle.Accounts[0].Mode)
	require.Equal(t, pukGen, keybase1.PerUserKeyGeneration(1))
	acctBundle, ok := bundle.AccountBundles[bundle.Accounts[0].AccountID]
	require.True(t, ok)
	acctBundleOriginal, ok := b.AccountBundles[bundle.Accounts[0].AccountID]
	require.True(t, ok)
	require.Equal(t, acctBundle.Signers[0], acctBundleOriginal.Signers[0])
	for _, acct := range bundle.Accounts {
		require.Equal(t, keybase1.PerUserKeyGeneration(1), accountGens[acct.AccountID])
	}
}

// pukRing is a convenience type for puks in these tests.
type pukRing struct {
	puks map[keybase1.PerUserKeyGeneration]libkb.PerUserKeySeed
}

func newPukRing() *pukRing {
	return &pukRing{puks: make(map[keybase1.PerUserKeyGeneration]libkb.PerUserKeySeed)}
}

func (p *pukRing) makeGen(t *testing.T, gen int) (libkb.PerUserKeySeed, keybase1.PerUserKeyGeneration) {
	puk, err := libkb.GeneratePerUserKeySeed()
	require.NoError(t, err)
	pgen := keybase1.PerUserKeyGeneration(gen)
	p.puks[pgen] = puk
	return puk, pgen
}

// SeedByGeneration makes pukRing implement PukFinder.
func (p *pukRing) SeedByGeneration(m libkb.MetaContext, generation keybase1.PerUserKeyGeneration) (libkb.PerUserKeySeed, error) {
	puk, ok := p.puks[generation]
	if ok {
		return puk, nil
	}
	return libkb.PerUserKeySeed{}, errors.New("not found")
}
