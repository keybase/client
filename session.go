package libkb

type Session struct {
	file    *JsonFile
	token   string
	csrf    string
	inFile  bool
	loaded  bool
	checked bool
	valid   bool
}

func NewSession() Session { return Session{nil, "", "", false, false, false, false} }

func (s *Session) Load() error {
	G.Log.Debug("+ Loading session")
	if s.loaded {
		G.Log.Debug("- Skipped; already loaded")
		return nil
	}
	s.file = &JsonFile{G.Env.GetSessionFilename(), "session", nil}
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
			G.Log.Warning("Bad 'session' value in session file %s: %s", s.file.filename, err.Error())
			ok = false
		}
		s.file.jw.AtKey("csrf").GetStringVoid(&csrf, &tmp)
		if tmp != nil {
			G.Log.Warning("Bad 'csrf' value in session file %s: %s", s.file.filename, err.Error())
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

	G.Log.Debug("- Checked session")
	return nil
}
