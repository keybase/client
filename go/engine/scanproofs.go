// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"bufio"
	"encoding/csv"
	"encoding/gob"
	"fmt"
	"io"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/pvl"
)

type ScanProofsCache struct {
	// Map from sigid to whether the proof is ok.
	Proofs map[string]bool
}

func NewScanProofsCache() *ScanProofsCache {
	return &ScanProofsCache{
		Proofs: make(map[string]bool),
	}
}

func LoadScanProofsCache(filepath string) (*ScanProofsCache, error) {
	f, err := os.Open(filepath)
	if err != nil {
		return nil, err
	}
	dec := gob.NewDecoder(f)
	var c ScanProofsCache
	err = dec.Decode(&c)
	if err != nil {
		return nil, err
	}
	return &c, nil
}

func (c *ScanProofsCache) Save(filepath string) error {
	f, err := os.Create(filepath)
	if err != nil {
		return err
	}
	defer f.Close()
	enc := gob.NewEncoder(f)
	err = enc.Encode(c)
	if err != nil {
		return err
	}
	return nil
}

type ScanProofsEngine struct {
	libkb.Contextified
	infile     string
	indices    string
	sigid      string
	ratelimit  int
	cachefile  string
	ignorefile string
}

var _ Engine = (*ScanProofsEngine)(nil)

func NewScanProofsEngine(infile string, indices string, sigid string, ratelimit int, cachefile string, ignorefile string, g *libkb.GlobalContext) *ScanProofsEngine {
	return &ScanProofsEngine{
		infile:       infile,
		indices:      indices,
		sigid:        sigid,
		ratelimit:    ratelimit,
		cachefile:    cachefile,
		ignorefile:   ignorefile,
		Contextified: libkb.NewContextified(g),
	}
}

func (e *ScanProofsEngine) Name() string {
	return "ScanProofs"
}

func (e *ScanProofsEngine) Prereqs() Prereqs {
	return Prereqs{}
}

func (e *ScanProofsEngine) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{
		libkb.LogUIKind,
	}
}

func (e *ScanProofsEngine) SubConsumers() []libkb.UIConsumer {
	return []libkb.UIConsumer{}
}

