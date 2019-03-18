package teams

import (
	"bytes"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"math/big"
	"sync"
	"time"

	lru "github.com/hashicorp/golang-lru"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/go-codec/codec"
	"golang.org/x/net/context"

	"github.com/keybase/client/go/protocol/keybase1"
)

const CurrentBoxAuditVersion Version = 4
const JailLRUSize = 100
const BoxAuditIDLen = 16
const MaxBoxAuditRetryAttempts = 6
const BoxAuditTag = "BOXAUD"
const MaxBoxAuditQueueSize = 100
const MaxBoxAuditLogSize = 10

type contextKey string

const SkipBoxAuditCheckContextKey contextKey = "skip-box-audit-check"

type ClientBoxAuditError struct {
	inner error
}

func (e ClientBoxAuditError) Error() string {
	return fmt.Sprintf("audit failed due to client-side issue; will be retried later: %s", e.inner)
}

type NonfatalBoxAuditError struct {
	inner error
}

func (e NonfatalBoxAuditError) Error() string {
	return fmt.Sprintf("audit failed; will be retried later: %s.", e.inner)
}

type FatalBoxAuditError struct {
	inner error
}

func (e FatalBoxAuditError) Error() string {
	return fmt.Sprintf("audit failed fatally; will not be retried until requested: %s", e.inner)
}

func VerifyBoxAudit(mctx libkb.MetaContext, teamID keybase1.TeamID) (newMctx libkb.MetaContext, shouldReload bool) {
	shouldSkip, ok := mctx.Ctx().Value(SkipBoxAuditCheckContextKey).(bool)
	if ok && shouldSkip {
		return mctx, false
	}
	mctx = mctx.WithCtx(context.WithValue(mctx.Ctx(), SkipBoxAuditCheckContextKey, true))

	didReaudit, err := mctx.G().GetTeamBoxAuditor().AssertUnjailedOrReaudit(mctx, teamID)
	if err != nil {
		mctx.G().NotifyRouter.HandleBoxAuditError(err.Error())
		return mctx, true
	}
	return mctx, didReaudit
}

// BoxAuditor ensures all of a team's secret boxes are encrypted for the right
// people, and that the server has not neglected to notify a team to rotate
// their keys in the event of a user revoking a device or resetting their
// account. Security depends on the security of the Merkle tree so we know the
// current status of all the team's members.  BoxAuditor operations are
// thread-safe and can be run concurrently for many teams.  Security also
// relies on team members and the Keybase server not colluding together to sign
// box summary hashes into the sigchain that don't match what was actually
// encrypted (which is somewhat trivial, since members can leak the secret if
// they want regardless of server cooperation).
type BoxAuditor struct {
	Version Version

	// Singleflight lock on team ID.
	locktab libkb.LockTable

	// jailMutex and queueMutex are not per-team locks, since they are
	// collections of multiple team IDs.  Two audits of two teams can happen at
	// the same time, but they cannot access the jail or the retry queue at the
	// same time.
	jailMutex  sync.Mutex
	queueMutex sync.Mutex

	// The box audit jail has an LRU for performance, we need a mutex so we
	// don't use a partially initialized jailLRU.
	jailLRUMutex sync.Mutex
	jailLRU      *lru.Cache
}

var _ libkb.TeamBoxAuditor = &BoxAuditor{}

func (a *BoxAuditor) resetJailLRU() {
	a.jailLRUMutex.Lock()
	defer a.jailLRUMutex.Unlock()

	jailLRU, err := lru.New(JailLRUSize)
	// lru.New only returns an error on a negative size, so it's safe to panic
	// on an error.
	if err != nil {
		panic(err)
	}

	a.jailLRU = jailLRU
}

func (a *BoxAuditor) getJailLRU() *lru.Cache {
	a.jailLRUMutex.Lock()
	defer a.jailLRUMutex.Unlock()
	return a.jailLRU
}

func (a *BoxAuditor) OnLogout(mctx libkb.MetaContext) {
	a.resetJailLRU()
}

func NewBoxAuditor(g *libkb.GlobalContext) *BoxAuditor {
	a := &BoxAuditor{Version: CurrentBoxAuditVersion}
	a.resetJailLRU()
	return a
}

func NewBoxAuditorAndInstall(g *libkb.GlobalContext) {
	if g.GetEnv().GetDisableTeamBoxAuditor() {
		g.Log.CWarningf(context.TODO(), "Box auditor disabled: using dummy auditor")
		g.SetTeamBoxAuditor(DummyBoxAuditor{})
	} else {
		g.SetTeamBoxAuditor(NewBoxAuditor(g))
	}
}

func (a *BoxAuditor) initMctx(mctx libkb.MetaContext) libkb.MetaContext {
	mctx = mctx.WithLogTag(BoxAuditTag)
	mctx = mctx.WithCtx(context.WithValue(mctx.Ctx(), SkipBoxAuditCheckContextKey, true))
	return mctx
}

