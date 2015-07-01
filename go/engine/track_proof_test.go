package engine

import (
	"fmt"
	"sort"
	"testing"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/protocol/go"
)

// testing service block
type sb struct {
	social     bool
	id         string
	proofState keybase1.ProofState
}

type sbtest struct {
	name   string
	blocks []sb
}

type byID []*libkb.ServiceBlock

func (b byID) Len() int           { return len(b) }
func (b byID) Less(x, y int) bool { return b[x].ToIDString() < b[y].ToIDString() }
func (b byID) Swap(x, y int)      { b[x], b[y] = b[y], b[x] }

// these aren't that interesting since all the proof states are
// the same, but it does some basic testing of the service blocks
// in a TrackChainLink.
var sbtests = []sbtest{
	{name: "t_alice", blocks: []sb{
		{social: true, id: "kbtester2@github", proofState: keybase1.ProofState_OK},
		{social: true, id: "tacovontaco@twitter", proofState: keybase1.ProofState_OK},
	}},
	{name: "t_bob", blocks: []sb{
		{social: true, id: "kbtester1@github", proofState: keybase1.ProofState_OK},
		{social: true, id: "kbtester1@twitter", proofState: keybase1.ProofState_OK},
	}},
	{name: "t_charlie", blocks: []sb{
		{social: true, id: "tacoplusplus@github", proofState: keybase1.ProofState_OK},
		{social: true, id: "tacovontaco@twitter", proofState: keybase1.ProofState_OK},
	}},
	{name: "t_doug", blocks: []sb{
		{social: true, id: "kbtester1@github", proofState: keybase1.ProofState_OK},
		{social: true, id: "kbtester1@twitter", proofState: keybase1.ProofState_OK},
	}},
}

func TestTrackServiceBlocks(t *testing.T) {
	tc := SetupEngineTest(t, "track")
	defer tc.Cleanup()
	fu := CreateAndSignupFakeUser(tc, "track")

	for _, test := range sbtests {
		_, them, err := runTrack(tc, fu, test.name)
		if err != nil {
			t.Errorf("%s: runTrack err: %s", test.name, err)
			continue
		}
		defer runUntrack(tc.G, fu, test.name)

		me, err := libkb.LoadMe(libkb.LoadUserArg{})
		if err != nil {
			t.Errorf("%s: LoadMe err: %s", test.name, err)
			continue
		}
		s, err := me.TrackChainLinkFor(them.GetName(), them.GetUID())
		if err != nil {
			t.Errorf("%s: TrackChainLinkFor err: %s", test.name, err)
			continue
		}

		sbs := s.ToServiceBlocks()
		sort.Sort(byID(sbs))
		for i, sb := range sbs {
			fmt.Printf("service block: %+v (%T)\n", sb, sb)
			tsb := test.blocks[i]
			if sb.IsSocial() != tsb.social {
				t.Errorf("%s (sb %d): social: %v, expected %v", test.name, i, sb.IsSocial(), tsb.social)
			}
			if sb.ToIDString() != tsb.id {
				t.Errorf("%s (sb %d): id: %s, expected %s", test.name, i, sb.ToIDString(), tsb.id)
			}
			if sb.GetProofState() != tsb.proofState {
				t.Errorf("%s (sb %d): proof state: %d, expected %d", test.name, i, sb.GetProofState(), tsb.proofState)
			}
		}
	}
}

// track a user that has no proofs
func TestTrackNoProofs(t *testing.T) {
	tc := SetupEngineTest(t, "track")
	defer tc.Cleanup()

	// create a user with no proofs
	proofUser := CreateAndSignupFakeUser(tc, "proof")
	Logout(tc)

	// create a user to track the proofUser
	trackUser := CreateAndSignupFakeUser(tc, "track")
	_, them, err := runTrack(tc, trackUser, proofUser.Username)
	if err != nil {
		t.Fatal(err)
	}

	me, err := libkb.LoadMe(libkb.LoadUserArg{})
	if err != nil {
		t.Fatal(err)
	}
	s, err := me.TrackChainLinkFor(them.GetName(), them.GetUID())
	if err != nil {
		t.Fatal(err)
	}

	sbs := s.ToServiceBlocks()
	if len(sbs) != 0 {
		t.Fatalf("num service blocks: %d, expected 0", len(sbs))
	}
}

