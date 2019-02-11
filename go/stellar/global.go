package stellar

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/keybase/client/go/badges"
	"github.com/keybase/client/go/gregor"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/protocol/stellar1"
	"github.com/keybase/client/go/slotctx"
	"github.com/keybase/client/go/stellar/remote"
	"github.com/keybase/stellarnet"
	"github.com/stellar/go/build"
	"github.com/stellar/go/clients/federation"
	"github.com/stellar/go/clients/horizon"
)

func ServiceInit(g *libkb.GlobalContext, walletState *WalletState, badger *badges.Badger) {
	if g.Env.GetRunMode() != libkb.ProductionRunMode {
		stellarnet.SetClientAndNetwork(horizon.DefaultTestNetClient, build.TestNetwork)
	}
	g.SetStellar(NewStellar(g, walletState, badger))
}

type Stellar struct {
	libkb.Contextified
	remoter     remote.Remoter
	walletState *WalletState

	serverConfLock   sync.Mutex
	cachedServerConf stellar1.StellarServerDefinitions

	autoClaimRunnerLock sync.Mutex
	autoClaimRunner     *AutoClaimRunner // often nil

	hasWalletCacheLock sync.Mutex
	hasWalletCache     map[keybase1.UserVersion]bool

	federationClient federation.ClientInterface

	bidLock sync.Mutex
	bids    []*buildPaymentEntry

	bpcLock sync.Mutex
	bpc     BuildPaymentCache

	disclaimerLock     sync.Mutex
	disclaimerAccepted *keybase1.UserVersion // A UV who has accepted the disclaimer.

	// Slot for build payments that do not use BuildPaymentID.
	buildPaymentSlot *slotctx.PrioritySlot

	migrationLock sync.Mutex

	badger *badges.Badger
}

var _ libkb.Stellar = (*Stellar)(nil)

func NewStellar(g *libkb.GlobalContext, walletState *WalletState, badger *badges.Badger) *Stellar {
	return &Stellar{
		Contextified:     libkb.NewContextified(g),
		remoter:          walletState,
		walletState:      walletState,
		hasWalletCache:   make(map[keybase1.UserVersion]bool),
		federationClient: getFederationClient(g),
		buildPaymentSlot: slotctx.NewPriority(),
		badger:           badger,
	}
}

func (s *Stellar) CreateWalletSoft(ctx context.Context) {
	CreateWalletSoft(libkb.NewMetaContext(ctx, s.G()))
}

func (s *Stellar) Upkeep(ctx context.Context) error {
	return Upkeep(libkb.NewMetaContext(ctx, s.G()))
}

func (s *Stellar) OnLogout() {
	s.shutdownAutoClaimRunner()
	s.deleteBpc()
	s.deleteDisclaimer()
	s.clearBids()
}

func (s *Stellar) shutdownAutoClaimRunner() {
	s.autoClaimRunnerLock.Lock()
	defer s.autoClaimRunnerLock.Unlock()
	// Shutdown and delete the ACR.
	if acr := s.autoClaimRunner; acr != nil {
		acr.Shutdown(libkb.NewMetaContextBackground(s.G()))
	}
	s.autoClaimRunner = nil
}

func (s *Stellar) deleteBpc() {
	s.bpcLock.Lock()
	defer s.bpcLock.Unlock()
	s.bpc = nil
}

func (s *Stellar) deleteDisclaimer() {
	s.disclaimerLock.Lock()
	defer s.disclaimerLock.Unlock()
	s.disclaimerAccepted = nil
}

func (s *Stellar) clearBids() {
	s.buildPaymentSlot.Stop()
	s.bidLock.Lock()
	defer s.bidLock.Unlock()
	for _, bid := range s.bids {
		bid.Slot.Stop()
	}
	s.bids = nil
}

func (s *Stellar) GetMigrationLock() *sync.Mutex {
	return &s.migrationLock
}

