// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"errors"
	"fmt"
	"os"
	"time"

	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	jsonw "github.com/keybase/go-jsonw"
)

type SessionReader interface {
	APIArgs() (token, csrf string)
	IsLoggedIn() bool
	Invalidate()
}

type Session struct {
	Contextified
	file     *JSONFile
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
	if s.file == nil {
		if err := s.Load(); err != nil {
			return err
		}
	}
	if s.GetDictionary() == nil {
		G.Log.Warning("s.GetDict() == nil")
	}
	s.GetDictionary().SetKey("session", jsonw.NewString(sessionID))

	s.SetCsrf(csrfToken)

	s.deviceID = deviceID
	if s.file == nil {
		return errors.New("no session file")
	}
	s.GetDictionary().SetKey("device_provisioned", jsonw.NewString(deviceID.String()))

	return s.save()
}

func (s *Session) save() error {
	mtime := time.Now()
	s.GetDictionary().SetKey("mtime", jsonw.NewInt64(mtime.Unix()))
	if err := s.file.Save(); err != nil {
		return err
	}
	s.mtime = mtime
	return nil
}

func (s *Session) SetCsrf(t string) {
	s.csrf = t
	if s.file == nil {
		return
	}
	s.GetDictionary().SetKey("csrf", jsonw.NewString(t))
}

func (s *Session) SetDeviceProvisioned(devid keybase1.DeviceID) error {
	s.G().Log.Debug("Local Session:  setting provisioned device id: %s", devid)
	s.deviceID = devid
	if s.file == nil {
		return errors.New("no session file")
	}
	s.GetDictionary().SetKey("device_provisioned", jsonw.NewString(devid.String()))
	return s.save()
}

func (s *Session) isConfigLoggedIn() bool {
	reader := s.G().Env.GetConfig()
	return reader.GetUsername() != "" && reader.GetDeviceID().Exists() && reader.GetUID().Exists()
}

// The session file can be out of sync with the config file, particularly when
// switching between the node and go clients.
func (s *Session) nukeSessionFileIfOutOfSync() error {
	sessionFile := s.G().Env.GetSessionFilename()
	// Use stat to check existence.
	_, statErr := os.Lstat(sessionFile)
	if statErr == nil && !s.isConfigLoggedIn() {
		s.G().Log.Warning("Session file found but user is not logged in. Deleting session file.")
		return os.Remove(sessionFile)
	}
	return nil
}

func (s *Session) Load() error {
	s.G().Log.Debug("+ Loading session")
	if s.loaded {
		s.G().Log.Debug("- Skipped; already loaded")
		return nil
	}

	err := s.nukeSessionFileIfOutOfSync()
	if err != nil {
		return err
	}

	s.file = NewJSONFile(s.G(), s.G().Env.GetSessionFilename(), "session")
	err = s.file.Load(false)
	s.loaded = true

	if err != nil {
		s.G().Log.Error("Failed to load session file")
		return err
	}

	if s.file.Exists() {
		var tmp error
		var token, csrf, devid string
		ok := true
		s.file.jw.AtKey("session").GetStringVoid(&token, &tmp)
		if tmp != nil {
			s.G().Log.Warning("Bad 'session' value in session file %s: %s",
				s.file.filename, tmp)
			ok = false
		}
		s.file.jw.AtKey("csrf").GetStringVoid(&csrf, &tmp)
		if tmp != nil {
			s.G().Log.Warning("Bad 'csrf' value in session file %s: %s",
				s.file.filename, tmp)
			ok = false
		}
		var did keybase1.DeviceID
		s.file.jw.AtKey("device_provisioned").GetStringVoid(&devid, &tmp)
		if tmp != nil {
			s.G().Log.Debug("Bad 'device_provisioned' value in session file %s: %s", s.file.filename, tmp)
			ok = false
		} else {
			var err error
			did, err = keybase1.DeviceIDFromString(devid)
			if err != nil {
				s.G().Log.Debug("Bad 'device_provisioned' value in session file %s: %s (%s)", s.file.filename, err, devid)
				ok = false

			}
		}
		mtime, _ := s.file.jw.AtKey("mtime").GetInt64()
		if ok {
			s.token = token
			s.csrf = csrf
			s.inFile = true
			s.deviceID = did
			s.mtime = time.Unix(mtime, 0)
			s.valid = true
		}
	}
	s.G().Log.Debug("- Loaded session")
	return nil
}

func (s *Session) GetDictionary() *jsonw.Wrapper {
	return s.file.jw
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

	arg := NewRetryAPIArg("sesscheck")
	arg.SessionR = s
	arg.SessionType = APISessionTypeOPTIONAL
	arg.AppStatusCodes = []int{SCOk}

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
		s.SetCsrf(csrf)
		if err = s.save(); err != nil {
			return err
		}
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
	s.loaded = false

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
	err := s.Load()
	var e2 error
	if err == nil && s.HasSessionToken() {
		e2 = s.postLogout()
		if e3 := s.file.Nuke(); e3 != nil {
			s.inFile = false
			s.G().Log.Warning("Failed to remove session file: %s", e3)
		}
	}
	if err == nil && e2 != nil {
		err = e2
	}
	return err
}

func (s *Session) loadAndCheck() (bool, error) {
	err := s.Load()
	if err != nil {
		return false, err
	}
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
