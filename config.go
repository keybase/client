package libkb

import (
	"github.com/keybase/go-jsonw"
)

type JsonConfigFile struct {
	JsonFile
}

type JsonConfigAdjuster struct {
	file *JsonConfigFile
}

func NewJsonConfigFile(s string) *JsonConfigFile {
	return &JsonConfigFile{*NewJsonFile(s, "config")}
}

func NewJsonConfigAdjuster(f *JsonConfigFile) *JsonConfigAdjuster {
	return &JsonConfigAdjuster{f}
}

type valueGetter func(*jsonw.Wrapper) (interface{}, error)

func (f JsonConfigFile) getValueAtPath(
	p string, getter valueGetter) (ret interface{}, is_set bool) {
	is_set = false
	if f.jw != nil {
		var err error
		ret, err = getter(f.jw.AtPath(p))
		if err == nil {
			is_set = true
		}
	}
	return
}

func getString(w *jsonw.Wrapper) (interface{}, error) {
	return w.GetString()
}

func getBool(w *jsonw.Wrapper) (interface{}, error) {
	return w.GetBool()
}

func getInt(w *jsonw.Wrapper) (interface{}, error) {
	return w.GetInt()
}

func (f JsonConfigFile) GetStringAtPath(p string) (ret string, is_set bool) {
	i, is_set := f.getValueAtPath(p, getString)
	ret = i.(string)
	return
}

func (f JsonConfigFile) GetBoolAtPath(p string) (ret bool, is_set bool) {
	i, is_set := f.getValueAtPath(p, getBool)
	ret = i.(bool)
	return
}

func (f JsonConfigFile) GetIntAtPath(p string) (ret int, is_set bool) {
	i, is_set := f.getValueAtPath(p, getInt)
	ret = i.(int)
	return
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

func (f *JsonConfigFile) UserDict() *jsonw.Wrapper {
	if f.jw == nil {
		f.jw = jsonw.NewDictionary()
	}
	if f.jw.AtKey("user").IsNil() {
		f.jw.SetKey("user", jsonw.NewDictionary())
	}
	return f.jw.AtKey("user")
}

func (f *JsonConfigFile) setValueAtPath(
	p string, getter valueGetter, v interface{}) (err error) {
	existing, err := getter(f.jw.AtPath(p))

	if err != nil || existing != v {
		err = f.jw.SetValueAtPath(p, jsonw.NewWrapper(v))
		if err == nil {
			f.dirty = true
		}
	}
	return
}

func (f *JsonConfigFile) SetStringAtPath(p string, v string) (err error) {
	return f.setValueAtPath(p, getString, v)
}

func (f *JsonConfigFile) SetBoolAtPath(p string, v bool) (err error) {
	return f.setValueAtPath(p, getBool, v)
}

func (f *JsonConfigFile) SetIntAtPath(p string, v int) (err error) {
	return f.setValueAtPath(p, getInt, v)
}

func (f *JsonConfigFile) SetUsername(s string) {
	f.SetUserField("name", s)
}

func (f *JsonConfigFile) SetUid(s string) {
	f.SetUserField("id", s)
}

func (f *JsonConfigFile) SetSalt(s string) {
	f.SetUserField("salt", s)
}

func (f *JsonConfigFile) SetUserField(k, v string) {
	existing := f.GetUserField(k)
	if existing != v {
		f.UserDict().SetKey(k, jsonw.NewString(v))
		f.dirty = true
	}
}

func (f *JsonConfigFile) Reset() {
	f.jw = jsonw.NewDictionary()
	f.dirty = true
}

func (f *JsonConfigFile) Write() error {
	return f.MaybeSave(true, 0)
}

func (f JsonConfigFile) GetUserField(s string) string {
	var ret string
	var err error
	if f.jw != nil {
		ret, err = f.jw.AtKey("user").AtKey(s).GetString()
		if err != nil {
			ret = ""
		}
	}
	G.Log.Debug("Config: mapping user.%s-> %s", s, ret)
	return ret
}

func (f JsonConfigFile) GetHome() (ret string) {
	return f.GetTopLevelString("home")
}
func (f JsonConfigFile) GetServerUri() (ret string) {
	return f.GetTopLevelString("server")
}
func (f JsonConfigFile) GetConfigFilename() (ret string) {
	return f.GetTopLevelString("config")
}
func (f JsonConfigFile) GetSessionFilename() (ret string) {
	return f.GetTopLevelString("session")
}
func (f JsonConfigFile) GetDbFilename() (ret string) {
	return f.GetTopLevelString("db")
}
func (f JsonConfigFile) GetUsername() string {
	return f.GetUserField("name")
}
func (f JsonConfigFile) GetSalt() string {
	return f.GetUserField("salt")
}
func (f JsonConfigFile) GetUid() string {
	return f.GetUserField("id")
}
func (f JsonConfigFile) GetEmail() (ret string) {
	return f.GetTopLevelString("email")
}
func (f JsonConfigFile) GetProxy() (ret string) {
	return f.GetTopLevelString("proxy")
}
func (f JsonConfigFile) GetDebug() (bool, bool) {
	return f.GetTopLevelBool("debug")
}
func (f JsonConfigFile) GetPlainLogging() (bool, bool) {
	return f.GetTopLevelBool("plain_logging")
}

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