func (s *Stellar) GetServerDefinitions(ctx context.Context) (ret stellar1.StellarServerDefinitions, err error) {
	if s.cachedServerConf.Revision == 0 {
		s.serverConfLock.Lock()
		defer s.serverConfLock.Unlock()
		if s.cachedServerConf.Revision == 0 {
			// check if still 0, we might have waited for other thread
			// to finish fetching.
			if ret, err = remote.FetchServerConfig(ctx, s.G()); err != nil {
				return ret, err
			}

			s.cachedServerConf = ret
		}
	}

	return s.cachedServerConf, nil
}

// `trigger` is optional, and is of the gregor message that caused the kick.
func (s *Stellar) KickAutoClaimRunner(mctx libkb.MetaContext, trigger gregor.MsgID) {
	// Create the ACR if one does not exist.
	mctx.CDebugf("KickAutoClaimRunner(trigger:%v)", trigger)
	s.autoClaimRunnerLock.Lock()
	defer s.autoClaimRunnerLock.Unlock()
	if s.autoClaimRunner == nil {
		s.autoClaimRunner = NewAutoClaimRunner(s.walletState)
	}
	s.autoClaimRunner.Kick(mctx, trigger)
}

func (s *Stellar) InformHasWallet(ctx context.Context, uv keybase1.UserVersion) {
	if uv.Uid.IsNil() {
		s.G().Log.CErrorf(ctx, "Stellar.InformHasWallet called with nil UID")
		return
	}
	if uv.EldestSeqno <= 0 {
		// It is not possible for such a user to have a wallet.
		s.G().Log.CErrorf(ctx, "Stellar.InformHasWallet called with %v EldestSeqno", uv.EldestSeqno)
		return
	}
	s.hasWalletCacheLock.Lock()
	defer s.hasWalletCacheLock.Unlock()
	s.G().Log.CDebugf(ctx, "Stellar.InformHasWallet(%v)", uv)
	s.hasWalletCache[uv] = true
}

func (s *Stellar) CachedHasWallet(ctx context.Context, uv keybase1.UserVersion) bool {
	s.hasWalletCacheLock.Lock()
	defer s.hasWalletCacheLock.Unlock()
	has := s.hasWalletCache[uv]
	s.G().Log.CDebugf(ctx, "Stellar.CachedHasWallet(%v) -> %v", uv, has)
	return has
}

func (s *Stellar) SetFederationClientForTest(cli federation.ClientInterface) {
	s.federationClient = cli
}

func (s *Stellar) getBuildPaymentCache() BuildPaymentCache {
	s.bpcLock.Lock()
	defer s.bpcLock.Unlock()
	if s.bpc == nil {
		s.bpc = newBuildPaymentCache(s.remoter)
	}
	return s.bpc
}

// UpdateUnreadCount will take the unread count for an account id and
// update the badger.
func (s *Stellar) UpdateUnreadCount(ctx context.Context, accountID stellar1.AccountID, unread int) error {
	if s.badger == nil {
		s.G().Log.CDebugf(ctx, "Stellar Global has no badger")
		return nil
	}

	s.badger.SetWalletAccountUnreadCount(ctx, accountID, unread)
	return nil
}

// SendMiniChatPayments sends multiple payments from one sender to multiple
// different recipients as fast as it can.  These come from chat messages
// like "+1XLM@alice +2XLM@charlie".
func (s *Stellar) SendMiniChatPayments(mctx libkb.MetaContext, convID chat1.ConversationID, payments []libkb.MiniChatPayment) ([]libkb.MiniChatPaymentResult, error) {
	return SendMiniChatPayments(mctx, s.walletState, convID, payments)
}

// SpecMiniChatPayments creates a summary of the amounts that a list of MiniChatPayments will
// result in.
func (s *Stellar) SpecMiniChatPayments(mctx libkb.MetaContext, payments []libkb.MiniChatPayment) (*libkb.MiniChatPaymentSummary, error) {
	return SpecMiniChatPayments(mctx, s.walletState, payments)
}

