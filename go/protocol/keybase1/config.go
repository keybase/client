// Auto-generated to Go types and interfaces using avdl-compiler v1.4.9 (https://github.com/keybase/node-avdl-compiler)
//   Input file: avdl/keybase1/config.avdl

package keybase1

import (
	"errors"
	"fmt"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	context "golang.org/x/net/context"
	"time"
)

type CurrentStatus struct {
	Configured     bool   `codec:"configured" json:"configured"`
	Registered     bool   `codec:"registered" json:"registered"`
	LoggedIn       bool   `codec:"loggedIn" json:"loggedIn"`
	SessionIsValid bool   `codec:"sessionIsValid" json:"sessionIsValid"`
	User           *User  `codec:"user,omitempty" json:"user,omitempty"`
	DeviceName     string `codec:"deviceName" json:"deviceName"`
}

func (o CurrentStatus) DeepCopy() CurrentStatus {
	return CurrentStatus{
		Configured:     o.Configured,
		Registered:     o.Registered,
		LoggedIn:       o.LoggedIn,
		SessionIsValid: o.SessionIsValid,
		User: (func(x *User) *User {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.User),
		DeviceName: o.DeviceName,
	}
}

type SessionStatus struct {
	SessionFor string `codec:"SessionFor" json:"SessionFor"`
	Loaded     bool   `codec:"Loaded" json:"Loaded"`
	Cleared    bool   `codec:"Cleared" json:"Cleared"`
	SaltOnly   bool   `codec:"SaltOnly" json:"SaltOnly"`
	Expired    bool   `codec:"Expired" json:"Expired"`
}

func (o SessionStatus) DeepCopy() SessionStatus {
	return SessionStatus{
		SessionFor: o.SessionFor,
		Loaded:     o.Loaded,
		Cleared:    o.Cleared,
		SaltOnly:   o.SaltOnly,
		Expired:    o.Expired,
	}
}

type ClientDetails struct {
	Pid        int        `codec:"pid" json:"pid"`
	ClientType ClientType `codec:"clientType" json:"clientType"`
	Argv       []string   `codec:"argv" json:"argv"`
	Desc       string     `codec:"desc" json:"desc"`
	Version    string     `codec:"version" json:"version"`
}

func (o ClientDetails) DeepCopy() ClientDetails {
	return ClientDetails{
		Pid:        o.Pid,
		ClientType: o.ClientType.DeepCopy(),
		Argv: (func(x []string) []string {
			if x == nil {
				return nil
			}
			ret := make([]string, len(x))
			for i, v := range x {
				vCopy := v
				ret[i] = vCopy
			}
			return ret
		})(o.Argv),
		Desc:    o.Desc,
		Version: o.Version,
	}
}

type ClientStatus struct {
	Details              ClientDetails        `codec:"details" json:"details"`
	ConnectionID         int                  `codec:"connectionID" json:"connectionID"`
	NotificationChannels NotificationChannels `codec:"notificationChannels" json:"notificationChannels"`
}

func (o ClientStatus) DeepCopy() ClientStatus {
	return ClientStatus{
		Details:              o.Details.DeepCopy(),
		ConnectionID:         o.ConnectionID,
		NotificationChannels: o.NotificationChannels.DeepCopy(),
	}
}

type PlatformInfo struct {
	Os        string `codec:"os" json:"os"`
	OsVersion string `codec:"osVersion" json:"osVersion"`
	Arch      string `codec:"arch" json:"arch"`
	GoVersion string `codec:"goVersion" json:"goVersion"`
}

func (o PlatformInfo) DeepCopy() PlatformInfo {
	return PlatformInfo{
		Os:        o.Os,
		OsVersion: o.OsVersion,
		Arch:      o.Arch,
		GoVersion: o.GoVersion,
	}
}

type LoadDeviceErr struct {
	Where string `codec:"where" json:"where"`
	Desc  string `codec:"desc" json:"desc"`
}

func (o LoadDeviceErr) DeepCopy() LoadDeviceErr {
	return LoadDeviceErr{
		Where: o.Where,
		Desc:  o.Desc,
	}
}

type DirSizeInfo struct {
	NumFiles  int    `codec:"numFiles" json:"numFiles"`
	Name      string `codec:"name" json:"name"`
	HumanSize string `codec:"humanSize" json:"humanSize"`
}

func (o DirSizeInfo) DeepCopy() DirSizeInfo {
	return DirSizeInfo{
		NumFiles:  o.NumFiles,
		Name:      o.Name,
		HumanSize: o.HumanSize,
	}
}

type ExtendedStatus struct {
	Standalone             bool                `codec:"standalone" json:"standalone"`
	PassphraseStreamCached bool                `codec:"passphraseStreamCached" json:"passphraseStreamCached"`
	TsecCached             bool                `codec:"tsecCached" json:"tsecCached"`
	DeviceSigKeyCached     bool                `codec:"deviceSigKeyCached" json:"deviceSigKeyCached"`
	DeviceEncKeyCached     bool                `codec:"deviceEncKeyCached" json:"deviceEncKeyCached"`
	PaperSigKeyCached      bool                `codec:"paperSigKeyCached" json:"paperSigKeyCached"`
	PaperEncKeyCached      bool                `codec:"paperEncKeyCached" json:"paperEncKeyCached"`
	StoredSecret           bool                `codec:"storedSecret" json:"storedSecret"`
	SecretPromptSkip       bool                `codec:"secretPromptSkip" json:"secretPromptSkip"`
	RememberPassphrase     bool                `codec:"rememberPassphrase" json:"rememberPassphrase"`
	Device                 *Device             `codec:"device,omitempty" json:"device,omitempty"`
	DeviceErr              *LoadDeviceErr      `codec:"deviceErr,omitempty" json:"deviceErr,omitempty"`
	LogDir                 string              `codec:"logDir" json:"logDir"`
	Session                *SessionStatus      `codec:"session,omitempty" json:"session,omitempty"`
	DefaultUsername        string              `codec:"defaultUsername" json:"defaultUsername"`
	ProvisionedUsernames   []string            `codec:"provisionedUsernames" json:"provisionedUsernames"`
	ConfiguredAccounts     []ConfiguredAccount `codec:"configuredAccounts" json:"configuredAccounts"`
	Clients                []ClientStatus      `codec:"Clients" json:"Clients"`
	DeviceEkNames          []string            `codec:"deviceEkNames" json:"deviceEkNames"`
	PlatformInfo           PlatformInfo        `codec:"platformInfo" json:"platformInfo"`
	DefaultDeviceID        DeviceID            `codec:"defaultDeviceID" json:"defaultDeviceID"`
	LocalDbStats           []string            `codec:"localDbStats" json:"localDbStats"`
	LocalChatDbStats       []string            `codec:"localChatDbStats" json:"localChatDbStats"`
	LocalBlockCacheDbStats []string            `codec:"localBlockCacheDbStats" json:"localBlockCacheDbStats"`
	LocalSyncCacheDbStats  []string            `codec:"localSyncCacheDbStats" json:"localSyncCacheDbStats"`
	CacheDirSizeInfo       []DirSizeInfo       `codec:"cacheDirSizeInfo" json:"cacheDirSizeInfo"`
	UiRouterMapping        map[string]int      `codec:"uiRouterMapping" json:"uiRouterMapping"`
}

func (o ExtendedStatus) DeepCopy() ExtendedStatus {
	return ExtendedStatus{
		Standalone:             o.Standalone,
		PassphraseStreamCached: o.PassphraseStreamCached,
		TsecCached:             o.TsecCached,
		DeviceSigKeyCached:     o.DeviceSigKeyCached,
		DeviceEncKeyCached:     o.DeviceEncKeyCached,
		PaperSigKeyCached:      o.PaperSigKeyCached,
		PaperEncKeyCached:      o.PaperEncKeyCached,
		StoredSecret:           o.StoredSecret,
		SecretPromptSkip:       o.SecretPromptSkip,
		RememberPassphrase:     o.RememberPassphrase,
		Device: (func(x *Device) *Device {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Device),
		DeviceErr: (func(x *LoadDeviceErr) *LoadDeviceErr {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.DeviceErr),
		LogDir: o.LogDir,
		Session: (func(x *SessionStatus) *SessionStatus {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Session),
		DefaultUsername: o.DefaultUsername,
		ProvisionedUsernames: (func(x []string) []string {
			if x == nil {
				return nil
			}
			ret := make([]string, len(x))
			for i, v := range x {
				vCopy := v
				ret[i] = vCopy
			}
			return ret
		})(o.ProvisionedUsernames),
		ConfiguredAccounts: (func(x []ConfiguredAccount) []ConfiguredAccount {
			if x == nil {
				return nil
			}
			ret := make([]ConfiguredAccount, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.ConfiguredAccounts),
		Clients: (func(x []ClientStatus) []ClientStatus {
			if x == nil {
				return nil
			}
			ret := make([]ClientStatus, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.Clients),
		DeviceEkNames: (func(x []string) []string {
			if x == nil {
				return nil
			}
			ret := make([]string, len(x))
			for i, v := range x {
				vCopy := v
				ret[i] = vCopy
			}
			return ret
		})(o.DeviceEkNames),
		PlatformInfo:    o.PlatformInfo.DeepCopy(),
		DefaultDeviceID: o.DefaultDeviceID.DeepCopy(),
		LocalDbStats: (func(x []string) []string {
			if x == nil {
				return nil
			}
			ret := make([]string, len(x))
			for i, v := range x {
				vCopy := v
				ret[i] = vCopy
			}
			return ret
		})(o.LocalDbStats),
		LocalChatDbStats: (func(x []string) []string {
			if x == nil {
				return nil
			}
			ret := make([]string, len(x))
			for i, v := range x {
				vCopy := v
				ret[i] = vCopy
			}
			return ret
		})(o.LocalChatDbStats),
		LocalBlockCacheDbStats: (func(x []string) []string {
			if x == nil {
				return nil
			}
			ret := make([]string, len(x))
			for i, v := range x {
				vCopy := v
				ret[i] = vCopy
			}
			return ret
		})(o.LocalBlockCacheDbStats),
		LocalSyncCacheDbStats: (func(x []string) []string {
			if x == nil {
				return nil
			}
			ret := make([]string, len(x))
			for i, v := range x {
				vCopy := v
				ret[i] = vCopy
			}
			return ret
		})(o.LocalSyncCacheDbStats),
		CacheDirSizeInfo: (func(x []DirSizeInfo) []DirSizeInfo {
			if x == nil {
				return nil
			}
			ret := make([]DirSizeInfo, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.CacheDirSizeInfo),
		UiRouterMapping: (func(x map[string]int) map[string]int {
			if x == nil {
				return nil
			}
			ret := make(map[string]int, len(x))
			for k, v := range x {
				kCopy := k
				vCopy := v
				ret[kCopy] = vCopy
			}
			return ret
		})(o.UiRouterMapping),
	}
}

type KbClientStatus struct {
	Version string `codec:"version" json:"version"`
}

func (o KbClientStatus) DeepCopy() KbClientStatus {
	return KbClientStatus{
		Version: o.Version,
	}
}

type KbServiceStatus struct {
	Version string `codec:"version" json:"version"`
	Running bool   `codec:"running" json:"running"`
	Pid     string `codec:"pid" json:"pid"`
	Log     string `codec:"log" json:"log"`
	EkLog   string `codec:"ekLog" json:"ekLog"`
	PerfLog string `codec:"perfLog" json:"perfLog"`
}

func (o KbServiceStatus) DeepCopy() KbServiceStatus {
	return KbServiceStatus{
		Version: o.Version,
		Running: o.Running,
		Pid:     o.Pid,
		Log:     o.Log,
		EkLog:   o.EkLog,
		PerfLog: o.PerfLog,
	}
}

type KBFSStatus struct {
	Version          string `codec:"version" json:"version"`
	InstalledVersion string `codec:"installedVersion" json:"installedVersion"`
	Running          bool   `codec:"running" json:"running"`
	Pid              string `codec:"pid" json:"pid"`
	Log              string `codec:"log" json:"log"`
	PerfLog          string `codec:"perfLog" json:"perfLog"`
	Mount            string `codec:"mount" json:"mount"`
}

func (o KBFSStatus) DeepCopy() KBFSStatus {
	return KBFSStatus{
		Version:          o.Version,
		InstalledVersion: o.InstalledVersion,
		Running:          o.Running,
		Pid:              o.Pid,
		Log:              o.Log,
		PerfLog:          o.PerfLog,
		Mount:            o.Mount,
	}
}

type DesktopStatus struct {
	Version string `codec:"version" json:"version"`
	Running bool   `codec:"running" json:"running"`
	Log     string `codec:"log" json:"log"`
}

func (o DesktopStatus) DeepCopy() DesktopStatus {
	return DesktopStatus{
		Version: o.Version,
		Running: o.Running,
		Log:     o.Log,
	}
}

type UpdaterStatus struct {
	Log string `codec:"log" json:"log"`
}

func (o UpdaterStatus) DeepCopy() UpdaterStatus {
	return UpdaterStatus{
		Log: o.Log,
	}
}

type StartStatus struct {
	Log string `codec:"log" json:"log"`
}

func (o StartStatus) DeepCopy() StartStatus {
	return StartStatus{
		Log: o.Log,
	}
}

type GitStatus struct {
	Log     string `codec:"log" json:"log"`
	PerfLog string `codec:"perfLog" json:"perfLog"`
}

func (o GitStatus) DeepCopy() GitStatus {
	return GitStatus{
		Log:     o.Log,
		PerfLog: o.PerfLog,
	}
}

type FullStatus struct {
	Username   string          `codec:"username" json:"username"`
	ConfigPath string          `codec:"configPath" json:"configPath"`
	CurStatus  CurrentStatus   `codec:"curStatus" json:"curStatus"`
	ExtStatus  ExtendedStatus  `codec:"extStatus" json:"extStatus"`
	Client     KbClientStatus  `codec:"client" json:"client"`
	Service    KbServiceStatus `codec:"service" json:"service"`
	Kbfs       KBFSStatus      `codec:"kbfs" json:"kbfs"`
	Desktop    DesktopStatus   `codec:"desktop" json:"desktop"`
	Updater    UpdaterStatus   `codec:"updater" json:"updater"`
	Start      StartStatus     `codec:"start" json:"start"`
	Git        GitStatus       `codec:"git" json:"git"`
}

func (o FullStatus) DeepCopy() FullStatus {
	return FullStatus{
		Username:   o.Username,
		ConfigPath: o.ConfigPath,
		CurStatus:  o.CurStatus.DeepCopy(),
		ExtStatus:  o.ExtStatus.DeepCopy(),
		Client:     o.Client.DeepCopy(),
		Service:    o.Service.DeepCopy(),
		Kbfs:       o.Kbfs.DeepCopy(),
		Desktop:    o.Desktop.DeepCopy(),
		Updater:    o.Updater.DeepCopy(),
		Start:      o.Start.DeepCopy(),
		Git:        o.Git.DeepCopy(),
	}
}

type LogSendID string

func (o LogSendID) DeepCopy() LogSendID {
	return o
}

type AllProvisionedUsernames struct {
	DefaultUsername      string   `codec:"defaultUsername" json:"defaultUsername"`
	ProvisionedUsernames []string `codec:"provisionedUsernames" json:"provisionedUsernames"`
	HasProvisionedUser   bool     `codec:"hasProvisionedUser" json:"hasProvisionedUser"`
}

func (o AllProvisionedUsernames) DeepCopy() AllProvisionedUsernames {
	return AllProvisionedUsernames{
		DefaultUsername: o.DefaultUsername,
		ProvisionedUsernames: (func(x []string) []string {
			if x == nil {
				return nil
			}
			ret := make([]string, len(x))
			for i, v := range x {
				vCopy := v
				ret[i] = vCopy
			}
			return ret
		})(o.ProvisionedUsernames),
		HasProvisionedUser: o.HasProvisionedUser,
	}
}

type ForkType int

const (
	ForkType_NONE     ForkType = 0
	ForkType_AUTO     ForkType = 1
	ForkType_WATCHDOG ForkType = 2
	ForkType_LAUNCHD  ForkType = 3
	ForkType_SYSTEMD  ForkType = 4
)

func (o ForkType) DeepCopy() ForkType { return o }

var ForkTypeMap = map[string]ForkType{
	"NONE":     0,
	"AUTO":     1,
	"WATCHDOG": 2,
	"LAUNCHD":  3,
	"SYSTEMD":  4,
}

var ForkTypeRevMap = map[ForkType]string{
	0: "NONE",
	1: "AUTO",
	2: "WATCHDOG",
	3: "LAUNCHD",
	4: "SYSTEMD",
}

func (e ForkType) String() string {
	if v, ok := ForkTypeRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type Config struct {
	ServerURI      string   `codec:"serverURI" json:"serverURI"`
	SocketFile     string   `codec:"socketFile" json:"socketFile"`
	Label          string   `codec:"label" json:"label"`
	RunMode        string   `codec:"runMode" json:"runMode"`
	GpgExists      bool     `codec:"gpgExists" json:"gpgExists"`
	GpgPath        string   `codec:"gpgPath" json:"gpgPath"`
	Version        string   `codec:"version" json:"version"`
	Path           string   `codec:"path" json:"path"`
	BinaryRealpath string   `codec:"binaryRealpath" json:"binaryRealpath"`
	ConfigPath     string   `codec:"configPath" json:"configPath"`
	VersionShort   string   `codec:"versionShort" json:"versionShort"`
	VersionFull    string   `codec:"versionFull" json:"versionFull"`
	IsAutoForked   bool     `codec:"isAutoForked" json:"isAutoForked"`
	ForkType       ForkType `codec:"forkType" json:"forkType"`
}

func (o Config) DeepCopy() Config {
	return Config{
		ServerURI:      o.ServerURI,
		SocketFile:     o.SocketFile,
		Label:          o.Label,
		RunMode:        o.RunMode,
		GpgExists:      o.GpgExists,
		GpgPath:        o.GpgPath,
		Version:        o.Version,
		Path:           o.Path,
		BinaryRealpath: o.BinaryRealpath,
		ConfigPath:     o.ConfigPath,
		VersionShort:   o.VersionShort,
		VersionFull:    o.VersionFull,
		IsAutoForked:   o.IsAutoForked,
		ForkType:       o.ForkType.DeepCopy(),
	}
}

type ConfigValue struct {
	IsNull bool     `codec:"isNull" json:"isNull"`
	B      *bool    `codec:"b,omitempty" json:"b,omitempty"`
	I      *int     `codec:"i,omitempty" json:"i,omitempty"`
	F      *float64 `codec:"f,omitempty" json:"f,omitempty"`
	S      *string  `codec:"s,omitempty" json:"s,omitempty"`
	O      *string  `codec:"o,omitempty" json:"o,omitempty"`
}

func (o ConfigValue) DeepCopy() ConfigValue {
	return ConfigValue{
		IsNull: o.IsNull,
		B: (func(x *bool) *bool {
			if x == nil {
				return nil
			}
			tmp := (*x)
			return &tmp
		})(o.B),
		I: (func(x *int) *int {
			if x == nil {
				return nil
			}
			tmp := (*x)
			return &tmp
		})(o.I),
		F: (func(x *float64) *float64 {
			if x == nil {
				return nil
			}
			tmp := (*x)
			return &tmp
		})(o.F),
		S: (func(x *string) *string {
			if x == nil {
				return nil
			}
			tmp := (*x)
			return &tmp
		})(o.S),
		O: (func(x *string) *string {
			if x == nil {
				return nil
			}
			tmp := (*x)
			return &tmp
		})(o.O),
	}
}

type OutOfDateInfo struct {
	UpgradeTo         string `codec:"upgradeTo" json:"upgradeTo"`
	UpgradeURI        string `codec:"upgradeURI" json:"upgradeURI"`
	CustomMessage     string `codec:"customMessage" json:"customMessage"`
	CriticalClockSkew int64  `codec:"criticalClockSkew" json:"criticalClockSkew"`
}

func (o OutOfDateInfo) DeepCopy() OutOfDateInfo {
	return OutOfDateInfo{
		UpgradeTo:         o.UpgradeTo,
		UpgradeURI:        o.UpgradeURI,
		CustomMessage:     o.CustomMessage,
		CriticalClockSkew: o.CriticalClockSkew,
	}
}

type UpdateInfoStatus int

const (
	UpdateInfoStatus_UP_TO_DATE             UpdateInfoStatus = 0
	UpdateInfoStatus_NEED_UPDATE            UpdateInfoStatus = 1
	UpdateInfoStatus_CRITICALLY_OUT_OF_DATE UpdateInfoStatus = 2
)

func (o UpdateInfoStatus) DeepCopy() UpdateInfoStatus { return o }

var UpdateInfoStatusMap = map[string]UpdateInfoStatus{
	"UP_TO_DATE":             0,
	"NEED_UPDATE":            1,
	"CRITICALLY_OUT_OF_DATE": 2,
}

var UpdateInfoStatusRevMap = map[UpdateInfoStatus]string{
	0: "UP_TO_DATE",
	1: "NEED_UPDATE",
	2: "CRITICALLY_OUT_OF_DATE",
}

func (e UpdateInfoStatus) String() string {
	if v, ok := UpdateInfoStatusRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type UpdateInfo struct {
	Status  UpdateInfoStatus `codec:"status" json:"status"`
	Message string           `codec:"message" json:"message"`
}

func (o UpdateInfo) DeepCopy() UpdateInfo {
	return UpdateInfo{
		Status:  o.Status.DeepCopy(),
		Message: o.Message,
	}
}

type BootstrapStatus struct {
	Registered  bool         `codec:"registered" json:"registered"`
	LoggedIn    bool         `codec:"loggedIn" json:"loggedIn"`
	Uid         UID          `codec:"uid" json:"uid"`
	Username    string       `codec:"username" json:"username"`
	DeviceID    DeviceID     `codec:"deviceID" json:"deviceID"`
	DeviceName  string       `codec:"deviceName" json:"deviceName"`
	Fullname    FullName     `codec:"fullname" json:"fullname"`
	UserReacjis UserReacjis  `codec:"userReacjis" json:"userReacjis"`
	HttpSrvInfo *HttpSrvInfo `codec:"httpSrvInfo,omitempty" json:"httpSrvInfo,omitempty"`
}

func (o BootstrapStatus) DeepCopy() BootstrapStatus {
	return BootstrapStatus{
		Registered:  o.Registered,
		LoggedIn:    o.LoggedIn,
		Uid:         o.Uid.DeepCopy(),
		Username:    o.Username,
		DeviceID:    o.DeviceID.DeepCopy(),
		DeviceName:  o.DeviceName,
		Fullname:    o.Fullname.DeepCopy(),
		UserReacjis: o.UserReacjis.DeepCopy(),
		HttpSrvInfo: (func(x *HttpSrvInfo) *HttpSrvInfo {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.HttpSrvInfo),
	}
}

type UpdateInfoStatus2 int

const (
	UpdateInfoStatus2_OK        UpdateInfoStatus2 = 0
	UpdateInfoStatus2_SUGGESTED UpdateInfoStatus2 = 1
	UpdateInfoStatus2_CRITICAL  UpdateInfoStatus2 = 2
)

func (o UpdateInfoStatus2) DeepCopy() UpdateInfoStatus2 { return o }

var UpdateInfoStatus2Map = map[string]UpdateInfoStatus2{
	"OK":        0,
	"SUGGESTED": 1,
	"CRITICAL":  2,
}

var UpdateInfoStatus2RevMap = map[UpdateInfoStatus2]string{
	0: "OK",
	1: "SUGGESTED",
	2: "CRITICAL",
}

func (e UpdateInfoStatus2) String() string {
	if v, ok := UpdateInfoStatus2RevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type UpdateDetails struct {
	Message string `codec:"message" json:"message"`
}

func (o UpdateDetails) DeepCopy() UpdateDetails {
	return UpdateDetails{
		Message: o.Message,
	}
}

type UpdateInfo2 struct {
	Status__    UpdateInfoStatus2 `codec:"status" json:"status"`
	Suggested__ *UpdateDetails    `codec:"suggested,omitempty" json:"suggested,omitempty"`
	Critical__  *UpdateDetails    `codec:"critical,omitempty" json:"critical,omitempty"`
}

func (o *UpdateInfo2) Status() (ret UpdateInfoStatus2, err error) {
	switch o.Status__ {
	case UpdateInfoStatus2_SUGGESTED:
		if o.Suggested__ == nil {
			err = errors.New("unexpected nil value for Suggested__")
			return ret, err
		}
	case UpdateInfoStatus2_CRITICAL:
		if o.Critical__ == nil {
			err = errors.New("unexpected nil value for Critical__")
			return ret, err
		}
	}
	return o.Status__, nil
}

func (o UpdateInfo2) Suggested() (res UpdateDetails) {
	if o.Status__ != UpdateInfoStatus2_SUGGESTED {
		panic("wrong case accessed")
	}
	if o.Suggested__ == nil {
		return
	}
	return *o.Suggested__
}

func (o UpdateInfo2) Critical() (res UpdateDetails) {
	if o.Status__ != UpdateInfoStatus2_CRITICAL {
		panic("wrong case accessed")
	}
	if o.Critical__ == nil {
		return
	}
	return *o.Critical__
}

func NewUpdateInfo2WithOk() UpdateInfo2 {
	return UpdateInfo2{
		Status__: UpdateInfoStatus2_OK,
	}
}

func NewUpdateInfo2WithSuggested(v UpdateDetails) UpdateInfo2 {
	return UpdateInfo2{
		Status__:    UpdateInfoStatus2_SUGGESTED,
		Suggested__: &v,
	}
}

func NewUpdateInfo2WithCritical(v UpdateDetails) UpdateInfo2 {
	return UpdateInfo2{
		Status__:   UpdateInfoStatus2_CRITICAL,
		Critical__: &v,
	}
}

func (o UpdateInfo2) DeepCopy() UpdateInfo2 {
	return UpdateInfo2{
		Status__: o.Status__.DeepCopy(),
		Suggested__: (func(x *UpdateDetails) *UpdateDetails {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Suggested__),
		Critical__: (func(x *UpdateDetails) *UpdateDetails {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Critical__),
	}
}

type ProxyType int

const (
	ProxyType_No_Proxy     ProxyType = 0
	ProxyType_HTTP_Connect ProxyType = 1
	ProxyType_Socks        ProxyType = 2
)

func (o ProxyType) DeepCopy() ProxyType { return o }

var ProxyTypeMap = map[string]ProxyType{
	"No_Proxy":     0,
	"HTTP_Connect": 1,
	"Socks":        2,
}

var ProxyTypeRevMap = map[ProxyType]string{
	0: "No_Proxy",
	1: "HTTP_Connect",
	2: "Socks",
}

func (e ProxyType) String() string {
	if v, ok := ProxyTypeRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type ProxyData struct {
	AddressWithPort string    `codec:"addressWithPort" json:"addressWithPort"`
	ProxyType       ProxyType `codec:"proxyType" json:"proxyType"`
	CertPinning     bool      `codec:"certPinning" json:"certPinning"`
}

func (o ProxyData) DeepCopy() ProxyData {
	return ProxyData{
		AddressWithPort: o.AddressWithPort,
		ProxyType:       o.ProxyType.DeepCopy(),
		CertPinning:     o.CertPinning,
	}
}

type GetCurrentStatusArg struct {
	SessionID int `codec:"sessionID" json:"sessionID"`
}

type GetClientStatusArg struct {
	SessionID int `codec:"sessionID" json:"sessionID"`
}

type GetFullStatusArg struct {
	SessionID int `codec:"sessionID" json:"sessionID"`
}

type IsServiceRunningArg struct {
	SessionID int `codec:"sessionID" json:"sessionID"`
}

type IsKBFSRunningArg struct {
	SessionID int `codec:"sessionID" json:"sessionID"`
}

type GetNetworkStatsArg struct {
	SessionID  int           `codec:"sessionID" json:"sessionID"`
	NetworkSrc NetworkSource `codec:"networkSrc" json:"networkSrc"`
}

type LogSendArg struct {
	SessionID    int    `codec:"sessionID" json:"sessionID"`
	StatusJSON   string `codec:"statusJSON" json:"statusJSON"`
	Feedback     string `codec:"feedback" json:"feedback"`
	SendLogs     bool   `codec:"sendLogs" json:"sendLogs"`
	SendMaxBytes bool   `codec:"sendMaxBytes" json:"sendMaxBytes"`
}

type GetAllProvisionedUsernamesArg struct {
	SessionID int `codec:"sessionID" json:"sessionID"`
}

type GetConfigArg struct {
	SessionID int `codec:"sessionID" json:"sessionID"`
}

type SetUserConfigArg struct {
	SessionID int    `codec:"sessionID" json:"sessionID"`
	Username  string `codec:"username" json:"username"`
	Key       string `codec:"key" json:"key"`
	Value     string `codec:"value" json:"value"`
}

type SetPathArg struct {
	SessionID int    `codec:"sessionID" json:"sessionID"`
	Path      string `codec:"path" json:"path"`
}

type HelloIAmArg struct {
	Details ClientDetails `codec:"details" json:"details"`
}

type SetValueArg struct {
	Path  string      `codec:"path" json:"path"`
	Value ConfigValue `codec:"value" json:"value"`
}

type ClearValueArg struct {
	Path string `codec:"path" json:"path"`
}

type GetValueArg struct {
	Path string `codec:"path" json:"path"`
}

type GuiSetValueArg struct {
	Path  string      `codec:"path" json:"path"`
	Value ConfigValue `codec:"value" json:"value"`
}

type GuiClearValueArg struct {
	Path string `codec:"path" json:"path"`
}

type GuiGetValueArg struct {
	Path string `codec:"path" json:"path"`
}

type CheckAPIServerOutOfDateWarningArg struct {
}

type GetUpdateInfoArg struct {
}

type StartUpdateIfNeededArg struct {
}

type WaitForClientArg struct {
	ClientType ClientType  `codec:"clientType" json:"clientType"`
	Timeout    DurationSec `codec:"timeout" json:"timeout"`
}

type GetBootstrapStatusArg struct {
	SessionID int `codec:"sessionID" json:"sessionID"`
}

type RequestFollowingAndUnverifiedFollowersArg struct {
	SessionID int `codec:"sessionID" json:"sessionID"`
}

type GetRememberPassphraseArg struct {
	SessionID int `codec:"sessionID" json:"sessionID"`
}

type SetRememberPassphraseArg struct {
	SessionID int  `codec:"sessionID" json:"sessionID"`
	Remember  bool `codec:"remember" json:"remember"`
}

type GetUpdateInfo2Arg struct {
	Platform *string `codec:"platform,omitempty" json:"platform,omitempty"`
	Version  *string `codec:"version,omitempty" json:"version,omitempty"`
}

type SetProxyDataArg struct {
	ProxyData ProxyData `codec:"proxyData" json:"proxyData"`
}

type GetProxyDataArg struct {
}

type ToggleRuntimeStatsArg struct {
}

type AppendGUILogsArg struct {
	Content string `codec:"content" json:"content"`
}

type GenerateWebAuthTokenArg struct {
}

type UpdateLastLoggedInAndServerConfigArg struct {
	ServerConfigPath string `codec:"serverConfigPath" json:"serverConfigPath"`
}

type ConfigInterface interface {
	GetCurrentStatus(context.Context, int) (CurrentStatus, error)
	GetClientStatus(context.Context, int) ([]ClientStatus, error)
	GetFullStatus(context.Context, int) (*FullStatus, error)
	IsServiceRunning(context.Context, int) (bool, error)
	IsKBFSRunning(context.Context, int) (bool, error)
	GetNetworkStats(context.Context, GetNetworkStatsArg) ([]InstrumentationStat, error)
	LogSend(context.Context, LogSendArg) (LogSendID, error)
	GetAllProvisionedUsernames(context.Context, int) (AllProvisionedUsernames, error)
	GetConfig(context.Context, int) (Config, error)
	// Change user config.
	// For example, to update primary picture source:
	// key=picture.source, value=twitter (or github)
	SetUserConfig(context.Context, SetUserConfigArg) error
	SetPath(context.Context, SetPathArg) error
	HelloIAm(context.Context, ClientDetails) error
	SetValue(context.Context, SetValueArg) error
	ClearValue(context.Context, string) error
	GetValue(context.Context, string) (ConfigValue, error)
	GuiSetValue(context.Context, GuiSetValueArg) error
	GuiClearValue(context.Context, string) error
	GuiGetValue(context.Context, string) (ConfigValue, error)
	// Check whether the API server has told us we're out of date.
	CheckAPIServerOutOfDateWarning(context.Context) (OutOfDateInfo, error)
	GetUpdateInfo(context.Context) (UpdateInfo, error)
	StartUpdateIfNeeded(context.Context) error
	// Wait for client type to connect to service.
	WaitForClient(context.Context, WaitForClientArg) (bool, error)
	GetBootstrapStatus(context.Context, int) (BootstrapStatus, error)
	RequestFollowingAndUnverifiedFollowers(context.Context, int) error
	GetRememberPassphrase(context.Context, int) (bool, error)
	SetRememberPassphrase(context.Context, SetRememberPassphraseArg) error
	// getUpdateInfo2 is to drive the redbar on mobile and desktop apps. The redbar tells you if
	// you are critically out of date.
	GetUpdateInfo2(context.Context, GetUpdateInfo2Arg) (UpdateInfo2, error)
	SetProxyData(context.Context, ProxyData) error
	GetProxyData(context.Context) (ProxyData, error)
	ToggleRuntimeStats(context.Context) error
	AppendGUILogs(context.Context, string) error
	GenerateWebAuthToken(context.Context) (string, error)
	UpdateLastLoggedInAndServerConfig(context.Context, string) error
}

func ConfigProtocol(i ConfigInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.config",
		Methods: map[string]rpc.ServeHandlerDescription{
			"getCurrentStatus": {
				MakeArg: func() interface{} {
					var ret [1]GetCurrentStatusArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]GetCurrentStatusArg)
					if !ok {
						err = rpc.NewTypeError((*[1]GetCurrentStatusArg)(nil), args)
						return
					}
					ret, err = i.GetCurrentStatus(ctx, typedArgs[0].SessionID)
					return
				},
			},
			"getClientStatus": {
				MakeArg: func() interface{} {
					var ret [1]GetClientStatusArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]GetClientStatusArg)
					if !ok {
						err = rpc.NewTypeError((*[1]GetClientStatusArg)(nil), args)
						return
					}
					ret, err = i.GetClientStatus(ctx, typedArgs[0].SessionID)
					return
				},
			},
			"getFullStatus": {
				MakeArg: func() interface{} {
					var ret [1]GetFullStatusArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]GetFullStatusArg)
					if !ok {
						err = rpc.NewTypeError((*[1]GetFullStatusArg)(nil), args)
						return
					}
					ret, err = i.GetFullStatus(ctx, typedArgs[0].SessionID)
					return
				},
			},
			"isServiceRunning": {
				MakeArg: func() interface{} {
					var ret [1]IsServiceRunningArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]IsServiceRunningArg)
					if !ok {
						err = rpc.NewTypeError((*[1]IsServiceRunningArg)(nil), args)
						return
					}
					ret, err = i.IsServiceRunning(ctx, typedArgs[0].SessionID)
					return
				},
			},
			"isKBFSRunning": {
				MakeArg: func() interface{} {
					var ret [1]IsKBFSRunningArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]IsKBFSRunningArg)
					if !ok {
						err = rpc.NewTypeError((*[1]IsKBFSRunningArg)(nil), args)
						return
					}
					ret, err = i.IsKBFSRunning(ctx, typedArgs[0].SessionID)
					return
				},
			},
			"getNetworkStats": {
				MakeArg: func() interface{} {
					var ret [1]GetNetworkStatsArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]GetNetworkStatsArg)
					if !ok {
						err = rpc.NewTypeError((*[1]GetNetworkStatsArg)(nil), args)
						return
					}
					ret, err = i.GetNetworkStats(ctx, typedArgs[0])
					return
				},
			},
			"logSend": {
				MakeArg: func() interface{} {
					var ret [1]LogSendArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]LogSendArg)
					if !ok {
						err = rpc.NewTypeError((*[1]LogSendArg)(nil), args)
						return
					}
					ret, err = i.LogSend(ctx, typedArgs[0])
					return
				},
			},
			"getAllProvisionedUsernames": {
				MakeArg: func() interface{} {
					var ret [1]GetAllProvisionedUsernamesArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]GetAllProvisionedUsernamesArg)
					if !ok {
						err = rpc.NewTypeError((*[1]GetAllProvisionedUsernamesArg)(nil), args)
						return
					}
					ret, err = i.GetAllProvisionedUsernames(ctx, typedArgs[0].SessionID)
					return
				},
			},
			"getConfig": {
				MakeArg: func() interface{} {
					var ret [1]GetConfigArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]GetConfigArg)
					if !ok {
						err = rpc.NewTypeError((*[1]GetConfigArg)(nil), args)
						return
					}
					ret, err = i.GetConfig(ctx, typedArgs[0].SessionID)
					return
				},
			},
			"setUserConfig": {
				MakeArg: func() interface{} {
					var ret [1]SetUserConfigArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]SetUserConfigArg)
					if !ok {
						err = rpc.NewTypeError((*[1]SetUserConfigArg)(nil), args)
						return
					}
					err = i.SetUserConfig(ctx, typedArgs[0])
					return
				},
			},
			"setPath": {
				MakeArg: func() interface{} {
					var ret [1]SetPathArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]SetPathArg)
					if !ok {
						err = rpc.NewTypeError((*[1]SetPathArg)(nil), args)
						return
					}
					err = i.SetPath(ctx, typedArgs[0])
					return
				},
			},
			"helloIAm": {
				MakeArg: func() interface{} {
					var ret [1]HelloIAmArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]HelloIAmArg)
					if !ok {
						err = rpc.NewTypeError((*[1]HelloIAmArg)(nil), args)
						return
					}
					err = i.HelloIAm(ctx, typedArgs[0].Details)
					return
				},
			},
			"setValue": {
				MakeArg: func() interface{} {
					var ret [1]SetValueArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]SetValueArg)
					if !ok {
						err = rpc.NewTypeError((*[1]SetValueArg)(nil), args)
						return
					}
					err = i.SetValue(ctx, typedArgs[0])
					return
				},
			},
			"clearValue": {
				MakeArg: func() interface{} {
					var ret [1]ClearValueArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]ClearValueArg)
					if !ok {
						err = rpc.NewTypeError((*[1]ClearValueArg)(nil), args)
						return
					}
					err = i.ClearValue(ctx, typedArgs[0].Path)
					return
				},
			},
			"getValue": {
				MakeArg: func() interface{} {
					var ret [1]GetValueArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]GetValueArg)
					if !ok {
						err = rpc.NewTypeError((*[1]GetValueArg)(nil), args)
						return
					}
					ret, err = i.GetValue(ctx, typedArgs[0].Path)
					return
				},
			},
			"guiSetValue": {
				MakeArg: func() interface{} {
					var ret [1]GuiSetValueArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]GuiSetValueArg)
					if !ok {
						err = rpc.NewTypeError((*[1]GuiSetValueArg)(nil), args)
						return
					}
					err = i.GuiSetValue(ctx, typedArgs[0])
					return
				},
			},
			"guiClearValue": {
				MakeArg: func() interface{} {
					var ret [1]GuiClearValueArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]GuiClearValueArg)
					if !ok {
						err = rpc.NewTypeError((*[1]GuiClearValueArg)(nil), args)
						return
					}
					err = i.GuiClearValue(ctx, typedArgs[0].Path)
					return
				},
			},
			"guiGetValue": {
				MakeArg: func() interface{} {
					var ret [1]GuiGetValueArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]GuiGetValueArg)
					if !ok {
						err = rpc.NewTypeError((*[1]GuiGetValueArg)(nil), args)
						return
					}
					ret, err = i.GuiGetValue(ctx, typedArgs[0].Path)
					return
				},
			},
			"checkAPIServerOutOfDateWarning": {
				MakeArg: func() interface{} {
					var ret [1]CheckAPIServerOutOfDateWarningArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					ret, err = i.CheckAPIServerOutOfDateWarning(ctx)
					return
				},
			},
			"getUpdateInfo": {
				MakeArg: func() interface{} {
					var ret [1]GetUpdateInfoArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					ret, err = i.GetUpdateInfo(ctx)
					return
				},
			},
			"startUpdateIfNeeded": {
				MakeArg: func() interface{} {
					var ret [1]StartUpdateIfNeededArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					err = i.StartUpdateIfNeeded(ctx)
					return
				},
			},
			"waitForClient": {
				MakeArg: func() interface{} {
					var ret [1]WaitForClientArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]WaitForClientArg)
					if !ok {
						err = rpc.NewTypeError((*[1]WaitForClientArg)(nil), args)
						return
					}
					ret, err = i.WaitForClient(ctx, typedArgs[0])
					return
				},
			},
			"getBootstrapStatus": {
				MakeArg: func() interface{} {
					var ret [1]GetBootstrapStatusArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]GetBootstrapStatusArg)
					if !ok {
						err = rpc.NewTypeError((*[1]GetBootstrapStatusArg)(nil), args)
						return
					}
					ret, err = i.GetBootstrapStatus(ctx, typedArgs[0].SessionID)
					return
				},
			},
			"requestFollowingAndUnverifiedFollowers": {
				MakeArg: func() interface{} {
					var ret [1]RequestFollowingAndUnverifiedFollowersArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]RequestFollowingAndUnverifiedFollowersArg)
					if !ok {
						err = rpc.NewTypeError((*[1]RequestFollowingAndUnverifiedFollowersArg)(nil), args)
						return
					}
					err = i.RequestFollowingAndUnverifiedFollowers(ctx, typedArgs[0].SessionID)
					return
				},
			},
			"getRememberPassphrase": {
				MakeArg: func() interface{} {
					var ret [1]GetRememberPassphraseArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]GetRememberPassphraseArg)
					if !ok {
						err = rpc.NewTypeError((*[1]GetRememberPassphraseArg)(nil), args)
						return
					}
					ret, err = i.GetRememberPassphrase(ctx, typedArgs[0].SessionID)
					return
				},
			},
			"setRememberPassphrase": {
				MakeArg: func() interface{} {
					var ret [1]SetRememberPassphraseArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]SetRememberPassphraseArg)
					if !ok {
						err = rpc.NewTypeError((*[1]SetRememberPassphraseArg)(nil), args)
						return
					}
					err = i.SetRememberPassphrase(ctx, typedArgs[0])
					return
				},
			},
			"getUpdateInfo2": {
				MakeArg: func() interface{} {
					var ret [1]GetUpdateInfo2Arg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]GetUpdateInfo2Arg)
					if !ok {
						err = rpc.NewTypeError((*[1]GetUpdateInfo2Arg)(nil), args)
						return
					}
					ret, err = i.GetUpdateInfo2(ctx, typedArgs[0])
					return
				},
			},
			"setProxyData": {
				MakeArg: func() interface{} {
					var ret [1]SetProxyDataArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]SetProxyDataArg)
					if !ok {
						err = rpc.NewTypeError((*[1]SetProxyDataArg)(nil), args)
						return
					}
					err = i.SetProxyData(ctx, typedArgs[0].ProxyData)
					return
				},
			},
			"getProxyData": {
				MakeArg: func() interface{} {
					var ret [1]GetProxyDataArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					ret, err = i.GetProxyData(ctx)
					return
				},
			},
			"toggleRuntimeStats": {
				MakeArg: func() interface{} {
					var ret [1]ToggleRuntimeStatsArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					err = i.ToggleRuntimeStats(ctx)
					return
				},
			},
			"appendGUILogs": {
				MakeArg: func() interface{} {
					var ret [1]AppendGUILogsArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]AppendGUILogsArg)
					if !ok {
						err = rpc.NewTypeError((*[1]AppendGUILogsArg)(nil), args)
						return
					}
					err = i.AppendGUILogs(ctx, typedArgs[0].Content)
					return
				},
			},
			"generateWebAuthToken": {
				MakeArg: func() interface{} {
					var ret [1]GenerateWebAuthTokenArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					ret, err = i.GenerateWebAuthToken(ctx)
					return
				},
			},
			"updateLastLoggedInAndServerConfig": {
				MakeArg: func() interface{} {
					var ret [1]UpdateLastLoggedInAndServerConfigArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]UpdateLastLoggedInAndServerConfigArg)
					if !ok {
						err = rpc.NewTypeError((*[1]UpdateLastLoggedInAndServerConfigArg)(nil), args)
						return
					}
					err = i.UpdateLastLoggedInAndServerConfig(ctx, typedArgs[0].ServerConfigPath)
					return
				},
			},
		},
	}
}

