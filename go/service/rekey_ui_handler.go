package service

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"
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
	notifyStart    chan int // for testing purposes
	notifyComplete chan int // for testing purposes
	scorer         func(g *libkb.GlobalContext, existing keybase1.ProblemSet) (keybase1.ProblemSet, error)
}

var _ libkb.GregorInBandMessageHandler = (*RekeyUIHandler)(nil)

func NewRekeyUIHandler(g *libkb.GlobalContext, connID libkb.ConnectionID) *RekeyUIHandler {
	return &RekeyUIHandler{
		Contextified: libkb.NewContextified(g),
		connID:       connID,
		updaters:     make(map[int]*rekeyStatusUpdater),
		scorer:       scoreProblemFolders,
	}
}

func (r *RekeyUIHandler) Create(ctx context.Context, category string, item gregor.Item) (bool, error) {
	switch category {
	case "kbfs_tlf_rekey_needed":
		return true, r.rekeyNeeded(ctx, item)
	default:
		return false, fmt.Errorf("unknown RekeyUIHandler category: %q", category)
	}
}

func (r *RekeyUIHandler) Dismiss(ctx context.Context, category string, item gregor.Item) (bool, error) {
	return false, nil
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

	var problemSet keybase1.ProblemSet
	if err := json.Unmarshal(item.Body().Bytes(), &problemSet); err != nil {
		r.G().Log.Debug("error: %s", err)
		return err
	}

	if r.G().Clock().Now().Sub(item.Metadata().CTime()) > 10*time.Second {
		// if the message isn't fresh, get:
		var err error
		problemSet, err = r.scorer(r.G(), problemSet)
		if err != nil {
			return err
		}
	}

	// if the tlf list is empty, dismiss the gregor notification
	if len(problemSet.Tlfs) == 0 {
		r.G().Log.Debug("problem set tlf list empty, dismissing gregor notification")
		return r.G().GregorDismisser.DismissItem(item.Metadata().MsgID())
	}

	// get the rekeyUI
	rekeyUI, sessionID, err := r.G().UIRouter.GetRekeyUI()
	if err != nil {
		r.G().Log.Errorf("failed to get RekeyUI: %s", err)
		return err
	}
	if rekeyUI == nil {
		r.G().Log.Error("There was no RekeyUI registered, but a rekey is necessary. Here is the ProblemSet:")
		r.G().Log.Errorf("Rekey ProblemSet: %+v", problemSet)
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
		rekeyUI:    rekeyUI,
		problemSet: problemSet,
		msgID:      item.Metadata().MsgID(),
		sessionID:  sessionID,
		scorer:     r.scorer,
	}
	up := newRekeyStatusUpdater(r.G(), args)
	go func() {
		r.updatersMu.Lock()
		r.updaters[sessionID] = up
		r.updatersMu.Unlock()
		select {
		case r.notifyStart <- sessionID:
		default:
		}
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

type scoreResult struct {
	Status     libkb.AppStatus     `json:"status"`
	ProblemSet keybase1.ProblemSet `json:"problem_set"`
}

func (s *scoreResult) GetAppStatus() *libkb.AppStatus {
	return &s.Status
}

func scoreProblemFolders(g *libkb.GlobalContext, existing keybase1.ProblemSet) (keybase1.ProblemSet, error) {
	tlfIDs := make([]string, len(existing.Tlfs))
	for i, v := range existing.Tlfs {
		tlfIDs[i] = v.Tlf.Tlfid.String()
	}
	args := libkb.HTTPArgs{
		"tlfs":    libkb.S{Val: strings.Join(tlfIDs, ",")},
		"new_kid": libkb.S{Val: existing.Kid.String()},
		"helpee":  libkb.S{Val: existing.User.Uid.String()},
	}
	var updated scoreResult
	err := g.API.GetDecode(libkb.APIArg{
		Contextified: libkb.NewContextified(g),
		Endpoint:     "kbfs/problem_sets",
		NeedSession:  true,
		Args:         args,
	}, &updated)
	return updated.ProblemSet, err
}

func (r *RekeyUIHandler) RekeyStatusFinish(ctx context.Context, sessionID int) (keybase1.Outcome, error) {
	r.updatersMu.Lock()
	defer r.updatersMu.Unlock()
	up, ok := r.updaters[sessionID]
	if ok && up != nil {
		r.G().Log.Debug("RekeyStatusFinish called for sessionID %d, telling updater to finish", sessionID)
		up.Finish()
		return keybase1.Outcome_IGNORED, nil
	}

	r.G().Log.Debug("RekeyStatusFinish called for sessionID %d but no updater found", sessionID)
	return keybase1.Outcome_NONE, nil
}

type rekeyStatusUpdaterArgs struct {
	rekeyUI    keybase1.RekeyUIInterface
	problemSet keybase1.ProblemSet
	msgID      gregor.MsgID
	sessionID  int
	scorer     func(g *libkb.GlobalContext, existing keybase1.ProblemSet) (keybase1.ProblemSet, error)
}

type rekeyStatusUpdater struct {
	rekeyUI    keybase1.RekeyUIInterface
	problemSet keybase1.ProblemSet
	msgID      gregor.MsgID
	scorer     func(g *libkb.GlobalContext, existing keybase1.ProblemSet) (keybase1.ProblemSet, error)
	sessionID  int
	me         *libkb.User
	done       chan struct{}
	libkb.Contextified
}

func newRekeyStatusUpdater(g *libkb.GlobalContext, args rekeyStatusUpdaterArgs) *rekeyStatusUpdater {
	u := &rekeyStatusUpdater{
		rekeyUI:      args.rekeyUI,
		problemSet:   args.problemSet,
		msgID:        args.msgID,
		scorer:       args.scorer,
		sessionID:    args.sessionID,
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
			set, err := u.problemSetDevices()
			if err != nil {
				u.G().Log.Errorf("rekey ui lookup devices error: %s", err)
				return
			}
			arg := keybase1.RefreshArg{
				SessionID:         u.sessionID,
				ProblemSetDevices: set,
			}
			if err = u.rekeyUI.Refresh(context.TODO(), arg); err != nil {
				u.G().Log.Errorf("rekey ui Refresh error: %s", err)
				return
			}
		}

		// if the scores list is empty, dismiss the gregor notification
		if len(u.problemSet.Tlfs) == 0 {
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
		case <-u.G().Clock().After(1 * time.Second):
		}

		u.problemSet, err = u.scorer(u.G(), u.problemSet)
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

func (u *rekeyStatusUpdater) problemSetDevices() (keybase1.ProblemSetDevices, error) {
	var set keybase1.ProblemSetDevices
	set.ProblemSet = u.problemSet
	if len(set.ProblemSet.Tlfs) == 0 {
		return set, nil
	}

	if u.me == nil {
		me, err := libkb.LoadMe(libkb.NewLoadUserArg(u.G()))
		if err != nil {
			return keybase1.ProblemSetDevices{}, err
		}
		u.me = me
	}
	ckf := u.me.GetComputedKeyFamily()

	dset := make(map[keybase1.DeviceID]bool)
	for _, f := range u.problemSet.Tlfs {
		for _, kid := range f.Solutions {
			dev, err := ckf.GetDeviceForKID(kid)
			if err != nil {
				return keybase1.ProblemSetDevices{}, err
			}
			if dset[dev.ID] {
				continue
			}
			dset[dev.ID] = true
			set.Devices = append(set.Devices, *(dev.ProtExport()))
		}
	}
	return set, nil
}