// HandleOobm will handle any out of band gregor messages for stellar.
func (s *Stellar) HandleOobm(ctx context.Context, obm gregor.OutOfBandMessage) (bool, error) {
	if obm.System() == nil {
		return false, errors.New("nil system in out of band message")
	}

	// make a new background context for the handlers
	mctx := libkb.NewMetaContextBackground(s.G()).WithLogTag("WAOOBM")

	// all of these handlers should be in goroutines so they don't block the
	// oobm handler thread.

	switch obm.System().String() {
	case "internal.reconnect":
		go s.handleReconnect(mctx)
		// returning false, nil here so that others can handle this one too
		return false, nil
	case stellar1.PushPaymentStatus:
		go s.handlePaymentStatus(mctx, obm)
		return true, nil
	case stellar1.PushPaymentNotification:
		go s.handlePaymentNotification(mctx, obm)
		return true, nil
	case stellar1.PushRequestStatus:
		go s.handleRequestStatus(mctx, obm)
		return true, nil
	}

	return false, nil
}

func (s *Stellar) handleReconnect(mctx libkb.MetaContext) {
	defer mctx.CTraceTimed("Stellar.handleReconnect", func() error { return nil })()
	if s.walletState.Primed() {
		mctx.CDebugf("stellar received reconnect msg, doing delayed wallet refresh")
		time.Sleep(4 * time.Second)
		mctx.CDebugf("stellar reconnect msg delay complete, refreshing wallet state")
	} else {
		mctx.CDebugf("stellar received reconnect msg, doing wallet refresh on unprimed wallet")
	}
	if err := s.walletState.RefreshAll(mctx, "reconnect"); err != nil {
		mctx.CDebugf("Stellar.handleReconnect RefreshAll error: %s", err)
	}
}

func (s *Stellar) handlePaymentStatus(mctx libkb.MetaContext, obm gregor.OutOfBandMessage) {
	var err error
	defer mctx.CTraceTimed("Stellar.handlePaymentStatus", func() error { return err })()
	var msg stellar1.PaymentStatusMsg
	if err = json.Unmarshal(obm.Body().Bytes(), &msg); err != nil {
		mctx.CDebugf("error unmarshaling obm PaymentStatusMsg: %s", err)
		return
	}

	paymentID := stellar1.NewPaymentID(msg.TxID)
	if err = s.refreshPaymentFromNotification(mctx, msg.AccountID, paymentID); err != nil {
		mctx.CDebugf("refreshPaymentFromNotification error: %s", err)
		return
	}

	s.G().NotifyRouter.HandleWalletPaymentStatusNotification(mctx.Ctx(), msg.AccountID, paymentID)
}

func (s *Stellar) handlePaymentNotification(mctx libkb.MetaContext, obm gregor.OutOfBandMessage) {
	var err error
	defer mctx.CTraceTimed("Stellar.handlePaymentNotification", func() error { return err })()
	var msg stellar1.PaymentNotificationMsg
	if err = json.Unmarshal(obm.Body().Bytes(), &msg); err != nil {
		mctx.CDebugf("error unmarshaling obm PaymentNotificationMsg: %s", err)
		return
	}

	if err = s.refreshPaymentFromNotification(mctx, msg.AccountID, msg.PaymentID); err != nil {
		mctx.CDebugf("refreshPaymentFromNotification error: %s", err)
		return
	}
	s.G().NotifyRouter.HandleWalletPaymentNotification(mctx.Ctx(), msg.AccountID, msg.PaymentID)
}

func (s *Stellar) refreshPaymentFromNotification(mctx libkb.MetaContext, accountID stellar1.AccountID, paymentID stellar1.PaymentID) error {
	s.walletState.Refresh(mctx, accountID, "notification received")
	DefaultLoader(s.G()).UpdatePayment(mctx.Ctx(), paymentID)

	return nil
}

func (s *Stellar) handleRequestStatus(mctx libkb.MetaContext, obm gregor.OutOfBandMessage) {
	var err error
	defer mctx.CTraceTimed("Stellar.handleRequestStatus", func() error { return err })()
	var msg stellar1.RequestStatusMsg
	if err = json.Unmarshal(obm.Body().Bytes(), &msg); err != nil {
		mctx.CDebugf("error unmarshaling obm RequestStatusMsg: %s", err)
		return
	}

	mctx.G().NotifyRouter.HandleWalletRequestStatusNotification(mctx.Ctx(), msg.ReqID)
	DefaultLoader(mctx.G()).UpdateRequest(mctx.Ctx(), msg.ReqID)
}

