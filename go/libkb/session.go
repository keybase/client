package libkb

import (
	"fmt"
	"os"
	"time"

	keybase1 "github.com/keybase/client/protocol/go"
	jsonw "github.com/keybase/go-jsonw"
)

type SessionReader interface {
	APIArgs() (token, csrf string)
}

type Session struct {
	Contextified
	file     *JSONFile
	token    string
	csrf     string
	inFile   bool
	loaded   bool
	checked  bool
	deviceID string
	valid    bool
	uid      keybase1.UID
	username *string
	mtime    int64
}

func newSession(g *GlobalContext) *Session {
	return &Session{Contextified: Contextified{g}}
}

// NewSessionThin creates a minimal (thin) session of just the uid and username.
// Clients of the daemon that use the session protocol need this.
func NewSessionThin(uid keybase1.UID, username string, token string) *Session {
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
		return false
	}
	if len(s.deviceID) == 0 {
		return false
	}
	envid := s.G().Env.GetDeviceID()
	if envid == nil {
		return false
	}
	if s.deviceID != envid.String() {
		return false
	}
	return true
}

func (s *Session) GetUsername() *string {
	return s.username
}

func (s *Session) GetUID() keybase1.UID {
	return s.uid
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

func (s *Session) SetUsername(username string) {
	s.username = &username
}

func (s *Session) SetLoggedIn(sessionID, csrfToken, username string, uid keybase1.UID) error {
	s.valid = true
	s.uid = uid
	s.username = &username
	s.token = sessionID
	if s.file == nil {
		G.Log.Warning("s.file == nil")
		if err := s.Load(); err != nil {
			return err
		}
	}
	if s.GetDictionary() == nil {
		G.Log.Warning("s.GetDict() == nil")
	}
	s.GetDictionary().SetKey("session", jsonw.NewString(sessionID))

	s.SetCsrf(csrfToken)
	s.SetDirty()

	return nil
}

func (s *Session) SetDirty() {
	s.file.dirty = true
	s.GetDictionary().SetKey("mtime", jsonw.NewInt64(time.Now().Unix()))
}

func (s *Session) SetCsrf(t string) {
	s.csrf = t
	if s.file == nil {
		return
	}
	s.GetDictionary().SetKey("csrf", jsonw.NewString(t))
	s.SetDirty()
}

func (s *Session) SetDeviceProvisioned(devid string) {
	s.G().Log.Debug("Local Session:  setting provisioned device id: %s", devid)
	s.deviceID = devid
	if s.file == nil {
		return
	}
	s.GetDictionary().SetKey("device_provisioned", jsonw.NewString(devid))
	s.SetDirty()
}

func (s *Session) isConfigLoggedIn() bool {
	reader := s.G().Env.GetConfig()
	return reader.GetUsername() != "" && reader.GetDeviceID() != nil && reader.GetUID().Exists()
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

	s.file = NewJSONFile(s.G().Env.GetSessionFilename(), "session")
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
				s.file.filename, tmp.Error())
			ok = false
		}
		s.file.jw.AtKey("csrf").GetStringVoid(&csrf, &tmp)
		if tmp != nil {
			s.G().Log.Warning("Bad 'csrf' value in session file %s: %s",
				s.file.filename, tmp.Error())
			ok = false
		}
		s.file.jw.AtKey("device_provisioned").GetStringVoid(&devid, &tmp)
		if tmp != nil {
			s.G().Log.Warning("Bad 'device_provisioned' value in session file %s: %s",
				s.file.filename, tmp.Error())
			ok = false
		}
		mtime, _ := s.file.jw.AtKey("mtime").GetInt64()
		if ok {
			s.token = token
			s.csrf = csrf
			s.inFile = true
			s.deviceID = devid
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
	return s.file.MaybeSave(true, 0)
}

func (s *Session) IsRecent() bool {
	if s.mtime == 0 {
		return false
	}
	t := time.Unix(s.mtime, 0)
	return time.Since(t) < time.Hour
}

func (s *Session) Check() error {
	s.G().Log.Debug("+ Checking session")
	if s.checked {
		s.G().Log.Debug("- already checked, short-circuting")
		return nil
	}

	res, err := s.G().API.Get(APIArg{
		SessionR:    s,
		Endpoint:    "sesscheck",
		NeedSession: true,
		AppStatus:   []string{"OK", "BAD_SESSION"},
	})

	if err != nil {
		return err
	}

	s.checked = true

	if res.AppStatus == "OK" {
		s.G().Log.Debug("| Stored session checked out")
		var err error
		var uid keybase1.UID
		var username, csrf string
		GetUIDVoid(res.Body.AtKey("logged_in_uid"), &uid, &err)
		res.Body.AtKey("username").GetStringVoid(&username, &err)
		res.Body.AtKey("csrf_token").GetStringVoid(&csrf, &err)
		if err != nil {
			err = fmt.Errorf("Server replied with unrecognized response: %s", err.Error())
			return err
		}
		s.valid = true
		s.uid = uid
		s.username = &username
		if !s.IsRecent() {
			s.SetCsrf(csrf)
		}
	} else {
		s.G().Log.Notice("Stored session expired")
		s.valid = false
	}

	s.G().Log.Debug("- Checked session")
	return nil
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
		NeedSession: true,
	})
	if err == nil {
		s.valid = false
		s.checked = false
		s.token = ""
		s.csrf = ""
	}
	return err
}

func (s *Session) Logout() error {
	err := s.Load()
	var e2 error
	if err == nil && s.HasSessionToken() {
		e2 = s.postLogout()
		if e3 := s.file.Nuke(); e3 != nil {
			s.inFile = false
			s.G().Log.Warning("Failed to remove session file: %s", e3.Error())
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
		err = s.Check()
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
