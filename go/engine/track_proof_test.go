// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"fmt"
	"sort"
	"testing"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

// testing service block
type sb struct {
	social     bool
	id         string
	proofState keybase1.ProofState
}

func checkTrack(tc libkb.TestContext, fu *FakeUser, username string, blocks []sb, outcome *keybase1.IdentifyOutcome) error {
	ui, them, err := runTrack(tc, fu, username)
	if err != nil {
		return err
	}
	return checkTrackCommon(tc, blocks, outcome, them, ui)
}

func checkTrackForce(tc libkb.TestContext, fu *FakeUser, username string, blocks []sb, outcome *keybase1.IdentifyOutcome) error {
	ui, them, err := runTrackWithOptions(tc, fu, username, keybase1.TrackOptions{BypassConfirm: true}, fu.NewSecretUI(), true)
	if err != nil {
		return err
	}
	return checkTrackCommon(tc, blocks, outcome, them, ui)
}

func checkTrackCommon(tc libkb.TestContext, blocks []sb, outcome *keybase1.IdentifyOutcome, them *libkb.User, ui *FakeIdentifyUI) error {
	me, err := libkb.LoadMe(libkb.NewLoadUserArg(tc.G))
	if err != nil {
		return err
	}
	if them == nil {
		tc.T.Fatal("checkTrackCommon called with nil 'them' user")
	}
	s, err := me.TrackChainLinkFor(them.GetNormalizedName(), them.GetUID())
	if err != nil {
		return err
	}

	if s == nil {
		tc.T.Fatal("me.TrackChainLinkFor(...) returned nil, nil")
	}
	tc.T.Logf("payload json:\n%s", s.GetPayloadJSON().MarshalPretty())

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

	if ui.Outcome.TrackStatus != outcome.TrackStatus {
		return fmt.Errorf("track status: %d, expected %d", ui.Outcome.TrackStatus, outcome.TrackStatus)
	}

	if ui.Outcome.NumTrackFailures != outcome.NumTrackFailures {
		return fmt.Errorf("num track failures: %d, expected %d", ui.Outcome.NumTrackFailures, outcome.NumTrackFailures)
	}
	if ui.Outcome.NumTrackChanges != outcome.NumTrackChanges {
		return fmt.Errorf("num track changes: %d, expected %d", ui.Outcome.NumTrackChanges, outcome.NumTrackChanges)
	}
	if ui.Outcome.NumProofFailures != outcome.NumProofFailures {
		return fmt.Errorf("num proof failures: %d, expected %d", ui.Outcome.NumProofFailures, outcome.NumProofFailures)
	}
	if ui.Outcome.NumProofSuccesses != outcome.NumProofSuccesses {
		return fmt.Errorf("num proof successes: %d, expected %d", ui.Outcome.NumProofSuccesses, outcome.NumProofSuccesses)
	}
	if ui.Outcome.NumRevoked != outcome.NumRevoked {
		return fmt.Errorf("num revoked: %d, expected %d", ui.Outcome.NumRevoked, outcome.NumRevoked)
	}

	return nil
}

type byID []*libkb.ServiceBlock

func (b byID) Len() int           { return len(b) }
func (b byID) Less(x, y int) bool { return b[x].ToIDString() < b[y].ToIDString() }
func (b byID) Swap(x, y int)      { b[x], b[y] = b[y], b[x] }

type sbtest struct {
	name    string
	blocks  []sb
	outcome keybase1.IdentifyOutcome
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
		outcome: keybase1.IdentifyOutcome{
			NumProofSuccesses: 2,
			TrackStatus:       keybase1.TrackStatus_NEW_OK,
		},
	},
	{
		name: "t_bob",
		blocks: []sb{
			{social: true, id: "kbtester1@github", proofState: keybase1.ProofState_OK},
			{social: true, id: "kbtester1@twitter", proofState: keybase1.ProofState_OK},
		},
		outcome: keybase1.IdentifyOutcome{
			NumProofSuccesses: 2,
			TrackStatus:       keybase1.TrackStatus_NEW_OK,
		},
	},
	{
		name: "t_charlie",
		blocks: []sb{
			{social: true, id: "tacoplusplus@github", proofState: keybase1.ProofState_OK},
			{social: true, id: "tacovontaco@twitter", proofState: keybase1.ProofState_OK},
		},
		outcome: keybase1.IdentifyOutcome{
			NumProofSuccesses: 2,
			TrackStatus:       keybase1.TrackStatus_NEW_OK,
		},
	},
	{
		name: "t_doug",
		outcome: keybase1.IdentifyOutcome{
			TrackStatus: keybase1.TrackStatus_NEW_ZERO_PROOFS,
		},
	},
}

