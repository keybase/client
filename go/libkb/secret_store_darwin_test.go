// +build darwin

package libkb

import (
	"encoding/base64"
	"testing"

	keychain "github.com/keybase/go-keychain"
	"github.com/stretchr/testify/require"
)

func TestSecretStoreDarwin(t *testing.T) {
	tc := SetupTest(t, "secret store darwin", 1)
	defer tc.Cleanup()

	mctx := NewMetaContextForTest(tc)
	secretStore := KeychainSecretStore{}
	nu := NormalizedUsername("username")

	defer func() {
		err := secretStore.ClearSecret(mctx, nu)
		require.NoError(tc.T, err)
	}()

	serviceName := secretStore.serviceName(mctx)
	accessGroup := secretStore.accessGroup(mctx)

	expectedSecret1 := []byte("test secret 1test secret 1test s")
	expectedSecret2 := []byte("test secret 2test secret 2test s")
	encodedSecret1 := base64.StdEncoding.EncodeToString(expectedSecret1)
	encodedSecret2 := base64.StdEncoding.EncodeToString(expectedSecret2)
	lkSec1, err := newLKSecFullSecretFromBytes(expectedSecret1)
	require.NoError(t, err)

	err = secretStore.StoreSecret(mctx, nu, lkSec1)
	require.NoError(t, err)

	secret, err := secretStore.RetrieveSecret(mctx, nu)
	require.NoError(t, err)
	require.Equal(t, string(expectedSecret1), string(secret.Bytes()))

	t.Logf("Corrupt keychain, add new secret")
	// corrupt the secret in the keychain by writing into a new slot
	// forcing us to use a new keychain slot when writing the new item
	account := newKeychainSlottedAccount(nu, 1)
	item := keychain.NewGenericPassword(serviceName, account.String(),
		"", []byte(encodedSecret2), accessGroup)
	err = keychain.AddItem(item)
	require.NoError(t, err)

	// We now readout expectedSecret2 since it is the latest entry.
	secret, err = secretStore.RetrieveSecret(mctx, nu)
	require.NoError(t, err)
	require.Equal(t, string(expectedSecret2), string(secret.Bytes()))

	// Now write expectedSecret1 back into the store, which will overwrite secret2
	err = secretStore.StoreSecret(mctx, nu, lkSec1)
	require.NoError(t, err)

	secret, err = secretStore.RetrieveSecret(mctx, nu)
	require.NoError(t, err)
	require.Equal(t, string(expectedSecret1), string(secret.Bytes()))

	// verify our keychain state
	for i := 0; i < 2; i++ {
		account := newKeychainSlottedAccount(nu, i)
		query := keychain.NewItem()
		query.SetSecClass(keychain.SecClassGenericPassword)
		query.SetService(serviceName)
		query.SetAccount(account.String())
		query.SetAccessGroup(accessGroup)
		query.SetReturnData(true)
		query.SetReturnAttributes(true)
		results, err := keychain.QueryItem(query)
		require.NoError(t, err)
		require.Len(t, results, 1)
		res := results[0]

		require.Equal(t, secretStore.serviceName(mctx), res.Service)
		require.Equal(t, account.String(), res.Account)
		require.Equal(t, secretStore.accessGroup(mctx), res.AccessGroup)
		require.Equal(t, "", res.Description)
		require.Equal(t, encodedSecret1, string(res.Data))
	}

	// Although we have 3 keychain items, we technically only have one user in
	// the store.
	users, err := secretStore.GetUsersWithStoredSecrets(mctx)
	require.NoError(t, err)
	require.Len(t, users, 1)

	err = secretStore.ClearSecret(mctx, nu)
	require.NoError(t, err)

	for i := 0; i < 2; i++ {
		account := newKeychainSlottedAccount(nu, i)
		query := keychain.NewItem()
		query.SetSecClass(keychain.SecClassGenericPassword)
		query.SetService(serviceName)
		query.SetAccount(account.String())
		query.SetAccessGroup(accessGroup)
		query.SetReturnData(true)
		query.SetReturnAttributes(true)
		results, err := keychain.QueryItem(query)
		require.NoError(t, err)
		require.Nil(t, results)
	}

	users, err = secretStore.GetUsersWithStoredSecrets(mctx)
	require.NoError(t, err)
	require.Len(t, users, 0)
}

func TestPrimeSecretStoreDarwin(t *testing.T) {
	tc := SetupTest(t, "secret_store_darwin", 1)
	defer tc.Cleanup()
	tc.G.Env.Test.SecretStorePrimingDisabled = false

	mctx := NewMetaContextForTest(tc)
	secretStore := KeychainSecretStore{}
	err := PrimeSecretStore(mctx, secretStore)
	require.NoError(t, err)
}
