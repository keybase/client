// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"time"

	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

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

// Invalidate marks the session as invalid and posts a logout
// notification.
func (s *Session) Invalidate() {
	s.G().Log.Debug("invalidating session")
	s.valid = false
	s.mtime = time.Time{}
	s.token = ""
	s.csrf = ""
	s.checked = false
}

func (s *Session) HasSessionToken() bool {
	return len(s.token) > 0
}

func (s *Session) IsValid() bool {
	return s.valid
}

type SessionTokener struct {
	session, csrf string
}

func (s *SessionTokener) Tokens() (session, csrf string) {
	return s.session, s.csrf
}

func NewSessionTokener(mctx MetaContext) (*SessionTokener, error) {
	resp, err := mctx.G().API.Post(mctx, APIArg{
		Endpoint:    "new_session",
		SessionType: APISessionTypeREQUIRED,
	})
	if err != nil {
		return nil, err
	}

	session, err := resp.Body.AtKey("session").GetString()
	if err != nil {
		return nil, err
	}
	csrf, err := resp.Body.AtKey("csrf_token").GetString()
	if err != nil {
		return nil, err
	}

	return &SessionTokener{
		session: session,
		csrf:    csrf,
	}, nil
}
