package auth

import (
	libkb "github.com/keybase/client/go/libkb"
	logger "github.com/keybase/client/go/logger"
	keybase1 "github.com/keybase/client/go/protocol"
	context "golang.org/x/net/context"
	"time"
)

const (
	userTimeout  = 5 * time.Minute
	cacheTimeout = 8 * time.Minute
)

// CredentialAuthority should be allocated as a singleton object. It validates UID<->Username<->ActiveKey
// triples for all users across a service. It keeps a cache and subscribes for updates,
// so you can call into it as much as you'd like without fear of spamming the network.
type CredentialAuthority struct {
	log           logger.Logger
	api           UserKeyAPIer
	invalidateCh  chan keybase1.UID
	checkCh       chan checkArg
	shutdownCh    chan struct{}
	cleanItemCh   chan cleanItem
	users         map[keybase1.UID](*userWrapper)
	cleanSchedule []cleanItem
	eng           engine
}

// checkArgs are sent over the checkCh to the core loop of a CredentialAuthority
type checkArg struct {
	uid      keybase1.UID
	username *libkb.NormalizedUsername
	kid      *keybase1.KID
	retCh    chan error
}

// userWrapper contains two fields -- one is the user object itself, which will
// spawn a go-routine that is largely off-limits to the main thread aside from
// over channels. the second field is the `atime`, or *access* time, which the main
// thread can touch to compute eviction mechanics.
type userWrapper struct {
	u     *user
	atime time.Time
}

// cleanItems are items to consider cleaning out of the cache. they sit in a queue
// until they are up for review. When the review happens, the user object they
// refer to can still persist in the cache, if it's been accessed recently.
type cleanItem struct {
	uid   keybase1.UID
	ctime time.Time
}

// user wraps a user who is currently active in the system. Each user has a run
// method that runs its own goRoutine, so many items, aside from the two channels,
// are off-limits to the main thread.
type user struct {
	uid      keybase1.UID
	username libkb.NormalizedUsername
	keys     map[keybase1.KID]struct{}
	isOK     bool
	ctime    time.Time
	ca       *CredentialAuthority
	checkCh  chan checkArg
	stopCh   chan struct{}
}

// newUser makes a new user with the given UID for use in the given
// CredentialAuthority. This constructor sets up the necessary maps and
// channels to make the user work as expected.
func newUser(uid keybase1.UID, ca *CredentialAuthority) *user {
	ret := &user{
		uid:     uid,
		keys:    make(map[keybase1.KID]struct{}),
		ca:      ca,
		checkCh: make(chan checkArg),
		stopCh:  make(chan struct{}),
	}
	go ret.run()
	return ret
}

// UserKeyAPIer is an interface that specifies the UserKeyAPI that
// will eventually be used to get information about the users from the trusted
// server authority.
type UserKeyAPIer interface {
	// GetUser looks up the username and KIDS active for the given user.
	GetUser(context.Context, keybase1.UID) (libkb.NormalizedUsername, []keybase1.KID, error)
	// PollForChanges returns the UIDs that have recently changed on the server
	// side. It will be called in a poll loop.
	PollForChanges(context.Context) ([]keybase1.UID, error)
}

// engine specifies the internal mechanics of how this CredentialAuthority
// works. It's only really useful for testing, since tests will want to change
// the definition of time, poke the main loop into action at certain points,
// and get callback hooks when items are evicted.
type engine interface {
	Now() time.Time             // we can overload this for debugging
	Evicted(uid keybase1.UID)   // called when this uid is evicted
	GetPokeCh() <-chan struct{} // Return a channel that can poke the main loop
}

// standardEngine is the engine that's used in production when the CredentailAuthority
// actually runs. It does very little.
type standardEngine struct {
	pokeCh <-chan struct{}
}

// Now returns time.Now
func (se *standardEngine) Now() time.Time { return time.Now() }

// Evicted is a Noop, called whenever a user object for the given UID is evicted.
func (se *standardEngine) Evicted(uid keybase1.UID) {}

// GetPokeCh returns a dummy channel that's never sent to
func (se *standardEngine) GetPokeCh() <-chan struct{} { return se.pokeCh }

// newStandardEngine creates and initializes a standardEngine for use in the
// production run of a CredentialAuthority.
func newStandardEngine() engine {
	return &standardEngine{
		pokeCh: make(chan struct{}),
	}
}

// NewCredentialAuthority makes a new signleton CredentialAuthority an start it running. It takes as input
// a logger and an API for making keybase API calls
func NewCredentialAuthority(log logger.Logger, api UserKeyAPIer) *CredentialAuthority {
	return newCredentialAuthorityWithEngine(log, api, newStandardEngine())
}

