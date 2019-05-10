// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"fmt"
	"testing"
	"time"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/jsonhelpers"
	libkb "github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type ProveUIMock struct {
	username, recheck, overwrite, warning, checked bool
	postID                                         string
	outputInstructionsHook                         func(context.Context, keybase1.OutputInstructionsArg) error
	okToCheckHook                                  func(context.Context, keybase1.OkToCheckArg) (bool, string, error)
	checkingHook                                   func(context.Context, keybase1.CheckingArg) error
}

func (p *ProveUIMock) PromptOverwrite(_ context.Context, arg keybase1.PromptOverwriteArg) (bool, error) {
	p.overwrite = true
	return true, nil
}

func (p *ProveUIMock) PromptUsername(_ context.Context, arg keybase1.PromptUsernameArg) (string, error) {
	p.username = true
	return "", nil
}

func (p *ProveUIMock) OutputPrechecks(_ context.Context, arg keybase1.OutputPrechecksArg) error {
	return nil
}

func (p *ProveUIMock) PreProofWarning(_ context.Context, arg keybase1.PreProofWarningArg) (bool, error) {
	p.warning = true
	return true, nil
}

func (p *ProveUIMock) OutputInstructions(ctx context.Context, arg keybase1.OutputInstructionsArg) error {
	if p.outputInstructionsHook != nil {
		return p.outputInstructionsHook(ctx, arg)
	}
	return nil
}

func (p *ProveUIMock) OkToCheck(ctx context.Context, arg keybase1.OkToCheckArg) (bool, error) {
	if !p.checked {
		p.checked = true
		ok, postID, err := p.okToCheckHook(ctx, arg)
		p.postID = postID
		return ok, err
	}
	return false, fmt.Errorf("Check should have worked the first time!")
}

func (p *ProveUIMock) Checking(ctx context.Context, arg keybase1.CheckingArg) (err error) {
	if p.checkingHook != nil {
		err = p.checkingHook(ctx, arg)
	}
	p.checked = true
	return err
}

func (p *ProveUIMock) ContinueChecking(ctx context.Context, _ int) (bool, error) {
	return true, nil
}

func (p *ProveUIMock) DisplayRecheckWarning(_ context.Context, arg keybase1.DisplayRecheckWarningArg) error {
	p.recheck = true
	return nil
}

func proveRooter(g *libkb.GlobalContext, fu *FakeUser, sigVersion libkb.SigVersion) (*ProveUIMock, keybase1.SigID, error) {
	return proveRooterWithSecretUI(g, fu, fu.NewSecretUI(), sigVersion)
}

func proveRooterWithSecretUI(g *libkb.GlobalContext, fu *FakeUser, secretUI libkb.SecretUI, sigVersion libkb.SigVersion) (*ProveUIMock, keybase1.SigID, error) {
	sv := keybase1.SigVersion(sigVersion)
	arg := keybase1.StartProofArg{
		Service:      "rooter",
		Username:     fu.Username,
		Force:        false,
		PromptPosted: true,
		SigVersion:   &sv,
	}
	eng := NewProve(g, &arg)

	okToCheckHook := func(ctx context.Context, arg keybase1.OkToCheckArg) (bool, string, error) {
		sigID := eng.sigID
		if sigID.IsNil() {
			return false, "", fmt.Errorf("empty sigID; can't make a post")
		}
		apiArg := libkb.APIArg{
			Endpoint:    "rooter",
			SessionType: libkb.APISessionTypeREQUIRED,
			Args: libkb.HTTPArgs{
				"post": libkb.S{Val: sigID.ToMediumID()},
			},
		}
		res, err := g.API.Post(libkb.NewMetaContext(ctx, g), apiArg)
		ok := err == nil
		var postID string
		if ok {
			pid, err := res.Body.AtKey("post_id").GetString()
			if err == nil {
				postID = pid
			}
		}
		return ok, postID, err
	}

	proveUI := &ProveUIMock{okToCheckHook: okToCheckHook}

	uis := libkb.UIs{
		LogUI:    g.UI.GetLogUI(),
		SecretUI: secretUI,
		ProveUI:  proveUI,
	}
	m := libkb.NewMetaContextTODO(g).WithUIs(uis)
	err := RunEngine2(m, eng)
	return proveUI, eng.sigID, err
}

