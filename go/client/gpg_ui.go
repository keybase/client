// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"fmt"
	"strings"
	"text/tabwriter"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	"golang.org/x/net/context"
)

func NewGPGUIProtocol(g *libkb.GlobalContext) rpc.Protocol {
	return keybase1.GpgUiProtocol(g.UI.GetGPGUI())
}

type GPGUI struct {
	libkb.Contextified
	parent   libkb.TerminalUI
	noPrompt bool
	tty      string
}

func NewGPGUI(g *libkb.GlobalContext, t libkb.TerminalUI, np bool, tty string) GPGUI {
	return GPGUI{Contextified: libkb.NewContextified(g), parent: t, noPrompt: np, tty: tty}
}

func (g GPGUI) SelectKeyID(_ context.Context, keys []keybase1.GPGKey) (string, error) {
	w := new(tabwriter.Writer)
	w.Init(g.parent.OutputWriter(), 5, 0, 3, ' ', 0)

	fmt.Fprintf(w, "#\tAlgo\tKey Id\tCreated\tUserId\n")
	fmt.Fprintf(w, "=\t====\t======\t=======\t======\n")
	for i, k := range keys {
		userIDs := make([]string, len(k.Identities))
		for j, userID := range k.Identities {
			userIDs[j] = fmt.Sprintf("%s <%s>", userID.Username, userID.Email)
		}
		(fmt.Fprintf(w, "%d\t%s\t%s\t%s\t%s\n", i+1, k.Algorithm, k.KeyID, k.Creation, strings.Join(userIDs, ", ")))
	}
	w.Flush()

	ret, err := PromptSelectionOrCancel(PromptDescriptorGPGSelectKey, g.parent, "Choose a key", 1, len(keys))
	if err != nil {
		if err == ErrInputCanceled {
			return "", nil
		}
		return "", err
	}
	return keys[ret-1].KeyID, nil
}

func (g GPGUI) SelectKeyAndPushOption(ctx context.Context, arg keybase1.SelectKeyAndPushOptionArg) (res keybase1.SelectKeyRes, err error) {
	keyID, err := g.SelectKeyID(ctx, arg.Keys)
	if err != nil {
		return res, err
	}
	res.KeyID = keyID
	return res, nil
}

func (g GPGUI) SelectKey(ctx context.Context, arg keybase1.SelectKeyArg) (string, error) {
	return g.SelectKeyID(ctx, arg.Keys)
}

func (g GPGUI) WantToAddGPGKey(_ context.Context, _ int) (bool, error) {
	if g.noPrompt {
		return false, nil
	}
	return g.parent.PromptYesNo(PromptDescriptorGPGOKToAdd, "Would you like to add one of your PGP keys to Keybase?", libkb.PromptDefaultYes)
}

func (g GPGUI) ConfirmDuplicateKeyChosen(_ context.Context, _ int) (bool, error) {
	if g.noPrompt {
		return false, nil
	}
	return g.parent.PromptYesNo(PromptDescriptorGPGConfirmDuplicateKey, "You've already selected this public key for use on Keybase. Would you like to update it on Keybase?", libkb.PromptDefaultYes)
}

func (g GPGUI) GetTTY(_ context.Context) (string, error) {
	return g.tty, nil
}

func (g GPGUI) Sign(_ context.Context, arg keybase1.SignArg) (string, error) {
	fp, err := libkb.PGPFingerprintFromSlice(arg.Fingerprint)
	if err != nil {
		return "", err
	}
	cli := g.G().GetGpgClient()
	if err := cli.Configure(); err != nil {
		return "", err
	}
	cli.SetTTY(g.tty)
	return cli.Sign(*fp, arg.Msg)
}
