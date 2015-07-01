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

func checkTrack(tc libkb.TestContext, fu *FakeUser, username string, blocks []sb, status keybase1.TrackStatus) error {
	ui, them, err := runTrack(tc, fu, username)
	if err != nil {
		return err
	}

	me, err := libkb.LoadMe(libkb.LoadUserArg{})
	if err != nil {
		return err
	}
	s, err := me.TrackChainLinkFor(them.GetName(), them.GetUID())
	if err != nil {
		return err
	}

	sbs := s.ToServiceBlocks()
	if len(sbs) != len(blocks) {
		return fmt.Errorf("num service blocks: %d, expected %d", len(sbs), len(blocks))
	}
	sort.Sort(byID(sbs))
	for i, sb := range sbs {
		tsb := blocks[i]
		if sb.IsSocial() != tsb.social {
			return fmt.Errorf("(sb %d): social: %v, expected %v", i, sb.IsSocial(), tsb.social)
		}
		if sb.ToIDString() != tsb.id {
			return fmt.Errorf("(sb %d): id: %s, expected %s", i, sb.ToIDString(), tsb.id)
		}
		if sb.GetProofState() != tsb.proofState {
			return fmt.Errorf("(sb %d): proof state: %d, expected %d", i, sb.GetProofState(), tsb.proofState)
		}
	}

	if ui.Outcome.TrackStatus != status {
		return fmt.Errorf("track status: %d, expected %d", ui.Outcome.TrackStatus, status)
	}

	return nil
}

type byID []*libkb.ServiceBlock

func (b byID) Len() int           { return len(b) }
func (b byID) Less(x, y int) bool { return b[x].ToIDString() < b[y].ToIDString() }
func (b byID) Swap(x, y int)      { b[x], b[y] = b[y], b[x] }

type sbtest struct {
	name   string
	blocks []sb
	status keybase1.TrackStatus
}

// these aren't that interesting since all the proof states are
// the same, but it does some basic testing of the service blocks
// in a TrackChainLink.
var sbtests = []sbtest{
	{
		name: "t_alice",
		blocks: []sb{
			{social: true, id: "kbtester2@github", proofState: keybase1.ProofState_OK},
			{social: true, id: "tacovontaco@twitter", proofState: keybase1.ProofState_OK},
		},
		status: keybase1.TrackStatus_NEW_OK,
	},
	{
		name: "t_bob",
		blocks: []sb{
			{social: true, id: "kbtester1@github", proofState: keybase1.ProofState_OK},
			{social: true, id: "kbtester1@twitter", proofState: keybase1.ProofState_OK},
		},
		status: keybase1.TrackStatus_NEW_OK,
	},
	{
		name: "t_charlie",
		blocks: []sb{
			{social: true, id: "tacoplusplus@github", proofState: keybase1.ProofState_OK},
			{social: true, id: "tacovontaco@twitter", proofState: keybase1.ProofState_OK},
		},
		status: keybase1.TrackStatus_NEW_OK,
	},
	{
		name:   "t_doug",
		status: keybase1.TrackStatus_NEW_ZERO_PROOFS,
	},
}

func TestTrackProofServiceBlocks(t *testing.T) {
	tc := SetupEngineTest(t, "track")
	defer tc.Cleanup()
	fu := CreateAndSignupFakeUser(tc, "track")

	for _, test := range sbtests {
		err := checkTrack(tc, fu, test.name, test.blocks, test.status)
		if err != nil {
			t.Errorf("%s: %s", test.name, err)
		}
		runUntrack(tc.G, fu, test.name)
	}
}

// track a user that has no proofs
func TestTrackProofZero(t *testing.T) {
	tc := SetupEngineTest(t, "track")
	defer tc.Cleanup()

	// create a user with no proofs
	proofUser := CreateAndSignupFakeUser(tc, "proof")
	Logout(tc)

	// create a user to track the proofUser
	trackUser := CreateAndSignupFakeUser(tc, "track")

	err := checkTrack(tc, trackUser, proofUser.Username, nil, keybase1.TrackStatus_NEW_ZERO_PROOFS)
	if err != nil {
		t.Fatal(err)
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

	rbl := sb{
		social:     true,
		id:         proofUser.Username + "@rooter",
		proofState: keybase1.ProofState_OK,
	}
	err = checkTrack(tc, trackUser, proofUser.Username, []sb{rbl}, keybase1.TrackStatus_NEW_OK)
	if err != nil {
		t.Fatal(err)
	}

	// retrack, check the track status
	err = checkTrack(tc, trackUser, proofUser.Username, []sb{rbl}, keybase1.TrackStatus_UPDATE_OK)
	if err != nil {
		t.Fatal(err)
	}
}

// upgrade tracking statement when new proof is added:
// track a user that has no proofs, then track them again after they add a proof
func TestTrackProofUpgrade(t *testing.T) {
	tc := SetupEngineTest(t, "track")
	defer tc.Cleanup()

	// create a user with no proofs
	proofUser := CreateAndSignupFakeUser(tc, "proof")
	Logout(tc)

	// create a user to track the proofUser
	trackUser := CreateAndSignupFakeUser(tc, "track")
	err := checkTrack(tc, trackUser, proofUser.Username, nil, keybase1.TrackStatus_NEW_ZERO_PROOFS)
	if err != nil {
		t.Fatal(err)
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

	rbl := sb{
		social:     true,
		id:         proofUser.Username + "@rooter",
		proofState: keybase1.ProofState_OK,
	}
	err = checkTrack(tc, trackUser, proofUser.Username, []sb{rbl}, keybase1.TrackStatus_UPDATE_NEW_PROOFS)
	if err != nil {
		t.Fatal(err)
	}
}

// test a change to a proof
func TestTrackProofChangeSinceTrack(t *testing.T) {
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

	rbl := sb{
		social:     true,
		id:         proofUser.Username + "@rooter",
		proofState: keybase1.ProofState_OK,
	}
	err = checkTrack(tc, trackUser, proofUser.Username, []sb{rbl}, keybase1.TrackStatus_NEW_OK)
	if err != nil {
		t.Fatal(err)
	}

	Logout(tc)

	// proof user logs in and does a new rooter proof
	proofUser.LoginOrBust(tc)
	_, err = proveRooter(tc.G, proofUser)
	if err != nil {
		t.Fatal(err)
	}
	Logout(tc)

	// track user logs in and tracks proof user again
	trackUser.LoginOrBust(tc)
	err = checkTrack(tc, trackUser, proofUser.Username, []sb{rbl}, keybase1.TrackStatus_NEW_OK)
	if err != nil {
		t.Fatal(err)
	}
}
