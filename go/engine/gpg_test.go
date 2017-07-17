// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"fmt"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

type gpgtestui struct {
	index          int
	keyChosenCount int
}

func (g *gpgtestui) SelectKeyAndPushOption(_ context.Context, arg keybase1.SelectKeyAndPushOptionArg) (keybase1.SelectKeyRes, error) {
	if len(arg.Keys) == 0 {
		return keybase1.SelectKeyRes{}, fmt.Errorf("no keys in arg")
	}
	if g.index >= len(arg.Keys) {
		return keybase1.SelectKeyRes{}, fmt.Errorf("test index %d outside bounds (num keys = %d)", g.index, len(arg.Keys))
	}
	key := arg.Keys[g.index]
	return keybase1.SelectKeyRes{KeyID: key.KeyID, DoSecretPush: true}, nil
}

func (g *gpgtestui) SelectKey(_ context.Context, arg keybase1.SelectKeyArg) (string, error) {
	if len(arg.Keys) == 0 {
		return "", fmt.Errorf("no keys in arg")
	}
	if g.index >= len(arg.Keys) {
		return "", fmt.Errorf("test index %d outside bounds (num keys = %d)", g.index, len(arg.Keys))
	}
	key := arg.Keys[g.index]
	return key.KeyID, nil
}

func (g *gpgtestui) WantToAddGPGKey(_ context.Context, _ int) (bool, error) {
	return true, nil
}

func (g *gpgtestui) ConfirmDuplicateKeyChosen(_ context.Context, _ int) (bool, error) {
	g.keyChosenCount++
	return true, nil
}

func (g *gpgtestui) Sign(_ context.Context, arg keybase1.SignArg) (string, error) {
	fp, err := libkb.PGPFingerprintFromSlice(arg.Fingerprint)
	if err != nil {
		return "", err
	}
	cli := libkb.G.GetGpgClient()
	if err := cli.Configure(); err != nil {
		return "", err
	}
	return cli.Sign(*fp, arg.Msg)
}

func (g *gpgtestui) GetTTY(_ context.Context) (string, error) {
	return "", nil
}

type gpgTestUIBadSign struct {
	gpgtestui
}

func (g *gpgTestUIBadSign) Sign(_ context.Context, arg keybase1.SignArg) (string, error) {
	return "", libkb.GpgError{M: "Artificial GPG failure for testing"}
}

// doesn't push secret to api server
type gpgPubOnlyTestUI struct {
	*gpgtestui
}

func (g *gpgPubOnlyTestUI) SelectKeyAndPushOption(_ context.Context, arg keybase1.SelectKeyAndPushOptionArg) (keybase1.SelectKeyRes, error) {
	if len(arg.Keys) == 0 {
		return keybase1.SelectKeyRes{}, fmt.Errorf("no keys in arg")
	}
	key := arg.Keys[0]
	return keybase1.SelectKeyRes{KeyID: key.KeyID, DoSecretPush: false}, nil
}

// selects a key by email address
type gpgSelectEmailUI struct {
	*gpgtestui
	Email string
}

func newGPGSelectEmailUI(email string) *gpgSelectEmailUI {
	return &gpgSelectEmailUI{
		gpgtestui: &gpgtestui{},
		Email:     email,
	}
}

func (g *gpgSelectEmailUI) SelectKey(_ context.Context, arg keybase1.SelectKeyArg) (string, error) {
	for _, key := range arg.Keys {
		for _, id := range key.Identities {
			if id.Email == g.Email {
				return key.KeyID, nil
			}
		}
	}
	return "", fmt.Errorf("no keys found for email %q", g.Email)
}

func (g *gpgSelectEmailUI) SelectKeyAndPushOption(_ context.Context, arg keybase1.SelectKeyAndPushOptionArg) (keybase1.SelectKeyRes, error) {
	for _, key := range arg.Keys {
		for _, id := range key.Identities {
			if id.Email == g.Email {
				return keybase1.SelectKeyRes{KeyID: key.KeyID, DoSecretPush: false}, nil
			}
		}
	}
	return keybase1.SelectKeyRes{}, fmt.Errorf("no keys found for email %q", g.Email)
}