func proveRooterFail(g *libkb.GlobalContext, fu *FakeUser, sigVersion libkb.SigVersion) (*ProveUIMock, error) {
	sv := keybase1.SigVersion(sigVersion)
	arg := keybase1.StartProofArg{
		Service:      "rooter",
		Username:     fu.Username,
		Force:        false,
		PromptPosted: true,
		SigVersion:   &sv,
	}

	eng := NewProve(g, &arg)

	okToCheckHook := func(ctx context.Context, arg keybase1.OkToCheckArg) (bool, string, error) {
		apiArg := libkb.APIArg{
			Endpoint:    "rooter",
			SessionType: libkb.APISessionTypeREQUIRED,
			Args: libkb.HTTPArgs{
				"post": libkb.S{Val: "XXXXXXX"},
			},
		}
		res, err := g.API.Post(libkb.NewMetaContext(ctx, g), apiArg)
		ok := err == nil
		var postID string
		if ok {
			pid, err := res.Body.AtKey("post_id").GetString()
			if err == nil {
				postID = pid
			}
		}
		return ok, postID, err
	}

	proveUI := &ProveUIMock{okToCheckHook: okToCheckHook}

	uis := libkb.UIs{
		LogUI:    g.UI.GetLogUI(),
		SecretUI: fu.NewSecretUI(),
		ProveUI:  proveUI,
	}
	m := libkb.NewMetaContextTODO(g).WithUIs(uis)
	err := RunEngine2(m, eng)
	return proveUI, err
}

func proveRooterRemove(g *libkb.GlobalContext, postID string) error {
	apiArg := libkb.APIArg{
		Endpoint:    "rooter/delete",
		SessionType: libkb.APISessionTypeREQUIRED,
		Args: libkb.HTTPArgs{
			"post_id": libkb.S{Val: postID},
		},
	}
	_, err := g.API.Post(libkb.NewMetaContextTODO(g), apiArg)
	return err
}

func proveRooterOther(g *libkb.GlobalContext, fu *FakeUser, rooterUsername string, sigVersion libkb.SigVersion) (*ProveUIMock, keybase1.SigID, error) {
	sv := keybase1.SigVersion(sigVersion)
	arg := keybase1.StartProofArg{
		Service:      "rooter",
		Username:     rooterUsername,
		Force:        false,
		PromptPosted: true,
		SigVersion:   &sv,
	}

	eng := NewProve(g, &arg)

	okToCheckHook := func(ctx context.Context, arg keybase1.OkToCheckArg) (bool, string, error) {
		sigID := eng.sigID
		if sigID.IsNil() {
			return false, "", fmt.Errorf("empty sigID; can't make a post")
		}
		apiArg := libkb.APIArg{
			Endpoint:    "rooter",
			SessionType: libkb.APISessionTypeREQUIRED,
			Args: libkb.HTTPArgs{
				"post":     libkb.S{Val: sigID.ToMediumID()},
				"username": libkb.S{Val: rooterUsername},
			},
		}
		res, err := g.API.Post(libkb.NewMetaContext(ctx, g), apiArg)
		ok := err == nil
		var postID string
		if ok {
			pid, err := res.Body.AtKey("post_id").GetString()
			if err == nil {
				postID = pid
			}
		}
		return ok, postID, err
	}

	proveUI := &ProveUIMock{okToCheckHook: okToCheckHook}

	uis := libkb.UIs{
		LogUI:    g.UI.GetLogUI(),
		SecretUI: fu.NewSecretUI(),
		ProveUI:  proveUI,
	}
	m := libkb.NewMetaContextTODO(g).WithUIs(uis)
	err := RunEngine2(m, eng)
	return proveUI, eng.sigID, err
}

func proveGubbleSocial(tc libkb.TestContext, fu *FakeUser, sigVersion libkb.SigVersion) keybase1.SigID {
	return proveGubbleUniverse(tc, "gubble.social", "gubble_social", fu, sigVersion)
}

func proveGubbleCloud(tc libkb.TestContext, fu *FakeUser, sigVersion libkb.SigVersion) keybase1.SigID {
	return proveGubbleUniverse(tc, "gubble.cloud", "gubble_cloud", fu, sigVersion)
}

