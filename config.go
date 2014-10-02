
package libkb

import (
	"os"
	"fmt"
	"github.com/okcupid/jsonw"
	"encoding/json"
)

type JsonConfigFile struct {
	filename string
	jw *jsonw.Wrapper
}

func NewJsonConfigFile(s string) *JsonConfigFile {
	return &JsonConfigFile { s, nil }
}

func (f *JsonConfigFile) Load() error {
	G.Log.Debug(fmt.Sprintf("+ opening config file: %s", f.filename))
	file, err := os.Open(f.filename)
	if err != nil {
		if os.IsNotExist(err) {
			G.Log.Warning(fmt.Sprintf("No config file found; tried %s", f.filename))
			return nil
		} else if os.IsPermission(err) {
			G.Log.Warning(fmt.Sprintf("Permission denied opening config file '%s'", f.filename))
			return nil
		} else {
			return err
		}
	}
	decoder := json.NewDecoder(file)
	obj := make(map[string]interface{})
	err = decoder.Decode(&obj)
	if err != nil {
		G.Log.Error("Decoding failed!")
		return err
	}
	f.jw = jsonw.NewWrapper(obj)
	G.Log.Debug("- successfully loaded config file")
	return nil
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