type hasAcceptedDisclaimerDBEntry struct {
	Version  int // 1
	Accepted bool
}

// For a UV, accepted starts out false and transitions to true. It never becomes false again.
// A cached true is returned, but a false always hits the server.
func (s *Stellar) hasAcceptedDisclaimer(ctx context.Context) (bool, error) {
	log := func(format string, args ...interface{}) {
		s.G().Log.CDebugf(ctx, "Stellar.hasAcceptedDisclaimer "+format, args...)
	}
	uv, err := s.G().GetMeUV(ctx)
	if err != nil {
		return false, err
	}
	s.disclaimerLock.Lock()
	defer s.disclaimerLock.Unlock()
	// Check memory
	memAccepted := s.disclaimerAccepted != nil && s.disclaimerAccepted.Eq(uv)
	log("mem -> %v", memAccepted)
	if memAccepted {
		return true, nil
	}
	// Check disk
	dbKey := libkb.DbKey{
		Typ: libkb.DBStellarDisclaimer,
		Key: uv.String(),
	}
	var dbEntry hasAcceptedDisclaimerDBEntry
	found, err := s.G().LocalDb.GetInto(&dbEntry, dbKey)
	log("disk -> [found:%v err:(%v) v:%v accepted:%v]", found, err, dbEntry.Version, dbEntry.Accepted)
	if err == nil && found && dbEntry.Version == 1 && dbEntry.Accepted {
		err = s.informAcceptedDisclaimerLocked(ctx)
		if err != nil {
			log("store -> err:(%v)", err)
		}
		return true, nil
	}
	// Check remote
	accepted, err := remote.GetAcceptedDisclaimer(ctx, s.G())
	log("remote -> [err:(%v) accepted:%v]", err, accepted)
	if err != nil {
		return false, err
	}
	if accepted {
		err = s.informAcceptedDisclaimerLocked(ctx)
		if err != nil {
			log("store -> err:(%v)", err)
		}
	}
	return accepted, nil
}

func (s *Stellar) informAcceptedDisclaimer(ctx context.Context) {
	s.disclaimerLock.Lock()
	defer s.disclaimerLock.Unlock()
	_ = s.informAcceptedDisclaimerLocked(ctx)
}

func (s *Stellar) informAcceptedDisclaimerLocked(ctx context.Context) (err error) {
	defer s.G().CTraceTimed(ctx, "Stellar.informAcceptedDisclaimer", func() error { return err })()
	uv, err := s.G().GetMeUV(ctx)
	if err != nil {
		return err
	}
	// Store memory
	s.disclaimerAccepted = &uv
	// Store disk
	return s.G().LocalDb.PutObj(libkb.DbKey{
		Typ: libkb.DBStellarDisclaimer,
		Key: uv.String(),
	}, nil, hasAcceptedDisclaimerDBEntry{
		Version:  1,
		Accepted: true,
	})
}

func (s *Stellar) startBuildPayment(mctx libkb.MetaContext) (bid stellar1.BuildPaymentID, err error) {
	defer func() {
		x := bid.String()
		if err != nil {
			x = fmt.Sprintf("ERR(%v)", err.Error())
		}
		mctx.CDebugf("Stellar.startBuildPayment -> %v", x)
	}()
	bid, err = RandomBuildPaymentID()
	if err != nil {
		return "", err
	}
	s.bidLock.Lock()
	defer s.bidLock.Unlock()
	s.bids = append(s.bids, newBuildPaymentEntry(bid))
	const maxConcurrentBuilds = 20
	if len(s.bids) > maxConcurrentBuilds {
		// Too many open payment builds. Drop the oldest ones.
		for i := maxConcurrentBuilds; i < len(s.bids); i++ {
			entry := s.bids[i]
			entry.Slot.Shutdown()
		}
		s.bids = s.bids[len(s.bids)-maxConcurrentBuilds:]
	}
	return bid, nil
}