// BoxAuditTeam performs one attempt of a BoxAudit. If one is in progress for
// the teamid, make a new attempt. If exceeded max tries or hit a malicious
// error, return a fatal error.  Otherwise, make a new audit and fill it with
// one attempt. If the attempt failed nonfatally, enqueue it in the retry
// queue. If it failed fatally, add it to the jail. If it failed for reasons
// that are purely client-side, like a disk write error, we retry it as well
// but distinguish it from a failure the server could have possibly maliciously
// caused.
func (a *BoxAuditor) BoxAuditTeam(mctx libkb.MetaContext, teamID keybase1.TeamID) (err error) {
	mctx = a.initMctx(mctx)
	defer mctx.TraceTimed(fmt.Sprintf("BoxAuditTeam(%s)", teamID), func() error { return err })()
	lock := a.locktab.AcquireOnName(mctx.Ctx(), mctx.G(), teamID.String())
	defer lock.Release(mctx.Ctx())
	return a.boxAuditTeamLocked(mctx, teamID)
}

func (a *BoxAuditor) boxAuditTeamLocked(mctx libkb.MetaContext, teamID keybase1.TeamID) (err error) {
	defer mctx.TraceTimed(fmt.Sprintf("boxAuditTeamLocked(%s)", teamID), func() error { return err })()

	log, err := a.maybeGetLog(mctx, teamID)
	if err != nil {
		return ClientBoxAuditError{err}
	}
	if log == nil {
		log = NewBoxAuditLog(a.Version)
	}

	isRetry := log.InProgress
	rotateBeforeAudit := isRetry && !mctx.G().TestOptions.NoAutorotateOnBoxAuditRetry
	attempt := a.attemptLocked(mctx, teamID, rotateBeforeAudit)
	var id BoxAuditID
	if isRetry {
		// If there's already an inprogress Audit (i.e., previous failure and
		// we're doing a retry), rotate and do a new attempt in the same audit
		mctx.Debug("Retrying failed box audit")
		lastAudit := log.Last()
		id = lastAudit.ID
		newAudit := BoxAudit{
			ID:       lastAudit.ID,
			Attempts: append(lastAudit.Attempts, attempt),
		}
		log.Audits[len(log.Audits)-1] = newAudit
	} else {
		// If the last audit was completed, start a new audit.
		mctx.Debug("Starting new box audit")
		id, err = NewBoxAuditID()
		if err != nil {
			return ClientBoxAuditError{err}
		}
		audit := BoxAudit{
			ID:       id,
			Attempts: []keybase1.BoxAuditAttempt{attempt},
		}
		log.Audits = append(log.Audits, audit)
	}
	if len(log.Audits) > MaxBoxAuditLogSize {
		mctx.Debug("Truncating box audit log")
		log.Audits = log.Audits[len(log.Audits)-MaxBoxAuditLogSize:]
	}

	isOK := attempt.Result.IsOK()
	isFatal := attempt.Result == keybase1.BoxAuditAttemptResult_FAILURE_MALICIOUS_SERVER ||
		len(log.Last().Attempts) >= MaxBoxAuditRetryAttempts

	// NOTE An audit that has failed fatally will *not* be automatically
	// retried, but it is still considered InProgress because it is not in a
	// successful state, and more attempts will append to the currently failed
	// audit, instead of starting a new one.
	log.InProgress = !isOK

	err = putLogToDisk(mctx, log, teamID)
	if err != nil {
		return ClientBoxAuditError{err}
	}

	switch {
	case isOK:
		mctx.Debug("Box audit successful")
		_, err = a.clearRetryQueueOf(mctx, teamID)
		if err != nil {
			return ClientBoxAuditError{err}
		}
		err = a.unjail(mctx, teamID)
		if err != nil {
			return ClientBoxAuditError{err}
		}
		return nil
	case isFatal:
		mctx.Debug("Box audit failed fatally")
		_, err = a.clearRetryQueueOf(mctx, teamID)
		if err != nil {
			return ClientBoxAuditError{err}
		}
		err = a.jail(mctx, teamID)
		if err != nil {
			return ClientBoxAuditError{err}
		}
		return FatalBoxAuditError{errors.New(*attempt.Error)}
	default: // retryable error
		mctx.Debug("Box audit failed nonfatally")
		err := a.pushRetryQueue(mctx, teamID, id)
		if err != nil {
			return ClientBoxAuditError{err}
		}
		return NonfatalBoxAuditError{errors.New(*attempt.Error)}
	}
}

