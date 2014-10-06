package libkb

import ()

type JsonConfigFile struct {
	JsonFile
}

func NewJsonConfigFile(s string) *JsonConfigFile {
	return &JsonConfigFile{JsonFile{s, "config", nil}}
}

func (f JsonConfigFile) GetTopLevelString(s string) (ret string) {
	var e error
	if f.jw != nil {
		f.jw.AtKey(s).GetStringVoid(&ret, &e)
		G.Log.Debug("Config: mapping %s -> %s", s, ret)
	}
	return
}

func (f JsonConfigFile) GetTopLevelBool(s string) (res bool, is_set bool) {
	is_set = false
	res = false
	if f.jw != nil {
		if w := f.jw.AtKey(s); !w.IsNil() {
			is_set = true
			var e error
			w.GetBoolVoid(&res, &e)
		}
	}
	return
}

func (f JsonConfigFile) GetHome() (ret string)            { return f.GetTopLevelString("home") }
func (f JsonConfigFile) GetServerUri() (ret string)       { return f.GetTopLevelString("server") }
func (f JsonConfigFile) GetConfigFilename() (ret string)  { return f.GetTopLevelString("config") }
func (f JsonConfigFile) GetSessionFilename() (ret string) { return f.GetTopLevelString("session") }
func (f JsonConfigFile) GetDbFilename() (ret string)      { return f.GetTopLevelString("db") }
func (f JsonConfigFile) GetUsername() (ret string)        { return f.GetTopLevelString("username") }
func (f JsonConfigFile) GetProxy() (ret string)           { return f.GetTopLevelString("proxy") }
func (f JsonConfigFile) GetDebug() (bool, bool)           { return f.GetTopLevelBool("debug") }
func (f JsonConfigFile) GetPlainLogging() (bool, bool)    { return f.GetTopLevelBool("plain_logging") }
func (f JsonConfigFile) GetPgpDir() (ret string) {
	ret = f.GetTopLevelString("pgpdir")
	if len(ret) == 0 {
		ret = f.GetTopLevelString("gpgdir")
	}
	if len(ret) == 0 {
		ret = f.GetTopLevelString("gnupgdir")
	}
	return ret
}

func (f JsonConfigFile) GetBundledCA(host string) (ret string) {

	if f.jw != nil {
		var err error
		f.jw.AtKey("bundled_CAs").AtKey(host).GetStringVoid(&ret, &err)
		if err == nil {
			G.Log.Debug("Read bundled CA for %s", host)
		}
	}
	return ret
}
