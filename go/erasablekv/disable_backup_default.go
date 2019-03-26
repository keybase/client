// +build !darwin

package erasablekv

import (
	"github.com/keybase/client/go/libkb"
)

func SetDisableBackup(mctx libkb.MetaContext, name string) error {
	return nil
}