func (a *BoxAuditor) AssertUnjailedOrReaudit(mctx libkb.MetaContext, teamID keybase1.TeamID) (didReaudit bool, err error) {
	mctx = a.initMctx(mctx)
	defer mctx.TraceTimed("AssertUnjailedOrReaudit", func() error { return err })()

	inJail, err := a.IsInJail(mctx, teamID)
	if err != nil {
		return false, fmt.Errorf("failed to check box audit jail during team load: %s", err)
	}
	if !inJail {
		return false, nil
	}

	mctx.Debug("team in jail; retrying box audit")
	err = a.BoxAuditTeam(mctx, teamID)
	if err != nil {
		return false, fmt.Errorf("failed to reaudit team in box audit jail: %s", err)
	}
	return true, nil
}

// RetryNextBoxAudit selects a teamID from the box audit retry queue and performs another box audit.
func (a *BoxAuditor) RetryNextBoxAudit(mctx libkb.MetaContext) (err error) {
	mctx = a.initMctx(mctx)
	defer mctx.TraceTimed("RetryNextBoxAudit", func() error { return err })()
	queueItem, err := a.popRetryQueue(mctx)
	if err != nil {
		return err
	}
	// Empty retry queue
	if queueItem == nil {
		return nil
	}
	return a.BoxAuditTeam(mctx, (*queueItem).TeamID)
}

// BoxAuditRandomTeam selects a random known team from the slow team or FTL
// cache, including implicit teams, and audits it. It may succeed trivially
// because, for example, user is a reader and so does not have permissions to
// do a box audit or the team is an open team.
func (a *BoxAuditor) BoxAuditRandomTeam(mctx libkb.MetaContext) (err error) {
	mctx = a.initMctx(mctx)
	defer mctx.TraceTimed("BoxAuditRandomTeam", func() error { return err })()

	teamID, err := randomKnownTeamID(mctx)
	if err != nil {
		return err
	}
	// No known teams to audit
	if teamID == nil {
		return nil
	}

	return a.BoxAuditTeam(mctx, *teamID)
}

func (a *BoxAuditor) IsInJail(mctx libkb.MetaContext, teamID keybase1.TeamID) (inJail bool, err error) {
	mctx = a.initMctx(mctx)
	defer mctx.TraceTimed(fmt.Sprintf("IsInJail(%s)", teamID), func() error { return err })()

	val, ok := a.getJailLRU().Get(teamID)
	if ok {
		valBool, ok := val.(bool)
		if ok {
			return valBool, nil
		}
		mctx.Error("Bad boolean type assertion in IsInJail LRU for %s", teamID)
		// Fall through to disk if the LRU is corrupted
	}

	mctx.Debug("Jail cache miss; continuing to disk")

	jail, err := a.maybeGetJail(mctx)
	if err != nil {
		return false, err
	}
	if jail == nil {
		a.getJailLRU().Add(teamID, false)
		return false, nil
	}
	_, ok = jail.TeamIDs[teamID]
	a.getJailLRU().Add(teamID, ok)
	return ok, nil
}

// Attempt tries one time to box audit a Team ID. It does not store any
// persistent state to disk related to the box audit, but it may, e.g., refresh
// the team cache.
func (a *BoxAuditor) Attempt(mctx libkb.MetaContext, teamID keybase1.TeamID, rotateBeforeAudit bool) (attempt keybase1.BoxAuditAttempt) {
	mctx = a.initMctx(mctx)
	defer mctx.TraceTimed(fmt.Sprintf("Attempt(%s, %t)", teamID, rotateBeforeAudit), func() error {
		if attempt.Error != nil {
			return errors.New(*attempt.Error)
		}
		return nil
	})()
	lock := a.locktab.AcquireOnName(mctx.Ctx(), mctx.G(), teamID.String())
	defer lock.Release(mctx.Ctx())
	return a.attemptLocked(mctx, teamID, rotateBeforeAudit)
}

