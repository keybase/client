package main

import (
	"encoding/csv"
	"fmt"
	"io"
	"os"
	"strconv"

	"github.com/davecgh/go-spew/spew"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/teams"
)

func main() {
	err := main2()
	if err != nil {
		fmt.Fprintf(os.Stderr, "ERROR: %v\n", err)
		os.Exit(1)
	}
}

func main2() (err error) {
	_, records, err := readCsv("/tmp/query_result.csv")
	if err != nil {
		return fmt.Errorf("reading csv: %v", err)
	}

	link, err := unpackLinkRecord(records[0])
	if err != nil {
		return err
	}

	g := libkb.NewGlobalContext().Init()
	g.Log = logger.New("sc")
	g.ConfigureCaches()
	var reader keybase1.UserVersion

	mctx := libkb.NewMetaContextBackground(g)
	var state *teams.TeamSigChainState
	signerX := teams.NewSignerX()
	newState, err := teams.AppendChainLink(mctx.Ctx(), g, reader, state, link, &signerX)
	if err != nil {
		return err
	}
	state = &newState
	fmt.Printf("%v\n", spew.Sdump(state))
	return nil
}

func unpackLinkRecord(record map[string]string) (res *teams.ChainLinkUnpacked, err error) {
	seqno, err := strconv.Atoi(record["seqno"])
	if err != nil {
		return res, err
	}
	eldestSeqno, err := strconv.Atoi(record["eldest_seqno"])
	if err != nil {
		return res, err
	}
	uid, err := keybase1.UIDFromString(record["uid"])
	if err != nil {
		return res, err
	}
	version, err := strconv.Atoi(record["version"])
	if err != nil {
		return res, err
	}
	return teams.UnpackChainLink(&teams.SCChainLink{
		Seqno:       keybase1.Seqno(seqno),
		Sig:         record["sig"],
		Payload:     record["payload_json"],
		UID:         uid,
		EldestSeqno: keybase1.Seqno(eldestSeqno),
		Version:     version,
	})
}

func readCsv(path string) (header []string, records []map[string]string, err error) {
	f, err := os.Open(path)
	if err != nil {
		return header, records, err
	}
	r := csv.NewReader(f)
	header, err = r.Read()
	if err != nil {
		return header, records, err
	}
	for {
		rec, err := r.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			return header, records, err
		}
		record := make(map[string]string)
		for i, val := range rec {
			record[header[i]] = val
		}
		records = append(records, record)
	}
	return header, records, nil
}
