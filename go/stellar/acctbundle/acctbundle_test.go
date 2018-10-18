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
func TestInitialAccountBundle(t *testing.T) {
	b, err := NewInitial("hello")
	require.NoError(t, err)
	require.NotNil(t, b)
	require.Len(t, b.Signers, 1)
}

// TestBoxAccountBundle checks boxing an account bundle and that DecodeAndUnbox
// gets back to the initial bundle.
func TestBoxAccountBundle(t *testing.T) {
	b, err := NewInitial("abc")
	require.NoError(t, err)
	require.NotNil(t, b)

	ring := newPukRing()
	seed, gen := ring.makeGen(t, 1)
	boxed, err := Box(b, gen, seed)
	require.NoError(t, err)
	require.NotNil(t, boxed, "b.Box() should return something")
	require.Equal(t, stellar1.AccountBundleVersion_V1, boxed.FormatVersion, "should be V1")
	require.NotEmpty(t, boxed.EncB64)
	require.NotEmpty(t, boxed.VisB64)
	require.Equal(t, 1, boxed.Enc.V)
	require.NotEmpty(t, boxed.Enc.E)
	require.NotZero(t, boxed.Enc.N)
	require.Equal(t, gen, boxed.Enc.Gen)

	m := libkb.NewMetaContext(context.Background(), nil)
	bundle, version, err := DecodeAndUnbox(m, ring, boxed.EncB64, boxed.VisB64)
	require.NoError(t, err)
	require.NotNil(t, bundle)
	require.Equal(t, stellar1.AccountBundleVersion_V1, version)
	require.Len(t, bundle.Signers, 1)
	require.Equal(t, bundle.Signers[0], b.Signers[0])
	require.Equal(t, stellar1.AccountMode_USER, bundle.Mode)
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