func (a *BoxAuditor) attemptLocked(mctx libkb.MetaContext, teamID keybase1.TeamID, rotateBeforeAudit bool) (attempt keybase1.BoxAuditAttempt) {
	defer mctx.TraceTimed(fmt.Sprintf("attemptLocked(%s, %t)", teamID, rotateBeforeAudit), func() error {
		if attempt.Error != nil {
			return errors.New(*attempt.Error)
		}
		return nil
	})()

	attempt = keybase1.BoxAuditAttempt{
		Result: keybase1.BoxAuditAttemptResult_FAILURE_RETRYABLE,
		Ctime:  keybase1.ToUnixTime(time.Now()),
	}

	getErrorMessage := func(err error) *string {
		msg := err.Error()
		return &msg
	}

	team, err := loadTeamForBoxAudit(mctx, teamID)
	if err != nil {
		attempt.Error = getErrorMessage(fmt.Errorf("failed to load team: %s", err))
		return attempt
	}

	if rotateBeforeAudit {
		err := team.Rotate(mctx.Ctx())
		if err != nil {
			attempt.Error = getErrorMessage(fmt.Errorf("failed to rotate team before retrying audit: %s", err))
			return attempt
		}
		return a.attemptLocked(mctx, teamID, false)
	}

	g := team.Generation()
	attempt.Generation = &g

	shouldAudit, shouldAuditResult, err := a.shouldAudit(mctx, *team)
	if err != nil {
		attempt.Error = getErrorMessage(err)
		return attempt
	}
	if !shouldAudit {
		mctx.Debug("Not attempting box audit attempt; %s", attempt.Result)
		attempt.Result = *shouldAuditResult
		return attempt
	}

	serverSummary, err := retrieveAndVerifySigchainSummary(mctx, team)
	if err != nil {
		attempt.Error = getErrorMessage(err)
		return attempt
	}

	if serverSummary == nil {
		msg := "got nil server summary"
		attempt.Error = &msg
		return attempt
	}

	clientSummary, err := calculateExpectedSummary(mctx, team)
	if err != nil {
		attempt.Error = getErrorMessage(err)
		return attempt
	}

	if clientSummary == nil {
		msg := "got nil client summary"
		attempt.Error = &msg
		return attempt
	}

	if !bytes.Equal(clientSummary.Hash(), serverSummary.Hash()) {
		// No need to make these Warnings, because these could happen when a
		// user has just changed their PUK and CLKR hasn't fired yet, or if the
		// team doesn't have any box summary hashes in the sigchain yet, etc.
		mctx.Debug("ERROR: Box audit summary mismatch")
		mctx.Debug("Client summary: %+v", clientSummary.table)
		mctx.Debug("Server summary: %+v", serverSummary.table)

		attempt.Error = getErrorMessage(fmt.Errorf("box summary hash mismatch"))
		return attempt
	}

	attempt.Result = keybase1.BoxAuditAttemptResult_OK_VERIFIED
	return attempt
}

func (a *BoxAuditor) clearRetryQueueOf(mctx libkb.MetaContext, teamID keybase1.TeamID) (queue *BoxAuditQueue, err error) {
	defer mctx.TraceTimed(fmt.Sprintf("clearRetryQueueOf(%s)", teamID), func() error { return err })()
	a.queueMutex.Lock()
	defer a.queueMutex.Unlock()
	return a.clearRetryQueueOfLocked(mctx, teamID)
}

func (a *BoxAuditor) clearRetryQueueOfLocked(mctx libkb.MetaContext, teamID keybase1.TeamID) (queue *BoxAuditQueue, err error) {
	defer mctx.TraceTimed(fmt.Sprintf("clearRetryQueueOfLocked(%s)", teamID), func() error { return err })()
	queue, err = a.maybeGetQueue(mctx)
	if err != nil {
		return nil, err
	}
	if queue == nil {
		return nil, nil
	}
	newItems := make([]BoxAuditQueueItem, 0, len(queue.Items))
	for _, item := range queue.Items {
		if item.TeamID != teamID {
			newItems = append(newItems, item)
		}
	}
	queue.Items = newItems
	err = putQueueToDisk(mctx, queue)
	if err != nil {
		return nil, err
	}
	return queue, nil
}

func (a *BoxAuditor) popRetryQueue(mctx libkb.MetaContext) (itemPtr *BoxAuditQueueItem, err error) {
	defer mctx.TraceTimed("popRetryQueue", func() error { return err })()
	a.queueMutex.Lock()
	defer a.queueMutex.Unlock()

	queue, err := a.maybeGetQueue(mctx)
	if err != nil {
		return nil, err
	}
	if queue == nil {
		return nil, nil
	}
	if len(queue.Items) == 0 {
		return nil, nil
	}
	item, newItems := queue.Items[0], queue.Items[1:]
	queue.Items = newItems
	err = putQueueToDisk(mctx, queue)
	if err != nil {
		return nil, err
	}
	return &item, nil
}

func (a *BoxAuditor) pushRetryQueue(mctx libkb.MetaContext, teamID keybase1.TeamID, auditID BoxAuditID) (err error) {
	defer mctx.TraceTimed(fmt.Sprintf("pushRetryQueue(%s, %x)", teamID, auditID), func() error { return err })()
	a.queueMutex.Lock()
	defer a.queueMutex.Unlock()

	queue, err := a.maybeGetQueue(mctx)
	if err != nil {
		return err
	}
	if queue != nil {
		// If already in the queue, remove it so we can bump it to the top.
		queue, err = a.clearRetryQueueOfLocked(mctx, teamID)
		if err != nil {
			return err
		}
	} else {
		queue = NewBoxAuditQueue(a.Version)
	}

	queue.Items = append(queue.Items, BoxAuditQueueItem{Ctime: time.Now(), TeamID: teamID, BoxAuditID: auditID})
	if len(queue.Items) > MaxBoxAuditQueueSize {
		// Truncate oldest first.
		mctx.Debug("Truncating box audit queue")
		queue.Items = queue.Items[len(queue.Items)-MaxBoxAuditQueueSize:]
	}
	err = putQueueToDisk(mctx, queue)
	if err != nil {
		return err
	}
	return nil
}

