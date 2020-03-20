package service

import (
	"fmt"
	"regexp"
	"time"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/teams"
)

type StringReceiver interface {
	CallbackWithString(s string)
}

type InstallReferrerListener interface {
	// StartInstallReferrerListener is used to get referrer information from the
	// google play store on Android (to implement deferred deep links). This is
	// asynchronous (due to the underlying play store api being so): pass it a
	// callback function which will be called with the referrer string once it
	// is available (or an empty string in case of errors).
	StartInstallReferrerListener(callback StringReceiver)
}

type installReferrerHandler struct {
	libkb.MetaContextified
}

// CallbackWithString is called from Java when the Android Play Store api
// returns the requested install referrer information.
func (c installReferrerHandler) CallbackWithString(s string) {
	m := c.M().WithLogTag("IRL")
	m.Debug("installReferrerHandler#CallbackWithString")
	defer func() {
		err := c.G().Env.GetConfigWriter().SetAndroidInstallReferrerChecked(true)
		if err != nil {
			m.Warning("Error in SetAndroidInstallReferrerChecked: %v", err)
		}
	}()

	// TODO remove this log line before the feature is released: invite links
	// are sensitive and we do not want to log them.
	m.Warning("installReferrerHandler InstallReferrerListener got %v", s)

	// This could be expanded to all sorts of deferred deep links, not just
	// invite links.
	inviteKey, found, err := parseInstallReferrer(s)
	if err != nil {
		m.Warning("Error in parseInstallReferrer: %v", err)
		return
	}
	if !found {
		m.Debug("installReferrerHandler#CallbackWithString: invite not found")
		return
	}

	m.Debug("Waiting for the GUI to be ready to receive notifications")
	if !c.G().UIRouter.WaitForUIType(libkb.HomeUIKind, 30*time.Second) {
		c.M().Debug("Dropping notification of referrer information: GUI did not connect in time")
		return
	}
	m.Debug("Notifying GUI of deferred deep invite link")
	c.G().NotifyRouter.HandleHandleKeybaseLink(c.M().Ctx(), "keybase://invite/"+string(inviteKey))
}

var _ StringReceiver = installReferrerHandler{}

var installReferrerLinkRegExp = regexp.MustCompile("invite\\%3D([" + teams.KBase30EncodeStd + "\\+]+)")

func parseInstallReferrer(s string) (key keybase1.SeitanIKeyInvitelink, found bool, err error) {
	matches := installReferrerLinkRegExp.FindStringSubmatch(s)
	switch len(matches) {
	case 0:
		// invite link key not found
		return "", false, nil
	case 2:
		return keybase1.SeitanIKeyInvitelink(matches[1]), true, nil
	default:
		return "", false, fmt.Errorf("Could not parse install referrer for seitan invite link: got %v matches", len(matches))
	}
}

func (d *Service) startInstallReferrerListener(m libkb.MetaContext) {
	m = m.WithLogTag("IRL")
	m.Debug("Service#startInstallReferrerListener called")

	if !libkb.IsAndroid() {
		m.Debug("InstallReferrerListener only runs on Android; short-circuiting startInstallReferrerListener")
		return
	}

	if d.referrerListener == nil {
		m.Debug("referrerListener is nil; short-circuiting startInstallReferrerListener")
		return
	}

	if m.G().Env.GetConfig().GetAndroidInstallReferrerChecked() {
		m.Debug("AndroidInstallReferrer already checked; short-circuiting startInstallReferrerListener")
		return
	}

	d.referrerListener.StartInstallReferrerListener(installReferrerHandler{MetaContextified: libkb.NewMetaContextified(m)})
}

func (d *Service) SetInstallReferrerListener(i InstallReferrerListener) {
	d.G().Log.Debug("InstallReferrerListener set")
	d.referrerListener = i
}
