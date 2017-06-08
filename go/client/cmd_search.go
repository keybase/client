// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"fmt"
	"strings"

	"golang.org/x/net/context"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	jsonw "github.com/keybase/go-jsonw"
)

type CmdSearch struct {
	libkb.Contextified
	query   string
	service string
	json    bool
}

func (c *CmdSearch) ParseArgv(ctx *cli.Context) error {
	c.query = strings.Join(ctx.Args(), " ")
	if c.query == "" {
		return fmt.Errorf("Search query must not be empty.")
	}

	// Support user@service queries
	parts := strings.Split(c.query, "@")
	if len(parts) == 2 {
		c.query = parts[0]
		c.service = parts[1]
	}

	c.json = ctx.Bool("json")
	return nil
}

func (c *CmdSearch) Run() (err error) {
	cli, err := GetUserClient(c.G())
	if err != nil {
		return err
	}

	if err = RegisterProtocols(nil); err != nil {
		return err
	}

	results, err := cli.Search(context.TODO(), keybase1.SearchArg{
		Query:   c.query,
		Service: c.service,
	})
	if err != nil {
		return err
	}

	userSummaries, err := UserSummariesForSearchResults(results, c.G())
	if err != nil {
		return err
	}

	return c.showResults(userSummaries)
}

func UserSummariesForSearchResults(results []keybase1.SearchResult,
	g *libkb.GlobalContext) ([]keybase1.UserSummary, error) {

	cli, err := GetUserClient(g)
	if err != nil {
		return nil, err
	}
	// Don't bother if no results.
	if len(results) == 0 {
		return nil, nil
	}

	uids := make([]keybase1.UID, len(results))
	for i := range results {
		uids[i] = results[i].Uid
	}
	userSummaries, err := cli.LoadUncheckedUserSummaries(context.TODO(), keybase1.LoadUncheckedUserSummariesArg{Uids: uids})
	if err != nil {
		return nil, err
	}
	return userSummaries, nil
}

func (c *CmdSearch) showResults(results []keybase1.UserSummary) error {
	if c.json {
		return c.showJSONResults(results)
	}
	return c.showRegularResults(results)
}

func (c *CmdSearch) showRegularResults(results []keybase1.UserSummary) error {
	if len(results) == 0 {
		GlobUI.Println("No results.")
		return nil
	}
	for _, user := range results {
		GlobUI.Printf("%s", user.Username)
		for _, social := range user.Proofs.Social {
			GlobUI.Printf(" %s:%s", social.ProofType, social.ProofName)
		}
		for _, web := range user.Proofs.Web {
			for _, protocol := range web.Protocols {
				GlobUI.Printf(" %s://%s", protocol, web.Hostname)
			}
		}
		GlobUI.Println()
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
			var webProofs []string
			for _, webProof := range user.Proofs.Web {
				for _, protocol := range webProof.Protocols {
					webProofs = append(webProofs, libkb.MakeURI(protocol, webProof.Hostname))
				}
			}
			websites := jsonw.NewArray(len(webProofs))
			for i, wp := range webProofs {
				websites.SetIndex(i, jsonw.NewString(wp))
			}
			userBlob.SetKey("websites", websites)
		}

		output.SetIndex(userIndex, userBlob)
	}
	GlobUI.Println(output.MarshalPretty())
	return nil
}

func NewCmdSearch(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "search",
		ArgumentHelp: "<query>",
		Usage:        "Search for keybase users",
		Flags: []cli.Flag{
			cli.BoolFlag{
				Name:  "j, json",
				Usage: "Output as JSON.",
			},
		},
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdSearch{Contextified: libkb.NewContextified(g)}, "search", c)
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
