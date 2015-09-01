// +build !darwin

package client

import (
	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
)

func NewCmdLaunchd(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{}
}
