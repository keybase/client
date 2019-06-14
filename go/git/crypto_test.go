package git

import (
	"testing"

	"golang.org/x/crypto/nacl/secretbox"
	"golang.org/x/net/context"

	"github.com/keybase/client/go/externals"
	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/teams"
	"github.com/stretchr/testify/require"

	insecureTriplesec "github.com/keybase/go-triplesec-insecure"
)

func InstallInsecureTriplesec(g *libkb.GlobalContext) {
	g.NewTriplesec = func(passphrase []byte, salt []byte) (libkb.Triplesec, error) {
		warner := func() { g.Log.Warning("Installing insecure Triplesec with weak stretch parameters") }
		isProduction := func() bool {
			return g.Env.GetRunMode() == libkb.ProductionRunMode
		}
		return insecureTriplesec.NewCipher(passphrase, salt, libkb.ClientTriplesecVersion, warner, isProduction)
	}
}

func setupTest(tb testing.TB, name string) libkb.TestContext {
	tc := libkb.SetupTest(tb, name, 1)
	tc.G.SetProofServices(externals.NewProofServices(tc.G))
	InstallInsecureTriplesec(tc.G)
	teams.NewTeamLoaderAndInstall(tc.G)
	teams.NewAuditorAndInstall(tc.G)
	return tc
}

func createRootTeam(tc libkb.TestContext) keybase1.TeamID {
	u, err := kbtest.CreateAndSignupFakeUser("c", tc.G)
	require.NoError(tc.T, err)
	teamName, err := keybase1.TeamNameFromString("T" + u.Username + "T")
	require.NoError(tc.T, err)
	_, err = teams.CreateRootTeam(context.Background(), tc.G, teamName.String(), keybase1.TeamSettings{})
	require.NoError(tc.T, err)
	return teamName.ToPrivateTeamID()
}

func createImplicitTeam(tc libkb.TestContext, public bool) keybase1.TeamID {
	u, err := kbtest.CreateAndSignupFakeUser("c", tc.G)
	require.NoError(tc.T, err)
	team, _, _, err := teams.LookupOrCreateImplicitTeam(context.TODO(), tc.G, u.Username, public)
	require.NoError(tc.T, err)
	require.Equal(tc.T, public, team.ID.IsPublic())
	return team.ID
}

func setupBox(t *testing.T) (libkb.TestContext, *Crypto, keybase1.TeamIDWithVisibility, *keybase1.EncryptedGitMetadata) {
	tc := setupTest(t, "crypto")

	teamID := createRootTeam(tc)
	teamSpec := keybase1.TeamIDWithVisibility{
		TeamID:     teamID,
		Visibility: keybase1.TLFVisibility_PRIVATE,
	}
	plaintext, err := libkb.RandBytes(80)
	require.NoError(tc.T, err)

	c := NewCrypto(tc.G)
	boxed, err := c.Box(context.Background(), plaintext, teamSpec)
	require.NoError(tc.T, err)
	require.NotNil(tc.T, boxed)
	require.EqualValues(tc.T, boxed.Gen, 1)
	require.Len(tc.T, boxed.N, libkb.NaclDHNonceSize)
	require.NotZero(tc.T, boxed.N)
	require.NotEmpty(tc.T, boxed.E)

	return tc, c, teamSpec, boxed
}

func TestCryptoUnbox(t *testing.T) {
	testCryptoUnbox(t, false, false)
	testCryptoUnbox(t, true, false)
	testCryptoUnbox(t, true, true)
}