// stopBuildPayment stops a bid forever.
func (s *Stellar) stopBuildPayment(mctx libkb.MetaContext, bid stellar1.BuildPaymentID) {
	mctx.CDebugf("Stellar.stopBuildPayment(%v)", bid)
	if bid.IsNil() {
		s.buildPaymentSlot.Stop()
		return
	}
	s.bidLock.Lock()
	defer s.bidLock.Unlock()
	for _, entry := range s.bids {
		if entry.Bid.Eq(bid) {
			if entry.Stopped {
				mctx.CDebugf("payment already stopped")
				return
			}
			entry.Slot.Shutdown()
			entry.Stopped = true
			mctx.CDebugf("payment shutdown")
			return
		}
	}
	mctx.CDebugf("payment not found to stop")
}

// acquireBuildPayment takes ownership of a payment build.
// Returns a new `mctx` that the caller should switch to. Because it runs within the slot.
// When err=nil the caller owns `data` and must release it with `release` when finished.
// When err!=nil data is nil.
// `release` can be called even when err!=nil.
// `mctx` can also be used if err!=nil.
// Callers should `release` soon after their context is canceled.
func (s *Stellar) acquireBuildPayment(mctx1 libkb.MetaContext, bid stellar1.BuildPaymentID, sessionID int) (
	mctx libkb.MetaContext, data *buildPaymentData, release func(), err error) {
	mctx = mctx1
	mctx.CDebugf("Stellar.acquireBuildPayment(%v)", bid)
	release = func() {}
	s.bidLock.Lock()
	defer s.bidLock.Unlock()
	for _, entry := range s.bids {
		entry := entry
		if !entry.Bid.Eq(bid) {
			continue
		}
		if entry.Stopped {
			return mctx, nil, release, fmt.Errorf("This payment might have already been sent. Check your recent payments before trying again.")
		}
		mctx = mctx.WithCtx(entry.Slot.Use(mctx.Ctx(), sessionID))
		if err = mctx.Ctx().Err(); err != nil {
			return mctx, nil, release, err
		}
		err = libkb.AcquireWithContextAndTimeout(mctx.Ctx(), &entry.DataLock, 5*time.Second)
		if err != nil {
			mctx.CDebugf("error while attempting to acquire data lock: %v", err)
			return mctx, nil, release, err
		}
		release = libkb.Once(func() {
			entry.DataLock.Unlock()
		})
		return mctx, &entry.Data, release, nil
	}
	return mctx, nil, release, fmt.Errorf("payment build not found")
}

// finalizeBuildPayment stops a bid forever and returns its data.
func (s *Stellar) finalizeBuildPayment(mctx libkb.MetaContext, bid stellar1.BuildPaymentID) (res *buildPaymentData, err error) {
	mctx.CDebugf("Stellar.finalizeBuildPayment(%v)", bid)
	s.bidLock.Lock()
	defer s.bidLock.Unlock()
	for _, entry := range s.bids {
		entry := entry
		if !entry.Bid.Eq(bid) {
			continue
		}
		if entry.Stopped {
			return nil, fmt.Errorf("This payment might have already been sent. Check your recent payments before trying again.")
		}
		entry.Slot.Shutdown()
		entry.Stopped = true
		err = libkb.AcquireWithContextAndTimeout(mctx.Ctx(), &entry.DataLock, 5*time.Second)
		if err != nil {
			// This likely means something in the Slot is not yielding to its context or forgot to release the lock.
			mctx.CDebugf("error while attempting to acquire data lock: %v", err)
			return nil, err
		}
		res = &entry.Data
		entry.DataLock.Unlock()
		return res, nil
	}
	return nil, fmt.Errorf("payment build not found")
}

func (s *Stellar) RemovePendingTx(mctx libkb.MetaContext, accountID stellar1.AccountID, txID stellar1.TransactionID) error {
	return s.walletState.RemovePendingTx(mctx.Ctx(), accountID, txID)
}

// getFederationClient is a helper function used during
// initialization.
func getFederationClient(g *libkb.GlobalContext) federation.ClientInterface {
	if g.Env.GetRunMode() != libkb.ProductionRunMode {
		return federation.DefaultTestNetClient
	}
	return federation.DefaultPublicNetClient
}

// getGlobal gets the libkb.Stellar off of G and asserts it into a stellar.Stellar
func getGlobal(g *libkb.GlobalContext) *Stellar {
	return g.GetStellar().(*Stellar)
}
