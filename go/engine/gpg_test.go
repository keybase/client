// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"fmt"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

type gpgtestui struct {
	libkb.Contextified
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

func (g *gpgtestui) ConfirmImportSecretToExistingKey(_ context.Context, _ int) (bool, error) {
	return false, nil
}

func (g *gpgtestui) Sign(ctx context.Context, arg keybase1.SignArg) (string, error) {
	mctx := g.MetaContext(ctx)
	fp, err := libkb.PGPFingerprintFromSlice(arg.Fingerprint)
	if err != nil {
		return "", err
	}
	cli := g.G().GetGpgClient()
	if err := cli.Configure(mctx); err != nil {
		return "", err
	}
	return cli.Sign(mctx, *fp, arg.Msg)
}

func (g *gpgtestui) GetTTY(_ context.Context) (string, error) {
	return "", nil
}

func (g *gpgtestui) MetaContext(ctx context.Context) libkb.MetaContext {
	return libkb.NewMetaContext(ctx, g.G())
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
