package client

import (
	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
)

// compatibility with node client commands:

func NewCmdCompatEncrypt(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name: "encrypt",
		Action: func(c *cli.Context) {
			GlobUI.Println("Use `keybase pgp encrypt` instead.")
		},
		Description: "Use `keybase pgp encrypt` instead.",
	}
}

func NewCmdCompatDecrypt(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name: "decrypt",
		Action: func(c *cli.Context) {
			GlobUI.Println("Use `keybase pgp decrypt` instead.")
		},
		Description: "Use `keybase pgp decrypt` instead.",
	}
}

func NewCmdCompatSign(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name: "sign",
		Action: func(c *cli.Context) {
			GlobUI.Println("Use `keybase pgp sign` instead.")
		},
		Description: "Use `keybase pgp sign` instead.",
	}
}

func NewCmdCompatVerify(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name: "verify",
		Action: func(c *cli.Context) {
			GlobUI.Println("Use `keybase pgp verify` instead.")
		},
		Description: "Use `keybase pgp verify` instead.",
	}
}

func NewCmdCompatDir(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name: "dir",
		Action: func(c *cli.Context) {
			GlobUI.Println("`keybase dir` has been deprecated.")
		},
		Description: "`keybase dir` has been deprecated.",
	}
}

func NewCmdCompatPush(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name: "push",
		Action: func(c *cli.Context) {
			GlobUI.Println("Use `keybase pgp select` instead.")
		},
		Description: "Use `keybase pgp select` instead.",
	}
}