func (e *ScanProofsEngine) Run(ctx *Context) (err error) {
	defer e.G().Trace("ScanProofsEngine#Run", func() error { return err })()

	var cache *ScanProofsCache
	saveevery := 1
	var ignored []string

	if len(e.cachefile) > 0 {
		lcache, err := LoadScanProofsCache(e.cachefile)
		if err == nil {
			e.G().Log.Info("Using cache: %v (%v entries)", e.cachefile, len(lcache.Proofs))
			cache = lcache
		} else {
			e.G().Log.Warning("Could not load cache: %v", err)
			cache = NewScanProofsCache()
		}
	}

	if len(e.ignorefile) > 0 {
		ignored, err = LoadScanProofsIgnore(e.ignorefile)
		if err != nil {
			return fmt.Errorf("Could not open ignore file: %v", err)
		}
		e.G().Log.Info("Using ignore file: %v (%v entries)", len(ignored), e.ignorefile)
	}

	if len(e.sigid) > 0 && len(e.indices) > 0 {
		return fmt.Errorf("Only one of sigid and indices allowed")
	}

	var ticker *time.Ticker
	e.G().Log.Info("Running with ratelimit: %v ms", e.ratelimit)
	if e.ratelimit < 0 {
		return fmt.Errorf("Ratelimit value can not be negative: %v", e.ratelimit)
	}
	if e.ratelimit > 0 {
		ticker = time.NewTicker(time.Millisecond * time.Duration(e.ratelimit))
	}
	defer func(ticker *time.Ticker) {
		if ticker != nil {
			ticker.Stop()
		}
	}(ticker)

	f, err := os.Open(e.infile)
	if err != nil {
		return err
	}
	r := csv.NewReader(f)

	var records []map[string]string

	header, err := r.Read()
	if err != nil {
		return fmt.Errorf("Could not read header: %v", err)
	}

	e.G().Log.Debug("Reading csv... ")
	for {
		rec, err := r.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			return err
		}
		record := make(map[string]string)
		for i, val := range rec {
			record[header[i]] = val
		}
		records = append(records, record)
	}
	e.G().Log.Debug("done")

	startindex := 0
	endindex := len(records)
	if len(e.indices) > 0 {
		startindex, endindex, err = e.ParseIndices(e.indices)
		if err != nil {
			return err
		}
	}
	if startindex < 0 {
		return fmt.Errorf("Invalid start index: %v", startindex)
	}
	if endindex > len(records) {
		return fmt.Errorf("Invalid end index: %v (%v records)", endindex, len(records))
	}

	nrun := 0
	nok := 0

	for i := startindex; i < endindex; i++ {
		rec := records[i]

		if len(e.sigid) > 0 && e.sigid != rec["sig_id"] {
			continue
		}

		e.G().Log.Info("i:%v user:%v type:%v sigid:%v", i, rec["username"], rec["proof_type"], rec["sig_id"])

		fast, err := e.ProcessOne(i, rec, cache, ignored)
		nrun++
		if err == nil {
			e.G().Log.Info("Ok\n")
			nok++
			if cache != nil {
				cache.Proofs[rec["sig_id"]] = true
				if i%saveevery == 0 {
					saveerr := cache.Save(e.cachefile)
					if saveerr != nil {
						e.G().Log.Warning("Could not save cache: %v", saveerr)
					}
				}
			}
		} else {
			e.G().Log.Errorf("%v FAILED: %v\n", i, err)
		}

		if !fast && ticker != nil {
			<-ticker.C
		}
	}

	e.G().Log.Info("---")
	e.G().Log.Info("proofs checked  : %v", nrun)
	e.G().Log.Info("oks             : %v", nok)
	e.G().Log.Info("fails           : %v", nrun-nok)

	return nil
}

func (e *ScanProofsEngine) ProcessOne(i int, rec map[string]string, cache *ScanProofsCache, ignored []string) (bool, error) {
	serverstate, err := strconv.Atoi(rec["state"])
	if err != nil {
		return true, fmt.Errorf("Could not read serverstate: %v", err)
	}

	shouldsucceed := true
	skip := false
	var skipreason string
	badstate := false

	switch keybase1.ProofState(serverstate) {
	case keybase1.ProofState_NONE:
		badstate = true
	case keybase1.ProofState_OK:
	case keybase1.ProofState_TEMP_FAILURE:
		shouldsucceed = false
	case keybase1.ProofState_PERM_FAILURE:
		shouldsucceed = false
	case keybase1.ProofState_LOOKING:
		skip = true
		skipreason = "server LOOKING"
	case keybase1.ProofState_SUPERSEDED:
		skip = true
		skipreason = "server SUPERSEDED"
	case keybase1.ProofState_POSTED:
		badstate = true
	case keybase1.ProofState_REVOKED:
		skip = true
		skipreason = "server REVOKED"
	case keybase1.ProofState_DELETED:
		shouldsucceed = false
	default:
		badstate = true
	}

	if cache != nil && cache.Proofs[rec["sig_id"]] {
		skip = true
		skipreason = "cached success"
	}

	for _, x := range ignored {
		if x == rec["sig_id"] {
			skip = true
			skipreason = "in ignored list"
		}
	}

	if badstate {
		return true, fmt.Errorf("Unsupported serverstate: %v", serverstate)
	}

	if skip {
		e.G().Log.Info("skipping: %v", skipreason)
		return true, nil
	}

	perr1, err := e.CheckOne(rec, false)
	perr2, err := e.CheckOne(rec, true)

	if (perr1 == nil) != (perr2 == nil) {
		return false, fmt.Errorf("Local verifiers disagree:\n  %v\n  %v", perr1, perr2)
	}

	if (perr1 == nil) != shouldsucceed {
		return false, fmt.Errorf("Local verifiers disagree with server: server:%v client:%v", serverstate, perr1)
	}

	return false, nil
}

