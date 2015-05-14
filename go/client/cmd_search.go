package client

import (
	"fmt"
	"strings"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/protocol/go"
	jsonw "github.com/keybase/go-jsonw"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
)

type CmdSearch struct {
	query string
	json  bool
}

func (c *CmdSearch) ParseArgv(ctx *cli.Context) error {
	c.query = strings.Join(ctx.Args(), " ")
	if c.query == "" {
		return fmt.Errorf("Search query must not be empty.")
	}
	c.json = ctx.Bool("json")
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

	results, err := cli.Search(keybase1.SearchArg{Query: c.query})
	if err != nil {
		return err
	}

	return c.showResults(results)
}

func (c *CmdSearch) Run() error {
	eng := engine.NewSearchEngine(engine.SearchEngineArgs{
		Query: c.query,
	}, G)
	ctx := engine.Context{
		LogUI:    G_UI.GetLogUI(),
		SecretUI: G_UI.GetSecretUI(),
	}
	err := engine.RunEngine(eng, &ctx)
	if err != nil {
		return err
	}

	return c.showResults(eng.GetResults())
}

func (c *CmdSearch) showResults(results []keybase1.UserSummary) error {
	if c.json {
		return c.showJSONResults(results)
	}
	return c.showRegularResults(results)
}

func (c *CmdSearch) showRegularResults(results []keybase1.UserSummary) error {
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

func (c *CmdSearch) showJSONResults(results []keybase1.UserSummary) error {
	output := jsonw.NewArray(len(results))
	for userIndex, user := range results {
		userBlob := jsonw.NewDictionary()
		userBlob.SetKey("username", jsonw.NewString(user.Username))
		for _, social := range user.Proofs.Social {
			userBlob.SetKey(social.ProofType, jsonw.NewString(social.ProofName))
		}
		if len(user.Proofs.Web) > 0 {
			websites := jsonw.NewArray(len(user.Proofs.Web))
			webIndex := 0
			userBlob.SetKey("websites", websites)
			for _, webProof := range user.Proofs.Web {
				for _, protocol := range webProof.Protocols {
					websites.SetIndex(webIndex, jsonw.NewString(
						fmt.Sprintf("%s://%s", protocol, webProof.Hostname)))
					webIndex++
				}
			}
		}
		output.SetIndex(userIndex, userBlob)
	}
	fmt.Println(output.MarshalPretty())
	return nil
}

func NewCmdSearch(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name:        "search",
		Usage:       "keybase search <query>",
		Description: "search for keybase users",
		Flags: []cli.Flag{
			cli.BoolFlag{
				Name:  "j, json",
				Usage: "output a json blob",
			},
		},
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
