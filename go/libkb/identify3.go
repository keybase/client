package libkb

import (
	"encoding/hex"
	"sync"
	"time"

	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	context "golang.org/x/net/context"
	"golang.org/x/sync/errgroup"
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
	didExpire   bool // true if we ran an expire on this session (so we don't repeat)
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
	mctx.Debug("generated new identify3 session: %s", id)
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

func (s *Identify3Session) OutcomeLocked() *IdentifyOutcome {
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

	cancelFunc context.CancelFunc
	expireCh   chan<- struct{}
	eg         errgroup.Group

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
	expireCh := make(chan struct{})
	mctx, cancelFunc := NewMetaContextBackground(g).WithContextCancel()
	ret := &Identify3State{
		cancelFunc:       cancelFunc,
		expireCh:         expireCh,
		cache:            make(map[keybase1.Identify3GUIID](*Identify3Session)),
		defaultWaitTime:  time.Hour,
		expireTime:       24 * time.Hour,
		testCompletionCh: testCompletionCh,
		shutdown:         false,
	}
	ret.makeNewCache()
	ret.eg.Go(func() error { return ret.runExpireThread(mctx, expireCh) })
	g.PushShutdownHook(ret.Shutdown)
	ret.pokeExpireThread()

	return ret
}

func (s *Identify3State) Shutdown(mctx MetaContext) (err error) {
	defer mctx.Trace("Identify3State#Shutdown", func() error { return err })()
	s.shutdownMu.Lock()
	defer s.shutdownMu.Unlock()

	if s.isShutdownLocked() {
		return nil
	}
	s.cancelFunc()
	// block until runExpireThread has exited
	mctx.Debug("waiting on runExpireThread to complete")
	err = s.eg.Wait()
	s.shutdown = true
	return err
}

func (s *Identify3State) isShutdown() bool {
	s.shutdownMu.Lock()
	defer s.shutdownMu.Unlock()
	return s.isShutdownLocked()
}

func (s *Identify3State) isShutdownLocked() bool {
	return s.shutdown
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

func (s *Identify3State) runExpireThread(mctx MetaContext, expireCh <-chan struct{}) error {
	wait := s.defaultWaitTime

	nowFn := func() time.Time { return mctx.G().Clock().Now() }
	now := nowFn()
	wakeupTime := now.Add(wait)

	for {
		select {
		case <-mctx.Ctx().Done():
			mctx.Debug("identify3State#runExpireThread: exiting on canceled context")
			if s.testCompletionCh != nil {
				// signal to tests that this thing really shut down
				close(s.testCompletionCh)
				s.testCompletionCh = nil
			}
			return nil
		case <-expireCh:
		case <-mctx.G().Clock().AfterTime(wakeupTime):
			mctx.Debug("identify3State#runExpireThread: wakeup after %v timeout (at %v)", wait, wakeupTime)
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

func (s *Identify3Session) doExpireSession(mctx MetaContext) {
	defer mctx.Trace("Identify3Session#doExpireSession", func() error { return nil })()
	s.Lock()
	defer s.Unlock()
	mctx.Debug("Identify3Session#doExpireSession(%s)", s.id)

	if s.didExpire {
		mctx.Warning("not repeating session expire for %s", s.id)
		return
	}
	s.didExpire = true

	cli, err := mctx.G().UIRouter.GetIdentify3UI(mctx)
	if err != nil {
		mctx.Warning("failed to get an electron UI to expire %s: %s", s.id, err)
		return
	}
	if cli == nil {
		mctx.Warning("failed to get an electron UI to expire %s: got nil", s.id)
		return
	}
	err = cli.Identify3TrackerTimedOut(mctx.Ctx(), s.id)
	if err != nil {
		mctx.Warning("error timing ID3 session %s: %s", s.id, err)
	}
}

func (s *Identify3State) expireSessions(mctx MetaContext, now time.Time) time.Duration {
	defer mctx.Trace("Identify3State#expireSessions", func() error { return nil })()

	// getSesionsToExpire holds the Identify3State Mutex.
	toExpire, diff := s.getSessionsToExpire(mctx, now)

	// doExpireSessions does not hold the Identify3State Mutex, because it
	// calls out to the front end via Identify3TrackedTimedOut.
	s.doExpireSessions(mctx, toExpire)

	return diff
}

func (s *Identify3State) doExpireSessions(mctx MetaContext, toExpire []*Identify3Session) {
	for _, sess := range toExpire {
		select {
		case <-mctx.Ctx().Done():
			return
		default:
			sess.doExpireSession(mctx)
		}
	}
}

func (s *Identify3State) getSessionsToExpire(mctx MetaContext, now time.Time) (ret []*Identify3Session, diff time.Duration) {
	s.Lock()
	defer s.Unlock()

	for {
		select {
		case <-mctx.Ctx().Done():
			return []*Identify3Session{}, diff
		default:
		}

		if len(s.expirationQueue) == 0 {
			return ret, s.defaultWaitTime
		}
		var sess *Identify3Session
		sess, diff = s.getSessionToExpire(mctx, now)
		if diff > 0 {
			return ret, diff
		}
		if sess != nil {
			ret = append(ret, sess)
		}
	}
}

// getSessionToExpire should be called when holding the Identify3State Mutex. It looks in the
// expiration queue and pops off those sessions that are ready to be marked expired.
func (s *Identify3State) getSessionToExpire(mctx MetaContext, now time.Time) (*Identify3Session, time.Duration) {
	sess := s.expirationQueue[0]
	sess.Lock()
	defer sess.Unlock()
	expireAt := sess.created.Add(s.expireTime)
	diff := expireAt.Sub(now)
	if diff > 0 {
		return nil, diff
	}
	s.expirationQueue = s.expirationQueue[1:]

	// Only send the expiration if the session is still in the cache table.
	// If not, that means it was already acted upon
	if _, found := s.cache[sess.id]; !found {
		return nil, diff
	}
	mctx.Debug("Identify3State#getSessionToExpire: removing %s", sess.id)
	s.removeFromTableLocked(sess.id)
	return sess, diff
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