func (e *ScanProofsEngine) CheckOne(rec map[string]string, forcepvl bool) (libkb.ProofError, error) {
	uid := keybase1.UID(rec["uid"])
	sigid := keybase1.SigID(rec["sig_id"])

	hint, err := e.GetSigHint(uid, sigid)
	if err != nil {
		return nil, err
	}

	link, err := e.GetRemoteProofChainLink(uid, sigid)
	if err != nil {
		return nil, err
	}

	pc, err := libkb.MakeProofChecker(e.G().Services, link)
	if err != nil {
		return nil, err
	}

	if forcepvl {
		perr := pvl.CheckProof(e.G(), pvl.GetHardcodedPvl(), link.GetProofType(), link, *hint)
		return perr, nil
	}

	perr := pc.CheckHint(e.G(), *hint)
	if perr != nil {
		return perr, nil
	}

	perr = pc.CheckStatus(e.G(), *hint)
	if perr != nil {
		return perr, nil
	}

	return perr, nil
}

func (e *ScanProofsEngine) GetSigHint(uid keybase1.UID, sigid keybase1.SigID) (*libkb.SigHint, error) {
	sighints, err := libkb.LoadAndRefreshSigHints(uid, e.G())
	if err != nil {
		return nil, err
	}

	sighint := sighints.Lookup(sigid)
	if sighint == nil {
		return nil, fmt.Errorf("No sighint for sigid %v", sigid)
	}

	return sighint, nil
}

func (e *ScanProofsEngine) GetRemoteProofChainLink(uid keybase1.UID, sigid keybase1.SigID) (libkb.RemoteProofChainLink, error) {
	user, err := libkb.LoadUser(libkb.NewLoadUserByUIDArg(e.G(), uid))
	if err != nil {
		return nil, err
	}

	link := user.LinkFromSigID(sigid)
	if link == nil {
		return nil, fmt.Errorf("Could not find link from sigid")
	}

	tlink, w := libkb.NewTypedChainLink(link)
	if w != nil {
		return nil, fmt.Errorf("Could not get typed chain link: %v", w.Warning())
	}

	switch vlink := tlink.(type) {
	case libkb.RemoteProofChainLink:
		return vlink, nil
	default:
		return nil, fmt.Errorf("Link is not a RemoteProofChainLink: %v", tlink)
	}
}

func (e *ScanProofsEngine) ParseIndices(indices string) (start int, end int, reterr error) {
	wrap := func(format string, arg ...interface{}) error {
		f2 := fmt.Sprintf("Invalid indices: %s", format)
		return fmt.Errorf(f2, arg...)
	}
	ss := strings.Split(strings.TrimSpace(indices), ":")
	if len(ss) != 2 {
		return start, end, wrap("must be like start:end")
	}
	var err error
	start, err = strconv.Atoi(ss[0])
	if err != nil {
		return start, end, wrap("could not convert start: %v", err)
	}
	end, err = strconv.Atoi(ss[1])
	if err != nil {
		return start, end, wrap("could not convert end: %v", err)
	}
	if end <= start {
		return start, end, wrap("%v <= %v", end, start)
	}
	reterr = nil
	return
}

// LoadScanProofsIgnore loads an ignore file and returns the list of proofids to ignore.
func LoadScanProofsIgnore(filepath string) ([]string, error) {
	f, err := os.Open(filepath)
	if err != nil {
		return nil, err
	}
	defer f.Close()
	scanner := bufio.NewScanner(f)
	scanner.Split(bufio.ScanLines)
	var ignored []string
	for scanner.Scan() {
		x := strings.TrimSpace(scanner.Text())
		if strings.HasPrefix(x, "//") {
			continue
		}
		ignored = append(ignored, x)
	}
	return ignored, nil
}
