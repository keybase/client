package teams

import (
	"context"
	"encoding/hex"
	"errors"
	"regexp"
	"sync"
	"testing"

	lru "github.com/hashicorp/golang-lru"
	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

func toErr(attempt keybase1.BoxAuditAttempt) error {
	if attempt.Error != nil {
		return errors.New(*attempt.Error)
	}
	return nil
}

func mustGetJailLRU(tc *libkb.TestContext, a libkb.TeamBoxAuditor) *lru.Cache {
	b := a.(*BoxAuditor)
	return b.jailLRU
}

func countTrues(t *testing.T, cache *lru.Cache) int {
	c := 0
	for _, k := range cache.Keys() {
		v, ok := cache.Get(k)
		require.True(t, ok)
		vBool := v.(bool)
		if vBool {
			c++
		}
	}
	return c
}

func mustGetBoxState(tc *libkb.TestContext, a libkb.TeamBoxAuditor, mctx libkb.MetaContext, teamID keybase1.TeamID) (*BoxAuditLog, *BoxAuditQueue, *BoxAuditJail) {
	b := a.(*BoxAuditor)
	log, err := b.maybeGetLog(mctx, teamID)
	require.NoError(tc.T, err)
	queue, err := b.maybeGetQueue(mctx)
	require.NoError(tc.T, err)
	jail, err := b.maybeGetJail(mctx)
	require.NoError(tc.T, err)
	return log, queue, jail
}

func TestBoxAuditAttempt(t *testing.T) {
	fus, tcs, cleanup := setupNTests(t, 3)
	defer cleanup()

	_, bU, cU := fus[0], fus[1], fus[2]
	aTc, bTc, cTc := tcs[0], tcs[1], tcs[2]
	aM, bM, cM := libkb.NewMetaContextForTest(*aTc), libkb.NewMetaContextForTest(*bTc), libkb.NewMetaContextForTest(*cTc)
	aA, bA, cA := aTc.G.GetTeamBoxAuditor(), bTc.G.GetTeamBoxAuditor(), cTc.G.GetTeamBoxAuditor()

	t.Logf("A creates team")
	teamName, teamID := createTeam2(*aTc)

	t.Logf("adding B as admin")
	_, err := AddMember(aM.Ctx(), aTc.G, teamName.String(), bU.Username, keybase1.TeamRole_ADMIN, nil)
	require.NoError(t, err)

	t.Logf("adding C as reader")
	_, err = AddMember(aM.Ctx(), aTc.G, teamName.String(), cU.Username, keybase1.TeamRole_READER, nil)
	require.NoError(t, err)

	require.NoError(t, toErr(aA.Attempt(aM, teamID, false)), "A can attempt")
	require.NoError(t, toErr(bA.Attempt(aM, teamID, false)), "B can attempt")

	attempt := aA.Attempt(aM, teamID, false)
	require.NoError(t, toErr(attempt))
	require.Equal(t, attempt.Result, keybase1.BoxAuditAttemptResult_OK_VERIFIED, "owner can attempt")
	require.Equal(t, *attempt.Generation, keybase1.PerTeamKeyGeneration(1))

	attempt = bA.Attempt(bM, teamID, false)
	require.NoError(t, toErr(attempt))
	require.Equal(t, attempt.Result, keybase1.BoxAuditAttemptResult_OK_VERIFIED, "admins can attempt")
	require.Equal(t, *attempt.Generation, keybase1.PerTeamKeyGeneration(1))

	attempt = cA.Attempt(cM, teamID, false)
	require.NoError(t, toErr(attempt))
	require.Equal(t, attempt.Result, keybase1.BoxAuditAttemptResult_OK_NOT_ATTEMPTED_ROLE, "readers can attempt but don't verify")
	require.Equal(t, *attempt.Generation, keybase1.PerTeamKeyGeneration(1))

	kbtest.RotatePaper(*cTc, cU)
	attempt = aA.Attempt(aM, teamID, false)
	require.Error(t, toErr(attempt), "team not rotated after puk rotate so attempt fails")
	team, err := Load(context.TODO(), aTc.G, keybase1.LoadTeamArg{Name: teamName.String(), ForceRepoll: true})
	require.NoError(t, err)
	err = team.Rotate(aM.Ctx(), keybase1.RotationType_VISIBLE)
	require.NoError(t, err)
	attempt = aA.Attempt(aM, teamID, false)
	require.NoError(t, toErr(attempt), "team rotated, so audit works")

	t.Logf("check rotate-before-attempt option")
	kbtest.RotatePaper(*cTc, cU)
	attempt = aA.Attempt(aM, teamID, false)
	require.Error(t, toErr(attempt), "team not rotated after puk rotate so attempt fails")
	attempt = aA.Attempt(aM, teamID, true)
	require.NoError(t, toErr(attempt), "rotate-before-attempt option works")

	t.Logf("check after reset")
	kbtest.ResetAccount(*cTc, cU)
	attempt = aA.Attempt(aM, teamID, false)
	require.Error(t, toErr(attempt), "team not rotated after reset")
	attempt = aA.Attempt(aM, teamID, true)
	require.NoError(t, toErr(attempt), "attempt OK after rotate")

	attempt = cA.Attempt(cM, teamID, false)
	require.Error(t, toErr(attempt), "check that someone not in a team cannot audit")

	t.Logf("C provisions and A adds C back after account reset")
	err = cU.Login(cTc.G)
	require.NoError(t, err)
	_, err = AddMember(aM.Ctx(), aTc.G, teamName.String(), cU.Username, keybase1.TeamRole_READER, nil)
	require.NoError(t, err)

	attempt = cA.Attempt(cM, teamID, false)
	require.NoError(t, toErr(attempt), "check that attempt is OK after allow reset member back in without another rotate")

	t.Logf("check after delete")
	kbtest.DeleteAccount(*cTc, cU)
	attempt = aA.Attempt(aM, teamID, false)
	require.Error(t, toErr(attempt), "team not rotated after delete")
	attempt = aA.Attempt(aM, teamID, true)
	require.NoError(t, toErr(attempt), "attempt OK after rotate")
}

func requireFatalError(t *testing.T, err error, args ...interface{}) {
	_, ok := err.(FatalBoxAuditError)
	require.True(t, ok, args...)
}

func requireNonfatalError(t *testing.T, err error, args ...interface{}) {
	_, ok := err.(NonfatalBoxAuditError)
	require.True(t, ok, args...)
}

func requireClientError(t *testing.T, err error, args ...interface{}) {
	_, ok := err.(FatalBoxAuditError)
	require.True(t, ok, args...)
}

func auditTeam(a libkb.TeamBoxAuditor, mctx libkb.MetaContext, teamID keybase1.TeamID) error {
	_, err := a.BoxAuditTeam(mctx, teamID)
	return err
}

func TestBoxAuditAudit(t *testing.T) {
	fus, tcs, cleanup := setupNTests(t, 5)
	defer cleanup()

	_, bU, cU, dU, eU := fus[0], fus[1], fus[2], fus[3], fus[4]
	aTc, bTc, cTc, dTc, eTc := tcs[0], tcs[1], tcs[2], tcs[3], tcs[4]
	aM, bM, cM, dM, eM := libkb.NewMetaContextForTest(*aTc), libkb.NewMetaContextForTest(*bTc), libkb.NewMetaContextForTest(*cTc), libkb.NewMetaContextForTest(*dTc), libkb.NewMetaContextForTest(*eTc)
	aA, bA, cA, dA, eA := aTc.G.GetTeamBoxAuditor(), bTc.G.GetTeamBoxAuditor(), cTc.G.GetTeamBoxAuditor(), dTc.G.GetTeamBoxAuditor(), eTc.G.GetTeamBoxAuditor()

	t.Logf("A creates team")
	teamName, teamID := createTeam2(*aTc)

	t.Logf("adding B as admin")
	_, err := AddMember(aM.Ctx(), aTc.G, teamName.String(), bU.Username, keybase1.TeamRole_ADMIN, nil)
	require.NoError(t, err)

	t.Logf("adding C as reader")
	_, err = AddMember(aM.Ctx(), aTc.G, teamName.String(), cU.Username, keybase1.TeamRole_READER, nil)
	require.NoError(t, err)

	t.Logf("adding D as bot")
	_, err = AddMember(aM.Ctx(), aTc.G, teamName.String(), dU.Username, keybase1.TeamRole_BOT, nil)
	require.NoError(t, err)

	t.Logf("adding E as restricted bot")
	_, err = AddMember(aM.Ctx(), aTc.G, teamName.String(), eU.Username, keybase1.TeamRole_RESTRICTEDBOT, &keybase1.TeamBotSettings{})
	require.NoError(t, err)

	require.NoError(t, auditTeam(aA, aM, teamID), "A can audit")
	require.NoError(t, auditTeam(bA, bM, teamID), "B can audit")
	require.NoError(t, auditTeam(cA, cM, teamID), "C can audit (this is vacuous, since C is a reader)")
	require.NoError(t, auditTeam(dA, dM, teamID), "D can audit (this is vacuous, since D is a bot)")
	require.NoError(t, auditTeam(eA, eM, teamID), "E can audit (this is vacuous, since E is a restricted bot)")

	var nullstring *string
	g1 := keybase1.PerTeamKeyGeneration(1)

	t.Logf("check A's view of the successful audit in db")
	log, queue, jail := mustGetBoxState(aTc, aA, aM, teamID)
	log.Audits[0].ID = nil
	log.Audits[0].Attempts[0].Ctime = 0
	require.Equal(t, *log, BoxAuditLog{
		Audits: []BoxAudit{
			BoxAudit{
				ID: nil,
				Attempts: []keybase1.BoxAuditAttempt{
					keybase1.BoxAuditAttempt{
						Ctime:      0,
						Error:      nullstring,
						Result:     keybase1.BoxAuditAttemptResult_OK_VERIFIED,
						Generation: &g1,
					},
				},
			},
		},
		InProgress: false,
		Version:    CurrentBoxAuditVersion,
	})
	require.Nil(t, queue)
	require.Equal(t, *jail, BoxAuditJail{
		TeamIDs: map[keybase1.TeamID]bool{},
		Version: CurrentBoxAuditVersion,
	})

	t.Logf("check B's view of the successful audit in db")
	log, queue, jail = mustGetBoxState(bTc, bA, bM, teamID)
	log.Audits[0].ID = nil
	log.Audits[0].Attempts[0].Ctime = 0
	require.Equal(t, *log, BoxAuditLog{
		Audits: []BoxAudit{
			BoxAudit{
				ID: nil,
				Attempts: []keybase1.BoxAuditAttempt{
					keybase1.BoxAuditAttempt{
						Ctime:      0,
						Error:      nullstring,
						Result:     keybase1.BoxAuditAttemptResult_OK_VERIFIED,
						Generation: &g1,
					},
				},
			},
		},
		InProgress: false,
		Version:    CurrentBoxAuditVersion,
	})
	require.Nil(t, queue)
	require.Equal(t, *jail, BoxAuditJail{
		TeamIDs: map[keybase1.TeamID]bool{},
		Version: CurrentBoxAuditVersion,
	})

	t.Logf("check C's & D's view of the successful no-op audit in db")
	vacuousLog := BoxAuditLog{
		Audits: []BoxAudit{
			BoxAudit{
				ID: nil,
				Attempts: []keybase1.BoxAuditAttempt{
					keybase1.BoxAuditAttempt{
						Ctime:      0,
						Error:      nullstring,
						Result:     keybase1.BoxAuditAttemptResult_OK_NOT_ATTEMPTED_ROLE,
						Generation: &g1,
					},
				},
			},
		},
		InProgress: false,
		Version:    CurrentBoxAuditVersion,
	}
	log, queue, jail = mustGetBoxState(cTc, cA, cM, teamID)
	log.Audits[0].ID = nil
	log.Audits[0].Attempts[0].Ctime = 0
	require.Equal(t, *log, vacuousLog)
	require.Nil(t, queue)
	require.Equal(t, *jail, BoxAuditJail{
		TeamIDs: map[keybase1.TeamID]bool{},
		Version: CurrentBoxAuditVersion,
	})
	log, queue, jail = mustGetBoxState(dTc, dA, dM, teamID)
	log.Audits[0].ID = nil
	log.Audits[0].Attempts[0].Ctime = 0
	require.Equal(t, *log, vacuousLog)
	require.Nil(t, queue)
	require.Equal(t, *jail, BoxAuditJail{
		TeamIDs: map[keybase1.TeamID]bool{},
		Version: CurrentBoxAuditVersion,
	})
	log, queue, jail = mustGetBoxState(eTc, eA, eM, teamID)
	log.Audits[0].ID = nil
	log.Audits[0].Attempts[0].Ctime = 0
	require.Equal(t, *log, vacuousLog)
	require.Nil(t, queue)
	require.Equal(t, *jail, BoxAuditJail{
		TeamIDs: map[keybase1.TeamID]bool{},
		Version: CurrentBoxAuditVersion,
	})

	require.Equal(t, countTrues(t, mustGetJailLRU(aTc, aA)), 0)
	require.Equal(t, countTrues(t, mustGetJailLRU(bTc, bA)), 0)
	require.Equal(t, countTrues(t, mustGetJailLRU(cTc, cA)), 0)
	require.Equal(t, countTrues(t, mustGetJailLRU(cTc, dA)), 0)
	require.Equal(t, countTrues(t, mustGetJailLRU(cTc, eA)), 0)

	t.Logf("checking state after failed attempts")
	t.Logf("disable autorotate on retry")
	aTc.G.TestOptions.NoAutorotateOnBoxAuditRetry = true
	t.Logf("c rotates and a check's state")
	kbtest.RotatePaper(*cTc, cU)
	err = auditTeam(aA, aM, teamID)
	requireNonfatalError(t, err, "audit failure on unrotated puk")
	_, ok := err.(NonfatalBoxAuditError)
	require.True(t, ok)
	log, queue, jail = mustGetBoxState(aTc, aA, aM, teamID)
	require.Equal(t, len(log.Audits), 2)
	require.True(t, log.InProgress, "failed audit causes it to be in progress")
	require.Equal(t, len(queue.Items), 1)
	require.Equal(t, queue.Items[0].TeamID, teamID)
	require.Equal(t, queue.Version, CurrentBoxAuditVersion)
	err = auditTeam(aA, aM, teamID)
	requireNonfatalError(t, err, "another audit failure on unrotated puk")
	log, queue, jail = mustGetBoxState(aTc, aA, aM, teamID)
	require.Equal(t, len(queue.Items), 1, "no duplicates in retry queue")

	t.Logf("checking that we can load a team in retry queue, but that is not jailed yet")
	_, err = Load(context.TODO(), aTc.G, keybase1.LoadTeamArg{Name: teamName.String(), ForceRepoll: true})
	require.NoError(t, err)

	t.Logf("rotate until we hit max retry attempts; should result in fatal error")
	for i := 0; i < MaxBoxAuditRetryAttempts-3; i++ {
		err = auditTeam(aA, aM, teamID)
		requireNonfatalError(t, err, "another audit failure on unrotated puk")
	}
	err = auditTeam(aA, aM, teamID)
	requireFatalError(t, err)
	log, queue, jail = mustGetBoxState(aTc, aA, aM, teamID)
	require.Equal(t, len(log.Last().Attempts), MaxBoxAuditRetryAttempts)
	require.True(t, log.InProgress, "fatal state still counts as in progress even though it won't be retried")
	require.Equal(t, len(queue.Items), 0, "jailed teams not in retry queue")
	require.Equal(t, *jail, BoxAuditJail{
		TeamIDs: map[keybase1.TeamID]bool{
			teamID: true,
		},
		Version: CurrentBoxAuditVersion,
	})
	require.Equal(t, 1, countTrues(t, mustGetJailLRU(aTc, aA)))

	// NOTE We may eventually cause the jailed team load that did not pass
	// reaudit to fail entirely instead of just putting up a black bar in the
	// GUI.
	t.Logf("checking that we can load a jailed team that won't pass auto-reaudit")
	_, err = Load(context.TODO(), aTc.G, keybase1.LoadTeamArg{Name: teamName.String(), ForceRepoll: true})
	require.NoError(t, err)

	inJail, err := aA.IsInJail(aM, teamID)
	require.NoError(t, err)
	require.True(t, inJail)

	t.Logf("reenable autorotate on retry")
	aTc.G.TestOptions.NoAutorotateOnBoxAuditRetry = false

	// Not in queue anymore so this is a noop
	_, err = aA.RetryNextBoxAudit(aM)
	require.NoError(t, err)

	// We are jailed, but reaudit passes
	didReaudit, err := aA.AssertUnjailedOrReaudit(aM, teamID)
	require.NoError(t, err)
	require.True(t, didReaudit)

	require.NoError(t, err, "no error since we rotate on retry now")
	log, queue, jail = mustGetBoxState(aTc, aA, aM, teamID)
	require.False(t, log.InProgress)
	attempts := log.Last().Attempts
	require.Equal(t, attempts[len(attempts)-1].Result, keybase1.BoxAuditAttemptResult_OK_VERIFIED)
	require.Equal(t, len(queue.Items), 0, "not in queue")
	require.Equal(t, len(jail.TeamIDs), 0, "unjailed")

	// Just check these public methods are ok
	teamIDs, err := KnownTeamIDs(aM)
	require.NoError(t, err)
	require.Equal(t, len(teamIDs), 1)
	require.Equal(t, teamIDs[0], teamID)

	randomID, err := randomKnownTeamID(aM)
	require.NoError(t, err)
	require.NotNil(t, randomID)
	require.Equal(t, teamID, *randomID)

	_, err = aA.BoxAuditRandomTeam(aM)
	require.NoError(t, err)
}

// TestBoxAuditRaces makes 3 users, 3 teams with all 3 users, and audits all
// of them many times at the same time in separate goroutines.  If tested with
// the -race option, it will fail if there's any data races. Also, we check
// that all the routines eventually finish, which might catch some deadlocks.
// Note that the race detector only catches memory races, so it doesn't really
// mean there are no data races in the code even if it passes the detector, i.e.,
// one goroutine could have overwritten a queue add of another goroutine, and this
// would not be caught by the detector.
// However, we *do* check that the error is Nonfatal, not Client, which means there
// were no errors in the leveldb or lru operations, but rather the audit itself.
func TestBoxAuditRaces(t *testing.T) {
	fus, tcs, cleanup := setupNTests(t, 3)
	defer cleanup()

	aU, bU, cU := fus[0], fus[1], fus[2]
	aTc, bTc, cTc := tcs[0], tcs[1], tcs[2]
	aM, bM, cM := libkb.NewMetaContextForTest(*aTc), libkb.NewMetaContextForTest(*bTc), libkb.NewMetaContextForTest(*cTc)
	aA, bA, cA := aTc.G.GetTeamBoxAuditor(), bTc.G.GetTeamBoxAuditor(), cTc.G.GetTeamBoxAuditor()

	aTeamName, aTeamID := createTeam2(*aTc)
	_, err := AddMember(aM.Ctx(), aTc.G, aTeamName.String(), bU.Username, keybase1.TeamRole_ADMIN, nil)
	require.NoError(t, err)
	_, err = AddMember(aM.Ctx(), aTc.G, aTeamName.String(), cU.Username, keybase1.TeamRole_ADMIN, nil)
	require.NoError(t, err)

	bTeamName, bTeamID := createTeam2(*bTc)
	_, err = AddMember(bM.Ctx(), bTc.G, bTeamName.String(), aU.Username, keybase1.TeamRole_ADMIN, nil)
	require.NoError(t, err)
	_, err = AddMember(bM.Ctx(), bTc.G, bTeamName.String(), cU.Username, keybase1.TeamRole_ADMIN, nil)
	require.NoError(t, err)

	cTeamName, cTeamID := createTeam2(*cTc)
	_, err = AddMember(cM.Ctx(), cTc.G, cTeamName.String(), aU.Username, keybase1.TeamRole_ADMIN, nil)
	require.NoError(t, err)
	_, err = AddMember(cM.Ctx(), cTc.G, cTeamName.String(), bU.Username, keybase1.TeamRole_ADMIN, nil)
	require.NoError(t, err)

	// We do this so the audits will access the shared jail and queue data
	// structures, not just the logs.
	t.Logf("Turning off autorotate on retry and putting teams in failing audit state")
	aTc.G.TestOptions.NoAutorotateOnBoxAuditRetry = true
	kbtest.RotatePaper(*aTc, aU)
	kbtest.RotatePaper(*bTc, bU)
	kbtest.RotatePaper(*cTc, cU)

	auditors := []libkb.TeamBoxAuditor{aA, bA, cA}
	metacontexts := []libkb.MetaContext{aM, bM, cM}
	teamIDs := []keybase1.TeamID{aTeamID, bTeamID, cTeamID}
	var wg sync.WaitGroup
	total := 9
	errCh := make(chan error, total)
	wg.Add(total)
	for i := 0; i < 3; i++ {
		for j := 0; j < 3; j++ {
			go func(i, j int) {
				_, auditErr := auditors[i].BoxAuditTeam(metacontexts[i], teamIDs[j])
				errCh <- auditErr
				wg.Done()
			}(i, j)
		}
	}
	wg.Wait()
	i := 0
	for err := range errCh {
		require.NotNil(t, err)
		boxErr := err.(NonfatalBoxAuditError)
		require.Regexp(t, regexp.MustCompile(`.*box summary hash mismatch.*`), boxErr.inner.Error())
		// stop reading after 9 handled errors, otherwise the for loop goes
		// forever since we don't close errCh
		i++
		if i >= total {
			break
		}
	}
}

// TestBoxAuditCalculation makes sure we calculate summaries at different
// merkle seqnos properly, regardless of users who are reset or who rotate
// their devices.
func TestBoxAuditCalculation(t *testing.T) {
	fus, tcs, cleanup := setupNTests(t, 3)
	defer cleanup()

	aU, bU, cU := fus[0], fus[1], fus[2]
	aTc, bTc, cTc := tcs[0], tcs[1], tcs[2]
	aM, _, cM := libkb.NewMetaContextForTest(*aTc), libkb.NewMetaContextForTest(*bTc), libkb.NewMetaContextForTest(*cTc)

	aTeamName, aTeamID := createTeam2(*aTc)
	_, err := AddMember(aM.Ctx(), aTc.G, aTeamName.String(), bU.Username, keybase1.TeamRole_ADMIN, nil)
	require.NoError(t, err)
	_, err = AddMember(aM.Ctx(), aTc.G, aTeamName.String(), cU.Username, keybase1.TeamRole_ADMIN, nil)
	require.NoError(t, err)

	puk := aU.User.GetComputedKeyFamily().GetLatestPerUserKey()
	initSeqno := puk.Seqno

	load := func(mctx libkb.MetaContext, teamID keybase1.TeamID) (team *Team, chainSummary, currentSummary *boxPublicSummary) {
		team, err := loadTeamForBoxAudit(mctx, teamID)
		require.NoError(t, err)
		chainSummary, err = calculateChainSummary(mctx, team)
		require.NoError(t, err)
		currentSummary, err = calculateCurrentSummary(mctx, team)
		require.NoError(t, err)
		return team, chainSummary, currentSummary
	}

	team, chainSummary, currentSummary := load(aM, aTeamID)
	expected := boxPublicSummaryTable{
		aU.User.GetUID(): initSeqno,
		bU.User.GetUID(): initSeqno,
		cU.User.GetUID(): initSeqno,
	}
	require.Equal(t, expected, chainSummary.table)
	require.Equal(t, expected, currentSummary.table)

	t.Logf("B rotates PUK")
	kbtest.RotatePaper(*bTc, bU)

	team, chainSummary, currentSummary = load(cM, aTeamID)
	newExpected := boxPublicSummaryTable{
		aU.User.GetUID(): initSeqno,
		bU.User.GetUID(): initSeqno + 3,
		cU.User.GetUID(): initSeqno,
	}
	require.Equal(t, expected, chainSummary.table)
	require.Equal(t, newExpected, currentSummary.table)

	t.Logf("A rotates team")
	err = team.Rotate(aM.Ctx(), keybase1.RotationType_VISIBLE)
	require.NoError(t, err)

	t.Logf("C checks summary")
	team, chainSummary, currentSummary = load(cM, aTeamID)
	require.Equal(t, newExpected, chainSummary.table)
	require.Equal(t, newExpected, currentSummary.table)

	t.Logf("check after reset")
	kbtest.ResetAccount(*cTc, cU)
	newerExpected := boxPublicSummaryTable{
		aU.User.GetUID(): initSeqno,
		bU.User.GetUID(): initSeqno + 3,
	}
	team, chainSummary, currentSummary = load(aM, aTeamID)
	require.Equal(t, newExpected, chainSummary.table)
	require.Equal(t, newerExpected, currentSummary.table)

	t.Logf("make some dummy links to test historical chain summary")
	err = EditMember(aM.Ctx(), aTc.G, aTeamName.String(), bU.Username, keybase1.TeamRole_WRITER, nil)
	require.NoError(t, err)
	err = EditMember(aM.Ctx(), aTc.G, aTeamName.String(), bU.Username, keybase1.TeamRole_ADMIN, nil)
	require.NoError(t, err)
	err = EditMember(aM.Ctx(), aTc.G, aTeamName.String(), bU.Username, keybase1.TeamRole_WRITER, nil)
	require.NoError(t, err)
	err = EditMember(aM.Ctx(), aTc.G, aTeamName.String(), bU.Username, keybase1.TeamRole_ADMIN, nil)
	require.NoError(t, err)
	team, chainSummary, currentSummary = load(aM, aTeamID)
	require.Equal(t, newExpected, chainSummary.table)
	require.Equal(t, newerExpected, currentSummary.table)

	t.Logf("make some more dummy links")
	err = EditMember(aM.Ctx(), aTc.G, aTeamName.String(), bU.Username, keybase1.TeamRole_WRITER, nil)
	require.NoError(t, err)
	err = EditMember(aM.Ctx(), aTc.G, aTeamName.String(), bU.Username, keybase1.TeamRole_ADMIN, nil)
	require.NoError(t, err)

	team, _, _ = load(aM, aTeamID)
	err = team.Rotate(aM.Ctx(), keybase1.RotationType_VISIBLE)
	require.NoError(t, err)
	team, chainSummary, currentSummary = load(aM, aTeamID)
	require.Equal(t, newerExpected, chainSummary.table)
	require.Equal(t, newerExpected, currentSummary.table)
}

func TestBoxAuditSubteamCalculation(t *testing.T) {
	fus, tcs, cleanup := setupNTests(t, 3)
	defer cleanup()

	aU, bU, cU := fus[0], fus[1], fus[2]
	aTc, bTc, cTc := tcs[0], tcs[1], tcs[2]
	aM, _, _ := libkb.NewMetaContextForTest(*aTc), libkb.NewMetaContextForTest(*bTc), libkb.NewMetaContextForTest(*cTc)

	parentName, parentID := createTeam2(*tcs[0])
	// A is not in subteam
	subteamID, err := CreateSubteam(aM.Ctx(), aTc.G, "abc", parentName, keybase1.TeamRole_NONE /* addSelfAs */)
	require.NoError(t, err)
	subteamName, err := parentName.Append("abc")
	require.NoError(t, err)
	t.Logf("adding B as writer of team")
	_, err = AddMember(aM.Ctx(), aTc.G, parentName.String(), bU.Username, keybase1.TeamRole_WRITER, nil)
	require.NoError(t, err)
	t.Logf("adding C as writer of subteam")
	_, err = AddMember(aM.Ctx(), aTc.G, subteamName.String(), cU.Username, keybase1.TeamRole_WRITER, nil)
	require.NoError(t, err)

	puk := aU.User.GetComputedKeyFamily().GetLatestPerUserKey()
	initSeqno := puk.Seqno
	load := func(mctx libkb.MetaContext, teamID keybase1.TeamID) (team *Team, chainSummary, currentSummary *boxPublicSummary) {
		team, err := loadTeamForBoxAudit(mctx, teamID)
		require.NoError(t, err)
		chainSummary, err = calculateChainSummary(mctx, team)
		require.NoError(t, err)
		currentSummary, err = calculateCurrentSummary(mctx, team)
		require.NoError(t, err)
		return team, chainSummary, currentSummary
	}

	_, chainSummary, currentSummary := load(aM, parentID)
	teamTable1 := boxPublicSummaryTable{
		aU.User.GetUID(): initSeqno,
		bU.User.GetUID(): initSeqno,
	}
	require.Equal(t, teamTable1, chainSummary.table)
	require.Equal(t, teamTable1, currentSummary.table)

	_, chainSummary, currentSummary = load(aM, *subteamID)
	subteamTable1 := boxPublicSummaryTable{
		aU.User.GetUID(): initSeqno,
		cU.User.GetUID(): initSeqno,
	}
	require.Equal(t, subteamTable1, chainSummary.table)
	require.Equal(t, subteamTable1, currentSummary.table)

	t.Logf("make b an admin of parent, giving him boxes")
	err = EditMember(aM.Ctx(), aTc.G, parentName.String(), bU.Username, keybase1.TeamRole_ADMIN, nil)
	require.NoError(t, err)
	_, chainSummary, currentSummary = load(aM, *subteamID)
	t.Logf("check do not need to rotate to know about new admin in chainsummary")
	subteamTable2 := boxPublicSummaryTable{
		aU.User.GetUID(): initSeqno,
		bU.User.GetUID(): initSeqno,
		cU.User.GetUID(): initSeqno,
	}
	require.Equal(t, subteamTable2, chainSummary.table)
	require.Equal(t, subteamTable2, currentSummary.table)
}

func TestBoxAuditOpen(t *testing.T) {
	_, tcs, cleanup := setupNTests(t, 1)
	defer cleanup()
	tc := tcs[0]

	b, err := libkb.RandBytes(4)
	auditor := tc.G.GetTeamBoxAuditor()
	require.NoError(t, err)
	name := hex.EncodeToString(b)
	_, err = CreateRootTeam(context.Background(), tc.G, name, keybase1.TeamSettings{
		Open:   true,
		JoinAs: keybase1.TeamRole_WRITER,
	})
	require.NoError(t, err)

	mctx := libkb.NewMetaContextForTest(*tc)
	teamname, err := keybase1.TeamNameFromString(name)
	require.NoError(t, err)
	attempt := auditor.Attempt(mctx, teamname.ToPrivateTeamID(), false)

	require.Equal(t, attempt.Result, keybase1.BoxAuditAttemptResult_OK_NOT_ATTEMPTED_OPENTEAM)
}

func TestBoxAuditImplicit(t *testing.T) {
	fus, tcs, cleanup := setupNTests(t, 2)
	defer cleanup()

	var teamIDs []keybase1.TeamID

	for idx, isPublic := range []bool{false, true} {
		t.Logf("testing audit implicit with public=%t", isPublic)
		team1, _, _, err := LookupOrCreateImplicitTeam(context.TODO(), tcs[idx].G, "t_tracy,"+fus[idx].Username, isPublic)
		require.NoError(t, err)
		auditor := tcs[idx].G.GetTeamBoxAuditor()
		mctx := libkb.NewMetaContextForTest(*tcs[idx])
		attempt := auditor.Attempt(mctx, team1.ID, false)
		require.Equal(t, attempt.Result, keybase1.BoxAuditAttemptResult_OK_VERIFIED)
		require.NoError(t, auditTeam(auditor, mctx, team1.ID))
		teamIDs = append(teamIDs, team1.ID)
	}

	// Check we keep track of public and private implicit teams too
	mctx := libkb.NewMetaContextForTest(*tcs[0])
	knownTeamIDs, err := KnownTeamIDs(mctx)
	require.NoError(t, err)
	require.Equal(t, len(knownTeamIDs), 1)
	require.Equal(t, teamIDs[0], knownTeamIDs[0])
	randomID, err := randomKnownTeamID(mctx)
	require.NoError(t, err)
	require.NotNil(t, randomID)
	require.True(t, teamIDs[0] == *randomID)

	mctx = libkb.NewMetaContextForTest(*tcs[1])
	knownTeamIDs, err = KnownTeamIDs(mctx)
	require.NoError(t, err)
	require.Equal(t, len(knownTeamIDs), 1)
	require.Equal(t, teamIDs[1], knownTeamIDs[0])
	randomID, err = randomKnownTeamID(mctx)
	require.NoError(t, err)
	require.NotNil(t, randomID)
	require.True(t, teamIDs[1] == *randomID)
}

func TestBoxAuditSubteamWithImplicitAdmins(t *testing.T) {
	fus, tcs, cleanup := setupNTests(t, 3)
	_, bU := fus[0], fus[1]
	aTc, bTc := tcs[0], tcs[1]
	aM, bM := libkb.NewMetaContextForTest(*aTc), libkb.NewMetaContextForTest(*bTc)
	aA, bA := aTc.G.GetTeamBoxAuditor(), bTc.G.GetTeamBoxAuditor()
	defer cleanup()

	parentName, _ := createTeam2(*tcs[0])
	// A is not in subteam
	subteamID, err := CreateSubteam(aM.Ctx(), aTc.G, "abc", parentName, keybase1.TeamRole_NONE /* addSelfAs */)
	require.NoError(t, err)
	subTeamName, err := parentName.Append("abc")
	require.NoError(t, err)

	t.Logf("adding B as admin to subteam")
	_, err = AddMember(aM.Ctx(), aTc.G, subTeamName.String(), bU.Username, keybase1.TeamRole_WRITER, nil)
	require.NoError(t, err)

	// Even though A is not in subteam, A has a box because of implicit
	// adminship. Check that B can still audit successfully.
	require.NoError(t, auditTeam(bA, bM, *subteamID))

	// Add third user as an admin to parent team. They will be boxed for
	// subteam as well.
	_, err = AddMember(aM.Ctx(), aM.G(), parentName.String(), fus[2].Username, keybase1.TeamRole_ADMIN, nil)
	require.NoError(t, err)

	// Audit both teams again
	require.NoError(t, auditTeam(aA, aM, parentName.RootID()))

	require.NoError(t, auditTeam(bA, bM, *subteamID))
}

func TestBoxAuditTransactionsWithBoxSummaries(t *testing.T) {
	tc, owner, otherA, otherB, name := memberSetupMultiple(t)
	defer tc.Cleanup()

	otherC, err := kbtest.CreateAndSignupFakeUser("t", tc.G)
	require.NoError(t, err)

	kbtest.Logout(tc)
	require.NoError(t, owner.Login(tc.G))

	t.Logf("Team name is %s\n", name)

	team, err := Load(context.Background(), tc.G, keybase1.LoadTeamArg{
		Name:      name,
		NeedAdmin: true,
	})
	require.NoError(t, err)

	tx := CreateAddMemberTx(team)
	for _, otherUser := range []*kbtest.FakeUser{otherA, otherB, otherC} {
		val := &keybase1.TeamChangeReq{}
		err = val.AddUVWithRole(otherUser.GetUserVersion(), keybase1.TeamRole_WRITER, nil)
		require.NoError(t, err)
		payload := txPayload{
			Tag: txPayloadTagCryptomembers,
			Val: val,
		}
		tx.payloads = append(tx.payloads, payload)
	}

	err = tx.Post(libkb.NewMetaContextForTest(tc))
	require.NoError(t, err)

	auditor := tc.G.GetTeamBoxAuditor()
	attempt := auditor.Attempt(libkb.NewMetaContextForTest(tc), team.ID, false /* rotateBeforeAudit */)
	require.Nil(t, attempt.Error)
	require.Equal(t, attempt.Result, keybase1.BoxAuditAttemptResult_OK_VERIFIED)
}

func TestBoxAuditVersionBump(t *testing.T) {
	_, tcs, cleanup := setupNTests(t, 1)
	defer cleanup()
	aTc := tcs[0]
	aM := libkb.NewMetaContextForTest(*aTc)

	teamID := keybase1.TeamID("YELLOW_SUBMARINE")

	a1 := newBoxAuditorWithVersion(aM.G(), 5)

	a1.jail(aM, teamID)

	jailed, err := a1.IsInJail(aM, teamID)
	require.NoError(t, err)
	require.True(t, jailed)

	jailed, err = a1.IsInJail(aM, teamID)
	require.NoError(t, err)
	require.True(t, jailed)

	a2 := newBoxAuditorWithVersion(aM.G(), 6)
	jailed, err = a2.IsInJail(aM, teamID)
	require.NoError(t, err)
	require.False(t, jailed)

	jailed, err = a1.IsInJail(aM, teamID)
	require.NoError(t, err)
	require.True(t, jailed)
}
