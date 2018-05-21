package auth

import (
	"fmt"
	"time"

	libkb "github.com/keybase/client/go/libkb"
	logger "github.com/keybase/client/go/logger"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	context "golang.org/x/net/context"
)

const (
	userTimeout  = 3 * time.Hour
	cacheTimeout = 8 * time.Hour
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
	uid         keybase1.UID
	username    *libkb.NormalizedUsername
	kid         *keybase1.KID
	sibkeys     []keybase1.KID
	subkeys     []keybase1.KID
	loadDeleted bool
	retCh       chan error
}

// String implements the Stringer interface for checkArg.
func (ca checkArg) String() string {
	return fmt.Sprintf("{uid: %s, username: %s, kid: %s, sibkeys: %v, subkeys: %v}",
		ca.uid, ca.username, ca.kid, ca.sibkeys, ca.subkeys)
}

// userWrapper contains two fields -- one is the user object itself, which will
// spawn a go-routine that is largely off-limits to the main thread aside from
// over channels. the second field is the `atime`, or *access* time, which the main
// thread can touch to compute eviction mechanics.
type userWrapper struct {
	u     *user
	atime time.Time
}

// String implements the Stringer interface for userWrapper.
func (uw userWrapper) String() string {
	return fmt.Sprintf("{user: %s, atime: %s}", uw.u, uw.atime)
}

// cleanItems are items to consider cleaning out of the cache. they sit in a queue
// until they are up for review. When the review happens, the user object they
// refer to can still persist in the cache, if it's been accessed recently.
type cleanItem struct {
	uid   keybase1.UID
	ctime time.Time
}

// String implements the Stringer interface for cleanItem.
func (ci cleanItem) String() string {
	return fmt.Sprintf("{uid: %s, ctime: %s}", ci.uid, ci.ctime)
}

// user wraps a user who is currently active in the system. Each user has a run
// method that runs its own goRoutine, so many items, aside from the two channels,
// are off-limits to the main thread.
type user struct {
	uid       keybase1.UID
	username  libkb.NormalizedUsername
	sibkeys   map[keybase1.KID]struct{}
	subkeys   map[keybase1.KID]struct{}
	isOK      bool
	isDeleted bool
	ctime     time.Time
	ca        *CredentialAuthority
	checkCh   chan checkArg
	stopCh    chan struct{}
}

// String implements the stringer interface for user.
func (u user) String() string {
	return fmt.Sprintf("{uid: %s, username: %s, sibkeys: %v, subkeys: %v, isOK: %v, ctime: %s, isDeleted: %v}",
		u.uid, u.username, u.sibkeys, u.subkeys, u.isOK, u.ctime, u.isDeleted)
}

