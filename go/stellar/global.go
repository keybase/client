package stellar

// Stellar functions callable from G

import (
	"sync"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/stellar1"
	"github.com/keybase/client/go/stellar/remote"
)

func ServiceInit(g *libkb.GlobalContext) {
	g.SetStellar(NewStellar())
}

type Stellar struct {
	serverConfLock   sync.Mutex
	cachedServerConf stellar1.StellarServerDefinitions
}

var _ libkb.Stellar = (*Stellar)(nil)

func NewStellar() *Stellar {
	return &Stellar{}
}

func (s *Stellar) CreateWalletGated(m libkb.MetaContext) (bool, error) {
	return CreateWalletGated(m)
}

func (s *Stellar) CreateWalletSoft(m libkb.MetaContext) {
	CreateWalletSoft(m)
}

func (s *Stellar) Upkeep(m libkb.MetaContext) error {
	return Upkeep(m)
}

func (s *Stellar) OnLogout() {}

func (s *Stellar) GetServerDefinitions(m libkb.MetaContext) (ret stellar1.StellarServerDefinitions, err error) {
	if s.cachedServerConf.Revision == 0 {
		s.serverConfLock.Lock()
		defer s.serverConfLock.Unlock()
		if s.cachedServerConf.Revision == 0 {
			// check if still 0, we might have waited for other thread
			// to finish fetching.
			if ret, err = remote.FetchServerConfig(m.Ctx(), m.G()); err != nil {
				return ret, err
			}

			s.cachedServerConf = ret
		}
	}

	return s.cachedServerConf, nil
}
