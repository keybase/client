package teams

import (
	"context"
	"testing"

	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

func TestRotate(t *testing.T) {
	tc, owner, other, _, name := memberSetupMultiple(t)
	defer tc.Cleanup()

	if err := SetRoleWriter(context.TODO(), tc.G, name, other.Username); err != nil {
		t.Fatal(err)
	}

	team, err := GetForTeamManagementByStringName(context.TODO(), tc.G, name)
	if err != nil {
		t.Fatal(err)
	}
	if team.Box.Generation != 1 {
		t.Fatalf("initial team generation: %d, expected 1", team.Box.Generation)
	}
	ctextInitial := team.Box.Ctext
	keys1, err := team.AllApplicationKeys(context.TODO(), keybase1.TeamApplication_CHAT)
	if err != nil {
		t.Fatal(err)
	}
	require.Equal(t, len(keys1), 1)
	require.Equal(t, keys1[0].KeyGeneration, keybase1.PerTeamKeyGeneration(1))

	if err := team.Rotate(context.TODO()); err != nil {
		t.Fatal(err)
	}

	after, err := GetForTeamManagementByStringName(context.TODO(), tc.G, name)
	if err != nil {
		t.Fatal(err)
	}
	if after.Box.Generation != 2 {
		t.Fatalf("rotated team generation: %d, expected 2", after.Box.Generation)
	}
	if after.Box.Ctext == ctextInitial {
		t.Fatal("TeamBox.Ctext did not change when rotated")
	}

	assertRole(tc, name, owner.Username, keybase1.TeamRole_OWNER)
	assertRole(tc, name, other.Username, keybase1.TeamRole_WRITER)

	keys2, err := after.AllApplicationKeys(context.TODO(), keybase1.TeamApplication_CHAT)
	require.NoError(t, err)
	require.Equal(t, len(keys2), 2)
	require.Equal(t, keys2[0].KeyGeneration, keybase1.PerTeamKeyGeneration(1))
	require.Equal(t, keys1[0].Key, keys2[0].Key)
}

func TestHandleRotateRequestOldGeneration(t *testing.T) {
	tc, owner, other, _, name := memberSetupMultiple(t)
	defer tc.Cleanup()

	if err := SetRoleWriter(context.TODO(), tc.G, name, other.Username); err != nil {
		t.Fatal(err)
	}

	team, err := GetForTeamManagementByStringName(context.TODO(), tc.G, name)
	if err != nil {
		t.Fatal(err)
	}

	// rotate to bump the generation
	if err := team.Rotate(context.TODO()); err != nil {
		t.Fatal(err)
	}

	team, err = GetForTeamManagementByStringName(context.TODO(), tc.G, name)
	if err != nil {
		t.Fatal(err)
	}
	if team.Box.Generation != 2 {
		t.Fatalf("team generation: %d, expected 2", team.Box.Generation)
	}
	ctextInitial := team.Box.Ctext

	// this shouldn't do anything
	if err := HandleRotateRequest(context.TODO(), tc.G, team.ID, 1); err != nil {
		t.Fatal(err)
	}

	after, err := GetForTeamManagementByStringName(context.TODO(), tc.G, name)
	if err != nil {
		t.Fatal(err)
	}
	if after.Box.Generation != 2 {
		t.Fatalf("HandleRotateRequest with old generation changed team generation: %d, expected 2", after.Box.Generation)
	}
	if after.Box.Ctext != ctextInitial {
		t.Fatal("TeamBox.Ctext changed after HandleRotateRequest with old generation")
	}

	assertRole(tc, name, owner.Username, keybase1.TeamRole_OWNER)
	assertRole(tc, name, other.Username, keybase1.TeamRole_WRITER)
}

func TestHandleRotateRequest(t *testing.T) {
	tc, owner, other, _, name := memberSetupMultiple(t)
	defer tc.Cleanup()

	if err := SetRoleWriter(context.TODO(), tc.G, name, other.Username); err != nil {
		t.Fatal(err)
	}

	team, err := GetForTeamManagementByStringName(context.TODO(), tc.G, name)
	if err != nil {
		t.Fatal(err)
	}
	if team.Box.Generation != 1 {
		t.Fatalf("initial team generation: %d, expected 1", team.Box.Generation)
	}
	ctextInitial := team.Box.Ctext

	if err := HandleRotateRequest(context.TODO(), tc.G, team.ID, team.Box.Generation); err != nil {
		t.Fatal(err)
	}

	after, err := GetForTeamManagementByStringName(context.TODO(), tc.G, name)
	if err != nil {
		t.Fatal(err)
	}
	if after.Box.Generation != 2 {
		t.Fatalf("rotated team generation: %d, expected 2", after.Box.Generation)
	}
	if after.Box.Ctext == ctextInitial {
		t.Fatal("TeamBox.Ctext did not change when rotated")
	}

	assertRole(tc, name, owner.Username, keybase1.TeamRole_OWNER)
	assertRole(tc, name, other.Username, keybase1.TeamRole_WRITER)
}
