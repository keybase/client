package keybase1

import (
	rpc "github.com/keybase/go-framed-msgpack-rpc"
	context "golang.org/x/net/context"
)

type GenericClient interface {
	Call(ctx context.Context, s string, args interface{}, res interface{}) error
	Notify(ctx context.Context, s string, args interface{}) error
}

type Feature struct {
	Allow        bool   `codec:"allow" json:"allow"`
	DefaultValue bool   `codec:"defaultValue" json:"defaultValue"`
	Readonly     bool   `codec:"readonly" json:"readonly"`
	Label        string `codec:"label" json:"label"`
}

type GUIEntryFeatures struct {
	StoreSecret Feature `codec:"storeSecret" json:"storeSecret"`
	ShowTyping  Feature `codec:"showTyping" json:"showTyping"`
}

type PassphraseType int

const (
	PassphraseType_NONE               PassphraseType = 0
	PassphraseType_PAPER_KEY          PassphraseType = 1
	PassphraseType_PASS_PHRASE        PassphraseType = 2
	PassphraseType_VERIFY_PASS_PHRASE PassphraseType = 3
)

type GUIEntryArg struct {
	WindowTitle string           `codec:"windowTitle" json:"windowTitle"`
	Prompt      string           `codec:"prompt" json:"prompt"`
	SubmitLabel string           `codec:"submitLabel" json:"submitLabel"`
	CancelLabel string           `codec:"cancelLabel" json:"cancelLabel"`
	RetryLabel  string           `codec:"retryLabel" json:"retryLabel"`
	Type        PassphraseType   `codec:"type" json:"type"`
	Features    GUIEntryFeatures `codec:"features" json:"features"`
}

type GetPassphraseRes struct {
	Passphrase  string `codec:"passphrase" json:"passphrase"`
	StoreSecret bool   `codec:"storeSecret" json:"storeSecret"`
}

type PassphraseChangeArg struct {
	SessionID     int    `codec:"sessionID" json:"sessionID"`
	OldPassphrase string `codec:"oldPassphrase" json:"oldPassphrase"`
	Passphrase    string `codec:"passphrase" json:"passphrase"`
	Force         bool   `codec:"force" json:"force"`
}

type PassphrasePromptArg struct {
	SessionID int         `codec:"sessionID" json:"sessionID"`
	GuiArg    GUIEntryArg `codec:"guiArg" json:"guiArg"`
}

type AccountInterface interface {
	PassphraseChange(context.Context, PassphraseChangeArg) error
	PassphrasePrompt(context.Context, PassphrasePromptArg) (GetPassphraseRes, error)
}

