package acctbundle

import (
	"context"
	"errors"
	"testing"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/protocol/stellar1"
	"github.com/stretchr/testify/require"
)

// TestInitialAccountBundle makes sure we can make a brand-new account bundle
// with a new random secret.
func TestInitialBundle(t *testing.T) {
	b, err := NewInitial("hello")
	require.NoError(t, err)
	require.NotNil(t, b)
	require.Len(t, b.Accounts, 1)
	require.Len(t, b.AccountBundles, 1)
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
	bundle, version, err := DecodeAndUnbox(m, ring, boxed.toBundleEncodedB64())
	require.NoError(t, err)
	require.NotNil(t, bundle)
	require.Equal(t, stellar1.BundleVersion_V2, version)
	require.Len(t, bundle.Accounts, 1)
	require.Equal(t, stellar1.AccountMode_USER, bundle.Accounts[0].Mode)
	acctBundle, ok := bundle.AccountBundles[bundle.Accounts[0].AccountID]
	require.True(t, ok)
	acctBundleOriginal, ok := b.AccountBundles[bundle.Accounts[0].AccountID]
	require.True(t, ok)
	require.Equal(t, acctBundle.Signers[0], acctBundleOriginal.Signers[0])
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
