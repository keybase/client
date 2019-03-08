package teams

import (
	"fmt"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	insecurerand "math/rand"
	"time"
)

func getUnpinnedTLF(m libkb.MetaContext) (res *unpinnedTLF, err error) {

	arg := libkb.NewAPIArg("kbfs/unpinned")
	arg.SessionType = libkb.APISessionTypeREQUIRED
	arg.Args = libkb.HTTPArgs{
		"n": libkb.I{Val: 1},
	}
	var r unpinnedTLFsRaw
	err = m.G().API.GetDecode(m, arg, &r)
	if err != nil {
		return nil, err
	}
	if len(r.TLFs) == 0 {
		return nil, nil
	}
	return &r.TLFs[0], nil
}

func (b *backgroundTLFPinner) pinTLF(m libkb.MetaContext, tlf unpinnedTLF) (err error) {
	defer m.Trace(fmt.Sprintf("pinTLF(%+v)", tlf), func() error { return err })()
	team, err := GetForTeamManagementByTeamID(m.Ctx(), m.G(), tlf.TeamID, false)
	if err != nil {
		return err
	}
	ids := team.KBFSTLFIDs()
	if len(ids) > 0 {
		m.Debug("Team %+v already has a TLF IDs in chain (%+v); ignoring", tlf.TeamID, ids)
		return nil
	}
	role, err := team.myRole(m.Ctx())
	if err != nil {
		return err
	}
	if !role.IsWriterOrAbove() {
		return fmt.Errorf("permission denied: need writer access (or above)")
	}
	return team.AssociateWithTLFID(m.Ctx(), tlf.TlfID)
}

type unpinnedTLF struct {
	Name   string          `json:"fq_name"`
	TeamID keybase1.TeamID `json:"team_id"`
	TlfID  keybase1.TLFID  `json:"tlf_id"`
}

type unpinnedTLFsRaw struct {
	Status libkb.AppStatus `json:"status"`
	TLFs   []unpinnedTLF   `json:"tlfs"`
}

func (r *unpinnedTLFsRaw) GetAppStatus() *libkb.AppStatus {
	return &r.Status
}

func (b *backgroundTLFPinner) pinOneTLF(m libkb.MetaContext) (done bool, err error) {
	m = m.WithLogTag("PIN")
	defer m.Trace("pinOneTLF", func() error { return err })()

	tlf, err := b.getUnpinnedTLF(m)
	if err != nil {
		return false, err
	}

	if tlf == nil {
		m.Debug("work done, no TLFs need upgrade")
		return true, nil
	}
	err = b.pinTLF(m, *tlf)
	if err != nil {
		return false, err
	}
	return false, nil
}

type pinLoopTimer interface {
	StartupWait(m libkb.MetaContext) error
	LoopWait(m libkb.MetaContext, lastRes error) error
}

type defaultPinLoopTimer struct{}

var _ pinLoopTimer = defaultPinLoopTimer{}

func (p defaultPinLoopTimer) wait(m libkb.MetaContext, why string, rangeMinutes int64, minMinutes int64) error {
	dur := time.Duration(minMinutes)*time.Minute + time.Duration(insecurerand.Int63n(rangeMinutes*60))*time.Second
	m.Debug("BackgroundPinLoop: waiting %v before %s", dur, why)
	wakeAt := m.G().Clock().Now().Add(dur)
	return libkb.SleepUntilWithContext(m.Ctx(), m.G().Clock(), wakeAt)
}

func (p defaultPinLoopTimer) StartupWait(m libkb.MetaContext) error {
	// Wait up to 2 hours, but always wait 5 minutes first
	return p.wait(m, "starting", 60*2, 5)
}

func (p defaultPinLoopTimer) LoopWait(m libkb.MetaContext, lastRes error) error {
	// Wait at least 1 minute for the next, or 30 minutes if there was an error
	// of any sort. Jiggle the wait for up to 3 minutes.
	min := int64(1)
	if lastRes != nil {
		min = int64(30)
	}
	return p.wait(m, "next iteration", 3, min)
}

type backgroundTLFPinner struct {
	timer          pinLoopTimer
	getUnpinnedTLF func(m libkb.MetaContext) (res *unpinnedTLF, err error)
	exitCh         chan<- error
}

func newBackgroundTLFPinner() *backgroundTLFPinner {

	// We can override this members for the purposes of testing.
	return &backgroundTLFPinner{
		timer:          defaultPinLoopTimer{},
		getUnpinnedTLF: getUnpinnedTLF,
	}
}

func (b *backgroundTLFPinner) run(m libkb.MetaContext) (err error) {
	m = m.WithLogTag("PIN")

	uv := m.CurrentUserVersion()
	defer m.Trace(fmt.Sprintf("teams.BackgroundPinTLFLoop(%+v)", uv), func() error { return err })()

	// For the purposes of testing, get make a note of when we are done.
	defer func() {
		if b.exitCh != nil {
			b.exitCh <- err
		}
	}()

	err = b.timer.StartupWait(m)
	if err != nil {
		return err
	}

	for {
		uv2 := m.CurrentUserVersion()
		if !uv.Eq(uv2) {
			m.Debug("leaving loop since, we changed to new user version %+v (or logged out)", uv2)
			return libkb.NewLoginRequiredError(fmt.Sprintf("required a login for user %+v", uv))
		}
		done, tmp := b.pinOneTLF(m)
		if done {
			m.Debug("done with TLF BG pin operation")
			return nil
		}
		if tmp != nil {
			m.Warning("TLF Pin operation failed: %v", tmp)
		}
		err = b.timer.LoopWait(m, tmp)
		if err != nil {
			return err
		}
	}
}

func BackgroundPinTLFLoop(m libkb.MetaContext) {
	newBackgroundTLFPinner().run(m)
}
