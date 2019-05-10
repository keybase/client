package client

import (
	"fmt"

	"github.com/keybase/client/go/libkb"
)

func ensureSetPassphraseFromRemote(mctx libkb.MetaContext) error {
	cli, err := GetUserClient(mctx.G())
	if err != nil {
		return err
	}
	ret, err := cli.CanLogout(mctx.Ctx(), 0)
	if err != nil {
		return err
	}
	mctx.Debug("CanLogout call returned: %+v", ret)
	if !ret.CanLogout {
		return fmt.Errorf("Cannot logout: %s. Try `keybase passphrase set`.", ret.Reason)
	}
	return nil
}