func (a *BoxAuditor) jail(mctx libkb.MetaContext, teamID keybase1.TeamID) (err error) {
	defer mctx.TraceTimed(fmt.Sprintf("jail(%s)", teamID), func() error { return err })()
	a.jailMutex.Lock()
	defer a.jailMutex.Unlock()

	a.getJailLRU().Add(teamID, true)

	jail, err := a.maybeGetJail(mctx)
	if err != nil {
		return err
	}
	if jail == nil {
		jail = NewBoxAuditJail(a.Version)
	}
	jail.TeamIDs[teamID] = true
	err = putJailToDisk(mctx, jail)
	if err != nil {
		return err
	}
	return nil
}

func (a *BoxAuditor) unjail(mctx libkb.MetaContext, teamID keybase1.TeamID) (err error) {
	defer mctx.TraceTimed(fmt.Sprintf("unjail(%s)", teamID), func() error { return err })()
	a.jailMutex.Lock()
	defer a.jailMutex.Unlock()

	a.getJailLRU().Add(teamID, false)

	jail, err := a.maybeGetJail(mctx)
	if err != nil {
		return err
	}
	if jail == nil {
		jail = NewBoxAuditJail(a.Version)
	}
	delete(jail.TeamIDs, teamID)
	err = putJailToDisk(mctx, jail)
	if err != nil {
		return err
	}
	return nil
}

type DummyBoxAuditor struct{}

var _ libkb.TeamBoxAuditor = &DummyBoxAuditor{}

const dummyMsg = "Box auditor disabled; aborting successfully"

func (d DummyBoxAuditor) AssertUnjailedOrReaudit(mctx libkb.MetaContext, _ keybase1.TeamID) (bool, error) {
	mctx.Warning(dummyMsg)
	return false, nil
}
func (d DummyBoxAuditor) IsInJail(mctx libkb.MetaContext, _ keybase1.TeamID) (bool, error) {
	mctx.Warning(dummyMsg)
	return false, nil
}
func (d DummyBoxAuditor) RetryNextBoxAudit(mctx libkb.MetaContext) error {
	mctx.Warning(dummyMsg)
	return nil
}
func (d DummyBoxAuditor) BoxAuditRandomTeam(mctx libkb.MetaContext) error {
	mctx.Warning(dummyMsg)
	return nil
}
func (d DummyBoxAuditor) BoxAuditTeam(mctx libkb.MetaContext, _ keybase1.TeamID) error {
	mctx.Warning(dummyMsg)
	return nil
}
func (d DummyBoxAuditor) Attempt(mctx libkb.MetaContext, _ keybase1.TeamID, _ bool) keybase1.BoxAuditAttempt {
	mctx.Warning(dummyMsg)
	return keybase1.BoxAuditAttempt{
		Result: keybase1.BoxAuditAttemptResult_OK_NOT_ATTEMPTED_ROLE,
		Ctime:  keybase1.ToUnixTime(time.Now()),
	}
}
func (d DummyBoxAuditor) OnLogout(libkb.MetaContext) {}

// BoxAuditLog is a log of audits for a particular team.
type BoxAuditLog struct {
	// The last entry of Audits is the latest one.
	Audits []BoxAudit

	// Whether the last Audit is still in progress; false initially.
	InProgress bool

	Version Version
}

var _ Versioned = &BoxAuditLog{}

func (l *BoxAuditLog) GetVersion() Version {
	return l.Version
}

func NewBoxAuditLog(version Version) *BoxAuditLog {
	return &BoxAuditLog{
		Audits:     nil,
		InProgress: false,
		Version:    version,
	}
}

func (l *BoxAuditLog) Last() *BoxAudit {
	if l == nil || len(l.Audits) == 0 {
		return nil
	}
	return &l.Audits[len(l.Audits)-1]
}

// BoxAudit is a single sequence of audit attempts for a single team.
type BoxAudit struct {
	ID       BoxAuditID
	Attempts []keybase1.BoxAuditAttempt
}

type BoxAuditID = []byte

func NewBoxAuditID() (BoxAuditID, error) {
	idBytes := make([]byte, BoxAuditIDLen)
	_, err := rand.Read(idBytes)
	if err != nil {
		return nil, err
	}
	return BoxAuditID(idBytes), nil
}

// BoxAuditQueue holds a list of teams that need to be reaudited, because the
// previously failed an audit. When a team does pass an audit, it is removed
// from the queue.
type BoxAuditQueue struct {
	Items   []BoxAuditQueueItem
	Version Version
}

var _ Versioned = &BoxAuditQueue{}

func (q *BoxAuditQueue) GetVersion() Version {
	return q.Version
}

func NewBoxAuditQueue(version Version) *BoxAuditQueue {
	return &BoxAuditQueue{
		Items:   nil,
		Version: version,
	}
}