// newCredentialAuthoirutyWithEngine is an internal call that can specify the non-standard
// engine. We'd only need to call this directly from testing to specify a testingEngine.
func newCredentialAuthorityWithEngine(log logger.Logger, api UserKeyAPIer, eng engine) *CredentialAuthority {
	ret := &CredentialAuthority{
		log:          log,
		api:          api,
		invalidateCh: make(chan keybase1.UID, 100),
		checkCh:      make(chan checkArg),
		shutdownCh:   make(chan struct{}),
		users:        make(map[keybase1.UID](*userWrapper)),
		cleanItemCh:  make(chan cleanItem),
		eng:          eng,
	}
	ret.run()
	return ret
}

// run two loops in goroutines: one to poll for updates from the server, and
// another to poll for incoming requests and maintenance events.
func (v *CredentialAuthority) run() {
	go v.pollLoop()
	go v.runLoop()
}

// pollOnce polls the API server once for which users have changed.
func (v *CredentialAuthority) pollOnce() error {
	var err error
	var uids []keybase1.UID
	err = v.runWithCancel(func(ctx context.Context) error {
		var err error
		uids, err = v.api.PollForChanges(ctx)
		return err
	})
	if err == nil {
		for _, uid := range uids {
			v.invalidateCh <- uid
		}
	}
	return err
}

// runWithCancel runs an API call while listening for a shutdown of the CredentialAuthority.
// If it gets one, it uses context-based cancelation to cancel the outstanding API call
// (or sleep in the case of Poll()'ing).
func (v *CredentialAuthority) runWithCancel(body func(ctx context.Context) error) error {
	ctx, cancel := context.WithCancel(context.Background())
	doneCh := make(chan struct{})
	var err error

	go func() {
		err = body(ctx)
		doneCh <- struct{}{}
	}()

	select {
	case <-doneCh:
	case <-v.shutdownCh:
		cancel()
		err = ErrShutdown
	}
	return err
}

// pollLoop() keeps running until the CA is shut down via Shutdown(). It calls Poll()
// on the UserKeyAPIer once per iteration.
func (v *CredentialAuthority) pollLoop() {
	var err error
	for err != ErrShutdown {
		err = v.pollOnce()
	}
}

// runLoop() keeps running until the CA is shut down via Shutdown(). It listens
// for incoming client requests, and also for various maintenance takes, and
// cache invalidations.
func (v *CredentialAuthority) runLoop() {
	done := false
	for !done {
		select {
		case <-v.eng.GetPokeCh():
			// Noop, but poke main loop for testing.
		case <-v.shutdownCh:
			done = true
		case ca := <-v.checkCh:
			u := v.makeUser(ca.uid)
			go u.sendCheck(ca)
		case uid := <-v.invalidateCh:
			if uw := v.users[uid]; uw != nil {
				delete(v.users, uid)
				go uw.u.sendStop()
			}
		case ci := <-v.cleanItemCh:
			v.cleanSchedule = append(v.cleanSchedule, ci)
		}
		v.clean()
	}
}

// clean out in-memory data, going through in FIFO order. Stop once we've hit
// a cleanItem that's too recent. When we iterate over cleanItems, we don't
// need to throw them out necessarily, if they've been accessed recently. In that
// case, just skip and keep going.
//
// We'll get an entry in the cleanSchedule once for ever call to GetUser() on
// the API server.
func (v *CredentialAuthority) clean() {
	cutoff := v.eng.Now().Add(-cacheTimeout)
	for i, e := range v.cleanSchedule {
		if e.ctime.After(cutoff) {
			v.cleanSchedule = v.cleanSchedule[i:]
			return
		}
		if uw := v.users[e.uid]; uw != nil && !uw.atime.After(e.ctime) {
			delete(v.users, e.uid)
			go uw.u.sendStop()
		}
	}
	v.cleanSchedule = nil
}

// makeUser either pulls a user from the in-memory table, or constructs a new
// one. In either case, it updates the CA's `atime` bit for now for this user
// record.
func (v *CredentialAuthority) makeUser(uid keybase1.UID) *user {
	uw := v.users[uid]
	if uw == nil {
		u := newUser(uid, v)
		uw = &userWrapper{u: u}
		v.users[uid] = uw
	}
	uw.atime = v.eng.Now()
	return uw.u
}

// sendCheck sends a message to the user object that it should check the given
// user.
func (u *user) sendCheck(ca checkArg) {
	u.checkCh <- ca
}

