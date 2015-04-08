package main

import (
	"fmt"
	"github.com/codegangsta/cli"
	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase_1 "github.com/keybase/client/protocol/go"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
	"strings"
)

type CmdSearch struct {
	query string
}

func (c *CmdSearch) ParseArgv(ctx *cli.Context) error {
	c.query = strings.Join(ctx.Args(), " ")
	if c.query == "" {
		return fmt.Errorf("Search query must not be empty.")
	}
	return nil
}

func (c *CmdSearch) RunClient() (err error) {
	cli, err := GetUserClient()
	if err != nil {
		return err
	}

	protocols := []rpc2.Protocol{
		NewLogUIProtocol(),
	}
	if err = RegisterProtocols(protocols); err != nil {
		return err
	}

	results, err := cli.Search(keybase_1.SearchArg{Query: c.query})
	if err != nil {
		return err
	}

	return showResults(results)
}

func (c *CmdSearch) Run() error {
	eng := engine.NewSearchEngine(c.query)
	ctx := engine.Context{
		LogUI:    G_UI.GetLogUI(),
		SecretUI: G_UI.GetSecretUI(),
	}
	err := engine.RunEngine(eng, &ctx)
	if err != nil {
		return err
	}

	return showResults(eng.GetResults())
}

func showResults(results []keybase_1.UserSummary) error {
	for _, user := range results {
		fmt.Printf("%s", user.Username)
		for _, social := range user.Proofs.Social {
			fmt.Printf(" %s:%s", social.ProofType, social.ProofName)
		}
		for _, web := range user.Proofs.Web {
			for _, protocol := range web.Protocols {
				fmt.Printf(" %s://%s", protocol, web.Hostname)
			}
		}
		fmt.Println()
	}
	return nil
}

func NewCmdSearch(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name:        "search",
		Usage:       "keybase search <query>",
		Description: "search for keybase users",
		Flags:       []cli.Flag{},
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdSearch{}, "search", c)
		},
	}
}

func (c *CmdSearch) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:     true,
		GpgKeyring: true,
		KbKeyring:  true,
		API:        true,
	}
}
