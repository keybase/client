package teams

import (
	"context"
	"testing"

	"github.com/keybase/client/go/protocol/keybase1"
)

func TestRotate(t *testing.T) {
	tc, owner, other, name := memberSetupMultiple(t)
	defer tc.Cleanup()

	if err := SetRoleWriter(context.TODO(), tc.G, name, other.Username); err != nil {
		t.Fatal(err)
	}

	team, err := Get(context.TODO(), tc.G, name)
	if err != nil {
		t.Fatal(err)
	}
	if team.Box.Generation != 1 {
		t.Fatalf("initial team generation: %d, expected 1", team.Box.Generation)
	}
	ctextInitial := team.Box.Ctext

	if err := team.Rotate(context.TODO()); err != nil {
		t.Fatal(err)
	}

	after, err := Get(context.TODO(), tc.G, name)
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

func TestHandleRotateRequest(t *testing.T) {
	tc, owner, other, name := memberSetupMultiple(t)
	defer tc.Cleanup()

	if err := SetRoleWriter(context.TODO(), tc.G, name, other.Username); err != nil {
		t.Fatal(err)
	}

	team, err := Get(context.TODO(), tc.G, name)
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

	after, err := Get(context.TODO(), tc.G, name)
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
