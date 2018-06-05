package stellar

import (
	"fmt"
	"sync"
	"time"

	"github.com/keybase/client/go/gregor"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/stellar1"
	"github.com/keybase/client/go/stellar/remote"
)

// Claims relay payments in the background.
// Threadsafe.
type AutoClaimRunner struct {
	startOnce  sync.Once
	shutdownCh chan struct{}
	kickCh     chan gregor.MsgID
	remoter    remote.Remoter
}

func NewAutoClaimRunner(remoter remote.Remoter) *AutoClaimRunner {
	return &AutoClaimRunner{
		shutdownCh: make(chan struct{}, 1),
		kickCh:     make(chan gregor.MsgID, 100),
		remoter:    remoter,
	}
}

// Kick the processor into gear.
// It will run until all relays in the queue are claimed.
// And then dismiss the gregor message.
// `trigger` is of the gregor message that caused the kick.
func (r *AutoClaimRunner) Kick(mctx libkb.MetaContext, trigger gregor.MsgID) {
	mctx.CDebugf("AutoClaimRunner.Kick(trigger:%v)", trigger)
	var onced bool
	r.startOnce.Do(func() {
		onced = true
		go r.loop(libkb.NewMetaContextBackground(mctx.G()), trigger)
	})
	if !onced {
		select {
		case r.kickCh <- trigger:
		default:
		}
	}
}

func (r *AutoClaimRunner) Shutdown(mctx libkb.MetaContext) {
	mctx.CDebugf("AutoClaimRunner.Shutdown")
	close(r.shutdownCh)
}

type autoClaimLoopAction string

const (
	autoClaimLoopActionFast      autoClaimLoopAction = "fast"
	autoClaimLoopActionHibernate autoClaimLoopAction = "hibernate"
	autoClaimLoopActionSnooze    autoClaimLoopAction = "snooze"
)

func (r *AutoClaimRunner) loop(mctx libkb.MetaContext, trigger gregor.MsgID) {
	var i int
	for {
		i++
		mctx := mctx.WithLogTag("ACR") // shadow mctx for this round with a log tag
		log := func(format string, args ...interface{}) {
			mctx.CDebugf(fmt.Sprintf("AutoClaimRunnner round[%v] ", i) + fmt.Sprintf(format, args...))
		}
		action, err := r.step(mctx, i, trigger)
		if err != nil {
			log("error: %v", err)
		}
		log("action: %v", action)
		switch action {
		case autoClaimLoopActionFast:
			// Go again
		case autoClaimLoopActionHibernate:
			// Wait for a kick
			select {
			case trigger = <-r.kickCh:
			case <-r.shutdownCh:
				return
			}
		case autoClaimLoopActionSnooze:
			fallthrough
		default:
			// Pause for a few minutes
			select {
			case <-time.After(2 * time.Minute):
			case trigger = <-r.kickCh:
			case <-r.shutdownCh:
				return
			}
		}
	}
}

func (r *AutoClaimRunner) step(mctx libkb.MetaContext, i int, trigger gregor.MsgID) (action autoClaimLoopAction, err error) {
	log := func(format string, args ...interface{}) {
		mctx.CDebugf(fmt.Sprintf("AutoClaimRunnner round[%v] ", i) + fmt.Sprintf(format, args...))
	}
	log("step begin")
	token, err := r.remoter.AcquireAutoClaimLock(mctx.Ctx())
	if err != nil {
		return autoClaimLoopActionSnooze, err
	}
	if len(token) == 0 {
		log("autoclaim lock is busy")
		return autoClaimLoopActionSnooze, nil
	}
	defer func() {
		rerr := r.remoter.ReleaseAutoClaimLock(mctx.Ctx(), token)
		if rerr != nil {
			log("error releasing autoclaim lock: %v", rerr)
		}
	}()
	ac, err := r.remoter.NextAutoClaim(mctx.Ctx())
	if err != nil {
		return autoClaimLoopActionSnooze, err
	}
	if ac == nil {
		log("no more autoclaims")
		log("dismissing kick: %v", trigger)
		err = mctx.G().GregorDismisser.DismissItem(mctx.Ctx(), nil, trigger)
		if err != nil {
			log("error dismissing gregor kick: %v", err)
			return autoClaimLoopActionHibernate, err
		}
		log("successfully dismissed kick")
		return autoClaimLoopActionHibernate, nil
	}
	log("got next autoclaim: %v", ac.KbTxID)
	err = r.claim(mctx, ac.KbTxID, token)
	if err != nil {
		return autoClaimLoopActionSnooze, err
	}
	log("successfully claimed: %v", ac.KbTxID)
	return autoClaimLoopActionFast, nil
}

func (r *AutoClaimRunner) claim(mctx libkb.MetaContext, kbTxID stellar1.KeybaseTransactionID, token string) (err error) {
	CreateWalletSoft(mctx.Ctx(), mctx.G())
	into, err := GetOwnPrimaryAccountID(mctx.Ctx(), mctx.G())
	if err != nil {
		return err
	}
	// Explicitly CLAIM. We don't want to accidentally auto YANK.
	dir := stellar1.RelayDirection_CLAIM
	// Use the user's autoclaim lock that we acquired.
	_, err = Claim(mctx.Ctx(), mctx.G(), r.remoter,
		kbTxID.String(), into, &dir, &token)
	return err
}
