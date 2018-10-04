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

func (s *Stellar) CreateWalletGated(ctx context.Context) (err error) {
	_, _, err = CreateWalletGated(ctx, s.G())
	return err
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
