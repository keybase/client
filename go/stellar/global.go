package stellar

import (
	"context"
	"sync"

	"github.com/keybase/client/go/gregor"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/protocol/stellar1"
	"github.com/keybase/client/go/stellar/remote"
	"github.com/keybase/stellarnet"
	"github.com/stellar/go/build"
	"github.com/stellar/go/clients/horizon"
)

func ServiceInit(g *libkb.GlobalContext, remoter remote.Remoter) {
	if g.Env.GetRunMode() != libkb.ProductionRunMode {
		stellarnet.SetClientAndNetwork(horizon.DefaultTestNetClient, build.TestNetwork)
	}
	g.SetStellar(NewStellar(g, remoter))
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
}

var _ libkb.Stellar = (*Stellar)(nil)

func NewStellar(g *libkb.GlobalContext, remoter remote.Remoter) *Stellar {
	return &Stellar{
		Contextified:   libkb.NewContextified(g),
		remoter:        remoter,
		hasWalletCache: make(map[keybase1.UserVersion]bool),
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
	s.autoClaimRunnerLock.Lock()
	defer s.autoClaimRunnerLock.Unlock()

	// Shutdown and delete the ACR.
	if acr := s.autoClaimRunner; acr != nil {
		acr.Shutdown(libkb.NewMetaContextBackground(s.G()))
	}
	s.autoClaimRunner = nil
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

// getGlobal gets the libkb.Stellar off of G and asserts it into a stellar.Stellar
func getGlobal(g *libkb.GlobalContext) *Stellar {
	return g.GetStellar().(*Stellar)
}
