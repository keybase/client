package main

import (
	"encoding/json"
	"fmt"
	"os"

	"github.com/davecgh/go-spew/spew"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/teams"
)

type ChainFile struct {
	Chain []teams.SCChainLink `json:"chain"`
}

func main() {
	err := main2()
	if err != nil {
		fmt.Fprintf(os.Stderr, "ERROR: %v\n", err)
		os.Exit(1)
	}
}

func main2() (err error) {
	if len(os.Args) != 2 {
		return fmt.Errorf("Usage: tool <jsonfile>")
	}
	filepath := os.Args[1]
	cf, err := readChainFile(filepath)
	if err != nil {
		return err
	}

	g := libkb.NewGlobalContext().Init()
	g.Log = logger.New("sc")
	g.ConfigureCaches()
	mctx := libkb.NewMetaContextBackground(g)
	var reader keybase1.UserVersion
	var state *teams.TeamSigChainState
	for _, prelink := range cf.Chain {
		link, err := teams.UnpackChainLink(&prelink)
		if err != nil {
			return err
		}

		signerX := teams.NewSignerX(keybase1.NewUserVersion(prelink.UID, prelink.EldestSeqno), false)
		newState, err := teams.AppendChainLink(mctx.Ctx(), g, reader, state, link, &signerX, false)
		if err != nil {
			return err
		}
		state = &newState
	}
	fmt.Printf("%v\n", spew.Sdump(state))
	return nil
}

func readChainFile(path string) (res ChainFile, err error) {
	f, err := os.Open(path)
	if err != nil {
		return res, err
	}
	err = json.NewDecoder(f).Decode(&res)
	return res, err
}
