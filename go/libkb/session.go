package libkb

import (
	"fmt"
	"os"
	"sync"
	"time"

	jsonw "github.com/keybase/go-jsonw"
)

type Session struct {
	Contextified
	file     *JsonFile
	token    string
	csrf     string
	inFile   bool
	loaded   bool
	checked  bool
	valid    bool
	uid      *UID
	username *string
	mtime    int64
	sync.RWMutex
}

func newSession(g *GlobalContext) *Session {
	return &Session{Contextified: Contextified{g}}
}

// NewSessionThin creates a minimal (thin) session of just the uid and username.
// Clients of the daemon that use the session protocol need this.
func NewSessionThin(uid UID, username string, token string) *Session {
	// XXX should this set valid to true?  daemon won't return a
	// session unless valid is true, so...
	return &Session{uid: &uid, username: &username, token: token, valid: true}
}

func (s *Session) IsLoggedIn() bool {
	s.RLock()
	defer s.RUnlock()
	return s.valid
}

func (s *Session) GetUsername() *string {
	s.RLock()
	defer s.RUnlock()
	return s.username
}

func (s *Session) GetUID() *UID {
	s.RLock()
	defer s.RUnlock()
	return s.uid
}

func (s *Session) GetToken() string {
	s.RLock()
	defer s.RUnlock()
	return s.token
}

func (s *Session) GetCsrf() string {
	s.RLock()
	defer s.RUnlock()
	return s.csrf
}

func (s *Session) SetLoggedIn(sessionID, csrfToken, username string, uid UID) {
	s.Lock()
	s.valid = true
	s.uid = &uid
	s.username = &username
	s.token = sessionID
	s.GetDictionary().SetKey("session", jsonw.NewString(sessionID))
	s.Unlock()

	s.SetCsrf(csrfToken)
	s.SetDirty()
}

func (s *Session) SetDirty() {
	s.Lock()
	defer s.Unlock()
	s.file.dirty = true
	s.GetDictionary().SetKey("mtime", jsonw.NewInt64(time.Now().Unix()))
}

func (s *Session) SetCsrf(t string) {
	s.Lock()
	s.csrf = t
	if s.file == nil {
		s.Unlock()
		return
	}
	s.GetDictionary().SetKey("csrf", jsonw.NewString(t))
	s.Unlock()
	s.SetDirty()
}

func (s *Session) isConfigLoggedIn() bool {
	reader := s.G().Env.GetConfig()
	return reader.GetUsername() != "" && reader.GetDeviceID() != nil && reader.GetUID() != nil
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
	s.RLock()
	s.G().Log.Debug("+ Loading session")
	if s.loaded {
		s.G().Log.Debug("- Skipped; already loaded")
		s.RUnlock()
		return nil
	}
	s.RUnlock()

	s.Lock()
	defer s.Unlock()

	err := s.nukeSessionFileIfOutOfSync()
	if err != nil {
		return err
	}

	s.file = NewJsonFile(s.G().Env.GetSessionFilename(), "session")
	err = s.file.Load(false)
	s.loaded = true

	if err != nil {
		s.G().Log.Error("Failed to load session file")
		return err
	}

	if s.file.Exists() {
		var tmp error
		var token, csrf string
		ok := true
		s.file.jw.AtKey("session").GetStringVoid(&token, &tmp)
		if tmp != nil {
			s.G().Log.Warning("Bad 'session' value in session file %s: %s",
				s.file.filename, tmp.Error())
			ok = false
		}
		s.file.jw.AtKey("csrf").GetStringVoid(&csrf, &tmp)
		if tmp != nil {
			s.G().Log.Warning("Bad 'csrf' value in session file %s: %s",
				s.file.filename, tmp.Error())
			ok = false
		}
		mtime, _ := s.file.jw.AtKey("mtime").GetInt64()
		if ok {
			s.token = token
			s.csrf = csrf
			s.inFile = true
			s.mtime = mtime
		}
	}
	s.G().Log.Debug("- Loaded session")
	return nil
}

func (s *Session) GetDictionary() *jsonw.Wrapper {
	return s.file.jw
}

func (s *Session) Write() error {
	s.Lock()
	defer s.Unlock()
	return s.file.MaybeSave(true, 0)
}

func (s *Session) IsRecent() bool {
	s.RLock()
	defer s.RUnlock()
	if s.mtime == 0 {
		return false
	}
	t := time.Unix(s.mtime, 0)
	return time.Since(t) < time.Hour
}

func (s *Session) Check() error {
	s.RLock()
	s.G().Log.Debug("+ Checking session")
	if s.checked {
		s.G().Log.Debug("- already checked, short-circuting")
		s.RUnlock()
		return nil
	}
	s.RUnlock()

	res, err := s.G().API.Get(ApiArg{
		Endpoint:    "sesscheck",
		NeedSession: true,
		AppStatus:   []string{"OK", "BAD_SESSION"},
	})

	if err != nil {
		return err
	}

	s.Lock()
	s.checked = true
	s.Unlock()

	if res.AppStatus == "OK" {
		s.G().Log.Debug("| Stored session checked out")
		var err error
		var uid UID
		var username, csrf string
		GetUidVoid(res.Body.AtKey("logged_in_uid"), &uid, &err)
		res.Body.AtKey("username").GetStringVoid(&username, &err)
		res.Body.AtKey("csrf_token").GetStringVoid(&csrf, &err)
		if err != nil {
			err = fmt.Errorf("Server replied with unrecognized response: %s", err.Error())
			return err
		} else {
			s.Lock()
			s.valid = true
			s.uid = &uid
			s.username = &username
			s.Unlock()
			if !s.IsRecent() {
				s.SetCsrf(csrf)
			}
		}
	} else {
		s.G().Log.Notice("Stored session expired")
		s.Lock()
		s.valid = false
		s.Unlock()
	}

	s.G().Log.Debug("- Checked session")
	return nil
}

func (s *Session) HasSessionToken() bool {
	s.RLock()
	defer s.RUnlock()
	return len(s.token) > 0
}

func (s *Session) IsValid() bool {
	s.RLock()
	defer s.RUnlock()
	return s.valid
}

func (s *Session) postLogout() error {
	_, err := s.G().API.Post(ApiArg{
		Endpoint:    "logout",
		NeedSession: true,
	})
	if err == nil {
		s.Lock()
		s.valid = false
		s.checked = false
		s.token = ""
		s.csrf = ""
		s.Unlock()
	}
	return err
}

func (s *Session) Logout() error {
	err := s.Load()
	var e2 error
	if err == nil && s.HasSessionToken() {
		e2 = s.postLogout()
		s.Lock()
		if e3 := s.file.Nuke(); e3 != nil {
			s.inFile = false
			s.G().Log.Warning("Failed to remove session file: %s", e3.Error())
		}
		s.Unlock()
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
		err = s.Check()
	}
	return s.IsValid(), err
}
