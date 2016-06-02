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

const rekeyHandlerName = "RekeyUIHandler"

type RekeyUIHandler struct {
	libkb.Contextified
	connID         libkb.ConnectionID
	alwaysAlive    bool
	updaters       map[int]*rekeyStatusUpdater
	notifyComplete chan int // for testing purposes
}

var _ libkb.GregorInBandMessageHandler = (*RekeyUIHandler)(nil)

func NewRekeyUIHandler(g *libkb.GlobalContext, connID libkb.ConnectionID) *RekeyUIHandler {
	return &RekeyUIHandler{
		Contextified: libkb.NewContextified(g),
		connID:       connID,
		updaters:     make(map[int]*rekeyStatusUpdater),
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
	return rekeyHandlerName
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
		scores, err = scoreProblemFolders(r.G(), scores)
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
	rekeyUI, sessionID, err := r.G().UIRouter.GetRekeyUI()
	if err != nil {
		r.G().Log.Errorf("failed to get RekeyUI: %s", err)
		return err
	}
	if rekeyUI == nil {
		r.G().Log.Error("got nil RekeyUI")
		return errors.New("got nil RekeyUI")
	}

	// make a map of sessionID -> loops
	if _, ok := r.updaters[sessionID]; ok {
		return fmt.Errorf("rekey status updater already exists for session id %d", sessionID)
	}
	args := rekeyStatusUpdaterArgs{
		rekeyUI:   rekeyUI,
		scores:    scores,
		msgID:     item.Metadata().MsgID(),
		sessionID: sessionID,
	}
	up := newRekeyStatusUpdater(r.G(), args)
	go func() {
		r.updaters[sessionID] = up
		up.Start()
		delete(r.updaters, sessionID)
		select {
		case r.notifyComplete <- sessionID:
		default:
		}
	}()

	// show the rekey scores in a loop
	/*
		for {
			arg := keybase1.RefreshArg{
				Tlfs: scores,
			}
			if err := rekeyUI.Refresh(ctx, arg); err != nil {
				return err
			}

			r.G().Clock.Sleep(1 * time.Second)

			scores, err = scoreProblemFolders(r.G(), scores)
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
	*/
	return nil
}

func scoreProblemFolders(g *libkb.GlobalContext, existing []keybase1.RekeyTLF) ([]keybase1.RekeyTLF, error) {
	// XXX this is waiting on an API endpoint
	g.Log.Debug("Fake scoreProblemFolders, returning empty folder list")
	return []keybase1.RekeyTLF{}, nil
}

func (r *RekeyUIHandler) RekeyStatusFinish(ctx context.Context, sessionID int) (keybase1.Outcome, error) {
	return keybase1.Outcome_NONE, errors.New("not implemented")
}

type rekeyStatusUpdaterArgs struct {
	rekeyUI   keybase1.RekeyUIInterface
	scores    []keybase1.RekeyTLF
	msgID     gregor.MsgID
	sessionID int
}

type rekeyStatusUpdater struct {
	rekeyUI keybase1.RekeyUIInterface
	scores  []keybase1.RekeyTLF
	msgID   gregor.MsgID
	done    chan struct{}
	libkb.Contextified
}

func newRekeyStatusUpdater(g *libkb.GlobalContext, args rekeyStatusUpdaterArgs) *rekeyStatusUpdater {
	u := &rekeyStatusUpdater{
		rekeyUI:      args.rekeyUI,
		scores:       args.scores,
		msgID:        args.msgID,
		done:         make(chan struct{}),
		Contextified: libkb.NewContextified(g),
	}

	return u
}

func (u *rekeyStatusUpdater) Start() {
	u.update()
}

func (u *rekeyStatusUpdater) update() {
	var err error
	for {
		arg := keybase1.RefreshArg{
			Tlfs: u.scores,
		}
		if err = u.rekeyUI.Refresh(context.TODO(), arg); err != nil {
			u.G().Log.Errorf("rekey ui Refresh error: %s", err)
			return
		}

		// if the scores list is empty, dismiss the gregor notification
		if len(u.scores) == 0 {
			u.G().Log.Debug("scores list empty, dismissing gregor notification")
			if err := u.G().GregorDismisser.DismissItem(u.msgID); err != nil {
				u.G().Log.Errorf("dismiss item error: %s", err)
			}
			return
		}

		select {
		case <-u.done:
			u.G().Log.Debug("rekeyStatusUpdater done chan closed, terminating update loop")
			return
		case <-u.G().Clock.After(1 * time.Second):
		}

		u.scores, err = scoreProblemFolders(u.G(), u.scores)
		if err != nil {
			u.G().Log.Errorf("scoreProblemFolders error: %s", err)
			return
		}
	}
}

func (u *rekeyStatusUpdater) Finish() {
	close(u.done)
}
