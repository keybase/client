// Copyright 2018 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.
//
// +build !production

package service

import (
	"encoding/json"
	"fmt"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/davecgh/go-spew/spew"
	chatwallet "github.com/keybase/client/go/chat/wallet"
	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/protocol/stellar1"
	"github.com/keybase/stellarnet"
	"github.com/stellar/go/build"
	"github.com/stellar/go/clients/horizon"
	"golang.org/x/net/context"
)

func (t *DebuggingHandler) Script(ctx context.Context, arg keybase1.ScriptArg) (res string, err error) {
	ctx = libkb.WithLogTag(ctx, "DG")
	m := libkb.NewMetaContext(ctx, t.G())
	defer m.CTraceTimed(fmt.Sprintf("Script(%s)", arg.Script), func() error { return err })()
	args := arg.Args
	log := func(format string, args ...interface{}) {
		t.G().Log.CInfof(ctx, format, args...)
	}
	defer time.Sleep(100 * time.Millisecond) // Without this CInfof often doesn't reach the CLI
	switch arg.Script {
	case "rid2":
		if len(args) != 2 {
			return "", fmt.Errorf("require 2 args: <mode:gui/kbfs> <assertion>")
		}
		idBehavior := keybase1.TLFIdentifyBehavior_CHAT_GUI
		var iui libkb.IdentifyUI
		switch args[0] {
		case "gui":
		case "kbfs":
			idBehavior = keybase1.TLFIdentifyBehavior_CHAT_GUI
			iui = t.NewRemoteIdentifyUI(0)
		default:
			return "", fmt.Errorf("unrecognized mode %v: use 'gui' or 'kbfs'", args[0])
		}
		eng := engine.NewResolveThenIdentify2(t.G(), &keybase1.Identify2Arg{
			UserAssertion:    args[1],
			UseDelegateUI:    false,
			Reason:           keybase1.IdentifyReason{Reason: "debugging script"},
			CanSuppressUI:    true,
			IdentifyBehavior: idBehavior,
		})
		m = m.WithUIs(libkb.UIs{IdentifyUI: iui})
		err := engine.RunEngine2(m, eng)
		log("GetProofSet: %v", spew.Sdump(eng.GetProofSet()))
		log("ConfirmResult: %v", spew.Sdump(eng.ConfirmResult()))
		eres, eerr := eng.Result(m)
		if eres != nil {
			log("Result.Upk.Username: %v", spew.Sdump(eres.Upk.GetName()))
			log("Result.IdentifiedAt: %v", spew.Sdump(eres.IdentifiedAt))
			log("Result.TrackBreaks: %v", spew.Sdump(eres.TrackBreaks))
		} else {
			log("Result: %v", spew.Sdump(eres))
		}
		if eerr != nil {
			log("Result.error: %v", spew.Sdump(eerr))
		}
		return "", err
	case "loadkey":
		if len(args) != 2 {
			return "", fmt.Errorf("require 2 args: <uid> <kid>")
		}
		uid, err := keybase1.UIDFromString(args[0])
		if err != nil {
			return "", err
		}
		kid := keybase1.KIDFromString(args[1])
		_, _, _, err = t.G().GetUPAKLoader().LoadKeyV2(ctx, uid, kid)
		return "", err
	case "eldest":
		if len(args) != 1 {
			return "", fmt.Errorf("require 1 arg: username")
		}
		upak, _, err := t.G().GetUPAKLoader().LoadV2(libkb.NewLoadUserArgWithMetaContext(m).WithName(args[0]).WithPublicKeyOptional())
		if err != nil {
			return "", err
		}
		var eldestSeqnos []keybase1.Seqno
		for _, upak := range upak.AllIncarnations() {
			eldestSeqnos = append(eldestSeqnos, upak.EldestSeqno)
		}
		sort.Slice(eldestSeqnos, func(i, j int) bool {
			return eldestSeqnos[i] < eldestSeqnos[j]
		})
		obj := struct {
			Seqnos []keybase1.Seqno `json:"seqnos"`
		}{eldestSeqnos}
		bs, err := json.Marshal(obj)
		if err != nil {
			return "", err
		}
		return fmt.Sprintf("%v\n", string(bs)), nil
	case "userhigh":
		// List user high links
		if len(args) != 1 {
			return "", fmt.Errorf("require 1 arg: username")
		}
		user, err := libkb.LoadUser(libkb.NewLoadUserArgWithMetaContext(m).WithName(args[0]).WithPublicKeyOptional())
		if err != nil {
			return "", err
		}
		hls, err := user.GetHighLinkSeqnos(m)
		if err != nil {
			return "", err
		}
		obj := struct {
			Seqnos []keybase1.Seqno `json:"seqnos"`
		}{hls}
		bs, err := json.Marshal(obj)
		if err != nil {
			return "", err
		}
		return fmt.Sprintf("%v\n", string(bs)), nil
	case "buildpayment":
		// Run build a bunch of times with a tight spread.
		if len(args) != 1 {
			return "", fmt.Errorf("require 1 args: <recipient>")
		}
		recipient := args[0]
		count := 30
		var wg sync.WaitGroup
		for i := 0; i < count; i++ {
			i := i
			wg.Add(1)
			if i%5 == 0 {
				time.Sleep(100 * time.Millisecond)
			}
			if i == 10 {
				time.Sleep(2 * time.Second)
			}
			start := time.Now()
			log("build[%v] starting", i)
			go func() {
				defer wg.Done()
				ctx := libkb.WithLogTagWithValue(ctx, "DGI", fmt.Sprintf("%vx", i))
				res, err := t.walletHandler.BuildPaymentLocal(ctx, stellar1.BuildPaymentLocalArg{
					SessionID:          500 + i,
					FromPrimaryAccount: true,
					To:                 recipient,
					Amount:             "0.01",
					SecretNote:         "xx",
					PublicMemo:         "yy",
				})
				took := time.Now().Sub(start)
				if err != nil {
					log("build[%v] [%v] error: %v", i, took, err)
					return
				}
				log("build[%v] [%v] ok", i, took)
				if i == count-1 || err == nil {
					log("build[%v] res: %v", i, spew.Sdump(res))
				}
			}()
		}
		wg.Wait()
		return "", nil
	case "minichatpayment":
		parsed := chatwallet.FindChatTxCandidates(strings.Join(args, " "))
		minis := make([]libkb.MiniChatPayment, len(parsed))
		for i, p := range parsed {
			if p.Username == nil {
				return "", fmt.Errorf("missing username")
			}
			mini := libkb.MiniChatPayment{
				Username: libkb.NewNormalizedUsername(*p.Username),
				Amount:   p.Amount,
				Currency: p.CurrencyCode,
			}
			minis[i] = mini
		}
		stellarnet.SetClientAndNetwork(horizon.DefaultTestNetClient, build.TestNetwork)

		results, err := t.G().GetStellar().SendMiniChatPayments(m, minis)
		if err != nil {
			return "", err
		}
		log("send mini results: %+v", results)
		return "success", nil

	case "":
		return "", fmt.Errorf("empty script name")
	default:
		return "", fmt.Errorf("unknown script: %v", arg.Script)
	}
}

func (t *DebuggingHandler) NewRemoteIdentifyUI(sessionID int) *RemoteIdentifyUI {
	c := t.rpcClient()
	return &RemoteIdentifyUI{
		sessionID:    sessionID,
		uicli:        keybase1.IdentifyUiClient{Cli: c},
		logUI:        t.getLogUI(sessionID),
		Contextified: libkb.NewContextified(t.G()),
	}
}
