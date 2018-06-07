package stellar

import (
	"context"
	"sync"

	"github.com/keybase/client/go/gregor"
	"github.com/keybase/client/go/libkb"
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
}

var _ libkb.Stellar = (*Stellar)(nil)

func NewStellar(g *libkb.GlobalContext, remoter remote.Remoter) *Stellar {
	return &Stellar{
		Contextified: libkb.NewContextified(g),
		remoter:      remoter,
	}
}

func (s *Stellar) CreateWalletGated(ctx context.Context) (bool, error) {
	return CreateWalletGated(ctx, s.G())
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