// newUser makes a new user with the given UID for use in the given
// CredentialAuthority. This constructor sets up the necessary maps and
// channels to make the user work as expected.
func newUser(uid keybase1.UID, ca *CredentialAuthority) *user {
	ca.log.Debug("newUser, uid %s", uid)
	ret := &user{
		uid:     uid,
		sibkeys: make(map[keybase1.KID]struct{}),
		subkeys: make(map[keybase1.KID]struct{}),
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
	// Deleted users are loaded by default.
	GetUser(context.Context, keybase1.UID) (
		un libkb.NormalizedUsername, sibkeys, subkeys []keybase1.KID, deleted bool, err error)
	// PollForChanges returns the UIDs that have recently changed on the server
	// side. It will be called in a poll loop. This call should function as
	// a *long poll*, meaning, it should not return unless there is a change
	// to report, or a sufficient amount of time has passed. If an error occurred,
	// then PollForChanges should delay before return, so we don't wind up
	// busy-waiting.
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
	doneCh := make(chan error)
	var err error

	go func() {
		doneCh <- body(ctx)
	}()

	select {
	case err = <-doneCh:
	case <-v.shutdownCh:
		cancel()
		err = ErrShutdown
	}
	return err
}

// pollLoop() keeps running until the CA is shut down via Shutdown(). It calls Poll()
// on the UserKeyAPIer once per iteration.
func (v *CredentialAuthority) pollLoop() {
	for {
		// We rely on pollOnce to not return right away, so we don't busy loop.
		if v.pollOnce() == ErrShutdown {
			break
		}
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
			v.log.Debug("Checking %s", ca)
			u := v.makeUser(ca.uid)
			go u.sendCheck(ca)
		case uid := <-v.invalidateCh:
			if uw := v.users[uid]; uw != nil {
				v.log.Debug("Invalidating %s", uw)
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
			v.log.Debug("Cleaning %s, clean entry: %s", uw, e)
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
			u.ca.log.Debug("Stopping user loop for %s", u)
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

	un, sibkeys, subkeys, isDeleted, err := u.ca.getUserFromServer(u.uid)
	if err != nil {
		u.isOK = false
		return err
	}
	u.username = un
	for _, k := range sibkeys {
		u.sibkeys[k] = struct{}{}
	}
	for _, k := range subkeys {
		u.subkeys[k] = struct{}{}
	}
	u.isOK = true
	u.ctime = ctime
	u.isDeleted = isDeleted
	u.ca.log.Debug("Repopulated info for %s", u)
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
		u.ca.log.Debug("Check %s, err: %v", ca, err)
		ca.retCh <- err
	}()

	if err = u.repopulate(); err != nil {
		return
	}

	if !ca.loadDeleted && u.isDeleted {
		err = ErrUserDeleted
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

	if ca.sibkeys != nil {
		if err = u.compareSibkeys(ca.sibkeys); err != nil {
			return
		}
	}

	if ca.subkeys != nil {
		if err = u.compareSubkeys(ca.subkeys); err != nil {
			return
		}
	}
}

// getUserFromServer runs the UserKeyAPIer GetUser() API call while paying
// attention to any shutdown events that might interrupt it.
func (v *CredentialAuthority) getUserFromServer(uid keybase1.UID) (
	un libkb.NormalizedUsername, sibkeys, subkeys []keybase1.KID, deleted bool, err error) {
	err = v.runWithCancel(func(ctx context.Context) error {
		var err error
		un, sibkeys, subkeys, deleted, err = v.api.GetUser(ctx, uid)
		return err
	})
	return un, sibkeys, subkeys, deleted, err
}

// checkUsername checks that a username is a match for this user.
func (u *user) checkUsername(un libkb.NormalizedUsername) error {
	var err error
	if !u.username.Eq(un) {
		err = BadUsernameError{u.username, un}
	}
	return err
}

// compareSibkeys returns true if the passed set of sibkeys is equal.
func (u *user) compareSibkeys(sibkeys []keybase1.KID) error {
	return compareKeys(sibkeys, u.sibkeys)
}

// compareSubkeys returns true if the passed set of subkeys is equal.
func (u *user) compareSubkeys(subkeys []keybase1.KID) error {
	return compareKeys(subkeys, u.subkeys)
}

// Helper method for the two above.
func compareKeys(keys []keybase1.KID, expected map[keybase1.KID]struct{}) error {
	if len(keys) != len(expected) {
		return ErrKeysNotEqual
	}
	for _, kid := range keys {
		if _, ok := expected[kid]; !ok {
			return ErrKeysNotEqual
		}
	}
	return nil
}

// checkKey checks that the given key is still valid for this user.
func (u *user) checkKey(kid keybase1.KID) error {
	var err error
	if _, ok := u.sibkeys[kid]; !ok {
		if _, ok := u.subkeys[kid]; !ok {
			err = BadKeyError{u.uid, kid}
		}
	}
	return err
}

// CheckUserKey is the main point of entry to this library. It takes as input a UID, a
// username and a kid that should refer to a current valid triple, perhaps
// extracted from a signed authentication statement. It returns an error if the
// check fails, and nil otherwise. If username or kid are nil they aren't checked.
func (v *CredentialAuthority) CheckUserKey(ctx context.Context, uid keybase1.UID,
	username *libkb.NormalizedUsername, kid *keybase1.KID, loadDeleted bool) (err error) {
	v.log.Debug("CheckUserKey uid %s, kid %s", uid, kid)
	retCh := make(chan error, 1) // buffered in case the ctx is canceled
	v.checkCh <- checkArg{uid: uid, username: username, kid: kid, loadDeleted: loadDeleted, retCh: retCh}
	select {
	case <-ctx.Done():
		err = ctx.Err()
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
		if err = v.CheckUserKey(ctx, uid, nil, nil, false); err != nil {
			break
		}
	}
	return err
}

// CompareUserKeys compares the passed sets to the sets known by the API server.
// It returns true if the sets are equal.
func (v *CredentialAuthority) CompareUserKeys(ctx context.Context, uid keybase1.UID, sibkeys, subkeys []keybase1.KID) (
	err error) {
	retCh := make(chan error, 1) // buffered in case the ctx is canceled
	v.checkCh <- checkArg{uid: uid, sibkeys: sibkeys, subkeys: subkeys, retCh: retCh}
	select {
	case <-ctx.Done():
		err = ctx.Err()
	case err = <-retCh:
	}
	return err
}

// Shutdown the credentialAuthority and delete all internal state.
func (v *CredentialAuthority) Shutdown() {
	close(v.shutdownCh)
}
