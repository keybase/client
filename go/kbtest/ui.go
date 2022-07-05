// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package kbtest

import (
	"fmt"
	"sync"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

type GPGTestUI struct {
	index int
}

func (g *GPGTestUI) SelectKeyAndPushOption(_ context.Context, arg keybase1.SelectKeyAndPushOptionArg) (keybase1.SelectKeyRes, error) {
	if len(arg.Keys) == 0 {
		return keybase1.SelectKeyRes{}, fmt.Errorf("no keys in arg")
	}
	if g.index >= len(arg.Keys) {
		return keybase1.SelectKeyRes{}, fmt.Errorf("test index %d outside bounds (num keys = %d)", g.index, len(arg.Keys))
	}
	key := arg.Keys[g.index]
	return keybase1.SelectKeyRes{KeyID: key.KeyID, DoSecretPush: true}, nil
}

func (g *GPGTestUI) SelectKey(_ context.Context, arg keybase1.SelectKeyArg) (string, error) {
	if len(arg.Keys) == 0 {
		return "", fmt.Errorf("no keys in arg")
	}
	if g.index >= len(arg.Keys) {
		return "", fmt.Errorf("test index %d outside bounds (num keys = %d)", g.index, len(arg.Keys))
	}
	key := arg.Keys[g.index]
	return key.KeyID, nil
}

func (g *GPGTestUI) WantToAddGPGKey(_ context.Context, _ int) (bool, error) {
	return true, nil
}

func (g *GPGTestUI) ConfirmDuplicateKeyChosen(_ context.Context, _ int) (bool, error) {
	return true, nil
}

func (g *GPGTestUI) ConfirmImportSecretToExistingKey(_ context.Context, _ int) (bool, error) {
	return false, nil
}

func (g *GPGTestUI) Sign(_ context.Context, _ keybase1.SignArg) (string, error) {
	return "", fmt.Errorf("not implemented")
}

func (g *GPGTestUI) GetTTY(_ context.Context) (string, error) {
	return "", nil
}

//
// FakeIdentifyUI
//

type FakeIdentifyUI struct {
	Proofs          map[string]string
	ProofResults    map[string]keybase1.LinkCheckResult
	User            *keybase1.User
	Confirmed       bool
	Keys            map[libkb.PGPFingerprint]*keybase1.TrackDiff
	DisplayKeyCalls int
	Outcome         *keybase1.IdentifyOutcome
	StartCount      int
	Token           keybase1.TrackToken
	BrokenTracking  bool
	DisplayTLFArg   keybase1.DisplayTLFCreateWithInviteArg
	DisplayTLFCount int
	StellarAccounts []keybase1.StellarAccount
	sync.Mutex
}

var _ libkb.IdentifyUI = (*FakeIdentifyUI)(nil)

func (ui *FakeIdentifyUI) FinishWebProofCheck(_ libkb.MetaContext, proof keybase1.RemoteProof, result keybase1.LinkCheckResult) error {
	ui.Lock()
	defer ui.Unlock()
	if ui.Proofs == nil {
		ui.Proofs = make(map[string]string)
	}
	ui.Proofs[proof.Key] = proof.Value

	if ui.ProofResults == nil {
		ui.ProofResults = make(map[string]keybase1.LinkCheckResult)
	}
	ui.ProofResults[proof.Key] = result
	if result.BreaksTracking {
		ui.BrokenTracking = true
	}
	return nil
}

func (ui *FakeIdentifyUI) FinishSocialProofCheck(_ libkb.MetaContext, proof keybase1.RemoteProof, result keybase1.LinkCheckResult) error {
	ui.Lock()
	defer ui.Unlock()
	if ui.Proofs == nil {
		ui.Proofs = make(map[string]string)
	}
	ui.Proofs[proof.Key] = proof.Value
	if ui.ProofResults == nil {
		ui.ProofResults = make(map[string]keybase1.LinkCheckResult)
	}
	ui.ProofResults[proof.Key] = result
	if result.BreaksTracking {
		ui.BrokenTracking = true
	}
	return nil
}

func (ui *FakeIdentifyUI) Confirm(_ libkb.MetaContext, outcome *keybase1.IdentifyOutcome) (result keybase1.ConfirmResult, err error) {
	ui.Lock()
	defer ui.Unlock()
	ui.Outcome = outcome
	result.IdentityConfirmed = outcome.TrackOptions.BypassConfirm
	result.RemoteConfirmed = outcome.TrackOptions.BypassConfirm && !outcome.TrackOptions.ExpiringLocal
	return
}

func (ui *FakeIdentifyUI) DisplayCryptocurrency(libkb.MetaContext, keybase1.Cryptocurrency) error {
	return nil
}

func (ui *FakeIdentifyUI) DisplayStellarAccount(_ libkb.MetaContext, acc keybase1.StellarAccount) error {
	ui.Lock()
	defer ui.Unlock()
	ui.StellarAccounts = append(ui.StellarAccounts, acc)
	return nil
}

func (ui *FakeIdentifyUI) DisplayKey(_ libkb.MetaContext, ik keybase1.IdentifyKey) error {
	ui.Lock()
	defer ui.Unlock()
	if ui.Keys == nil {
		ui.Keys = make(map[libkb.PGPFingerprint]*keybase1.TrackDiff)
	}
	fp := libkb.ImportPGPFingerprintSlice(ik.PGPFingerprint)

	ui.Keys[*fp] = ik.TrackDiff
	ui.DisplayKeyCalls++
	return nil
}
func (ui *FakeIdentifyUI) ReportLastTrack(libkb.MetaContext, *keybase1.TrackSummary) error {
	return nil
}
func (ui *FakeIdentifyUI) Start(_ libkb.MetaContext, username string, _ keybase1.IdentifyReason, forceDisplay bool) error {
	ui.Lock()
	defer ui.Unlock()
	ui.StartCount++
	return nil
}
func (ui *FakeIdentifyUI) Cancel(_ libkb.MetaContext) error {
	return nil
}
func (ui *FakeIdentifyUI) Finish(_ libkb.MetaContext) error {
	return nil
}
func (ui *FakeIdentifyUI) Dismiss(_ libkb.MetaContext, _ string, _ keybase1.DismissReason) error {
	return nil
}
func (ui *FakeIdentifyUI) LaunchNetworkChecks(_ libkb.MetaContext, id *keybase1.Identity, user *keybase1.User) error {
	ui.Lock()
	defer ui.Unlock()
	ui.User = user
	return nil
}
func (ui *FakeIdentifyUI) DisplayTrackStatement(libkb.MetaContext, string) error {
	return nil
}
func (ui *FakeIdentifyUI) DisplayUserCard(libkb.MetaContext, keybase1.UserCard) error {
	return nil
}
func (ui *FakeIdentifyUI) ReportTrackToken(_ libkb.MetaContext, tok keybase1.TrackToken) error {
	ui.Token = tok
	return nil
}
func (ui *FakeIdentifyUI) SetStrict(b bool) {
}
func (ui *FakeIdentifyUI) DisplayTLFCreateWithInvite(_ libkb.MetaContext, arg keybase1.DisplayTLFCreateWithInviteArg) error {
	ui.DisplayTLFCount++
	ui.DisplayTLFArg = arg
	return nil
}