func TestTrackProofServiceBlocks(t *testing.T) {
	tc := SetupEngineTest(t, "track")
	defer tc.Cleanup()
	fu := CreateAndSignupFakeUser(tc, "track")

	for _, test := range sbtests {
		err := checkTrack(tc, fu, test.name, test.blocks, &test.outcome)
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

	outcome := keybase1.IdentifyOutcome{
		TrackStatus: keybase1.TrackStatus_NEW_ZERO_PROOFS,
	}
	err := checkTrack(tc, trackUser, proofUser.Username, nil, &outcome)
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
	_, _, err := proveRooter(tc.G, proofUser)
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
	outcome := keybase1.IdentifyOutcome{
		NumProofSuccesses: 1,
		TrackStatus:       keybase1.TrackStatus_NEW_OK,
	}
	err = checkTrack(tc, trackUser, proofUser.Username, []sb{rbl}, &outcome)
	if err != nil {
		t.Fatal(err)
	}

	// retrack, check the track status
	outcome.TrackStatus = keybase1.TrackStatus_UPDATE_OK
	err = checkTrack(tc, trackUser, proofUser.Username, []sb{rbl}, &outcome)
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
	outcome := keybase1.IdentifyOutcome{
		TrackStatus: keybase1.TrackStatus_NEW_ZERO_PROOFS,
	}
	err := checkTrack(tc, trackUser, proofUser.Username, nil, &outcome)
	if err != nil {
		t.Fatal(err)
	}

	// proofUser adds a rooter proof:
	Logout(tc)
	proofUser.LoginOrBust(tc)
	_, _, err = proveRooter(tc.G, proofUser)
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
	outcome = keybase1.IdentifyOutcome{
		NumTrackChanges:   1,
		NumProofSuccesses: 1,
		TrackStatus:       keybase1.TrackStatus_UPDATE_NEW_PROOFS,
	}
	err = checkTrack(tc, trackUser, proofUser.Username, []sb{rbl}, &outcome)
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
	_, _, err := proveRooter(tc.G, proofUser)
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
	outcome := keybase1.IdentifyOutcome{
		NumProofSuccesses: 1,
		TrackStatus:       keybase1.TrackStatus_NEW_OK,
	}
	err = checkTrack(tc, trackUser, proofUser.Username, []sb{rbl}, &outcome)
	if err != nil {
		t.Fatal(err)
	}

	Logout(tc)

	// proof user logs in and does a new rooter proof
	proofUser.LoginOrBust(tc)
	_, _, err = proveRooter(tc.G, proofUser)
	if err != nil {
		t.Fatal(err)
	}
	Logout(tc)

	// track user logs in and tracks proof user again
	trackUser.LoginOrBust(tc)
	outcome.TrackStatus = keybase1.TrackStatus_UPDATE_OK
	err = checkTrack(tc, trackUser, proofUser.Username, []sb{rbl}, &outcome)
	if err != nil {
		t.Fatal(err)
	}
}

// track a user that has a failed rooter proof
func TestTrackProofRooterFail(t *testing.T) {
	tc := SetupEngineTest(t, "track")
	defer tc.Cleanup()

	// create a user with a rooter proof
	proofUser := CreateAndSignupFakeUser(tc, "proof")
	_, err := proveRooterFail(tc.G, proofUser)
	if err == nil {
		t.Fatal("should have been an error")
	}
	Logout(tc)

	// create a user to track the proofUser
	trackUser := CreateAndSignupFakeUser(tc, "track")

	// proveRooterFail posts a bad sig id, so it won't be found.
	// thus the state is ProofState_SIG_HINT_MISSING
	rbl := sb{
		social:     true,
		id:         proofUser.Username + "@rooter",
		proofState: keybase1.ProofState_SIG_HINT_MISSING,
	}
	outcome := keybase1.IdentifyOutcome{
		NumProofFailures: 1,
		TrackStatus:      keybase1.TrackStatus_NEW_ZERO_PROOFS,
	}
	// and they have no proofs
	err = checkTrack(tc, trackUser, proofUser.Username, []sb{rbl}, &outcome)
	if err != nil {
		t.Fatal(err)
	}
}

// track a user that has a rooter proof, remove the proof, then
// track again.
// Note that the API server won't notice that the rooter proof has
// been removed as it only checks every 12 hours.  The client will
// notice and should generate an appropriate tracking statement.
func TestTrackProofRooterRemove(t *testing.T) {
	tc := SetupEngineTest(t, "track")
	defer tc.Cleanup()

	// create a user with a rooter proof
	proofUser := CreateAndSignupFakeUser(tc, "proof")
	ui, _, err := proveRooter(tc.G, proofUser)
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
	outcome := keybase1.IdentifyOutcome{
		NumProofSuccesses: 1,
		TrackStatus:       keybase1.TrackStatus_NEW_OK,
	}
	err = checkTrack(tc, trackUser, proofUser.Username, []sb{rbl}, &outcome)
	if err != nil {
		t.Fatal(err)
	}

	// remove the rooter proof
	Logout(tc)
	proofUser.LoginOrBust(tc)
	if err := proveRooterRemove(tc.G, ui.postID); err != nil {
		t.Fatal(err)
	}
	Logout(tc)

	// track again
	trackUser.LoginOrBust(tc)
	rbl.proofState = keybase1.ProofState_TEMP_FAILURE
	outcome = keybase1.IdentifyOutcome{
		NumTrackFailures: 1,
		NumTrackChanges:  1,
		NumProofFailures: 1,
		TrackStatus:      keybase1.TrackStatus_UPDATE_BROKEN_FAILED_PROOFS,
	}
	// use checkTrackForce to skip any proof cache results
	err = checkTrackForce(tc, trackUser, proofUser.Username, []sb{rbl}, &outcome)
	if err != nil {
		t.Fatal(err)
	}

	// check that it is "fixed"
	outcome = keybase1.IdentifyOutcome{
		NumProofFailures: 1,
		TrackStatus:      keybase1.TrackStatus_UPDATE_OK,
	}
	err = checkTrack(tc, trackUser, proofUser.Username, []sb{rbl}, &outcome)
	if err != nil {
		t.Fatal(err)
	}
}

// test tracking a user who revokes a proof.  Revoking a proof
// removes it from the sig chain, so this tests the
// libkb.IdentifyState.ComputeRevokedProofs() function, and how
// libkb.IdentifyOutcome.TrackStatus() interprets the result.
func TestTrackProofRooterRevoke(t *testing.T) {
	tc := SetupEngineTest(t, "track")
	defer tc.Cleanup()

	// create a user with a rooter proof
	proofUser := CreateAndSignupFakeUser(tc, "proof")
	_, sigID, err := proveRooter(tc.G, proofUser)
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
	outcome := keybase1.IdentifyOutcome{
		NumProofSuccesses: 1,
		TrackStatus:       keybase1.TrackStatus_NEW_OK,
	}
	err = checkTrack(tc, trackUser, proofUser.Username, []sb{rbl}, &outcome)
	if err != nil {
		t.Fatal(err)
	}

	// revoke the rooter proof
	Logout(tc)
	proofUser.LoginOrBust(tc)
	revEng := NewRevokeSigsEngine([]string{sigID.ToString(true)}, tc.G)
	ctx := &Context{
		LogUI:    tc.G.UI.GetLogUI(),
		SecretUI: proofUser.NewSecretUI(),
	}

	if err := revEng.Run(ctx); err != nil {
		t.Fatal(err)
	}
	Logout(tc)

	// track proofUser again and check revoked proof handled correctly
	trackUser.LoginOrBust(tc)
	outcome = keybase1.IdentifyOutcome{
		NumRevoked:  1,
		TrackStatus: keybase1.TrackStatus_UPDATE_BROKEN_REVOKED,
	}
	err = checkTrack(tc, trackUser, proofUser.Username, nil, &outcome)
	if err != nil {
		t.Fatal(err)
	}

	// track again and check for fix
	outcome = keybase1.IdentifyOutcome{
		TrackStatus: keybase1.TrackStatus_UPDATE_OK,
	}
	err = checkTrack(tc, trackUser, proofUser.Username, nil, &outcome)
	if err != nil {
		t.Fatal(err)
	}
}

// proofUser makes a user@rooter proof, then a user2@rooter proof.
// trackUser tracks proofUser.  Verify the tracking statement.
func TestTrackProofRooterOther(t *testing.T) {
	tc := SetupEngineTest(t, "track")
	defer tc.Cleanup()

	// create a user with a rooter proof
	proofUser := CreateAndSignupFakeUser(tc, "proof")
	_, _, err := proveRooter(tc.G, proofUser)
	if err != nil {
		t.Fatal(err)
	}
	Logout(tc)

	// post a rooter proof as a different rooter user
	proofUserOther := CreateAndSignupFakeUser(tc, "proof")
	Logout(tc)
	proofUser.LoginOrBust(tc)
	_, _, err = proveRooterOther(tc.G, proofUser, proofUserOther.Username)
	if err != nil {
		t.Fatal(err)
	}
	Logout(tc)

	// create a user to track the proofUser
	trackUser := CreateAndSignupFakeUser(tc, "track")

	rbl := sb{
		social:     true,
		id:         proofUserOther.Username + "@rooter",
		proofState: keybase1.ProofState_OK,
	}
	outcome := keybase1.IdentifyOutcome{
		NumProofSuccesses: 1,
		TrackStatus:       keybase1.TrackStatus_NEW_OK,
	}
	err = checkTrack(tc, trackUser, proofUser.Username, []sb{rbl}, &outcome)
	if err != nil {
		t.Fatal(err)
	}
}

// proofUser makes a user@rooter proof, trackUser tracks
// proofUser.  proofUser makes a user2@rooter proof, trackUser
// tracks proofUser again.  Test that the change is noticed.
func TestTrackProofRooterChange(t *testing.T) {
	tc := SetupEngineTest(t, "track")
	defer tc.Cleanup()

	// create a user with a rooter proof
	proofUser := CreateAndSignupFakeUser(tc, "proof")
	_, _, err := proveRooter(tc.G, proofUser)
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
	outcome := keybase1.IdentifyOutcome{
		NumProofSuccesses: 1,
		TrackStatus:       keybase1.TrackStatus_NEW_OK,
	}
	err = checkTrack(tc, trackUser, proofUser.Username, []sb{rbl}, &outcome)
	if err != nil {
		t.Fatal(err)
	}

	// post a rooter proof as a different rooter user
	Logout(tc)
	proofUserOther := CreateAndSignupFakeUser(tc, "proof")
	Logout(tc)

	proofUser.LoginOrBust(tc)
	_, _, err = proveRooterOther(tc.G, proofUser, proofUserOther.Username)
	if err != nil {
		t.Fatal(err)
	}
	Logout(tc)

	// track proofUser again and check new rooter proof with different account handled correctly
	trackUser.LoginOrBust(tc)
	rbl.id = proofUserOther.Username + "@rooter"
	outcome = keybase1.IdentifyOutcome{
		NumTrackChanges:   1,
		NumTrackFailures:  1,
		NumProofSuccesses: 1,
		TrackStatus:       keybase1.TrackStatus_UPDATE_BROKEN_FAILED_PROOFS,
	}
	err = checkTrack(tc, trackUser, proofUser.Username, []sb{rbl}, &outcome)
	if err != nil {
		t.Fatal(err)
	}

	// track again and check for fix
	outcome = keybase1.IdentifyOutcome{
		NumProofSuccesses: 1,
		TrackStatus:       keybase1.TrackStatus_UPDATE_OK,
	}
	err = checkTrack(tc, trackUser, proofUser.Username, []sb{rbl}, &outcome)
	if err != nil {
		t.Fatal(err)
	}
}

// TODO:
// * get a test that will generate TrackStatus_NEW_FAIL_PROOFS
//   (this requires two services, one with an ok proof, one with a
//   failing proof)
// * test upgrade from http to https, or a secure rooter post vs.
//   regular rooter post to get TrackDiffUpgraded.
// * a test that will generate TrackDiffRemoteChanged
