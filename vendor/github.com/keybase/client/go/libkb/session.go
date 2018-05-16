// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"fmt"
	"time"

	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

type SessionReader interface {
	APIArgs() (token, csrf string)
	IsLoggedIn() bool
	Invalidate()
}

type Session struct {
	Contextified
	token    string
	csrf     string
	inFile   bool
	loaded   bool
	deviceID keybase1.DeviceID
	valid    bool
	uid      keybase1.UID
	username *NormalizedUsername
	mtime    time.Time
	checked  bool
}

func newSession(g *GlobalContext) *Session {
	return &Session{Contextified: Contextified{g}}
}

// NewSessionThin creates a minimal (thin) session of just the uid and username.
// Clients of the daemon that use the session protocol need this.
func NewSessionThin(uid keybase1.UID, username NormalizedUsername, token string) *Session {
	// XXX should this set valid to true?  daemon won't return a
	// session unless valid is true, so...
	return &Session{uid: uid, username: &username, token: token, valid: true}
}

func (s *Session) IsLoggedIn() bool {
	return s.valid
}

// true if user is logged in and has a device fully provisioned
func (s *Session) IsLoggedInAndProvisioned() bool {
	if !s.valid {
		s.G().Log.Debug("session s.valid is false")
		return false
	}
	if len(s.deviceID) == 0 {
		s.G().Log.Debug("no device id in session")
		return false
	}
	envid := s.G().Env.GetDeviceID()
	if envid.IsNil() {
		s.G().Log.Debug("no device id in env")
		return false
	}
	if s.deviceID != envid {
		s.G().Log.Warning("device id mismatch session <-> env")
		return false
	}

	return true
}

func (s *Session) Clone() *Session {
	if s == nil {
		return nil
	}
	ret := *s
	if ret.username != nil {
		un := *ret.username
		ret.username = &un
	}
	return &ret
}

func (s *Session) GetUsername() *NormalizedUsername {
	return s.username
}

func (s *Session) GetUID() keybase1.UID {
	return s.uid
}

func (s *Session) GetDeviceID() keybase1.DeviceID {
	return s.deviceID
}

func (s *Session) GetToken() string {
	return s.token
}

func (s *Session) GetCsrf() string {
	return s.csrf
}

func (s *Session) APIArgs() (token, csrf string) {
	return s.token, s.csrf
}

func (s *Session) SetUsername(username NormalizedUsername) {
	s.username = &username
}

func (s *Session) SetLoggedIn(sessionID, csrfToken string, username NormalizedUsername, uid keybase1.UID, deviceID keybase1.DeviceID) error {
	s.valid = true
	s.uid = uid
	s.username = &username
	s.token = sessionID
	s.csrf = csrfToken
	s.deviceID = deviceID
	s.mtime = time.Now()
	return nil
}

func (s *Session) SetDeviceProvisioned(devid keybase1.DeviceID) error {
	s.G().Log.Debug("Local Session: setting provisioned device id: %s", devid)
	s.deviceID = devid
	return nil
}

func (s *Session) isConfigLoggedIn() bool {
	reader := s.G().Env.GetConfig()
	return reader.GetUsername() != "" && reader.GetDeviceID().Exists() && reader.GetUID().Exists()
}

func (s *Session) IsRecent() bool {
	if s.mtime.IsZero() {
		return false
	}
	return time.Since(s.mtime) < time.Hour
}

func (s *Session) check() error {
	s.G().Log.Debug("+ Checking session")
	if s.IsRecent() && s.checked {
		s.G().Log.Debug("- session is recent, short-circuiting")
		s.valid = true
		return nil
	}
	return s.checkWithServer()
}

func (s *Session) checkWithServer() error {
	arg := NewRetryAPIArg("sesscheck")
	arg.SessionR = s
	arg.SessionType = APISessionTypeOPTIONAL
	arg.AppStatusCodes = []int{SCOk, SCBadSession}

	res, err := s.G().API.Get(arg)

	if err != nil {
		return err
	}

	s.checked = true

	if res.AppStatus.Code == SCOk {
		s.G().Log.Debug("| Stored session checked out")
		var err error
		var uid keybase1.UID
		var username, csrf string
		GetUIDVoid(res.Body.AtKey("logged_in_uid"), &uid, &err)
		res.Body.AtKey("username").GetStringVoid(&username, &err)
		res.Body.AtKey("csrf_token").GetStringVoid(&csrf, &err)
		if err != nil {
			err = fmt.Errorf("Server replied with unrecognized response: %s", err)
			return err
		}
		s.valid = true
		s.uid = uid
		nu := NewNormalizedUsername(username)
		s.username = &nu
		s.csrf = csrf
		s.mtime = time.Now()
	} else {
		s.G().Log.Notice("Stored session expired")
		s.Invalidate()
	}

	s.G().Log.Debug("- Checked session")
	return nil
}

// Invalidate marks the session as invalid and posts a logout
// notification.
func (s *Session) Invalidate() {
	s.G().Log.Debug("+ invalidating session")
	s.valid = false
	s.mtime = time.Time{}
	s.token = ""
	s.csrf = ""
	s.checked = false

	// Note: this notification has been active for a long time, but
	// doesn't pertain anymore as losing a session is not the same
	// as being logged out, and we are refreshing expired session
	// tokens now. But just in case taking it out causes problems,
	// will leave mention of it here:
	//
	//     s.G().NotifyRouter.HandleLogout()
	//
	// It is now in libkb/globals.go at the end of the Logout() function.

	s.G().Log.Debug("- session invalidated")
}

func (s *Session) HasSessionToken() bool {
	return len(s.token) > 0
}

func (s *Session) IsValid() bool {
	return s.valid
}

func (s *Session) postLogout() error {

	_, err := s.G().API.Post(APIArg{
		SessionR:    s,
		Endpoint:    "logout",
		SessionType: APISessionTypeREQUIRED,
	})

	// Invalidate even if we hit an error.
	s.Invalidate()

	return err
}

func (s *Session) Logout() error {
	var err, e2 error
	if s.HasSessionToken() {
		e2 = s.postLogout()
	}
	if err == nil && e2 != nil {
		err = e2
	}
	return err
}

func (s *Session) loadAndCheck() (bool, error) {
	var err error
	if s.HasSessionToken() {
		err = s.check()
	}
	return s.IsValid(), err
}

func (s *Session) loadAndCheckProvisioned() (bool, error) {
	ok, err := s.loadAndCheck()
	if err != nil {
		return false, err
	}
	if !ok {
		return false, nil
	}
	return s.IsLoggedInAndProvisioned(), nil
}

func (s *Session) LoadAndCheckIfStale() (bool, error) {
	return s.loadAndCheck()
}

func (s *Session) LoadAndForceCheck() (bool, error) {
	var err error
	if s.HasSessionToken() {
		err = s.checkWithServer()
	}
	return s.IsValid(), err
}
