package main

import (
	"encoding/json"
	"flag"
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
	var silent bool
	flag.BoolVar(&silent, "silent", false, "print nothing")
	var filepath string
	flag.StringVar(&filepath, "path", "", "path to file containing json team chain")
	flag.Parse()
	if filepath == "" {
		flag.Usage()
		return fmt.Errorf("missing required path flag")
	}

	var cf ChainFile
	if filepath == "-" {
		cf, err = readChainStdin()
	} else {
		cf, err = readChainFile(filepath)
	}
	if err != nil {
		return err
	}

	g := libkb.NewGlobalContext().Init()
	g.Log = logger.New("sc")
	if err := g.ConfigureCaches(); err != nil {
		return err
	}
	mctx := libkb.NewMetaContextBackground(g)
	var reader keybase1.UserVersion
	var state *teams.TeamSigChainState
	for _, prelink := range cf.Chain {
		link, err := teams.UnpackChainLink(&prelink)
		if err != nil {
			return err
		}

		implicitAdmin := link.TeamAdmin() != nil // Assume all admin claims are OK.
		signerX := teams.NewSignerX(
			keybase1.NewUserVersion(prelink.UID, prelink.EldestSeqno), implicitAdmin)
		newState, err := teams.AppendChainLink(mctx.Ctx(), g, reader, state, link, &signerX)
		if err != nil {
			return err
		}
		state = &newState
	}
	if !silent {
		fmt.Printf("%v\n", spew.Sdump(state))
	}
	return nil
}

func readChainStdin() (res ChainFile, err error) {
	err = json.NewDecoder(os.Stdin).Decode(&res)
	return res, err
}

func readChainFile(path string) (res ChainFile, err error) {
	f, err := os.Open(path)
	if err != nil {
		return res, err
	}
	err = json.NewDecoder(f).Decode(&res)
	return res, err
}
