
package libkb

import (
)

type JsonConfigFile struct {
	JsonFile
}

func NewJsonConfigFile(s string) *JsonConfigFile {
	return &JsonConfigFile { JsonFile { s, "config", nil } }
}


func (f JsonConfigFile) GetTopLevelString(s string) (ret string) {
	var e error
	f.jw.AtKey("home").GetStringVoid(&ret, &e)
	return
}

func (f JsonConfigFile) GetTopLevelBool(s string) (res bool, is_set bool) {
	w := f.jw.AtKey("debug")
	if w.IsNil() {
		is_set = false
		res = false
	} else {
		is_set = true
		var e error
		w.GetBoolVoid(&res, &e)
	}
	return
}

func (f JsonConfigFile) GetHome() (ret string) { return f.GetTopLevelString("home") }
func (f JsonConfigFile) GetServerUri() (ret string) { return f.GetTopLevelString("server") }
func (f JsonConfigFile) GetConfigFilename() (ret string) { return f.GetTopLevelString("config") }
func (f JsonConfigFile) GetSessionFilename() (ret string) { return f.GetTopLevelString("session") }
func (f JsonConfigFile) GetDbFilename() (ret string) { return f.GetTopLevelString("db") }
func (f JsonConfigFile) GetApiUriPathPrefix() (ret string) { return f.GetTopLevelString("api_uri_path_prefix") }
func (f JsonConfigFile) GetUsername() (ret string) { return f.GetTopLevelString("username") }
func (f JsonConfigFile) GetProxy() (ret string) { return f.GetTopLevelString("proxy") }
func (f JsonConfigFile) GetDebug() (bool, bool) { return f.GetTopLevelBool("debug") }
func (f JsonConfigFile) GetPlainLogging() (bool, bool) { return f.GetTopLevelBool("plain_logging") }