type ConfigClient struct {
	Cli rpc.GenericClient
}

func (c ConfigClient) GetCurrentStatus(ctx context.Context, sessionID int) (res CurrentStatus, err error) {
	__arg := GetCurrentStatusArg{SessionID: sessionID}
	err = c.Cli.Call(ctx, "keybase.1.config.getCurrentStatus", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c ConfigClient) GetClientStatus(ctx context.Context, sessionID int) (res []ClientStatus, err error) {
	__arg := GetClientStatusArg{SessionID: sessionID}
	err = c.Cli.Call(ctx, "keybase.1.config.getClientStatus", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c ConfigClient) GetFullStatus(ctx context.Context, sessionID int) (res *FullStatus, err error) {
	__arg := GetFullStatusArg{SessionID: sessionID}
	err = c.Cli.Call(ctx, "keybase.1.config.getFullStatus", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c ConfigClient) IsServiceRunning(ctx context.Context, sessionID int) (res bool, err error) {
	__arg := IsServiceRunningArg{SessionID: sessionID}
	err = c.Cli.Call(ctx, "keybase.1.config.isServiceRunning", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c ConfigClient) IsKBFSRunning(ctx context.Context, sessionID int) (res bool, err error) {
	__arg := IsKBFSRunningArg{SessionID: sessionID}
	err = c.Cli.Call(ctx, "keybase.1.config.isKBFSRunning", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c ConfigClient) GetNetworkStats(ctx context.Context, __arg GetNetworkStatsArg) (res []InstrumentationStat, err error) {
	err = c.Cli.Call(ctx, "keybase.1.config.getNetworkStats", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c ConfigClient) LogSend(ctx context.Context, __arg LogSendArg) (res LogSendID, err error) {
	err = c.Cli.Call(ctx, "keybase.1.config.logSend", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c ConfigClient) GetAllProvisionedUsernames(ctx context.Context, sessionID int) (res AllProvisionedUsernames, err error) {
	__arg := GetAllProvisionedUsernamesArg{SessionID: sessionID}
	err = c.Cli.Call(ctx, "keybase.1.config.getAllProvisionedUsernames", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c ConfigClient) GetConfig(ctx context.Context, sessionID int) (res Config, err error) {
	__arg := GetConfigArg{SessionID: sessionID}
	err = c.Cli.Call(ctx, "keybase.1.config.getConfig", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

// Change user config.
// For example, to update primary picture source:
// key=picture.source, value=twitter (or github)
func (c ConfigClient) SetUserConfig(ctx context.Context, __arg SetUserConfigArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.config.setUserConfig", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c ConfigClient) SetPath(ctx context.Context, __arg SetPathArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.config.setPath", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c ConfigClient) HelloIAm(ctx context.Context, details ClientDetails) (err error) {
	__arg := HelloIAmArg{Details: details}
	err = c.Cli.Call(ctx, "keybase.1.config.helloIAm", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c ConfigClient) SetValue(ctx context.Context, __arg SetValueArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.config.setValue", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c ConfigClient) ClearValue(ctx context.Context, path string) (err error) {
	__arg := ClearValueArg{Path: path}
	err = c.Cli.Call(ctx, "keybase.1.config.clearValue", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c ConfigClient) GetValue(ctx context.Context, path string) (res ConfigValue, err error) {
	__arg := GetValueArg{Path: path}
	err = c.Cli.Call(ctx, "keybase.1.config.getValue", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c ConfigClient) GuiSetValue(ctx context.Context, __arg GuiSetValueArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.config.guiSetValue", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c ConfigClient) GuiClearValue(ctx context.Context, path string) (err error) {
	__arg := GuiClearValueArg{Path: path}
	err = c.Cli.Call(ctx, "keybase.1.config.guiClearValue", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c ConfigClient) GuiGetValue(ctx context.Context, path string) (res ConfigValue, err error) {
	__arg := GuiGetValueArg{Path: path}
	err = c.Cli.Call(ctx, "keybase.1.config.guiGetValue", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

// Check whether the API server has told us we're out of date.
func (c ConfigClient) CheckAPIServerOutOfDateWarning(ctx context.Context) (res OutOfDateInfo, err error) {
	err = c.Cli.Call(ctx, "keybase.1.config.checkAPIServerOutOfDateWarning", []interface{}{CheckAPIServerOutOfDateWarningArg{}}, &res, 0*time.Millisecond)
	return
}

func (c ConfigClient) GetUpdateInfo(ctx context.Context) (res UpdateInfo, err error) {
	err = c.Cli.Call(ctx, "keybase.1.config.getUpdateInfo", []interface{}{GetUpdateInfoArg{}}, &res, 0*time.Millisecond)
	return
}

func (c ConfigClient) StartUpdateIfNeeded(ctx context.Context) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.config.startUpdateIfNeeded", []interface{}{StartUpdateIfNeededArg{}}, nil, 0*time.Millisecond)
	return
}

// Wait for client type to connect to service.
func (c ConfigClient) WaitForClient(ctx context.Context, __arg WaitForClientArg) (res bool, err error) {
	err = c.Cli.Call(ctx, "keybase.1.config.waitForClient", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c ConfigClient) GetBootstrapStatus(ctx context.Context, sessionID int) (res BootstrapStatus, err error) {
	__arg := GetBootstrapStatusArg{SessionID: sessionID}
	err = c.Cli.Call(ctx, "keybase.1.config.getBootstrapStatus", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c ConfigClient) RequestFollowingAndUnverifiedFollowers(ctx context.Context, sessionID int) (err error) {
	__arg := RequestFollowingAndUnverifiedFollowersArg{SessionID: sessionID}
	err = c.Cli.Call(ctx, "keybase.1.config.requestFollowingAndUnverifiedFollowers", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c ConfigClient) GetRememberPassphrase(ctx context.Context, sessionID int) (res bool, err error) {
	__arg := GetRememberPassphraseArg{SessionID: sessionID}
	err = c.Cli.Call(ctx, "keybase.1.config.getRememberPassphrase", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c ConfigClient) SetRememberPassphrase(ctx context.Context, __arg SetRememberPassphraseArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.config.setRememberPassphrase", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

// getUpdateInfo2 is to drive the redbar on mobile and desktop apps. The redbar tells you if
// you are critically out of date.
func (c ConfigClient) GetUpdateInfo2(ctx context.Context, __arg GetUpdateInfo2Arg) (res UpdateInfo2, err error) {
	err = c.Cli.Call(ctx, "keybase.1.config.getUpdateInfo2", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c ConfigClient) SetProxyData(ctx context.Context, proxyData ProxyData) (err error) {
	__arg := SetProxyDataArg{ProxyData: proxyData}
	err = c.Cli.Call(ctx, "keybase.1.config.setProxyData", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c ConfigClient) GetProxyData(ctx context.Context) (res ProxyData, err error) {
	err = c.Cli.Call(ctx, "keybase.1.config.getProxyData", []interface{}{GetProxyDataArg{}}, &res, 0*time.Millisecond)
	return
}

func (c ConfigClient) ToggleRuntimeStats(ctx context.Context) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.config.toggleRuntimeStats", []interface{}{ToggleRuntimeStatsArg{}}, nil, 0*time.Millisecond)
	return
}

func (c ConfigClient) AppendGUILogs(ctx context.Context, content string) (err error) {
	__arg := AppendGUILogsArg{Content: content}
	err = c.Cli.Call(ctx, "keybase.1.config.appendGUILogs", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c ConfigClient) GenerateWebAuthToken(ctx context.Context) (res string, err error) {
	err = c.Cli.Call(ctx, "keybase.1.config.generateWebAuthToken", []interface{}{GenerateWebAuthTokenArg{}}, &res, 0*time.Millisecond)
	return
}

func (c ConfigClient) UpdateLastLoggedInAndServerConfig(ctx context.Context, serverConfigPath string) (err error) {
	__arg := UpdateLastLoggedInAndServerConfigArg{ServerConfigPath: serverConfigPath}
	err = c.Cli.Call(ctx, "keybase.1.config.updateLastLoggedInAndServerConfig", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}
