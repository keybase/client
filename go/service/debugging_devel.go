// Copyright 2018 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.
//
//go:build !production

package service

import (
	"context"
	"encoding/json"
	"fmt"
	"slices"
	"time"

	"github.com/davecgh/go-spew/spew"
	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/teams"
)

func (t *DebuggingHandler) scriptExtras(ctx context.Context, arg keybase1.ScriptArg) (res string, err error) {
	ctx = libkb.WithLogTag(ctx, "DG")
	m := libkb.NewMetaContext(ctx, t.G())
	args := arg.Args
	log := func(format string, args ...any) {
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

		// UPAK
		upak, _, err := t.G().GetUPAKLoader().LoadV2(libkb.NewLoadUserArgWithMetaContext(m).WithName(args[0]).WithPublicKeyOptional())
		if err != nil {
			return "", err
		}
		var upakEldestSeqnos []keybase1.Seqno
		for _, upak := range upak.AllIncarnations() {
			upakEldestSeqnos = append(upakEldestSeqnos, upak.EldestSeqno)
		}
		slices.Sort(upakEldestSeqnos)

		// Full user
		them, err := libkb.LoadUser(libkb.NewLoadUserArgWithMetaContext(m).WithName(args[0]).WithPublicKeyOptional())
		if err != nil {
			return "", err
		}

		obj := struct {
			UPAKEldestSeqno     keybase1.Seqno   `json:"upak_current_eldest"`
			UPAKEldestSeqnos    []keybase1.Seqno `json:"upak_eldest_seqnos"`
			FullUserEldestSeqno keybase1.Seqno   `json:"fu_eldest_seqno"`
		}{upak.ToUserVersion().EldestSeqno, upakEldestSeqnos, them.GetCurrentEldestSeqno()}
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
	case "proof-suggestions":
		if len(args) > 0 {
			return "", fmt.Errorf("require 0 args")
		}
		ret, err := t.userHandler.ProofSuggestions(ctx, 0)
		if err != nil {
			return "", err
		}
		log("%v", spew.Sdump(ret))
		return "", nil
	case "execute-invite":
		teamID, err := keybase1.TeamIDFromString("978d0d88131e85123a142f87e8769d24")
		if err != nil {
			return "", err
		}
		err = teams.HandleSBSRequest(ctx, m.G(), keybase1.TeamSBSMsg{
			TeamID: teamID,
			Invitees: []keybase1.TeamInvitee{{
				InviteID:    "828cb94d4c2b07b694ce578b2944ae27",
				Uid:         "7080d7d007b46805c33e66b267e1e819",
				EldestSeqno: 30,
				Role:        keybase1.TeamRole_OWNER,
			}},
		})
		return "", err
	case "re-add":
		teamID, err := keybase1.TeamIDFromString("fa6da9bceb6df00c5c6afd724a889d24")
		if err != nil {
			return "", err
		}
		err = teams.ReAddMemberAfterReset(ctx, m.G(), teamID, "ireset1")
		return "", err
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
