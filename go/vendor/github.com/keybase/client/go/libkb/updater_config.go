package libkb

type InstallID string

func (i InstallID) Exists() bool {
	return len(i) > 0
}

func (i InstallID) String() string {
	return string(i)
}

type JSONUpdaterConfigFile struct {
	*JSONFile
}

func (j *JSONUpdaterConfigFile) GetInstallID() (ret InstallID) {
	if !j.Exists() {
		return ret
	}
	tmp, err := j.GetWrapper().AtKey("installId").GetString()
	if err == nil {
		ret = InstallID(tmp)
	}
	return ret
}

func NewJSONUpdaterConfigFile(g *GlobalContext) *JSONUpdaterConfigFile {
	return &JSONUpdaterConfigFile{NewJSONFile(g, g.Env.GetUpdaterConfigFilename(), "updater config")}
}

var _ UpdaterConfigReader = &JSONUpdaterConfigFile{}
