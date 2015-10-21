package keybase1

import (
	rpc "github.com/keybase/go-framed-msgpack-rpc"
	context "golang.org/x/net/context"
)

type GenericClient interface {
	Call(ctx context.Context, s string, args interface{}, res interface{}) error
}

type PassphraseChangeArg struct {
	SessionID     int    `codec:"sessionID" json:"sessionID"`
	OldPassphrase string `codec:"oldPassphrase" json:"oldPassphrase"`
	Passphrase    string `codec:"passphrase" json:"passphrase"`
	Force         bool   `codec:"force" json:"force"`
}

type AccountInterface interface {
	PassphraseChange(context.Context, PassphraseChangeArg) error
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
				Handler: func(args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]PassphraseChangeArg)
					if !ok {
						err = rpc.NewTypeError((*[]PassphraseChangeArg)(nil), args)
						return
					}
					err = i.PassphraseChange(context.TODO(), (*typedArgs)[0])
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
	Type     string   `codec:"type" json:"type"`
	Name     string   `codec:"name" json:"name"`
	DeviceID DeviceID `codec:"deviceID" json:"deviceID"`
	CTime    Time     `codec:"cTime" json:"cTime"`
	MTime    Time     `codec:"mTime" json:"mTime"`
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

type BlockIdCombo struct {
	BlockHash string `codec:"blockHash" json:"blockHash"`
	ChargedTo UID    `codec:"chargedTo" json:"chargedTo"`
}

type GetBlockRes struct {
	BlockKey string `codec:"blockKey" json:"blockKey"`
	Buf      []byte `codec:"buf" json:"buf"`
}

type BlockRefNonce [8]byte
type EstablishSessionArg struct {
	User UID    `codec:"user" json:"user"`
	Sid  string `codec:"sid" json:"sid"`
}

type PutBlockArg struct {
	Bid      BlockIdCombo `codec:"bid" json:"bid"`
	Folder   string       `codec:"folder" json:"folder"`
	BlockKey string       `codec:"blockKey" json:"blockKey"`
	Buf      []byte       `codec:"buf" json:"buf"`
}

type GetBlockArg struct {
	Bid BlockIdCombo `codec:"bid" json:"bid"`
}

type IncBlockReferenceArg struct {
	Bid       BlockIdCombo  `codec:"bid" json:"bid"`
	Nonce     BlockRefNonce `codec:"nonce" json:"nonce"`
	Folder    string        `codec:"folder" json:"folder"`
	ChargedTo UID           `codec:"chargedTo" json:"chargedTo"`
}

type DecBlockReferenceArg struct {
	Bid       BlockIdCombo  `codec:"bid" json:"bid"`
	Nonce     BlockRefNonce `codec:"nonce" json:"nonce"`
	Folder    string        `codec:"folder" json:"folder"`
	ChargedTo UID           `codec:"chargedTo" json:"chargedTo"`
}

type BlockInterface interface {
	EstablishSession(context.Context, EstablishSessionArg) error
	PutBlock(context.Context, PutBlockArg) error
	GetBlock(context.Context, BlockIdCombo) (GetBlockRes, error)
	IncBlockReference(context.Context, IncBlockReferenceArg) error
	DecBlockReference(context.Context, DecBlockReferenceArg) error
}