func testCryptoUnbox(t *testing.T, implicit, public bool) {
	t.Logf("running with implicit:%v public:%v", implicit, public)

	visibility := keybase1.TLFVisibility_PRIVATE
	if public {
		visibility = keybase1.TLFVisibility_PUBLIC
	}

	tc := setupTest(t, "crypto")
	defer tc.Cleanup()
	var teamID keybase1.TeamID
	if implicit {
		teamID = createImplicitTeam(tc, public)
	} else {
		if public {
			t.Fatalf("public teams not supported")
		}
		teamID = createRootTeam(tc)
	}
	require.Equal(t, public, teamID.IsPublic())

	teamSpec := keybase1.TeamIDWithVisibility{
		TeamID:     teamID,
		Visibility: visibility,
	}
	plaintext, err := libkb.RandBytes(80)
	require.NoError(tc.T, err)

	loadTeam := func() *teams.Team {
		team, err := teams.Load(context.TODO(), tc.G, keybase1.LoadTeamArg{
			ID:          teamID,
			Public:      public,
			ForceRepoll: true,
		})
		require.NoError(t, err)
		return team
	}

	c := NewCrypto(tc.G)

	for i := 1; i <= 3; i++ {
		t.Logf("rotation:%v", i)

		boxed, err := c.Box(context.Background(), plaintext, teamSpec)
		require.NoError(tc.T, err)
		require.NotNil(tc.T, boxed)
		if public {
			// public always uses generation 1 for publicCryptKey
			require.EqualValues(tc.T, 1, boxed.Gen)
		} else {
			require.EqualValues(tc.T, i, boxed.Gen)
		}
		require.Len(tc.T, boxed.N, libkb.NaclDHNonceSize)
		require.NotEmpty(tc.T, boxed.E)

		unboxed, err := c.Unbox(context.Background(), teamSpec, boxed)
		require.NoError(tc.T, err)
		require.NotNil(tc.T, unboxed)
		require.Equal(tc.T, plaintext, unboxed)

		canOpenWithPublicKey := false
		{
			var encKey [libkb.NaclSecretBoxKeySize]byte = publicCryptKey.Key
			var naclNonce [libkb.NaclDHNonceSize]byte = boxed.N
			decrypted, ok := secretbox.Open(nil, boxed.E, &naclNonce, &encKey)
			canOpenWithPublicKey = ok && libkb.SecureByteArrayEq(plaintext, decrypted)
		}
		require.Equal(t, public, canOpenWithPublicKey, "should only be able to open with public key if public")

		team := loadTeam()
		err = team.Rotate(context.TODO())
		require.NoError(t, err)
		loadTeam() // load again to get the new key
	}
}

func TestCryptoVisibility(t *testing.T) {
	tc := setupTest(t, "crypto")
	defer tc.Cleanup()

	teamID := createRootTeam(tc)
	teamSpecPublic := keybase1.TeamIDWithVisibility{
		TeamID:     teamID,
		Visibility: keybase1.TLFVisibility_PUBLIC, // PRIVATE is correct
	}
	teamSpecPrivate := keybase1.TeamIDWithVisibility{
		TeamID:     teamID,
		Visibility: keybase1.TLFVisibility_PRIVATE,
	}
	plaintext, err := libkb.RandBytes(80)
	require.NoError(tc.T, err)

	c := NewCrypto(tc.G)
	boxed, err := c.Box(context.Background(), plaintext, teamSpecPublic)
	require.Error(tc.T, err)
	require.IsType(tc.T, libkb.TeamVisibilityError{}, err)
	require.Nil(tc.T, boxed)

	// fix it so we can box some data and test visibility on unbox
	boxed, err = c.Box(context.Background(), plaintext, teamSpecPrivate)
	require.NoError(tc.T, err)
	require.NotNil(tc.T, boxed)

	// this should fail with public spec
	unboxed, err := c.Unbox(context.Background(), teamSpecPublic, boxed)
	require.Error(tc.T, err)
	require.IsType(tc.T, libkb.TeamVisibilityError{}, err)
	require.Nil(tc.T, unboxed)

	// and succeed with private spec
	unboxed, err = c.Unbox(context.Background(), teamSpecPrivate, boxed)
	require.NoError(tc.T, err)
	require.NotNil(tc.T, unboxed)
}

func TestCryptoKeyGen(t *testing.T) {
	tc, c, teamSpec, boxed := setupBox(t)
	defer tc.Cleanup()

	// choose an invalid key generation
	boxed.Gen = 2
	unboxed, err := c.Unbox(context.Background(), teamSpec, boxed)
	require.Error(tc.T, err)
	require.Equal(tc.T, "no team secret found at generation 2", err.Error())
	require.Nil(tc.T, unboxed)
}

func TestCryptoNonce(t *testing.T) {
	tc, c, teamSpec, boxed := setupBox(t)
	defer tc.Cleanup()

	// flip nonce bit
	boxed.N[4] ^= 0x10
	unboxed, err := c.Unbox(context.Background(), teamSpec, boxed)
	require.Error(tc.T, err)
	require.IsType(tc.T, libkb.DecryptOpenError{}, err)
	require.Nil(tc.T, unboxed)
}

func TestCryptoData(t *testing.T) {
	tc, c, teamSpec, boxed := setupBox(t)
	defer tc.Cleanup()

	if len(boxed.E) < 4 {
		tc.T.Fatalf("very small encrypted data size: %d", len(boxed.E))
	}

	// flip data bit
	boxed.E[3] ^= 0x10
	unboxed, err := c.Unbox(context.Background(), teamSpec, boxed)
	require.Error(tc.T, err)
	require.IsType(tc.T, libkb.DecryptOpenError{}, err)
	require.Nil(tc.T, unboxed)
}

func TestCryptoVersion(t *testing.T) {
	tc, c, teamSpec, boxed := setupBox(t)
	defer tc.Cleanup()

	// bump version
	boxed.V++
	unboxed, err := c.Unbox(context.Background(), teamSpec, boxed)
	require.Error(tc.T, err)
	require.Nil(tc.T, unboxed)
}
