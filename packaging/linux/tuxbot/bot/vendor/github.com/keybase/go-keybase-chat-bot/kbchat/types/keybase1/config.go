// Auto-generated to Go types using avdl-compiler v1.4.6 (https://github.com/keybase/node-avdl-compiler)
//   Input file: ../client/protocol/avdl/keybase1/config.avdl

package keybase1

import (
	"errors"
	"fmt"
)

type CurrentStatus struct {
	Configured     bool  `codec:"configured" json:"configured"`
	Registered     bool  `codec:"registered" json:"registered"`
	LoggedIn       bool  `codec:"loggedIn" json:"loggedIn"`
	SessionIsValid bool  `codec:"sessionIsValid" json:"sessionIsValid"`
	User           *User `codec:"user,omitempty" json:"user,omitempty"`
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
}

func (o KbServiceStatus) DeepCopy() KbServiceStatus {
	return KbServiceStatus{
		Version: o.Version,
		Running: o.Running,
		Pid:     o.Pid,
		Log:     o.Log,
		EkLog:   o.EkLog,
	}
}

type KBFSStatus struct {
	Version          string `codec:"version" json:"version"`
	InstalledVersion string `codec:"installedVersion" json:"installedVersion"`
	Running          bool   `codec:"running" json:"running"`
	Pid              string `codec:"pid" json:"pid"`
	Log              string `codec:"log" json:"log"`
	Mount            string `codec:"mount" json:"mount"`
}

func (o KBFSStatus) DeepCopy() KBFSStatus {
	return KBFSStatus{
		Version:          o.Version,
		InstalledVersion: o.InstalledVersion,
		Running:          o.Running,
		Pid:              o.Pid,
		Log:              o.Log,
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
	Log string `codec:"log" json:"log"`
}

func (o GitStatus) DeepCopy() GitStatus {
	return GitStatus{
		Log: o.Log,
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
