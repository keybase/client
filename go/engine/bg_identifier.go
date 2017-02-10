package engine

import (
	"container/heap"
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

type bgiUser struct {
	uid       keybase1.UID
	nextRun   time.Time
	lastError error // the last error we encountered
	// The index is needed by update and is maintained by the heap.Interface methods.
	index int // The index of the item in the heap.
}

// A PriorityQueue implements heap.Interface and holds bgiUsers
type priorityQueue []*bgiUser

var _ heap.Interface = (*priorityQueue)(nil)

func (pq priorityQueue) Len() int { return len(pq) }

func (pq priorityQueue) Less(i, j int) bool {
	// The goal is for Pop() to give us the event
	// that needs to happen first. Thus, use `Before`
	// (and not `After`) here.
	return pq[i].nextRun.Before(pq[j].nextRun)
}

func (pq priorityQueue) Swap(i, j int) {
	pq[i], pq[j] = pq[j], pq[i]
	pq[i].index = i
	pq[j].index = j
}

func (pq *priorityQueue) Push(x interface{}) {
	n := len(*pq)
	item := x.(*bgiUser)
	item.index = n
	*pq = append(*pq, item)
}

func (pq *priorityQueue) Pop() interface{} {
	old := *pq
	n := len(old)
	item := old[n-1]
	item.index = -1 // for safety
	*pq = old[0 : n-1]
	return item
}

var errDeleted = errors.New("job deleted")
var errEmpty = errors.New("queue empty")

type IdentifyJob struct {
	uid       keybase1.UID
	err       error // this error
	lastError error // the error from the last run of the loop
}

func NewIdentifyJob(uid keybase1.UID, err, lastError error) IdentifyJob {
	return IdentifyJob{
		uid:       uid,
		err:       err,
		lastError: lastError,
	}
}

func (ij IdentifyJob) ErrorChanged() bool {
	return (ij.err == nil) != (ij.lastError == nil)
}

func (ij IdentifyJob) UID() keybase1.UID { return ij.uid }
func (ij IdentifyJob) ThisError() error  { return ij.err }
func (ij IdentifyJob) LastError() error  { return ij.lastError }

type BackgroundIdentifierTestArgs struct {
	identify2TestArgs *Identify2WithUIDTestArgs
}

type BackgroundIdentifier struct {
	libkb.Contextified
	sync.Mutex
	queue     priorityQueue
	members   map[keybase1.UID]bool
	addCh     chan struct{}
	snooperCh chan<- IdentifyJob
	untilCh   chan struct{}
	testArgs  *BackgroundIdentifierTestArgs
	settings  BackgroundIdentifierSettings
}

var _ (Engine) = (*BackgroundIdentifier)(nil)

type BackgroundIdentifierSettings struct {
	Enabled         bool          // = true
	WaitClean       time.Duration // = 4 * time.Hour
	WaitHardFailure time.Duration // = 90 * time.Minute
	WaitSoftFailure time.Duration // = 10 * time.Minute
	DelaySlot       time.Duration // = 30 * time.Second
}

var BackgroundIdentifierDefaultSettings = BackgroundIdentifierSettings{
	Enabled:         true,
	WaitClean:       4 * time.Hour,
	WaitHardFailure: 90 * time.Minute,
	WaitSoftFailure: 10 * time.Minute,
	DelaySlot:       3 * time.Minute,
}

func NewBackgroundIdentifier(g *libkb.GlobalContext, untilCh chan struct{}) *BackgroundIdentifier {
	ret := &BackgroundIdentifier{
		Contextified: libkb.NewContextified(g),
		members:      make(map[keybase1.UID]bool),
		addCh:        make(chan struct{}),
		untilCh:      untilCh,
		settings:     BackgroundIdentifierDefaultSettings,
	}
	heap.Init(&ret.queue)
	return ret
}

// GetPrereqs returns the engine prereqs.
func (b *BackgroundIdentifier) Prereqs() Prereqs {
	return Prereqs{}
}

func (b *BackgroundIdentifier) Name() string {
	return "BackgroundIdentifier"
}

func (b *BackgroundIdentifier) RequiredUIs() []libkb.UIKind {
	return nil
}

func (b *BackgroundIdentifier) SubConsumers() []libkb.UIConsumer {
	return []libkb.UIConsumer{
		&Identify2WithUID{
			arg: &keybase1.Identify2Arg{IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_GUI},
		},
	}
}

// A snooper channel wants to know what's going on and will be notified accordingly.
func (b *BackgroundIdentifier) SetSnooperChannel(ch chan<- IdentifyJob) {
	b.snooperCh = ch
}

func (b *BackgroundIdentifier) Add(u keybase1.UID) bool {
	b.Lock()
	defer b.Unlock()
	present, found := b.members[u]
	if present {
		return false
	}
	// It might already have been in the queue, but slated for removal,
	// then just added back at the last minute.
	if !found {
		heap.Push(&b.queue, &bgiUser{uid: u})
	}
	b.members[u] = true
	go func() {
		b.addCh <- struct{}{}
	}()
	return true
}

func (b *BackgroundIdentifier) Remove(u keybase1.UID) {
	b.Lock()
	defer b.Unlock()
	b.members[u] = false
}

func (b *BackgroundIdentifier) waitUntil() time.Time {
	b.Lock()
	defer b.Unlock()
	now := b.G().Clock().Now()
	if len(b.queue) == 0 {
		return now.Add(time.Hour)
	}
	lowest := b.queue[0]
	return lowest.nextRun
}

func (b *BackgroundIdentifier) Run(ctx *Context) (err error) {
	fn := "BackgroundIdentifier#Run"
	defer b.G().Trace(fn, func() error { return err })()

	// Mark all identifies with background identifier tag / context.
	netContext := libkb.WithLogTag(ctx.GetNetContext(), "BG")

	if !b.settings.Enabled {
		b.G().Log.Debug("%s: Bailing out since BackgroundIdentifier isn't enabled", fn)
		return nil
	}

	keepGoing := true
	for keepGoing {
		waitUntil := b.waitUntil()
		if waitUntil.IsZero() {
			b.G().Log.Debug("%s: not waiting, got an immediate identifiee", fn)
		} else {
			b.G().Log.Debug("%s: waiting %s", fn, waitUntil.Sub(b.G().Clock().Now()))
		}
		select {
		case <-b.untilCh:
			keepGoing = false
		case <-b.addCh:
			b.G().Log.Debug("| early wake up due to new addition")
			continue
		case <-b.G().Clock().AfterTime(waitUntil):
			b.G().Log.Debug("| running next after wait")

			// Reset the netContext everytime through the loop, so we don't
			// endlessly accumulate WithValues
			ctx.NetContext = netContext
			b.runNext(ctx)
		}
	}
	return nil
}

func (b *BackgroundIdentifier) popOne() (user *bgiUser, err error) {
	b.Lock()
	defer b.Unlock()
	if len(b.queue) == 0 {
		return nil, errEmpty
	}
	next := heap.Pop(&b.queue).(*bgiUser)
	if !b.members[next.uid] {
		delete(b.members, next.uid)
		return nil, errDeleted
	}
	return next, nil
}

func (b *BackgroundIdentifier) popNext() (user *bgiUser, err error) {
	for {
		user, err := b.popOne()
		if user != nil {
			return user, nil
		}
		if err == errDeleted {
			continue
		}
		return nil, err
	}
}

func (b *BackgroundIdentifier) requeue(u *bgiUser) {
	b.Lock()
	defer b.Unlock()
	heap.Push(&b.queue, u)
}

func (b *BackgroundIdentifier) errorToRetryDuration(e error) time.Duration {
	switch {
	case e == nil:
		return b.settings.WaitClean
	case e == errBackgroundIdentifierBadProofsSoft:
		return b.settings.WaitSoftFailure
	default:
		return b.settings.WaitHardFailure
	}
}

var errBackgroundIdentifierBadKeys = errors.New("BG identify error: bad keys")
var errBackgroundIdentifierBadProofsHard = errors.New("BG identify error: bad proofs (hard failure)")
var errBackgroundIdentifierBadProofsSoft = errors.New("BG identify error: bad proofs (soft failure)")

func trackBreaksToError(b *keybase1.IdentifyTrackBreaks) error {
	if b == nil {
		return nil
	}
	if len(b.Keys) > 0 {
		return errBackgroundIdentifierBadKeys
	}
	var err error
	for _, p := range b.Proofs {
		if !p.Lcr.BreaksTracking {
			continue
		}
		if p.Lcr.ProofResult.Status >= keybase1.ProofStatus_BASE_HARD_ERROR {
			return errBackgroundIdentifierBadProofsHard
		}
		err = errBackgroundIdentifierBadProofsSoft

	}
	return err
}

func (b *BackgroundIdentifier) runNext(ctx *Context) error {
	user, err := b.popNext()
	if err != nil {
		return nil
	}
	if user == nil {
		panic("should never get an empty user without an error")
	}
	tmp := b.runOne(ctx, user.uid)
	waitTime := b.errorToRetryDuration(tmp)
	user.nextRun = b.G().Clock().Now().Add(waitTime)
	lastError := user.lastError
	user.lastError = tmp

	b.G().Log.Debug("requeuing %s for %s (until %s)", user.uid, waitTime, user.nextRun)
	b.requeue(user)

	// We should only say we're done with this user after we've requeued him.
	// Otherwise there could be races -- the Advance() call of a tester might
	// slip in in before the call to b.G().Clock().Now() above.
	if b.snooperCh != nil {
		b.snooperCh <- IdentifyJob{user.uid, tmp, lastError}
	}

	if d := b.settings.DelaySlot; d != 0 {
		b.G().Log.Debug("BackgroundIdentifier sleeping for %s", d)
		b.G().Clock().Sleep(d)
	}

	return nil
}

func (b *BackgroundIdentifier) runOne(ctx *Context, u keybase1.UID) (err error) {
	defer b.G().Trace(fmt.Sprintf("BackgroundIdentifier#runOne(%s)", u), func() error { return err })()
	arg := keybase1.Identify2Arg{
		Uid: u,
		Reason: keybase1.IdentifyReason{
			Type: keybase1.IdentifyReasonType_BACKGROUND,
		},
		AlwaysBlock:      true,
		IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_GUI,
	}
	eng := NewIdentify2WithUID(b.G(), &arg)
	if b.testArgs != nil {
		eng.testArgs = b.testArgs.identify2TestArgs
	}
	err = RunEngine(eng, ctx)
	if err == nil {
		err = trackBreaksToError(eng.Result().TrackBreaks)
	}
	return err
}