// sendStop sends a message to a user object that it has been evicted, and
// therefore, that it should stop whatever it's doing and just exit its
// go routine.
func (u *user) sendStop() {
	u.stopCh <- struct{}{}
}

// Each user object has its own run() routine. It handles requests for checks,
// requests to stop, or requests to shutdown.
func (u *user) run() {
	done := false
	for !done {
		select {
		case ca := <-u.checkCh:
			u.check(ca)
		case <-u.stopCh:
			done = true
		case <-u.ca.shutdownCh:
			done = true
		}
	}
	u.ca.eng.Evicted(u.uid)
}

// Now return this CA's idea of what time Now is.
func (u user) Now() time.Time { return u.ca.eng.Now() }

// repopulate is intended to repopulate our representation of the user with the
// server's up-to-date notion of what the user looks like. If our version is recent
// enough, this is a no-op.  If not, we'll go to the server and send the main loop
// a "Cleanup" event to eventually clean us out.
func (u *user) repopulate() error {
	if u.isPopulated() {
		return nil
	}

	// Register that this item should eventually be cleaned out by the cleaner
	// thread. Don't block on the send, though, since that could deadlock the process
	// (since the process is blocked on sending to us).
	ctime := u.Now()
	go func() {
		u.ca.cleanItemCh <- cleanItem{uid: u.uid, ctime: ctime}
	}()

	un, keys, err := u.ca.getUserFromServer(u.uid)
	if err != nil {
		u.isOK = false
		return err
	}
	u.username = un
	for _, k := range keys {
		u.keys[k] = struct{}{}
	}
	u.isOK = true
	u.ctime = ctime
	return nil
}

// isPopulated returned true if this user is populated and current enough to
// trust.
func (u *user) isPopulated() bool {
	return u.isOK && u.Now().Sub(u.ctime) <= userTimeout
}

// check that a user matches the given username and has the given key as one of
// its valid keys. This is where the actually work of this whole library happens.
func (u *user) check(ca checkArg) {
	var err error

	defer func() {
		ca.retCh <- err
	}()

	if err = u.repopulate(); err != nil {
		return
	}

	if ca.username != nil {
		if err = u.checkUsername(*ca.username); err != nil {
			return
		}
	}

	if ca.kid != nil {
		if err = u.checkKey(*ca.kid); err != nil {
			return
		}
	}

	return
}

// getUserFromServer runs the UserKeyAPIer GetUser() API call while paying
// attention to any shutdown events that might interrupt it.
func (v *CredentialAuthority) getUserFromServer(uid keybase1.UID) (un libkb.NormalizedUsername, kids []keybase1.KID, err error) {
	err = v.runWithCancel(func(ctx context.Context) error {
		var err error
		un, kids, err = v.api.GetUser(ctx, uid)
		return err
	})
	return un, kids, err
}

// checkUsername checks that a username is a match for this user.
func (u *user) checkUsername(un libkb.NormalizedUsername) error {
	var err error
	if !u.username.Eq(un) {
		err = BadUsernameError{u.username, un}
	}
	return err
}

// checkKey checks that the given key is still valid for this user.
func (u *user) checkKey(kid keybase1.KID) error {
	var err error
	if _, ok := u.keys[kid]; !ok {
		err = BadKeyError{u.uid, kid}
	}
	return err
}

// CheckUserKey is the main point of entry to this library. It takes as input a UID, a
// username and a kid that should refer to a current valid triple, perhaps
// extracted from a signed authentication statement. It returns an error if the
// check fails, and nil otherwise. If username or kid are nil they aren't checked.
func (v *CredentialAuthority) CheckUserKey(ctx context.Context, uid keybase1.UID,
	username *libkb.NormalizedUsername, kid *keybase1.KID) (err error) {
	retCh := make(chan error)
	v.checkCh <- checkArg{uid: uid, username: username, kid: kid, retCh: retCh}
	select {
	case <-ctx.Done():
		err = ErrCanceled
	case err = <-retCh:
	}
	return err
}

// CheckUsers is used to validate all provided UIDs are known.
func (v *CredentialAuthority) CheckUsers(ctx context.Context, users []keybase1.UID) (err error) {
	for _, uid := range users {
		if uid == keybase1.PUBLIC_UID {
			continue
		}
		if err = v.CheckUserKey(ctx, uid, nil, nil); err != nil {
			break
		}
	}
	return err
}

// Shutdown the credentialAuthority and delete all internal state.
func (v *CredentialAuthority) Shutdown() {
	close(v.shutdownCh)
}
