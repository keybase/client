package service

import (
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
	"github.com/keybase/gregor"
)

type RekeyUIHandler struct {
	libkb.Contextified
	connID      libkb.ConnectionID
	alwaysAlive bool
}

var _ libkb.GregorInBandMessageHandler = (*RekeyUIHandler)(nil)

func NewRekeyUIHandler(g *libkb.GlobalContext, connID libkb.ConnectionID) *RekeyUIHandler {
	return &RekeyUIHandler{
		Contextified: libkb.NewContextified(g),
		connID:       connID,
	}
}

func (r *RekeyUIHandler) Create(ctx context.Context, category string, item gregor.Item) error {
	switch category {
	case "kbfs_tlf_rekey_needed":
		return r.rekeyNeeded(ctx, item)
	default:
		return fmt.Errorf("unknown RekeyUIHandler category: %q", category)
	}
}

func (r *RekeyUIHandler) Dismiss(ctx context.Context, category string, item gregor.Item) error {
	return nil
}

func (r *RekeyUIHandler) IsAlive() bool {
	return true
}

func (r *RekeyUIHandler) Name() string {
	return "RekeyUIHandler"
}

func (r *RekeyUIHandler) rekeyNeeded(ctx context.Context, item gregor.Item) error {
	if item.Body() == nil {
		return errors.New("gregor handler for kbfs_tlf_rekey_needed: nil message body")
	}

	var scores []keybase1.RekeyTLF
	if err := json.Unmarshal(item.Body().Bytes(), &scores); err != nil {
		return err
	}

	if r.G().Clock.Now().Sub(item.Metadata().CTime()) > 10*time.Second {
		// if the message isn't fresh, get:
		var err error
		scores, err = r.scoreProblemFolders(scores)
		if err != nil {
			return err
		}
	}

	// if the scores list is empty, dismiss the gregor notification
	if len(scores) == 0 {
		r.G().Log.Debug("scores list empty, dismissing gregor notification")
		return r.G().GregorDismisser.DismissItem(item.Metadata().MsgID())
	}

	// get the rekeyUI
	rekeyUI, err := r.G().UIRouter.GetRekeyUI()
	if err != nil {
		r.G().Log.Errorf("failed to get RekeyUI: %s", err)
		return err
	}
	if rekeyUI == nil {
		r.G().Log.Error("got nil RekeyUI")
		return errors.New("got nil RekeyUI")
	}

	// show the rekey scores in a loop
	for {
		arg := keybase1.RefreshArg{
			Tlfs: scores,
		}
		if err := rekeyUI.Refresh(ctx, arg); err != nil {
			return err
		}

		r.G().Clock.Sleep(1 * time.Second)

		scores, err = r.scoreProblemFolders(scores)
		if err != nil {
			return err
		}

		// if the scores list is empty, dismiss the gregor notification
		if len(scores) == 0 {
			// send ui an empty refresh to signal completion?
			r.G().Log.Debug("scores list empty, sending UI an empty refresh")
			if err := rekeyUI.Refresh(ctx, keybase1.RefreshArg{}); err != nil {
				return err
			}

			r.G().Log.Debug("scores list empty, dismissing gregor notification")
			return r.G().GregorDismisser.DismissItem(item.Metadata().MsgID())
		}
	}
}

func (r *RekeyUIHandler) scoreProblemFolders(existing []keybase1.RekeyTLF) ([]keybase1.RekeyTLF, error) {
	// XXX this is waiting on an API endpoint
	r.G().Log.Debug("Fake scoreProblemFolders, returning empty folder list")
	return []keybase1.RekeyTLF{}, nil
}