type BoxAuditQueueItem struct {
	Ctime      time.Time
	TeamID     keybase1.TeamID
	BoxAuditID BoxAuditID
}

// BoxAuditJail contains TeamIDs that have hit a fatal audit failure or the max
// number of retryable audit failures. Teams in jail will not be reaudited
// unless they are explicitly loaded by the fast or slow team loaders.
type BoxAuditJail struct {
	TeamIDs map[keybase1.TeamID]bool
	Version Version
}

var _ Versioned = &BoxAuditJail{}

func (j *BoxAuditJail) GetVersion() Version {
	return j.Version
}

func NewBoxAuditJail(version Version) *BoxAuditJail {
	return &BoxAuditJail{
		TeamIDs: make(map[keybase1.TeamID]bool),
		Version: version,
	}
}

func (a *BoxAuditor) shouldAudit(mctx libkb.MetaContext, team Team) (bool, *keybase1.BoxAuditAttemptResult, error) {
	if team.IsSubteam() {
		res := keybase1.BoxAuditAttemptResult_OK_NOT_ATTEMPTED_SUBTEAM
		return false, &res, nil
	}
	if team.IsOpen() {
		res := keybase1.BoxAuditAttemptResult_OK_NOT_ATTEMPTED_OPENTEAM
		return false, &res, nil
	}
	role, err := team.MemberRole(mctx.Ctx(), mctx.CurrentUserVersion())
	if err != nil {
		return false, nil, err
	}
	if !role.IsOrAbove(keybase1.TeamRole_WRITER) {
		res := keybase1.BoxAuditAttemptResult_OK_NOT_ATTEMPTED_ROLE
		return false, &res, nil
	}

	return true, nil, nil
}

// loadTeamForBoxAudit loads a team once, but if the client
// has not yet stored BoxSummaryHashes (due to being an old client)
// it does a force full reload so it is populated.
func loadTeamForBoxAudit(mctx libkb.MetaContext, teamID keybase1.TeamID) (*Team, error) {
	return loadTeamForBoxAuditInner(mctx, teamID, false)
}

func loadTeamForBoxAuditInner(mctx libkb.MetaContext, teamID keybase1.TeamID, force bool) (team *Team, err error) {
	defer mctx.TraceTimed("loadTeamForBoxAuditInner", func() error { return err })()
	arg := keybase1.LoadTeamArg{
		ID:              teamID,
		ForceRepoll:     true,
		Public:          teamID.IsPublic(),
		ForceFullReload: force,
	}

	team, err = Load(mctx.Ctx(), mctx.G(), arg)
	if err != nil {
		return nil, err
	}
	if team == nil {
		return nil, fmt.Errorf("got nil team from loader")
	}

	// If the team sigchain state was constructed with support for box summary
	// hashes, the map will be non-nil but empty. It will only be nil if the
	// state is cached from a team load before box summary hash support.
	if team.GetBoxSummaryHashes() == nil {
		if force {
			return nil, fmt.Errorf("failed to get a non-nil box summary map after full reload")
		}
		return loadTeamForBoxAuditInner(mctx, teamID, true)
	}
	return team, nil
}

// calculateExpectedSummary loads all the UPAKs of the team's members and
// generates all the PUK generations we expect the team's secret boxes to currently be encrypted for.
func calculateExpectedSummary(mctx libkb.MetaContext, team *Team) (summary *boxPublicSummary, err error) {
	defer mctx.TraceTimed("calculateExpectedSummary", func() error { return err })()

	// We use a set because a UV could appear both explicit member and as an implicit admin
	members, err := team.Members()
	if err != nil {
		return nil, err
	}
	memberUVs := members.AllUserVersions()

	uvSet := make(map[keybase1.UserVersion]bool, len(memberUVs)) // prealloc; will be at least this size
	for _, memberUV := range memberUVs {
		uvSet[memberUV] = true
	}

	if team.IsSubteam() {
		implicitAdminUVs, err := mctx.G().GetTeamLoader().ImplicitAdmins(mctx.Ctx(), team.ID)
		if err != nil {
			return nil, err
		}
		for _, implicitAdminUV := range implicitAdminUVs {
			uvSet[implicitAdminUV] = true
		}
	}

	uvs := make([]keybase1.UserVersion, 0, len(memberUVs))
	for uv := range uvSet {
		uvs = append(uvs, uv)
	}

	getArg := func(idx int) *libkb.LoadUserArg {
		if idx >= len(uvs) {
			return nil
		}
		arg := libkb.NewLoadUserByUIDArg(mctx.Ctx(), mctx.G(), uvs[idx].Uid).WithPublicKeyOptional().WithForcePoll(true)
		return &arg
	}

	d := make(map[keybase1.UserVersion]keybase1.PerUserKey)
	processResult := func(idx int, upak *keybase1.UserPlusKeysV2AllIncarnations) {
		uv := uvs[idx]
		if upak == nil {
			mctx.Warning("got nil upak for uv %+v", uv)
			return
		}
		puk := upak.Current.GetLatestPerUserKey()
		if puk == nil {
			mctx.Debug("skipping user %s who has no per-user-key; possibly reset", uv)
			return
		}

		if upak.Current.EldestSeqno != uv.EldestSeqno {
			mctx.Debug("skipping user %s whose per-user-key is ahead of the team's member per-user-key; likely reset and needs to be readded", uv)
			return
		}

		d[uv] = *puk
	}

	err = mctx.G().GetUPAKLoader().Batcher(mctx.Ctx(), getArg, processResult, 0)
	if err != nil {
		return nil, err
	}

	summaryPtr, err := newBoxPublicSummary(d)
	if err != nil {
		return nil, err
	}

	return summaryPtr, nil
}