func BlockProtocol(i BlockInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.block",
		Methods: map[string]rpc.ServeHandlerDescription{
			"establishSession": {
				MakeArg: func() interface{} {
					ret := make([]EstablishSessionArg, 1)
					return &ret
				},
				Handler: func(args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]EstablishSessionArg)
					if !ok {
						err = rpc.NewTypeError((*[]EstablishSessionArg)(nil), args)
						return
					}
					err = i.EstablishSession(context.TODO(), (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"putBlock": {
				MakeArg: func() interface{} {
					ret := make([]PutBlockArg, 1)
					return &ret
				},
				Handler: func(args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]PutBlockArg)
					if !ok {
						err = rpc.NewTypeError((*[]PutBlockArg)(nil), args)
						return
					}
					err = i.PutBlock(context.TODO(), (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"getBlock": {
				MakeArg: func() interface{} {
					ret := make([]GetBlockArg, 1)
					return &ret
				},
				Handler: func(args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]GetBlockArg)
					if !ok {
						err = rpc.NewTypeError((*[]GetBlockArg)(nil), args)
						return
					}
					ret, err = i.GetBlock(context.TODO(), (*typedArgs)[0].Bid)
					return
				},
				MethodType: rpc.MethodCall,
			},
			"incBlockReference": {
				MakeArg: func() interface{} {
					ret := make([]IncBlockReferenceArg, 1)
					return &ret
				},
				Handler: func(args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]IncBlockReferenceArg)
					if !ok {
						err = rpc.NewTypeError((*[]IncBlockReferenceArg)(nil), args)
						return
					}
					err = i.IncBlockReference(context.TODO(), (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"decBlockReference": {
				MakeArg: func() interface{} {
					ret := make([]DecBlockReferenceArg, 1)
					return &ret
				},
				Handler: func(args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]DecBlockReferenceArg)
					if !ok {
						err = rpc.NewTypeError((*[]DecBlockReferenceArg)(nil), args)
						return
					}
					err = i.DecBlockReference(context.TODO(), (*typedArgs)[0])
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

func (c BlockClient) EstablishSession(ctx context.Context, __arg EstablishSessionArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.block.establishSession", []interface{}{__arg}, nil)
	return
}

func (c BlockClient) PutBlock(ctx context.Context, __arg PutBlockArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.block.putBlock", []interface{}{__arg}, nil)
	return
}

func (c BlockClient) GetBlock(ctx context.Context, bid BlockIdCombo) (res GetBlockRes, err error) {
	__arg := GetBlockArg{Bid: bid}
	err = c.Cli.Call(ctx, "keybase.1.block.getBlock", []interface{}{__arg}, &res)
	return
}

func (c BlockClient) IncBlockReference(ctx context.Context, __arg IncBlockReferenceArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.block.incBlockReference", []interface{}{__arg}, nil)
	return
}

func (c BlockClient) DecBlockReference(ctx context.Context, __arg DecBlockReferenceArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.block.decBlockReference", []interface{}{__arg}, nil)
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
				Handler: func(args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]RegisterBTCArg)
					if !ok {
						err = rpc.NewTypeError((*[]RegisterBTCArg)(nil), args)
						return
					}
					err = i.RegisterBTC(context.TODO(), (*typedArgs)[0])
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

type Config struct {
	ServerURI  string `codec:"serverURI" json:"serverURI"`
	SocketFile string `codec:"socketFile" json:"socketFile"`
	Label      string `codec:"label" json:"label"`
	RunMode    string `codec:"runMode" json:"runMode"`
	GpgExists  bool   `codec:"gpgExists" json:"gpgExists"`
	GpgPath    string `codec:"gpgPath" json:"gpgPath"`
	Version    string `codec:"version" json:"version"`
	Path       string `codec:"path" json:"path"`
	ConfigPath string `codec:"configPath" json:"configPath"`
}

type GetCurrentStatusArg struct {
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

type ConfigInterface interface {
	GetCurrentStatus(context.Context, int) (GetCurrentStatusRes, error)
	GetConfig(context.Context, int) (Config, error)
	SetUserConfig(context.Context, SetUserConfigArg) error
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
				Handler: func(args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]GetCurrentStatusArg)
					if !ok {
						err = rpc.NewTypeError((*[]GetCurrentStatusArg)(nil), args)
						return
					}
					ret, err = i.GetCurrentStatus(context.TODO(), (*typedArgs)[0].SessionID)
					return
				},
				MethodType: rpc.MethodCall,
			},
			"getConfig": {
				MakeArg: func() interface{} {
					ret := make([]GetConfigArg, 1)
					return &ret
				},
				Handler: func(args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]GetConfigArg)
					if !ok {
						err = rpc.NewTypeError((*[]GetConfigArg)(nil), args)
						return
					}
					ret, err = i.GetConfig(context.TODO(), (*typedArgs)[0].SessionID)
					return
				},
				MethodType: rpc.MethodCall,
			},
			"setUserConfig": {
				MakeArg: func() interface{} {
					ret := make([]SetUserConfigArg, 1)
					return &ret
				},
				Handler: func(args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]SetUserConfigArg)
					if !ok {
						err = rpc.NewTypeError((*[]SetUserConfigArg)(nil), args)
						return
					}
					err = i.SetUserConfig(context.TODO(), (*typedArgs)[0])
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

func (c ConfigClient) GetConfig(ctx context.Context, sessionID int) (res Config, err error) {
	__arg := GetConfigArg{SessionID: sessionID}
	err = c.Cli.Call(ctx, "keybase.1.config.getConfig", []interface{}{__arg}, &res)
	return
}

func (c ConfigClient) SetUserConfig(ctx context.Context, __arg SetUserConfigArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.config.setUserConfig", []interface{}{__arg}, nil)
	return
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
type SignED25519Arg struct {
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

type CryptoInterface interface {
	SignED25519(context.Context, SignED25519Arg) (ED25519SignatureInfo, error)
	UnboxBytes32(context.Context, UnboxBytes32Arg) (Bytes32, error)
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
				Handler: func(args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]SignED25519Arg)
					if !ok {
						err = rpc.NewTypeError((*[]SignED25519Arg)(nil), args)
						return
					}
					ret, err = i.SignED25519(context.TODO(), (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"unboxBytes32": {
				MakeArg: func() interface{} {
					ret := make([]UnboxBytes32Arg, 1)
					return &ret
				},
				Handler: func(args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]UnboxBytes32Arg)
					if !ok {
						err = rpc.NewTypeError((*[]UnboxBytes32Arg)(nil), args)
						return
					}
					ret, err = i.UnboxBytes32(context.TODO(), (*typedArgs)[0])
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

func (c CryptoClient) UnboxBytes32(ctx context.Context, __arg UnboxBytes32Arg) (res Bytes32, err error) {
	err = c.Cli.Call(ctx, "keybase.1.crypto.unboxBytes32", []interface{}{__arg}, &res)
	return
}

type StopArg struct {
	SessionID int `codec:"sessionID" json:"sessionID"`
}

type LogRotateArg struct {
	SessionID int `codec:"sessionID" json:"sessionID"`
}

type SetLogLevelArg struct {
	SessionID int      `codec:"sessionID" json:"sessionID"`
	Level     LogLevel `codec:"level" json:"level"`
}

type ReloadArg struct {
	SessionID int `codec:"sessionID" json:"sessionID"`
}

type DbNukeArg struct {
	SessionID int `codec:"sessionID" json:"sessionID"`
}

type CtlInterface interface {
	Stop(context.Context, int) error
	LogRotate(context.Context, int) error
	SetLogLevel(context.Context, SetLogLevelArg) error
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
				Handler: func(args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]StopArg)
					if !ok {
						err = rpc.NewTypeError((*[]StopArg)(nil), args)
						return
					}
					err = i.Stop(context.TODO(), (*typedArgs)[0].SessionID)
					return
				},
				MethodType: rpc.MethodCall,
			},
			"logRotate": {
				MakeArg: func() interface{} {
					ret := make([]LogRotateArg, 1)
					return &ret
				},
				Handler: func(args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]LogRotateArg)
					if !ok {
						err = rpc.NewTypeError((*[]LogRotateArg)(nil), args)
						return
					}
					err = i.LogRotate(context.TODO(), (*typedArgs)[0].SessionID)
					return
				},
				MethodType: rpc.MethodCall,
			},
			"setLogLevel": {
				MakeArg: func() interface{} {
					ret := make([]SetLogLevelArg, 1)
					return &ret
				},
				Handler: func(args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]SetLogLevelArg)
					if !ok {
						err = rpc.NewTypeError((*[]SetLogLevelArg)(nil), args)
						return
					}
					err = i.SetLogLevel(context.TODO(), (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"reload": {
				MakeArg: func() interface{} {
					ret := make([]ReloadArg, 1)
					return &ret
				},
				Handler: func(args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]ReloadArg)
					if !ok {
						err = rpc.NewTypeError((*[]ReloadArg)(nil), args)
						return
					}
					err = i.Reload(context.TODO(), (*typedArgs)[0].SessionID)
					return
				},
				MethodType: rpc.MethodCall,
			},
			"dbNuke": {
				MakeArg: func() interface{} {
					ret := make([]DbNukeArg, 1)
					return &ret
				},
				Handler: func(args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]DbNukeArg)
					if !ok {
						err = rpc.NewTypeError((*[]DbNukeArg)(nil), args)
						return
					}
					err = i.DbNuke(context.TODO(), (*typedArgs)[0].SessionID)
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

func (c CtlClient) Stop(ctx context.Context, sessionID int) (err error) {
	__arg := StopArg{SessionID: sessionID}
	err = c.Cli.Call(ctx, "keybase.1.ctl.stop", []interface{}{__arg}, nil)
	return
}

func (c CtlClient) LogRotate(ctx context.Context, sessionID int) (err error) {
	__arg := LogRotateArg{SessionID: sessionID}
	err = c.Cli.Call(ctx, "keybase.1.ctl.logRotate", []interface{}{__arg}, nil)
	return
}

func (c CtlClient) SetLogLevel(ctx context.Context, __arg SetLogLevelArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.ctl.setLogLevel", []interface{}{__arg}, nil)
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
				Handler: func(args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]FirstStepArg)
					if !ok {
						err = rpc.NewTypeError((*[]FirstStepArg)(nil), args)
						return
					}
					ret, err = i.FirstStep(context.TODO(), (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"secondStep": {
				MakeArg: func() interface{} {
					ret := make([]SecondStepArg, 1)
					return &ret
				},
				Handler: func(args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]SecondStepArg)
					if !ok {
						err = rpc.NewTypeError((*[]SecondStepArg)(nil), args)
						return
					}
					ret, err = i.SecondStep(context.TODO(), (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"increment": {
				MakeArg: func() interface{} {
					ret := make([]IncrementArg, 1)
					return &ret
				},
				Handler: func(args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]IncrementArg)
					if !ok {
						err = rpc.NewTypeError((*[]IncrementArg)(nil), args)
						return
					}
					ret, err = i.Increment(context.TODO(), (*typedArgs)[0])
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

type DeviceListArg struct {
	SessionID int `codec:"sessionID" json:"sessionID"`
}

type DeviceAddArg struct {
	SessionID    int    `codec:"sessionID" json:"sessionID"`
	SecretPhrase string `codec:"secretPhrase" json:"secretPhrase"`
}

type DeviceAddCancelArg struct {
	SessionID int `codec:"sessionID" json:"sessionID"`
}

type DeviceXAddArg struct {
	SessionID int `codec:"sessionID" json:"sessionID"`
}

type DeviceInterface interface {
	DeviceList(context.Context, int) ([]Device, error)
	DeviceAdd(context.Context, DeviceAddArg) error
	DeviceAddCancel(context.Context, int) error
	DeviceXAdd(context.Context, int) error
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
				Handler: func(args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]DeviceListArg)
					if !ok {
						err = rpc.NewTypeError((*[]DeviceListArg)(nil), args)
						return
					}
					ret, err = i.DeviceList(context.TODO(), (*typedArgs)[0].SessionID)
					return
				},
				MethodType: rpc.MethodCall,
			},
			"deviceAdd": {
				MakeArg: func() interface{} {
					ret := make([]DeviceAddArg, 1)
					return &ret
				},
				Handler: func(args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]DeviceAddArg)
					if !ok {
						err = rpc.NewTypeError((*[]DeviceAddArg)(nil), args)
						return
					}
					err = i.DeviceAdd(context.TODO(), (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"deviceAddCancel": {
				MakeArg: func() interface{} {
					ret := make([]DeviceAddCancelArg, 1)
					return &ret
				},
				Handler: func(args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]DeviceAddCancelArg)
					if !ok {
						err = rpc.NewTypeError((*[]DeviceAddCancelArg)(nil), args)
						return
					}
					err = i.DeviceAddCancel(context.TODO(), (*typedArgs)[0].SessionID)
					return
				},
				MethodType: rpc.MethodCall,
			},
			"deviceXAdd": {
				MakeArg: func() interface{} {
					ret := make([]DeviceXAddArg, 1)
					return &ret
				},
				Handler: func(args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]DeviceXAddArg)
					if !ok {
						err = rpc.NewTypeError((*[]DeviceXAddArg)(nil), args)
						return
					}
					err = i.DeviceXAdd(context.TODO(), (*typedArgs)[0].SessionID)
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

func (c DeviceClient) DeviceAdd(ctx context.Context, __arg DeviceAddArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.device.deviceAdd", []interface{}{__arg}, nil)
	return
}

func (c DeviceClient) DeviceAddCancel(ctx context.Context, sessionID int) (err error) {
	__arg := DeviceAddCancelArg{SessionID: sessionID}
	err = c.Cli.Call(ctx, "keybase.1.device.deviceAddCancel", []interface{}{__arg}, nil)
	return
}

func (c DeviceClient) DeviceXAdd(ctx context.Context, sessionID int) (err error) {
	__arg := DeviceXAddArg{SessionID: sessionID}
	err = c.Cli.Call(ctx, "keybase.1.device.deviceXAdd", []interface{}{__arg}, nil)
	return
}

type DoctorArg struct {
	SessionID int `codec:"sessionID" json:"sessionID"`
}

type DoctorInterface interface {
	Doctor(context.Context, int) error
}

func DoctorProtocol(i DoctorInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.doctor",
		Methods: map[string]rpc.ServeHandlerDescription{
			"doctor": {
				MakeArg: func() interface{} {
					ret := make([]DoctorArg, 1)
					return &ret
				},
				Handler: func(args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]DoctorArg)
					if !ok {
						err = rpc.NewTypeError((*[]DoctorArg)(nil), args)
						return
					}
					err = i.Doctor(context.TODO(), (*typedArgs)[0].SessionID)
					return
				},
				MethodType: rpc.MethodCall,
			},
		},
	}
}

type DoctorClient struct {
	Cli GenericClient
}

func (c DoctorClient) Doctor(ctx context.Context, sessionID int) (err error) {
	__arg := DoctorArg{SessionID: sessionID}
	err = c.Cli.Call(ctx, "keybase.1.doctor.doctor", []interface{}{__arg}, nil)
	return
}

type DoctorFixType int

const (
	DoctorFixType_NONE               DoctorFixType = 0
	DoctorFixType_ADD_ELDEST_DEVICE  DoctorFixType = 1
	DoctorFixType_ADD_SIBLING_DEVICE DoctorFixType = 2
)

type DoctorSignerOpts struct {
	OtherDevice bool `codec:"otherDevice" json:"otherDevice"`
	PGP         bool `codec:"pgp" json:"pgp"`
	Internal    bool `codec:"internal" json:"internal"`
}

type DoctorStatus struct {
	Fix           DoctorFixType    `codec:"fix" json:"fix"`
	SignerOpts    DoctorSignerOpts `codec:"signerOpts" json:"signerOpts"`
	Devices       []Device         `codec:"devices" json:"devices"`
	CurrentDevice *Device          `codec:"currentDevice,omitempty" json:"currentDevice,omitempty"`
}

type LoginSelectArg struct {
	SessionID   int      `codec:"sessionID" json:"sessionID"`
	CurrentUser string   `codec:"currentUser" json:"currentUser"`
	OtherUsers  []string `codec:"otherUsers" json:"otherUsers"`
}

type DisplayStatusArg struct {
	SessionID int          `codec:"sessionID" json:"sessionID"`
	Status    DoctorStatus `codec:"status" json:"status"`
}

type DisplayResultArg struct {
	SessionID int    `codec:"sessionID" json:"sessionID"`
	Message   string `codec:"message" json:"message"`
}

type DoctorUiInterface interface {
	LoginSelect(context.Context, LoginSelectArg) (string, error)
	DisplayStatus(context.Context, DisplayStatusArg) (bool, error)
	DisplayResult(context.Context, DisplayResultArg) error
}

func DoctorUiProtocol(i DoctorUiInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.doctorUi",
		Methods: map[string]rpc.ServeHandlerDescription{
			"loginSelect": {
				MakeArg: func() interface{} {
					ret := make([]LoginSelectArg, 1)
					return &ret
				},
				Handler: func(args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]LoginSelectArg)
					if !ok {
						err = rpc.NewTypeError((*[]LoginSelectArg)(nil), args)
						return
					}
					ret, err = i.LoginSelect(context.TODO(), (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"displayStatus": {
				MakeArg: func() interface{} {
					ret := make([]DisplayStatusArg, 1)
					return &ret
				},
				Handler: func(args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]DisplayStatusArg)
					if !ok {
						err = rpc.NewTypeError((*[]DisplayStatusArg)(nil), args)
						return
					}
					ret, err = i.DisplayStatus(context.TODO(), (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"displayResult": {
				MakeArg: func() interface{} {
					ret := make([]DisplayResultArg, 1)
					return &ret
				},
				Handler: func(args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]DisplayResultArg)
					if !ok {
						err = rpc.NewTypeError((*[]DisplayResultArg)(nil), args)
						return
					}
					err = i.DisplayResult(context.TODO(), (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
		},
	}
}

type DoctorUiClient struct {
	Cli GenericClient
}

func (c DoctorUiClient) LoginSelect(ctx context.Context, __arg LoginSelectArg) (res string, err error) {
	err = c.Cli.Call(ctx, "keybase.1.doctorUi.loginSelect", []interface{}{__arg}, &res)
	return
}

func (c DoctorUiClient) DisplayStatus(ctx context.Context, __arg DisplayStatusArg) (res bool, err error) {
	err = c.Cli.Call(ctx, "keybase.1.doctorUi.displayStatus", []interface{}{__arg}, &res)
	return
}

func (c DoctorUiClient) DisplayResult(ctx context.Context, __arg DisplayResultArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.doctorUi.displayResult", []interface{}{__arg}, nil)
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
				Handler: func(args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]FavoriteAddArg)
					if !ok {
						err = rpc.NewTypeError((*[]FavoriteAddArg)(nil), args)
						return
					}
					err = i.FavoriteAdd(context.TODO(), (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"favoriteDelete": {
				MakeArg: func() interface{} {
					ret := make([]FavoriteDeleteArg, 1)
					return &ret
				},
				Handler: func(args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]FavoriteDeleteArg)
					if !ok {
						err = rpc.NewTypeError((*[]FavoriteDeleteArg)(nil), args)
						return
					}
					err = i.FavoriteDelete(context.TODO(), (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"favoriteList": {
				MakeArg: func() interface{} {
					ret := make([]FavoriteListArg, 1)
					return &ret
				},
				Handler: func(args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]FavoriteListArg)
					if !ok {
						err = rpc.NewTypeError((*[]FavoriteListArg)(nil), args)
						return
					}
					ret, err = i.FavoriteList(context.TODO(), (*typedArgs)[0].SessionID)
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

type GpgUiInterface interface {
	WantToAddGPGKey(context.Context, int) (bool, error)
	ConfirmDuplicateKeyChosen(context.Context, int) (bool, error)
	SelectKeyAndPushOption(context.Context, SelectKeyAndPushOptionArg) (SelectKeyRes, error)
	SelectKey(context.Context, SelectKeyArg) (string, error)
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
				Handler: func(args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]WantToAddGPGKeyArg)
					if !ok {
						err = rpc.NewTypeError((*[]WantToAddGPGKeyArg)(nil), args)
						return
					}
					ret, err = i.WantToAddGPGKey(context.TODO(), (*typedArgs)[0].SessionID)
					return
				},
				MethodType: rpc.MethodCall,
			},
			"confirmDuplicateKeyChosen": {
				MakeArg: func() interface{} {
					ret := make([]ConfirmDuplicateKeyChosenArg, 1)
					return &ret
				},
				Handler: func(args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]ConfirmDuplicateKeyChosenArg)
					if !ok {
						err = rpc.NewTypeError((*[]ConfirmDuplicateKeyChosenArg)(nil), args)
						return
					}
					ret, err = i.ConfirmDuplicateKeyChosen(context.TODO(), (*typedArgs)[0].SessionID)
					return
				},
				MethodType: rpc.MethodCall,
			},
			"selectKeyAndPushOption": {
				MakeArg: func() interface{} {
					ret := make([]SelectKeyAndPushOptionArg, 1)
					return &ret
				},
				Handler: func(args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]SelectKeyAndPushOptionArg)
					if !ok {
						err = rpc.NewTypeError((*[]SelectKeyAndPushOptionArg)(nil), args)
						return
					}
					ret, err = i.SelectKeyAndPushOption(context.TODO(), (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"selectKey": {
				MakeArg: func() interface{} {
					ret := make([]SelectKeyArg, 1)
					return &ret
				},
				Handler: func(args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]SelectKeyArg)
					if !ok {
						err = rpc.NewTypeError((*[]SelectKeyArg)(nil), args)
						return
					}
					ret, err = i.SelectKey(context.TODO(), (*typedArgs)[0])
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
}

type IdentifyOutcome struct {
	Username          string        `codec:"username" json:"username"`
	Status            *Status       `codec:"status,omitempty" json:"status,omitempty"`
	Warnings          []string      `codec:"warnings" json:"warnings"`
	TrackUsed         *TrackSummary `codec:"trackUsed,omitempty" json:"trackUsed,omitempty"`
	TrackStatus       TrackStatus   `codec:"trackStatus" json:"trackStatus"`
	NumTrackFailures  int           `codec:"numTrackFailures" json:"numTrackFailures"`
	NumTrackChanges   int           `codec:"numTrackChanges" json:"numTrackChanges"`
	NumProofFailures  int           `codec:"numProofFailures" json:"numProofFailures"`
	NumRevoked        int           `codec:"numRevoked" json:"numRevoked"`
	NumProofSuccesses int           `codec:"numProofSuccesses" json:"numProofSuccesses"`
	Revoked           []TrackDiff   `codec:"revoked" json:"revoked"`
	TrackOptions      TrackOptions  `codec:"trackOptions" json:"trackOptions"`
}

type IdentifyRes struct {
	User       *User           `codec:"user,omitempty" json:"user,omitempty"`
	PublicKeys []PublicKey     `codec:"publicKeys" json:"publicKeys"`
	Outcome    IdentifyOutcome `codec:"outcome" json:"outcome"`
	TrackToken string          `codec:"trackToken" json:"trackToken"`
}

type RemoteProof struct {
	ProofType     ProofType `codec:"proofType" json:"proofType"`
	Key           string    `codec:"key" json:"key"`
	Value         string    `codec:"value" json:"value"`
	DisplayMarkup string    `codec:"displayMarkup" json:"displayMarkup"`
	SigID         SigID     `codec:"sigID" json:"sigID"`
	MTime         Time      `codec:"mTime" json:"mTime"`
}

type IdentifyArg struct {
	SessionID        int    `codec:"sessionID" json:"sessionID"`
	UserAssertion    string `codec:"userAssertion" json:"userAssertion"`
	TrackStatement   bool   `codec:"trackStatement" json:"trackStatement"`
	ForceRemoteCheck bool   `codec:"forceRemoteCheck" json:"forceRemoteCheck"`
}

type IdentifyInterface interface {
	Identify(context.Context, IdentifyArg) (IdentifyRes, error)
}

func IdentifyProtocol(i IdentifyInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.identify",
		Methods: map[string]rpc.ServeHandlerDescription{
			"identify": {
				MakeArg: func() interface{} {
					ret := make([]IdentifyArg, 1)
					return &ret
				},
				Handler: func(args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]IdentifyArg)
					if !ok {
						err = rpc.NewTypeError((*[]IdentifyArg)(nil), args)
						return
					}
					ret, err = i.Identify(context.TODO(), (*typedArgs)[0])
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

func (c IdentifyClient) Identify(ctx context.Context, __arg IdentifyArg) (res IdentifyRes, err error) {
	err = c.Cli.Call(ctx, "keybase.1.identify.identify", []interface{}{__arg}, &res)
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

type CheckResult struct {
	ProofResult   ProofResult `codec:"proofResult" json:"proofResult"`
	Time          Time        `codec:"time" json:"time"`
	DisplayMarkup string      `codec:"displayMarkup" json:"displayMarkup"`
}

type LinkCheckResult struct {
	ProofId     int          `codec:"proofId" json:"proofId"`
	ProofResult ProofResult  `codec:"proofResult" json:"proofResult"`
	Cached      *CheckResult `codec:"cached,omitempty" json:"cached,omitempty"`
	Diff        *TrackDiff   `codec:"diff,omitempty" json:"diff,omitempty"`
	RemoteDiff  *TrackDiff   `codec:"remoteDiff,omitempty" json:"remoteDiff,omitempty"`
	Hint        *SigHint     `codec:"hint,omitempty" json:"hint,omitempty"`
}

type StartArg struct {
	SessionID int    `codec:"sessionID" json:"sessionID"`
	Username  string `codec:"username" json:"username"`
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

type ConfirmArg struct {
	SessionID int             `codec:"sessionID" json:"sessionID"`
	Outcome   IdentifyOutcome `codec:"outcome" json:"outcome"`
}

type FinishArg struct {
	SessionID int `codec:"sessionID" json:"sessionID"`
}

type IdentifyUiInterface interface {
	Start(context.Context, StartArg) error
	DisplayKey(context.Context, DisplayKeyArg) error
	ReportLastTrack(context.Context, ReportLastTrackArg) error
	LaunchNetworkChecks(context.Context, LaunchNetworkChecksArg) error
	DisplayTrackStatement(context.Context, DisplayTrackStatementArg) error
	FinishWebProofCheck(context.Context, FinishWebProofCheckArg) error
	FinishSocialProofCheck(context.Context, FinishSocialProofCheckArg) error
	DisplayCryptocurrency(context.Context, DisplayCryptocurrencyArg) error
	Confirm(context.Context, ConfirmArg) (bool, error)
	Finish(context.Context, int) error
}

func IdentifyUiProtocol(i IdentifyUiInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.identifyUi",
		Methods: map[string]rpc.ServeHandlerDescription{
			"start": {
				MakeArg: func() interface{} {
					ret := make([]StartArg, 1)
					return &ret
				},
				Handler: func(args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]StartArg)
					if !ok {
						err = rpc.NewTypeError((*[]StartArg)(nil), args)
						return
					}
					err = i.Start(context.TODO(), (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"displayKey": {
				MakeArg: func() interface{} {
					ret := make([]DisplayKeyArg, 1)
					return &ret
				},
				Handler: func(args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]DisplayKeyArg)
					if !ok {
						err = rpc.NewTypeError((*[]DisplayKeyArg)(nil), args)
						return
					}
					err = i.DisplayKey(context.TODO(), (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"reportLastTrack": {
				MakeArg: func() interface{} {
					ret := make([]ReportLastTrackArg, 1)
					return &ret
				},
				Handler: func(args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]ReportLastTrackArg)
					if !ok {
						err = rpc.NewTypeError((*[]ReportLastTrackArg)(nil), args)
						return
					}
					err = i.ReportLastTrack(context.TODO(), (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"launchNetworkChecks": {
				MakeArg: func() interface{} {
					ret := make([]LaunchNetworkChecksArg, 1)
					return &ret
				},
				Handler: func(args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]LaunchNetworkChecksArg)
					if !ok {
						err = rpc.NewTypeError((*[]LaunchNetworkChecksArg)(nil), args)
						return
					}
					err = i.LaunchNetworkChecks(context.TODO(), (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"displayTrackStatement": {
				MakeArg: func() interface{} {
					ret := make([]DisplayTrackStatementArg, 1)
					return &ret
				},
				Handler: func(args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]DisplayTrackStatementArg)
					if !ok {
						err = rpc.NewTypeError((*[]DisplayTrackStatementArg)(nil), args)
						return
					}
					err = i.DisplayTrackStatement(context.TODO(), (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"finishWebProofCheck": {
				MakeArg: func() interface{} {
					ret := make([]FinishWebProofCheckArg, 1)
					return &ret
				},
				Handler: func(args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]FinishWebProofCheckArg)
					if !ok {
						err = rpc.NewTypeError((*[]FinishWebProofCheckArg)(nil), args)
						return
					}
					err = i.FinishWebProofCheck(context.TODO(), (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"finishSocialProofCheck": {
				MakeArg: func() interface{} {
					ret := make([]FinishSocialProofCheckArg, 1)
					return &ret
				},
				Handler: func(args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]FinishSocialProofCheckArg)
					if !ok {
						err = rpc.NewTypeError((*[]FinishSocialProofCheckArg)(nil), args)
						return
					}
					err = i.FinishSocialProofCheck(context.TODO(), (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"displayCryptocurrency": {
				MakeArg: func() interface{} {
					ret := make([]DisplayCryptocurrencyArg, 1)
					return &ret
				},
				Handler: func(args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]DisplayCryptocurrencyArg)
					if !ok {
						err = rpc.NewTypeError((*[]DisplayCryptocurrencyArg)(nil), args)
						return
					}
					err = i.DisplayCryptocurrency(context.TODO(), (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"confirm": {
				MakeArg: func() interface{} {
					ret := make([]ConfirmArg, 1)
					return &ret
				},
				Handler: func(args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]ConfirmArg)
					if !ok {
						err = rpc.NewTypeError((*[]ConfirmArg)(nil), args)
						return
					}
					ret, err = i.Confirm(context.TODO(), (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"finish": {
				MakeArg: func() interface{} {
					ret := make([]FinishArg, 1)
					return &ret
				},
				Handler: func(args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]FinishArg)
					if !ok {
						err = rpc.NewTypeError((*[]FinishArg)(nil), args)
						return
					}
					err = i.Finish(context.TODO(), (*typedArgs)[0].SessionID)
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

func (c IdentifyUiClient) Confirm(ctx context.Context, __arg ConfirmArg) (res bool, err error) {
	err = c.Cli.Call(ctx, "keybase.1.identifyUi.confirm", []interface{}{__arg}, &res)
	return
}

func (c IdentifyUiClient) Finish(ctx context.Context, sessionID int) (err error) {
	__arg := FinishArg{SessionID: sessionID}
	err = c.Cli.Call(ctx, "keybase.1.identifyUi.finish", []interface{}{__arg}, nil)
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
				Handler: func(args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]HelloArg)
					if !ok {
						err = rpc.NewTypeError((*[]HelloArg)(nil), args)
						return
					}
					ret, err = i.Hello(context.TODO(), (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"didCounterSign": {
				MakeArg: func() interface{} {
					ret := make([]DidCounterSignArg, 1)
					return &ret
				},
				Handler: func(args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]DidCounterSignArg)
					if !ok {
						err = rpc.NewTypeError((*[]DidCounterSignArg)(nil), args)
						return
					}
					err = i.DidCounterSign(context.TODO(), (*typedArgs)[0].Sig)
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
				Handler: func(args interface{}) (ret interface{}, err error) {
					err = i.KexStart(context.TODO())
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
	err = c.Cli.Call(ctx, "keybase.1.Kex2Provisioner.kexStart", []interface{}{KexStartArg{}}, nil)
	return
}

type DeviceSignerKind int

const (
	DeviceSignerKind_DEVICE           DeviceSignerKind = 0
	DeviceSignerKind_PGP              DeviceSignerKind = 1
	DeviceSignerKind_PAPER_BACKUP_KEY DeviceSignerKind = 2
)

type SelectSignerAction int

const (
	SelectSignerAction_SIGN   SelectSignerAction = 0
	SelectSignerAction_CANCEL SelectSignerAction = 1
)

type DeviceSigner struct {
	Kind       DeviceSignerKind `codec:"kind" json:"kind"`
	DeviceID   *DeviceID        `codec:"deviceID,omitempty" json:"deviceID,omitempty"`
	DeviceName *string          `codec:"deviceName,omitempty" json:"deviceName,omitempty"`
}

type SelectSignerRes struct {
	Action SelectSignerAction `codec:"action" json:"action"`
	Signer *DeviceSigner      `codec:"signer,omitempty" json:"signer,omitempty"`
}

type KexStatusCode int

const (
	KexStatusCode_START_SEND           KexStatusCode = 0
	KexStatusCode_HELLO_WAIT           KexStatusCode = 1
	KexStatusCode_HELLO_RECEIVED       KexStatusCode = 2
	KexStatusCode_PLEASE_SIGN_SEND     KexStatusCode = 3
	KexStatusCode_DONE_WAIT            KexStatusCode = 4
	KexStatusCode_DONE_RECEIVED        KexStatusCode = 5
	KexStatusCode_START_WAIT           KexStatusCode = 6
	KexStatusCode_START_RECEIVED       KexStatusCode = 7
	KexStatusCode_HELLO_SEND           KexStatusCode = 8
	KexStatusCode_PLEASE_SIGN_WAIT     KexStatusCode = 9
	KexStatusCode_PLEASE_SIGN_RECEIVED KexStatusCode = 10
	KexStatusCode_DONE_SEND            KexStatusCode = 11
	KexStatusCode_END                  KexStatusCode = 12
)

type PromptDeviceNameArg struct {
	SessionID int `codec:"sessionID" json:"sessionID"`
}

type DeviceNameTakenArg struct {
	SessionID int    `codec:"sessionID" json:"sessionID"`
	Name      string `codec:"name" json:"name"`
}

type SelectSignerArg struct {
	SessionID         int      `codec:"sessionID" json:"sessionID"`
	Devices           []Device `codec:"devices" json:"devices"`
	HasPGP            bool     `codec:"hasPGP" json:"hasPGP"`
	HasPaperBackupKey bool     `codec:"hasPaperBackupKey" json:"hasPaperBackupKey"`
}

type DeviceSignAttemptErrArg struct {
	SessionID int    `codec:"sessionID" json:"sessionID"`
	Msg       string `codec:"msg" json:"msg"`
	Attempt   int    `codec:"attempt" json:"attempt"`
	Total     int    `codec:"total" json:"total"`
}

type DisplaySecretWordsArg struct {
	SessionID          int    `codec:"sessionID" json:"sessionID"`
	Secret             string `codec:"secret" json:"secret"`
	DeviceNameExisting string `codec:"deviceNameExisting" json:"deviceNameExisting"`
	DeviceNameToAdd    string `codec:"deviceNameToAdd" json:"deviceNameToAdd"`
}

type KexStatusArg struct {
	SessionID int           `codec:"sessionID" json:"sessionID"`
	Msg       string        `codec:"msg" json:"msg"`
	Code      KexStatusCode `codec:"code" json:"code"`
}

type DisplayProvisionSuccessArg struct {
	SessionID int    `codec:"sessionID" json:"sessionID"`
	Username  string `codec:"username" json:"username"`
}

type LocksmithUiInterface interface {
	PromptDeviceName(context.Context, int) (string, error)
	DeviceNameTaken(context.Context, DeviceNameTakenArg) error
	SelectSigner(context.Context, SelectSignerArg) (SelectSignerRes, error)
	DeviceSignAttemptErr(context.Context, DeviceSignAttemptErrArg) error
	DisplaySecretWords(context.Context, DisplaySecretWordsArg) error
	KexStatus(context.Context, KexStatusArg) error
	DisplayProvisionSuccess(context.Context, DisplayProvisionSuccessArg) error
}

func LocksmithUiProtocol(i LocksmithUiInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.locksmithUi",
		Methods: map[string]rpc.ServeHandlerDescription{
			"promptDeviceName": {
				MakeArg: func() interface{} {
					ret := make([]PromptDeviceNameArg, 1)
					return &ret
				},
				Handler: func(args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]PromptDeviceNameArg)
					if !ok {
						err = rpc.NewTypeError((*[]PromptDeviceNameArg)(nil), args)
						return
					}
					ret, err = i.PromptDeviceName(context.TODO(), (*typedArgs)[0].SessionID)
					return
				},
				MethodType: rpc.MethodCall,
			},
			"deviceNameTaken": {
				MakeArg: func() interface{} {
					ret := make([]DeviceNameTakenArg, 1)
					return &ret
				},
				Handler: func(args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]DeviceNameTakenArg)
					if !ok {
						err = rpc.NewTypeError((*[]DeviceNameTakenArg)(nil), args)
						return
					}
					err = i.DeviceNameTaken(context.TODO(), (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"selectSigner": {
				MakeArg: func() interface{} {
					ret := make([]SelectSignerArg, 1)
					return &ret
				},
				Handler: func(args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]SelectSignerArg)
					if !ok {
						err = rpc.NewTypeError((*[]SelectSignerArg)(nil), args)
						return
					}
					ret, err = i.SelectSigner(context.TODO(), (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"deviceSignAttemptErr": {
				MakeArg: func() interface{} {
					ret := make([]DeviceSignAttemptErrArg, 1)
					return &ret
				},
				Handler: func(args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]DeviceSignAttemptErrArg)
					if !ok {
						err = rpc.NewTypeError((*[]DeviceSignAttemptErrArg)(nil), args)
						return
					}
					err = i.DeviceSignAttemptErr(context.TODO(), (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"displaySecretWords": {
				MakeArg: func() interface{} {
					ret := make([]DisplaySecretWordsArg, 1)
					return &ret
				},
				Handler: func(args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]DisplaySecretWordsArg)
					if !ok {
						err = rpc.NewTypeError((*[]DisplaySecretWordsArg)(nil), args)
						return
					}
					err = i.DisplaySecretWords(context.TODO(), (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"kexStatus": {
				MakeArg: func() interface{} {
					ret := make([]KexStatusArg, 1)
					return &ret
				},
				Handler: func(args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]KexStatusArg)
					if !ok {
						err = rpc.NewTypeError((*[]KexStatusArg)(nil), args)
						return
					}
					err = i.KexStatus(context.TODO(), (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"displayProvisionSuccess": {
				MakeArg: func() interface{} {
					ret := make([]DisplayProvisionSuccessArg, 1)
					return &ret
				},
				Handler: func(args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]DisplayProvisionSuccessArg)
					if !ok {
						err = rpc.NewTypeError((*[]DisplayProvisionSuccessArg)(nil), args)
						return
					}
					err = i.DisplayProvisionSuccess(context.TODO(), (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
		},
	}
}

type LocksmithUiClient struct {
	Cli GenericClient
}

func (c LocksmithUiClient) PromptDeviceName(ctx context.Context, sessionID int) (res string, err error) {
	__arg := PromptDeviceNameArg{SessionID: sessionID}
	err = c.Cli.Call(ctx, "keybase.1.locksmithUi.promptDeviceName", []interface{}{__arg}, &res)
	return
}

func (c LocksmithUiClient) DeviceNameTaken(ctx context.Context, __arg DeviceNameTakenArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.locksmithUi.deviceNameTaken", []interface{}{__arg}, nil)
	return
}

func (c LocksmithUiClient) SelectSigner(ctx context.Context, __arg SelectSignerArg) (res SelectSignerRes, err error) {
	err = c.Cli.Call(ctx, "keybase.1.locksmithUi.selectSigner", []interface{}{__arg}, &res)
	return
}

func (c LocksmithUiClient) DeviceSignAttemptErr(ctx context.Context, __arg DeviceSignAttemptErrArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.locksmithUi.deviceSignAttemptErr", []interface{}{__arg}, nil)
	return
}

func (c LocksmithUiClient) DisplaySecretWords(ctx context.Context, __arg DisplaySecretWordsArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.locksmithUi.displaySecretWords", []interface{}{__arg}, nil)
	return
}

func (c LocksmithUiClient) KexStatus(ctx context.Context, __arg KexStatusArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.locksmithUi.kexStatus", []interface{}{__arg}, nil)
	return
}

func (c LocksmithUiClient) DisplayProvisionSuccess(ctx context.Context, __arg DisplayProvisionSuccessArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.locksmithUi.displayProvisionSuccess", []interface{}{__arg}, nil)
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
				Handler: func(args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]LogArg)
					if !ok {
						err = rpc.NewTypeError((*[]LogArg)(nil), args)
						return
					}
					err = i.Log(context.TODO(), (*typedArgs)[0])
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

type LoginWithPromptArg struct {
	SessionID int    `codec:"sessionID" json:"sessionID"`
	Username  string `codec:"username" json:"username"`
}

type LoginWithStoredSecretArg struct {
	SessionID int    `codec:"sessionID" json:"sessionID"`
	Username  string `codec:"username" json:"username"`
}

type LoginWithPassphraseArg struct {
	SessionID   int    `codec:"sessionID" json:"sessionID"`
	Username    string `codec:"username" json:"username"`
	Passphrase  string `codec:"passphrase" json:"passphrase"`
	StoreSecret bool   `codec:"storeSecret" json:"storeSecret"`
}

type ClearStoredSecretArg struct {
	SessionID int    `codec:"sessionID" json:"sessionID"`
	Username  string `codec:"username" json:"username"`
}

type CancelLoginArg struct {
	SessionID int `codec:"sessionID" json:"sessionID"`
}

type LogoutArg struct {
	SessionID int `codec:"sessionID" json:"sessionID"`
}

type ResetArg struct {
	SessionID int `codec:"sessionID" json:"sessionID"`
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

type XLoginArg struct {
	SessionID  int    `codec:"sessionID" json:"sessionID"`
	DeviceType string `codec:"deviceType" json:"deviceType"`
	Username   string `codec:"username" json:"username"`
}

type LoginInterface interface {
	GetConfiguredAccounts(context.Context, int) ([]ConfiguredAccount, error)
	LoginWithPrompt(context.Context, LoginWithPromptArg) error
	LoginWithStoredSecret(context.Context, LoginWithStoredSecretArg) error
	LoginWithPassphrase(context.Context, LoginWithPassphraseArg) error
	ClearStoredSecret(context.Context, ClearStoredSecretArg) error
	CancelLogin(context.Context, int) error
	Logout(context.Context, int) error
	Reset(context.Context, int) error
	RecoverAccountFromEmailAddress(context.Context, string) error
	PaperKey(context.Context, int) error
	Unlock(context.Context, int) error
	XLogin(context.Context, XLoginArg) error
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
				Handler: func(args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]GetConfiguredAccountsArg)
					if !ok {
						err = rpc.NewTypeError((*[]GetConfiguredAccountsArg)(nil), args)
						return
					}
					ret, err = i.GetConfiguredAccounts(context.TODO(), (*typedArgs)[0].SessionID)
					return
				},
				MethodType: rpc.MethodCall,
			},
			"loginWithPrompt": {
				MakeArg: func() interface{} {
					ret := make([]LoginWithPromptArg, 1)
					return &ret
				},
				Handler: func(args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]LoginWithPromptArg)
					if !ok {
						err = rpc.NewTypeError((*[]LoginWithPromptArg)(nil), args)
						return
					}
					err = i.LoginWithPrompt(context.TODO(), (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"loginWithStoredSecret": {
				MakeArg: func() interface{} {
					ret := make([]LoginWithStoredSecretArg, 1)
					return &ret
				},
				Handler: func(args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]LoginWithStoredSecretArg)
					if !ok {
						err = rpc.NewTypeError((*[]LoginWithStoredSecretArg)(nil), args)
						return
					}
					err = i.LoginWithStoredSecret(context.TODO(), (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"loginWithPassphrase": {
				MakeArg: func() interface{} {
					ret := make([]LoginWithPassphraseArg, 1)
					return &ret
				},
				Handler: func(args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]LoginWithPassphraseArg)
					if !ok {
						err = rpc.NewTypeError((*[]LoginWithPassphraseArg)(nil), args)
						return
					}
					err = i.LoginWithPassphrase(context.TODO(), (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"clearStoredSecret": {
				MakeArg: func() interface{} {
					ret := make([]ClearStoredSecretArg, 1)
					return &ret
				},
				Handler: func(args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]ClearStoredSecretArg)
					if !ok {
						err = rpc.NewTypeError((*[]ClearStoredSecretArg)(nil), args)
						return
					}
					err = i.ClearStoredSecret(context.TODO(), (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"cancelLogin": {
				MakeArg: func() interface{} {
					ret := make([]CancelLoginArg, 1)
					return &ret
				},
				Handler: func(args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]CancelLoginArg)
					if !ok {
						err = rpc.NewTypeError((*[]CancelLoginArg)(nil), args)
						return
					}
					err = i.CancelLogin(context.TODO(), (*typedArgs)[0].SessionID)
					return
				},
				MethodType: rpc.MethodCall,
			},
			"logout": {
				MakeArg: func() interface{} {
					ret := make([]LogoutArg, 1)
					return &ret
				},
				Handler: func(args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]LogoutArg)
					if !ok {
						err = rpc.NewTypeError((*[]LogoutArg)(nil), args)
						return
					}
					err = i.Logout(context.TODO(), (*typedArgs)[0].SessionID)
					return
				},
				MethodType: rpc.MethodCall,
			},
			"reset": {
				MakeArg: func() interface{} {
					ret := make([]ResetArg, 1)
					return &ret
				},
				Handler: func(args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]ResetArg)
					if !ok {
						err = rpc.NewTypeError((*[]ResetArg)(nil), args)
						return
					}
					err = i.Reset(context.TODO(), (*typedArgs)[0].SessionID)
					return
				},
				MethodType: rpc.MethodCall,
			},
			"recoverAccountFromEmailAddress": {
				MakeArg: func() interface{} {
					ret := make([]RecoverAccountFromEmailAddressArg, 1)
					return &ret
				},
				Handler: func(args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]RecoverAccountFromEmailAddressArg)
					if !ok {
						err = rpc.NewTypeError((*[]RecoverAccountFromEmailAddressArg)(nil), args)
						return
					}
					err = i.RecoverAccountFromEmailAddress(context.TODO(), (*typedArgs)[0].Email)
					return
				},
				MethodType: rpc.MethodCall,
			},
			"paperKey": {
				MakeArg: func() interface{} {
					ret := make([]PaperKeyArg, 1)
					return &ret
				},
				Handler: func(args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]PaperKeyArg)
					if !ok {
						err = rpc.NewTypeError((*[]PaperKeyArg)(nil), args)
						return
					}
					err = i.PaperKey(context.TODO(), (*typedArgs)[0].SessionID)
					return
				},
				MethodType: rpc.MethodCall,
			},
			"unlock": {
				MakeArg: func() interface{} {
					ret := make([]UnlockArg, 1)
					return &ret
				},
				Handler: func(args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]UnlockArg)
					if !ok {
						err = rpc.NewTypeError((*[]UnlockArg)(nil), args)
						return
					}
					err = i.Unlock(context.TODO(), (*typedArgs)[0].SessionID)
					return
				},
				MethodType: rpc.MethodCall,
			},
			"xLogin": {
				MakeArg: func() interface{} {
					ret := make([]XLoginArg, 1)
					return &ret
				},
				Handler: func(args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]XLoginArg)
					if !ok {
						err = rpc.NewTypeError((*[]XLoginArg)(nil), args)
						return
					}
					err = i.XLogin(context.TODO(), (*typedArgs)[0])
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

func (c LoginClient) LoginWithPrompt(ctx context.Context, __arg LoginWithPromptArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.login.loginWithPrompt", []interface{}{__arg}, nil)
	return
}

func (c LoginClient) LoginWithStoredSecret(ctx context.Context, __arg LoginWithStoredSecretArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.login.loginWithStoredSecret", []interface{}{__arg}, nil)
	return
}

func (c LoginClient) LoginWithPassphrase(ctx context.Context, __arg LoginWithPassphraseArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.login.loginWithPassphrase", []interface{}{__arg}, nil)
	return
}

func (c LoginClient) ClearStoredSecret(ctx context.Context, __arg ClearStoredSecretArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.login.clearStoredSecret", []interface{}{__arg}, nil)
	return
}

func (c LoginClient) CancelLogin(ctx context.Context, sessionID int) (err error) {
	__arg := CancelLoginArg{SessionID: sessionID}
	err = c.Cli.Call(ctx, "keybase.1.login.cancelLogin", []interface{}{__arg}, nil)
	return
}

func (c LoginClient) Logout(ctx context.Context, sessionID int) (err error) {
	__arg := LogoutArg{SessionID: sessionID}
	err = c.Cli.Call(ctx, "keybase.1.login.logout", []interface{}{__arg}, nil)
	return
}

func (c LoginClient) Reset(ctx context.Context, sessionID int) (err error) {
	__arg := ResetArg{SessionID: sessionID}
	err = c.Cli.Call(ctx, "keybase.1.login.reset", []interface{}{__arg}, nil)
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

func (c LoginClient) XLogin(ctx context.Context, __arg XLoginArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.login.xLogin", []interface{}{__arg}, nil)
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
				Handler: func(args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]GetEmailOrUsernameArg)
					if !ok {
						err = rpc.NewTypeError((*[]GetEmailOrUsernameArg)(nil), args)
						return
					}
					ret, err = i.GetEmailOrUsername(context.TODO(), (*typedArgs)[0].SessionID)
					return
				},
				MethodType: rpc.MethodCall,
			},
			"promptRevokePaperKeys": {
				MakeArg: func() interface{} {
					ret := make([]PromptRevokePaperKeysArg, 1)
					return &ret
				},
				Handler: func(args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]PromptRevokePaperKeysArg)
					if !ok {
						err = rpc.NewTypeError((*[]PromptRevokePaperKeysArg)(nil), args)
						return
					}
					ret, err = i.PromptRevokePaperKeys(context.TODO(), (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"displayPaperKeyPhrase": {
				MakeArg: func() interface{} {
					ret := make([]DisplayPaperKeyPhraseArg, 1)
					return &ret
				},
				Handler: func(args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]DisplayPaperKeyPhraseArg)
					if !ok {
						err = rpc.NewTypeError((*[]DisplayPaperKeyPhraseArg)(nil), args)
						return
					}
					err = i.DisplayPaperKeyPhrase(context.TODO(), (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"displayPrimaryPaperKey": {
				MakeArg: func() interface{} {
					ret := make([]DisplayPrimaryPaperKeyArg, 1)
					return &ret
				},
				Handler: func(args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]DisplayPrimaryPaperKeyArg)
					if !ok {
						err = rpc.NewTypeError((*[]DisplayPrimaryPaperKeyArg)(nil), args)
						return
					}
					err = i.DisplayPrimaryPaperKey(context.TODO(), (*typedArgs)[0])
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

type MetadataResponse struct {
	FolderID string   `codec:"folderID" json:"folderID"`
	MdBlocks [][]byte `codec:"mdBlocks" json:"mdBlocks"`
}

type AuthenticateArg struct {
	User      UID    `codec:"user" json:"user"`
	DeviceKID KID    `codec:"deviceKID" json:"deviceKID"`
	Sid       string `codec:"sid" json:"sid"`
}

type PutMetadataArg struct {
	MdBlock []byte            `codec:"mdBlock" json:"mdBlock"`
	LogTags map[string]string `codec:"logTags" json:"logTags"`
}

type GetMetadataArg struct {
	FolderID      string            `codec:"folderID" json:"folderID"`
	FolderHandle  []byte            `codec:"folderHandle" json:"folderHandle"`
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

type PruneUnmergedArg struct {
	FolderID string            `codec:"folderID" json:"folderID"`
	LogTags  map[string]string `codec:"logTags" json:"logTags"`
}

type PutKeysArg struct {
	KeyHalves []KeyHalf         `codec:"keyHalves" json:"keyHalves"`
	LogTags   map[string]string `codec:"logTags" json:"logTags"`
}

type GetKeyArg struct {
	KeyHalfID []byte            `codec:"keyHalfID" json:"keyHalfID"`
	LogTags   map[string]string `codec:"logTags" json:"logTags"`
}

type TruncateLockArg struct {
	FolderID string `codec:"folderID" json:"folderID"`
}

type TruncateUnlockArg struct {
	FolderID string `codec:"folderID" json:"folderID"`
}

type PingArg struct {
}

type MetadataInterface interface {
	Authenticate(context.Context, AuthenticateArg) (int, error)
	PutMetadata(context.Context, PutMetadataArg) error
	GetMetadata(context.Context, GetMetadataArg) (MetadataResponse, error)
	RegisterForUpdates(context.Context, RegisterForUpdatesArg) error
	PruneUnmerged(context.Context, PruneUnmergedArg) error
	PutKeys(context.Context, PutKeysArg) error
	GetKey(context.Context, GetKeyArg) ([]byte, error)
	TruncateLock(context.Context, string) (bool, error)
	TruncateUnlock(context.Context, string) (bool, error)
	Ping(context.Context) error
}

func MetadataProtocol(i MetadataInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.metadata",
		Methods: map[string]rpc.ServeHandlerDescription{
			"authenticate": {
				MakeArg: func() interface{} {
					ret := make([]AuthenticateArg, 1)
					return &ret
				},
				Handler: func(args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]AuthenticateArg)
					if !ok {
						err = rpc.NewTypeError((*[]AuthenticateArg)(nil), args)
						return
					}
					ret, err = i.Authenticate(context.TODO(), (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"putMetadata": {
				MakeArg: func() interface{} {
					ret := make([]PutMetadataArg, 1)
					return &ret
				},
				Handler: func(args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]PutMetadataArg)
					if !ok {
						err = rpc.NewTypeError((*[]PutMetadataArg)(nil), args)
						return
					}
					err = i.PutMetadata(context.TODO(), (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"getMetadata": {
				MakeArg: func() interface{} {
					ret := make([]GetMetadataArg, 1)
					return &ret
				},
				Handler: func(args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]GetMetadataArg)
					if !ok {
						err = rpc.NewTypeError((*[]GetMetadataArg)(nil), args)
						return
					}
					ret, err = i.GetMetadata(context.TODO(), (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"registerForUpdates": {
				MakeArg: func() interface{} {
					ret := make([]RegisterForUpdatesArg, 1)
					return &ret
				},
				Handler: func(args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]RegisterForUpdatesArg)
					if !ok {
						err = rpc.NewTypeError((*[]RegisterForUpdatesArg)(nil), args)
						return
					}
					err = i.RegisterForUpdates(context.TODO(), (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"pruneUnmerged": {
				MakeArg: func() interface{} {
					ret := make([]PruneUnmergedArg, 1)
					return &ret
				},
				Handler: func(args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]PruneUnmergedArg)
					if !ok {
						err = rpc.NewTypeError((*[]PruneUnmergedArg)(nil), args)
						return
					}
					err = i.PruneUnmerged(context.TODO(), (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"putKeys": {
				MakeArg: func() interface{} {
					ret := make([]PutKeysArg, 1)
					return &ret
				},
				Handler: func(args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]PutKeysArg)
					if !ok {
						err = rpc.NewTypeError((*[]PutKeysArg)(nil), args)
						return
					}
					err = i.PutKeys(context.TODO(), (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"getKey": {
				MakeArg: func() interface{} {
					ret := make([]GetKeyArg, 1)
					return &ret
				},
				Handler: func(args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]GetKeyArg)
					if !ok {
						err = rpc.NewTypeError((*[]GetKeyArg)(nil), args)
						return
					}
					ret, err = i.GetKey(context.TODO(), (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"truncateLock": {
				MakeArg: func() interface{} {
					ret := make([]TruncateLockArg, 1)
					return &ret
				},
				Handler: func(args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]TruncateLockArg)
					if !ok {
						err = rpc.NewTypeError((*[]TruncateLockArg)(nil), args)
						return
					}
					ret, err = i.TruncateLock(context.TODO(), (*typedArgs)[0].FolderID)
					return
				},
				MethodType: rpc.MethodCall,
			},
			"truncateUnlock": {
				MakeArg: func() interface{} {
					ret := make([]TruncateUnlockArg, 1)
					return &ret
				},
				Handler: func(args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]TruncateUnlockArg)
					if !ok {
						err = rpc.NewTypeError((*[]TruncateUnlockArg)(nil), args)
						return
					}
					ret, err = i.TruncateUnlock(context.TODO(), (*typedArgs)[0].FolderID)
					return
				},
				MethodType: rpc.MethodCall,
			},
			"ping": {
				MakeArg: func() interface{} {
					ret := make([]PingArg, 1)
					return &ret
				},
				Handler: func(args interface{}) (ret interface{}, err error) {
					err = i.Ping(context.TODO())
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

func (c MetadataClient) Authenticate(ctx context.Context, __arg AuthenticateArg) (res int, err error) {
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

func (c MetadataClient) PruneUnmerged(ctx context.Context, __arg PruneUnmergedArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.metadata.pruneUnmerged", []interface{}{__arg}, nil)
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

func (c MetadataClient) Ping(ctx context.Context) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.metadata.ping", []interface{}{PingArg{}}, nil)
	return
}

type MetadataUpdateArg struct {
	FolderID string `codec:"folderID" json:"folderID"`
	Revision int64  `codec:"revision" json:"revision"`
}

type MetadataUpdateInterface interface {
	MetadataUpdate(context.Context, MetadataUpdateArg) error
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
				Handler: func(args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]MetadataUpdateArg)
					if !ok {
						err = rpc.NewTypeError((*[]MetadataUpdateArg)(nil), args)
						return
					}
					err = i.MetadataUpdate(context.TODO(), (*typedArgs)[0])
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

type NotificationChannels struct {
	Session bool `codec:"session" json:"session"`
	Users   bool `codec:"users" json:"users"`
}

type ToggleNotificationsArg struct {
	Channels NotificationChannels `codec:"channels" json:"channels"`
}

type NotifyCtlInterface interface {
	ToggleNotifications(context.Context, NotificationChannels) error
}

func NotifyCtlProtocol(i NotifyCtlInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.notifyCtl",
		Methods: map[string]rpc.ServeHandlerDescription{
			"toggleNotifications": {
				MakeArg: func() interface{} {
					ret := make([]ToggleNotificationsArg, 1)
					return &ret
				},
				Handler: func(args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]ToggleNotificationsArg)
					if !ok {
						err = rpc.NewTypeError((*[]ToggleNotificationsArg)(nil), args)
						return
					}
					err = i.ToggleNotifications(context.TODO(), (*typedArgs)[0].Channels)
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

func (c NotifyCtlClient) ToggleNotifications(ctx context.Context, channels NotificationChannels) (err error) {
	__arg := ToggleNotificationsArg{Channels: channels}
	err = c.Cli.Call(ctx, "keybase.1.notifyCtl.toggleNotifications", []interface{}{__arg}, nil)
	return
}

type LoggedOutArg struct {
}

type NotifySessionInterface interface {
	LoggedOut(context.Context) error
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
				Handler: func(args interface{}) (ret interface{}, err error) {
					err = i.LoggedOut(context.TODO())
					return
				},
				MethodType: rpc.MethodNotify,
			},
		},
	}
}

type NotifySessionClient struct {
	Cli GenericClient
}

func (c NotifySessionClient) LoggedOut(ctx context.Context) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.NotifySession.loggedOut", []interface{}{LoggedOutArg{}}, nil)
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
				Handler: func(args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]UserChangedArg)
					if !ok {
						err = rpc.NewTypeError((*[]UserChangedArg)(nil), args)
						return
					}
					err = i.UserChanged(context.TODO(), (*typedArgs)[0].Uid)
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
	err = c.Cli.Call(ctx, "keybase.1.NotifyUsers.userChanged", []interface{}{__arg}, nil)
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
	Recipients   []string     `codec:"recipients" json:"recipients"`
	NoSign       bool         `codec:"noSign" json:"noSign"`
	NoSelf       bool         `codec:"noSelf" json:"noSelf"`
	BinaryOut    bool         `codec:"binaryOut" json:"binaryOut"`
	KeyQuery     string       `codec:"keyQuery" json:"keyQuery"`
	TrackOptions TrackOptions `codec:"trackOptions" json:"trackOptions"`
}

type PGPSigVerification struct {
	IsSigned bool      `codec:"isSigned" json:"isSigned"`
	Verified bool      `codec:"verified" json:"verified"`
	Signer   User      `codec:"signer" json:"signer"`
	SignKey  PublicKey `codec:"signKey" json:"signKey"`
}

type PGPDecryptOptions struct {
	AssertSigned bool         `codec:"assertSigned" json:"assertSigned"`
	SignedBy     string       `codec:"signedBy" json:"signedBy"`
	TrackOptions TrackOptions `codec:"trackOptions" json:"trackOptions"`
}

type PGPVerifyOptions struct {
	SignedBy     string       `codec:"signedBy" json:"signedBy"`
	TrackOptions TrackOptions `codec:"trackOptions" json:"trackOptions"`
	Signature    []byte       `codec:"signature" json:"signature"`
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

type PGPKeyGenDefaultArg struct {
	SessionID  int           `codec:"sessionID" json:"sessionID"`
	CreateUids PGPCreateUids `codec:"createUids" json:"createUids"`
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
	PGPKeyGenDefault(context.Context, PGPKeyGenDefaultArg) error
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
				Handler: func(args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]PGPSignArg)
					if !ok {
						err = rpc.NewTypeError((*[]PGPSignArg)(nil), args)
						return
					}
					err = i.PGPSign(context.TODO(), (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"pgpPull": {
				MakeArg: func() interface{} {
					ret := make([]PGPPullArg, 1)
					return &ret
				},
				Handler: func(args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]PGPPullArg)
					if !ok {
						err = rpc.NewTypeError((*[]PGPPullArg)(nil), args)
						return
					}
					err = i.PGPPull(context.TODO(), (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"pgpEncrypt": {
				MakeArg: func() interface{} {
					ret := make([]PGPEncryptArg, 1)
					return &ret
				},
				Handler: func(args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]PGPEncryptArg)
					if !ok {
						err = rpc.NewTypeError((*[]PGPEncryptArg)(nil), args)
						return
					}
					err = i.PGPEncrypt(context.TODO(), (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"pgpDecrypt": {
				MakeArg: func() interface{} {
					ret := make([]PGPDecryptArg, 1)
					return &ret
				},
				Handler: func(args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]PGPDecryptArg)
					if !ok {
						err = rpc.NewTypeError((*[]PGPDecryptArg)(nil), args)
						return
					}
					ret, err = i.PGPDecrypt(context.TODO(), (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"pgpVerify": {
				MakeArg: func() interface{} {
					ret := make([]PGPVerifyArg, 1)
					return &ret
				},
				Handler: func(args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]PGPVerifyArg)
					if !ok {
						err = rpc.NewTypeError((*[]PGPVerifyArg)(nil), args)
						return
					}
					ret, err = i.PGPVerify(context.TODO(), (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"pgpImport": {
				MakeArg: func() interface{} {
					ret := make([]PGPImportArg, 1)
					return &ret
				},
				Handler: func(args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]PGPImportArg)
					if !ok {
						err = rpc.NewTypeError((*[]PGPImportArg)(nil), args)
						return
					}
					err = i.PGPImport(context.TODO(), (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"pgpExport": {
				MakeArg: func() interface{} {
					ret := make([]PGPExportArg, 1)
					return &ret
				},
				Handler: func(args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]PGPExportArg)
					if !ok {
						err = rpc.NewTypeError((*[]PGPExportArg)(nil), args)
						return
					}
					ret, err = i.PGPExport(context.TODO(), (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"pgpExportByFingerprint": {
				MakeArg: func() interface{} {
					ret := make([]PGPExportByFingerprintArg, 1)
					return &ret
				},
				Handler: func(args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]PGPExportByFingerprintArg)
					if !ok {
						err = rpc.NewTypeError((*[]PGPExportByFingerprintArg)(nil), args)
						return
					}
					ret, err = i.PGPExportByFingerprint(context.TODO(), (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"pgpExportByKID": {
				MakeArg: func() interface{} {
					ret := make([]PGPExportByKIDArg, 1)
					return &ret
				},
				Handler: func(args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]PGPExportByKIDArg)
					if !ok {
						err = rpc.NewTypeError((*[]PGPExportByKIDArg)(nil), args)
						return
					}
					ret, err = i.PGPExportByKID(context.TODO(), (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"pgpKeyGen": {
				MakeArg: func() interface{} {
					ret := make([]PGPKeyGenArg, 1)
					return &ret
				},
				Handler: func(args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]PGPKeyGenArg)
					if !ok {
						err = rpc.NewTypeError((*[]PGPKeyGenArg)(nil), args)
						return
					}
					err = i.PGPKeyGen(context.TODO(), (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"pgpKeyGenDefault": {
				MakeArg: func() interface{} {
					ret := make([]PGPKeyGenDefaultArg, 1)
					return &ret
				},
				Handler: func(args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]PGPKeyGenDefaultArg)
					if !ok {
						err = rpc.NewTypeError((*[]PGPKeyGenDefaultArg)(nil), args)
						return
					}
					err = i.PGPKeyGenDefault(context.TODO(), (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"pgpDeletePrimary": {
				MakeArg: func() interface{} {
					ret := make([]PGPDeletePrimaryArg, 1)
					return &ret
				},
				Handler: func(args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]PGPDeletePrimaryArg)
					if !ok {
						err = rpc.NewTypeError((*[]PGPDeletePrimaryArg)(nil), args)
						return
					}
					err = i.PGPDeletePrimary(context.TODO(), (*typedArgs)[0].SessionID)
					return
				},
				MethodType: rpc.MethodCall,
			},
			"pgpSelect": {
				MakeArg: func() interface{} {
					ret := make([]PGPSelectArg, 1)
					return &ret
				},
				Handler: func(args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]PGPSelectArg)
					if !ok {
						err = rpc.NewTypeError((*[]PGPSelectArg)(nil), args)
						return
					}
					err = i.PGPSelect(context.TODO(), (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"pgpUpdate": {
				MakeArg: func() interface{} {
					ret := make([]PGPUpdateArg, 1)
					return &ret
				},
				Handler: func(args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]PGPUpdateArg)
					if !ok {
						err = rpc.NewTypeError((*[]PGPUpdateArg)(nil), args)
						return
					}
					err = i.PGPUpdate(context.TODO(), (*typedArgs)[0])
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

func (c PGPClient) PGPKeyGenDefault(ctx context.Context, __arg PGPKeyGenDefaultArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.pgp.pgpKeyGenDefault", []interface{}{__arg}, nil)
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
				Handler: func(args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]StartProofArg)
					if !ok {
						err = rpc.NewTypeError((*[]StartProofArg)(nil), args)
						return
					}
					ret, err = i.StartProof(context.TODO(), (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"checkProof": {
				MakeArg: func() interface{} {
					ret := make([]CheckProofArg, 1)
					return &ret
				},
				Handler: func(args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]CheckProofArg)
					if !ok {
						err = rpc.NewTypeError((*[]CheckProofArg)(nil), args)
						return
					}
					ret, err = i.CheckProof(context.TODO(), (*typedArgs)[0])
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
				Handler: func(args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]PromptOverwriteArg)
					if !ok {
						err = rpc.NewTypeError((*[]PromptOverwriteArg)(nil), args)
						return
					}
					ret, err = i.PromptOverwrite(context.TODO(), (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"promptUsername": {
				MakeArg: func() interface{} {
					ret := make([]PromptUsernameArg, 1)
					return &ret
				},
				Handler: func(args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]PromptUsernameArg)
					if !ok {
						err = rpc.NewTypeError((*[]PromptUsernameArg)(nil), args)
						return
					}
					ret, err = i.PromptUsername(context.TODO(), (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"outputPrechecks": {
				MakeArg: func() interface{} {
					ret := make([]OutputPrechecksArg, 1)
					return &ret
				},
				Handler: func(args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]OutputPrechecksArg)
					if !ok {
						err = rpc.NewTypeError((*[]OutputPrechecksArg)(nil), args)
						return
					}
					err = i.OutputPrechecks(context.TODO(), (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"preProofWarning": {
				MakeArg: func() interface{} {
					ret := make([]PreProofWarningArg, 1)
					return &ret
				},
				Handler: func(args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]PreProofWarningArg)
					if !ok {
						err = rpc.NewTypeError((*[]PreProofWarningArg)(nil), args)
						return
					}
					ret, err = i.PreProofWarning(context.TODO(), (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"outputInstructions": {
				MakeArg: func() interface{} {
					ret := make([]OutputInstructionsArg, 1)
					return &ret
				},
				Handler: func(args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]OutputInstructionsArg)
					if !ok {
						err = rpc.NewTypeError((*[]OutputInstructionsArg)(nil), args)
						return
					}
					err = i.OutputInstructions(context.TODO(), (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"okToCheck": {
				MakeArg: func() interface{} {
					ret := make([]OkToCheckArg, 1)
					return &ret
				},
				Handler: func(args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]OkToCheckArg)
					if !ok {
						err = rpc.NewTypeError((*[]OkToCheckArg)(nil), args)
						return
					}
					ret, err = i.OkToCheck(context.TODO(), (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"displayRecheckWarning": {
				MakeArg: func() interface{} {
					ret := make([]DisplayRecheckWarningArg, 1)
					return &ret
				},
				Handler: func(args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]DisplayRecheckWarningArg)
					if !ok {
						err = rpc.NewTypeError((*[]DisplayRecheckWarningArg)(nil), args)
						return
					}
					err = i.DisplayRecheckWarning(context.TODO(), (*typedArgs)[0])
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
	ProvisionMethod_GPG        ProvisionMethod = 1
	ProvisionMethod_PAPER_KEY  ProvisionMethod = 2
	ProvisionMethod_PASSPHRASE ProvisionMethod = 3
)

type DeviceType int

const (
	DeviceType_DESKTOP DeviceType = 0
	DeviceType_MOBILE  DeviceType = 1
)

type ChooseProvisioningMethodArg struct {
	SessionID int      `codec:"sessionID" json:"sessionID"`
	GpgUsers  []string `codec:"gpgUsers" json:"gpgUsers"`
}

type ChooseDeviceTypeArg struct {
	SessionID int `codec:"sessionID" json:"sessionID"`
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

type ProvisionSuccessArg struct {
	SessionID int `codec:"sessionID" json:"sessionID"`
}

type ProvisionUiInterface interface {
	ChooseProvisioningMethod(context.Context, ChooseProvisioningMethodArg) (ProvisionMethod, error)
	ChooseDeviceType(context.Context, int) (DeviceType, error)
	DisplayAndPromptSecret(context.Context, DisplayAndPromptSecretArg) ([]byte, error)
	DisplaySecretExchanged(context.Context, int) error
	PromptNewDeviceName(context.Context, PromptNewDeviceNameArg) (string, error)
	ProvisionSuccess(context.Context, int) error
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
				Handler: func(args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]ChooseProvisioningMethodArg)
					if !ok {
						err = rpc.NewTypeError((*[]ChooseProvisioningMethodArg)(nil), args)
						return
					}
					ret, err = i.ChooseProvisioningMethod(context.TODO(), (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"chooseDeviceType": {
				MakeArg: func() interface{} {
					ret := make([]ChooseDeviceTypeArg, 1)
					return &ret
				},
				Handler: func(args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]ChooseDeviceTypeArg)
					if !ok {
						err = rpc.NewTypeError((*[]ChooseDeviceTypeArg)(nil), args)
						return
					}
					ret, err = i.ChooseDeviceType(context.TODO(), (*typedArgs)[0].SessionID)
					return
				},
				MethodType: rpc.MethodCall,
			},
			"DisplayAndPromptSecret": {
				MakeArg: func() interface{} {
					ret := make([]DisplayAndPromptSecretArg, 1)
					return &ret
				},
				Handler: func(args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]DisplayAndPromptSecretArg)
					if !ok {
						err = rpc.NewTypeError((*[]DisplayAndPromptSecretArg)(nil), args)
						return
					}
					ret, err = i.DisplayAndPromptSecret(context.TODO(), (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"DisplaySecretExchanged": {
				MakeArg: func() interface{} {
					ret := make([]DisplaySecretExchangedArg, 1)
					return &ret
				},
				Handler: func(args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]DisplaySecretExchangedArg)
					if !ok {
						err = rpc.NewTypeError((*[]DisplaySecretExchangedArg)(nil), args)
						return
					}
					err = i.DisplaySecretExchanged(context.TODO(), (*typedArgs)[0].SessionID)
					return
				},
				MethodType: rpc.MethodCall,
			},
			"PromptNewDeviceName": {
				MakeArg: func() interface{} {
					ret := make([]PromptNewDeviceNameArg, 1)
					return &ret
				},
				Handler: func(args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]PromptNewDeviceNameArg)
					if !ok {
						err = rpc.NewTypeError((*[]PromptNewDeviceNameArg)(nil), args)
						return
					}
					ret, err = i.PromptNewDeviceName(context.TODO(), (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"ProvisionSuccess": {
				MakeArg: func() interface{} {
					ret := make([]ProvisionSuccessArg, 1)
					return &ret
				},
				Handler: func(args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]ProvisionSuccessArg)
					if !ok {
						err = rpc.NewTypeError((*[]ProvisionSuccessArg)(nil), args)
						return
					}
					err = i.ProvisionSuccess(context.TODO(), (*typedArgs)[0].SessionID)
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

func (c ProvisionUiClient) ChooseDeviceType(ctx context.Context, sessionID int) (res DeviceType, err error) {
	__arg := ChooseDeviceTypeArg{SessionID: sessionID}
	err = c.Cli.Call(ctx, "keybase.1.provisionUi.chooseDeviceType", []interface{}{__arg}, &res)
	return
}

func (c ProvisionUiClient) DisplayAndPromptSecret(ctx context.Context, __arg DisplayAndPromptSecretArg) (res []byte, err error) {
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

func (c ProvisionUiClient) ProvisionSuccess(ctx context.Context, sessionID int) (err error) {
	__arg := ProvisionSuccessArg{SessionID: sessionID}
	err = c.Cli.Call(ctx, "keybase.1.provisionUi.ProvisionSuccess", []interface{}{__arg}, nil)
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
				Handler: func(args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]VerifySessionArg)
					if !ok {
						err = rpc.NewTypeError((*[]VerifySessionArg)(nil), args)
						return
					}
					ret, err = i.VerifySession(context.TODO(), (*typedArgs)[0].Session)
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
	SessionID int    `codec:"sessionID" json:"sessionID"`
	KeyID     string `codec:"keyID" json:"keyID"`
}

type RevokeDeviceArg struct {
	SessionID int      `codec:"sessionID" json:"sessionID"`
	DeviceID  DeviceID `codec:"deviceID" json:"deviceID"`
	Force     bool     `codec:"force" json:"force"`
}

type RevokeSigsArg struct {
	SessionID int     `codec:"sessionID" json:"sessionID"`
	SigIDs    []SigID `codec:"sigIDs" json:"sigIDs"`
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
				Handler: func(args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]RevokeKeyArg)
					if !ok {
						err = rpc.NewTypeError((*[]RevokeKeyArg)(nil), args)
						return
					}
					err = i.RevokeKey(context.TODO(), (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"revokeDevice": {
				MakeArg: func() interface{} {
					ret := make([]RevokeDeviceArg, 1)
					return &ret
				},
				Handler: func(args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]RevokeDeviceArg)
					if !ok {
						err = rpc.NewTypeError((*[]RevokeDeviceArg)(nil), args)
						return
					}
					err = i.RevokeDevice(context.TODO(), (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"revokeSigs": {
				MakeArg: func() interface{} {
					ret := make([]RevokeSigsArg, 1)
					return &ret
				},
				Handler: func(args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]RevokeSigsArg)
					if !ok {
						err = rpc.NewTypeError((*[]RevokeSigsArg)(nil), args)
						return
					}
					err = i.RevokeSigs(context.TODO(), (*typedArgs)[0])
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

type GetNewPassphraseRes struct {
	Passphrase  string `codec:"passphrase" json:"passphrase"`
	StoreSecret bool   `codec:"storeSecret" json:"storeSecret"`
}

type GetSecretArg struct {
	SessionID int             `codec:"sessionID" json:"sessionID"`
	Pinentry  SecretEntryArg  `codec:"pinentry" json:"pinentry"`
	Terminal  *SecretEntryArg `codec:"terminal,omitempty" json:"terminal,omitempty"`
}

type GetNewPassphraseArg struct {
	SessionID      int    `codec:"sessionID" json:"sessionID"`
	TerminalPrompt string `codec:"terminalPrompt" json:"terminalPrompt"`
	PinentryDesc   string `codec:"pinentryDesc" json:"pinentryDesc"`
	PinentryPrompt string `codec:"pinentryPrompt" json:"pinentryPrompt"`
	RetryMessage   string `codec:"retryMessage" json:"retryMessage"`
	UseSecretStore bool   `codec:"useSecretStore" json:"useSecretStore"`
}

type GetKeybasePassphraseArg struct {
	SessionID int    `codec:"sessionID" json:"sessionID"`
	Username  string `codec:"username" json:"username"`
	Retry     string `codec:"retry" json:"retry"`
}

type GetPaperKeyPassphraseArg struct {
	SessionID int    `codec:"sessionID" json:"sessionID"`
	Username  string `codec:"username" json:"username"`
}

type SecretUiInterface interface {
	GetSecret(context.Context, GetSecretArg) (SecretEntryRes, error)
	GetNewPassphrase(context.Context, GetNewPassphraseArg) (GetNewPassphraseRes, error)
	GetKeybasePassphrase(context.Context, GetKeybasePassphraseArg) (string, error)
	GetPaperKeyPassphrase(context.Context, GetPaperKeyPassphraseArg) (string, error)
}

func SecretUiProtocol(i SecretUiInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.secretUi",
		Methods: map[string]rpc.ServeHandlerDescription{
			"getSecret": {
				MakeArg: func() interface{} {
					ret := make([]GetSecretArg, 1)
					return &ret
				},
				Handler: func(args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]GetSecretArg)
					if !ok {
						err = rpc.NewTypeError((*[]GetSecretArg)(nil), args)
						return
					}
					ret, err = i.GetSecret(context.TODO(), (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"getNewPassphrase": {
				MakeArg: func() interface{} {
					ret := make([]GetNewPassphraseArg, 1)
					return &ret
				},
				Handler: func(args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]GetNewPassphraseArg)
					if !ok {
						err = rpc.NewTypeError((*[]GetNewPassphraseArg)(nil), args)
						return
					}
					ret, err = i.GetNewPassphrase(context.TODO(), (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"getKeybasePassphrase": {
				MakeArg: func() interface{} {
					ret := make([]GetKeybasePassphraseArg, 1)
					return &ret
				},
				Handler: func(args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]GetKeybasePassphraseArg)
					if !ok {
						err = rpc.NewTypeError((*[]GetKeybasePassphraseArg)(nil), args)
						return
					}
					ret, err = i.GetKeybasePassphrase(context.TODO(), (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"getPaperKeyPassphrase": {
				MakeArg: func() interface{} {
					ret := make([]GetPaperKeyPassphraseArg, 1)
					return &ret
				},
				Handler: func(args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]GetPaperKeyPassphraseArg)
					if !ok {
						err = rpc.NewTypeError((*[]GetPaperKeyPassphraseArg)(nil), args)
						return
					}
					ret, err = i.GetPaperKeyPassphrase(context.TODO(), (*typedArgs)[0])
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

func (c SecretUiClient) GetSecret(ctx context.Context, __arg GetSecretArg) (res SecretEntryRes, err error) {
	err = c.Cli.Call(ctx, "keybase.1.secretUi.getSecret", []interface{}{__arg}, &res)
	return
}

func (c SecretUiClient) GetNewPassphrase(ctx context.Context, __arg GetNewPassphraseArg) (res GetNewPassphraseRes, err error) {
	err = c.Cli.Call(ctx, "keybase.1.secretUi.getNewPassphrase", []interface{}{__arg}, &res)
	return
}

func (c SecretUiClient) GetKeybasePassphrase(ctx context.Context, __arg GetKeybasePassphraseArg) (res string, err error) {
	err = c.Cli.Call(ctx, "keybase.1.secretUi.getKeybasePassphrase", []interface{}{__arg}, &res)
	return
}

func (c SecretUiClient) GetPaperKeyPassphrase(ctx context.Context, __arg GetPaperKeyPassphraseArg) (res string, err error) {
	err = c.Cli.Call(ctx, "keybase.1.secretUi.getPaperKeyPassphrase", []interface{}{__arg}, &res)
	return
}

type Session struct {
	Uid             UID    `codec:"uid" json:"uid"`
	Username        string `codec:"username" json:"username"`
	Token           string `codec:"token" json:"token"`
	DeviceSubkeyKid KID    `codec:"deviceSubkeyKid" json:"deviceSubkeyKid"`
}

type CurrentSessionArg struct {
	SessionID int `codec:"sessionID" json:"sessionID"`
}

type CurrentUIDArg struct {
	SessionID int `codec:"sessionID" json:"sessionID"`
}

type SessionInterface interface {
	CurrentSession(context.Context, int) (Session, error)
	CurrentUID(context.Context, int) (UID, error)
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
				Handler: func(args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]CurrentSessionArg)
					if !ok {
						err = rpc.NewTypeError((*[]CurrentSessionArg)(nil), args)
						return
					}
					ret, err = i.CurrentSession(context.TODO(), (*typedArgs)[0].SessionID)
					return
				},
				MethodType: rpc.MethodCall,
			},
			"currentUID": {
				MakeArg: func() interface{} {
					ret := make([]CurrentUIDArg, 1)
					return &ret
				},
				Handler: func(args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]CurrentUIDArg)
					if !ok {
						err = rpc.NewTypeError((*[]CurrentUIDArg)(nil), args)
						return
					}
					ret, err = i.CurrentUID(context.TODO(), (*typedArgs)[0].SessionID)
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

func (c SessionClient) CurrentUID(ctx context.Context, sessionID int) (res UID, err error) {
	__arg := CurrentUIDArg{SessionID: sessionID}
	err = c.Cli.Call(ctx, "keybase.1.session.currentUID", []interface{}{__arg}, &res)
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
				Handler: func(args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]CheckUsernameAvailableArg)
					if !ok {
						err = rpc.NewTypeError((*[]CheckUsernameAvailableArg)(nil), args)
						return
					}
					err = i.CheckUsernameAvailable(context.TODO(), (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"signup": {
				MakeArg: func() interface{} {
					ret := make([]SignupArg, 1)
					return &ret
				},
				Handler: func(args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]SignupArg)
					if !ok {
						err = rpc.NewTypeError((*[]SignupArg)(nil), args)
						return
					}
					ret, err = i.Signup(context.TODO(), (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"inviteRequest": {
				MakeArg: func() interface{} {
					ret := make([]InviteRequestArg, 1)
					return &ret
				},
				Handler: func(args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]InviteRequestArg)
					if !ok {
						err = rpc.NewTypeError((*[]InviteRequestArg)(nil), args)
						return
					}
					err = i.InviteRequest(context.TODO(), (*typedArgs)[0])
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
				Handler: func(args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]SigListArg)
					if !ok {
						err = rpc.NewTypeError((*[]SigListArg)(nil), args)
						return
					}
					ret, err = i.SigList(context.TODO(), (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"sigListJSON": {
				MakeArg: func() interface{} {
					ret := make([]SigListJSONArg, 1)
					return &ret
				},
				Handler: func(args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]SigListJSONArg)
					if !ok {
						err = rpc.NewTypeError((*[]SigListJSONArg)(nil), args)
						return
					}
					ret, err = i.SigListJSON(context.TODO(), (*typedArgs)[0])
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
				Handler: func(args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]CloseArg)
					if !ok {
						err = rpc.NewTypeError((*[]CloseArg)(nil), args)
						return
					}
					err = i.Close(context.TODO(), (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"read": {
				MakeArg: func() interface{} {
					ret := make([]ReadArg, 1)
					return &ret
				},
				Handler: func(args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]ReadArg)
					if !ok {
						err = rpc.NewTypeError((*[]ReadArg)(nil), args)
						return
					}
					ret, err = i.Read(context.TODO(), (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"write": {
				MakeArg: func() interface{} {
					ret := make([]WriteArg, 1)
					return &ret
				},
				Handler: func(args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]WriteArg)
					if !ok {
						err = rpc.NewTypeError((*[]WriteArg)(nil), args)
						return
					}
					ret, err = i.Write(context.TODO(), (*typedArgs)[0])
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
				Handler: func(args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]TestArg)
					if !ok {
						err = rpc.NewTypeError((*[]TestArg)(nil), args)
						return
					}
					ret, err = i.Test(context.TODO(), (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"testCallback": {
				MakeArg: func() interface{} {
					ret := make([]TestCallbackArg, 1)
					return &ret
				},
				Handler: func(args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]TestCallbackArg)
					if !ok {
						err = rpc.NewTypeError((*[]TestCallbackArg)(nil), args)
						return
					}
					ret, err = i.TestCallback(context.TODO(), (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"panic": {
				MakeArg: func() interface{} {
					ret := make([]PanicArg, 1)
					return &ret
				},
				Handler: func(args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]PanicArg)
					if !ok {
						err = rpc.NewTypeError((*[]PanicArg)(nil), args)
						return
					}
					err = i.Panic(context.TODO(), (*typedArgs)[0].Message)
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
	TrackToken string       `codec:"trackToken" json:"trackToken"`
	Options    TrackOptions `codec:"options" json:"options"`
}

type UntrackArg struct {
	SessionID int    `codec:"sessionID" json:"sessionID"`
	Username  string `codec:"username" json:"username"`
}

type TrackInterface interface {
	Track(context.Context, TrackArg) error
	TrackWithToken(context.Context, TrackWithTokenArg) error
	Untrack(context.Context, UntrackArg) error
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
				Handler: func(args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]TrackArg)
					if !ok {
						err = rpc.NewTypeError((*[]TrackArg)(nil), args)
						return
					}
					err = i.Track(context.TODO(), (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"trackWithToken": {
				MakeArg: func() interface{} {
					ret := make([]TrackWithTokenArg, 1)
					return &ret
				},
				Handler: func(args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]TrackWithTokenArg)
					if !ok {
						err = rpc.NewTypeError((*[]TrackWithTokenArg)(nil), args)
						return
					}
					err = i.TrackWithToken(context.TODO(), (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"untrack": {
				MakeArg: func() interface{} {
					ret := make([]UntrackArg, 1)
					return &ret
				},
				Handler: func(args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]UntrackArg)
					if !ok {
						err = rpc.NewTypeError((*[]UntrackArg)(nil), args)
						return
					}
					err = i.Untrack(context.TODO(), (*typedArgs)[0])
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
				Handler: func(args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]PromptYesNoArg)
					if !ok {
						err = rpc.NewTypeError((*[]PromptYesNoArg)(nil), args)
						return
					}
					ret, err = i.PromptYesNo(context.TODO(), (*typedArgs)[0])
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
	IdVersion    int    `codec:"idVersion" json:"idVersion"`
	FullName     string `codec:"fullName" json:"fullName"`
	Bio          string `codec:"bio" json:"bio"`
	Proofs       Proofs `codec:"proofs" json:"proofs"`
	SigIDDisplay string `codec:"sigIDDisplay" json:"sigIDDisplay"`
	TrackTime    Time   `codec:"trackTime" json:"trackTime"`
}

type UserPlusKeys struct {
	Uid        UID         `codec:"uid" json:"uid"`
	Username   string      `codec:"username" json:"username"`
	DeviceKeys []PublicKey `codec:"deviceKeys" json:"deviceKeys"`
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
				Handler: func(args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]ListTrackersArg)
					if !ok {
						err = rpc.NewTypeError((*[]ListTrackersArg)(nil), args)
						return
					}
					ret, err = i.ListTrackers(context.TODO(), (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"listTrackersByName": {
				MakeArg: func() interface{} {
					ret := make([]ListTrackersByNameArg, 1)
					return &ret
				},
				Handler: func(args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]ListTrackersByNameArg)
					if !ok {
						err = rpc.NewTypeError((*[]ListTrackersByNameArg)(nil), args)
						return
					}
					ret, err = i.ListTrackersByName(context.TODO(), (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"listTrackersSelf": {
				MakeArg: func() interface{} {
					ret := make([]ListTrackersSelfArg, 1)
					return &ret
				},
				Handler: func(args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]ListTrackersSelfArg)
					if !ok {
						err = rpc.NewTypeError((*[]ListTrackersSelfArg)(nil), args)
						return
					}
					ret, err = i.ListTrackersSelf(context.TODO(), (*typedArgs)[0].SessionID)
					return
				},
				MethodType: rpc.MethodCall,
			},
			"loadUncheckedUserSummaries": {
				MakeArg: func() interface{} {
					ret := make([]LoadUncheckedUserSummariesArg, 1)
					return &ret
				},
				Handler: func(args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]LoadUncheckedUserSummariesArg)
					if !ok {
						err = rpc.NewTypeError((*[]LoadUncheckedUserSummariesArg)(nil), args)
						return
					}
					ret, err = i.LoadUncheckedUserSummaries(context.TODO(), (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"loadUser": {
				MakeArg: func() interface{} {
					ret := make([]LoadUserArg, 1)
					return &ret
				},
				Handler: func(args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]LoadUserArg)
					if !ok {
						err = rpc.NewTypeError((*[]LoadUserArg)(nil), args)
						return
					}
					ret, err = i.LoadUser(context.TODO(), (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"loadUserPlusKeys": {
				MakeArg: func() interface{} {
					ret := make([]LoadUserPlusKeysArg, 1)
					return &ret
				},
				Handler: func(args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]LoadUserPlusKeysArg)
					if !ok {
						err = rpc.NewTypeError((*[]LoadUserPlusKeysArg)(nil), args)
						return
					}
					ret, err = i.LoadUserPlusKeys(context.TODO(), (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"loadPublicKeys": {
				MakeArg: func() interface{} {
					ret := make([]LoadPublicKeysArg, 1)
					return &ret
				},
				Handler: func(args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]LoadPublicKeysArg)
					if !ok {
						err = rpc.NewTypeError((*[]LoadPublicKeysArg)(nil), args)
						return
					}
					ret, err = i.LoadPublicKeys(context.TODO(), (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"listTracking": {
				MakeArg: func() interface{} {
					ret := make([]ListTrackingArg, 1)
					return &ret
				},
				Handler: func(args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]ListTrackingArg)
					if !ok {
						err = rpc.NewTypeError((*[]ListTrackingArg)(nil), args)
						return
					}
					ret, err = i.ListTracking(context.TODO(), (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"listTrackingJSON": {
				MakeArg: func() interface{} {
					ret := make([]ListTrackingJSONArg, 1)
					return &ret
				},
				Handler: func(args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]ListTrackingJSONArg)
					if !ok {
						err = rpc.NewTypeError((*[]ListTrackingJSONArg)(nil), args)
						return
					}
					ret, err = i.ListTrackingJSON(context.TODO(), (*typedArgs)[0])
					return
				},
				MethodType: rpc.MethodCall,
			},
			"search": {
				MakeArg: func() interface{} {
					ret := make([]SearchArg, 1)
					return &ret
				},
				Handler: func(args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[]SearchArg)
					if !ok {
						err = rpc.NewTypeError((*[]SearchArg)(nil), args)
						return
					}
					ret, err = i.Search(context.TODO(), (*typedArgs)[0])
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
