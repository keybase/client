package client

import (
	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	rpc "github.com/keybase/go-framed-msgpack-rpc"
)

func NewCmdUnlock(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name:  "unlock",
		Usage: "Unlock local key storage",
		Description: `"keybase unlock" can be used to restore access to your local key store
   when the keybase service restarts unexpectedly.
   
   During normal operation, there is no need for this command.  
   
   During our beta testing period, however, there are times where the 
   keybase service crashes and restarts itself.  If you are logged in 
   when this happens, you are still logged in, but you lose the ability 
   to unlock any locally encrypted keys.  Instead of logging out and 
   logging back in, the "keybase unlock" command will restore your local 
   key store access.`,
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdUnlock{}, "unlock", c)
		},
	}
}

type CmdUnlock struct{}

func (c *CmdUnlock) Run() error {
	cli, err := GetLoginClient()
	if err != nil {
		return err
	}
	protocols := []rpc.Protocol{
		NewSecretUIProtocol(),
	}
	if err := RegisterProtocols(protocols); err != nil {
		return err
	}
	return cli.Unlock(0)
}

func (c *CmdUnlock) ParseArgv(ctx *cli.Context) error {
	return nil
}

func (c *CmdUnlock) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		API:       true,
		KbKeyring: true,
	}
}
