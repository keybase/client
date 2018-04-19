package stellar

import (
	"context"
	"testing"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/stellar1"
	"github.com/stretchr/testify/require"
)

func TestNoteRoundtrip(t *testing.T) {
	sk := randomSymmetricKey(t)
	pre := sampleNote()
	expect := pre.DeepCopy()
	encNote, err := noteEncryptHelper(context.Background(), pre, sk)
	require.NoError(t, err)
	post, err := noteDecryptHelper(context.Background(), encNote, sk)
	require.NoError(t, err)
	require.Equal(t, expect, post)
}

func TestNoteBadKey(t *testing.T) {
	sk := randomSymmetricKey(t)
	pre := sampleNote()
	encNote, err := noteEncryptHelper(context.Background(), pre, sk)
	require.NoError(t, err)
	if sk[3] == 'c' {
		sk[3] = 'd'
	} else {
		sk[3] = 'c'
	}
	_, err = noteDecryptHelper(context.Background(), encNote, sk)
	require.Error(t, err)
	require.Equal(t, "could not decrypt note secretbox", err.Error())
}

func TestNoteCorruptCiphertext(t *testing.T) {
	sk := randomSymmetricKey(t)
	pre := sampleNote()
	encNote, err := noteEncryptHelper(context.Background(), pre, sk)
	if encNote.E[3] == 'c' {
		encNote.E[3] = 'd'
	} else {
		encNote.E[3] = 'c'
	}
	require.NoError(t, err)
	_, err = noteDecryptHelper(context.Background(), encNote, sk)
	require.Error(t, err)
	require.Equal(t, "could not decrypt note secretbox", err.Error())
}

func randomSymmetricKey(t testing.TB) libkb.NaclSecretBoxKey {
	puk, err := libkb.GeneratePerUserKeySeed()
	require.NoError(t, err)
	symmetricKey, err := puk.DeriveSymmetricKey(libkb.DeriveReason("testing testing testing"))
	require.NoError(t, err)
	return symmetricKey
}

func sampleNote() stellar1.NoteContents {
	return stellar1.NoteContents{
		Version:   1,
		Note:      "wizbang",
		StellarID: stellar1.TransactionID("6653fc2fdbc42ad51ccbe77ee0a3c29e258a5513c62fdc532cbfff91ab101abf"),
	}
}
