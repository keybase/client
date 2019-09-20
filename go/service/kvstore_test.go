package service

import (
	"context"
	"encoding/json"
	"fmt"
	"testing"

	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/kvstore"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/teams"
	"github.com/stretchr/testify/require"
)

func kvTestSetup(t *testing.T) libkb.TestContext {
	tc := libkb.SetupTest(t, "kvstore", 0)
	teams.ServiceInit(tc.G)
	newRevisionCache := kvstore.NewKVRevisionCache()
	tc.G.SetKVRevisionCache(newRevisionCache)
	return tc
}

func TestKvStoreSelfTeamPutGet(t *testing.T) {
	tc := kvTestSetup(t)
	defer tc.Cleanup()

	user, err := kbtest.CreateAndSignupFakeUser("kvs", tc.G)
	require.NoError(t, err)
	handler := NewKVStoreHandler(nil, tc.G)
	ctx := context.Background()
	teamName := fmt.Sprintf("%s,%s", user.Username, user.Username)
	namespace := "ye-namespace"
	entryKey := "lookmeup"

	// put a secret
	cleartextSecret := "lorem ipsum blah blah blah"
	putArg := keybase1.PutKVEntryArg{
		SessionID:  0,
		TeamName:   teamName,
		Namespace:  namespace,
		EntryKey:   entryKey,
		EntryValue: cleartextSecret,
	}
	putRes, err := handler.PutKVEntry(ctx, putArg)
	require.NoError(t, err)
	require.Equal(t, 1, putRes.Revision)

	// fetch it and assert that it's the same
	getArg := keybase1.GetKVEntryArg{
		TeamName:  teamName,
		Namespace: namespace,
		EntryKey:  entryKey,
	}
	getRes, err := handler.GetKVEntry(ctx, getArg)
	require.NoError(t, err)
	require.Equal(t, cleartextSecret, getRes.EntryValue)

	updatedSecret := `Contrary to popular belief, Lorem Ipsum is not simply
		random text. It has roots in a piece of classical Latin literature
		from 45 BC, making it over 2000 years old.`
	putArg = keybase1.PutKVEntryArg{
		SessionID:  0,
		TeamName:   teamName,
		Namespace:  namespace,
		EntryKey:   entryKey,
		EntryValue: updatedSecret,
	}
	putRes, err = handler.PutKVEntry(ctx, putArg)
	require.NoError(t, err)
	require.Equal(t, 2, putRes.Revision)
	getRes, err = handler.GetKVEntry(ctx, getArg)
	require.NoError(t, err)
	require.Equal(t, updatedSecret, getRes.EntryValue)
}

func TestKvStoreMultiUserTeam(t *testing.T) {
	tcAlice := kvTestSetup(t)
	defer tcAlice.Cleanup()
	tcBob := kvTestSetup(t)
	defer tcBob.Cleanup()
	ctx := context.Background()

	alice, err := kbtest.CreateAndSignupFakeUser("kvsA", tcAlice.G)
	require.NoError(t, err)
	aliceHandler := NewKVStoreHandler(nil, tcAlice.G)
	bob, err := kbtest.CreateAndSignupFakeUser("kvsB", tcBob.G)
	require.NoError(t, err)
	bobHandler := NewKVStoreHandler(nil, tcBob.G)

	teamName := alice.Username + "t"
	_, err = teams.CreateRootTeam(context.Background(), tcAlice.G, teamName, keybase1.TeamSettings{})
	require.NoError(t, err)
	_, err = teams.AddMember(context.Background(), tcAlice.G, teamName, bob.Username, keybase1.TeamRole_WRITER, nil)
	require.NoError(t, err)

	// Alice puts a secret
	namespace := "myapp"
	entryKey := "asdfasfeasef"
	secretData := map[string]interface{}{
		"username":      "hunter2",
		"email":         "thereal@example.com",
		"password":      "super random password",
		"OTP":           "otp secret",
		"twoFactorAuth": "not-really-anymore",
	}
	cleartextSecret, err := json.Marshal(secretData)
	require.NoError(t, err)
	putArg := keybase1.PutKVEntryArg{
		SessionID:  0,
		TeamName:   teamName,
		Namespace:  namespace,
		EntryKey:   entryKey,
		EntryValue: string(cleartextSecret),
	}
	putRes, err := aliceHandler.PutKVEntry(ctx, putArg)
	require.NoError(t, err)
	require.Equal(t, 1, putRes.Revision)

	// Bob can read it
	getArg := keybase1.GetKVEntryArg{
		TeamName:  teamName,
		Namespace: namespace,
		EntryKey:  entryKey,
	}
	getRes, err := bobHandler.GetKVEntry(ctx, getArg)
	require.NoError(t, err)
	require.Equal(t, string(cleartextSecret), getRes.EntryValue)
	require.Equal(t, 1, getRes.Revision)

	// Alice kicks bob out of the team.
	err = teams.RemoveMember(ctx, tcAlice.G, teamName, bob.Username)
	require.NoError(t, err)

	// Bob cannot read the entry anymore.
	getRes, err = bobHandler.GetKVEntry(ctx, getArg)
	require.Error(t, err)
	require.IsType(t, err, libkb.AppStatusError{})
	aerr, _ := err.(libkb.AppStatusError)
	if aerr.Code != libkb.SCTeamBadMembership {
		t.Fatalf("expected an SCTeamBadMembership error but got %v", err)
	}
}