// track a user that has a rooter proof, check the tracking
// statement for correctness.
func TestTrackProofRooter(t *testing.T) {
	tc := SetupEngineTest(t, "track")
	defer tc.Cleanup()

	// create a user with a rooter proof
	proofUser := CreateAndSignupFakeUser(tc, "proof")
	_, err := proveRooter(tc.G, proofUser)
	if err != nil {
		t.Fatal(err)
	}
	Logout(tc)

	// create a user to track the proofUser
	trackUser := CreateAndSignupFakeUser(tc, "track")
	_, them, err := runTrack(tc, trackUser, proofUser.Username)
	if err != nil {
		t.Fatal(err)
	}

	me, err := libkb.LoadMe(libkb.LoadUserArg{})
	if err != nil {
		t.Fatal(err)
	}
	s, err := me.TrackChainLinkFor(them.GetName(), them.GetUID())
	if err != nil {
		t.Fatal(err)
	}

	sbs := s.ToServiceBlocks()
	if len(sbs) != 1 {
		t.Fatalf("num service blocks: %d, expected 1", len(sbs))
	}
	sb := sbs[0]
	if !sb.IsSocial() {
		t.Errorf("service block not social, expected it to be")
	}
	if sb.ToIDString() != proofUser.Username+"@rooter" {
		t.Errorf("id string: %s, expected %s@rooter", sb.ToIDString(), proofUser.Username)
	}
	if sb.GetProofState() != keybase1.ProofState_OK {
		t.Errorf("proof state: %d, expected %d", sb.GetProofState(), keybase1.ProofState_OK)
	}
}

// upgrade tracking statement when new proof is added:
// track a user that has no proofs, then track them again after they add a proof
func TestTrackUpgrade(t *testing.T) {
	tc := SetupEngineTest(t, "track")
	defer tc.Cleanup()

	// create a user with no proofs
	proofUser := CreateAndSignupFakeUser(tc, "proof")
	Logout(tc)

	// create a user to track the proofUser
	trackUser := CreateAndSignupFakeUser(tc, "track")
	_, them, err := runTrack(tc, trackUser, proofUser.Username)
	if err != nil {
		t.Fatal(err)
	}

	me, err := libkb.LoadMe(libkb.LoadUserArg{})
	if err != nil {
		t.Fatal(err)
	}
	s, err := me.TrackChainLinkFor(them.GetName(), them.GetUID())
	if err != nil {
		t.Fatal(err)
	}

	sbs := s.ToServiceBlocks()
	if len(sbs) != 0 {
		t.Fatalf("num service blocks: %d, expected 0", len(sbs))
	}

	// proofUser adds a rooter proof:
	Logout(tc)
	proofUser.LoginOrBust(tc)
	_, err = proveRooter(tc.G, proofUser)
	if err != nil {
		t.Fatal(err)
	}
	Logout(tc)

	// trackUser tracks proofUser again:
	trackUser.LoginOrBust(tc)
	ui, them, err := runTrack(tc, trackUser, proofUser.Username)
	if err != nil {
		t.Fatal(err)
	}

	me, err = libkb.LoadMe(libkb.LoadUserArg{})
	if err != nil {
		t.Fatal(err)
	}
	s, err = me.TrackChainLinkFor(them.GetName(), them.GetUID())
	if err != nil {
		t.Fatal(err)
	}

	sbs = s.ToServiceBlocks()
	if len(sbs) != 1 {
		t.Fatalf("num service blocks: %d, expected 1", len(sbs))
	}
	sb := sbs[0]
	if !sb.IsSocial() {
		t.Errorf("service block not social, expected it to be")
	}
	if sb.ToIDString() != proofUser.Username+"@rooter" {
		t.Errorf("id string: %s, expected %s@rooter", sb.ToIDString(), proofUser.Username)
	}
	if sb.GetProofState() != keybase1.ProofState_OK {
		t.Errorf("proof state: %d, expected %d", sb.GetProofState(), keybase1.ProofState_OK)
	}

	if ui.Outcome.TrackStatus != keybase1.TrackStatus_UPDATE_NEW_PROOFS {
		t.Errorf("track status: %d, expected %d", ui.Outcome.TrackStatus, keybase1.TrackStatus_UPDATE_NEW_PROOFS)
		t.Logf("outcome: %+v", ui.Outcome)
	}
}
