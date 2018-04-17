package systests

import (
	"testing"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/protocol/stellar1"
	"github.com/keybase/client/go/stellar"
	"github.com/stretchr/testify/require"
)

func TestStellarNoteRoundtripAndResets(t *testing.T) {
	ctx := newSMUContext(t)
	defer ctx.cleanup()

	// Sign up two users, bob and alice.
	alice := ctx.installKeybaseForUser("alice", 10)
	alice.signup()
	divDebug(ctx, "Signed up alice (%s)", alice.username)
	bob := ctx.installKeybaseForUser("bob", 10)
	bob.signup()
	divDebug(ctx, "Signed up bob (%s)", bob.username)

	t.Logf("note to self")
	encB64, err := stellar.NoteEncryptB64(context.Background(), alice.getPrimaryGlobalContext(), sampleNote(), nil)
	require.NoError(t, err)
	note, err := stellar.NoteDecryptB64(context.Background(), alice.getPrimaryGlobalContext(), encB64)
	require.NoError(t, err)
	require.Equal(t, sampleNote(), note)

	t.Logf("note to both users")
	other := bob.userVersion()
	encB64, err = stellar.NoteEncryptB64(context.Background(), alice.getPrimaryGlobalContext(), sampleNote(), &other)
	require.NoError(t, err)

	t.Logf("decrypt as self")
	note, err = stellar.NoteDecryptB64(context.Background(), alice.getPrimaryGlobalContext(), encB64)
	require.NoError(t, err)
	require.Equal(t, sampleNote(), note)

	t.Logf("decrypt as other")
	note, err = stellar.NoteDecryptB64(context.Background(), bob.getPrimaryGlobalContext(), encB64)
	require.NoError(t, err)
	require.Equal(t, sampleNote(), note)

	t.Logf("reset sender")
	alice.reset()
	divDebug(ctx, "Reset bob (%s)", bob.username)
	alice.loginAfterReset(10)
	divDebug(ctx, "Bob logged in after reset")

	t.Logf("fail to decrypt as post-reset self")
	note, err = stellar.NoteDecryptB64(context.Background(), alice.getPrimaryGlobalContext(), encB64)
	require.Error(t, err)
	require.Equal(t, "note not encrypted for logged-in user", err.Error())

	t.Logf("decrypt as other")
	note, err = stellar.NoteDecryptB64(context.Background(), bob.getPrimaryGlobalContext(), encB64)
	require.NoError(t, err)
	require.Equal(t, sampleNote(), note)
}

func sampleNote() stellar1.NoteContents {
	return stellar1.NoteContents{
		Version:   1,
		Note:      "wizbang",
		StellarID: stellar1.TransactionID("6653fc2fdbc42ad51ccbe77ee0a3c29e258a5513c62fdc532cbfff91ab101abf"),
	}
}