type summaryAuditBatch struct {
	BatchID   int          `json:"batch_id"`
	NonceTop  string       `json:"nonce_top"`
	SenderKID keybase1.KID `json:"sender_kid"`
	Summary   string       `json:"summary"`
}

type summaryAuditResponse struct {
	Batches []summaryAuditBatch `json:"batches"`
	Status  libkb.AppStatus     `json:"status"`
}

func (r *summaryAuditResponse) GetAppStatus() *libkb.AppStatus {
	return &r.Status
}

func retrieveAndVerifySigchainSummary(mctx libkb.MetaContext, team *Team) (summary *boxPublicSummary, err error) {
	defer mctx.TraceTimed("retrieveAndVerifySigchainSummary", func() error { return err })()

	// boxSummaryHashes should be non-nil because we did a force reload if it
	// wasn't during loadTeamForBoxAudit.
	boxSummaryHashes := team.GetBoxSummaryHashes()
	g := team.Generation()
	latestHashes := boxSummaryHashes[g]

	a := libkb.NewAPIArg("team/audit")
	a.Args = libkb.HTTPArgs{
		"id":         libkb.S{Val: team.ID.String()},
		"generation": libkb.I{Val: int(g)},
		"public":     libkb.B{Val: team.IsPublic()},
	}
	a.SessionType = libkb.APISessionTypeREQUIRED
	var response summaryAuditResponse
	err = mctx.G().API.GetDecode(mctx, a, &response)
	if err != nil {
		return nil, err
	}

	// Assert server doesn't silently inject additional unchecked batches
	if len(latestHashes) != len(response.Batches) {
		return nil, fmt.Errorf("expected %d box summary hashes for generation %d; got %d from server",
			len(latestHashes), g, len(response.Batches))
	}

	table := make(boxPublicSummaryTable)

	for idx, batch := range response.Batches {
		// Expect server to give us back IDs in the same order it'll be in the sigchain
		expectedHash, err := hex.DecodeString(latestHashes[idx].String())
		if err != nil {
			return nil, err
		}
		partialTable, err := unmarshalAndVerifyBatchSummary(batch.Summary, expectedHash)
		if err != nil {
			return nil, err
		}

		for uid, seqno := range partialTable {
			// NOTE It is possible to have more than one uid in a batch:
			// if a subteam was created, implicit admins have boxes added for
			// them by the creator. Then if the implicit admin was added to the
			// team explicitly, the adder re-encrypts the boxes for them, even
			// if their PUK is the same.
			table[uid] = seqno
		}
	}

	summaryPtr, err := newBoxPublicSummaryFromTable(table)
	if err != nil {
		return nil, err
	}

	return summaryPtr, nil
}

func unmarshalAndVerifyBatchSummary(batchSummary string, expectedHash []byte) (boxPublicSummaryTable, error) {
	if len(expectedHash) == 0 {
		return nil, fmt.Errorf("expected hash is empty")
	}

	msgpacked, err := base64.StdEncoding.DecodeString(batchSummary)
	if err != nil {
		return nil, err
	}

	actualHash := sha256.Sum256(msgpacked)
	// Don't need constant time comparison.
	if !bytes.Equal(expectedHash, actualHash[:]) {
		return nil, fmt.Errorf("expected hash %x signed into sigchain, but got %x from server", expectedHash, actualHash)
	}

	mh := codec.MsgpackHandle{WriteExt: true}
	var table boxPublicSummaryTable
	dec := codec.NewDecoderBytes(msgpacked, &mh)
	err = dec.Decode(&table)
	if err != nil {
		return nil, err
	}

	return table, nil
}

