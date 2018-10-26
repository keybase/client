package stellar

import (
	"context"
	"sync"

	"github.com/keybase/client/go/badges"
	"github.com/keybase/client/go/gregor"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/protocol/stellar1"
	"github.com/keybase/client/go/stellar/remote"
	"github.com/keybase/stellarnet"
	"github.com/stellar/go/build"
	"github.com/stellar/go/clients/federation"
	"github.com/stellar/go/clients/horizon"
)

func ServiceInit(g *libkb.GlobalContext, remoter remote.Remoter, badger *badges.Badger) {
	if g.Env.GetRunMode() != libkb.ProductionRunMode {
		stellarnet.SetClientAndNetwork(horizon.DefaultTestNetClient, build.TestNetwork)
	}
	g.SetStellar(NewStellar(g, remoter, badger))
}

type Stellar struct {
	libkb.Contextified
	remoter remote.Remoter

	serverConfLock   sync.Mutex
	cachedServerConf stellar1.StellarServerDefinitions

	autoClaimRunnerLock sync.Mutex
	autoClaimRunner     *AutoClaimRunner // often nil

	hasWalletCacheLock sync.Mutex
	hasWalletCache     map[keybase1.UserVersion]bool

	federationClient federation.ClientInterface

	bpcLock sync.Mutex
	bpc     BuildPaymentCache

	disclaimerLock     sync.Mutex
	disclaimerAccepted *keybase1.UserVersion // A UV who has accepted the disclaimer.

	badger *badges.Badger
}

var _ libkb.Stellar = (*Stellar)(nil)

func NewStellar(g *libkb.GlobalContext, remoter remote.Remoter, badger *badges.Badger) *Stellar {
	return &Stellar{
		Contextified:     libkb.NewContextified(g),
		remoter:          remoter,
		hasWalletCache:   make(map[keybase1.UserVersion]bool),
		federationClient: getFederationClient(g),
		badger:           badger,
	}
}

func (s *Stellar) CreateWalletSoft(ctx context.Context) {
	CreateWalletSoft(ctx, s.G())
}

func (s *Stellar) Upkeep(ctx context.Context) error {
	return Upkeep(ctx, s.G())
}

func (s *Stellar) OnLogout() {
	s.shutdownAutoClaimRunner()
	s.deleteBpc()
	s.deleteDisclaimer()
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

func (s *Stellar) KickAutoClaimRunner(mctx libkb.MetaContext, trigger gregor.MsgID) {
	// Create the ACR if one does not exist.
	mctx.CDebugf("KickAutoClaimRunner(trigger:%v)", trigger)
	s.autoClaimRunnerLock.Lock()
	defer s.autoClaimRunnerLock.Unlock()
	if s.autoClaimRunner == nil {
		s.autoClaimRunner = NewAutoClaimRunner(s.remoter)
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
	s.disclaimerLock.Unlock()
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
