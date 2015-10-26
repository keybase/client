package libkb

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"os"
)

// ServiceInfo describes runtime info for a service.
// This is primarily used to detect service updates.
type ServiceInfo struct {
	Version string
	Label   string
	Pid     int
}

// KeybaseServiceInfo is runtime info for the Keybase service.
func KeybaseServiceInfo() ServiceInfo {
	return ServiceInfo{
		Version: VersionString(),
		Label:   G.Env.GetLabel(),
		Pid:     os.Getpid(),
	}
}

// NewServiceInfo for generating service info for other services (like KBFS).
func NewServiceInfo(version string, build string, label string, pid int) ServiceInfo {
	return ServiceInfo{
		Version: fmt.Sprintf("%s-%s", version, build),
		Label:   label,
		Pid:     pid,
	}
}

// WriteFile writes service info as JSON in runtimeDir.
func (s ServiceInfo) WriteFile(path string) error {
	out, err := json.MarshalIndent(s, "", "  ")
	if err != nil {
		return err
	}
	return ioutil.WriteFile(path, []byte(out), 0644)
}
