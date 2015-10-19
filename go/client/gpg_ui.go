package client

import (
	"fmt"
	"strings"
	"text/tabwriter"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/protocol"
	rpc "github.com/keybase/go-framed-msgpack-rpc"
)

func NewGPGUIProtocol() rpc.Protocol {
	return keybase1.GpgUiProtocol(GlobUI.GetGPGUI())
}

type GPGUI struct {
	parent   *UI
	noPrompt bool
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

	ret, err := g.parent.PromptSelectionOrCancel("Choose a key", 1, len(keys))
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
	return g.parent.PromptYesNo("Would you like to add one of your PGP keys to Keybase?", PromptDefaultYes)
}

func (g GPGUI) ConfirmDuplicateKeyChosen(_ context.Context, _ int) (bool, error) {
	if g.noPrompt {
		return false, nil
	}
	return g.parent.PromptYesNo("You've already selected this public key for use on Keybase. Would you like to update it on Keybase?", PromptDefaultYes)
}
