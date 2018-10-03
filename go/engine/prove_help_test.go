// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"fmt"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/jsonhelpers"
	libkb "github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

type ProveUIMock struct {
	username, recheck, overwrite, warning, checked bool
	postID                                         string
	hook                                           func(arg keybase1.OkToCheckArg) (bool, string, error)
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

func (p *ProveUIMock) OutputInstructions(_ context.Context, arg keybase1.OutputInstructionsArg) error {
	return nil
}

func (p *ProveUIMock) OkToCheck(_ context.Context, arg keybase1.OkToCheckArg) (bool, error) {
	if !p.checked {
		p.checked = true
		ok, postID, err := p.hook(arg)
		p.postID = postID
		return ok, err
	}
	return false, fmt.Errorf("Check should have worked the first time!")
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

	hook := func(arg keybase1.OkToCheckArg) (bool, string, error) {
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
		res, err := g.API.Post(apiArg)
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

	proveUI := &ProveUIMock{hook: hook}

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

	hook := func(arg keybase1.OkToCheckArg) (bool, string, error) {
		apiArg := libkb.APIArg{
			Endpoint:    "rooter",
			SessionType: libkb.APISessionTypeREQUIRED,
			Args: libkb.HTTPArgs{
				"post": libkb.S{Val: "XXXXXXX"},
			},
		}
		res, err := g.API.Post(apiArg)
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

	proveUI := &ProveUIMock{hook: hook}

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
	_, err := g.API.Post(apiArg)
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

	hook := func(arg keybase1.OkToCheckArg) (bool, string, error) {
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
		res, err := g.API.Post(apiArg)
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

	proveUI := &ProveUIMock{hook: hook}

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
	proofService := g.GetProofServices().GetServiceType(serviceName)
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

	// Post the proof the gubble network and verify the sig hash
	hook := func(arg keybase1.OkToCheckArg) (bool, string, error) {
		sigID := eng.sigID
		require.False(tc.T, sigID.IsNil())

		apiArg := libkb.APIArg{
			Endpoint:    fmt.Sprintf("gubble_universe/%s", endpoint),
			SessionType: libkb.APISessionTypeREQUIRED,
			Args: libkb.HTTPArgs{
				"sig_hash":    libkb.S{Val: sigID.String()},
				"kb_username": libkb.S{Val: fu.Username},
			},
		}
		_, err := g.API.Post(apiArg)
		require.NoError(tc.T, err)

		apiArg = libkb.APIArg{
			Endpoint:    fmt.Sprintf("gubble_universe/%s/%s/proofs", endpoint, fu.Username),
			SessionType: libkb.APISessionTypeNONE,
		}

		res, err := g.GetAPI().Get(apiArg)
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
		}, tc.T.Logf)
		require.NoError(tc.T, err)
		require.Len(tc.T, objects, 1)

		var proofs []keybase1.ParamProofJSON
		err = objects[0].UnmarshalAgain(&proofs)
		require.NoError(tc.T, err)
		require.True(tc.T, len(proofs) >= 1)
		for _, proof := range proofs {
			if proof.KbUsername == fu.Username && sigID.Equal(proof.SigHash) {
				return true, sigID.String(), nil
			}
		}
		return false, "", fmt.Errorf("proof not found")
	}

	proveUI := &ProveUIMock{hook: hook}
	uis := libkb.UIs{
		LogUI:    g.UI.GetLogUI(),
		SecretUI: fu.NewSecretUI(),
		ProveUI:  proveUI,
	}
	m := libkb.NewMetaContextTODO(g).WithUIs(uis)
	err := RunEngine2(m, eng)
	require.NoError(tc.T, err)
	require.False(tc.T, proveUI.overwrite)
	require.False(tc.T, proveUI.warning)
	require.False(tc.T, proveUI.recheck)
	require.True(tc.T, proveUI.checked)
	return eng.sigID
}

func proveGubbleSocialFail(g *libkb.GlobalContext, fu *FakeUser, sigVersion libkb.SigVersion) (*ProveUIMock, error) {
	sv := keybase1.SigVersion(sigVersion)
	proofService := g.GetProofServices().GetServiceType("gubble.social")
	if proofService == nil {
		return nil, fmt.Errorf("Unable to find gubble.social service")
	}
	arg := keybase1.StartProofArg{
		Service:      proofService.GetTypeName(),
		Username:     fu.Username,
		Force:        false,
		PromptPosted: true,
		SigVersion:   &sv,
	}

	eng := NewProve(g, &arg)

	hook := func(arg keybase1.OkToCheckArg) (bool, string, error) {
		apiArg := libkb.APIArg{
			Endpoint:    "gubble_social",
			SessionType: libkb.APISessionTypeREQUIRED,
			Args: libkb.HTTPArgs{
				"sig_hash":    libkb.S{Val: "deadbeef"},
				"kb_username": libkb.S{Val: fu.Username},
			},
		}
		res, err := g.API.Post(apiArg)
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

	proveUI := &ProveUIMock{hook: hook}

	uis := libkb.UIs{
		LogUI:    g.UI.GetLogUI(),
		SecretUI: fu.NewSecretUI(),
		ProveUI:  proveUI,
	}
	m := libkb.NewMetaContextTODO(g).WithUIs(uis)
	err := RunEngine2(m, eng)
	return proveUI, err
}
