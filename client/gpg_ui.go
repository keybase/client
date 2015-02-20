package main

import (
	"fmt"
	"strings"
	"text/tabwriter"

	"github.com/keybase/go/libkb"
	keybase_1 "github.com/keybase/protocol/go"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
)

type GPGUIServer struct {
	ui libkb.GPGUI
}

func NewGPGUIProtocol() rpc2.Protocol {
	return keybase_1.GpgUiProtocol(&GPGUIServer{G_UI.GetGPGUI()})
}

type GPGUI struct {
	parent *UI
}

func (g *GPGUIServer) SelectKeyAndPushOption(arg keybase_1.SelectKeyAndPushOptionArg) (res keybase_1.SelectKeyRes, err error) {
	return g.ui.SelectKeyAndPushOption(arg)
}
func (g *GPGUIServer) SelectKey(arg keybase_1.SelectKeyArg) (string, error) {
	return g.ui.SelectKey(arg)
}
func (g *GPGUIServer) WantToAddGPGKey(sessionID int) (bool, error) {
	return g.ui.WantToAddGPGKey()
}

func (g GPGUI) SelectKeyAndPushOption(arg keybase_1.SelectKeyAndPushOptionArg) (res keybase_1.SelectKeyRes, err error) {
	w := new(tabwriter.Writer)
	w.Init(g.parent.OutputWriter(), 5, 0, 3, ' ', 0)

	fmt.Fprintf(w, "#\tAlgo\tKey Id\tExpires\tEmail\n")
	fmt.Fprintf(w, "=\t====\t======\t=======\t=====\n")
	for i, k := range arg.Keys {
		(fmt.Fprintf(w, "%d\t%s\t%s\t%s\t%s\n", i+1, k.Algorithm, k.KeyID, k.Expiration, strings.Join(k.Identities, ", ")))
	}
	w.Flush()

	ret, err := g.parent.PromptSelectionOrCancel("Choose a key", 1, len(arg.Keys))
	if err != nil {
		if err == ErrInputCanceled {
			return res, nil
		}
		return res, err
	}
	res.KeyID = arg.Keys[ret-1].KeyID

	msg := `
Keybase can host an encrypted copy of your PGP private key on its servers.
It can only be decrypted with your passphrase, which Keybase never knows.

`
	g.parent.Output(msg)
	prompt := "Push an encrypted copy of your private key to Keybase.io?"
	res.DoSecretPush, err = g.parent.PromptYesNo(prompt, PromptDefaultYes)

	return res, nil
}

func (g GPGUI) SelectKey(arg keybase_1.SelectKeyArg) (string, error) {
	w := new(tabwriter.Writer)
	w.Init(g.parent.OutputWriter(), 5, 0, 3, ' ', 0)

	fmt.Fprintf(w, "#\tAlgo\tKey Id\tCreated\tEmail\n")
	fmt.Fprintf(w, "=\t====\t======\t=======\t=====\n")
	for i, k := range arg.Keys {
		(fmt.Fprintf(w, "%d\t%s\t%s\t%s\t%s\n", i+1, k.Algorithm, k.KeyID, k.Creation, strings.Join(k.Identities, ", ")))
	}
	w.Flush()

	ret, err := g.parent.PromptSelectionOrCancel("Choose a key", 1, len(arg.Keys))
	if err != nil {
		if err == ErrInputCanceled {
			return "", nil
		}
		return "", err
	}
	return arg.Keys[ret-1].KeyID, nil
}

func (g GPGUI) WantToAddGPGKey() (bool, error) {
	return g.parent.PromptYesNo("Would you like to add one of your PGP keys to Keybase?", PromptDefaultYes)
}
