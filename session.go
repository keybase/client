package libkb

import (
	"fmt"
	"github.com/keybase/go-jsonw"
	"time"
)

type Session struct {
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
}

func NewSession() *Session {
	return &Session{}
}

func (s Session) IsLoggedIn() bool {
	return s.valid
}

func (s Session) GetUsername() *string {
	return s.username
}

func (s Session) GetUid() *UID {
	return s.uid
}

func (s *Session) SetLoggedIn(lir LoggedInResult) {
	s.valid = true
	s.uid = &lir.Uid
	s.username = &lir.Username
	s.token = lir.SessionId
	s.GetDictionary().SetKey("session", jsonw.NewString(lir.SessionId))
	s.SetCsrf(lir.CsrfToken)
	s.SetDirty()
}

func (s *Session) SetDirty() {
	s.file.dirty = true
	s.GetDictionary().SetKey("mtime", jsonw.NewInt64(time.Now().Unix()))
}

func (s *Session) SetCsrf(t string) {
	s.csrf = t
	if s.file != nil {
		s.GetDictionary().SetKey("csrf", jsonw.NewString(t))
		s.SetDirty()
	}
}

func (s *Session) Load() error {
	G.Log.Debug("+ Loading session")
	if s.loaded {
		G.Log.Debug("- Skipped; already loaded")
		return nil
	}
	s.file = NewJsonFile(G.Env.GetSessionFilename(), "session")
	err := s.file.Load(false)
	s.loaded = true

	if err != nil {
		G.Log.Error("Failed to load session file")
		return err
	}

	if s.file.exists {
		var tmp error
		var token, csrf string
		ok := true
		s.file.jw.AtKey("session").GetStringVoid(&token, &tmp)
		if tmp != nil {
			G.Log.Warning("Bad 'session' value in session file %s: %s",
				s.file.filename, tmp.Error())
			ok = false
		}
		s.file.jw.AtKey("csrf").GetStringVoid(&csrf, &tmp)
		if tmp != nil {
			G.Log.Warning("Bad 'csrf' value in session file %s: %s",
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
	G.Log.Debug("- Loaded session")
	return nil
}

func (s *Session) GetDictionary() *jsonw.Wrapper {
	if s.file.jw == nil {
		s.file.jw = jsonw.NewDictionary()
	}
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
	now := time.Now()
	expires := t.Add(time.Hour)
	return now.Before(expires)
}

func (s *Session) Check() error {
	G.Log.Debug("+ Checking session")
	if s.checked {
		G.Log.Debug("- already checked, short-circuting")
		return nil
	}
	s.checked = true

	res, err := G.API.Get(ApiArg{
		Endpoint:    "sesscheck",
		NeedSession: true,
		AppStatus:   []string{"OK", "BAD_SESSION"},
	})

	if err != nil {
		return err
	}
	if res.AppStatus == "OK" {
		G.Log.Debug("| Stored session checked out")
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
			s.valid = true
			s.uid = &uid
			s.username = &username
			if !s.IsRecent() {
				s.SetCsrf(csrf)
			}
		}
	} else {
		G.Log.Notice("Stored session expired")
		s.valid = false
	}

	G.Log.Debug("- Checked session")
	return nil
}

func (s Session) HasSessionToken() bool {
	return len(s.token) > 0
}

func (s Session) IsValid() bool {
	return s.valid
}

func (s *Session) postLogout() error {
	_, err := G.API.Post(ApiArg{
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
			G.Log.Warning("Failed to remove session file: %s", e3.Error())
		}
	}
	if err == nil && e2 != nil {
		err = e2
	}
	return err
}

func (s *Session) LoadAndCheck() (bool, error) {
	err := s.Load()
	if err != nil {
		return false, err
	}
	if s.HasSessionToken() {
		err = s.Check()
	}
	return s.valid, err
}