// TeamIDKeys takes a set of DBKeys that must all be tid:-style DBKeys and
// extracts the team id from them. Because teams can be loaded via both FTL and
// the slow team loader, we use a set so we don't return duplicate teamIDs.
func keySetToTeamIDs(dbKeySet libkb.DBKeySet) ([]keybase1.TeamID, error) {
	seen := make(map[keybase1.TeamID]bool)
	teamIDs := make([]keybase1.TeamID, 0, len(dbKeySet))
	for dbKey := range dbKeySet {
		teamID, err := ParseTeamIDDBKey(dbKey.Key)
		if err != nil {
			return nil, err
		}
		_, ok := seen[teamID]
		if !ok {
			teamIDs = append(teamIDs, teamID)
			seen[teamID] = true
		}
	}
	return teamIDs, nil
}

type Version int
type Versioned interface {
	GetVersion() Version
}

func BoxAuditLogDbKey(teamID keybase1.TeamID) libkb.DbKey {
	return libkb.DbKey{Typ: libkb.DBBoxAuditor, Key: string(teamID)}
}

func BoxAuditQueueDbKey() libkb.DbKey {
	return libkb.DbKey{Typ: libkb.DBBoxAuditorPermanent, Key: "queue"}
}

func BoxAuditJailDbKey() libkb.DbKey {
	return libkb.DbKey{Typ: libkb.DBBoxAuditorPermanent, Key: "jail"}
}

func (a *BoxAuditor) maybeGetLog(mctx libkb.MetaContext, teamID keybase1.TeamID) (*BoxAuditLog, error) {
	var log BoxAuditLog
	found, err := a.maybeGetIntoVersioned(mctx, &log, BoxAuditLogDbKey(teamID))
	if err != nil || !found {
		return nil, err
	}
	return &log, nil
}

func (a *BoxAuditor) maybeGetQueue(mctx libkb.MetaContext) (*BoxAuditQueue, error) {
	var queue BoxAuditQueue
	found, err := a.maybeGetIntoVersioned(mctx, &queue, BoxAuditQueueDbKey())
	if err != nil || !found {
		return nil, err
	}
	return &queue, nil
}

func (a *BoxAuditor) maybeGetJail(mctx libkb.MetaContext) (*BoxAuditJail, error) {
	var jail BoxAuditJail
	found, err := a.maybeGetIntoVersioned(mctx, &jail, BoxAuditJailDbKey())
	if err != nil || !found {
		return nil, err
	}
	return &jail, nil
}

func (a *BoxAuditor) maybeGetIntoVersioned(mctx libkb.MetaContext, v Versioned, dbKey libkb.DbKey) (found bool, err error) {
	defer mctx.TraceTimed("maybeGetVersioned", func() error { return err })()
	found, err = mctx.G().LocalDb.GetInto(v, dbKey)
	if err != nil {
		mctx.Warning("Failed to unmarshal from db for key %+v: %s", dbKey, err)
		// Ignoring corruption; pretend it doesn't exist
		return false, nil
	}
	if !found {
		return false, nil
	}
	if v.GetVersion() != a.Version {
		mctx.Debug("Not returning outdated obj at version %d (now at version %d)", v.GetVersion(), a.Version)
		// We do not delete the old data.
		return false, nil
	}
	return true, nil
}

func putLogToDisk(mctx libkb.MetaContext, log *BoxAuditLog, teamID keybase1.TeamID) error {
	return putToDisk(mctx, BoxAuditLogDbKey(teamID), log)
}

func putQueueToDisk(mctx libkb.MetaContext, queue *BoxAuditQueue) error {
	return putToDisk(mctx, BoxAuditQueueDbKey(), queue)
}

func putJailToDisk(mctx libkb.MetaContext, jail *BoxAuditJail) error {
	return putToDisk(mctx, BoxAuditJailDbKey(), jail)
}

func putToDisk(mctx libkb.MetaContext, dbKey libkb.DbKey, i interface{}) error {
	return mctx.G().LocalDb.PutObj(dbKey, nil, i)
}

func KnownTeamIDs(mctx libkb.MetaContext) (teamIDs []keybase1.TeamID, err error) {
	defer mctx.TraceTimed("KnownTeamID", func() error { return err })()
	db := mctx.G().LocalDb
	if db == nil {
		return nil, fmt.Errorf("nil db")
	}
	dbKeySet, err := db.KeysWithPrefixes(libkb.LevelDbPrefix(libkb.DBSlowTeamsAlias), libkb.LevelDbPrefix(libkb.DBFTLStorage))
	if err != nil {
		return nil, err
	}
	teamIDs, err = keySetToTeamIDs(dbKeySet)
	if err != nil {
		return nil, err
	}
	return teamIDs, nil
}

func randomKnownTeamID(mctx libkb.MetaContext) (teamID *keybase1.TeamID, err error) {
	knownTeamIDs, err := KnownTeamIDs(mctx)
	if err != nil {
		return nil, err
	}
	N := len(knownTeamIDs)
	if N == 0 {
		return nil, nil
	}
	idx, err := rand.Int(rand.Reader, big.NewInt(int64(N))) // [0, n)
	if err != nil {
		return nil, err
	}
	return &knownTeamIDs[idx.Int64()], nil
}