func AccountProtocol(i AccountInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.account",
		Methods: map[string]rpc.ServeHandlerDescription{
			"passphraseChange": {
				MakeArg: func() interface{} {
					ret := make([]PassphraseChangeArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]PassphraseChangeArg)
					if !ok {
						err = rpc.NewTypeError((*[]PassphraseChangeArg)(nil), args)
						return
					}
					err = i.PassphraseChange(ctx, (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"passphrasePrompt": {
				MakeArg: func() interface{} {
					ret := make([]PassphrasePromptArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]PassphrasePromptArg)
					if !ok {
						err = rpc.NewTypeError((*[]PassphrasePromptArg)(nil), args)
						return
					}
					ret, err = i.PassphrasePrompt(ctx, (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
		},
	}
}

type AccountClient struct {
	Cli GenericClient
}

func (c AccountClient) PassphraseChange(ctx context.Context, __arg PassphraseChangeArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.account.passphraseChange", []interface{}{__arg}, nil)
	return
}

func (c AccountClient) PassphrasePrompt(ctx context.Context, __arg PassphrasePromptArg) (res GetPassphraseRes, err error) {
	err = c.Cli.Call(ctx, "keybase.1.account.passphrasePrompt", []interface{}{__arg}, &res)
	return
}

type Time int64
type StringKVPair struct {
	Key   string `codec:"key" json:"key"`
	Value string `codec:"value" json:"value"`
}

type Status struct {
	Code   int            `codec:"code" json:"code"`
	Name   string         `codec:"name" json:"name"`
	Desc   string         `codec:"desc" json:"desc"`
	Fields []StringKVPair `codec:"fields" json:"fields"`
}

type UID string
type DeviceID string
type SigID string
type KID string
type Text struct {
	Data   string `codec:"data" json:"data"`
	Markup bool   `codec:"markup" json:"markup"`
}

type PGPIdentity struct {
	Username string `codec:"username" json:"username"`
	Comment  string `codec:"comment" json:"comment"`
	Email    string `codec:"email" json:"email"`
}

type PublicKey struct {
	KID               KID           `codec:"KID" json:"KID"`
	PGPFingerprint    string        `codec:"PGPFingerprint" json:"PGPFingerprint"`
	PGPIdentities     []PGPIdentity `codec:"PGPIdentities" json:"PGPIdentities"`
	IsSibkey          bool          `codec:"isSibkey" json:"isSibkey"`
	IsEldest          bool          `codec:"isEldest" json:"isEldest"`
	ParentID          string        `codec:"parentID" json:"parentID"`
	DeviceID          DeviceID      `codec:"deviceID" json:"deviceID"`
	DeviceDescription string        `codec:"deviceDescription" json:"deviceDescription"`
	DeviceType        string        `codec:"deviceType" json:"deviceType"`
	CTime             Time          `codec:"cTime" json:"cTime"`
	ETime             Time          `codec:"eTime" json:"eTime"`
}

type User struct {
	Uid      UID    `codec:"uid" json:"uid"`
	Username string `codec:"username" json:"username"`
}

type Device struct {
	Type       string   `codec:"type" json:"type"`
	Name       string   `codec:"name" json:"name"`
	DeviceID   DeviceID `codec:"deviceID" json:"deviceID"`
	CTime      Time     `codec:"cTime" json:"cTime"`
	MTime      Time     `codec:"mTime" json:"mTime"`
	EncryptKey KID      `codec:"encryptKey" json:"encryptKey"`
	VerifyKey  KID      `codec:"verifyKey" json:"verifyKey"`
	Status     int      `codec:"status" json:"status"`
}

type Stream struct {
	Fd int `codec:"fd" json:"fd"`
}

type LogLevel int

const (
	LogLevel_NONE     LogLevel = 0
	LogLevel_DEBUG    LogLevel = 1
	LogLevel_INFO     LogLevel = 2
	LogLevel_NOTICE   LogLevel = 3
	LogLevel_WARN     LogLevel = 4
	LogLevel_ERROR    LogLevel = 5
	LogLevel_CRITICAL LogLevel = 6
	LogLevel_FATAL    LogLevel = 7
)

type ClientType int

const (
	ClientType_NONE ClientType = 0
	ClientType_CLI  ClientType = 1
	ClientType_GUI  ClientType = 2
	ClientType_KBFS ClientType = 3
)

type UserVersionVector struct {
	Id               int64 `codec:"id" json:"id"`
	SigHints         int   `codec:"sigHints" json:"sigHints"`
	SigChain         int64 `codec:"sigChain" json:"sigChain"`
	CachedAt         Time  `codec:"cachedAt" json:"cachedAt"`
	LastIdentifiedAt Time  `codec:"lastIdentifiedAt" json:"lastIdentifiedAt"`
}

type UserPlusKeys struct {
	Uid        UID               `codec:"uid" json:"uid"`
	Username   string            `codec:"username" json:"username"`
	DeviceKeys []PublicKey       `codec:"deviceKeys" json:"deviceKeys"`
	Keys       []PublicKey       `codec:"keys" json:"keys"`
	Uvv        UserVersionVector `codec:"uvv" json:"uvv"`
}

type BlockIdCombo struct {
	BlockHash string `codec:"blockHash" json:"blockHash"`
	ChargedTo UID    `codec:"chargedTo" json:"chargedTo"`
}

type ChallengeInfo struct {
	Now       int64  `codec:"now" json:"now"`
	Challenge string `codec:"challenge" json:"challenge"`
}

type GetBlockRes struct {
	BlockKey string `codec:"blockKey" json:"blockKey"`
	Buf      []byte `codec:"buf" json:"buf"`
}

type BlockRefNonce [8]byte
type BlockReference struct {
	Bid       BlockIdCombo  `codec:"bid" json:"bid"`
	Nonce     BlockRefNonce `codec:"nonce" json:"nonce"`
	ChargedTo UID           `codec:"chargedTo" json:"chargedTo"`
}

type GetSessionChallengeArg struct {
}

type AuthenticateSessionArg struct {
	Signature string `codec:"signature" json:"signature"`
}

type PutBlockArg struct {
	Bid      BlockIdCombo `codec:"bid" json:"bid"`
	Folder   string       `codec:"folder" json:"folder"`
	BlockKey string       `codec:"blockKey" json:"blockKey"`
	Buf      []byte       `codec:"buf" json:"buf"`
}

type GetBlockArg struct {
	Bid    BlockIdCombo `codec:"bid" json:"bid"`
	Folder string       `codec:"folder" json:"folder"`
}

type AddReferenceArg struct {
	Folder string         `codec:"folder" json:"folder"`
	Ref    BlockReference `codec:"ref" json:"ref"`
}

type DelReferenceArg struct {
	Folder string         `codec:"folder" json:"folder"`
	Ref    BlockReference `codec:"ref" json:"ref"`
}

type ArchiveReferenceArg struct {
	Folder string           `codec:"folder" json:"folder"`
	Refs   []BlockReference `codec:"refs" json:"refs"`
}

type GetUserQuotaInfoArg struct {
}

type BlockInterface interface {
	GetSessionChallenge(context.Context) (ChallengeInfo, error)
	AuthenticateSession(context.Context, string) error
	PutBlock(context.Context, PutBlockArg) error
	GetBlock(context.Context, GetBlockArg) (GetBlockRes, error)
	AddReference(context.Context, AddReferenceArg) error
	DelReference(context.Context, DelReferenceArg) error
	ArchiveReference(context.Context, ArchiveReferenceArg) ([]BlockReference, error)
	GetUserQuotaInfo(context.Context) ([]byte, error)
}

func BlockProtocol(i BlockInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.block",
		Methods: map[string]rpc.ServeHandlerDescription{
			"getSessionChallenge": {
				MakeArg: func() interface{} {
					ret := make([]GetSessionChallengeArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					ret, err = i.GetSessionChallenge(ctx)
					return
				},
				MethodType: rpc.MethodCall,
			},
			"authenticateSession": {
				MakeArg: func() interface{} {
					ret := make([]AuthenticateSessionArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]AuthenticateSessionArg)
					if !ok {
						err = rpc.NewTypeError((*[]AuthenticateSessionArg)(nil), args)
						return
					}
					err = i.AuthenticateSession(ctx, (*typedArgs)[0].Signature)
					return
				},
				MethodType: rpc.MethodCall,
			},
			"putBlock": {
				MakeArg: func() interface{} {
					ret := make([]PutBlockArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]PutBlockArg)
					if !ok {
						err = rpc.NewTypeError((*[]PutBlockArg)(nil), args)
						return
					}
					err = i.PutBlock(ctx, (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"getBlock": {
				MakeArg: func() interface{} {
					ret := make([]GetBlockArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]GetBlockArg)
					if !ok {
						err = rpc.NewTypeError((*[]GetBlockArg)(nil), args)
						return
					}
					ret, err = i.GetBlock(ctx, (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"addReference": {
				MakeArg: func() interface{} {
					ret := make([]AddReferenceArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]AddReferenceArg)
					if !ok {
						err = rpc.NewTypeError((*[]AddReferenceArg)(nil), args)
						return
					}
					err = i.AddReference(ctx, (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"delReference": {
				MakeArg: func() interface{} {
					ret := make([]DelReferenceArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]DelReferenceArg)
					if !ok {
						err = rpc.NewTypeError((*[]DelReferenceArg)(nil), args)
						return
					}
					err = i.DelReference(ctx, (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"archiveReference": {
				MakeArg: func() interface{} {
					ret := make([]ArchiveReferenceArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]ArchiveReferenceArg)
					if !ok {
						err = rpc.NewTypeError((*[]ArchiveReferenceArg)(nil), args)
						return
					}
					ret, err = i.ArchiveReference(ctx, (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"getUserQuotaInfo": {
				MakeArg: func() interface{} {
					ret := make([]GetUserQuotaInfoArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					ret, err = i.GetUserQuotaInfo(ctx)
					return
				},
				MethodType: rpc.MethodCall,
			},
		},
	}
}

type BlockClient struct {
	Cli GenericClient
}

func (c BlockClient) GetSessionChallenge(ctx context.Context) (res ChallengeInfo, err error) {
	err = c.Cli.Call(ctx, "keybase.1.block.getSessionChallenge", []interface{}{GetSessionChallengeArg{}}, &res)
	return
}

func (c BlockClient) AuthenticateSession(ctx context.Context, signature string) (err error) {
	__arg := AuthenticateSessionArg{Signature: signature}
	err = c.Cli.Call(ctx, "keybase.1.block.authenticateSession", []interface{}{__arg}, nil)
	return
}

func (c BlockClient) PutBlock(ctx context.Context, __arg PutBlockArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.block.putBlock", []interface{}{__arg}, nil)
	return
}

func (c BlockClient) GetBlock(ctx context.Context, __arg GetBlockArg) (res GetBlockRes, err error) {
	err = c.Cli.Call(ctx, "keybase.1.block.getBlock", []interface{}{__arg}, &res)
	return
}

func (c BlockClient) AddReference(ctx context.Context, __arg AddReferenceArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.block.addReference", []interface{}{__arg}, nil)
	return
}

func (c BlockClient) DelReference(ctx context.Context, __arg DelReferenceArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.block.delReference", []interface{}{__arg}, nil)
	return
}

func (c BlockClient) ArchiveReference(ctx context.Context, __arg ArchiveReferenceArg) (res []BlockReference, err error) {
	err = c.Cli.Call(ctx, "keybase.1.block.archiveReference", []interface{}{__arg}, &res)
	return
}

func (c BlockClient) GetUserQuotaInfo(ctx context.Context) (res []byte, err error) {
	err = c.Cli.Call(ctx, "keybase.1.block.getUserQuotaInfo", []interface{}{GetUserQuotaInfoArg{}}, &res)
	return
}

type RegisterBTCArg struct {
	SessionID int    `codec:"sessionID" json:"sessionID"`
	Address   string `codec:"address" json:"address"`
	Force     bool   `codec:"force" json:"force"`
}

type BTCInterface interface {
	RegisterBTC(context.Context, RegisterBTCArg) error
}

func BTCProtocol(i BTCInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.BTC",
		Methods: map[string]rpc.ServeHandlerDescription{
			"registerBTC": {
				MakeArg: func() interface{} {
					ret := make([]RegisterBTCArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]RegisterBTCArg)
					if !ok {
						err = rpc.NewTypeError((*[]RegisterBTCArg)(nil), args)
						return
					}
					err = i.RegisterBTC(ctx, (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
		},
	}
}

type BTCClient struct {
	Cli GenericClient
}

func (c BTCClient) RegisterBTC(ctx context.Context, __arg RegisterBTCArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.BTC.registerBTC", []interface{}{__arg}, nil)
	return
}

type GetCurrentStatusRes struct {
	Configured bool  `codec:"configured" json:"configured"`
	Registered bool  `codec:"registered" json:"registered"`
	LoggedIn   bool  `codec:"loggedIn" json:"loggedIn"`
	User       *User `codec:"user,omitempty" json:"user,omitempty"`
}

type SessionStatus struct {
	SessionFor string `codec:"SessionFor" json:"SessionFor"`
	Loaded     bool   `codec:"Loaded" json:"Loaded"`
	Cleared    bool   `codec:"Cleared" json:"Cleared"`
	SaltOnly   bool   `codec:"SaltOnly" json:"SaltOnly"`
	Expired    bool   `codec:"Expired" json:"Expired"`
}

type ClientDetails struct {
	Pid        int        `codec:"pid" json:"pid"`
	ClientType ClientType `codec:"clientType" json:"clientType"`
	Argv       []string   `codec:"argv" json:"argv"`
	Desc       string     `codec:"desc" json:"desc"`
	Version    string     `codec:"version" json:"version"`
}

type PlatformInfo struct {
	Os        string `codec:"os" json:"os"`
	Arch      string `codec:"arch" json:"arch"`
	GoVersion string `codec:"goVersion" json:"goVersion"`
}

type ExtendedStatus struct {
	Standalone             bool            `codec:"standalone" json:"standalone"`
	PassphraseStreamCached bool            `codec:"passphraseStreamCached" json:"passphraseStreamCached"`
	Device                 *Device         `codec:"device,omitempty" json:"device,omitempty"`
	LogDir                 string          `codec:"logDir" json:"logDir"`
	DesktopUIConnected     bool            `codec:"desktopUIConnected" json:"desktopUIConnected"`
	Session                *SessionStatus  `codec:"session,omitempty" json:"session,omitempty"`
	DefaultUsername        string          `codec:"defaultUsername" json:"defaultUsername"`
	ProvisionedUsernames   []string        `codec:"provisionedUsernames" json:"provisionedUsernames"`
	Clients                []ClientDetails `codec:"Clients" json:"Clients"`
	PlatformInfo           PlatformInfo    `codec:"platformInfo" json:"platformInfo"`
}

type ForkType int

const (
	ForkType_NONE     ForkType = 0
	ForkType_AUTO     ForkType = 1
	ForkType_WATCHDOG ForkType = 2
	ForkType_LAUNCHD  ForkType = 3
)

type Config struct {
	ServerURI    string   `codec:"serverURI" json:"serverURI"`
	SocketFile   string   `codec:"socketFile" json:"socketFile"`
	Label        string   `codec:"label" json:"label"`
	RunMode      string   `codec:"runMode" json:"runMode"`
	GpgExists    bool     `codec:"gpgExists" json:"gpgExists"`
	GpgPath      string   `codec:"gpgPath" json:"gpgPath"`
	Version      string   `codec:"version" json:"version"`
	Path         string   `codec:"path" json:"path"`
	ConfigPath   string   `codec:"configPath" json:"configPath"`
	VersionShort string   `codec:"versionShort" json:"versionShort"`
	VersionFull  string   `codec:"versionFull" json:"versionFull"`
	IsAutoForked bool     `codec:"isAutoForked" json:"isAutoForked"`
	ForkType     ForkType `codec:"forkType" json:"forkType"`
}

type GetCurrentStatusArg struct {
	SessionID int `codec:"sessionID" json:"sessionID"`
}

type GetExtendedStatusArg struct {
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

type ConfigInterface interface {
	GetCurrentStatus(context.Context, int) (GetCurrentStatusRes, error)
	GetExtendedStatus(context.Context, int) (ExtendedStatus, error)
	GetConfig(context.Context, int) (Config, error)
	SetUserConfig(context.Context, SetUserConfigArg) error
	SetPath(context.Context, SetPathArg) error
	HelloIAm(context.Context, ClientDetails) error
}

func ConfigProtocol(i ConfigInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.config",
		Methods: map[string]rpc.ServeHandlerDescription{
			"getCurrentStatus": {
				MakeArg: func() interface{} {
					ret := make([]GetCurrentStatusArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]GetCurrentStatusArg)
					if !ok {
						err = rpc.NewTypeError((*[]GetCurrentStatusArg)(nil), args)
						return
					}
					ret, err = i.GetCurrentStatus(ctx, (*typedArgs)[0].SessionID)
					return
				},
				MethodType: rpc.MethodCall,
			},
			"getExtendedStatus": {
				MakeArg: func() interface{} {
					ret := make([]GetExtendedStatusArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]GetExtendedStatusArg)
					if !ok {
						err = rpc.NewTypeError((*[]GetExtendedStatusArg)(nil), args)
						return
					}
					ret, err = i.GetExtendedStatus(ctx, (*typedArgs)[0].SessionID)
					return
				},
				MethodType: rpc.MethodCall,
			},
			"getConfig": {
				MakeArg: func() interface{} {
					ret := make([]GetConfigArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]GetConfigArg)
					if !ok {
						err = rpc.NewTypeError((*[]GetConfigArg)(nil), args)
						return
					}
					ret, err = i.GetConfig(ctx, (*typedArgs)[0].SessionID)
					return
				},
				MethodType: rpc.MethodCall,
			},
			"setUserConfig": {
				MakeArg: func() interface{} {
					ret := make([]SetUserConfigArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]SetUserConfigArg)
					if !ok {
						err = rpc.NewTypeError((*[]SetUserConfigArg)(nil), args)
						return
					}
					err = i.SetUserConfig(ctx, (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"setPath": {
				MakeArg: func() interface{} {
					ret := make([]SetPathArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]SetPathArg)
					if !ok {
						err = rpc.NewTypeError((*[]SetPathArg)(nil), args)
						return
					}
					err = i.SetPath(ctx, (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"helloIAm": {
				MakeArg: func() interface{} {
					ret := make([]HelloIAmArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]HelloIAmArg)
					if !ok {
						err = rpc.NewTypeError((*[]HelloIAmArg)(nil), args)
						return
					}
					err = i.HelloIAm(ctx, (*typedArgs)[0].Details)
					return
				},
				MethodType: rpc.MethodCall,
			},
		},
	}
}

type ConfigClient struct {
	Cli GenericClient
}

func (c ConfigClient) GetCurrentStatus(ctx context.Context, sessionID int) (res GetCurrentStatusRes, err error) {
	__arg := GetCurrentStatusArg{SessionID: sessionID}
	err = c.Cli.Call(ctx, "keybase.1.config.getCurrentStatus", []interface{}{__arg}, &res)
	return
}

func (c ConfigClient) GetExtendedStatus(ctx context.Context, sessionID int) (res ExtendedStatus, err error) {
	__arg := GetExtendedStatusArg{SessionID: sessionID}
	err = c.Cli.Call(ctx, "keybase.1.config.getExtendedStatus", []interface{}{__arg}, &res)
	return
}

func (c ConfigClient) GetConfig(ctx context.Context, sessionID int) (res Config, err error) {
	__arg := GetConfigArg{SessionID: sessionID}
	err = c.Cli.Call(ctx, "keybase.1.config.getConfig", []interface{}{__arg}, &res)
	return
}

func (c ConfigClient) SetUserConfig(ctx context.Context, __arg SetUserConfigArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.config.setUserConfig", []interface{}{__arg}, nil)
	return
}

func (c ConfigClient) SetPath(ctx context.Context, __arg SetPathArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.config.setPath", []interface{}{__arg}, nil)
	return
}

func (c ConfigClient) HelloIAm(ctx context.Context, details ClientDetails) (err error) {
	__arg := HelloIAmArg{Details: details}
	err = c.Cli.Call(ctx, "keybase.1.config.helloIAm", []interface{}{__arg}, nil)
	return
}

type StatusCode int

const (
	StatusCode_SCOk                     StatusCode = 0
	StatusCode_SCLoginRequired          StatusCode = 201
	StatusCode_SCBadSession             StatusCode = 202
	StatusCode_SCBadLoginUserNotFound   StatusCode = 203
	StatusCode_SCBadLoginPassword       StatusCode = 204
	StatusCode_SCNotFound               StatusCode = 205
	StatusCode_SCGeneric                StatusCode = 218
	StatusCode_SCAlreadyLoggedIn        StatusCode = 235
	StatusCode_SCCanceled               StatusCode = 237
	StatusCode_SCInputCanceled          StatusCode = 239
	StatusCode_SCReloginRequired        StatusCode = 274
	StatusCode_SCResolutionFailed       StatusCode = 275
	StatusCode_SCProfileNotPublic       StatusCode = 276
	StatusCode_SCIdentifyFailed         StatusCode = 277
	StatusCode_SCTrackingBroke          StatusCode = 278
	StatusCode_SCWrongCryptoFormat      StatusCode = 279
	StatusCode_SCBadSignupUsernameTaken StatusCode = 701
	StatusCode_SCMissingResult          StatusCode = 801
	StatusCode_SCKeyNotFound            StatusCode = 901
	StatusCode_SCKeyInUse               StatusCode = 907
	StatusCode_SCKeyBadGen              StatusCode = 913
	StatusCode_SCKeyNoSecret            StatusCode = 914
	StatusCode_SCKeyBadUIDs             StatusCode = 915
	StatusCode_SCKeyNoActive            StatusCode = 916
	StatusCode_SCKeyNoSig               StatusCode = 917
	StatusCode_SCKeyBadSig              StatusCode = 918
	StatusCode_SCKeyBadEldest           StatusCode = 919
	StatusCode_SCKeyNoEldest            StatusCode = 920
	StatusCode_SCKeyDuplicateUpdate     StatusCode = 921
	StatusCode_SCSibkeyAlreadyExists    StatusCode = 922
	StatusCode_SCDecryptionKeyNotFound  StatusCode = 924
	StatusCode_SCKeyNoPGPEncryption     StatusCode = 927
	StatusCode_SCKeyNoNaClEncryption    StatusCode = 928
	StatusCode_SCKeySyncedPGPNotFound   StatusCode = 929
	StatusCode_SCBadTrackSession        StatusCode = 1301
	StatusCode_SCDeviceNotFound         StatusCode = 1409
	StatusCode_SCDeviceMismatch         StatusCode = 1410
	StatusCode_SCDeviceRequired         StatusCode = 1411
	StatusCode_SCStreamExists           StatusCode = 1501
	StatusCode_SCStreamNotFound         StatusCode = 1502
	StatusCode_SCStreamWrongKind        StatusCode = 1503
	StatusCode_SCStreamEOF              StatusCode = 1504
	StatusCode_SCAPINetworkError        StatusCode = 1601
	StatusCode_SCTimeout                StatusCode = 1602
	StatusCode_SCProofError             StatusCode = 1701
	StatusCode_SCIdentificationExpired  StatusCode = 1702
	StatusCode_SCSelfNotFound           StatusCode = 1703
	StatusCode_SCBadKexPhrase           StatusCode = 1704
	StatusCode_SCNoUIDelegation         StatusCode = 1705
	StatusCode_SCNoUI                   StatusCode = 1706
	StatusCode_SCInvalidVersionError    StatusCode = 1800
	StatusCode_SCOldVersionError        StatusCode = 1801
	StatusCode_SCInvalidLocationError   StatusCode = 1802
	StatusCode_SCServiceStatusError     StatusCode = 1803
	StatusCode_SCInstallError           StatusCode = 1804
)

type ConstantsInterface interface {
}

func ConstantsProtocol(i ConstantsInterface) rpc.Protocol {
	return rpc.Protocol{
		Name:    "keybase.1.constants",
		Methods: map[string]rpc.ServeHandlerDescription{},
	}
}

type ConstantsClient struct {
	Cli GenericClient
}

type ED25519PublicKey [32]byte
type ED25519Signature [64]byte
type ED25519SignatureInfo struct {
	Sig       ED25519Signature `codec:"sig" json:"sig"`
	PublicKey ED25519PublicKey `codec:"publicKey" json:"publicKey"`
}

type Bytes32 [32]byte
type EncryptedBytes32 [48]byte
type BoxNonce [24]byte
type BoxPublicKey [32]byte
type CiphertextBundle struct {
	Kid        KID              `codec:"kid" json:"kid"`
	Ciphertext EncryptedBytes32 `codec:"ciphertext" json:"ciphertext"`
	Nonce      BoxNonce         `codec:"nonce" json:"nonce"`
	PublicKey  BoxPublicKey     `codec:"publicKey" json:"publicKey"`
}

type UnboxAnyRes struct {
	Kid       KID     `codec:"kid" json:"kid"`
	Plaintext Bytes32 `codec:"plaintext" json:"plaintext"`
	Index     int     `codec:"index" json:"index"`
}

type SignED25519Arg struct {
	SessionID int    `codec:"sessionID" json:"sessionID"`
	Msg       []byte `codec:"msg" json:"msg"`
	Reason    string `codec:"reason" json:"reason"`
}

type SignToStringArg struct {
	SessionID int    `codec:"sessionID" json:"sessionID"`
	Msg       []byte `codec:"msg" json:"msg"`
	Reason    string `codec:"reason" json:"reason"`
}

type UnboxBytes32Arg struct {
	SessionID        int              `codec:"sessionID" json:"sessionID"`
	EncryptedBytes32 EncryptedBytes32 `codec:"encryptedBytes32" json:"encryptedBytes32"`
	Nonce            BoxNonce         `codec:"nonce" json:"nonce"`
	PeersPublicKey   BoxPublicKey     `codec:"peersPublicKey" json:"peersPublicKey"`
	Reason           string           `codec:"reason" json:"reason"`
}

type UnboxBytes32AnyArg struct {
	SessionID   int                `codec:"sessionID" json:"sessionID"`
	Bundles     []CiphertextBundle `codec:"bundles" json:"bundles"`
	Reason      string             `codec:"reason" json:"reason"`
	PromptPaper bool               `codec:"promptPaper" json:"promptPaper"`
}

type CryptoInterface interface {
	SignED25519(context.Context, SignED25519Arg) (ED25519SignatureInfo, error)
	SignToString(context.Context, SignToStringArg) (string, error)
	UnboxBytes32(context.Context, UnboxBytes32Arg) (Bytes32, error)
	UnboxBytes32Any(context.Context, UnboxBytes32AnyArg) (UnboxAnyRes, error)
}

func CryptoProtocol(i CryptoInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.crypto",
		Methods: map[string]rpc.ServeHandlerDescription{
			"signED25519": {
				MakeArg: func() interface{} {
					ret := make([]SignED25519Arg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]SignED25519Arg)
					if !ok {
						err = rpc.NewTypeError((*[]SignED25519Arg)(nil), args)
						return
					}
					ret, err = i.SignED25519(ctx, (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"signToString": {
				MakeArg: func() interface{} {
					ret := make([]SignToStringArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]SignToStringArg)
					if !ok {
						err = rpc.NewTypeError((*[]SignToStringArg)(nil), args)
						return
					}
					ret, err = i.SignToString(ctx, (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"unboxBytes32": {
				MakeArg: func() interface{} {
					ret := make([]UnboxBytes32Arg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]UnboxBytes32Arg)
					if !ok {
						err = rpc.NewTypeError((*[]UnboxBytes32Arg)(nil), args)
						return
					}
					ret, err = i.UnboxBytes32(ctx, (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"unboxBytes32Any": {
				MakeArg: func() interface{} {
					ret := make([]UnboxBytes32AnyArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]UnboxBytes32AnyArg)
					if !ok {
						err = rpc.NewTypeError((*[]UnboxBytes32AnyArg)(nil), args)
						return
					}
					ret, err = i.UnboxBytes32Any(ctx, (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
		},
	}
}

type CryptoClient struct {
	Cli GenericClient
}

func (c CryptoClient) SignED25519(ctx context.Context, __arg SignED25519Arg) (res ED25519SignatureInfo, err error) {
	err = c.Cli.Call(ctx, "keybase.1.crypto.signED25519", []interface{}{__arg}, &res)
	return
}

func (c CryptoClient) SignToString(ctx context.Context, __arg SignToStringArg) (res string, err error) {
	err = c.Cli.Call(ctx, "keybase.1.crypto.signToString", []interface{}{__arg}, &res)
	return
}

func (c CryptoClient) UnboxBytes32(ctx context.Context, __arg UnboxBytes32Arg) (res Bytes32, err error) {
	err = c.Cli.Call(ctx, "keybase.1.crypto.unboxBytes32", []interface{}{__arg}, &res)
	return
}

func (c CryptoClient) UnboxBytes32Any(ctx context.Context, __arg UnboxBytes32AnyArg) (res UnboxAnyRes, err error) {
	err = c.Cli.Call(ctx, "keybase.1.crypto.unboxBytes32Any", []interface{}{__arg}, &res)
	return
}

type ExitCode int

const (
	ExitCode_OK      ExitCode = 0
	ExitCode_NOTOK   ExitCode = 2
	ExitCode_RESTART ExitCode = 4
)

type StopArg struct {
	SessionID int      `codec:"sessionID" json:"sessionID"`
	ExitCode  ExitCode `codec:"exitCode" json:"exitCode"`
}

type LogRotateArg struct {
	SessionID int `codec:"sessionID" json:"sessionID"`
}

type ReloadArg struct {
	SessionID int `codec:"sessionID" json:"sessionID"`
}

type DbNukeArg struct {
	SessionID int `codec:"sessionID" json:"sessionID"`
}

type CtlInterface interface {
	Stop(context.Context, StopArg) error
	LogRotate(context.Context, int) error
	Reload(context.Context, int) error
	DbNuke(context.Context, int) error
}

func CtlProtocol(i CtlInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.ctl",
		Methods: map[string]rpc.ServeHandlerDescription{
			"stop": {
				MakeArg: func() interface{} {
					ret := make([]StopArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]StopArg)
					if !ok {
						err = rpc.NewTypeError((*[]StopArg)(nil), args)
						return
					}
					err = i.Stop(ctx, (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"logRotate": {
				MakeArg: func() interface{} {
					ret := make([]LogRotateArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]LogRotateArg)
					if !ok {
						err = rpc.NewTypeError((*[]LogRotateArg)(nil), args)
						return
					}
					err = i.LogRotate(ctx, (*typedArgs)[0].SessionID)
					return
				},
				MethodType: rpc.MethodCall,
			},
			"reload": {
				MakeArg: func() interface{} {
					ret := make([]ReloadArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]ReloadArg)
					if !ok {
						err = rpc.NewTypeError((*[]ReloadArg)(nil), args)
						return
					}
					err = i.Reload(ctx, (*typedArgs)[0].SessionID)
					return
				},
				MethodType: rpc.MethodCall,
			},
			"dbNuke": {
				MakeArg: func() interface{} {
					ret := make([]DbNukeArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]DbNukeArg)
					if !ok {
						err = rpc.NewTypeError((*[]DbNukeArg)(nil), args)
						return
					}
					err = i.DbNuke(ctx, (*typedArgs)[0].SessionID)
					return
				},
				MethodType: rpc.MethodCall,
			},
		},
	}
}

type CtlClient struct {
	Cli GenericClient
}

func (c CtlClient) Stop(ctx context.Context, __arg StopArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.ctl.stop", []interface{}{__arg}, nil)
	return
}

func (c CtlClient) LogRotate(ctx context.Context, sessionID int) (err error) {
	__arg := LogRotateArg{SessionID: sessionID}
	err = c.Cli.Call(ctx, "keybase.1.ctl.logRotate", []interface{}{__arg}, nil)
	return
}

func (c CtlClient) Reload(ctx context.Context, sessionID int) (err error) {
	__arg := ReloadArg{SessionID: sessionID}
	err = c.Cli.Call(ctx, "keybase.1.ctl.reload", []interface{}{__arg}, nil)
	return
}

func (c CtlClient) DbNuke(ctx context.Context, sessionID int) (err error) {
	__arg := DbNukeArg{SessionID: sessionID}
	err = c.Cli.Call(ctx, "keybase.1.ctl.dbNuke", []interface{}{__arg}, nil)
	return
}

type FirstStepResult struct {
	ValPlusTwo int `codec:"valPlusTwo" json:"valPlusTwo"`
}

type FirstStepArg struct {
	SessionID int `codec:"sessionID" json:"sessionID"`
	Val       int `codec:"val" json:"val"`
}

type SecondStepArg struct {
	SessionID int `codec:"sessionID" json:"sessionID"`
	Val       int `codec:"val" json:"val"`
}

type IncrementArg struct {
	SessionID int `codec:"sessionID" json:"sessionID"`
	Val       int `codec:"val" json:"val"`
}

type DebuggingInterface interface {
	FirstStep(context.Context, FirstStepArg) (FirstStepResult, error)
	SecondStep(context.Context, SecondStepArg) (int, error)
	Increment(context.Context, IncrementArg) (int, error)
}

func DebuggingProtocol(i DebuggingInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.debugging",
		Methods: map[string]rpc.ServeHandlerDescription{
			"firstStep": {
				MakeArg: func() interface{} {
					ret := make([]FirstStepArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]FirstStepArg)
					if !ok {
						err = rpc.NewTypeError((*[]FirstStepArg)(nil), args)
						return
					}
					ret, err = i.FirstStep(ctx, (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"secondStep": {
				MakeArg: func() interface{} {
					ret := make([]SecondStepArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]SecondStepArg)
					if !ok {
						err = rpc.NewTypeError((*[]SecondStepArg)(nil), args)
						return
					}
					ret, err = i.SecondStep(ctx, (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"increment": {
				MakeArg: func() interface{} {
					ret := make([]IncrementArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]IncrementArg)
					if !ok {
						err = rpc.NewTypeError((*[]IncrementArg)(nil), args)
						return
					}
					ret, err = i.Increment(ctx, (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
		},
	}
}

type DebuggingClient struct {
	Cli GenericClient
}

func (c DebuggingClient) FirstStep(ctx context.Context, __arg FirstStepArg) (res FirstStepResult, err error) {
	err = c.Cli.Call(ctx, "keybase.1.debugging.firstStep", []interface{}{__arg}, &res)
	return
}

func (c DebuggingClient) SecondStep(ctx context.Context, __arg SecondStepArg) (res int, err error) {
	err = c.Cli.Call(ctx, "keybase.1.debugging.secondStep", []interface{}{__arg}, &res)
	return
}

func (c DebuggingClient) Increment(ctx context.Context, __arg IncrementArg) (res int, err error) {
	err = c.Cli.Call(ctx, "keybase.1.debugging.increment", []interface{}{__arg}, &res)
	return
}

type RegisterIdentifyUIArg struct {
}

type RegisterSecretUIArg struct {
}

type RegisterUpdateUIArg struct {
}

type DelegateUiCtlInterface interface {
	RegisterIdentifyUI(context.Context) error
	RegisterSecretUI(context.Context) error
	RegisterUpdateUI(context.Context) error
}

func DelegateUiCtlProtocol(i DelegateUiCtlInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.delegateUiCtl",
		Methods: map[string]rpc.ServeHandlerDescription{
			"registerIdentifyUI": {
				MakeArg: func() interface{} {
					ret := make([]RegisterIdentifyUIArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					err = i.RegisterIdentifyUI(ctx)
					return
				},
				MethodType: rpc.MethodCall,
			},
			"registerSecretUI": {
				MakeArg: func() interface{} {
					ret := make([]RegisterSecretUIArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					err = i.RegisterSecretUI(ctx)
					return
				},
				MethodType: rpc.MethodCall,
			},
			"registerUpdateUI": {
				MakeArg: func() interface{} {
					ret := make([]RegisterUpdateUIArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					err = i.RegisterUpdateUI(ctx)
					return
				},
				MethodType: rpc.MethodCall,
			},
		},
	}
}

type DelegateUiCtlClient struct {
	Cli GenericClient
}

func (c DelegateUiCtlClient) RegisterIdentifyUI(ctx context.Context) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.delegateUiCtl.registerIdentifyUI", []interface{}{RegisterIdentifyUIArg{}}, nil)
	return
}

func (c DelegateUiCtlClient) RegisterSecretUI(ctx context.Context) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.delegateUiCtl.registerSecretUI", []interface{}{RegisterSecretUIArg{}}, nil)
	return
}

func (c DelegateUiCtlClient) RegisterUpdateUI(ctx context.Context) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.delegateUiCtl.registerUpdateUI", []interface{}{RegisterUpdateUIArg{}}, nil)
	return
}

type DeviceListArg struct {
	SessionID int `codec:"sessionID" json:"sessionID"`
}

type DeviceAddArg struct {
	SessionID int `codec:"sessionID" json:"sessionID"`
}

type DeviceInterface interface {
	DeviceList(context.Context, int) ([]Device, error)
	DeviceAdd(context.Context, int) error
}

func DeviceProtocol(i DeviceInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.device",
		Methods: map[string]rpc.ServeHandlerDescription{
			"deviceList": {
				MakeArg: func() interface{} {
					ret := make([]DeviceListArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]DeviceListArg)
					if !ok {
						err = rpc.NewTypeError((*[]DeviceListArg)(nil), args)
						return
					}
					ret, err = i.DeviceList(ctx, (*typedArgs)[0].SessionID)
					return
				},
				MethodType: rpc.MethodCall,
			},
			"deviceAdd": {
				MakeArg: func() interface{} {
					ret := make([]DeviceAddArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]DeviceAddArg)
					if !ok {
						err = rpc.NewTypeError((*[]DeviceAddArg)(nil), args)
						return
					}
					err = i.DeviceAdd(ctx, (*typedArgs)[0].SessionID)
					return
				},
				MethodType: rpc.MethodCall,
			},
		},
	}
}

type DeviceClient struct {
	Cli GenericClient
}

func (c DeviceClient) DeviceList(ctx context.Context, sessionID int) (res []Device, err error) {
	__arg := DeviceListArg{SessionID: sessionID}
	err = c.Cli.Call(ctx, "keybase.1.device.deviceList", []interface{}{__arg}, &res)
	return
}

func (c DeviceClient) DeviceAdd(ctx context.Context, sessionID int) (err error) {
	__arg := DeviceAddArg{SessionID: sessionID}
	err = c.Cli.Call(ctx, "keybase.1.device.deviceAdd", []interface{}{__arg}, nil)
	return
}

type Folder struct {
	Name            string `codec:"name" json:"name"`
	Private         bool   `codec:"private" json:"private"`
	NotificationsOn bool   `codec:"notificationsOn" json:"notificationsOn"`
}

type FavoriteAddArg struct {
	SessionID int    `codec:"sessionID" json:"sessionID"`
	Folder    Folder `codec:"folder" json:"folder"`
}

type FavoriteDeleteArg struct {
	SessionID int    `codec:"sessionID" json:"sessionID"`
	Folder    Folder `codec:"folder" json:"folder"`
}

type FavoriteListArg struct {
	SessionID int `codec:"sessionID" json:"sessionID"`
}

type FavoriteInterface interface {
	FavoriteAdd(context.Context, FavoriteAddArg) error
	FavoriteDelete(context.Context, FavoriteDeleteArg) error
	FavoriteList(context.Context, int) ([]Folder, error)
}

func FavoriteProtocol(i FavoriteInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.favorite",
		Methods: map[string]rpc.ServeHandlerDescription{
			"favoriteAdd": {
				MakeArg: func() interface{} {
					ret := make([]FavoriteAddArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]FavoriteAddArg)
					if !ok {
						err = rpc.NewTypeError((*[]FavoriteAddArg)(nil), args)
						return
					}
					err = i.FavoriteAdd(ctx, (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"favoriteDelete": {
				MakeArg: func() interface{} {
					ret := make([]FavoriteDeleteArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]FavoriteDeleteArg)
					if !ok {
						err = rpc.NewTypeError((*[]FavoriteDeleteArg)(nil), args)
						return
					}
					err = i.FavoriteDelete(ctx, (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"favoriteList": {
				MakeArg: func() interface{} {
					ret := make([]FavoriteListArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]FavoriteListArg)
					if !ok {
						err = rpc.NewTypeError((*[]FavoriteListArg)(nil), args)
						return
					}
					ret, err = i.FavoriteList(ctx, (*typedArgs)[0].SessionID)
					return
				},
				MethodType: rpc.MethodCall,
			},
		},
	}
}

type FavoriteClient struct {
	Cli GenericClient
}

func (c FavoriteClient) FavoriteAdd(ctx context.Context, __arg FavoriteAddArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.favorite.favoriteAdd", []interface{}{__arg}, nil)
	return
}

func (c FavoriteClient) FavoriteDelete(ctx context.Context, __arg FavoriteDeleteArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.favorite.favoriteDelete", []interface{}{__arg}, nil)
	return
}

func (c FavoriteClient) FavoriteList(ctx context.Context, sessionID int) (res []Folder, err error) {
	__arg := FavoriteListArg{SessionID: sessionID}
	err = c.Cli.Call(ctx, "keybase.1.favorite.favoriteList", []interface{}{__arg}, &res)
	return
}

type GPGKey struct {
	Algorithm  string        `codec:"algorithm" json:"algorithm"`
	KeyID      string        `codec:"keyID" json:"keyID"`
	Creation   string        `codec:"creation" json:"creation"`
	Expiration string        `codec:"expiration" json:"expiration"`
	Identities []PGPIdentity `codec:"identities" json:"identities"`
}

type SelectKeyRes struct {
	KeyID        string `codec:"keyID" json:"keyID"`
	DoSecretPush bool   `codec:"doSecretPush" json:"doSecretPush"`
}

type WantToAddGPGKeyArg struct {
	SessionID int `codec:"sessionID" json:"sessionID"`
}

type ConfirmDuplicateKeyChosenArg struct {
	SessionID int `codec:"sessionID" json:"sessionID"`
}

type SelectKeyAndPushOptionArg struct {
	SessionID int      `codec:"sessionID" json:"sessionID"`
	Keys      []GPGKey `codec:"keys" json:"keys"`
}

type SelectKeyArg struct {
	SessionID int      `codec:"sessionID" json:"sessionID"`
	Keys      []GPGKey `codec:"keys" json:"keys"`
}

type SignArg struct {
	Msg         []byte `codec:"msg" json:"msg"`
	Fingerprint []byte `codec:"fingerprint" json:"fingerprint"`
}

type GpgUiInterface interface {
	WantToAddGPGKey(context.Context, int) (bool, error)
	ConfirmDuplicateKeyChosen(context.Context, int) (bool, error)
	SelectKeyAndPushOption(context.Context, SelectKeyAndPushOptionArg) (SelectKeyRes, error)
	SelectKey(context.Context, SelectKeyArg) (string, error)
	Sign(context.Context, SignArg) (string, error)
}

func GpgUiProtocol(i GpgUiInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.gpgUi",
		Methods: map[string]rpc.ServeHandlerDescription{
			"wantToAddGPGKey": {
				MakeArg: func() interface{} {
					ret := make([]WantToAddGPGKeyArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]WantToAddGPGKeyArg)
					if !ok {
						err = rpc.NewTypeError((*[]WantToAddGPGKeyArg)(nil), args)
						return
					}
					ret, err = i.WantToAddGPGKey(ctx, (*typedArgs)[0].SessionID)
					return
				},
				MethodType: rpc.MethodCall,
			},
			"confirmDuplicateKeyChosen": {
				MakeArg: func() interface{} {
					ret := make([]ConfirmDuplicateKeyChosenArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]ConfirmDuplicateKeyChosenArg)
					if !ok {
						err = rpc.NewTypeError((*[]ConfirmDuplicateKeyChosenArg)(nil), args)
						return
					}
					ret, err = i.ConfirmDuplicateKeyChosen(ctx, (*typedArgs)[0].SessionID)
					return
				},
				MethodType: rpc.MethodCall,
			},
			"selectKeyAndPushOption": {
				MakeArg: func() interface{} {
					ret := make([]SelectKeyAndPushOptionArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]SelectKeyAndPushOptionArg)
					if !ok {
						err = rpc.NewTypeError((*[]SelectKeyAndPushOptionArg)(nil), args)
						return
					}
					ret, err = i.SelectKeyAndPushOption(ctx, (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"selectKey": {
				MakeArg: func() interface{} {
					ret := make([]SelectKeyArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]SelectKeyArg)
					if !ok {
						err = rpc.NewTypeError((*[]SelectKeyArg)(nil), args)
						return
					}
					ret, err = i.SelectKey(ctx, (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"sign": {
				MakeArg: func() interface{} {
					ret := make([]SignArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]SignArg)
					if !ok {
						err = rpc.NewTypeError((*[]SignArg)(nil), args)
						return
					}
					ret, err = i.Sign(ctx, (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
		},
	}
}

type GpgUiClient struct {
	Cli GenericClient
}

func (c GpgUiClient) WantToAddGPGKey(ctx context.Context, sessionID int) (res bool, err error) {
	__arg := WantToAddGPGKeyArg{SessionID: sessionID}
	err = c.Cli.Call(ctx, "keybase.1.gpgUi.wantToAddGPGKey", []interface{}{__arg}, &res)
	return
}

func (c GpgUiClient) ConfirmDuplicateKeyChosen(ctx context.Context, sessionID int) (res bool, err error) {
	__arg := ConfirmDuplicateKeyChosenArg{SessionID: sessionID}
	err = c.Cli.Call(ctx, "keybase.1.gpgUi.confirmDuplicateKeyChosen", []interface{}{__arg}, &res)
	return
}

func (c GpgUiClient) SelectKeyAndPushOption(ctx context.Context, __arg SelectKeyAndPushOptionArg) (res SelectKeyRes, err error) {
	err = c.Cli.Call(ctx, "keybase.1.gpgUi.selectKeyAndPushOption", []interface{}{__arg}, &res)
	return
}

func (c GpgUiClient) SelectKey(ctx context.Context, __arg SelectKeyArg) (res string, err error) {
	err = c.Cli.Call(ctx, "keybase.1.gpgUi.selectKey", []interface{}{__arg}, &res)
	return
}

func (c GpgUiClient) Sign(ctx context.Context, __arg SignArg) (res string, err error) {
	err = c.Cli.Call(ctx, "keybase.1.gpgUi.sign", []interface{}{__arg}, &res)
	return
}

type ProofState int

const (
	ProofState_NONE         ProofState = 0
	ProofState_OK           ProofState = 1
	ProofState_TEMP_FAILURE ProofState = 2
	ProofState_PERM_FAILURE ProofState = 3
	ProofState_LOOKING      ProofState = 4
	ProofState_SUPERSEDED   ProofState = 5
	ProofState_POSTED       ProofState = 6
	ProofState_REVOKED      ProofState = 7
)

type ProofStatus int

const (
	ProofStatus_NONE              ProofStatus = 0
	ProofStatus_OK                ProofStatus = 1
	ProofStatus_LOCAL             ProofStatus = 2
	ProofStatus_FOUND             ProofStatus = 3
	ProofStatus_BASE_ERROR        ProofStatus = 100
	ProofStatus_HOST_UNREACHABLE  ProofStatus = 101
	ProofStatus_PERMISSION_DENIED ProofStatus = 103
	ProofStatus_FAILED_PARSE      ProofStatus = 106
	ProofStatus_DNS_ERROR         ProofStatus = 107
	ProofStatus_AUTH_FAILED       ProofStatus = 108
	ProofStatus_HTTP_429          ProofStatus = 129
	ProofStatus_HTTP_500          ProofStatus = 150
	ProofStatus_TIMEOUT           ProofStatus = 160
	ProofStatus_INTERNAL_ERROR    ProofStatus = 170
	ProofStatus_BASE_HARD_ERROR   ProofStatus = 200
	ProofStatus_NOT_FOUND         ProofStatus = 201
	ProofStatus_CONTENT_FAILURE   ProofStatus = 202
	ProofStatus_BAD_USERNAME      ProofStatus = 203
	ProofStatus_BAD_REMOTE_ID     ProofStatus = 204
	ProofStatus_TEXT_NOT_FOUND    ProofStatus = 205
	ProofStatus_BAD_ARGS          ProofStatus = 206
	ProofStatus_CONTENT_MISSING   ProofStatus = 207
	ProofStatus_TITLE_NOT_FOUND   ProofStatus = 208
	ProofStatus_SERVICE_ERROR     ProofStatus = 209
	ProofStatus_TOR_SKIPPED       ProofStatus = 210
	ProofStatus_TOR_INCOMPATIBLE  ProofStatus = 211
	ProofStatus_HTTP_300          ProofStatus = 230
	ProofStatus_HTTP_400          ProofStatus = 240
	ProofStatus_HTTP_OTHER        ProofStatus = 260
	ProofStatus_EMPTY_JSON        ProofStatus = 270
	ProofStatus_DELETED           ProofStatus = 301
	ProofStatus_SERVICE_DEAD      ProofStatus = 302
	ProofStatus_BAD_SIGNATURE     ProofStatus = 303
	ProofStatus_BAD_API_URL       ProofStatus = 304
	ProofStatus_UNKNOWN_TYPE      ProofStatus = 305
	ProofStatus_NO_HINT           ProofStatus = 306
	ProofStatus_BAD_HINT_TEXT     ProofStatus = 307
)

type ProofType int

const (
	ProofType_NONE             ProofType = 0
	ProofType_KEYBASE          ProofType = 1
	ProofType_TWITTER          ProofType = 2
	ProofType_GITHUB           ProofType = 3
	ProofType_REDDIT           ProofType = 4
	ProofType_COINBASE         ProofType = 5
	ProofType_HACKERNEWS       ProofType = 6
	ProofType_GENERIC_WEB_SITE ProofType = 1000
	ProofType_DNS              ProofType = 1001
	ProofType_ROOTER           ProofType = 100001
)

type TrackToken string
type TrackDiffType int

const (
	TrackDiffType_NONE           TrackDiffType = 0
	TrackDiffType_ERROR          TrackDiffType = 1
	TrackDiffType_CLASH          TrackDiffType = 2
	TrackDiffType_REVOKED        TrackDiffType = 3
	TrackDiffType_UPGRADED       TrackDiffType = 4
	TrackDiffType_NEW            TrackDiffType = 5
	TrackDiffType_REMOTE_FAIL    TrackDiffType = 6
	TrackDiffType_REMOTE_WORKING TrackDiffType = 7
	TrackDiffType_REMOTE_CHANGED TrackDiffType = 8
	TrackDiffType_NEW_ELDEST     TrackDiffType = 9
)

type TrackDiff struct {
	Type          TrackDiffType `codec:"type" json:"type"`
	DisplayMarkup string        `codec:"displayMarkup" json:"displayMarkup"`
}

type TrackSummary struct {
	Username string `codec:"username" json:"username"`
	Time     Time   `codec:"time" json:"time"`
	IsRemote bool   `codec:"isRemote" json:"isRemote"`
}

type TrackStatus int

const (
	TrackStatus_NEW_OK            TrackStatus = 1
	TrackStatus_NEW_ZERO_PROOFS   TrackStatus = 2
	TrackStatus_NEW_FAIL_PROOFS   TrackStatus = 3
	TrackStatus_UPDATE_BROKEN     TrackStatus = 4
	TrackStatus_UPDATE_NEW_PROOFS TrackStatus = 5
	TrackStatus_UPDATE_OK         TrackStatus = 6
)

type TrackOptions struct {
	LocalOnly     bool `codec:"localOnly" json:"localOnly"`
	BypassConfirm bool `codec:"bypassConfirm" json:"bypassConfirm"`
	ForceRetrack  bool `codec:"forceRetrack" json:"forceRetrack"`
}

type IdentifyReasonType int

const (
	IdentifyReasonType_NONE     IdentifyReasonType = 0
	IdentifyReasonType_ID       IdentifyReasonType = 1
	IdentifyReasonType_TRACK    IdentifyReasonType = 2
	IdentifyReasonType_ENCRYPT  IdentifyReasonType = 3
	IdentifyReasonType_DECRYPT  IdentifyReasonType = 4
	IdentifyReasonType_VERIFY   IdentifyReasonType = 5
	IdentifyReasonType_RESOURCE IdentifyReasonType = 6
)

type IdentifyReason struct {
	Type     IdentifyReasonType `codec:"type" json:"type"`
	Reason   string             `codec:"reason" json:"reason"`
	Resource string             `codec:"resource" json:"resource"`
}

type IdentifyOutcome struct {
	Username          string         `codec:"username" json:"username"`
	Status            *Status        `codec:"status,omitempty" json:"status,omitempty"`
	Warnings          []string       `codec:"warnings" json:"warnings"`
	TrackUsed         *TrackSummary  `codec:"trackUsed,omitempty" json:"trackUsed,omitempty"`
	TrackStatus       TrackStatus    `codec:"trackStatus" json:"trackStatus"`
	NumTrackFailures  int            `codec:"numTrackFailures" json:"numTrackFailures"`
	NumTrackChanges   int            `codec:"numTrackChanges" json:"numTrackChanges"`
	NumProofFailures  int            `codec:"numProofFailures" json:"numProofFailures"`
	NumRevoked        int            `codec:"numRevoked" json:"numRevoked"`
	NumProofSuccesses int            `codec:"numProofSuccesses" json:"numProofSuccesses"`
	Revoked           []TrackDiff    `codec:"revoked" json:"revoked"`
	TrackOptions      TrackOptions   `codec:"trackOptions" json:"trackOptions"`
	ForPGPPull        bool           `codec:"forPGPPull" json:"forPGPPull"`
	Reason            IdentifyReason `codec:"reason" json:"reason"`
}

type IdentifyRes struct {
	User       *User           `codec:"user,omitempty" json:"user,omitempty"`
	PublicKeys []PublicKey     `codec:"publicKeys" json:"publicKeys"`
	Outcome    IdentifyOutcome `codec:"outcome" json:"outcome"`
	TrackToken TrackToken      `codec:"trackToken" json:"trackToken"`
}

type RemoteProof struct {
	ProofType     ProofType `codec:"proofType" json:"proofType"`
	Key           string    `codec:"key" json:"key"`
	Value         string    `codec:"value" json:"value"`
	DisplayMarkup string    `codec:"displayMarkup" json:"displayMarkup"`
	SigID         SigID     `codec:"sigID" json:"sigID"`
	MTime         Time      `codec:"mTime" json:"mTime"`
}

type Identify2Res struct {
	Upk UserPlusKeys `codec:"upk" json:"upk"`
}

type ResolveArg struct {
	Assertion string `codec:"assertion" json:"assertion"`
}

type Resolve2Arg struct {
	Assertion string `codec:"assertion" json:"assertion"`
}

type IdentifyArg struct {
	SessionID        int            `codec:"sessionID" json:"sessionID"`
	UserAssertion    string         `codec:"userAssertion" json:"userAssertion"`
	TrackStatement   bool           `codec:"trackStatement" json:"trackStatement"`
	ForceRemoteCheck bool           `codec:"forceRemoteCheck" json:"forceRemoteCheck"`
	UseDelegateUI    bool           `codec:"useDelegateUI" json:"useDelegateUI"`
	Reason           IdentifyReason `codec:"reason" json:"reason"`
	Source           ClientType     `codec:"source" json:"source"`
}

type Identify2Arg struct {
	SessionID             int            `codec:"sessionID" json:"sessionID"`
	Uid                   UID            `codec:"uid" json:"uid"`
	UserAssertion         string         `codec:"userAssertion" json:"userAssertion"`
	Reason                IdentifyReason `codec:"reason" json:"reason"`
	UseDelegateUI         bool           `codec:"useDelegateUI" json:"useDelegateUI"`
	AlwaysBlock           bool           `codec:"alwaysBlock" json:"alwaysBlock"`
	NoErrorOnTrackFailure bool           `codec:"noErrorOnTrackFailure" json:"noErrorOnTrackFailure"`
	ForceRemoteCheck      bool           `codec:"forceRemoteCheck" json:"forceRemoteCheck"`
	NeedProofSet          bool           `codec:"needProofSet" json:"needProofSet"`
}

type IdentifyInterface interface {
	Resolve(context.Context, string) (UID, error)
	Resolve2(context.Context, string) (User, error)
	Identify(context.Context, IdentifyArg) (IdentifyRes, error)
	Identify2(context.Context, Identify2Arg) (Identify2Res, error)
}

func IdentifyProtocol(i IdentifyInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.identify",
		Methods: map[string]rpc.ServeHandlerDescription{
			"Resolve": {
				MakeArg: func() interface{} {
					ret := make([]ResolveArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]ResolveArg)
					if !ok {
						err = rpc.NewTypeError((*[]ResolveArg)(nil), args)
						return
					}
					ret, err = i.Resolve(ctx, (*typedArgs)[0].Assertion)
					return
				},
				MethodType: rpc.MethodCall,
			},
			"Resolve2": {
				MakeArg: func() interface{} {
					ret := make([]Resolve2Arg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]Resolve2Arg)
					if !ok {
						err = rpc.NewTypeError((*[]Resolve2Arg)(nil), args)
						return
					}
					ret, err = i.Resolve2(ctx, (*typedArgs)[0].Assertion)
					return
				},
				MethodType: rpc.MethodCall,
			},
			"identify": {
				MakeArg: func() interface{} {
					ret := make([]IdentifyArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]IdentifyArg)
					if !ok {
						err = rpc.NewTypeError((*[]IdentifyArg)(nil), args)
						return
					}
					ret, err = i.Identify(ctx, (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"identify2": {
				MakeArg: func() interface{} {
					ret := make([]Identify2Arg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]Identify2Arg)
					if !ok {
						err = rpc.NewTypeError((*[]Identify2Arg)(nil), args)
						return
					}
					ret, err = i.Identify2(ctx, (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
		},
	}
}

type IdentifyClient struct {
	Cli GenericClient
}

func (c IdentifyClient) Resolve(ctx context.Context, assertion string) (res UID, err error) {
	__arg := ResolveArg{Assertion: assertion}
	err = c.Cli.Call(ctx, "keybase.1.identify.Resolve", []interface{}{__arg}, &res)
	return
}

func (c IdentifyClient) Resolve2(ctx context.Context, assertion string) (res User, err error) {
	__arg := Resolve2Arg{Assertion: assertion}
	err = c.Cli.Call(ctx, "keybase.1.identify.Resolve2", []interface{}{__arg}, &res)
	return
}

func (c IdentifyClient) Identify(ctx context.Context, __arg IdentifyArg) (res IdentifyRes, err error) {
	err = c.Cli.Call(ctx, "keybase.1.identify.identify", []interface{}{__arg}, &res)
	return
}

func (c IdentifyClient) Identify2(ctx context.Context, __arg Identify2Arg) (res Identify2Res, err error) {
	err = c.Cli.Call(ctx, "keybase.1.identify.identify2", []interface{}{__arg}, &res)
	return
}

type ProofResult struct {
	State  ProofState  `codec:"state" json:"state"`
	Status ProofStatus `codec:"status" json:"status"`
	Desc   string      `codec:"desc" json:"desc"`
}

type IdentifyRow struct {
	RowId     int         `codec:"rowId" json:"rowId"`
	Proof     RemoteProof `codec:"proof" json:"proof"`
	TrackDiff *TrackDiff  `codec:"trackDiff,omitempty" json:"trackDiff,omitempty"`
}

type IdentifyKey struct {
	PGPFingerprint []byte     `codec:"pgpFingerprint" json:"pgpFingerprint"`
	KID            KID        `codec:"KID" json:"KID"`
	TrackDiff      *TrackDiff `codec:"trackDiff,omitempty" json:"trackDiff,omitempty"`
}

type Cryptocurrency struct {
	RowId   int    `codec:"rowId" json:"rowId"`
	Pkhash  []byte `codec:"pkhash" json:"pkhash"`
	Address string `codec:"address" json:"address"`
}

type Identity struct {
	Status          *Status          `codec:"status,omitempty" json:"status,omitempty"`
	WhenLastTracked int              `codec:"whenLastTracked" json:"whenLastTracked"`
	Proofs          []IdentifyRow    `codec:"proofs" json:"proofs"`
	Cryptocurrency  []Cryptocurrency `codec:"cryptocurrency" json:"cryptocurrency"`
	Revoked         []TrackDiff      `codec:"revoked" json:"revoked"`
}

type SigHint struct {
	RemoteId  string `codec:"remoteId" json:"remoteId"`
	HumanUrl  string `codec:"humanUrl" json:"humanUrl"`
	ApiUrl    string `codec:"apiUrl" json:"apiUrl"`
	CheckText string `codec:"checkText" json:"checkText"`
}

type CheckResultFreshness int

const (
	CheckResultFreshness_FRESH  CheckResultFreshness = 0
	CheckResultFreshness_AGED   CheckResultFreshness = 1
	CheckResultFreshness_RANCID CheckResultFreshness = 2
)

type CheckResult struct {
	ProofResult ProofResult          `codec:"proofResult" json:"proofResult"`
	Time        Time                 `codec:"time" json:"time"`
	Freshness   CheckResultFreshness `codec:"freshness" json:"freshness"`
}

type LinkCheckResult struct {
	ProofId       int          `codec:"proofId" json:"proofId"`
	ProofResult   ProofResult  `codec:"proofResult" json:"proofResult"`
	SnoozedResult ProofResult  `codec:"snoozedResult" json:"snoozedResult"`
	TorWarning    bool         `codec:"torWarning" json:"torWarning"`
	Cached        *CheckResult `codec:"cached,omitempty" json:"cached,omitempty"`
	Diff          *TrackDiff   `codec:"diff,omitempty" json:"diff,omitempty"`
	RemoteDiff    *TrackDiff   `codec:"remoteDiff,omitempty" json:"remoteDiff,omitempty"`
	Hint          *SigHint     `codec:"hint,omitempty" json:"hint,omitempty"`
}

type UserCard struct {
	Following     int    `codec:"following" json:"following"`
	Followers     int    `codec:"followers" json:"followers"`
	Uid           UID    `codec:"uid" json:"uid"`
	FullName      string `codec:"fullName" json:"fullName"`
	Location      string `codec:"location" json:"location"`
	Bio           string `codec:"bio" json:"bio"`
	Website       string `codec:"website" json:"website"`
	Twitter       string `codec:"twitter" json:"twitter"`
	YouFollowThem bool   `codec:"youFollowThem" json:"youFollowThem"`
	TheyFollowYou bool   `codec:"theyFollowYou" json:"theyFollowYou"`
}

type ConfirmResult struct {
	IdentityConfirmed bool `codec:"identityConfirmed" json:"identityConfirmed"`
	RemoteConfirmed   bool `codec:"remoteConfirmed" json:"remoteConfirmed"`
}

type DelegateIdentifyUIArg struct {
}

type StartArg struct {
	SessionID int            `codec:"sessionID" json:"sessionID"`
	Username  string         `codec:"username" json:"username"`
	Reason    IdentifyReason `codec:"reason" json:"reason"`
}

type DisplayKeyArg struct {
	SessionID int         `codec:"sessionID" json:"sessionID"`
	Key       IdentifyKey `codec:"key" json:"key"`
}

type ReportLastTrackArg struct {
	SessionID int           `codec:"sessionID" json:"sessionID"`
	Track     *TrackSummary `codec:"track,omitempty" json:"track,omitempty"`
}

type LaunchNetworkChecksArg struct {
	SessionID int      `codec:"sessionID" json:"sessionID"`
	Identity  Identity `codec:"identity" json:"identity"`
	User      User     `codec:"user" json:"user"`
}

type DisplayTrackStatementArg struct {
	SessionID int    `codec:"sessionID" json:"sessionID"`
	Stmt      string `codec:"stmt" json:"stmt"`
}

type FinishWebProofCheckArg struct {
	SessionID int             `codec:"sessionID" json:"sessionID"`
	Rp        RemoteProof     `codec:"rp" json:"rp"`
	Lcr       LinkCheckResult `codec:"lcr" json:"lcr"`
}

type FinishSocialProofCheckArg struct {
	SessionID int             `codec:"sessionID" json:"sessionID"`
	Rp        RemoteProof     `codec:"rp" json:"rp"`
	Lcr       LinkCheckResult `codec:"lcr" json:"lcr"`
}

type DisplayCryptocurrencyArg struct {
	SessionID int            `codec:"sessionID" json:"sessionID"`
	C         Cryptocurrency `codec:"c" json:"c"`
}

type ReportTrackTokenArg struct {
	SessionID  int        `codec:"sessionID" json:"sessionID"`
	TrackToken TrackToken `codec:"trackToken" json:"trackToken"`
}

type DisplayUserCardArg struct {
	SessionID int      `codec:"sessionID" json:"sessionID"`
	Card      UserCard `codec:"card" json:"card"`
}

type ConfirmArg struct {
	SessionID int             `codec:"sessionID" json:"sessionID"`
	Outcome   IdentifyOutcome `codec:"outcome" json:"outcome"`
}

type FinishArg struct {
	SessionID int `codec:"sessionID" json:"sessionID"`
}

type IdentifyUiInterface interface {
	DelegateIdentifyUI(context.Context) (int, error)
	Start(context.Context, StartArg) error
	DisplayKey(context.Context, DisplayKeyArg) error
	ReportLastTrack(context.Context, ReportLastTrackArg) error
	LaunchNetworkChecks(context.Context, LaunchNetworkChecksArg) error
	DisplayTrackStatement(context.Context, DisplayTrackStatementArg) error
	FinishWebProofCheck(context.Context, FinishWebProofCheckArg) error
	FinishSocialProofCheck(context.Context, FinishSocialProofCheckArg) error
	DisplayCryptocurrency(context.Context, DisplayCryptocurrencyArg) error
	ReportTrackToken(context.Context, ReportTrackTokenArg) error
	DisplayUserCard(context.Context, DisplayUserCardArg) error
	Confirm(context.Context, ConfirmArg) (ConfirmResult, error)
	Finish(context.Context, int) error
}

func IdentifyUiProtocol(i IdentifyUiInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.identifyUi",
		Methods: map[string]rpc.ServeHandlerDescription{
			"delegateIdentifyUI": {
				MakeArg: func() interface{} {
					ret := make([]DelegateIdentifyUIArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					ret, err = i.DelegateIdentifyUI(ctx)
					return
				},
				MethodType: rpc.MethodCall,
			},
			"start": {
				MakeArg: func() interface{} {
					ret := make([]StartArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]StartArg)
					if !ok {
						err = rpc.NewTypeError((*[]StartArg)(nil), args)
						return
					}
					err = i.Start(ctx, (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"displayKey": {
				MakeArg: func() interface{} {
					ret := make([]DisplayKeyArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]DisplayKeyArg)
					if !ok {
						err = rpc.NewTypeError((*[]DisplayKeyArg)(nil), args)
						return
					}
					err = i.DisplayKey(ctx, (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"reportLastTrack": {
				MakeArg: func() interface{} {
					ret := make([]ReportLastTrackArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]ReportLastTrackArg)
					if !ok {
						err = rpc.NewTypeError((*[]ReportLastTrackArg)(nil), args)
						return
					}
					err = i.ReportLastTrack(ctx, (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"launchNetworkChecks": {
				MakeArg: func() interface{} {
					ret := make([]LaunchNetworkChecksArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]LaunchNetworkChecksArg)
					if !ok {
						err = rpc.NewTypeError((*[]LaunchNetworkChecksArg)(nil), args)
						return
					}
					err = i.LaunchNetworkChecks(ctx, (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"displayTrackStatement": {
				MakeArg: func() interface{} {
					ret := make([]DisplayTrackStatementArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]DisplayTrackStatementArg)
					if !ok {
						err = rpc.NewTypeError((*[]DisplayTrackStatementArg)(nil), args)
						return
					}
					err = i.DisplayTrackStatement(ctx, (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"finishWebProofCheck": {
				MakeArg: func() interface{} {
					ret := make([]FinishWebProofCheckArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]FinishWebProofCheckArg)
					if !ok {
						err = rpc.NewTypeError((*[]FinishWebProofCheckArg)(nil), args)
						return
					}
					err = i.FinishWebProofCheck(ctx, (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"finishSocialProofCheck": {
				MakeArg: func() interface{} {
					ret := make([]FinishSocialProofCheckArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]FinishSocialProofCheckArg)
					if !ok {
						err = rpc.NewTypeError((*[]FinishSocialProofCheckArg)(nil), args)
						return
					}
					err = i.FinishSocialProofCheck(ctx, (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"displayCryptocurrency": {
				MakeArg: func() interface{} {
					ret := make([]DisplayCryptocurrencyArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]DisplayCryptocurrencyArg)
					if !ok {
						err = rpc.NewTypeError((*[]DisplayCryptocurrencyArg)(nil), args)
						return
					}
					err = i.DisplayCryptocurrency(ctx, (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"reportTrackToken": {
				MakeArg: func() interface{} {
					ret := make([]ReportTrackTokenArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]ReportTrackTokenArg)
					if !ok {
						err = rpc.NewTypeError((*[]ReportTrackTokenArg)(nil), args)
						return
					}
					err = i.ReportTrackToken(ctx, (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"displayUserCard": {
				MakeArg: func() interface{} {
					ret := make([]DisplayUserCardArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]DisplayUserCardArg)
					if !ok {
						err = rpc.NewTypeError((*[]DisplayUserCardArg)(nil), args)
						return
					}
					err = i.DisplayUserCard(ctx, (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"confirm": {
				MakeArg: func() interface{} {
					ret := make([]ConfirmArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]ConfirmArg)
					if !ok {
						err = rpc.NewTypeError((*[]ConfirmArg)(nil), args)
						return
					}
					ret, err = i.Confirm(ctx, (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"finish": {
				MakeArg: func() interface{} {
					ret := make([]FinishArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]FinishArg)
					if !ok {
						err = rpc.NewTypeError((*[]FinishArg)(nil), args)
						return
					}
					err = i.Finish(ctx, (*typedArgs)[0].SessionID)
					return
				},
				MethodType: rpc.MethodCall,
			},
		},
	}
}

type IdentifyUiClient struct {
	Cli GenericClient
}

func (c IdentifyUiClient) DelegateIdentifyUI(ctx context.Context) (res int, err error) {
	err = c.Cli.Call(ctx, "keybase.1.identifyUi.delegateIdentifyUI", []interface{}{DelegateIdentifyUIArg{}}, &res)
	return
}

func (c IdentifyUiClient) Start(ctx context.Context, __arg StartArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.identifyUi.start", []interface{}{__arg}, nil)
	return
}

func (c IdentifyUiClient) DisplayKey(ctx context.Context, __arg DisplayKeyArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.identifyUi.displayKey", []interface{}{__arg}, nil)
	return
}

func (c IdentifyUiClient) ReportLastTrack(ctx context.Context, __arg ReportLastTrackArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.identifyUi.reportLastTrack", []interface{}{__arg}, nil)
	return
}

func (c IdentifyUiClient) LaunchNetworkChecks(ctx context.Context, __arg LaunchNetworkChecksArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.identifyUi.launchNetworkChecks", []interface{}{__arg}, nil)
	return
}

func (c IdentifyUiClient) DisplayTrackStatement(ctx context.Context, __arg DisplayTrackStatementArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.identifyUi.displayTrackStatement", []interface{}{__arg}, nil)
	return
}

func (c IdentifyUiClient) FinishWebProofCheck(ctx context.Context, __arg FinishWebProofCheckArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.identifyUi.finishWebProofCheck", []interface{}{__arg}, nil)
	return
}

func (c IdentifyUiClient) FinishSocialProofCheck(ctx context.Context, __arg FinishSocialProofCheckArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.identifyUi.finishSocialProofCheck", []interface{}{__arg}, nil)
	return
}

func (c IdentifyUiClient) DisplayCryptocurrency(ctx context.Context, __arg DisplayCryptocurrencyArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.identifyUi.displayCryptocurrency", []interface{}{__arg}, nil)
	return
}

func (c IdentifyUiClient) ReportTrackToken(ctx context.Context, __arg ReportTrackTokenArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.identifyUi.reportTrackToken", []interface{}{__arg}, nil)
	return
}

func (c IdentifyUiClient) DisplayUserCard(ctx context.Context, __arg DisplayUserCardArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.identifyUi.displayUserCard", []interface{}{__arg}, nil)
	return
}

func (c IdentifyUiClient) Confirm(ctx context.Context, __arg ConfirmArg) (res ConfirmResult, err error) {
	err = c.Cli.Call(ctx, "keybase.1.identifyUi.confirm", []interface{}{__arg}, &res)
	return
}

func (c IdentifyUiClient) Finish(ctx context.Context, sessionID int) (err error) {
	__arg := FinishArg{SessionID: sessionID}
	err = c.Cli.Call(ctx, "keybase.1.identifyUi.finish", []interface{}{__arg}, nil)
	return
}

type InstallStatus int

const (
	InstallStatus_UNKNOWN       InstallStatus = 0
	InstallStatus_ERROR         InstallStatus = 1
	InstallStatus_NOT_INSTALLED InstallStatus = 2
	InstallStatus_INSTALLED     InstallStatus = 4
)

type InstallAction int

const (
	InstallAction_UNKNOWN   InstallAction = 0
	InstallAction_NONE      InstallAction = 1
	InstallAction_UPGRADE   InstallAction = 2
	InstallAction_REINSTALL InstallAction = 3
	InstallAction_INSTALL   InstallAction = 4
)

type ServiceStatus struct {
	Version        string        `codec:"version" json:"version"`
	Label          string        `codec:"label" json:"label"`
	Pid            string        `codec:"pid" json:"pid"`
	LastExitStatus string        `codec:"lastExitStatus" json:"lastExitStatus"`
	BundleVersion  string        `codec:"bundleVersion" json:"bundleVersion"`
	InstallStatus  InstallStatus `codec:"installStatus" json:"installStatus"`
	InstallAction  InstallAction `codec:"installAction" json:"installAction"`
	Status         Status        `codec:"status" json:"status"`
}

type ServicesStatus struct {
	Service []ServiceStatus `codec:"service" json:"service"`
	Kbfs    []ServiceStatus `codec:"kbfs" json:"kbfs"`
}

type FuseMountInfo struct {
	Path   string `codec:"path" json:"path"`
	Fstype string `codec:"fstype" json:"fstype"`
	Output string `codec:"output" json:"output"`
}

type FuseStatus struct {
	Version       string          `codec:"version" json:"version"`
	BundleVersion string          `codec:"bundleVersion" json:"bundleVersion"`
	KextID        string          `codec:"kextID" json:"kextID"`
	Path          string          `codec:"path" json:"path"`
	KextStarted   bool            `codec:"kextStarted" json:"kextStarted"`
	InstallStatus InstallStatus   `codec:"installStatus" json:"installStatus"`
	InstallAction InstallAction   `codec:"installAction" json:"installAction"`
	MountInfos    []FuseMountInfo `codec:"mountInfos" json:"mountInfos"`
	Status        Status          `codec:"status" json:"status"`
}

type ComponentResult struct {
	Name   string `codec:"name" json:"name"`
	Status Status `codec:"status" json:"status"`
}

type InstallResult struct {
	ComponentResults []ComponentResult `codec:"componentResults" json:"componentResults"`
	Status           Status            `codec:"status" json:"status"`
	Fatal            bool              `codec:"fatal" json:"fatal"`
}

type UninstallResult struct {
	ComponentResults []ComponentResult `codec:"componentResults" json:"componentResults"`
	Status           Status            `codec:"status" json:"status"`
}

type InstallInterface interface {
}

func InstallProtocol(i InstallInterface) rpc.Protocol {
	return rpc.Protocol{
		Name:    "keybase.1.install",
		Methods: map[string]rpc.ServeHandlerDescription{},
	}
}

type InstallClient struct {
	Cli GenericClient
}

type FSStatusCode int

const (
	FSStatusCode_START  FSStatusCode = 0
	FSStatusCode_FINISH FSStatusCode = 1
	FSStatusCode_ERROR  FSStatusCode = 2
)

type FSNotificationType int

const (
	FSNotificationType_ENCRYPTING FSNotificationType = 0
	FSNotificationType_DECRYPTING FSNotificationType = 1
	FSNotificationType_SIGNING    FSNotificationType = 2
	FSNotificationType_VERIFYING  FSNotificationType = 3
	FSNotificationType_REKEYING   FSNotificationType = 4
)

type FSNotification struct {
	PublicTopLevelFolder bool               `codec:"publicTopLevelFolder" json:"publicTopLevelFolder"`
	Filename             string             `codec:"filename" json:"filename"`
	Status               string             `codec:"status" json:"status"`
	StatusCode           FSStatusCode       `codec:"statusCode" json:"statusCode"`
	NotificationType     FSNotificationType `codec:"notificationType" json:"notificationType"`
}

type FSEventArg struct {
	Event FSNotification `codec:"event" json:"event"`
}

type KbfsInterface interface {
	FSEvent(context.Context, FSNotification) error
}

func KbfsProtocol(i KbfsInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.kbfs",
		Methods: map[string]rpc.ServeHandlerDescription{
			"FSEvent": {
				MakeArg: func() interface{} {
					ret := make([]FSEventArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]FSEventArg)
					if !ok {
						err = rpc.NewTypeError((*[]FSEventArg)(nil), args)
						return
					}
					err = i.FSEvent(ctx, (*typedArgs)[0].Event)
					return
				},
				MethodType: rpc.MethodCall,
			},
		},
	}
}

type KbfsClient struct {
	Cli GenericClient
}

func (c KbfsClient) FSEvent(ctx context.Context, event FSNotification) (err error) {
	__arg := FSEventArg{Event: event}
	err = c.Cli.Call(ctx, "keybase.1.kbfs.FSEvent", []interface{}{__arg}, nil)
	return
}

type PassphraseStream struct {
	PassphraseStream []byte `codec:"passphraseStream" json:"passphraseStream"`
	Generation       int    `codec:"generation" json:"generation"`
}

type SessionToken string
type CsrfToken string
type HelloRes string
type HelloArg struct {
	Uid     UID              `codec:"uid" json:"uid"`
	Token   SessionToken     `codec:"token" json:"token"`
	Csrf    CsrfToken        `codec:"csrf" json:"csrf"`
	Pps     PassphraseStream `codec:"pps" json:"pps"`
	SigBody string           `codec:"sigBody" json:"sigBody"`
}

type DidCounterSignArg struct {
	Sig []byte `codec:"sig" json:"sig"`
}

type Kex2ProvisioneeInterface interface {
	Hello(context.Context, HelloArg) (HelloRes, error)
	DidCounterSign(context.Context, []byte) error
}

func Kex2ProvisioneeProtocol(i Kex2ProvisioneeInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.Kex2Provisionee",
		Methods: map[string]rpc.ServeHandlerDescription{
			"hello": {
				MakeArg: func() interface{} {
					ret := make([]HelloArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]HelloArg)
					if !ok {
						err = rpc.NewTypeError((*[]HelloArg)(nil), args)
						return
					}
					ret, err = i.Hello(ctx, (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"didCounterSign": {
				MakeArg: func() interface{} {
					ret := make([]DidCounterSignArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]DidCounterSignArg)
					if !ok {
						err = rpc.NewTypeError((*[]DidCounterSignArg)(nil), args)
						return
					}
					err = i.DidCounterSign(ctx, (*typedArgs)[0].Sig)
					return
				},
				MethodType: rpc.MethodCall,
			},
		},
	}
}

type Kex2ProvisioneeClient struct {
	Cli GenericClient
}

func (c Kex2ProvisioneeClient) Hello(ctx context.Context, __arg HelloArg) (res HelloRes, err error) {
	err = c.Cli.Call(ctx, "keybase.1.Kex2Provisionee.hello", []interface{}{__arg}, &res)
	return
}

func (c Kex2ProvisioneeClient) DidCounterSign(ctx context.Context, sig []byte) (err error) {
	__arg := DidCounterSignArg{Sig: sig}
	err = c.Cli.Call(ctx, "keybase.1.Kex2Provisionee.didCounterSign", []interface{}{__arg}, nil)
	return
}

type KexStartArg struct {
}

type Kex2ProvisionerInterface interface {
	KexStart(context.Context) error
}

func Kex2ProvisionerProtocol(i Kex2ProvisionerInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.Kex2Provisioner",
		Methods: map[string]rpc.ServeHandlerDescription{
			"kexStart": {
				MakeArg: func() interface{} {
					ret := make([]KexStartArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					err = i.KexStart(ctx)
					return
				},
				MethodType: rpc.MethodNotify,
			},
		},
	}
}

type Kex2ProvisionerClient struct {
	Cli GenericClient
}

func (c Kex2ProvisionerClient) KexStart(ctx context.Context) (err error) {
	err = c.Cli.Notify(ctx, "keybase.1.Kex2Provisioner.kexStart", []interface{}{KexStartArg{}})
	return
}

type RegisterLoggerArg struct {
	SessionID int      `codec:"sessionID" json:"sessionID"`
	Name      string   `codec:"name" json:"name"`
	Level     LogLevel `codec:"level" json:"level"`
}

type LogInterface interface {
	RegisterLogger(context.Context, RegisterLoggerArg) error
}

func LogProtocol(i LogInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.log",
		Methods: map[string]rpc.ServeHandlerDescription{
			"registerLogger": {
				MakeArg: func() interface{} {
					ret := make([]RegisterLoggerArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]RegisterLoggerArg)
					if !ok {
						err = rpc.NewTypeError((*[]RegisterLoggerArg)(nil), args)
						return
					}
					err = i.RegisterLogger(ctx, (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
		},
	}
}

type LogClient struct {
	Cli GenericClient
}

func (c LogClient) RegisterLogger(ctx context.Context, __arg RegisterLoggerArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.log.registerLogger", []interface{}{__arg}, nil)
	return
}

type LogArg struct {
	SessionID int      `codec:"sessionID" json:"sessionID"`
	Level     LogLevel `codec:"level" json:"level"`
	Text      Text     `codec:"text" json:"text"`
}

type LogUiInterface interface {
	Log(context.Context, LogArg) error
}

func LogUiProtocol(i LogUiInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.logUi",
		Methods: map[string]rpc.ServeHandlerDescription{
			"log": {
				MakeArg: func() interface{} {
					ret := make([]LogArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]LogArg)
					if !ok {
						err = rpc.NewTypeError((*[]LogArg)(nil), args)
						return
					}
					err = i.Log(ctx, (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
		},
	}
}

type LogUiClient struct {
	Cli GenericClient
}

func (c LogUiClient) Log(ctx context.Context, __arg LogArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.logUi.log", []interface{}{__arg}, nil)
	return
}

type ConfiguredAccount struct {
	Username        string `codec:"username" json:"username"`
	HasStoredSecret bool   `codec:"hasStoredSecret" json:"hasStoredSecret"`
}

type GetConfiguredAccountsArg struct {
	SessionID int `codec:"sessionID" json:"sessionID"`
}

type LoginArg struct {
	SessionID  int        `codec:"sessionID" json:"sessionID"`
	DeviceType string     `codec:"deviceType" json:"deviceType"`
	Username   string     `codec:"username" json:"username"`
	ClientType ClientType `codec:"clientType" json:"clientType"`
}

type ClearStoredSecretArg struct {
	SessionID int    `codec:"sessionID" json:"sessionID"`
	Username  string `codec:"username" json:"username"`
}

type LogoutArg struct {
	SessionID int `codec:"sessionID" json:"sessionID"`
}

type DeprovisionArg struct {
	SessionID int    `codec:"sessionID" json:"sessionID"`
	Username  string `codec:"username" json:"username"`
}

type RecoverAccountFromEmailAddressArg struct {
	Email string `codec:"email" json:"email"`
}

type PaperKeyArg struct {
	SessionID int `codec:"sessionID" json:"sessionID"`
}

type UnlockArg struct {
	SessionID int `codec:"sessionID" json:"sessionID"`
}

type UnlockWithPassphraseArg struct {
	SessionID  int    `codec:"sessionID" json:"sessionID"`
	Passphrase string `codec:"passphrase" json:"passphrase"`
}

type LoginInterface interface {
	GetConfiguredAccounts(context.Context, int) ([]ConfiguredAccount, error)
	Login(context.Context, LoginArg) error
	ClearStoredSecret(context.Context, ClearStoredSecretArg) error
	Logout(context.Context, int) error
	Deprovision(context.Context, DeprovisionArg) error
	RecoverAccountFromEmailAddress(context.Context, string) error
	PaperKey(context.Context, int) error
	Unlock(context.Context, int) error
	UnlockWithPassphrase(context.Context, UnlockWithPassphraseArg) error
}

func LoginProtocol(i LoginInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.login",
		Methods: map[string]rpc.ServeHandlerDescription{
			"getConfiguredAccounts": {
				MakeArg: func() interface{} {
					ret := make([]GetConfiguredAccountsArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]GetConfiguredAccountsArg)
					if !ok {
						err = rpc.NewTypeError((*[]GetConfiguredAccountsArg)(nil), args)
						return
					}
					ret, err = i.GetConfiguredAccounts(ctx, (*typedArgs)[0].SessionID)
					return
				},
				MethodType: rpc.MethodCall,
			},
			"login": {
				MakeArg: func() interface{} {
					ret := make([]LoginArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]LoginArg)
					if !ok {
						err = rpc.NewTypeError((*[]LoginArg)(nil), args)
						return
					}
					err = i.Login(ctx, (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"clearStoredSecret": {
				MakeArg: func() interface{} {
					ret := make([]ClearStoredSecretArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]ClearStoredSecretArg)
					if !ok {
						err = rpc.NewTypeError((*[]ClearStoredSecretArg)(nil), args)
						return
					}
					err = i.ClearStoredSecret(ctx, (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"logout": {
				MakeArg: func() interface{} {
					ret := make([]LogoutArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]LogoutArg)
					if !ok {
						err = rpc.NewTypeError((*[]LogoutArg)(nil), args)
						return
					}
					err = i.Logout(ctx, (*typedArgs)[0].SessionID)
					return
				},
				MethodType: rpc.MethodCall,
			},
			"deprovision": {
				MakeArg: func() interface{} {
					ret := make([]DeprovisionArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]DeprovisionArg)
					if !ok {
						err = rpc.NewTypeError((*[]DeprovisionArg)(nil), args)
						return
					}
					err = i.Deprovision(ctx, (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"recoverAccountFromEmailAddress": {
				MakeArg: func() interface{} {
					ret := make([]RecoverAccountFromEmailAddressArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]RecoverAccountFromEmailAddressArg)
					if !ok {
						err = rpc.NewTypeError((*[]RecoverAccountFromEmailAddressArg)(nil), args)
						return
					}
					err = i.RecoverAccountFromEmailAddress(ctx, (*typedArgs)[0].Email)
					return
				},
				MethodType: rpc.MethodCall,
			},
			"paperKey": {
				MakeArg: func() interface{} {
					ret := make([]PaperKeyArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]PaperKeyArg)
					if !ok {
						err = rpc.NewTypeError((*[]PaperKeyArg)(nil), args)
						return
					}
					err = i.PaperKey(ctx, (*typedArgs)[0].SessionID)
					return
				},
				MethodType: rpc.MethodCall,
			},
			"unlock": {
				MakeArg: func() interface{} {
					ret := make([]UnlockArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]UnlockArg)
					if !ok {
						err = rpc.NewTypeError((*[]UnlockArg)(nil), args)
						return
					}
					err = i.Unlock(ctx, (*typedArgs)[0].SessionID)
					return
				},
				MethodType: rpc.MethodCall,
			},
			"unlockWithPassphrase": {
				MakeArg: func() interface{} {
					ret := make([]UnlockWithPassphraseArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]UnlockWithPassphraseArg)
					if !ok {
						err = rpc.NewTypeError((*[]UnlockWithPassphraseArg)(nil), args)
						return
					}
					err = i.UnlockWithPassphrase(ctx, (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
		},
	}
}

type LoginClient struct {
	Cli GenericClient
}

func (c LoginClient) GetConfiguredAccounts(ctx context.Context, sessionID int) (res []ConfiguredAccount, err error) {
	__arg := GetConfiguredAccountsArg{SessionID: sessionID}
	err = c.Cli.Call(ctx, "keybase.1.login.getConfiguredAccounts", []interface{}{__arg}, &res)
	return
}

func (c LoginClient) Login(ctx context.Context, __arg LoginArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.login.login", []interface{}{__arg}, nil)
	return
}

func (c LoginClient) ClearStoredSecret(ctx context.Context, __arg ClearStoredSecretArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.login.clearStoredSecret", []interface{}{__arg}, nil)
	return
}

func (c LoginClient) Logout(ctx context.Context, sessionID int) (err error) {
	__arg := LogoutArg{SessionID: sessionID}
	err = c.Cli.Call(ctx, "keybase.1.login.logout", []interface{}{__arg}, nil)
	return
}

func (c LoginClient) Deprovision(ctx context.Context, __arg DeprovisionArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.login.deprovision", []interface{}{__arg}, nil)
	return
}

func (c LoginClient) RecoverAccountFromEmailAddress(ctx context.Context, email string) (err error) {
	__arg := RecoverAccountFromEmailAddressArg{Email: email}
	err = c.Cli.Call(ctx, "keybase.1.login.recoverAccountFromEmailAddress", []interface{}{__arg}, nil)
	return
}

func (c LoginClient) PaperKey(ctx context.Context, sessionID int) (err error) {
	__arg := PaperKeyArg{SessionID: sessionID}
	err = c.Cli.Call(ctx, "keybase.1.login.paperKey", []interface{}{__arg}, nil)
	return
}

func (c LoginClient) Unlock(ctx context.Context, sessionID int) (err error) {
	__arg := UnlockArg{SessionID: sessionID}
	err = c.Cli.Call(ctx, "keybase.1.login.unlock", []interface{}{__arg}, nil)
	return
}

func (c LoginClient) UnlockWithPassphrase(ctx context.Context, __arg UnlockWithPassphraseArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.login.unlockWithPassphrase", []interface{}{__arg}, nil)
	return
}

type GetEmailOrUsernameArg struct {
	SessionID int `codec:"sessionID" json:"sessionID"`
}

type PromptRevokePaperKeysArg struct {
	SessionID int    `codec:"sessionID" json:"sessionID"`
	Device    Device `codec:"device" json:"device"`
	Index     int    `codec:"index" json:"index"`
}

type DisplayPaperKeyPhraseArg struct {
	SessionID int    `codec:"sessionID" json:"sessionID"`
	Phrase    string `codec:"phrase" json:"phrase"`
}

type DisplayPrimaryPaperKeyArg struct {
	SessionID int    `codec:"sessionID" json:"sessionID"`
	Phrase    string `codec:"phrase" json:"phrase"`
}

type LoginUiInterface interface {
	GetEmailOrUsername(context.Context, int) (string, error)
	PromptRevokePaperKeys(context.Context, PromptRevokePaperKeysArg) (bool, error)
	DisplayPaperKeyPhrase(context.Context, DisplayPaperKeyPhraseArg) error
	DisplayPrimaryPaperKey(context.Context, DisplayPrimaryPaperKeyArg) error
}

func LoginUiProtocol(i LoginUiInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.loginUi",
		Methods: map[string]rpc.ServeHandlerDescription{
			"getEmailOrUsername": {
				MakeArg: func() interface{} {
					ret := make([]GetEmailOrUsernameArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]GetEmailOrUsernameArg)
					if !ok {
						err = rpc.NewTypeError((*[]GetEmailOrUsernameArg)(nil), args)
						return
					}
					ret, err = i.GetEmailOrUsername(ctx, (*typedArgs)[0].SessionID)
					return
				},
				MethodType: rpc.MethodCall,
			},
			"promptRevokePaperKeys": {
				MakeArg: func() interface{} {
					ret := make([]PromptRevokePaperKeysArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]PromptRevokePaperKeysArg)
					if !ok {
						err = rpc.NewTypeError((*[]PromptRevokePaperKeysArg)(nil), args)
						return
					}
					ret, err = i.PromptRevokePaperKeys(ctx, (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"displayPaperKeyPhrase": {
				MakeArg: func() interface{} {
					ret := make([]DisplayPaperKeyPhraseArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]DisplayPaperKeyPhraseArg)
					if !ok {
						err = rpc.NewTypeError((*[]DisplayPaperKeyPhraseArg)(nil), args)
						return
					}
					err = i.DisplayPaperKeyPhrase(ctx, (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"displayPrimaryPaperKey": {
				MakeArg: func() interface{} {
					ret := make([]DisplayPrimaryPaperKeyArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]DisplayPrimaryPaperKeyArg)
					if !ok {
						err = rpc.NewTypeError((*[]DisplayPrimaryPaperKeyArg)(nil), args)
						return
					}
					err = i.DisplayPrimaryPaperKey(ctx, (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
		},
	}
}

type LoginUiClient struct {
	Cli GenericClient
}

func (c LoginUiClient) GetEmailOrUsername(ctx context.Context, sessionID int) (res string, err error) {
	__arg := GetEmailOrUsernameArg{SessionID: sessionID}
	err = c.Cli.Call(ctx, "keybase.1.loginUi.getEmailOrUsername", []interface{}{__arg}, &res)
	return
}

func (c LoginUiClient) PromptRevokePaperKeys(ctx context.Context, __arg PromptRevokePaperKeysArg) (res bool, err error) {
	err = c.Cli.Call(ctx, "keybase.1.loginUi.promptRevokePaperKeys", []interface{}{__arg}, &res)
	return
}

func (c LoginUiClient) DisplayPaperKeyPhrase(ctx context.Context, __arg DisplayPaperKeyPhraseArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.loginUi.displayPaperKeyPhrase", []interface{}{__arg}, nil)
	return
}

func (c LoginUiClient) DisplayPrimaryPaperKey(ctx context.Context, __arg DisplayPrimaryPaperKeyArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.loginUi.displayPrimaryPaperKey", []interface{}{__arg}, nil)
	return
}

type KeyHalf struct {
	User      UID    `codec:"user" json:"user"`
	DeviceKID KID    `codec:"deviceKID" json:"deviceKID"`
	Key       []byte `codec:"key" json:"key"`
}

type MDBlock struct {
	Version int    `codec:"version" json:"version"`
	Block   []byte `codec:"block" json:"block"`
}

type MetadataResponse struct {
	FolderID string    `codec:"folderID" json:"folderID"`
	MdBlocks []MDBlock `codec:"mdBlocks" json:"mdBlocks"`
}

type GetChallengeArg struct {
}

type AuthenticateArg struct {
	Signature string `codec:"signature" json:"signature"`
}

type PutMetadataArg struct {
	MdBlock MDBlock           `codec:"mdBlock" json:"mdBlock"`
	LogTags map[string]string `codec:"logTags" json:"logTags"`
}

type GetMetadataArg struct {
	FolderID      string            `codec:"folderID" json:"folderID"`
	FolderHandle  []byte            `codec:"folderHandle" json:"folderHandle"`
	BranchID      string            `codec:"branchID" json:"branchID"`
	Unmerged      bool              `codec:"unmerged" json:"unmerged"`
	StartRevision int64             `codec:"startRevision" json:"startRevision"`
	StopRevision  int64             `codec:"stopRevision" json:"stopRevision"`
	LogTags       map[string]string `codec:"logTags" json:"logTags"`
}

type RegisterForUpdatesArg struct {
	FolderID     string            `codec:"folderID" json:"folderID"`
	CurrRevision int64             `codec:"currRevision" json:"currRevision"`
	LogTags      map[string]string `codec:"logTags" json:"logTags"`
}

type PruneBranchArg struct {
	FolderID string            `codec:"folderID" json:"folderID"`
	BranchID string            `codec:"branchID" json:"branchID"`
	LogTags  map[string]string `codec:"logTags" json:"logTags"`
}

type PutKeysArg struct {
	KeyHalves []KeyHalf         `codec:"keyHalves" json:"keyHalves"`
	LogTags   map[string]string `codec:"logTags" json:"logTags"`
}

type GetKeyArg struct {
	KeyHalfID []byte            `codec:"keyHalfID" json:"keyHalfID"`
	DeviceKID string            `codec:"deviceKID" json:"deviceKID"`
	LogTags   map[string]string `codec:"logTags" json:"logTags"`
}

type DeleteKeyArg struct {
	Uid       UID               `codec:"uid" json:"uid"`
	DeviceKID KID               `codec:"deviceKID" json:"deviceKID"`
	KeyHalfID []byte            `codec:"keyHalfID" json:"keyHalfID"`
	LogTags   map[string]string `codec:"logTags" json:"logTags"`
}

type TruncateLockArg struct {
	FolderID string `codec:"folderID" json:"folderID"`
}

type TruncateUnlockArg struct {
	FolderID string `codec:"folderID" json:"folderID"`
}

type GetFolderHandleArg struct {
	FolderID  string `codec:"folderID" json:"folderID"`
	Signature string `codec:"signature" json:"signature"`
	Challenge string `codec:"challenge" json:"challenge"`
}

type GetFoldersForRekeyArg struct {
	DeviceKID KID `codec:"deviceKID" json:"deviceKID"`
}

type PingArg struct {
}

type MetadataInterface interface {
	GetChallenge(context.Context) (ChallengeInfo, error)
	Authenticate(context.Context, string) (int, error)
	PutMetadata(context.Context, PutMetadataArg) error
	GetMetadata(context.Context, GetMetadataArg) (MetadataResponse, error)
	RegisterForUpdates(context.Context, RegisterForUpdatesArg) error
	PruneBranch(context.Context, PruneBranchArg) error
	PutKeys(context.Context, PutKeysArg) error
	GetKey(context.Context, GetKeyArg) ([]byte, error)
	DeleteKey(context.Context, DeleteKeyArg) error
	TruncateLock(context.Context, string) (bool, error)
	TruncateUnlock(context.Context, string) (bool, error)
	GetFolderHandle(context.Context, GetFolderHandleArg) ([]byte, error)
	GetFoldersForRekey(context.Context, KID) error
	Ping(context.Context) error
}

func MetadataProtocol(i MetadataInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.metadata",
		Methods: map[string]rpc.ServeHandlerDescription{
			"getChallenge": {
				MakeArg: func() interface{} {
					ret := make([]GetChallengeArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					ret, err = i.GetChallenge(ctx)
					return
				},
				MethodType: rpc.MethodCall,
			},
			"authenticate": {
				MakeArg: func() interface{} {
					ret := make([]AuthenticateArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]AuthenticateArg)
					if !ok {
						err = rpc.NewTypeError((*[]AuthenticateArg)(nil), args)
						return
					}
					ret, err = i.Authenticate(ctx, (*typedArgs)[0].Signature)
					return
				},
				MethodType: rpc.MethodCall,
			},
			"putMetadata": {
				MakeArg: func() interface{} {
					ret := make([]PutMetadataArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]PutMetadataArg)
					if !ok {
						err = rpc.NewTypeError((*[]PutMetadataArg)(nil), args)
						return
					}
					err = i.PutMetadata(ctx, (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"getMetadata": {
				MakeArg: func() interface{} {
					ret := make([]GetMetadataArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]GetMetadataArg)
					if !ok {
						err = rpc.NewTypeError((*[]GetMetadataArg)(nil), args)
						return
					}
					ret, err = i.GetMetadata(ctx, (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"registerForUpdates": {
				MakeArg: func() interface{} {
					ret := make([]RegisterForUpdatesArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]RegisterForUpdatesArg)
					if !ok {
						err = rpc.NewTypeError((*[]RegisterForUpdatesArg)(nil), args)
						return
					}
					err = i.RegisterForUpdates(ctx, (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"pruneBranch": {
				MakeArg: func() interface{} {
					ret := make([]PruneBranchArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]PruneBranchArg)
					if !ok {
						err = rpc.NewTypeError((*[]PruneBranchArg)(nil), args)
						return
					}
					err = i.PruneBranch(ctx, (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"putKeys": {
				MakeArg: func() interface{} {
					ret := make([]PutKeysArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]PutKeysArg)
					if !ok {
						err = rpc.NewTypeError((*[]PutKeysArg)(nil), args)
						return
					}
					err = i.PutKeys(ctx, (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"getKey": {
				MakeArg: func() interface{} {
					ret := make([]GetKeyArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]GetKeyArg)
					if !ok {
						err = rpc.NewTypeError((*[]GetKeyArg)(nil), args)
						return
					}
					ret, err = i.GetKey(ctx, (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"deleteKey": {
				MakeArg: func() interface{} {
					ret := make([]DeleteKeyArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]DeleteKeyArg)
					if !ok {
						err = rpc.NewTypeError((*[]DeleteKeyArg)(nil), args)
						return
					}
					err = i.DeleteKey(ctx, (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"truncateLock": {
				MakeArg: func() interface{} {
					ret := make([]TruncateLockArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]TruncateLockArg)
					if !ok {
						err = rpc.NewTypeError((*[]TruncateLockArg)(nil), args)
						return
					}
					ret, err = i.TruncateLock(ctx, (*typedArgs)[0].FolderID)
					return
				},
				MethodType: rpc.MethodCall,
			},
			"truncateUnlock": {
				MakeArg: func() interface{} {
					ret := make([]TruncateUnlockArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]TruncateUnlockArg)
					if !ok {
						err = rpc.NewTypeError((*[]TruncateUnlockArg)(nil), args)
						return
					}
					ret, err = i.TruncateUnlock(ctx, (*typedArgs)[0].FolderID)
					return
				},
				MethodType: rpc.MethodCall,
			},
			"getFolderHandle": {
				MakeArg: func() interface{} {
					ret := make([]GetFolderHandleArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]GetFolderHandleArg)
					if !ok {
						err = rpc.NewTypeError((*[]GetFolderHandleArg)(nil), args)
						return
					}
					ret, err = i.GetFolderHandle(ctx, (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"getFoldersForRekey": {
				MakeArg: func() interface{} {
					ret := make([]GetFoldersForRekeyArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]GetFoldersForRekeyArg)
					if !ok {
						err = rpc.NewTypeError((*[]GetFoldersForRekeyArg)(nil), args)
						return
					}
					err = i.GetFoldersForRekey(ctx, (*typedArgs)[0].DeviceKID)
					return
				},
				MethodType: rpc.MethodCall,
			},
			"ping": {
				MakeArg: func() interface{} {
					ret := make([]PingArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					err = i.Ping(ctx)
					return
				},
				MethodType: rpc.MethodCall,
			},
		},
	}
}

type MetadataClient struct {
	Cli GenericClient
}

func (c MetadataClient) GetChallenge(ctx context.Context) (res ChallengeInfo, err error) {
	err = c.Cli.Call(ctx, "keybase.1.metadata.getChallenge", []interface{}{GetChallengeArg{}}, &res)
	return
}

func (c MetadataClient) Authenticate(ctx context.Context, signature string) (res int, err error) {
	__arg := AuthenticateArg{Signature: signature}
	err = c.Cli.Call(ctx, "keybase.1.metadata.authenticate", []interface{}{__arg}, &res)
	return
}

func (c MetadataClient) PutMetadata(ctx context.Context, __arg PutMetadataArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.metadata.putMetadata", []interface{}{__arg}, nil)
	return
}

func (c MetadataClient) GetMetadata(ctx context.Context, __arg GetMetadataArg) (res MetadataResponse, err error) {
	err = c.Cli.Call(ctx, "keybase.1.metadata.getMetadata", []interface{}{__arg}, &res)
	return
}

func (c MetadataClient) RegisterForUpdates(ctx context.Context, __arg RegisterForUpdatesArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.metadata.registerForUpdates", []interface{}{__arg}, nil)
	return
}

func (c MetadataClient) PruneBranch(ctx context.Context, __arg PruneBranchArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.metadata.pruneBranch", []interface{}{__arg}, nil)
	return
}

func (c MetadataClient) PutKeys(ctx context.Context, __arg PutKeysArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.metadata.putKeys", []interface{}{__arg}, nil)
	return
}

func (c MetadataClient) GetKey(ctx context.Context, __arg GetKeyArg) (res []byte, err error) {
	err = c.Cli.Call(ctx, "keybase.1.metadata.getKey", []interface{}{__arg}, &res)
	return
}

func (c MetadataClient) DeleteKey(ctx context.Context, __arg DeleteKeyArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.metadata.deleteKey", []interface{}{__arg}, nil)
	return
}

func (c MetadataClient) TruncateLock(ctx context.Context, folderID string) (res bool, err error) {
	__arg := TruncateLockArg{FolderID: folderID}
	err = c.Cli.Call(ctx, "keybase.1.metadata.truncateLock", []interface{}{__arg}, &res)
	return
}

func (c MetadataClient) TruncateUnlock(ctx context.Context, folderID string) (res bool, err error) {
	__arg := TruncateUnlockArg{FolderID: folderID}
	err = c.Cli.Call(ctx, "keybase.1.metadata.truncateUnlock", []interface{}{__arg}, &res)
	return
}

func (c MetadataClient) GetFolderHandle(ctx context.Context, __arg GetFolderHandleArg) (res []byte, err error) {
	err = c.Cli.Call(ctx, "keybase.1.metadata.getFolderHandle", []interface{}{__arg}, &res)
	return
}

func (c MetadataClient) GetFoldersForRekey(ctx context.Context, deviceKID KID) (err error) {
	__arg := GetFoldersForRekeyArg{DeviceKID: deviceKID}
	err = c.Cli.Call(ctx, "keybase.1.metadata.getFoldersForRekey", []interface{}{__arg}, nil)
	return
}

func (c MetadataClient) Ping(ctx context.Context) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.metadata.ping", []interface{}{PingArg{}}, nil)
	return
}

type MetadataUpdateArg struct {
	FolderID string `codec:"folderID" json:"folderID"`
	Revision int64  `codec:"revision" json:"revision"`
}

type FolderNeedsRekeyArg struct {
	FolderID string `codec:"folderID" json:"folderID"`
	Revision int64  `codec:"revision" json:"revision"`
}

type MetadataUpdateInterface interface {
	MetadataUpdate(context.Context, MetadataUpdateArg) error
	FolderNeedsRekey(context.Context, FolderNeedsRekeyArg) error
}

func MetadataUpdateProtocol(i MetadataUpdateInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.metadataUpdate",
		Methods: map[string]rpc.ServeHandlerDescription{
			"metadataUpdate": {
				MakeArg: func() interface{} {
					ret := make([]MetadataUpdateArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]MetadataUpdateArg)
					if !ok {
						err = rpc.NewTypeError((*[]MetadataUpdateArg)(nil), args)
						return
					}
					err = i.MetadataUpdate(ctx, (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"folderNeedsRekey": {
				MakeArg: func() interface{} {
					ret := make([]FolderNeedsRekeyArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]FolderNeedsRekeyArg)
					if !ok {
						err = rpc.NewTypeError((*[]FolderNeedsRekeyArg)(nil), args)
						return
					}
					err = i.FolderNeedsRekey(ctx, (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
		},
	}
}

type MetadataUpdateClient struct {
	Cli GenericClient
}

func (c MetadataUpdateClient) MetadataUpdate(ctx context.Context, __arg MetadataUpdateArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.metadataUpdate.metadataUpdate", []interface{}{__arg}, nil)
	return
}

func (c MetadataUpdateClient) FolderNeedsRekey(ctx context.Context, __arg FolderNeedsRekeyArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.metadataUpdate.folderNeedsRekey", []interface{}{__arg}, nil)
	return
}

type NotificationChannels struct {
	Session  bool `codec:"session" json:"session"`
	Users    bool `codec:"users" json:"users"`
	Kbfs     bool `codec:"kbfs" json:"kbfs"`
	Tracking bool `codec:"tracking" json:"tracking"`
}

type SetNotificationsArg struct {
	Channels NotificationChannels `codec:"channels" json:"channels"`
}

type NotifyCtlInterface interface {
	SetNotifications(context.Context, NotificationChannels) error
}

func NotifyCtlProtocol(i NotifyCtlInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.notifyCtl",
		Methods: map[string]rpc.ServeHandlerDescription{
			"setNotifications": {
				MakeArg: func() interface{} {
					ret := make([]SetNotificationsArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]SetNotificationsArg)
					if !ok {
						err = rpc.NewTypeError((*[]SetNotificationsArg)(nil), args)
						return
					}
					err = i.SetNotifications(ctx, (*typedArgs)[0].Channels)
					return
				},
				MethodType: rpc.MethodCall,
			},
		},
	}
}

type NotifyCtlClient struct {
	Cli GenericClient
}

func (c NotifyCtlClient) SetNotifications(ctx context.Context, channels NotificationChannels) (err error) {
	__arg := SetNotificationsArg{Channels: channels}
	err = c.Cli.Call(ctx, "keybase.1.notifyCtl.setNotifications", []interface{}{__arg}, nil)
	return
}

type FSActivityArg struct {
	Notification FSNotification `codec:"notification" json:"notification"`
}

type NotifyFSInterface interface {
	FSActivity(context.Context, FSNotification) error
}

func NotifyFSProtocol(i NotifyFSInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.NotifyFS",
		Methods: map[string]rpc.ServeHandlerDescription{
			"FSActivity": {
				MakeArg: func() interface{} {
					ret := make([]FSActivityArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]FSActivityArg)
					if !ok {
						err = rpc.NewTypeError((*[]FSActivityArg)(nil), args)
						return
					}
					err = i.FSActivity(ctx, (*typedArgs)[0].Notification)
					return
				},
				MethodType: rpc.MethodNotify,
			},
		},
	}
}

type NotifyFSClient struct {
	Cli GenericClient
}

func (c NotifyFSClient) FSActivity(ctx context.Context, notification FSNotification) (err error) {
	__arg := FSActivityArg{Notification: notification}
	err = c.Cli.Notify(ctx, "keybase.1.NotifyFS.FSActivity", []interface{}{__arg})
	return
}

type LoggedOutArg struct {
}

type LoggedInArg struct {
	Username string `codec:"username" json:"username"`
}

type NotifySessionInterface interface {
	LoggedOut(context.Context) error
	LoggedIn(context.Context, string) error
}

func NotifySessionProtocol(i NotifySessionInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.NotifySession",
		Methods: map[string]rpc.ServeHandlerDescription{
			"loggedOut": {
				MakeArg: func() interface{} {
					ret := make([]LoggedOutArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					err = i.LoggedOut(ctx)
					return
				},
				MethodType: rpc.MethodNotify,
			},
			"loggedIn": {
				MakeArg: func() interface{} {
					ret := make([]LoggedInArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]LoggedInArg)
					if !ok {
						err = rpc.NewTypeError((*[]LoggedInArg)(nil), args)
						return
					}
					err = i.LoggedIn(ctx, (*typedArgs)[0].Username)
					return
				},
				MethodType: rpc.MethodCall,
			},
		},
	}
}

type NotifySessionClient struct {
	Cli GenericClient
}

func (c NotifySessionClient) LoggedOut(ctx context.Context) (err error) {
	err = c.Cli.Notify(ctx, "keybase.1.NotifySession.loggedOut", []interface{}{LoggedOutArg{}})
	return
}

func (c NotifySessionClient) LoggedIn(ctx context.Context, username string) (err error) {
	__arg := LoggedInArg{Username: username}
	err = c.Cli.Call(ctx, "keybase.1.NotifySession.loggedIn", []interface{}{__arg}, nil)
	return
}

type TrackingChangedArg struct {
	Uid      UID    `codec:"uid" json:"uid"`
	Username string `codec:"username" json:"username"`
}

type NotifyTrackingInterface interface {
	TrackingChanged(context.Context, TrackingChangedArg) error
}

func NotifyTrackingProtocol(i NotifyTrackingInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.NotifyTracking",
		Methods: map[string]rpc.ServeHandlerDescription{
			"trackingChanged": {
				MakeArg: func() interface{} {
					ret := make([]TrackingChangedArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]TrackingChangedArg)
					if !ok {
						err = rpc.NewTypeError((*[]TrackingChangedArg)(nil), args)
						return
					}
					err = i.TrackingChanged(ctx, (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodNotify,
			},
		},
	}
}

type NotifyTrackingClient struct {
	Cli GenericClient
}

func (c NotifyTrackingClient) TrackingChanged(ctx context.Context, __arg TrackingChangedArg) (err error) {
	err = c.Cli.Notify(ctx, "keybase.1.NotifyTracking.trackingChanged", []interface{}{__arg})
	return
}

type UserChangedArg struct {
	Uid UID `codec:"uid" json:"uid"`
}

type NotifyUsersInterface interface {
	UserChanged(context.Context, UID) error
}

func NotifyUsersProtocol(i NotifyUsersInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.NotifyUsers",
		Methods: map[string]rpc.ServeHandlerDescription{
			"userChanged": {
				MakeArg: func() interface{} {
					ret := make([]UserChangedArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]UserChangedArg)
					if !ok {
						err = rpc.NewTypeError((*[]UserChangedArg)(nil), args)
						return
					}
					err = i.UserChanged(ctx, (*typedArgs)[0].Uid)
					return
				},
				MethodType: rpc.MethodNotify,
			},
		},
	}
}

type NotifyUsersClient struct {
	Cli GenericClient
}

func (c NotifyUsersClient) UserChanged(ctx context.Context, uid UID) (err error) {
	__arg := UserChangedArg{Uid: uid}
	err = c.Cli.Notify(ctx, "keybase.1.NotifyUsers.userChanged", []interface{}{__arg})
	return
}

type SignMode int

const (
	SignMode_ATTACHED SignMode = 0
	SignMode_DETACHED SignMode = 1
	SignMode_CLEAR    SignMode = 2
)

type PGPSignOptions struct {
	KeyQuery  string   `codec:"keyQuery" json:"keyQuery"`
	Mode      SignMode `codec:"mode" json:"mode"`
	BinaryIn  bool     `codec:"binaryIn" json:"binaryIn"`
	BinaryOut bool     `codec:"binaryOut" json:"binaryOut"`
}

type PGPEncryptOptions struct {
	Recipients []string `codec:"recipients" json:"recipients"`
	NoSign     bool     `codec:"noSign" json:"noSign"`
	NoSelf     bool     `codec:"noSelf" json:"noSelf"`
	BinaryOut  bool     `codec:"binaryOut" json:"binaryOut"`
	KeyQuery   string   `codec:"keyQuery" json:"keyQuery"`
}

type PGPSigVerification struct {
	IsSigned bool      `codec:"isSigned" json:"isSigned"`
	Verified bool      `codec:"verified" json:"verified"`
	Signer   User      `codec:"signer" json:"signer"`
	SignKey  PublicKey `codec:"signKey" json:"signKey"`
}

type PGPDecryptOptions struct {
	AssertSigned bool   `codec:"assertSigned" json:"assertSigned"`
	SignedBy     string `codec:"signedBy" json:"signedBy"`
}

type PGPVerifyOptions struct {
	SignedBy  string `codec:"signedBy" json:"signedBy"`
	Signature []byte `codec:"signature" json:"signature"`
}

type KeyInfo struct {
	Fingerprint string `codec:"fingerprint" json:"fingerprint"`
	Key         string `codec:"key" json:"key"`
	Desc        string `codec:"desc" json:"desc"`
}

type PGPQuery struct {
	Secret     bool   `codec:"secret" json:"secret"`
	Query      string `codec:"query" json:"query"`
	ExactMatch bool   `codec:"exactMatch" json:"exactMatch"`
}

type PGPCreateUids struct {
	UseDefault bool          `codec:"useDefault" json:"useDefault"`
	Ids        []PGPIdentity `codec:"ids" json:"ids"`
}

type PGPSignArg struct {
	SessionID int            `codec:"sessionID" json:"sessionID"`
	Source    Stream         `codec:"source" json:"source"`
	Sink      Stream         `codec:"sink" json:"sink"`
	Opts      PGPSignOptions `codec:"opts" json:"opts"`
}

type PGPPullArg struct {
	SessionID   int      `codec:"sessionID" json:"sessionID"`
	UserAsserts []string `codec:"userAsserts" json:"userAsserts"`
}

type PGPEncryptArg struct {
	SessionID int               `codec:"sessionID" json:"sessionID"`
	Source    Stream            `codec:"source" json:"source"`
	Sink      Stream            `codec:"sink" json:"sink"`
	Opts      PGPEncryptOptions `codec:"opts" json:"opts"`
}

type PGPDecryptArg struct {
	SessionID int               `codec:"sessionID" json:"sessionID"`
	Source    Stream            `codec:"source" json:"source"`
	Sink      Stream            `codec:"sink" json:"sink"`
	Opts      PGPDecryptOptions `codec:"opts" json:"opts"`
}

type PGPVerifyArg struct {
	SessionID int              `codec:"sessionID" json:"sessionID"`
	Source    Stream           `codec:"source" json:"source"`
	Opts      PGPVerifyOptions `codec:"opts" json:"opts"`
}

type PGPImportArg struct {
	SessionID  int    `codec:"sessionID" json:"sessionID"`
	Key        []byte `codec:"key" json:"key"`
	PushSecret bool   `codec:"pushSecret" json:"pushSecret"`
}

type PGPExportArg struct {
	SessionID int      `codec:"sessionID" json:"sessionID"`
	Options   PGPQuery `codec:"options" json:"options"`
}

type PGPExportByFingerprintArg struct {
	SessionID int      `codec:"sessionID" json:"sessionID"`
	Options   PGPQuery `codec:"options" json:"options"`
}

type PGPExportByKIDArg struct {
	SessionID int      `codec:"sessionID" json:"sessionID"`
	Options   PGPQuery `codec:"options" json:"options"`
}

type PGPKeyGenArg struct {
	SessionID   int           `codec:"sessionID" json:"sessionID"`
	PrimaryBits int           `codec:"primaryBits" json:"primaryBits"`
	SubkeyBits  int           `codec:"subkeyBits" json:"subkeyBits"`
	CreateUids  PGPCreateUids `codec:"createUids" json:"createUids"`
	AllowMulti  bool          `codec:"allowMulti" json:"allowMulti"`
	DoExport    bool          `codec:"doExport" json:"doExport"`
	PushSecret  bool          `codec:"pushSecret" json:"pushSecret"`
}

type PGPDeletePrimaryArg struct {
	SessionID int `codec:"sessionID" json:"sessionID"`
}

type PGPSelectArg struct {
	SessionID        int    `codec:"sessionID" json:"sessionID"`
	FingerprintQuery string `codec:"fingerprintQuery" json:"fingerprintQuery"`
	AllowMulti       bool   `codec:"allowMulti" json:"allowMulti"`
	SkipImport       bool   `codec:"skipImport" json:"skipImport"`
	OnlyImport       bool   `codec:"onlyImport" json:"onlyImport"`
}

type PGPUpdateArg struct {
	SessionID    int      `codec:"sessionID" json:"sessionID"`
	All          bool     `codec:"all" json:"all"`
	Fingerprints []string `codec:"fingerprints" json:"fingerprints"`
}

type PGPInterface interface {
	PGPSign(context.Context, PGPSignArg) error
	PGPPull(context.Context, PGPPullArg) error
	PGPEncrypt(context.Context, PGPEncryptArg) error
	PGPDecrypt(context.Context, PGPDecryptArg) (PGPSigVerification, error)
	PGPVerify(context.Context, PGPVerifyArg) (PGPSigVerification, error)
	PGPImport(context.Context, PGPImportArg) error
	PGPExport(context.Context, PGPExportArg) ([]KeyInfo, error)
	PGPExportByFingerprint(context.Context, PGPExportByFingerprintArg) ([]KeyInfo, error)
	PGPExportByKID(context.Context, PGPExportByKIDArg) ([]KeyInfo, error)
	PGPKeyGen(context.Context, PGPKeyGenArg) error
	PGPDeletePrimary(context.Context, int) error
	PGPSelect(context.Context, PGPSelectArg) error
	PGPUpdate(context.Context, PGPUpdateArg) error
}

func PGPProtocol(i PGPInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.pgp",
		Methods: map[string]rpc.ServeHandlerDescription{
			"pgpSign": {
				MakeArg: func() interface{} {
					ret := make([]PGPSignArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]PGPSignArg)
					if !ok {
						err = rpc.NewTypeError((*[]PGPSignArg)(nil), args)
						return
					}
					err = i.PGPSign(ctx, (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"pgpPull": {
				MakeArg: func() interface{} {
					ret := make([]PGPPullArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]PGPPullArg)
					if !ok {
						err = rpc.NewTypeError((*[]PGPPullArg)(nil), args)
						return
					}
					err = i.PGPPull(ctx, (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"pgpEncrypt": {
				MakeArg: func() interface{} {
					ret := make([]PGPEncryptArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]PGPEncryptArg)
					if !ok {
						err = rpc.NewTypeError((*[]PGPEncryptArg)(nil), args)
						return
					}
					err = i.PGPEncrypt(ctx, (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"pgpDecrypt": {
				MakeArg: func() interface{} {
					ret := make([]PGPDecryptArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]PGPDecryptArg)
					if !ok {
						err = rpc.NewTypeError((*[]PGPDecryptArg)(nil), args)
						return
					}
					ret, err = i.PGPDecrypt(ctx, (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"pgpVerify": {
				MakeArg: func() interface{} {
					ret := make([]PGPVerifyArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]PGPVerifyArg)
					if !ok {
						err = rpc.NewTypeError((*[]PGPVerifyArg)(nil), args)
						return
					}
					ret, err = i.PGPVerify(ctx, (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"pgpImport": {
				MakeArg: func() interface{} {
					ret := make([]PGPImportArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]PGPImportArg)
					if !ok {
						err = rpc.NewTypeError((*[]PGPImportArg)(nil), args)
						return
					}
					err = i.PGPImport(ctx, (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"pgpExport": {
				MakeArg: func() interface{} {
					ret := make([]PGPExportArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]PGPExportArg)
					if !ok {
						err = rpc.NewTypeError((*[]PGPExportArg)(nil), args)
						return
					}
					ret, err = i.PGPExport(ctx, (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"pgpExportByFingerprint": {
				MakeArg: func() interface{} {
					ret := make([]PGPExportByFingerprintArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]PGPExportByFingerprintArg)
					if !ok {
						err = rpc.NewTypeError((*[]PGPExportByFingerprintArg)(nil), args)
						return
					}
					ret, err = i.PGPExportByFingerprint(ctx, (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"pgpExportByKID": {
				MakeArg: func() interface{} {
					ret := make([]PGPExportByKIDArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]PGPExportByKIDArg)
					if !ok {
						err = rpc.NewTypeError((*[]PGPExportByKIDArg)(nil), args)
						return
					}
					ret, err = i.PGPExportByKID(ctx, (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"pgpKeyGen": {
				MakeArg: func() interface{} {
					ret := make([]PGPKeyGenArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]PGPKeyGenArg)
					if !ok {
						err = rpc.NewTypeError((*[]PGPKeyGenArg)(nil), args)
						return
					}
					err = i.PGPKeyGen(ctx, (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"pgpDeletePrimary": {
				MakeArg: func() interface{} {
					ret := make([]PGPDeletePrimaryArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]PGPDeletePrimaryArg)
					if !ok {
						err = rpc.NewTypeError((*[]PGPDeletePrimaryArg)(nil), args)
						return
					}
					err = i.PGPDeletePrimary(ctx, (*typedArgs)[0].SessionID)
					return
				},
				MethodType: rpc.MethodCall,
			},
			"pgpSelect": {
				MakeArg: func() interface{} {
					ret := make([]PGPSelectArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]PGPSelectArg)
					if !ok {
						err = rpc.NewTypeError((*[]PGPSelectArg)(nil), args)
						return
					}
					err = i.PGPSelect(ctx, (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"pgpUpdate": {
				MakeArg: func() interface{} {
					ret := make([]PGPUpdateArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]PGPUpdateArg)
					if !ok {
						err = rpc.NewTypeError((*[]PGPUpdateArg)(nil), args)
						return
					}
					err = i.PGPUpdate(ctx, (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
		},
	}
}

type PGPClient struct {
	Cli GenericClient
}

func (c PGPClient) PGPSign(ctx context.Context, __arg PGPSignArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.pgp.pgpSign", []interface{}{__arg}, nil)
	return
}

func (c PGPClient) PGPPull(ctx context.Context, __arg PGPPullArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.pgp.pgpPull", []interface{}{__arg}, nil)
	return
}

func (c PGPClient) PGPEncrypt(ctx context.Context, __arg PGPEncryptArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.pgp.pgpEncrypt", []interface{}{__arg}, nil)
	return
}

func (c PGPClient) PGPDecrypt(ctx context.Context, __arg PGPDecryptArg) (res PGPSigVerification, err error) {
	err = c.Cli.Call(ctx, "keybase.1.pgp.pgpDecrypt", []interface{}{__arg}, &res)
	return
}

func (c PGPClient) PGPVerify(ctx context.Context, __arg PGPVerifyArg) (res PGPSigVerification, err error) {
	err = c.Cli.Call(ctx, "keybase.1.pgp.pgpVerify", []interface{}{__arg}, &res)
	return
}

func (c PGPClient) PGPImport(ctx context.Context, __arg PGPImportArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.pgp.pgpImport", []interface{}{__arg}, nil)
	return
}

func (c PGPClient) PGPExport(ctx context.Context, __arg PGPExportArg) (res []KeyInfo, err error) {
	err = c.Cli.Call(ctx, "keybase.1.pgp.pgpExport", []interface{}{__arg}, &res)
	return
}

func (c PGPClient) PGPExportByFingerprint(ctx context.Context, __arg PGPExportByFingerprintArg) (res []KeyInfo, err error) {
	err = c.Cli.Call(ctx, "keybase.1.pgp.pgpExportByFingerprint", []interface{}{__arg}, &res)
	return
}

func (c PGPClient) PGPExportByKID(ctx context.Context, __arg PGPExportByKIDArg) (res []KeyInfo, err error) {
	err = c.Cli.Call(ctx, "keybase.1.pgp.pgpExportByKID", []interface{}{__arg}, &res)
	return
}

func (c PGPClient) PGPKeyGen(ctx context.Context, __arg PGPKeyGenArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.pgp.pgpKeyGen", []interface{}{__arg}, nil)
	return
}

func (c PGPClient) PGPDeletePrimary(ctx context.Context, sessionID int) (err error) {
	__arg := PGPDeletePrimaryArg{SessionID: sessionID}
	err = c.Cli.Call(ctx, "keybase.1.pgp.pgpDeletePrimary", []interface{}{__arg}, nil)
	return
}

func (c PGPClient) PGPSelect(ctx context.Context, __arg PGPSelectArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.pgp.pgpSelect", []interface{}{__arg}, nil)
	return
}

func (c PGPClient) PGPUpdate(ctx context.Context, __arg PGPUpdateArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.pgp.pgpUpdate", []interface{}{__arg}, nil)
	return
}

type OutputSignatureSuccessArg struct {
	SessionID   int    `codec:"sessionID" json:"sessionID"`
	Fingerprint string `codec:"fingerprint" json:"fingerprint"`
	Username    string `codec:"username" json:"username"`
	SignedAt    Time   `codec:"signedAt" json:"signedAt"`
}

type PGPUiInterface interface {
	OutputSignatureSuccess(context.Context, OutputSignatureSuccessArg) error
}

func PGPUiProtocol(i PGPUiInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.pgpUi",
		Methods: map[string]rpc.ServeHandlerDescription{
			"outputSignatureSuccess": {
				MakeArg: func() interface{} {
					ret := make([]OutputSignatureSuccessArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]OutputSignatureSuccessArg)
					if !ok {
						err = rpc.NewTypeError((*[]OutputSignatureSuccessArg)(nil), args)
						return
					}
					err = i.OutputSignatureSuccess(ctx, (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
		},
	}
}

type PGPUiClient struct {
	Cli GenericClient
}

func (c PGPUiClient) OutputSignatureSuccess(ctx context.Context, __arg OutputSignatureSuccessArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.pgpUi.outputSignatureSuccess", []interface{}{__arg}, nil)
	return
}

type CheckProofStatus struct {
	Found     bool        `codec:"found" json:"found"`
	Status    ProofStatus `codec:"status" json:"status"`
	ProofText string      `codec:"proofText" json:"proofText"`
}

type StartProofResult struct {
	SigID SigID `codec:"sigID" json:"sigID"`
}

type StartProofArg struct {
	SessionID    int    `codec:"sessionID" json:"sessionID"`
	Service      string `codec:"service" json:"service"`
	Username     string `codec:"username" json:"username"`
	Force        bool   `codec:"force" json:"force"`
	PromptPosted bool   `codec:"promptPosted" json:"promptPosted"`
}

type CheckProofArg struct {
	SessionID int   `codec:"sessionID" json:"sessionID"`
	SigID     SigID `codec:"sigID" json:"sigID"`
}

type ProveInterface interface {
	StartProof(context.Context, StartProofArg) (StartProofResult, error)
	CheckProof(context.Context, CheckProofArg) (CheckProofStatus, error)
}

func ProveProtocol(i ProveInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.prove",
		Methods: map[string]rpc.ServeHandlerDescription{
			"startProof": {
				MakeArg: func() interface{} {
					ret := make([]StartProofArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]StartProofArg)
					if !ok {
						err = rpc.NewTypeError((*[]StartProofArg)(nil), args)
						return
					}
					ret, err = i.StartProof(ctx, (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"checkProof": {
				MakeArg: func() interface{} {
					ret := make([]CheckProofArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]CheckProofArg)
					if !ok {
						err = rpc.NewTypeError((*[]CheckProofArg)(nil), args)
						return
					}
					ret, err = i.CheckProof(ctx, (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
		},
	}
}

type ProveClient struct {
	Cli GenericClient
}

func (c ProveClient) StartProof(ctx context.Context, __arg StartProofArg) (res StartProofResult, err error) {
	err = c.Cli.Call(ctx, "keybase.1.prove.startProof", []interface{}{__arg}, &res)
	return
}

func (c ProveClient) CheckProof(ctx context.Context, __arg CheckProofArg) (res CheckProofStatus, err error) {
	err = c.Cli.Call(ctx, "keybase.1.prove.checkProof", []interface{}{__arg}, &res)
	return
}

type PromptOverwriteType int

const (
	PromptOverwriteType_SOCIAL PromptOverwriteType = 0
	PromptOverwriteType_SITE   PromptOverwriteType = 1
)

type PromptOverwriteArg struct {
	SessionID int                 `codec:"sessionID" json:"sessionID"`
	Account   string              `codec:"account" json:"account"`
	Typ       PromptOverwriteType `codec:"typ" json:"typ"`
}

type PromptUsernameArg struct {
	SessionID int     `codec:"sessionID" json:"sessionID"`
	Prompt    string  `codec:"prompt" json:"prompt"`
	PrevError *Status `codec:"prevError,omitempty" json:"prevError,omitempty"`
}

type OutputPrechecksArg struct {
	SessionID int  `codec:"sessionID" json:"sessionID"`
	Text      Text `codec:"text" json:"text"`
}

type PreProofWarningArg struct {
	SessionID int  `codec:"sessionID" json:"sessionID"`
	Text      Text `codec:"text" json:"text"`
}

type OutputInstructionsArg struct {
	SessionID    int    `codec:"sessionID" json:"sessionID"`
	Instructions Text   `codec:"instructions" json:"instructions"`
	Proof        string `codec:"proof" json:"proof"`
}

type OkToCheckArg struct {
	SessionID int    `codec:"sessionID" json:"sessionID"`
	Name      string `codec:"name" json:"name"`
	Attempt   int    `codec:"attempt" json:"attempt"`
}

type DisplayRecheckWarningArg struct {
	SessionID int  `codec:"sessionID" json:"sessionID"`
	Text      Text `codec:"text" json:"text"`
}

type ProveUiInterface interface {
	PromptOverwrite(context.Context, PromptOverwriteArg) (bool, error)
	PromptUsername(context.Context, PromptUsernameArg) (string, error)
	OutputPrechecks(context.Context, OutputPrechecksArg) error
	PreProofWarning(context.Context, PreProofWarningArg) (bool, error)
	OutputInstructions(context.Context, OutputInstructionsArg) error
	OkToCheck(context.Context, OkToCheckArg) (bool, error)
	DisplayRecheckWarning(context.Context, DisplayRecheckWarningArg) error
}

func ProveUiProtocol(i ProveUiInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.proveUi",
		Methods: map[string]rpc.ServeHandlerDescription{
			"promptOverwrite": {
				MakeArg: func() interface{} {
					ret := make([]PromptOverwriteArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]PromptOverwriteArg)
					if !ok {
						err = rpc.NewTypeError((*[]PromptOverwriteArg)(nil), args)
						return
					}
					ret, err = i.PromptOverwrite(ctx, (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"promptUsername": {
				MakeArg: func() interface{} {
					ret := make([]PromptUsernameArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]PromptUsernameArg)
					if !ok {
						err = rpc.NewTypeError((*[]PromptUsernameArg)(nil), args)
						return
					}
					ret, err = i.PromptUsername(ctx, (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"outputPrechecks": {
				MakeArg: func() interface{} {
					ret := make([]OutputPrechecksArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]OutputPrechecksArg)
					if !ok {
						err = rpc.NewTypeError((*[]OutputPrechecksArg)(nil), args)
						return
					}
					err = i.OutputPrechecks(ctx, (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"preProofWarning": {
				MakeArg: func() interface{} {
					ret := make([]PreProofWarningArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]PreProofWarningArg)
					if !ok {
						err = rpc.NewTypeError((*[]PreProofWarningArg)(nil), args)
						return
					}
					ret, err = i.PreProofWarning(ctx, (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"outputInstructions": {
				MakeArg: func() interface{} {
					ret := make([]OutputInstructionsArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]OutputInstructionsArg)
					if !ok {
						err = rpc.NewTypeError((*[]OutputInstructionsArg)(nil), args)
						return
					}
					err = i.OutputInstructions(ctx, (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"okToCheck": {
				MakeArg: func() interface{} {
					ret := make([]OkToCheckArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]OkToCheckArg)
					if !ok {
						err = rpc.NewTypeError((*[]OkToCheckArg)(nil), args)
						return
					}
					ret, err = i.OkToCheck(ctx, (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"displayRecheckWarning": {
				MakeArg: func() interface{} {
					ret := make([]DisplayRecheckWarningArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]DisplayRecheckWarningArg)
					if !ok {
						err = rpc.NewTypeError((*[]DisplayRecheckWarningArg)(nil), args)
						return
					}
					err = i.DisplayRecheckWarning(ctx, (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
		},
	}
}

type ProveUiClient struct {
	Cli GenericClient
}

func (c ProveUiClient) PromptOverwrite(ctx context.Context, __arg PromptOverwriteArg) (res bool, err error) {
	err = c.Cli.Call(ctx, "keybase.1.proveUi.promptOverwrite", []interface{}{__arg}, &res)
	return
}

func (c ProveUiClient) PromptUsername(ctx context.Context, __arg PromptUsernameArg) (res string, err error) {
	err = c.Cli.Call(ctx, "keybase.1.proveUi.promptUsername", []interface{}{__arg}, &res)
	return
}

func (c ProveUiClient) OutputPrechecks(ctx context.Context, __arg OutputPrechecksArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.proveUi.outputPrechecks", []interface{}{__arg}, nil)
	return
}

func (c ProveUiClient) PreProofWarning(ctx context.Context, __arg PreProofWarningArg) (res bool, err error) {
	err = c.Cli.Call(ctx, "keybase.1.proveUi.preProofWarning", []interface{}{__arg}, &res)
	return
}

func (c ProveUiClient) OutputInstructions(ctx context.Context, __arg OutputInstructionsArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.proveUi.outputInstructions", []interface{}{__arg}, nil)
	return
}

func (c ProveUiClient) OkToCheck(ctx context.Context, __arg OkToCheckArg) (res bool, err error) {
	err = c.Cli.Call(ctx, "keybase.1.proveUi.okToCheck", []interface{}{__arg}, &res)
	return
}

func (c ProveUiClient) DisplayRecheckWarning(ctx context.Context, __arg DisplayRecheckWarningArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.proveUi.displayRecheckWarning", []interface{}{__arg}, nil)
	return
}

type ProvisionMethod int

const (
	ProvisionMethod_DEVICE     ProvisionMethod = 0
	ProvisionMethod_PAPER_KEY  ProvisionMethod = 1
	ProvisionMethod_PASSPHRASE ProvisionMethod = 2
	ProvisionMethod_GPG_IMPORT ProvisionMethod = 3
	ProvisionMethod_GPG_SIGN   ProvisionMethod = 4
)

type DeviceType int

const (
	DeviceType_DESKTOP DeviceType = 0
	DeviceType_MOBILE  DeviceType = 1
)

type ChooseType int

const (
	ChooseType_EXISTING_DEVICE ChooseType = 0
	ChooseType_NEW_DEVICE      ChooseType = 1
)

type SecretResponse struct {
	Secret []byte `codec:"secret" json:"secret"`
	Phrase string `codec:"phrase" json:"phrase"`
}

type ChooseProvisioningMethodArg struct {
	SessionID int  `codec:"sessionID" json:"sessionID"`
	GpgOption bool `codec:"gpgOption" json:"gpgOption"`
}

type ChooseDeviceTypeArg struct {
	SessionID int        `codec:"sessionID" json:"sessionID"`
	Kind      ChooseType `codec:"kind" json:"kind"`
}

type DisplayAndPromptSecretArg struct {
	SessionID       int        `codec:"sessionID" json:"sessionID"`
	Secret          []byte     `codec:"secret" json:"secret"`
	Phrase          string     `codec:"phrase" json:"phrase"`
	OtherDeviceType DeviceType `codec:"otherDeviceType" json:"otherDeviceType"`
}

type DisplaySecretExchangedArg struct {
	SessionID int `codec:"sessionID" json:"sessionID"`
}

type PromptNewDeviceNameArg struct {
	SessionID       int      `codec:"sessionID" json:"sessionID"`
	ExistingDevices []string `codec:"existingDevices" json:"existingDevices"`
}

type ProvisioneeSuccessArg struct {
	SessionID  int    `codec:"sessionID" json:"sessionID"`
	Username   string `codec:"username" json:"username"`
	DeviceName string `codec:"deviceName" json:"deviceName"`
}

type ProvisionerSuccessArg struct {
	SessionID  int    `codec:"sessionID" json:"sessionID"`
	DeviceName string `codec:"deviceName" json:"deviceName"`
	DeviceType string `codec:"deviceType" json:"deviceType"`
}

type ProvisionUiInterface interface {
	ChooseProvisioningMethod(context.Context, ChooseProvisioningMethodArg) (ProvisionMethod, error)
	ChooseDeviceType(context.Context, ChooseDeviceTypeArg) (DeviceType, error)
	DisplayAndPromptSecret(context.Context, DisplayAndPromptSecretArg) (SecretResponse, error)
	DisplaySecretExchanged(context.Context, int) error
	PromptNewDeviceName(context.Context, PromptNewDeviceNameArg) (string, error)
	ProvisioneeSuccess(context.Context, ProvisioneeSuccessArg) error
	ProvisionerSuccess(context.Context, ProvisionerSuccessArg) error
}

func ProvisionUiProtocol(i ProvisionUiInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.provisionUi",
		Methods: map[string]rpc.ServeHandlerDescription{
			"chooseProvisioningMethod": {
				MakeArg: func() interface{} {
					ret := make([]ChooseProvisioningMethodArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]ChooseProvisioningMethodArg)
					if !ok {
						err = rpc.NewTypeError((*[]ChooseProvisioningMethodArg)(nil), args)
						return
					}
					ret, err = i.ChooseProvisioningMethod(ctx, (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"chooseDeviceType": {
				MakeArg: func() interface{} {
					ret := make([]ChooseDeviceTypeArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]ChooseDeviceTypeArg)
					if !ok {
						err = rpc.NewTypeError((*[]ChooseDeviceTypeArg)(nil), args)
						return
					}
					ret, err = i.ChooseDeviceType(ctx, (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"DisplayAndPromptSecret": {
				MakeArg: func() interface{} {
					ret := make([]DisplayAndPromptSecretArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]DisplayAndPromptSecretArg)
					if !ok {
						err = rpc.NewTypeError((*[]DisplayAndPromptSecretArg)(nil), args)
						return
					}
					ret, err = i.DisplayAndPromptSecret(ctx, (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"DisplaySecretExchanged": {
				MakeArg: func() interface{} {
					ret := make([]DisplaySecretExchangedArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]DisplaySecretExchangedArg)
					if !ok {
						err = rpc.NewTypeError((*[]DisplaySecretExchangedArg)(nil), args)
						return
					}
					err = i.DisplaySecretExchanged(ctx, (*typedArgs)[0].SessionID)
					return
				},
				MethodType: rpc.MethodCall,
			},
			"PromptNewDeviceName": {
				MakeArg: func() interface{} {
					ret := make([]PromptNewDeviceNameArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]PromptNewDeviceNameArg)
					if !ok {
						err = rpc.NewTypeError((*[]PromptNewDeviceNameArg)(nil), args)
						return
					}
					ret, err = i.PromptNewDeviceName(ctx, (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"ProvisioneeSuccess": {
				MakeArg: func() interface{} {
					ret := make([]ProvisioneeSuccessArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]ProvisioneeSuccessArg)
					if !ok {
						err = rpc.NewTypeError((*[]ProvisioneeSuccessArg)(nil), args)
						return
					}
					err = i.ProvisioneeSuccess(ctx, (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"ProvisionerSuccess": {
				MakeArg: func() interface{} {
					ret := make([]ProvisionerSuccessArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]ProvisionerSuccessArg)
					if !ok {
						err = rpc.NewTypeError((*[]ProvisionerSuccessArg)(nil), args)
						return
					}
					err = i.ProvisionerSuccess(ctx, (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
		},
	}
}

type ProvisionUiClient struct {
	Cli GenericClient
}

func (c ProvisionUiClient) ChooseProvisioningMethod(ctx context.Context, __arg ChooseProvisioningMethodArg) (res ProvisionMethod, err error) {
	err = c.Cli.Call(ctx, "keybase.1.provisionUi.chooseProvisioningMethod", []interface{}{__arg}, &res)
	return
}

func (c ProvisionUiClient) ChooseDeviceType(ctx context.Context, __arg ChooseDeviceTypeArg) (res DeviceType, err error) {
	err = c.Cli.Call(ctx, "keybase.1.provisionUi.chooseDeviceType", []interface{}{__arg}, &res)
	return
}

func (c ProvisionUiClient) DisplayAndPromptSecret(ctx context.Context, __arg DisplayAndPromptSecretArg) (res SecretResponse, err error) {
	err = c.Cli.Call(ctx, "keybase.1.provisionUi.DisplayAndPromptSecret", []interface{}{__arg}, &res)
	return
}

func (c ProvisionUiClient) DisplaySecretExchanged(ctx context.Context, sessionID int) (err error) {
	__arg := DisplaySecretExchangedArg{SessionID: sessionID}
	err = c.Cli.Call(ctx, "keybase.1.provisionUi.DisplaySecretExchanged", []interface{}{__arg}, nil)
	return
}

func (c ProvisionUiClient) PromptNewDeviceName(ctx context.Context, __arg PromptNewDeviceNameArg) (res string, err error) {
	err = c.Cli.Call(ctx, "keybase.1.provisionUi.PromptNewDeviceName", []interface{}{__arg}, &res)
	return
}

func (c ProvisionUiClient) ProvisioneeSuccess(ctx context.Context, __arg ProvisioneeSuccessArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.provisionUi.ProvisioneeSuccess", []interface{}{__arg}, nil)
	return
}

func (c ProvisionUiClient) ProvisionerSuccess(ctx context.Context, __arg ProvisionerSuccessArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.provisionUi.ProvisionerSuccess", []interface{}{__arg}, nil)
	return
}

type VerifySessionRes struct {
	Uid       UID    `codec:"uid" json:"uid"`
	Sid       string `codec:"sid" json:"sid"`
	Generated int    `codec:"generated" json:"generated"`
	Lifetime  int    `codec:"lifetime" json:"lifetime"`
}

type VerifySessionArg struct {
	Session string `codec:"session" json:"session"`
}

type QuotaInterface interface {
	VerifySession(context.Context, string) (VerifySessionRes, error)
}

func QuotaProtocol(i QuotaInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.quota",
		Methods: map[string]rpc.ServeHandlerDescription{
			"verifySession": {
				MakeArg: func() interface{} {
					ret := make([]VerifySessionArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]VerifySessionArg)
					if !ok {
						err = rpc.NewTypeError((*[]VerifySessionArg)(nil), args)
						return
					}
					ret, err = i.VerifySession(ctx, (*typedArgs)[0].Session)
					return
				},
				MethodType: rpc.MethodCall,
			},
		},
	}
}

type QuotaClient struct {
	Cli GenericClient
}

func (c QuotaClient) VerifySession(ctx context.Context, session string) (res VerifySessionRes, err error) {
	__arg := VerifySessionArg{Session: session}
	err = c.Cli.Call(ctx, "keybase.1.quota.verifySession", []interface{}{__arg}, &res)
	return
}

type RevokeKeyArg struct {
	SessionID int `codec:"sessionID" json:"sessionID"`
	KeyID     KID `codec:"keyID" json:"keyID"`
}

type RevokeDeviceArg struct {
	SessionID int      `codec:"sessionID" json:"sessionID"`
	DeviceID  DeviceID `codec:"deviceID" json:"deviceID"`
	Force     bool     `codec:"force" json:"force"`
}

type RevokeSigsArg struct {
	SessionID    int      `codec:"sessionID" json:"sessionID"`
	SigIDQueries []string `codec:"sigIDQueries" json:"sigIDQueries"`
}

type RevokeInterface interface {
	RevokeKey(context.Context, RevokeKeyArg) error
	RevokeDevice(context.Context, RevokeDeviceArg) error
	RevokeSigs(context.Context, RevokeSigsArg) error
}

func RevokeProtocol(i RevokeInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.revoke",
		Methods: map[string]rpc.ServeHandlerDescription{
			"revokeKey": {
				MakeArg: func() interface{} {
					ret := make([]RevokeKeyArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]RevokeKeyArg)
					if !ok {
						err = rpc.NewTypeError((*[]RevokeKeyArg)(nil), args)
						return
					}
					err = i.RevokeKey(ctx, (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"revokeDevice": {
				MakeArg: func() interface{} {
					ret := make([]RevokeDeviceArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]RevokeDeviceArg)
					if !ok {
						err = rpc.NewTypeError((*[]RevokeDeviceArg)(nil), args)
						return
					}
					err = i.RevokeDevice(ctx, (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"revokeSigs": {
				MakeArg: func() interface{} {
					ret := make([]RevokeSigsArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]RevokeSigsArg)
					if !ok {
						err = rpc.NewTypeError((*[]RevokeSigsArg)(nil), args)
						return
					}
					err = i.RevokeSigs(ctx, (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
		},
	}
}

type RevokeClient struct {
	Cli GenericClient
}

func (c RevokeClient) RevokeKey(ctx context.Context, __arg RevokeKeyArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.revoke.revokeKey", []interface{}{__arg}, nil)
	return
}

func (c RevokeClient) RevokeDevice(ctx context.Context, __arg RevokeDeviceArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.revoke.revokeDevice", []interface{}{__arg}, nil)
	return
}

func (c RevokeClient) RevokeSigs(ctx context.Context, __arg RevokeSigsArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.revoke.revokeSigs", []interface{}{__arg}, nil)
	return
}

type SaltpackEncryptOptions struct {
	Recipients     []string `codec:"recipients" json:"recipients"`
	HideSelf       bool     `codec:"hideSelf" json:"hideSelf"`
	NoSelfEncrypt  bool     `codec:"noSelfEncrypt" json:"noSelfEncrypt"`
	Binary         bool     `codec:"binary" json:"binary"`
	HideRecipients bool     `codec:"hideRecipients" json:"hideRecipients"`
}

type SaltpackDecryptOptions struct {
	Interactive      bool `codec:"interactive" json:"interactive"`
	ForceRemoteCheck bool `codec:"forceRemoteCheck" json:"forceRemoteCheck"`
}

type SaltpackSignOptions struct {
	Detached bool `codec:"detached" json:"detached"`
	Binary   bool `codec:"binary" json:"binary"`
}

type SaltpackVerifyOptions struct {
	SignedBy  string `codec:"signedBy" json:"signedBy"`
	Signature []byte `codec:"signature" json:"signature"`
}

type SaltpackEncryptedMessageInfo struct {
	Devices          []Device `codec:"devices" json:"devices"`
	NumAnonReceivers int      `codec:"numAnonReceivers" json:"numAnonReceivers"`
	ReceiverIsAnon   bool     `codec:"receiverIsAnon" json:"receiverIsAnon"`
}

type SaltpackEncryptArg struct {
	SessionID int                    `codec:"sessionID" json:"sessionID"`
	Source    Stream                 `codec:"source" json:"source"`
	Sink      Stream                 `codec:"sink" json:"sink"`
	Opts      SaltpackEncryptOptions `codec:"opts" json:"opts"`
}

type SaltpackDecryptArg struct {
	SessionID int                    `codec:"sessionID" json:"sessionID"`
	Source    Stream                 `codec:"source" json:"source"`
	Sink      Stream                 `codec:"sink" json:"sink"`
	Opts      SaltpackDecryptOptions `codec:"opts" json:"opts"`
}

type SaltpackSignArg struct {
	SessionID int                 `codec:"sessionID" json:"sessionID"`
	Source    Stream              `codec:"source" json:"source"`
	Sink      Stream              `codec:"sink" json:"sink"`
	Opts      SaltpackSignOptions `codec:"opts" json:"opts"`
}

type SaltpackVerifyArg struct {
	SessionID int                   `codec:"sessionID" json:"sessionID"`
	Source    Stream                `codec:"source" json:"source"`
	Sink      Stream                `codec:"sink" json:"sink"`
	Opts      SaltpackVerifyOptions `codec:"opts" json:"opts"`
}

type SaltpackInterface interface {
	SaltpackEncrypt(context.Context, SaltpackEncryptArg) error
	SaltpackDecrypt(context.Context, SaltpackDecryptArg) (SaltpackEncryptedMessageInfo, error)
	SaltpackSign(context.Context, SaltpackSignArg) error
	SaltpackVerify(context.Context, SaltpackVerifyArg) error
}

func SaltpackProtocol(i SaltpackInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.saltpack",
		Methods: map[string]rpc.ServeHandlerDescription{
			"saltpackEncrypt": {
				MakeArg: func() interface{} {
					ret := make([]SaltpackEncryptArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]SaltpackEncryptArg)
					if !ok {
						err = rpc.NewTypeError((*[]SaltpackEncryptArg)(nil), args)
						return
					}
					err = i.SaltpackEncrypt(ctx, (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"saltpackDecrypt": {
				MakeArg: func() interface{} {
					ret := make([]SaltpackDecryptArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]SaltpackDecryptArg)
					if !ok {
						err = rpc.NewTypeError((*[]SaltpackDecryptArg)(nil), args)
						return
					}
					ret, err = i.SaltpackDecrypt(ctx, (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"saltpackSign": {
				MakeArg: func() interface{} {
					ret := make([]SaltpackSignArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]SaltpackSignArg)
					if !ok {
						err = rpc.NewTypeError((*[]SaltpackSignArg)(nil), args)
						return
					}
					err = i.SaltpackSign(ctx, (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"saltpackVerify": {
				MakeArg: func() interface{} {
					ret := make([]SaltpackVerifyArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]SaltpackVerifyArg)
					if !ok {
						err = rpc.NewTypeError((*[]SaltpackVerifyArg)(nil), args)
						return
					}
					err = i.SaltpackVerify(ctx, (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
		},
	}
}

type SaltpackClient struct {
	Cli GenericClient
}

func (c SaltpackClient) SaltpackEncrypt(ctx context.Context, __arg SaltpackEncryptArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.saltpack.saltpackEncrypt", []interface{}{__arg}, nil)
	return
}

func (c SaltpackClient) SaltpackDecrypt(ctx context.Context, __arg SaltpackDecryptArg) (res SaltpackEncryptedMessageInfo, err error) {
	err = c.Cli.Call(ctx, "keybase.1.saltpack.saltpackDecrypt", []interface{}{__arg}, &res)
	return
}

func (c SaltpackClient) SaltpackSign(ctx context.Context, __arg SaltpackSignArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.saltpack.saltpackSign", []interface{}{__arg}, nil)
	return
}

func (c SaltpackClient) SaltpackVerify(ctx context.Context, __arg SaltpackVerifyArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.saltpack.saltpackVerify", []interface{}{__arg}, nil)
	return
}

type SaltpackSenderType int

const (
	SaltpackSenderType_NOT_TRACKED    SaltpackSenderType = 0
	SaltpackSenderType_UNKNOWN        SaltpackSenderType = 1
	SaltpackSenderType_ANONYMOUS      SaltpackSenderType = 2
	SaltpackSenderType_TRACKING_BROKE SaltpackSenderType = 3
	SaltpackSenderType_TRACKING_OK    SaltpackSenderType = 4
	SaltpackSenderType_SELF           SaltpackSenderType = 5
)

type SaltpackSender struct {
	Uid        UID                `codec:"uid" json:"uid"`
	Username   string             `codec:"username" json:"username"`
	SenderType SaltpackSenderType `codec:"senderType" json:"senderType"`
}

type SaltpackPromptForDecryptArg struct {
	SessionID int            `codec:"sessionID" json:"sessionID"`
	Sender    SaltpackSender `codec:"sender" json:"sender"`
}

type SaltpackVerifySuccessArg struct {
	SessionID  int            `codec:"sessionID" json:"sessionID"`
	SigningKID KID            `codec:"signingKID" json:"signingKID"`
	Sender     SaltpackSender `codec:"sender" json:"sender"`
}

type SaltpackUiInterface interface {
	SaltpackPromptForDecrypt(context.Context, SaltpackPromptForDecryptArg) error
	SaltpackVerifySuccess(context.Context, SaltpackVerifySuccessArg) error
}

func SaltpackUiProtocol(i SaltpackUiInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.saltpackUi",
		Methods: map[string]rpc.ServeHandlerDescription{
			"saltpackPromptForDecrypt": {
				MakeArg: func() interface{} {
					ret := make([]SaltpackPromptForDecryptArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]SaltpackPromptForDecryptArg)
					if !ok {
						err = rpc.NewTypeError((*[]SaltpackPromptForDecryptArg)(nil), args)
						return
					}
					err = i.SaltpackPromptForDecrypt(ctx, (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"saltpackVerifySuccess": {
				MakeArg: func() interface{} {
					ret := make([]SaltpackVerifySuccessArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]SaltpackVerifySuccessArg)
					if !ok {
						err = rpc.NewTypeError((*[]SaltpackVerifySuccessArg)(nil), args)
						return
					}
					err = i.SaltpackVerifySuccess(ctx, (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
		},
	}
}

type SaltpackUiClient struct {
	Cli GenericClient
}

func (c SaltpackUiClient) SaltpackPromptForDecrypt(ctx context.Context, __arg SaltpackPromptForDecryptArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.saltpackUi.saltpackPromptForDecrypt", []interface{}{__arg}, nil)
	return
}

func (c SaltpackUiClient) SaltpackVerifySuccess(ctx context.Context, __arg SaltpackVerifySuccessArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.saltpackUi.saltpackVerifySuccess", []interface{}{__arg}, nil)
	return
}

type SecretEntryArg struct {
	Desc           string `codec:"desc" json:"desc"`
	Prompt         string `codec:"prompt" json:"prompt"`
	Err            string `codec:"err" json:"err"`
	Cancel         string `codec:"cancel" json:"cancel"`
	Ok             string `codec:"ok" json:"ok"`
	Reason         string `codec:"reason" json:"reason"`
	UseSecretStore bool   `codec:"useSecretStore" json:"useSecretStore"`
}

type SecretEntryRes struct {
	Text        string `codec:"text" json:"text"`
	Canceled    bool   `codec:"canceled" json:"canceled"`
	StoreSecret bool   `codec:"storeSecret" json:"storeSecret"`
}

type GetPassphraseArg struct {
	SessionID int             `codec:"sessionID" json:"sessionID"`
	Pinentry  GUIEntryArg     `codec:"pinentry" json:"pinentry"`
	Terminal  *SecretEntryArg `codec:"terminal,omitempty" json:"terminal,omitempty"`
}

type SecretUiInterface interface {
	GetPassphrase(context.Context, GetPassphraseArg) (GetPassphraseRes, error)
}

func SecretUiProtocol(i SecretUiInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.secretUi",
		Methods: map[string]rpc.ServeHandlerDescription{
			"getPassphrase": {
				MakeArg: func() interface{} {
					ret := make([]GetPassphraseArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]GetPassphraseArg)
					if !ok {
						err = rpc.NewTypeError((*[]GetPassphraseArg)(nil), args)
						return
					}
					ret, err = i.GetPassphrase(ctx, (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
		},
	}
}

type SecretUiClient struct {
	Cli GenericClient
}

func (c SecretUiClient) GetPassphrase(ctx context.Context, __arg GetPassphraseArg) (res GetPassphraseRes, err error) {
	err = c.Cli.Call(ctx, "keybase.1.secretUi.getPassphrase", []interface{}{__arg}, &res)
	return
}

type NaclSigningKeyPublic [32]byte
type NaclSigningKeyPrivate [64]byte
type NaclDHKeyPublic [32]byte
type NaclDHKeyPrivate [32]byte
type SecretKeys struct {
	Signing    NaclSigningKeyPrivate `codec:"signing" json:"signing"`
	Encryption NaclDHKeyPrivate      `codec:"encryption" json:"encryption"`
}

type GetSecretKeysArg struct {
	SessionID int `codec:"sessionID" json:"sessionID"`
}

type SecretKeysInterface interface {
	GetSecretKeys(context.Context, int) (SecretKeys, error)
}

func SecretKeysProtocol(i SecretKeysInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.SecretKeys",
		Methods: map[string]rpc.ServeHandlerDescription{
			"getSecretKeys": {
				MakeArg: func() interface{} {
					ret := make([]GetSecretKeysArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]GetSecretKeysArg)
					if !ok {
						err = rpc.NewTypeError((*[]GetSecretKeysArg)(nil), args)
						return
					}
					ret, err = i.GetSecretKeys(ctx, (*typedArgs)[0].SessionID)
					return
				},
				MethodType: rpc.MethodCall,
			},
		},
	}
}

type SecretKeysClient struct {
	Cli GenericClient
}

func (c SecretKeysClient) GetSecretKeys(ctx context.Context, sessionID int) (res SecretKeys, err error) {
	__arg := GetSecretKeysArg{SessionID: sessionID}
	err = c.Cli.Call(ctx, "keybase.1.SecretKeys.getSecretKeys", []interface{}{__arg}, &res)
	return
}

type Session struct {
	Uid             UID    `codec:"uid" json:"uid"`
	Username        string `codec:"username" json:"username"`
	Token           string `codec:"token" json:"token"`
	DeviceSubkeyKid KID    `codec:"deviceSubkeyKid" json:"deviceSubkeyKid"`
	DeviceSibkeyKid KID    `codec:"deviceSibkeyKid" json:"deviceSibkeyKid"`
}

type CurrentSessionArg struct {
	SessionID int `codec:"sessionID" json:"sessionID"`
}

type SessionInterface interface {
	CurrentSession(context.Context, int) (Session, error)
}

func SessionProtocol(i SessionInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.session",
		Methods: map[string]rpc.ServeHandlerDescription{
			"currentSession": {
				MakeArg: func() interface{} {
					ret := make([]CurrentSessionArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]CurrentSessionArg)
					if !ok {
						err = rpc.NewTypeError((*[]CurrentSessionArg)(nil), args)
						return
					}
					ret, err = i.CurrentSession(ctx, (*typedArgs)[0].SessionID)
					return
				},
				MethodType: rpc.MethodCall,
			},
		},
	}
}

type SessionClient struct {
	Cli GenericClient
}

func (c SessionClient) CurrentSession(ctx context.Context, sessionID int) (res Session, err error) {
	__arg := CurrentSessionArg{SessionID: sessionID}
	err = c.Cli.Call(ctx, "keybase.1.session.currentSession", []interface{}{__arg}, &res)
	return
}

type SignupRes struct {
	PassphraseOk bool `codec:"passphraseOk" json:"passphraseOk"`
	PostOk       bool `codec:"postOk" json:"postOk"`
	WriteOk      bool `codec:"writeOk" json:"writeOk"`
}

type CheckUsernameAvailableArg struct {
	SessionID int    `codec:"sessionID" json:"sessionID"`
	Username  string `codec:"username" json:"username"`
}

type SignupArg struct {
	SessionID   int    `codec:"sessionID" json:"sessionID"`
	Email       string `codec:"email" json:"email"`
	InviteCode  string `codec:"inviteCode" json:"inviteCode"`
	Passphrase  string `codec:"passphrase" json:"passphrase"`
	Username    string `codec:"username" json:"username"`
	DeviceName  string `codec:"deviceName" json:"deviceName"`
	StoreSecret bool   `codec:"storeSecret" json:"storeSecret"`
	SkipMail    bool   `codec:"skipMail" json:"skipMail"`
}

type InviteRequestArg struct {
	SessionID int    `codec:"sessionID" json:"sessionID"`
	Email     string `codec:"email" json:"email"`
	Fullname  string `codec:"fullname" json:"fullname"`
	Notes     string `codec:"notes" json:"notes"`
}

type SignupInterface interface {
	CheckUsernameAvailable(context.Context, CheckUsernameAvailableArg) error
	Signup(context.Context, SignupArg) (SignupRes, error)
	InviteRequest(context.Context, InviteRequestArg) error
}

func SignupProtocol(i SignupInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.signup",
		Methods: map[string]rpc.ServeHandlerDescription{
			"checkUsernameAvailable": {
				MakeArg: func() interface{} {
					ret := make([]CheckUsernameAvailableArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]CheckUsernameAvailableArg)
					if !ok {
						err = rpc.NewTypeError((*[]CheckUsernameAvailableArg)(nil), args)
						return
					}
					err = i.CheckUsernameAvailable(ctx, (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"signup": {
				MakeArg: func() interface{} {
					ret := make([]SignupArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]SignupArg)
					if !ok {
						err = rpc.NewTypeError((*[]SignupArg)(nil), args)
						return
					}
					ret, err = i.Signup(ctx, (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"inviteRequest": {
				MakeArg: func() interface{} {
					ret := make([]InviteRequestArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]InviteRequestArg)
					if !ok {
						err = rpc.NewTypeError((*[]InviteRequestArg)(nil), args)
						return
					}
					err = i.InviteRequest(ctx, (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
		},
	}
}

type SignupClient struct {
	Cli GenericClient
}

func (c SignupClient) CheckUsernameAvailable(ctx context.Context, __arg CheckUsernameAvailableArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.signup.checkUsernameAvailable", []interface{}{__arg}, nil)
	return
}

func (c SignupClient) Signup(ctx context.Context, __arg SignupArg) (res SignupRes, err error) {
	err = c.Cli.Call(ctx, "keybase.1.signup.signup", []interface{}{__arg}, &res)
	return
}

func (c SignupClient) InviteRequest(ctx context.Context, __arg InviteRequestArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.signup.inviteRequest", []interface{}{__arg}, nil)
	return
}

type Sig struct {
	Seqno        int    `codec:"seqno" json:"seqno"`
	SigID        SigID  `codec:"sigID" json:"sigID"`
	SigIDDisplay string `codec:"sigIDDisplay" json:"sigIDDisplay"`
	Type         string `codec:"type" json:"type"`
	CTime        Time   `codec:"cTime" json:"cTime"`
	Revoked      bool   `codec:"revoked" json:"revoked"`
	Active       bool   `codec:"active" json:"active"`
	Key          string `codec:"key" json:"key"`
	Body         string `codec:"body" json:"body"`
}

type SigTypes struct {
	Track          bool `codec:"track" json:"track"`
	Proof          bool `codec:"proof" json:"proof"`
	Cryptocurrency bool `codec:"cryptocurrency" json:"cryptocurrency"`
	IsSelf         bool `codec:"isSelf" json:"isSelf"`
}

type SigListArgs struct {
	SessionID int       `codec:"sessionID" json:"sessionID"`
	Username  string    `codec:"username" json:"username"`
	AllKeys   bool      `codec:"allKeys" json:"allKeys"`
	Types     *SigTypes `codec:"types,omitempty" json:"types,omitempty"`
	Filterx   string    `codec:"filterx" json:"filterx"`
	Verbose   bool      `codec:"verbose" json:"verbose"`
	Revoked   bool      `codec:"revoked" json:"revoked"`
}

type SigListArg struct {
	SessionID int         `codec:"sessionID" json:"sessionID"`
	Arg       SigListArgs `codec:"arg" json:"arg"`
}

type SigListJSONArg struct {
	SessionID int         `codec:"sessionID" json:"sessionID"`
	Arg       SigListArgs `codec:"arg" json:"arg"`
}

type SigsInterface interface {
	SigList(context.Context, SigListArg) ([]Sig, error)
	SigListJSON(context.Context, SigListJSONArg) (string, error)
}

func SigsProtocol(i SigsInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.sigs",
		Methods: map[string]rpc.ServeHandlerDescription{
			"sigList": {
				MakeArg: func() interface{} {
					ret := make([]SigListArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]SigListArg)
					if !ok {
						err = rpc.NewTypeError((*[]SigListArg)(nil), args)
						return
					}
					ret, err = i.SigList(ctx, (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"sigListJSON": {
				MakeArg: func() interface{} {
					ret := make([]SigListJSONArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]SigListJSONArg)
					if !ok {
						err = rpc.NewTypeError((*[]SigListJSONArg)(nil), args)
						return
					}
					ret, err = i.SigListJSON(ctx, (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
		},
	}
}

type SigsClient struct {
	Cli GenericClient
}

func (c SigsClient) SigList(ctx context.Context, __arg SigListArg) (res []Sig, err error) {
	err = c.Cli.Call(ctx, "keybase.1.sigs.sigList", []interface{}{__arg}, &res)
	return
}

func (c SigsClient) SigListJSON(ctx context.Context, __arg SigListJSONArg) (res string, err error) {
	err = c.Cli.Call(ctx, "keybase.1.sigs.sigListJSON", []interface{}{__arg}, &res)
	return
}

type CloseArg struct {
	SessionID int    `codec:"sessionID" json:"sessionID"`
	S         Stream `codec:"s" json:"s"`
}

type ReadArg struct {
	SessionID int    `codec:"sessionID" json:"sessionID"`
	S         Stream `codec:"s" json:"s"`
	Sz        int    `codec:"sz" json:"sz"`
}

type WriteArg struct {
	SessionID int    `codec:"sessionID" json:"sessionID"`
	S         Stream `codec:"s" json:"s"`
	Buf       []byte `codec:"buf" json:"buf"`
}

type StreamUiInterface interface {
	Close(context.Context, CloseArg) error
	Read(context.Context, ReadArg) ([]byte, error)
	Write(context.Context, WriteArg) (int, error)
}

func StreamUiProtocol(i StreamUiInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.streamUi",
		Methods: map[string]rpc.ServeHandlerDescription{
			"close": {
				MakeArg: func() interface{} {
					ret := make([]CloseArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]CloseArg)
					if !ok {
						err = rpc.NewTypeError((*[]CloseArg)(nil), args)
						return
					}
					err = i.Close(ctx, (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"read": {
				MakeArg: func() interface{} {
					ret := make([]ReadArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]ReadArg)
					if !ok {
						err = rpc.NewTypeError((*[]ReadArg)(nil), args)
						return
					}
					ret, err = i.Read(ctx, (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"write": {
				MakeArg: func() interface{} {
					ret := make([]WriteArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]WriteArg)
					if !ok {
						err = rpc.NewTypeError((*[]WriteArg)(nil), args)
						return
					}
					ret, err = i.Write(ctx, (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
		},
	}
}

type StreamUiClient struct {
	Cli GenericClient
}

func (c StreamUiClient) Close(ctx context.Context, __arg CloseArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.streamUi.close", []interface{}{__arg}, nil)
	return
}

func (c StreamUiClient) Read(ctx context.Context, __arg ReadArg) (res []byte, err error) {
	err = c.Cli.Call(ctx, "keybase.1.streamUi.read", []interface{}{__arg}, &res)
	return
}

func (c StreamUiClient) Write(ctx context.Context, __arg WriteArg) (res int, err error) {
	err = c.Cli.Call(ctx, "keybase.1.streamUi.write", []interface{}{__arg}, &res)
	return
}

type Test struct {
	Reply string `codec:"reply" json:"reply"`
}

type TestArg struct {
	SessionID int    `codec:"sessionID" json:"sessionID"`
	Name      string `codec:"name" json:"name"`
}

type TestCallbackArg struct {
	SessionID int    `codec:"sessionID" json:"sessionID"`
	Name      string `codec:"name" json:"name"`
}

type PanicArg struct {
	Message string `codec:"message" json:"message"`
}

type TestInterface interface {
	Test(context.Context, TestArg) (Test, error)
	TestCallback(context.Context, TestCallbackArg) (string, error)
	Panic(context.Context, string) error
}

func TestProtocol(i TestInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.test",
		Methods: map[string]rpc.ServeHandlerDescription{
			"test": {
				MakeArg: func() interface{} {
					ret := make([]TestArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]TestArg)
					if !ok {
						err = rpc.NewTypeError((*[]TestArg)(nil), args)
						return
					}
					ret, err = i.Test(ctx, (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"testCallback": {
				MakeArg: func() interface{} {
					ret := make([]TestCallbackArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]TestCallbackArg)
					if !ok {
						err = rpc.NewTypeError((*[]TestCallbackArg)(nil), args)
						return
					}
					ret, err = i.TestCallback(ctx, (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"panic": {
				MakeArg: func() interface{} {
					ret := make([]PanicArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]PanicArg)
					if !ok {
						err = rpc.NewTypeError((*[]PanicArg)(nil), args)
						return
					}
					err = i.Panic(ctx, (*typedArgs)[0].Message)
					return
				},
				MethodType: rpc.MethodCall,
			},
		},
	}
}

type TestClient struct {
	Cli GenericClient
}

func (c TestClient) Test(ctx context.Context, __arg TestArg) (res Test, err error) {
	err = c.Cli.Call(ctx, "keybase.1.test.test", []interface{}{__arg}, &res)
	return
}

func (c TestClient) TestCallback(ctx context.Context, __arg TestCallbackArg) (res string, err error) {
	err = c.Cli.Call(ctx, "keybase.1.test.testCallback", []interface{}{__arg}, &res)
	return
}

func (c TestClient) Panic(ctx context.Context, message string) (err error) {
	__arg := PanicArg{Message: message}
	err = c.Cli.Call(ctx, "keybase.1.test.panic", []interface{}{__arg}, nil)
	return
}

type TrackArg struct {
	SessionID        int          `codec:"sessionID" json:"sessionID"`
	UserAssertion    string       `codec:"userAssertion" json:"userAssertion"`
	Options          TrackOptions `codec:"options" json:"options"`
	ForceRemoteCheck bool         `codec:"forceRemoteCheck" json:"forceRemoteCheck"`
}

type TrackWithTokenArg struct {
	SessionID  int          `codec:"sessionID" json:"sessionID"`
	TrackToken TrackToken   `codec:"trackToken" json:"trackToken"`
	Options    TrackOptions `codec:"options" json:"options"`
}

type UntrackArg struct {
	SessionID int    `codec:"sessionID" json:"sessionID"`
	Username  string `codec:"username" json:"username"`
}

type CheckTrackingArg struct {
	SessionID int `codec:"sessionID" json:"sessionID"`
}

type FakeTrackingChangedArg struct {
	SessionID int    `codec:"sessionID" json:"sessionID"`
	Username  string `codec:"username" json:"username"`
}

type TrackInterface interface {
	Track(context.Context, TrackArg) error
	TrackWithToken(context.Context, TrackWithTokenArg) error
	Untrack(context.Context, UntrackArg) error
	CheckTracking(context.Context, int) error
	FakeTrackingChanged(context.Context, FakeTrackingChangedArg) error
}

func TrackProtocol(i TrackInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.track",
		Methods: map[string]rpc.ServeHandlerDescription{
			"track": {
				MakeArg: func() interface{} {
					ret := make([]TrackArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]TrackArg)
					if !ok {
						err = rpc.NewTypeError((*[]TrackArg)(nil), args)
						return
					}
					err = i.Track(ctx, (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"trackWithToken": {
				MakeArg: func() interface{} {
					ret := make([]TrackWithTokenArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]TrackWithTokenArg)
					if !ok {
						err = rpc.NewTypeError((*[]TrackWithTokenArg)(nil), args)
						return
					}
					err = i.TrackWithToken(ctx, (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"untrack": {
				MakeArg: func() interface{} {
					ret := make([]UntrackArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]UntrackArg)
					if !ok {
						err = rpc.NewTypeError((*[]UntrackArg)(nil), args)
						return
					}
					err = i.Untrack(ctx, (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"checkTracking": {
				MakeArg: func() interface{} {
					ret := make([]CheckTrackingArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]CheckTrackingArg)
					if !ok {
						err = rpc.NewTypeError((*[]CheckTrackingArg)(nil), args)
						return
					}
					err = i.CheckTracking(ctx, (*typedArgs)[0].SessionID)
					return
				},
				MethodType: rpc.MethodCall,
			},
			"fakeTrackingChanged": {
				MakeArg: func() interface{} {
					ret := make([]FakeTrackingChangedArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]FakeTrackingChangedArg)
					if !ok {
						err = rpc.NewTypeError((*[]FakeTrackingChangedArg)(nil), args)
						return
					}
					err = i.FakeTrackingChanged(ctx, (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
		},
	}
}

type TrackClient struct {
	Cli GenericClient
}

func (c TrackClient) Track(ctx context.Context, __arg TrackArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.track.track", []interface{}{__arg}, nil)
	return
}

func (c TrackClient) TrackWithToken(ctx context.Context, __arg TrackWithTokenArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.track.trackWithToken", []interface{}{__arg}, nil)
	return
}

func (c TrackClient) Untrack(ctx context.Context, __arg UntrackArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.track.untrack", []interface{}{__arg}, nil)
	return
}

func (c TrackClient) CheckTracking(ctx context.Context, sessionID int) (err error) {
	__arg := CheckTrackingArg{SessionID: sessionID}
	err = c.Cli.Call(ctx, "keybase.1.track.checkTracking", []interface{}{__arg}, nil)
	return
}

func (c TrackClient) FakeTrackingChanged(ctx context.Context, __arg FakeTrackingChangedArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.track.fakeTrackingChanged", []interface{}{__arg}, nil)
	return
}

type PromptDefault int

const (
	PromptDefault_NONE PromptDefault = 0
	PromptDefault_YES  PromptDefault = 1
	PromptDefault_NO   PromptDefault = 2
)

type PromptYesNoArg struct {
	SessionID     int           `codec:"sessionID" json:"sessionID"`
	Text          Text          `codec:"text" json:"text"`
	PromptDefault PromptDefault `codec:"promptDefault" json:"promptDefault"`
}

type UiInterface interface {
	PromptYesNo(context.Context, PromptYesNoArg) (bool, error)
}

func UiProtocol(i UiInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.ui",
		Methods: map[string]rpc.ServeHandlerDescription{
			"promptYesNo": {
				MakeArg: func() interface{} {
					ret := make([]PromptYesNoArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]PromptYesNoArg)
					if !ok {
						err = rpc.NewTypeError((*[]PromptYesNoArg)(nil), args)
						return
					}
					ret, err = i.PromptYesNo(ctx, (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
		},
	}
}

type UiClient struct {
	Cli GenericClient
}

func (c UiClient) PromptYesNo(ctx context.Context, __arg PromptYesNoArg) (res bool, err error) {
	err = c.Cli.Call(ctx, "keybase.1.ui.promptYesNo", []interface{}{__arg}, &res)
	return
}

type Asset struct {
	Name      string `codec:"name" json:"name"`
	Url       string `codec:"url" json:"url"`
	Digest    string `codec:"digest" json:"digest"`
	LocalPath string `codec:"localPath" json:"localPath"`
}

type UpdateType int

const (
	UpdateType_NORMAL   UpdateType = 0
	UpdateType_BUGFIX   UpdateType = 1
	UpdateType_CRITICAL UpdateType = 2
)

type Update struct {
	Version      string     `codec:"version" json:"version"`
	Name         string     `codec:"name" json:"name"`
	Description  string     `codec:"description" json:"description"`
	Instructions *string    `codec:"instructions,omitempty" json:"instructions,omitempty"`
	Type         UpdateType `codec:"type" json:"type"`
	PublishedAt  *Time      `codec:"publishedAt,omitempty" json:"publishedAt,omitempty"`
	Asset        *Asset     `codec:"asset,omitempty" json:"asset,omitempty"`
}

type UpdateOptions struct {
	Version             string `codec:"version" json:"version"`
	Platform            string `codec:"platform" json:"platform"`
	DestinationPath     string `codec:"destinationPath" json:"destinationPath"`
	Source              string `codec:"source" json:"source"`
	URL                 string `codec:"URL" json:"URL"`
	Channel             string `codec:"channel" json:"channel"`
	Force               bool   `codec:"force" json:"force"`
	DefaultInstructions string `codec:"defaultInstructions" json:"defaultInstructions"`
}

type UpdateResult struct {
	Update *Update `codec:"update,omitempty" json:"update,omitempty"`
}

type UpdateArg struct {
	Options UpdateOptions `codec:"options" json:"options"`
}

type UpdateCheckArg struct {
	Force bool `codec:"force" json:"force"`
}

type UpdateInterface interface {
	Update(context.Context, UpdateOptions) (UpdateResult, error)
	UpdateCheck(context.Context, bool) error
}

func UpdateProtocol(i UpdateInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.update",
		Methods: map[string]rpc.ServeHandlerDescription{
			"update": {
				MakeArg: func() interface{} {
					ret := make([]UpdateArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]UpdateArg)
					if !ok {
						err = rpc.NewTypeError((*[]UpdateArg)(nil), args)
						return
					}
					ret, err = i.Update(ctx, (*typedArgs)[0].Options)
					return
				},
				MethodType: rpc.MethodCall,
			},
			"updateCheck": {
				MakeArg: func() interface{} {
					ret := make([]UpdateCheckArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]UpdateCheckArg)
					if !ok {
						err = rpc.NewTypeError((*[]UpdateCheckArg)(nil), args)
						return
					}
					err = i.UpdateCheck(ctx, (*typedArgs)[0].Force)
					return
				},
				MethodType: rpc.MethodCall,
			},
		},
	}
}

type UpdateClient struct {
	Cli GenericClient
}

func (c UpdateClient) Update(ctx context.Context, options UpdateOptions) (res UpdateResult, err error) {
	__arg := UpdateArg{Options: options}
	err = c.Cli.Call(ctx, "keybase.1.update.update", []interface{}{__arg}, &res)
	return
}

func (c UpdateClient) UpdateCheck(ctx context.Context, force bool) (err error) {
	__arg := UpdateCheckArg{Force: force}
	err = c.Cli.Call(ctx, "keybase.1.update.updateCheck", []interface{}{__arg}, nil)
	return
}

type UpdateAction int

const (
	UpdateAction_UPDATE UpdateAction = 0
	UpdateAction_SKIP   UpdateAction = 1
	UpdateAction_SNOOZE UpdateAction = 2
	UpdateAction_CANCEL UpdateAction = 3
)

type UpdatePromptRes struct {
	Action            UpdateAction `codec:"action" json:"action"`
	AlwaysAutoInstall bool         `codec:"alwaysAutoInstall" json:"alwaysAutoInstall"`
	SnoozeUntil       Time         `codec:"snoozeUntil" json:"snoozeUntil"`
}

type UpdatePromptOptions struct {
	AlwaysAutoInstall bool `codec:"alwaysAutoInstall" json:"alwaysAutoInstall"`
}

type UpdateQuitRes struct {
	Quit            bool   `codec:"quit" json:"quit"`
	Pid             int    `codec:"pid" json:"pid"`
	ApplicationPath string `codec:"applicationPath" json:"applicationPath"`
}

type UpdatePromptArg struct {
	SessionID int                 `codec:"sessionID" json:"sessionID"`
	Update    Update              `codec:"update" json:"update"`
	Options   UpdatePromptOptions `codec:"options" json:"options"`
}

type UpdateQuitArg struct {
}

type UpdateUiInterface interface {
	UpdatePrompt(context.Context, UpdatePromptArg) (UpdatePromptRes, error)
	UpdateQuit(context.Context) (UpdateQuitRes, error)
}

func UpdateUiProtocol(i UpdateUiInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.updateUi",
		Methods: map[string]rpc.ServeHandlerDescription{
			"updatePrompt": {
				MakeArg: func() interface{} {
					ret := make([]UpdatePromptArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]UpdatePromptArg)
					if !ok {
						err = rpc.NewTypeError((*[]UpdatePromptArg)(nil), args)
						return
					}
					ret, err = i.UpdatePrompt(ctx, (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"updateQuit": {
				MakeArg: func() interface{} {
					ret := make([]UpdateQuitArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					ret, err = i.UpdateQuit(ctx)
					return
				},
				MethodType: rpc.MethodCall,
			},
		},
	}
}

type UpdateUiClient struct {
	Cli GenericClient
}

func (c UpdateUiClient) UpdatePrompt(ctx context.Context, __arg UpdatePromptArg) (res UpdatePromptRes, err error) {
	err = c.Cli.Call(ctx, "keybase.1.updateUi.updatePrompt", []interface{}{__arg}, &res)
	return
}

func (c UpdateUiClient) UpdateQuit(ctx context.Context) (res UpdateQuitRes, err error) {
	err = c.Cli.Call(ctx, "keybase.1.updateUi.updateQuit", []interface{}{UpdateQuitArg{}}, &res)
	return
}

type Tracker struct {
	Tracker UID  `codec:"tracker" json:"tracker"`
	Status  int  `codec:"status" json:"status"`
	MTime   Time `codec:"mTime" json:"mTime"`
}

type TrackProof struct {
	ProofType string `codec:"proofType" json:"proofType"`
	ProofName string `codec:"proofName" json:"proofName"`
	IdString  string `codec:"idString" json:"idString"`
}

type WebProof struct {
	Hostname  string   `codec:"hostname" json:"hostname"`
	Protocols []string `codec:"protocols" json:"protocols"`
}

type Proofs struct {
	Social     []TrackProof `codec:"social" json:"social"`
	Web        []WebProof   `codec:"web" json:"web"`
	PublicKeys []PublicKey  `codec:"publicKeys" json:"publicKeys"`
}

type UserSummary struct {
	Uid          UID    `codec:"uid" json:"uid"`
	Username     string `codec:"username" json:"username"`
	Thumbnail    string `codec:"thumbnail" json:"thumbnail"`
	IdVersion    int    `codec:"idVersion" json:"idVersion"`
	FullName     string `codec:"fullName" json:"fullName"`
	Bio          string `codec:"bio" json:"bio"`
	Proofs       Proofs `codec:"proofs" json:"proofs"`
	SigIDDisplay string `codec:"sigIDDisplay" json:"sigIDDisplay"`
	TrackTime    Time   `codec:"trackTime" json:"trackTime"`
}

type SearchComponent struct {
	Key   string  `codec:"key" json:"key"`
	Value string  `codec:"value" json:"value"`
	Score float64 `codec:"score" json:"score"`
}

type SearchResult struct {
	Uid        UID               `codec:"uid" json:"uid"`
	Username   string            `codec:"username" json:"username"`
	Components []SearchComponent `codec:"components" json:"components"`
	Score      float64           `codec:"score" json:"score"`
}

type ListTrackersArg struct {
	SessionID int `codec:"sessionID" json:"sessionID"`
	Uid       UID `codec:"uid" json:"uid"`
}

type ListTrackersByNameArg struct {
	SessionID int    `codec:"sessionID" json:"sessionID"`
	Username  string `codec:"username" json:"username"`
}

type ListTrackersSelfArg struct {
	SessionID int `codec:"sessionID" json:"sessionID"`
}

type LoadUncheckedUserSummariesArg struct {
	SessionID int   `codec:"sessionID" json:"sessionID"`
	Uids      []UID `codec:"uids" json:"uids"`
}

type LoadUserArg struct {
	SessionID int `codec:"sessionID" json:"sessionID"`
	Uid       UID `codec:"uid" json:"uid"`
}

type LoadUserPlusKeysArg struct {
	SessionID int  `codec:"sessionID" json:"sessionID"`
	Uid       UID  `codec:"uid" json:"uid"`
	CacheOK   bool `codec:"cacheOK" json:"cacheOK"`
}

type LoadPublicKeysArg struct {
	SessionID int `codec:"sessionID" json:"sessionID"`
	Uid       UID `codec:"uid" json:"uid"`
}

type ListTrackingArg struct {
	SessionID int    `codec:"sessionID" json:"sessionID"`
	Filter    string `codec:"filter" json:"filter"`
}

type ListTrackingJSONArg struct {
	SessionID int    `codec:"sessionID" json:"sessionID"`
	Filter    string `codec:"filter" json:"filter"`
	Verbose   bool   `codec:"verbose" json:"verbose"`
}

type SearchArg struct {
	SessionID int    `codec:"sessionID" json:"sessionID"`
	Query     string `codec:"query" json:"query"`
}

type UserInterface interface {
	ListTrackers(context.Context, ListTrackersArg) ([]Tracker, error)
	ListTrackersByName(context.Context, ListTrackersByNameArg) ([]Tracker, error)
	ListTrackersSelf(context.Context, int) ([]Tracker, error)
	LoadUncheckedUserSummaries(context.Context, LoadUncheckedUserSummariesArg) ([]UserSummary, error)
	LoadUser(context.Context, LoadUserArg) (User, error)
	LoadUserPlusKeys(context.Context, LoadUserPlusKeysArg) (UserPlusKeys, error)
	LoadPublicKeys(context.Context, LoadPublicKeysArg) ([]PublicKey, error)
	ListTracking(context.Context, ListTrackingArg) ([]UserSummary, error)
	ListTrackingJSON(context.Context, ListTrackingJSONArg) (string, error)
	Search(context.Context, SearchArg) ([]SearchResult, error)
}

func UserProtocol(i UserInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.user",
		Methods: map[string]rpc.ServeHandlerDescription{
			"listTrackers": {
				MakeArg: func() interface{} {
					ret := make([]ListTrackersArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]ListTrackersArg)
					if !ok {
						err = rpc.NewTypeError((*[]ListTrackersArg)(nil), args)
						return
					}
					ret, err = i.ListTrackers(ctx, (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"listTrackersByName": {
				MakeArg: func() interface{} {
					ret := make([]ListTrackersByNameArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]ListTrackersByNameArg)
					if !ok {
						err = rpc.NewTypeError((*[]ListTrackersByNameArg)(nil), args)
						return
					}
					ret, err = i.ListTrackersByName(ctx, (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"listTrackersSelf": {
				MakeArg: func() interface{} {
					ret := make([]ListTrackersSelfArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]ListTrackersSelfArg)
					if !ok {
						err = rpc.NewTypeError((*[]ListTrackersSelfArg)(nil), args)
						return
					}
					ret, err = i.ListTrackersSelf(ctx, (*typedArgs)[0].SessionID)
					return
				},
				MethodType: rpc.MethodCall,
			},
			"loadUncheckedUserSummaries": {
				MakeArg: func() interface{} {
					ret := make([]LoadUncheckedUserSummariesArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]LoadUncheckedUserSummariesArg)
					if !ok {
						err = rpc.NewTypeError((*[]LoadUncheckedUserSummariesArg)(nil), args)
						return
					}
					ret, err = i.LoadUncheckedUserSummaries(ctx, (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"loadUser": {
				MakeArg: func() interface{} {
					ret := make([]LoadUserArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]LoadUserArg)
					if !ok {
						err = rpc.NewTypeError((*[]LoadUserArg)(nil), args)
						return
					}
					ret, err = i.LoadUser(ctx, (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"loadUserPlusKeys": {
				MakeArg: func() interface{} {
					ret := make([]LoadUserPlusKeysArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]LoadUserPlusKeysArg)
					if !ok {
						err = rpc.NewTypeError((*[]LoadUserPlusKeysArg)(nil), args)
						return
					}
					ret, err = i.LoadUserPlusKeys(ctx, (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"loadPublicKeys": {
				MakeArg: func() interface{} {
					ret := make([]LoadPublicKeysArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]LoadPublicKeysArg)
					if !ok {
						err = rpc.NewTypeError((*[]LoadPublicKeysArg)(nil), args)
						return
					}
					ret, err = i.LoadPublicKeys(ctx, (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"listTracking": {
				MakeArg: func() interface{} {
					ret := make([]ListTrackingArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]ListTrackingArg)
					if !ok {
						err = rpc.NewTypeError((*[]ListTrackingArg)(nil), args)
						return
					}
					ret, err = i.ListTracking(ctx, (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"listTrackingJSON": {
				MakeArg: func() interface{} {
					ret := make([]ListTrackingJSONArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]ListTrackingJSONArg)
					if !ok {
						err = rpc.NewTypeError((*[]ListTrackingJSONArg)(nil), args)
						return
					}
					ret, err = i.ListTrackingJSON(ctx, (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"search": {
				MakeArg: func() interface{} {
					ret := make([]SearchArg, 1)
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]SearchArg)
					if !ok {
						err = rpc.NewTypeError((*[]SearchArg)(nil), args)
						return
					}
					ret, err = i.Search(ctx, (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
		},
	}
}

type UserClient struct {
	Cli GenericClient
}

func (c UserClient) ListTrackers(ctx context.Context, __arg ListTrackersArg) (res []Tracker, err error) {
	err = c.Cli.Call(ctx, "keybase.1.user.listTrackers", []interface{}{__arg}, &res)
	return
}

func (c UserClient) ListTrackersByName(ctx context.Context, __arg ListTrackersByNameArg) (res []Tracker, err error) {
	err = c.Cli.Call(ctx, "keybase.1.user.listTrackersByName", []interface{}{__arg}, &res)
	return
}

func (c UserClient) ListTrackersSelf(ctx context.Context, sessionID int) (res []Tracker, err error) {
	__arg := ListTrackersSelfArg{SessionID: sessionID}
	err = c.Cli.Call(ctx, "keybase.1.user.listTrackersSelf", []interface{}{__arg}, &res)
	return
}

func (c UserClient) LoadUncheckedUserSummaries(ctx context.Context, __arg LoadUncheckedUserSummariesArg) (res []UserSummary, err error) {
	err = c.Cli.Call(ctx, "keybase.1.user.loadUncheckedUserSummaries", []interface{}{__arg}, &res)
	return
}

func (c UserClient) LoadUser(ctx context.Context, __arg LoadUserArg) (res User, err error) {
	err = c.Cli.Call(ctx, "keybase.1.user.loadUser", []interface{}{__arg}, &res)
	return
}

func (c UserClient) LoadUserPlusKeys(ctx context.Context, __arg LoadUserPlusKeysArg) (res UserPlusKeys, err error) {
	err = c.Cli.Call(ctx, "keybase.1.user.loadUserPlusKeys", []interface{}{__arg}, &res)
	return
}

func (c UserClient) LoadPublicKeys(ctx context.Context, __arg LoadPublicKeysArg) (res []PublicKey, err error) {
	err = c.Cli.Call(ctx, "keybase.1.user.loadPublicKeys", []interface{}{__arg}, &res)
	return
}

func (c UserClient) ListTracking(ctx context.Context, __arg ListTrackingArg) (res []UserSummary, err error) {
	err = c.Cli.Call(ctx, "keybase.1.user.listTracking", []interface{}{__arg}, &res)
	return
}

func (c UserClient) ListTrackingJSON(ctx context.Context, __arg ListTrackingJSONArg) (res string, err error) {
	err = c.Cli.Call(ctx, "keybase.1.user.listTrackingJSON", []interface{}{__arg}, &res)
	return
}

func (c UserClient) Search(ctx context.Context, __arg SearchArg) (res []SearchResult, err error) {
	err = c.Cli.Call(ctx, "keybase.1.user.search", []interface{}{__arg}, &res)
	return
}
