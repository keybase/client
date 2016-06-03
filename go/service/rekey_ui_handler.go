package service

import (
	"encoding/json"
	"errors"
	"fmt"
	"sync"
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
	updatersMu     sync.RWMutex
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
	r.updatersMu.RLock()
	if _, ok := r.updaters[sessionID]; ok {
		r.updatersMu.RUnlock()
		return fmt.Errorf("rekey status updater already exists for session id %d", sessionID)
	}
	r.updatersMu.RUnlock()
	args := rekeyStatusUpdaterArgs{
		rekeyUI:   rekeyUI,
		scores:    scores,
		msgID:     item.Metadata().MsgID(),
		sessionID: sessionID,
	}
	up := newRekeyStatusUpdater(r.G(), args)
	go func() {
		r.updatersMu.Lock()
		r.updaters[sessionID] = up
		r.updatersMu.Unlock()
		up.Start()
		r.G().Log.Debug("updater for %d complete", sessionID)
		r.updatersMu.Lock()
		delete(r.updaters, sessionID)
		r.updatersMu.Unlock()
		select {
		case r.notifyComplete <- sessionID:
		default:
		}
	}()

	return nil
}

func scoreProblemFolders(g *libkb.GlobalContext, existing []keybase1.RekeyTLF) ([]keybase1.RekeyTLF, error) {
	// XXX this is waiting on an API endpoint
	g.Log.Debug("Fake scoreProblemFolders, returning empty folder list")
	return []keybase1.RekeyTLF{}, nil
}

func (r *RekeyUIHandler) RekeyStatusFinish(ctx context.Context, sessionID int) (keybase1.Outcome, error) {
	r.updatersMu.Lock()
	defer r.updatersMu.Unlock()
	up, ok := r.updaters[sessionID]
	if ok && up != nil {
		up.Finish()
		return keybase1.Outcome_IGNORED, nil
	}

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
		// make sure not done before calling refresh:
		select {
		case <-u.done:
			u.G().Log.Debug("rekeyStatusUpdater done chan closed, terminating update loop")
			return
		default:
			arg := keybase1.RefreshArg{
				Tlfs: u.scores,
			}
			if err = u.rekeyUI.Refresh(context.TODO(), arg); err != nil {
				u.G().Log.Errorf("rekey ui Refresh error: %s", err)
				return
			}
		}

		// if the scores list is empty, dismiss the gregor notification
		if len(u.scores) == 0 {
			u.G().Log.Debug("scores list empty, dismissing gregor notification")
			if err := u.G().GregorDismisser.DismissItem(u.msgID); err != nil {
				u.G().Log.Errorf("dismiss item error: %s", err)
			}
			return
		}

		// allow done to interrupt sleep:
		select {
		case <-u.done:
			u.G().Log.Debug("rekeyStatusUpdater done chan closed, terminating update loop")
			return
		case <-u.G().Clock.After(1 * time.Second):
			u.G().Log.Debug("slept for 1s")
		}

		u.scores, err = scoreProblemFolders(u.G(), u.scores)
		if err != nil {
			u.G().Log.Errorf("scoreProblemFolders error: %s", err)
			return
		}
	}
}

func (u *rekeyStatusUpdater) Finish() {
	u.G().Log.Debug("closing rekey status updater done ch")
	close(u.done)
}