func proveGubbleUniverse(tc libkb.TestContext, serviceName, endpoint string, fu *FakeUser, sigVersion libkb.SigVersion) keybase1.SigID {
	tc.T.Logf("proof for %s", serviceName)
	g := tc.G
	sv := keybase1.SigVersion(sigVersion)
	proofService := g.GetProofServices().GetServiceType(context.Background(), serviceName)
	require.NotNil(tc.T, proofService)

	// Post a proof to the testing generic social service
	arg := keybase1.StartProofArg{
		Service:      proofService.GetTypeName(),
		Username:     fu.Username,
		Force:        false,
		PromptPosted: true,
		SigVersion:   &sv,
	}
	eng := NewProve(g, &arg)

	// Post the proof to the gubble network and verify the sig hash
	outputInstructionsHook := func(ctx context.Context, _ keybase1.OutputInstructionsArg) error {
		sigID := eng.sigID
		require.False(tc.T, sigID.IsNil())
		mctx := libkb.NewMetaContext(ctx, g)

		apiArg := libkb.APIArg{
			Endpoint:    fmt.Sprintf("gubble_universe/%s", endpoint),
			SessionType: libkb.APISessionTypeREQUIRED,
			Args: libkb.HTTPArgs{
				"sig_hash":      libkb.S{Val: sigID.String()},
				"username":      libkb.S{Val: fu.Username},
				"kb_username":   libkb.S{Val: fu.Username},
				"kb_ua":         libkb.S{Val: libkb.UserAgent},
				"json_redirect": libkb.B{Val: true},
			},
		}
		_, err := g.API.Post(libkb.NewMetaContext(ctx, g), apiArg)
		require.NoError(tc.T, err)

		apiArg = libkb.APIArg{
			Endpoint:    fmt.Sprintf("gubble_universe/%s/%s/proofs", endpoint, fu.Username),
			SessionType: libkb.APISessionTypeNONE,
		}
		res, err := g.GetAPI().Get(mctx, apiArg)
		require.NoError(tc.T, err)
		objects, err := jsonhelpers.AtSelectorPath(res.Body, []keybase1.SelectorEntry{
			keybase1.SelectorEntry{
				IsKey: true,
				Key:   "res",
			},
			keybase1.SelectorEntry{
				IsKey: true,
				Key:   "keybase_proofs",
			},
		}, tc.T.Logf, libkb.NewInvalidPVLSelectorError)
		require.NoError(tc.T, err)
		require.Len(tc.T, objects, 1)

		var proofs []keybase1.ParamProofJSON
		err = objects[0].UnmarshalAgain(&proofs)
		require.NoError(tc.T, err)
		require.True(tc.T, len(proofs) >= 1)
		for _, proof := range proofs {
			if proof.KbUsername == fu.Username && sigID.Equal(proof.SigHash) {
				return nil
			}
		}
		assert.Fail(tc.T, "proof not found")
		return nil
	}

	proveUI := &ProveUIMock{outputInstructionsHook: outputInstructionsHook}
	uis := libkb.UIs{
		LogUI:    g.UI.GetLogUI(),
		SecretUI: fu.NewSecretUI(),
		ProveUI:  proveUI,
	}
	m := libkb.NewMetaContextTODO(g).WithUIs(uis)
	err := RunEngine2(m, eng)
	checkFailed(tc.T.(testing.TB))
	require.NoError(tc.T, err)
	require.False(tc.T, proveUI.overwrite)
	require.False(tc.T, proveUI.warning)
	require.False(tc.T, proveUI.recheck)
	require.True(tc.T, proveUI.checked)
	return eng.sigID
}

func proveGubbleSocialFail(tc libkb.TestContext, fu *FakeUser, sigVersion libkb.SigVersion) {
	g := tc.G
	sv := keybase1.SigVersion(sigVersion)
	proofService := g.GetProofServices().GetServiceType(context.Background(), "gubble.social")
	require.NotNil(tc.T, proofService, "expected to find gubble.social service type")
	arg := keybase1.StartProofArg{
		Service:      proofService.GetTypeName(),
		Username:     fu.Username,
		Force:        false,
		PromptPosted: true,
		SigVersion:   &sv,
	}

	eng := NewProve(g, &arg)
	proveUI := &ProveUIMock{}
	uis := libkb.UIs{
		LogUI:    g.UI.GetLogUI(),
		SecretUI: fu.NewSecretUI(),
		ProveUI:  proveUI,
	}
	mctx := libkb.NewMetaContextTODO(g).WithUIs(uis)
	mctx, cancel1 := mctx.WithTimeout(12 * time.Second)
	defer cancel1()
	mctx, cancel2 := libkb.NewMetaContextTODO(g).WithUIs(uis).WithContextCancel()
	defer cancel2()

	proveUI.checkingHook = func(_ context.Context, _ keybase1.CheckingArg) error {
		if mctx.Ctx().Err() != nil {
			// This is supposed to be the first thing to cancel the context.
			assert.Fail(tc.T, "unexpectedly cancelled")
		}
		cancel2()
		return nil
	}

	// This proof will never succeed, so the Prove engine would never stop of its own accord.
	err := RunEngine2(mctx, eng)
	require.Error(tc.T, err)
	checkFailed(tc.T.(testing.TB))
}

func checkFailed(t testing.TB) {
	if t.Failed() {
		// The test failed. Possibly in anothe goroutine. Look earlier in the logs for the real failure.
		require.FailNow(t, "test already failed")
	}
}
