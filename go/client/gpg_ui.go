package client

import (
	"fmt"
	"strings"
	"text/tabwriter"

	"github.com/keybase/client/go/protocol"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
)

func NewGPGUIProtocol() rpc2.Protocol {
	return keybase1.GpgUiProtocol(GlobUI.GetGPGUI())
}

type GPGUI struct {
	parent   *UI
	noPrompt bool
}

func (g GPGUI) SelectKeyID(keys []keybase1.GPGKey) (string, error) {
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

	ret, err := g.parent.PromptSelectionOrCancel("Choose a key", 1, len(keys))
	if err != nil {
		if err == ErrInputCanceled {
			return "", nil
		}
		return "", err
	}
	return keys[ret-1].KeyID, nil
}

func (g GPGUI) SelectKeyAndPushOption(arg keybase1.SelectKeyAndPushOptionArg) (res keybase1.SelectKeyRes, err error) {
	keyID, err := g.SelectKeyID(arg.Keys)
	if err != nil {
		return res, err
	}
	res.KeyID = keyID
	return res, nil
}

func (g GPGUI) SelectKey(arg keybase1.SelectKeyArg) (string, error) {
	return g.SelectKeyID(arg.Keys)
}

func (g GPGUI) WantToAddGPGKey(dummy int) (bool, error) {
	if g.noPrompt {
		return false, nil
	}
	return g.parent.PromptYesNo("Would you like to add one of your PGP keys to Keybase?", PromptDefaultYes)
}

func (g GPGUI) ConfirmDuplicateKeyChosen(dummy int) (bool, error) {
	if g.noPrompt {
		return false, nil
	}
	return g.parent.PromptYesNo("You've already selected this public key for use on Keybase. Would you like to update it on Keybase?", PromptDefaultYes)
}
