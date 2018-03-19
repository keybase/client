// +build !darwin

package erasablekv

import (
	"github.com/keybase/client/go/libkb"
	"golang.org/x/net/context"
)

func SetDisableBackup(ctx context.Context, g *libkb.GlobalContext, name string) error {
	return nil
}
