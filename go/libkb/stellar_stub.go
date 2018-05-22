package libkb

import (
	"fmt"

	stellar1 "github.com/keybase/client/go/protocol/stellar1"
)

type nullStellar struct{}

var _ Stellar = (*nullStellar)(nil)

func newNullStellar() *nullStellar {
	return &nullStellar{}
}

func (n *nullStellar) CreateWalletGated(m MetaContext) (bool, error) {
	return false, fmt.Errorf("null stellar impl")
}

func (n *nullStellar) CreateWalletSoft(m MetaContext) {
	m.CErrorf("null stellar impl")
}

func (n *nullStellar) Upkeep(m MetaContext) error {
	return fmt.Errorf("null stellar impl")
}

func (n *nullStellar) OnLogout() {}

func (n *nullStellar) GetServerDefinitions(m MetaContext) (ret stellar1.StellarServerDefinitions, err error) {
	return ret, fmt.Errorf("null stellar impl")
}
