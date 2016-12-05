package engine

import (
	"container/heap"
	"errors"
	"fmt"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"sync"
	"time"
)

type bgiUser struct {
	uid     keybase1.UID
	nextRun time.Time
	// The index is needed by update and is maintained by the heap.Interface methods.
	index int // The index of the item in the heap.
}

// A PriorityQueue implements heap.Interface and holds Items.
type priorityQueue []*bgiUser

var _ heap.Interface = (*priorityQueue)(nil)

func (pq priorityQueue) Len() int { return len(pq) }

func (pq priorityQueue) Less(i, j int) bool {
	// We want Pop to give us the not lowest timeout, so user less than
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

type identifyJob struct {
	uid keybase1.UID
	err error
}

type BackgroundIdentifierTestArgs struct {
	identify2TestArgs *Identify2WithUIDTestArgs
}

type BackgroundIdentifier struct {
	libkb.Contextified
	sync.Mutex
	queue     priorityQueue
	members   map[keybase1.UID]bool
	addCh     chan struct{}
	snooperCh chan<- identifyJob
	untilCh   chan struct{}
	testArgs  *BackgroundIdentifierTestArgs
	params    BackgroundIdentifierParameters
}

var _ (Engine) = (*BackgroundIdentifier)(nil)

type BackgroundIdentifierParameters struct {
	WaitClean       time.Duration // = 4 * time.Hour
	WaitHardFailure time.Duration // = 90 * time.Minute
	WaitSoftFailure time.Duration // = 10 * time.Minute
}

var BackgroundIdentifierDefaultParameters = BackgroundIdentifierParameters{
	WaitClean:       4 * time.Hour,
	WaitHardFailure: 90 * time.Minute,
	WaitSoftFailure: 10 * time.Minute,
}

func NewBackgroundIdentifier(g *libkb.GlobalContext, untilCh chan struct{}) *BackgroundIdentifier {
	ret := &BackgroundIdentifier{
		Contextified: libkb.NewContextified(g),
		members:      make(map[keybase1.UID]bool),
		addCh:        make(chan struct{}),
		untilCh:      untilCh,
		params:       BackgroundIdentifierDefaultParameters,
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
			arg: &keybase1.Identify2Arg{ChatGUIMode: true},
		},
	}
}

// used mainly for testing. A snooper channel wants to know what's going on
// and will be notified accordingly.
func (b *BackgroundIdentifier) setSnooperChannel(ch chan<- identifyJob) {
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
	defer b.G().Trace("BackgroundIdentifier#Run", func() error { return err })()
	keepGoing := true
	for keepGoing {
		waitUntil := b.waitUntil()
		b.G().Log.Debug("BackgroundIdentifier#Run: waiting %s", waitUntil.Sub(b.G().Clock().Now()))
		select {
		case <-b.untilCh:
			keepGoing = false
		case <-b.addCh:
			b.G().Log.Debug("| early wake up due to new addition")
			continue
		case <-b.G().Clock().AfterTime(waitUntil):
			b.G().Log.Debug("| running next after wait")
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
		return b.params.WaitClean
	case e == errBackgroundIdentifierBadProofsSoft:
		return b.params.WaitSoftFailure
	default:
		return b.params.WaitHardFailure
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
	b.G().Log.Debug("requeuing %s for %s (until %s)", user.uid, waitTime, user.nextRun)
	b.requeue(user)

	// We should only say we're done with this user after we've requeued him.
	// Otherwise there could be races -- the Advance() call of a tester might
	// slip in in before the call to b.G().Clock().Now() above.
	if b.snooperCh != nil {
		b.snooperCh <- identifyJob{user.uid, tmp}
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
		AlwaysBlock: true,
		ChatGUIMode: true,
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
