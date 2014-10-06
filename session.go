package libkb

type Session struct {
	file    *JsonFile
	token   string
	csrf    string
	inFile  bool
	loaded  bool
	checked bool
	valid   bool
	dirty   bool
}

func NewSession() *Session {
	return &Session{nil, "", "", false, false, false, false, false}
}

func (s Session) IsLoaded() bool {
	return s.loaded
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

	if s.file.jw != nil {
		var tmp error
		var token, csrf string
		ok := true
		s.file.jw.AtKey("session").GetStringVoid(&token, &tmp)
		if tmp != nil {
			G.Log.Warning("Bad 'session' value in session file %s: %s",
				s.file.filename, err.Error())
			ok = false
		}
		s.file.jw.AtKey("csrf").GetStringVoid(&csrf, &tmp)
		if tmp != nil {
			G.Log.Warning("Bad 'csrf' value in session file %s: %s",
				s.file.filename, err.Error())
			ok = false
		}
		if ok {
			s.token = token
			s.csrf = csrf
			s.inFile = true
		}
	}
	G.Log.Debug("- Loaded session")
	return nil
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
		s.valid = true
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
