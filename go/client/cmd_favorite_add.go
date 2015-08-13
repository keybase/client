package client

import (
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/protocol/go"
)

func (c *CmdFavoriteAdd) Run() error {
	arg := keybase1.FavoriteAddTLFArg{
		Name: c.name,
	}
	cli, err := GetFavoriteClient()
	if err != nil {
		return err
	}
	return cli.FavoriteAddTLF(arg)
}

func (c *CmdFavoriteAdd) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
		API:    true,
	}
}
