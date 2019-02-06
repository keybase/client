package libkb

import (
	"encoding/hex"
	"sync"
	"time"

	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

// Identify3Session corresponds to a single screen showing a user profile.
// It maps 1:1 with an Identify2GUIID, and is labeled as such. Here we'll keep
// track of whatever context we need to pass across calls, and also the TrackToken
// for the final result.
type Identify3Session struct {
	sync.Mutex
	created     time.Time
	id          keybase1.Identify3GUIID
	outcome     *IdentifyOutcome
	trackBroken bool
	needUpgrade bool
}

func NewIdentify3GUIID() (keybase1.Identify3GUIID, error) {
	var b []byte
	l := 12
	b, err := RandBytes(l)
	if err != nil {
		return keybase1.Identify3GUIID(""), err
	}
	b[l-1] = 0x34
	return keybase1.Identify3GUIID(hex.EncodeToString(b)), nil
}

func NewIdentify3SessionWithID(mctx MetaContext, id keybase1.Identify3GUIID) *Identify3Session {
	return &Identify3Session{
		created: mctx.G().GetClock().Now(),
		id:      id,
	}
}

func NewIdentify3Session(mctx MetaContext) (*Identify3Session, error) {
	id, err := NewIdentify3GUIID()
	if err != nil {
		return nil, err
	}
	ret := &Identify3Session{
		created: mctx.G().GetClock().Now(),
		id:      id,
	}
	mctx.CDebugf("generated new identify3 session: %s", id)
	return ret, nil
}

func (s *Identify3Session) ID() keybase1.Identify3GUIID {
	s.Lock()
	defer s.Unlock()
	return s.id
}

func (s *Identify3Session) ResultType() keybase1.Identify3ResultType {
	s.Lock()
	defer s.Unlock()
	switch {
	case s.trackBroken:
		return keybase1.Identify3ResultType_BROKEN
	case s.needUpgrade:
		return keybase1.Identify3ResultType_NEEDS_UPGRADE
	default:
		return keybase1.Identify3ResultType_OK
	}
}

func (s *Identify3Session) OutcomeUnlocked() *IdentifyOutcome {
	return s.outcome
}

func (s *Identify3Session) SetTrackBroken() {
	s.Lock()
	defer s.Unlock()
	s.trackBroken = true
}

func (s *Identify3Session) SetNeedUpgrade() {
	s.Lock()
	defer s.Unlock()
	s.needUpgrade = true
}

func (s *Identify3Session) SetOutcome(o *IdentifyOutcome) {
	s.Lock()
	defer s.Unlock()
	s.outcome = o
}

// Identify3State keeps track of all active ID3 state across the whole app. It has
// a cache that's periodically cleaned up.
type Identify3State struct {
	sync.Mutex

	expireCh chan<- struct{}

	// Table of keybase1.Identify3GUIID -> *identify3Session's
	cache           map[keybase1.Identify3GUIID](*Identify3Session)
	expirationQueue [](*Identify3Session)

	defaultWaitTime time.Duration
	expireTime      time.Duration

	bgThreadTimeMu   sync.Mutex
	testCompletionCh chan<- time.Time

	shutdownMu sync.Mutex
	shutdown   bool
}

func NewIdentify3State(g *GlobalContext) *Identify3State {
	return newIdentify3State(g, nil)
}

func NewIdentify3StateForTest(g *GlobalContext) (*Identify3State, <-chan time.Time) {
	ch := make(chan time.Time, 1000)
	state := newIdentify3State(g, ch)
	return state, ch
}

func newIdentify3State(g *GlobalContext, testCompletionCh chan<- time.Time) *Identify3State {
	ch := make(chan struct{})
	ret := &Identify3State{
		expireCh:         ch,
		cache:            make(map[keybase1.Identify3GUIID](*Identify3Session)),
		defaultWaitTime:  time.Hour,
		expireTime:       24 * time.Hour,
		testCompletionCh: testCompletionCh,
	}
	ret.makeNewCache()
	go ret.runExpireThread(g, ch)
	ret.pokeExpireThread()
	return ret
}

func (s *Identify3State) Shutdown() {
	if s.markShutdown() {
		close(s.expireCh)
	}
}

func (s *Identify3State) isShutdown() bool {
	s.shutdownMu.Lock()
	defer s.shutdownMu.Unlock()
	return s.shutdown
}

// markShutdown marks this state as having shutdown. Will return true the first
// time through, and false every other time.
func (s *Identify3State) markShutdown() bool {
	s.shutdownMu.Lock()
	defer s.shutdownMu.Unlock()
	if s.shutdown {
		return false
	}
	s.shutdown = true
	return true
}

func (s *Identify3State) makeNewCache() {
	s.Lock()
	s.cache = make(map[keybase1.Identify3GUIID](*Identify3Session))
	s.expirationQueue = nil
	s.Unlock()
}

func (s *Identify3State) OnLogout() {
	s.makeNewCache()
	s.pokeExpireThread()
}

func (s *Identify3State) runExpireThread(g *GlobalContext, ch <-chan struct{}) {

	mctx := NewMetaContextBackground(g)
	wait := s.defaultWaitTime

	nowFn := func() time.Time { return mctx.G().Clock().Now() }
	now := nowFn()
	wakeupTime := now.Add(wait)

	for {

		select {
		case _, ok := <-ch:
			if !ok {
				mctx.CDebugf("identify3State#runExpireThread: exiting on shutdown")
				return
			}
		case <-mctx.G().Clock().AfterTime(wakeupTime):
			mctx.CDebugf("identify3State#runExpireThread: wakeup after %v timeout (at %v)", wait, wakeupTime)

		}

		// Guard all time manipulation in a lock for the purposes of testing.
		// In real life, this shouldn't matter much, but it can't really hurt.
		s.bgThreadTimeMu.Lock()
		now = nowFn()
		wait = s.expireSessions(mctx, now)
		wakeupTime = now.Add(wait)
		s.bgThreadTimeMu.Unlock()

		// Also for the purposes of test, broadcast how far we've processing in time.
		// In real life, this will be a noop, since s.testCompletionCh will be nil
		if s.testCompletionCh != nil {
			s.testCompletionCh <- now
		}
	}
}

func (s *Identify3Session) expire(mctx MetaContext) {
	cli, err := mctx.G().UIRouter.GetIdentify3UI(mctx)
	if err != nil {
		mctx.CWarningf("failed to get an electron UI to expire %s: %s", s.id, err)
		return
	}
	if cli == nil {
		mctx.CWarningf("failed to get an electron UI to expire %s: got nil", s.id)
		return
	}
	err = cli.Identify3TrackerTimedOut(mctx.Ctx(), s.id)
	if err != nil {
		mctx.CWarningf("error timing ID3 session %s: %s", s.id, err)
	}
}

func (s *Identify3State) expireSessions(mctx MetaContext, now time.Time) time.Duration {
	s.Lock()
	defer s.Unlock()

	for {
		if len(s.expirationQueue) == 0 {
			return s.defaultWaitTime
		}
		diff := s.expireSession(mctx, s.expirationQueue[0], now)
		if diff > 0 {
			return diff
		}
	}
}

func (s *Identify3State) expireSession(mctx MetaContext, sess *Identify3Session, now time.Time) time.Duration {
	sess.Lock()
	defer sess.Unlock()
	expireAt := sess.created.Add(s.expireTime)
	diff := expireAt.Sub(now)
	if diff > 0 {
		return diff
	}
	s.expirationQueue = s.expirationQueue[1:]

	// Only send the expiration if the session is still in the cache table.
	// If not, that means it was already acted upon
	if _, found := s.cache[sess.id]; found {
		sess.expire(mctx)
		s.removeFromTableLocked(sess.id)
	}
	return diff
}

// get an identify3Session out of the cache, as keyed by a Identify3GUIID. Return
// (nil, nil) if not found. Return (nil, Error) if there was an expected error.
// Return (i, nil) if found, where i is the **unlocked** object.
func (s *Identify3State) Get(key keybase1.Identify3GUIID) (ret *Identify3Session, err error) {
	s.Lock()
	defer s.Unlock()
	return s.getLocked(key)
}

func (s *Identify3State) getLocked(key keybase1.Identify3GUIID) (ret *Identify3Session, err error) {
	ret, found := s.cache[key]
	if !found {
		return nil, nil
	}
	return ret, nil
}

func (s *Identify3State) Put(sess *Identify3Session) error {
	err := s.lockAndPut(sess)
	s.pokeExpireThread()
	return err
}

func (s *Identify3State) lockAndPut(sess *Identify3Session) error {
	s.Lock()
	defer s.Unlock()

	id := sess.ID()
	tmp, err := s.getLocked(id)
	if err != nil {
		return err
	}
	if tmp != nil {
		return ExistsError{Msg: "Identify3 ID already exists"}
	}
	s.cache[id] = sess
	s.expirationQueue = append(s.expirationQueue, sess)
	return nil
}

func (s *Identify3State) Remove(key keybase1.Identify3GUIID) {
	s.Lock()
	defer s.Unlock()
	s.removeFromTableLocked(key)
}

func (s *Identify3State) removeFromTableLocked(key keybase1.Identify3GUIID) {
	delete(s.cache, key)
}

// pokeExpireThread should never be called when holding s.Mutex.
func (s *Identify3State) pokeExpireThread() {
	if s.isShutdown() {
		return
	}
	s.expireCh <- struct{}{}
}
