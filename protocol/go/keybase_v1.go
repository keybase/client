package keybase1

import (
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
)

type GenericClient interface {
	Call(s string, args interface{}, res interface{}) error
}

type ChangePassphraseArg struct {
	SessionID     int    `codec:"sessionID" json:"sessionID"`
	OldPassphrase string `codec:"oldPassphrase" json:"oldPassphrase"`
	Passphrase    string `codec:"passphrase" json:"passphrase"`
	Force         bool   `codec:"force" json:"force"`
}

type AccountInterface interface {
	ChangePassphrase(ChangePassphraseArg) error
}

func AccountProtocol(i AccountInterface) rpc2.Protocol {
	return rpc2.Protocol{
		Name: "keybase.1.account",
		Methods: map[string]rpc2.ServeHook{
			"changePassphrase": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]ChangePassphraseArg, 1)
				if err = nxt(&args); err == nil {
					err = i.ChangePassphrase(args[0])
				}
				return
			},
		},
	}

}

type AccountClient struct {
	Cli GenericClient
}

func (c AccountClient) ChangePassphrase(__arg ChangePassphraseArg) (err error) {
	err = c.Cli.Call("keybase.1.account.changePassphrase", []interface{}{__arg}, nil)
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
	IsWeb             bool          `codec:"isWeb" json:"isWeb"`
	ParentID          string        `codec:"parentID" json:"parentID"`
	DeviceID          DeviceID      `codec:"deviceID" json:"deviceID"`
	DeviceDescription string        `codec:"deviceDescription" json:"deviceDescription"`
	CTime             Time          `codec:"cTime" json:"cTime"`
	ETime             Time          `codec:"eTime" json:"eTime"`
}

type User struct {
	Uid        UID         `codec:"uid" json:"uid"`
	Username   string      `codec:"username" json:"username"`
	PublicKeys []PublicKey `codec:"publicKeys" json:"publicKeys"`
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

type BlockIdCombo struct {
	BlockHash string `codec:"blockHash" json:"blockHash"`
	ChargedTo UID    `codec:"chargedTo" json:"chargedTo"`
}

type GetBlockRes struct {
	BlockKey string `codec:"blockKey" json:"blockKey"`
	Buf      []byte `codec:"buf" json:"buf"`
}

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
	Bid       BlockIdCombo `codec:"bid" json:"bid"`
	Nonce     string       `codec:"nonce" json:"nonce"`
	Folder    string       `codec:"folder" json:"folder"`
	ChargedTo UID          `codec:"chargedTo" json:"chargedTo"`
}

type DecBlockReferenceArg struct {
	Bid       BlockIdCombo `codec:"bid" json:"bid"`
	Nonce     string       `codec:"nonce" json:"nonce"`
	Folder    string       `codec:"folder" json:"folder"`
	ChargedTo UID          `codec:"chargedTo" json:"chargedTo"`
}

type BlockInterface interface {
	EstablishSession(EstablishSessionArg) error
	PutBlock(PutBlockArg) error
	GetBlock(BlockIdCombo) (GetBlockRes, error)
	IncBlockReference(IncBlockReferenceArg) error
	DecBlockReference(DecBlockReferenceArg) error
}

func BlockProtocol(i BlockInterface) rpc2.Protocol {
	return rpc2.Protocol{
		Name: "keybase.1.block",
		Methods: map[string]rpc2.ServeHook{
			"establishSession": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]EstablishSessionArg, 1)
				if err = nxt(&args); err == nil {
					err = i.EstablishSession(args[0])
				}
				return
			},
			"putBlock": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]PutBlockArg, 1)
				if err = nxt(&args); err == nil {
					err = i.PutBlock(args[0])
				}
				return
			},
			"getBlock": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]GetBlockArg, 1)
				if err = nxt(&args); err == nil {
					ret, err = i.GetBlock(args[0].Bid)
				}
				return
			},
			"incBlockReference": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]IncBlockReferenceArg, 1)
				if err = nxt(&args); err == nil {
					err = i.IncBlockReference(args[0])
				}
				return
			},
			"decBlockReference": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]DecBlockReferenceArg, 1)
				if err = nxt(&args); err == nil {
					err = i.DecBlockReference(args[0])
				}
				return
			},
		},
	}

}

type BlockClient struct {
	Cli GenericClient
}

func (c BlockClient) EstablishSession(__arg EstablishSessionArg) (err error) {
	err = c.Cli.Call("keybase.1.block.establishSession", []interface{}{__arg}, nil)
	return
}

func (c BlockClient) PutBlock(__arg PutBlockArg) (err error) {
	err = c.Cli.Call("keybase.1.block.putBlock", []interface{}{__arg}, nil)
	return
}

func (c BlockClient) GetBlock(bid BlockIdCombo) (res GetBlockRes, err error) {
	__arg := GetBlockArg{Bid: bid}
	err = c.Cli.Call("keybase.1.block.getBlock", []interface{}{__arg}, &res)
	return
}

func (c BlockClient) IncBlockReference(__arg IncBlockReferenceArg) (err error) {
	err = c.Cli.Call("keybase.1.block.incBlockReference", []interface{}{__arg}, nil)
	return
}

func (c BlockClient) DecBlockReference(__arg DecBlockReferenceArg) (err error) {
	err = c.Cli.Call("keybase.1.block.decBlockReference", []interface{}{__arg}, nil)
	return
}

type RegisterBTCArg struct {
	SessionID int    `codec:"sessionID" json:"sessionID"`
	Address   string `codec:"address" json:"address"`
	Force     bool   `codec:"force" json:"force"`
}

type BTCInterface interface {
	RegisterBTC(RegisterBTCArg) error
}

func BTCProtocol(i BTCInterface) rpc2.Protocol {
	return rpc2.Protocol{
		Name: "keybase.1.BTC",
		Methods: map[string]rpc2.ServeHook{
			"registerBTC": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]RegisterBTCArg, 1)
				if err = nxt(&args); err == nil {
					err = i.RegisterBTC(args[0])
				}
				return
			},
		},
	}

}

type BTCClient struct {
	Cli GenericClient
}

func (c BTCClient) RegisterBTC(__arg RegisterBTCArg) (err error) {
	err = c.Cli.Call("keybase.1.BTC.registerBTC", []interface{}{__arg}, nil)
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
	GetCurrentStatus(int) (GetCurrentStatusRes, error)
	GetConfig(int) (Config, error)
	SetUserConfig(SetUserConfigArg) error
}

func ConfigProtocol(i ConfigInterface) rpc2.Protocol {
	return rpc2.Protocol{
		Name: "keybase.1.config",
		Methods: map[string]rpc2.ServeHook{
			"getCurrentStatus": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]GetCurrentStatusArg, 1)
				if err = nxt(&args); err == nil {
					ret, err = i.GetCurrentStatus(args[0].SessionID)
				}
				return
			},
			"getConfig": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]GetConfigArg, 1)
				if err = nxt(&args); err == nil {
					ret, err = i.GetConfig(args[0].SessionID)
				}
				return
			},
			"setUserConfig": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]SetUserConfigArg, 1)
				if err = nxt(&args); err == nil {
					err = i.SetUserConfig(args[0])
				}
				return
			},
		},
	}

}

type ConfigClient struct {
	Cli GenericClient
}

func (c ConfigClient) GetCurrentStatus(sessionID int) (res GetCurrentStatusRes, err error) {
	__arg := GetCurrentStatusArg{SessionID: sessionID}
	err = c.Cli.Call("keybase.1.config.getCurrentStatus", []interface{}{__arg}, &res)
	return
}

func (c ConfigClient) GetConfig(sessionID int) (res Config, err error) {
	__arg := GetConfigArg{SessionID: sessionID}
	err = c.Cli.Call("keybase.1.config.getConfig", []interface{}{__arg}, &res)
	return
}

func (c ConfigClient) SetUserConfig(__arg SetUserConfigArg) (err error) {
	err = c.Cli.Call("keybase.1.config.setUserConfig", []interface{}{__arg}, nil)
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
	SignED25519(SignED25519Arg) (ED25519SignatureInfo, error)
	UnboxBytes32(UnboxBytes32Arg) (Bytes32, error)
}

func CryptoProtocol(i CryptoInterface) rpc2.Protocol {
	return rpc2.Protocol{
		Name: "keybase.1.crypto",
		Methods: map[string]rpc2.ServeHook{
			"signED25519": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]SignED25519Arg, 1)
				if err = nxt(&args); err == nil {
					ret, err = i.SignED25519(args[0])
				}
				return
			},
			"unboxBytes32": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]UnboxBytes32Arg, 1)
				if err = nxt(&args); err == nil {
					ret, err = i.UnboxBytes32(args[0])
				}
				return
			},
		},
	}

}

type CryptoClient struct {
	Cli GenericClient
}

func (c CryptoClient) SignED25519(__arg SignED25519Arg) (res ED25519SignatureInfo, err error) {
	err = c.Cli.Call("keybase.1.crypto.signED25519", []interface{}{__arg}, &res)
	return
}

func (c CryptoClient) UnboxBytes32(__arg UnboxBytes32Arg) (res Bytes32, err error) {
	err = c.Cli.Call("keybase.1.crypto.unboxBytes32", []interface{}{__arg}, &res)
	return
}

type ServiceStatusRes struct {
	Time Time `codec:"time" json:"time"`
}

type StopArg struct {
}

type LogRotateArg struct {
}

type PanicArg struct {
	Message string `codec:"message" json:"message"`
}

type StatusArg struct {
}

type CtlInterface interface {
	Stop() error
	LogRotate() error
	Panic(string) error
	Status() (ServiceStatusRes, error)
}

func CtlProtocol(i CtlInterface) rpc2.Protocol {
	return rpc2.Protocol{
		Name: "keybase.1.ctl",
		Methods: map[string]rpc2.ServeHook{
			"stop": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]StopArg, 1)
				if err = nxt(&args); err == nil {
					err = i.Stop()
				}
				return
			},
			"logRotate": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]LogRotateArg, 1)
				if err = nxt(&args); err == nil {
					err = i.LogRotate()
				}
				return
			},
			"panic": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]PanicArg, 1)
				if err = nxt(&args); err == nil {
					err = i.Panic(args[0].Message)
				}
				return
			},
			"status": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]StatusArg, 1)
				if err = nxt(&args); err == nil {
					ret, err = i.Status()
				}
				return
			},
		},
	}

}

type CtlClient struct {
	Cli GenericClient
}

func (c CtlClient) Stop() (err error) {
	err = c.Cli.Call("keybase.1.ctl.stop", []interface{}{StopArg{}}, nil)
	return
}

func (c CtlClient) LogRotate() (err error) {
	err = c.Cli.Call("keybase.1.ctl.logRotate", []interface{}{LogRotateArg{}}, nil)
	return
}

func (c CtlClient) Panic(message string) (err error) {
	__arg := PanicArg{Message: message}
	err = c.Cli.Call("keybase.1.ctl.panic", []interface{}{__arg}, nil)
	return
}

func (c CtlClient) Status() (res ServiceStatusRes, err error) {
	err = c.Cli.Call("keybase.1.ctl.status", []interface{}{StatusArg{}}, &res)
	return
}

type DeviceListArg struct {
	SessionID int  `codec:"sessionID" json:"sessionID"`
	All       bool `codec:"all" json:"all"`
}

type DeviceAddArg struct {
	SessionID    int    `codec:"sessionID" json:"sessionID"`
	SecretPhrase string `codec:"secretPhrase" json:"secretPhrase"`
}

type DeviceAddCancelArg struct {
	SessionID int `codec:"sessionID" json:"sessionID"`
}

type DeviceInterface interface {
	DeviceList(DeviceListArg) ([]Device, error)
	DeviceAdd(DeviceAddArg) error
	DeviceAddCancel(int) error
}

func DeviceProtocol(i DeviceInterface) rpc2.Protocol {
	return rpc2.Protocol{
		Name: "keybase.1.device",
		Methods: map[string]rpc2.ServeHook{
			"deviceList": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]DeviceListArg, 1)
				if err = nxt(&args); err == nil {
					ret, err = i.DeviceList(args[0])
				}
				return
			},
			"deviceAdd": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]DeviceAddArg, 1)
				if err = nxt(&args); err == nil {
					err = i.DeviceAdd(args[0])
				}
				return
			},
			"deviceAddCancel": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]DeviceAddCancelArg, 1)
				if err = nxt(&args); err == nil {
					err = i.DeviceAddCancel(args[0].SessionID)
				}
				return
			},
		},
	}

}

type DeviceClient struct {
	Cli GenericClient
}

func (c DeviceClient) DeviceList(__arg DeviceListArg) (res []Device, err error) {
	err = c.Cli.Call("keybase.1.device.deviceList", []interface{}{__arg}, &res)
	return
}

func (c DeviceClient) DeviceAdd(__arg DeviceAddArg) (err error) {
	err = c.Cli.Call("keybase.1.device.deviceAdd", []interface{}{__arg}, nil)
	return
}

func (c DeviceClient) DeviceAddCancel(sessionID int) (err error) {
	__arg := DeviceAddCancelArg{SessionID: sessionID}
	err = c.Cli.Call("keybase.1.device.deviceAddCancel", []interface{}{__arg}, nil)
	return
}

type DoctorArg struct {
	SessionID int `codec:"sessionID" json:"sessionID"`
}

type DoctorInterface interface {
	Doctor(int) error
}

func DoctorProtocol(i DoctorInterface) rpc2.Protocol {
	return rpc2.Protocol{
		Name: "keybase.1.doctor",
		Methods: map[string]rpc2.ServeHook{
			"doctor": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]DoctorArg, 1)
				if err = nxt(&args); err == nil {
					err = i.Doctor(args[0].SessionID)
				}
				return
			},
		},
	}

}

type DoctorClient struct {
	Cli GenericClient
}

func (c DoctorClient) Doctor(sessionID int) (err error) {
	__arg := DoctorArg{SessionID: sessionID}
	err = c.Cli.Call("keybase.1.doctor.doctor", []interface{}{__arg}, nil)
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
	WebDevice     *Device          `codec:"webDevice,omitempty" json:"webDevice,omitempty"`
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
	LoginSelect(LoginSelectArg) (string, error)
	DisplayStatus(DisplayStatusArg) (bool, error)
	DisplayResult(DisplayResultArg) error
}

func DoctorUiProtocol(i DoctorUiInterface) rpc2.Protocol {
	return rpc2.Protocol{
		Name: "keybase.1.doctorUi",
		Methods: map[string]rpc2.ServeHook{
			"loginSelect": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]LoginSelectArg, 1)
				if err = nxt(&args); err == nil {
					ret, err = i.LoginSelect(args[0])
				}
				return
			},
			"displayStatus": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]DisplayStatusArg, 1)
				if err = nxt(&args); err == nil {
					ret, err = i.DisplayStatus(args[0])
				}
				return
			},
			"displayResult": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]DisplayResultArg, 1)
				if err = nxt(&args); err == nil {
					err = i.DisplayResult(args[0])
				}
				return
			},
		},
	}

}

type DoctorUiClient struct {
	Cli GenericClient
}

func (c DoctorUiClient) LoginSelect(__arg LoginSelectArg) (res string, err error) {
	err = c.Cli.Call("keybase.1.doctorUi.loginSelect", []interface{}{__arg}, &res)
	return
}

func (c DoctorUiClient) DisplayStatus(__arg DisplayStatusArg) (res bool, err error) {
	err = c.Cli.Call("keybase.1.doctorUi.displayStatus", []interface{}{__arg}, &res)
	return
}

func (c DoctorUiClient) DisplayResult(__arg DisplayResultArg) (err error) {
	err = c.Cli.Call("keybase.1.doctorUi.displayResult", []interface{}{__arg}, nil)
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

type SelectKeyAndPushOptionArg struct {
	SessionID int      `codec:"sessionID" json:"sessionID"`
	Keys      []GPGKey `codec:"keys" json:"keys"`
}

type SelectKeyArg struct {
	SessionID int      `codec:"sessionID" json:"sessionID"`
	Keys      []GPGKey `codec:"keys" json:"keys"`
}

type GpgUiInterface interface {
	WantToAddGPGKey(int) (bool, error)
	SelectKeyAndPushOption(SelectKeyAndPushOptionArg) (SelectKeyRes, error)
	SelectKey(SelectKeyArg) (string, error)
}

func GpgUiProtocol(i GpgUiInterface) rpc2.Protocol {
	return rpc2.Protocol{
		Name: "keybase.1.gpgUi",
		Methods: map[string]rpc2.ServeHook{
			"wantToAddGPGKey": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]WantToAddGPGKeyArg, 1)
				if err = nxt(&args); err == nil {
					ret, err = i.WantToAddGPGKey(args[0].SessionID)
				}
				return
			},
			"selectKeyAndPushOption": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]SelectKeyAndPushOptionArg, 1)
				if err = nxt(&args); err == nil {
					ret, err = i.SelectKeyAndPushOption(args[0])
				}
				return
			},
			"selectKey": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]SelectKeyArg, 1)
				if err = nxt(&args); err == nil {
					ret, err = i.SelectKey(args[0])
				}
				return
			},
		},
	}

}

type GpgUiClient struct {
	Cli GenericClient
}

func (c GpgUiClient) WantToAddGPGKey(sessionID int) (res bool, err error) {
	__arg := WantToAddGPGKeyArg{SessionID: sessionID}
	err = c.Cli.Call("keybase.1.gpgUi.wantToAddGPGKey", []interface{}{__arg}, &res)
	return
}

func (c GpgUiClient) SelectKeyAndPushOption(__arg SelectKeyAndPushOptionArg) (res SelectKeyRes, err error) {
	err = c.Cli.Call("keybase.1.gpgUi.selectKeyAndPushOption", []interface{}{__arg}, &res)
	return
}

func (c GpgUiClient) SelectKey(__arg SelectKeyArg) (res string, err error) {
	err = c.Cli.Call("keybase.1.gpgUi.selectKey", []interface{}{__arg}, &res)
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

type IdentifyDefaultArg struct {
	SessionID        int    `codec:"sessionID" json:"sessionID"`
	UserAssertion    string `codec:"userAssertion" json:"userAssertion"`
	ForceRemoteCheck bool   `codec:"forceRemoteCheck" json:"forceRemoteCheck"`
}

type IdentifyInterface interface {
	Identify(IdentifyArg) (IdentifyRes, error)
	IdentifyDefault(IdentifyDefaultArg) (IdentifyRes, error)
}

func IdentifyProtocol(i IdentifyInterface) rpc2.Protocol {
	return rpc2.Protocol{
		Name: "keybase.1.identify",
		Methods: map[string]rpc2.ServeHook{
			"identify": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]IdentifyArg, 1)
				if err = nxt(&args); err == nil {
					ret, err = i.Identify(args[0])
				}
				return
			},
			"identifyDefault": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]IdentifyDefaultArg, 1)
				if err = nxt(&args); err == nil {
					ret, err = i.IdentifyDefault(args[0])
				}
				return
			},
		},
	}

}

type IdentifyClient struct {
	Cli GenericClient
}

func (c IdentifyClient) Identify(__arg IdentifyArg) (res IdentifyRes, err error) {
	err = c.Cli.Call("keybase.1.identify.identify", []interface{}{__arg}, &res)
	return
}

func (c IdentifyClient) IdentifyDefault(__arg IdentifyDefaultArg) (res IdentifyRes, err error) {
	err = c.Cli.Call("keybase.1.identify.identifyDefault", []interface{}{__arg}, &res)
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
	Start(StartArg) error
	DisplayKey(DisplayKeyArg) error
	ReportLastTrack(ReportLastTrackArg) error
	LaunchNetworkChecks(LaunchNetworkChecksArg) error
	DisplayTrackStatement(DisplayTrackStatementArg) error
	FinishWebProofCheck(FinishWebProofCheckArg) error
	FinishSocialProofCheck(FinishSocialProofCheckArg) error
	DisplayCryptocurrency(DisplayCryptocurrencyArg) error
	Confirm(ConfirmArg) (bool, error)
	Finish(int) error
}

func IdentifyUiProtocol(i IdentifyUiInterface) rpc2.Protocol {
	return rpc2.Protocol{
		Name: "keybase.1.identifyUi",
		Methods: map[string]rpc2.ServeHook{
			"start": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]StartArg, 1)
				if err = nxt(&args); err == nil {
					err = i.Start(args[0])
				}
				return
			},
			"displayKey": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]DisplayKeyArg, 1)
				if err = nxt(&args); err == nil {
					err = i.DisplayKey(args[0])
				}
				return
			},
			"reportLastTrack": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]ReportLastTrackArg, 1)
				if err = nxt(&args); err == nil {
					err = i.ReportLastTrack(args[0])
				}
				return
			},
			"launchNetworkChecks": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]LaunchNetworkChecksArg, 1)
				if err = nxt(&args); err == nil {
					err = i.LaunchNetworkChecks(args[0])
				}
				return
			},
			"displayTrackStatement": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]DisplayTrackStatementArg, 1)
				if err = nxt(&args); err == nil {
					err = i.DisplayTrackStatement(args[0])
				}
				return
			},
			"finishWebProofCheck": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]FinishWebProofCheckArg, 1)
				if err = nxt(&args); err == nil {
					err = i.FinishWebProofCheck(args[0])
				}
				return
			},
			"finishSocialProofCheck": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]FinishSocialProofCheckArg, 1)
				if err = nxt(&args); err == nil {
					err = i.FinishSocialProofCheck(args[0])
				}
				return
			},
			"displayCryptocurrency": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]DisplayCryptocurrencyArg, 1)
				if err = nxt(&args); err == nil {
					err = i.DisplayCryptocurrency(args[0])
				}
				return
			},
			"confirm": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]ConfirmArg, 1)
				if err = nxt(&args); err == nil {
					ret, err = i.Confirm(args[0])
				}
				return
			},
			"finish": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]FinishArg, 1)
				if err = nxt(&args); err == nil {
					err = i.Finish(args[0].SessionID)
				}
				return
			},
		},
	}

}

type IdentifyUiClient struct {
	Cli GenericClient
}

func (c IdentifyUiClient) Start(__arg StartArg) (err error) {
	err = c.Cli.Call("keybase.1.identifyUi.start", []interface{}{__arg}, nil)
	return
}

func (c IdentifyUiClient) DisplayKey(__arg DisplayKeyArg) (err error) {
	err = c.Cli.Call("keybase.1.identifyUi.displayKey", []interface{}{__arg}, nil)
	return
}

func (c IdentifyUiClient) ReportLastTrack(__arg ReportLastTrackArg) (err error) {
	err = c.Cli.Call("keybase.1.identifyUi.reportLastTrack", []interface{}{__arg}, nil)
	return
}

func (c IdentifyUiClient) LaunchNetworkChecks(__arg LaunchNetworkChecksArg) (err error) {
	err = c.Cli.Call("keybase.1.identifyUi.launchNetworkChecks", []interface{}{__arg}, nil)
	return
}

func (c IdentifyUiClient) DisplayTrackStatement(__arg DisplayTrackStatementArg) (err error) {
	err = c.Cli.Call("keybase.1.identifyUi.displayTrackStatement", []interface{}{__arg}, nil)
	return
}

func (c IdentifyUiClient) FinishWebProofCheck(__arg FinishWebProofCheckArg) (err error) {
	err = c.Cli.Call("keybase.1.identifyUi.finishWebProofCheck", []interface{}{__arg}, nil)
	return
}

func (c IdentifyUiClient) FinishSocialProofCheck(__arg FinishSocialProofCheckArg) (err error) {
	err = c.Cli.Call("keybase.1.identifyUi.finishSocialProofCheck", []interface{}{__arg}, nil)
	return
}

func (c IdentifyUiClient) DisplayCryptocurrency(__arg DisplayCryptocurrencyArg) (err error) {
	err = c.Cli.Call("keybase.1.identifyUi.displayCryptocurrency", []interface{}{__arg}, nil)
	return
}

func (c IdentifyUiClient) Confirm(__arg ConfirmArg) (res bool, err error) {
	err = c.Cli.Call("keybase.1.identifyUi.confirm", []interface{}{__arg}, &res)
	return
}

func (c IdentifyUiClient) Finish(sessionID int) (err error) {
	__arg := FinishArg{SessionID: sessionID}
	err = c.Cli.Call("keybase.1.identifyUi.finish", []interface{}{__arg}, nil)
	return
}

type DeviceSignerKind int

const (
	DeviceSignerKind_DEVICE DeviceSignerKind = 0
	DeviceSignerKind_PGP    DeviceSignerKind = 1
)

type SelectSignerAction int

const (
	SelectSignerAction_SIGN          SelectSignerAction = 0
	SelectSignerAction_CANCEL        SelectSignerAction = 1
	SelectSignerAction_RESET_ACCOUNT SelectSignerAction = 2
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

type SelectSignerArg struct {
	SessionID int      `codec:"sessionID" json:"sessionID"`
	Devices   []Device `codec:"devices" json:"devices"`
	HasPGP    bool     `codec:"hasPGP" json:"hasPGP"`
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

type LocksmithUiInterface interface {
	PromptDeviceName(int) (string, error)
	SelectSigner(SelectSignerArg) (SelectSignerRes, error)
	DeviceSignAttemptErr(DeviceSignAttemptErrArg) error
	DisplaySecretWords(DisplaySecretWordsArg) error
	KexStatus(KexStatusArg) error
}

func LocksmithUiProtocol(i LocksmithUiInterface) rpc2.Protocol {
	return rpc2.Protocol{
		Name: "keybase.1.locksmithUi",
		Methods: map[string]rpc2.ServeHook{
			"promptDeviceName": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]PromptDeviceNameArg, 1)
				if err = nxt(&args); err == nil {
					ret, err = i.PromptDeviceName(args[0].SessionID)
				}
				return
			},
			"selectSigner": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]SelectSignerArg, 1)
				if err = nxt(&args); err == nil {
					ret, err = i.SelectSigner(args[0])
				}
				return
			},
			"deviceSignAttemptErr": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]DeviceSignAttemptErrArg, 1)
				if err = nxt(&args); err == nil {
					err = i.DeviceSignAttemptErr(args[0])
				}
				return
			},
			"displaySecretWords": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]DisplaySecretWordsArg, 1)
				if err = nxt(&args); err == nil {
					err = i.DisplaySecretWords(args[0])
				}
				return
			},
			"kexStatus": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]KexStatusArg, 1)
				if err = nxt(&args); err == nil {
					err = i.KexStatus(args[0])
				}
				return
			},
		},
	}

}

type LocksmithUiClient struct {
	Cli GenericClient
}

func (c LocksmithUiClient) PromptDeviceName(sessionID int) (res string, err error) {
	__arg := PromptDeviceNameArg{SessionID: sessionID}
	err = c.Cli.Call("keybase.1.locksmithUi.promptDeviceName", []interface{}{__arg}, &res)
	return
}

func (c LocksmithUiClient) SelectSigner(__arg SelectSignerArg) (res SelectSignerRes, err error) {
	err = c.Cli.Call("keybase.1.locksmithUi.selectSigner", []interface{}{__arg}, &res)
	return
}

func (c LocksmithUiClient) DeviceSignAttemptErr(__arg DeviceSignAttemptErrArg) (err error) {
	err = c.Cli.Call("keybase.1.locksmithUi.deviceSignAttemptErr", []interface{}{__arg}, nil)
	return
}

func (c LocksmithUiClient) DisplaySecretWords(__arg DisplaySecretWordsArg) (err error) {
	err = c.Cli.Call("keybase.1.locksmithUi.displaySecretWords", []interface{}{__arg}, nil)
	return
}

func (c LocksmithUiClient) KexStatus(__arg KexStatusArg) (err error) {
	err = c.Cli.Call("keybase.1.locksmithUi.kexStatus", []interface{}{__arg}, nil)
	return
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
)

type LogArg struct {
	SessionID int      `codec:"sessionID" json:"sessionID"`
	Level     LogLevel `codec:"level" json:"level"`
	Text      Text     `codec:"text" json:"text"`
}

type LogUiInterface interface {
	Log(LogArg) error
}

func LogUiProtocol(i LogUiInterface) rpc2.Protocol {
	return rpc2.Protocol{
		Name: "keybase.1.logUi",
		Methods: map[string]rpc2.ServeHook{
			"log": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]LogArg, 1)
				if err = nxt(&args); err == nil {
					err = i.Log(args[0])
				}
				return
			},
		},
	}

}

type LogUiClient struct {
	Cli GenericClient
}

func (c LogUiClient) Log(__arg LogArg) (err error) {
	err = c.Cli.Call("keybase.1.logUi.log", []interface{}{__arg}, nil)
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

type BackupArg struct {
	SessionID int `codec:"sessionID" json:"sessionID"`
}

type LoginInterface interface {
	GetConfiguredAccounts(int) ([]ConfiguredAccount, error)
	LoginWithPrompt(LoginWithPromptArg) error
	LoginWithStoredSecret(LoginWithStoredSecretArg) error
	LoginWithPassphrase(LoginWithPassphraseArg) error
	ClearStoredSecret(ClearStoredSecretArg) error
	CancelLogin(int) error
	Logout(int) error
	Reset(int) error
	Backup(int) (string, error)
}

func LoginProtocol(i LoginInterface) rpc2.Protocol {
	return rpc2.Protocol{
		Name: "keybase.1.login",
		Methods: map[string]rpc2.ServeHook{
			"getConfiguredAccounts": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]GetConfiguredAccountsArg, 1)
				if err = nxt(&args); err == nil {
					ret, err = i.GetConfiguredAccounts(args[0].SessionID)
				}
				return
			},
			"loginWithPrompt": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]LoginWithPromptArg, 1)
				if err = nxt(&args); err == nil {
					err = i.LoginWithPrompt(args[0])
				}
				return
			},
			"loginWithStoredSecret": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]LoginWithStoredSecretArg, 1)
				if err = nxt(&args); err == nil {
					err = i.LoginWithStoredSecret(args[0])
				}
				return
			},
			"loginWithPassphrase": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]LoginWithPassphraseArg, 1)
				if err = nxt(&args); err == nil {
					err = i.LoginWithPassphrase(args[0])
				}
				return
			},
			"clearStoredSecret": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]ClearStoredSecretArg, 1)
				if err = nxt(&args); err == nil {
					err = i.ClearStoredSecret(args[0])
				}
				return
			},
			"cancelLogin": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]CancelLoginArg, 1)
				if err = nxt(&args); err == nil {
					err = i.CancelLogin(args[0].SessionID)
				}
				return
			},
			"logout": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]LogoutArg, 1)
				if err = nxt(&args); err == nil {
					err = i.Logout(args[0].SessionID)
				}
				return
			},
			"reset": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]ResetArg, 1)
				if err = nxt(&args); err == nil {
					err = i.Reset(args[0].SessionID)
				}
				return
			},
			"backup": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]BackupArg, 1)
				if err = nxt(&args); err == nil {
					ret, err = i.Backup(args[0].SessionID)
				}
				return
			},
		},
	}

}

type LoginClient struct {
	Cli GenericClient
}

func (c LoginClient) GetConfiguredAccounts(sessionID int) (res []ConfiguredAccount, err error) {
	__arg := GetConfiguredAccountsArg{SessionID: sessionID}
	err = c.Cli.Call("keybase.1.login.getConfiguredAccounts", []interface{}{__arg}, &res)
	return
}

func (c LoginClient) LoginWithPrompt(__arg LoginWithPromptArg) (err error) {
	err = c.Cli.Call("keybase.1.login.loginWithPrompt", []interface{}{__arg}, nil)
	return
}

func (c LoginClient) LoginWithStoredSecret(__arg LoginWithStoredSecretArg) (err error) {
	err = c.Cli.Call("keybase.1.login.loginWithStoredSecret", []interface{}{__arg}, nil)
	return
}

func (c LoginClient) LoginWithPassphrase(__arg LoginWithPassphraseArg) (err error) {
	err = c.Cli.Call("keybase.1.login.loginWithPassphrase", []interface{}{__arg}, nil)
	return
}

func (c LoginClient) ClearStoredSecret(__arg ClearStoredSecretArg) (err error) {
	err = c.Cli.Call("keybase.1.login.clearStoredSecret", []interface{}{__arg}, nil)
	return
}

func (c LoginClient) CancelLogin(sessionID int) (err error) {
	__arg := CancelLoginArg{SessionID: sessionID}
	err = c.Cli.Call("keybase.1.login.cancelLogin", []interface{}{__arg}, nil)
	return
}

func (c LoginClient) Logout(sessionID int) (err error) {
	__arg := LogoutArg{SessionID: sessionID}
	err = c.Cli.Call("keybase.1.login.logout", []interface{}{__arg}, nil)
	return
}

func (c LoginClient) Reset(sessionID int) (err error) {
	__arg := ResetArg{SessionID: sessionID}
	err = c.Cli.Call("keybase.1.login.reset", []interface{}{__arg}, nil)
	return
}

func (c LoginClient) Backup(sessionID int) (res string, err error) {
	__arg := BackupArg{SessionID: sessionID}
	err = c.Cli.Call("keybase.1.login.backup", []interface{}{__arg}, &res)
	return
}

type GetEmailOrUsernameArg struct {
	SessionID int `codec:"sessionID" json:"sessionID"`
}

type PromptRevokeBackupDeviceKeysArg struct {
	SessionID int    `codec:"sessionID" json:"sessionID"`
	Device    Device `codec:"device" json:"device"`
}

type LoginUiInterface interface {
	GetEmailOrUsername(int) (string, error)
	PromptRevokeBackupDeviceKeys(PromptRevokeBackupDeviceKeysArg) (bool, error)
}

func LoginUiProtocol(i LoginUiInterface) rpc2.Protocol {
	return rpc2.Protocol{
		Name: "keybase.1.loginUi",
		Methods: map[string]rpc2.ServeHook{
			"getEmailOrUsername": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]GetEmailOrUsernameArg, 1)
				if err = nxt(&args); err == nil {
					ret, err = i.GetEmailOrUsername(args[0].SessionID)
				}
				return
			},
			"promptRevokeBackupDeviceKeys": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]PromptRevokeBackupDeviceKeysArg, 1)
				if err = nxt(&args); err == nil {
					ret, err = i.PromptRevokeBackupDeviceKeys(args[0])
				}
				return
			},
		},
	}

}

type LoginUiClient struct {
	Cli GenericClient
}

func (c LoginUiClient) GetEmailOrUsername(sessionID int) (res string, err error) {
	__arg := GetEmailOrUsernameArg{SessionID: sessionID}
	err = c.Cli.Call("keybase.1.loginUi.getEmailOrUsername", []interface{}{__arg}, &res)
	return
}

func (c LoginUiClient) PromptRevokeBackupDeviceKeys(__arg PromptRevokeBackupDeviceKeysArg) (res bool, err error) {
	err = c.Cli.Call("keybase.1.loginUi.promptRevokeBackupDeviceKeys", []interface{}{__arg}, &res)
	return
}

type KeyHalf struct {
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
	MdBlock []byte `codec:"mdBlock" json:"mdBlock"`
}

type GetMetadataArg struct {
	FolderID      string `codec:"folderID" json:"folderID"`
	FolderHandle  []byte `codec:"folderHandle" json:"folderHandle"`
	Unmerged      bool   `codec:"unmerged" json:"unmerged"`
	StartRevision int64  `codec:"startRevision" json:"startRevision"`
	StopRevision  int64  `codec:"stopRevision" json:"stopRevision"`
}

type PruneUnmergedArg struct {
	FolderID string `codec:"folderID" json:"folderID"`
}

type PutKeysArg struct {
	KeyHalves []KeyHalf `codec:"keyHalves" json:"keyHalves"`
}

type GetKeyArg struct {
	KeyHash string `codec:"keyHash" json:"keyHash"`
}

type TruncateLockArg struct {
	FolderID string `codec:"folderID" json:"folderID"`
}

type TruncateUnlockArg struct {
	FolderID string `codec:"folderID" json:"folderID"`
}

type MetadataInterface interface {
	Authenticate(AuthenticateArg) error
	PutMetadata([]byte) error
	GetMetadata(GetMetadataArg) (MetadataResponse, error)
	PruneUnmerged(string) error
	PutKeys([]KeyHalf) error
	GetKey(string) ([]byte, error)
	TruncateLock(string) (bool, error)
	TruncateUnlock(string) (bool, error)
}

func MetadataProtocol(i MetadataInterface) rpc2.Protocol {
	return rpc2.Protocol{
		Name: "keybase.1.metadata",
		Methods: map[string]rpc2.ServeHook{
			"authenticate": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]AuthenticateArg, 1)
				if err = nxt(&args); err == nil {
					err = i.Authenticate(args[0])
				}
				return
			},
			"putMetadata": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]PutMetadataArg, 1)
				if err = nxt(&args); err == nil {
					err = i.PutMetadata(args[0].MdBlock)
				}
				return
			},
			"getMetadata": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]GetMetadataArg, 1)
				if err = nxt(&args); err == nil {
					ret, err = i.GetMetadata(args[0])
				}
				return
			},
			"pruneUnmerged": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]PruneUnmergedArg, 1)
				if err = nxt(&args); err == nil {
					err = i.PruneUnmerged(args[0].FolderID)
				}
				return
			},
			"putKeys": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]PutKeysArg, 1)
				if err = nxt(&args); err == nil {
					err = i.PutKeys(args[0].KeyHalves)
				}
				return
			},
			"getKey": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]GetKeyArg, 1)
				if err = nxt(&args); err == nil {
					ret, err = i.GetKey(args[0].KeyHash)
				}
				return
			},
			"truncateLock": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]TruncateLockArg, 1)
				if err = nxt(&args); err == nil {
					ret, err = i.TruncateLock(args[0].FolderID)
				}
				return
			},
			"truncateUnlock": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]TruncateUnlockArg, 1)
				if err = nxt(&args); err == nil {
					ret, err = i.TruncateUnlock(args[0].FolderID)
				}
				return
			},
		},
	}

}

type MetadataClient struct {
	Cli GenericClient
}

func (c MetadataClient) Authenticate(__arg AuthenticateArg) (err error) {
	err = c.Cli.Call("keybase.1.metadata.authenticate", []interface{}{__arg}, nil)
	return
}

func (c MetadataClient) PutMetadata(mdBlock []byte) (err error) {
	__arg := PutMetadataArg{MdBlock: mdBlock}
	err = c.Cli.Call("keybase.1.metadata.putMetadata", []interface{}{__arg}, nil)
	return
}

func (c MetadataClient) GetMetadata(__arg GetMetadataArg) (res MetadataResponse, err error) {
	err = c.Cli.Call("keybase.1.metadata.getMetadata", []interface{}{__arg}, &res)
	return
}

func (c MetadataClient) PruneUnmerged(folderID string) (err error) {
	__arg := PruneUnmergedArg{FolderID: folderID}
	err = c.Cli.Call("keybase.1.metadata.pruneUnmerged", []interface{}{__arg}, nil)
	return
}

func (c MetadataClient) PutKeys(keyHalves []KeyHalf) (err error) {
	__arg := PutKeysArg{KeyHalves: keyHalves}
	err = c.Cli.Call("keybase.1.metadata.putKeys", []interface{}{__arg}, nil)
	return
}

func (c MetadataClient) GetKey(keyHash string) (res []byte, err error) {
	__arg := GetKeyArg{KeyHash: keyHash}
	err = c.Cli.Call("keybase.1.metadata.getKey", []interface{}{__arg}, &res)
	return
}

func (c MetadataClient) TruncateLock(folderID string) (res bool, err error) {
	__arg := TruncateLockArg{FolderID: folderID}
	err = c.Cli.Call("keybase.1.metadata.truncateLock", []interface{}{__arg}, &res)
	return
}

func (c MetadataClient) TruncateUnlock(folderID string) (res bool, err error) {
	__arg := TruncateUnlockArg{FolderID: folderID}
	err = c.Cli.Call("keybase.1.metadata.truncateUnlock", []interface{}{__arg}, &res)
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
}

type PGPUpdateArg struct {
	SessionID    int      `codec:"sessionID" json:"sessionID"`
	All          bool     `codec:"all" json:"all"`
	Fingerprints []string `codec:"fingerprints" json:"fingerprints"`
}

type PGPInterface interface {
	PGPSign(PGPSignArg) error
	PGPPull(PGPPullArg) error
	PGPEncrypt(PGPEncryptArg) error
	PGPDecrypt(PGPDecryptArg) (PGPSigVerification, error)
	PGPVerify(PGPVerifyArg) (PGPSigVerification, error)
	PGPImport(PGPImportArg) error
	PGPExport(PGPExportArg) ([]KeyInfo, error)
	PGPExportByFingerprint(PGPExportByFingerprintArg) ([]KeyInfo, error)
	PGPExportByKID(PGPExportByKIDArg) ([]KeyInfo, error)
	PGPKeyGen(PGPKeyGenArg) error
	PGPKeyGenDefault(PGPKeyGenDefaultArg) error
	PGPDeletePrimary(int) error
	PGPSelect(PGPSelectArg) error
	PGPUpdate(PGPUpdateArg) error
}

func PGPProtocol(i PGPInterface) rpc2.Protocol {
	return rpc2.Protocol{
		Name: "keybase.1.pgp",
		Methods: map[string]rpc2.ServeHook{
			"pgpSign": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]PGPSignArg, 1)
				if err = nxt(&args); err == nil {
					err = i.PGPSign(args[0])
				}
				return
			},
			"pgpPull": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]PGPPullArg, 1)
				if err = nxt(&args); err == nil {
					err = i.PGPPull(args[0])
				}
				return
			},
			"pgpEncrypt": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]PGPEncryptArg, 1)
				if err = nxt(&args); err == nil {
					err = i.PGPEncrypt(args[0])
				}
				return
			},
			"pgpDecrypt": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]PGPDecryptArg, 1)
				if err = nxt(&args); err == nil {
					ret, err = i.PGPDecrypt(args[0])
				}
				return
			},
			"pgpVerify": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]PGPVerifyArg, 1)
				if err = nxt(&args); err == nil {
					ret, err = i.PGPVerify(args[0])
				}
				return
			},
			"pgpImport": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]PGPImportArg, 1)
				if err = nxt(&args); err == nil {
					err = i.PGPImport(args[0])
				}
				return
			},
			"pgpExport": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]PGPExportArg, 1)
				if err = nxt(&args); err == nil {
					ret, err = i.PGPExport(args[0])
				}
				return
			},
			"pgpExportByFingerprint": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]PGPExportByFingerprintArg, 1)
				if err = nxt(&args); err == nil {
					ret, err = i.PGPExportByFingerprint(args[0])
				}
				return
			},
			"pgpExportByKID": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]PGPExportByKIDArg, 1)
				if err = nxt(&args); err == nil {
					ret, err = i.PGPExportByKID(args[0])
				}
				return
			},
			"pgpKeyGen": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]PGPKeyGenArg, 1)
				if err = nxt(&args); err == nil {
					err = i.PGPKeyGen(args[0])
				}
				return
			},
			"pgpKeyGenDefault": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]PGPKeyGenDefaultArg, 1)
				if err = nxt(&args); err == nil {
					err = i.PGPKeyGenDefault(args[0])
				}
				return
			},
			"pgpDeletePrimary": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]PGPDeletePrimaryArg, 1)
				if err = nxt(&args); err == nil {
					err = i.PGPDeletePrimary(args[0].SessionID)
				}
				return
			},
			"pgpSelect": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]PGPSelectArg, 1)
				if err = nxt(&args); err == nil {
					err = i.PGPSelect(args[0])
				}
				return
			},
			"pgpUpdate": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]PGPUpdateArg, 1)
				if err = nxt(&args); err == nil {
					err = i.PGPUpdate(args[0])
				}
				return
			},
		},
	}

}

type PGPClient struct {
	Cli GenericClient
}

func (c PGPClient) PGPSign(__arg PGPSignArg) (err error) {
	err = c.Cli.Call("keybase.1.pgp.pgpSign", []interface{}{__arg}, nil)
	return
}

func (c PGPClient) PGPPull(__arg PGPPullArg) (err error) {
	err = c.Cli.Call("keybase.1.pgp.pgpPull", []interface{}{__arg}, nil)
	return
}

func (c PGPClient) PGPEncrypt(__arg PGPEncryptArg) (err error) {
	err = c.Cli.Call("keybase.1.pgp.pgpEncrypt", []interface{}{__arg}, nil)
	return
}

func (c PGPClient) PGPDecrypt(__arg PGPDecryptArg) (res PGPSigVerification, err error) {
	err = c.Cli.Call("keybase.1.pgp.pgpDecrypt", []interface{}{__arg}, &res)
	return
}

func (c PGPClient) PGPVerify(__arg PGPVerifyArg) (res PGPSigVerification, err error) {
	err = c.Cli.Call("keybase.1.pgp.pgpVerify", []interface{}{__arg}, &res)
	return
}

func (c PGPClient) PGPImport(__arg PGPImportArg) (err error) {
	err = c.Cli.Call("keybase.1.pgp.pgpImport", []interface{}{__arg}, nil)
	return
}

func (c PGPClient) PGPExport(__arg PGPExportArg) (res []KeyInfo, err error) {
	err = c.Cli.Call("keybase.1.pgp.pgpExport", []interface{}{__arg}, &res)
	return
}

func (c PGPClient) PGPExportByFingerprint(__arg PGPExportByFingerprintArg) (res []KeyInfo, err error) {
	err = c.Cli.Call("keybase.1.pgp.pgpExportByFingerprint", []interface{}{__arg}, &res)
	return
}

func (c PGPClient) PGPExportByKID(__arg PGPExportByKIDArg) (res []KeyInfo, err error) {
	err = c.Cli.Call("keybase.1.pgp.pgpExportByKID", []interface{}{__arg}, &res)
	return
}

func (c PGPClient) PGPKeyGen(__arg PGPKeyGenArg) (err error) {
	err = c.Cli.Call("keybase.1.pgp.pgpKeyGen", []interface{}{__arg}, nil)
	return
}

func (c PGPClient) PGPKeyGenDefault(__arg PGPKeyGenDefaultArg) (err error) {
	err = c.Cli.Call("keybase.1.pgp.pgpKeyGenDefault", []interface{}{__arg}, nil)
	return
}

func (c PGPClient) PGPDeletePrimary(sessionID int) (err error) {
	__arg := PGPDeletePrimaryArg{SessionID: sessionID}
	err = c.Cli.Call("keybase.1.pgp.pgpDeletePrimary", []interface{}{__arg}, nil)
	return
}

func (c PGPClient) PGPSelect(__arg PGPSelectArg) (err error) {
	err = c.Cli.Call("keybase.1.pgp.pgpSelect", []interface{}{__arg}, nil)
	return
}

func (c PGPClient) PGPUpdate(__arg PGPUpdateArg) (err error) {
	err = c.Cli.Call("keybase.1.pgp.pgpUpdate", []interface{}{__arg}, nil)
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
	StartProof(StartProofArg) (StartProofResult, error)
	CheckProof(CheckProofArg) (CheckProofStatus, error)
}

func ProveProtocol(i ProveInterface) rpc2.Protocol {
	return rpc2.Protocol{
		Name: "keybase.1.prove",
		Methods: map[string]rpc2.ServeHook{
			"startProof": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]StartProofArg, 1)
				if err = nxt(&args); err == nil {
					ret, err = i.StartProof(args[0])
				}
				return
			},
			"checkProof": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]CheckProofArg, 1)
				if err = nxt(&args); err == nil {
					ret, err = i.CheckProof(args[0])
				}
				return
			},
		},
	}

}

type ProveClient struct {
	Cli GenericClient
}

func (c ProveClient) StartProof(__arg StartProofArg) (res StartProofResult, err error) {
	err = c.Cli.Call("keybase.1.prove.startProof", []interface{}{__arg}, &res)
	return
}

func (c ProveClient) CheckProof(__arg CheckProofArg) (res CheckProofStatus, err error) {
	err = c.Cli.Call("keybase.1.prove.checkProof", []interface{}{__arg}, &res)
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
	PromptOverwrite(PromptOverwriteArg) (bool, error)
	PromptUsername(PromptUsernameArg) (string, error)
	OutputPrechecks(OutputPrechecksArg) error
	PreProofWarning(PreProofWarningArg) (bool, error)
	OutputInstructions(OutputInstructionsArg) error
	OkToCheck(OkToCheckArg) (bool, error)
	DisplayRecheckWarning(DisplayRecheckWarningArg) error
}

func ProveUiProtocol(i ProveUiInterface) rpc2.Protocol {
	return rpc2.Protocol{
		Name: "keybase.1.proveUi",
		Methods: map[string]rpc2.ServeHook{
			"promptOverwrite": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]PromptOverwriteArg, 1)
				if err = nxt(&args); err == nil {
					ret, err = i.PromptOverwrite(args[0])
				}
				return
			},
			"promptUsername": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]PromptUsernameArg, 1)
				if err = nxt(&args); err == nil {
					ret, err = i.PromptUsername(args[0])
				}
				return
			},
			"outputPrechecks": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]OutputPrechecksArg, 1)
				if err = nxt(&args); err == nil {
					err = i.OutputPrechecks(args[0])
				}
				return
			},
			"preProofWarning": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]PreProofWarningArg, 1)
				if err = nxt(&args); err == nil {
					ret, err = i.PreProofWarning(args[0])
				}
				return
			},
			"outputInstructions": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]OutputInstructionsArg, 1)
				if err = nxt(&args); err == nil {
					err = i.OutputInstructions(args[0])
				}
				return
			},
			"okToCheck": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]OkToCheckArg, 1)
				if err = nxt(&args); err == nil {
					ret, err = i.OkToCheck(args[0])
				}
				return
			},
			"displayRecheckWarning": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]DisplayRecheckWarningArg, 1)
				if err = nxt(&args); err == nil {
					err = i.DisplayRecheckWarning(args[0])
				}
				return
			},
		},
	}

}

type ProveUiClient struct {
	Cli GenericClient
}

func (c ProveUiClient) PromptOverwrite(__arg PromptOverwriteArg) (res bool, err error) {
	err = c.Cli.Call("keybase.1.proveUi.promptOverwrite", []interface{}{__arg}, &res)
	return
}

func (c ProveUiClient) PromptUsername(__arg PromptUsernameArg) (res string, err error) {
	err = c.Cli.Call("keybase.1.proveUi.promptUsername", []interface{}{__arg}, &res)
	return
}

func (c ProveUiClient) OutputPrechecks(__arg OutputPrechecksArg) (err error) {
	err = c.Cli.Call("keybase.1.proveUi.outputPrechecks", []interface{}{__arg}, nil)
	return
}

func (c ProveUiClient) PreProofWarning(__arg PreProofWarningArg) (res bool, err error) {
	err = c.Cli.Call("keybase.1.proveUi.preProofWarning", []interface{}{__arg}, &res)
	return
}

func (c ProveUiClient) OutputInstructions(__arg OutputInstructionsArg) (err error) {
	err = c.Cli.Call("keybase.1.proveUi.outputInstructions", []interface{}{__arg}, nil)
	return
}

func (c ProveUiClient) OkToCheck(__arg OkToCheckArg) (res bool, err error) {
	err = c.Cli.Call("keybase.1.proveUi.okToCheck", []interface{}{__arg}, &res)
	return
}

func (c ProveUiClient) DisplayRecheckWarning(__arg DisplayRecheckWarningArg) (err error) {
	err = c.Cli.Call("keybase.1.proveUi.displayRecheckWarning", []interface{}{__arg}, nil)
	return
}

type SessionToken struct {
	Uid       UID    `codec:"uid" json:"uid"`
	Sid       string `codec:"sid" json:"sid"`
	Generated int    `codec:"generated" json:"generated"`
	Lifetime  int    `codec:"lifetime" json:"lifetime"`
}

type VerifySessionArg struct {
	Session string `codec:"session" json:"session"`
}

type QuotaInterface interface {
	VerifySession(string) (SessionToken, error)
}

func QuotaProtocol(i QuotaInterface) rpc2.Protocol {
	return rpc2.Protocol{
		Name: "keybase.1.quota",
		Methods: map[string]rpc2.ServeHook{
			"verifySession": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]VerifySessionArg, 1)
				if err = nxt(&args); err == nil {
					ret, err = i.VerifySession(args[0].Session)
				}
				return
			},
		},
	}

}

type QuotaClient struct {
	Cli GenericClient
}

func (c QuotaClient) VerifySession(session string) (res SessionToken, err error) {
	__arg := VerifySessionArg{Session: session}
	err = c.Cli.Call("keybase.1.quota.verifySession", []interface{}{__arg}, &res)
	return
}

type RevokeKeyArg struct {
	SessionID int    `codec:"sessionID" json:"sessionID"`
	KeyID     string `codec:"keyID" json:"keyID"`
}

type RevokeDeviceArg struct {
	SessionID int      `codec:"sessionID" json:"sessionID"`
	DeviceID  DeviceID `codec:"deviceID" json:"deviceID"`
}

type RevokeSigsArg struct {
	SessionID int     `codec:"sessionID" json:"sessionID"`
	SigIDs    []SigID `codec:"sigIDs" json:"sigIDs"`
	Seqnos    []int   `codec:"seqnos" json:"seqnos"`
}

type RevokeInterface interface {
	RevokeKey(RevokeKeyArg) error
	RevokeDevice(RevokeDeviceArg) error
	RevokeSigs(RevokeSigsArg) error
}

func RevokeProtocol(i RevokeInterface) rpc2.Protocol {
	return rpc2.Protocol{
		Name: "keybase.1.revoke",
		Methods: map[string]rpc2.ServeHook{
			"revokeKey": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]RevokeKeyArg, 1)
				if err = nxt(&args); err == nil {
					err = i.RevokeKey(args[0])
				}
				return
			},
			"revokeDevice": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]RevokeDeviceArg, 1)
				if err = nxt(&args); err == nil {
					err = i.RevokeDevice(args[0])
				}
				return
			},
			"revokeSigs": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]RevokeSigsArg, 1)
				if err = nxt(&args); err == nil {
					err = i.RevokeSigs(args[0])
				}
				return
			},
		},
	}

}

type RevokeClient struct {
	Cli GenericClient
}

func (c RevokeClient) RevokeKey(__arg RevokeKeyArg) (err error) {
	err = c.Cli.Call("keybase.1.revoke.revokeKey", []interface{}{__arg}, nil)
	return
}

func (c RevokeClient) RevokeDevice(__arg RevokeDeviceArg) (err error) {
	err = c.Cli.Call("keybase.1.revoke.revokeDevice", []interface{}{__arg}, nil)
	return
}

func (c RevokeClient) RevokeSigs(__arg RevokeSigsArg) (err error) {
	err = c.Cli.Call("keybase.1.revoke.revokeSigs", []interface{}{__arg}, nil)
	return
}

type SecretEntryArg struct {
	Desc           string `codec:"desc" json:"desc"`
	Prompt         string `codec:"prompt" json:"prompt"`
	Err            string `codec:"err" json:"err"`
	Cancel         string `codec:"cancel" json:"cancel"`
	Ok             string `codec:"ok" json:"ok"`
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

type SecretUiInterface interface {
	GetSecret(GetSecretArg) (SecretEntryRes, error)
	GetNewPassphrase(GetNewPassphraseArg) (GetNewPassphraseRes, error)
	GetKeybasePassphrase(GetKeybasePassphraseArg) (string, error)
}

func SecretUiProtocol(i SecretUiInterface) rpc2.Protocol {
	return rpc2.Protocol{
		Name: "keybase.1.secretUi",
		Methods: map[string]rpc2.ServeHook{
			"getSecret": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]GetSecretArg, 1)
				if err = nxt(&args); err == nil {
					ret, err = i.GetSecret(args[0])
				}
				return
			},
			"getNewPassphrase": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]GetNewPassphraseArg, 1)
				if err = nxt(&args); err == nil {
					ret, err = i.GetNewPassphrase(args[0])
				}
				return
			},
			"getKeybasePassphrase": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]GetKeybasePassphraseArg, 1)
				if err = nxt(&args); err == nil {
					ret, err = i.GetKeybasePassphrase(args[0])
				}
				return
			},
		},
	}

}

type SecretUiClient struct {
	Cli GenericClient
}

func (c SecretUiClient) GetSecret(__arg GetSecretArg) (res SecretEntryRes, err error) {
	err = c.Cli.Call("keybase.1.secretUi.getSecret", []interface{}{__arg}, &res)
	return
}

func (c SecretUiClient) GetNewPassphrase(__arg GetNewPassphraseArg) (res GetNewPassphraseRes, err error) {
	err = c.Cli.Call("keybase.1.secretUi.getNewPassphrase", []interface{}{__arg}, &res)
	return
}

func (c SecretUiClient) GetKeybasePassphrase(__arg GetKeybasePassphraseArg) (res string, err error) {
	err = c.Cli.Call("keybase.1.secretUi.getKeybasePassphrase", []interface{}{__arg}, &res)
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

type SessionInterface interface {
	CurrentSession(int) (Session, error)
}

func SessionProtocol(i SessionInterface) rpc2.Protocol {
	return rpc2.Protocol{
		Name: "keybase.1.session",
		Methods: map[string]rpc2.ServeHook{
			"currentSession": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]CurrentSessionArg, 1)
				if err = nxt(&args); err == nil {
					ret, err = i.CurrentSession(args[0].SessionID)
				}
				return
			},
		},
	}

}

type SessionClient struct {
	Cli GenericClient
}

func (c SessionClient) CurrentSession(sessionID int) (res Session, err error) {
	__arg := CurrentSessionArg{SessionID: sessionID}
	err = c.Cli.Call("keybase.1.session.currentSession", []interface{}{__arg}, &res)
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
	SessionID  int    `codec:"sessionID" json:"sessionID"`
	Email      string `codec:"email" json:"email"`
	InviteCode string `codec:"inviteCode" json:"inviteCode"`
	Passphrase string `codec:"passphrase" json:"passphrase"`
	Username   string `codec:"username" json:"username"`
	DeviceName string `codec:"deviceName" json:"deviceName"`
}

type InviteRequestArg struct {
	SessionID int    `codec:"sessionID" json:"sessionID"`
	Email     string `codec:"email" json:"email"`
	Fullname  string `codec:"fullname" json:"fullname"`
	Notes     string `codec:"notes" json:"notes"`
}

type SignupInterface interface {
	CheckUsernameAvailable(CheckUsernameAvailableArg) error
	Signup(SignupArg) (SignupRes, error)
	InviteRequest(InviteRequestArg) error
}

func SignupProtocol(i SignupInterface) rpc2.Protocol {
	return rpc2.Protocol{
		Name: "keybase.1.signup",
		Methods: map[string]rpc2.ServeHook{
			"checkUsernameAvailable": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]CheckUsernameAvailableArg, 1)
				if err = nxt(&args); err == nil {
					err = i.CheckUsernameAvailable(args[0])
				}
				return
			},
			"signup": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]SignupArg, 1)
				if err = nxt(&args); err == nil {
					ret, err = i.Signup(args[0])
				}
				return
			},
			"inviteRequest": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]InviteRequestArg, 1)
				if err = nxt(&args); err == nil {
					err = i.InviteRequest(args[0])
				}
				return
			},
		},
	}

}

type SignupClient struct {
	Cli GenericClient
}

func (c SignupClient) CheckUsernameAvailable(__arg CheckUsernameAvailableArg) (err error) {
	err = c.Cli.Call("keybase.1.signup.checkUsernameAvailable", []interface{}{__arg}, nil)
	return
}

func (c SignupClient) Signup(__arg SignupArg) (res SignupRes, err error) {
	err = c.Cli.Call("keybase.1.signup.signup", []interface{}{__arg}, &res)
	return
}

func (c SignupClient) InviteRequest(__arg InviteRequestArg) (err error) {
	err = c.Cli.Call("keybase.1.signup.inviteRequest", []interface{}{__arg}, nil)
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
	SigList(SigListArg) ([]Sig, error)
	SigListJSON(SigListJSONArg) (string, error)
}

func SigsProtocol(i SigsInterface) rpc2.Protocol {
	return rpc2.Protocol{
		Name: "keybase.1.sigs",
		Methods: map[string]rpc2.ServeHook{
			"sigList": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]SigListArg, 1)
				if err = nxt(&args); err == nil {
					ret, err = i.SigList(args[0])
				}
				return
			},
			"sigListJSON": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]SigListJSONArg, 1)
				if err = nxt(&args); err == nil {
					ret, err = i.SigListJSON(args[0])
				}
				return
			},
		},
	}

}

type SigsClient struct {
	Cli GenericClient
}

func (c SigsClient) SigList(__arg SigListArg) (res []Sig, err error) {
	err = c.Cli.Call("keybase.1.sigs.sigList", []interface{}{__arg}, &res)
	return
}

func (c SigsClient) SigListJSON(__arg SigListJSONArg) (res string, err error) {
	err = c.Cli.Call("keybase.1.sigs.sigListJSON", []interface{}{__arg}, &res)
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
	Close(CloseArg) error
	Read(ReadArg) ([]byte, error)
	Write(WriteArg) (int, error)
}

func StreamUiProtocol(i StreamUiInterface) rpc2.Protocol {
	return rpc2.Protocol{
		Name: "keybase.1.streamUi",
		Methods: map[string]rpc2.ServeHook{
			"close": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]CloseArg, 1)
				if err = nxt(&args); err == nil {
					err = i.Close(args[0])
				}
				return
			},
			"read": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]ReadArg, 1)
				if err = nxt(&args); err == nil {
					ret, err = i.Read(args[0])
				}
				return
			},
			"write": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]WriteArg, 1)
				if err = nxt(&args); err == nil {
					ret, err = i.Write(args[0])
				}
				return
			},
		},
	}

}

type StreamUiClient struct {
	Cli GenericClient
}

func (c StreamUiClient) Close(__arg CloseArg) (err error) {
	err = c.Cli.Call("keybase.1.streamUi.close", []interface{}{__arg}, nil)
	return
}

func (c StreamUiClient) Read(__arg ReadArg) (res []byte, err error) {
	err = c.Cli.Call("keybase.1.streamUi.read", []interface{}{__arg}, &res)
	return
}

func (c StreamUiClient) Write(__arg WriteArg) (res int, err error) {
	err = c.Cli.Call("keybase.1.streamUi.write", []interface{}{__arg}, &res)
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
	Track(TrackArg) error
	TrackWithToken(TrackWithTokenArg) error
	Untrack(UntrackArg) error
}

func TrackProtocol(i TrackInterface) rpc2.Protocol {
	return rpc2.Protocol{
		Name: "keybase.1.track",
		Methods: map[string]rpc2.ServeHook{
			"track": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]TrackArg, 1)
				if err = nxt(&args); err == nil {
					err = i.Track(args[0])
				}
				return
			},
			"trackWithToken": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]TrackWithTokenArg, 1)
				if err = nxt(&args); err == nil {
					err = i.TrackWithToken(args[0])
				}
				return
			},
			"untrack": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]UntrackArg, 1)
				if err = nxt(&args); err == nil {
					err = i.Untrack(args[0])
				}
				return
			},
		},
	}

}

type TrackClient struct {
	Cli GenericClient
}

func (c TrackClient) Track(__arg TrackArg) (err error) {
	err = c.Cli.Call("keybase.1.track.track", []interface{}{__arg}, nil)
	return
}

func (c TrackClient) TrackWithToken(__arg TrackWithTokenArg) (err error) {
	err = c.Cli.Call("keybase.1.track.trackWithToken", []interface{}{__arg}, nil)
	return
}

func (c TrackClient) Untrack(__arg UntrackArg) (err error) {
	err = c.Cli.Call("keybase.1.track.untrack", []interface{}{__arg}, nil)
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
	PromptYesNo(PromptYesNoArg) (bool, error)
}

func UiProtocol(i UiInterface) rpc2.Protocol {
	return rpc2.Protocol{
		Name: "keybase.1.ui",
		Methods: map[string]rpc2.ServeHook{
			"promptYesNo": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]PromptYesNoArg, 1)
				if err = nxt(&args); err == nil {
					ret, err = i.PromptYesNo(args[0])
				}
				return
			},
		},
	}

}

type UiClient struct {
	Cli GenericClient
}

func (c UiClient) PromptYesNo(__arg PromptYesNoArg) (res bool, err error) {
	err = c.Cli.Call("keybase.1.ui.promptYesNo", []interface{}{__arg}, &res)
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
	SessionID int    `codec:"sessionID" json:"sessionID"`
	Uid       *UID   `codec:"uid,omitempty" json:"uid,omitempty"`
	Username  string `codec:"username" json:"username"`
	IsSelf    bool   `codec:"isSelf" json:"isSelf"`
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
	ListTrackers(ListTrackersArg) ([]Tracker, error)
	ListTrackersByName(ListTrackersByNameArg) ([]Tracker, error)
	ListTrackersSelf(int) ([]Tracker, error)
	LoadUncheckedUserSummaries(LoadUncheckedUserSummariesArg) ([]UserSummary, error)
	LoadUser(LoadUserArg) (User, error)
	ListTracking(ListTrackingArg) ([]UserSummary, error)
	ListTrackingJSON(ListTrackingJSONArg) (string, error)
	Search(SearchArg) ([]UserSummary, error)
}

func UserProtocol(i UserInterface) rpc2.Protocol {
	return rpc2.Protocol{
		Name: "keybase.1.user",
		Methods: map[string]rpc2.ServeHook{
			"listTrackers": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]ListTrackersArg, 1)
				if err = nxt(&args); err == nil {
					ret, err = i.ListTrackers(args[0])
				}
				return
			},
			"listTrackersByName": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]ListTrackersByNameArg, 1)
				if err = nxt(&args); err == nil {
					ret, err = i.ListTrackersByName(args[0])
				}
				return
			},
			"listTrackersSelf": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]ListTrackersSelfArg, 1)
				if err = nxt(&args); err == nil {
					ret, err = i.ListTrackersSelf(args[0].SessionID)
				}
				return
			},
			"loadUncheckedUserSummaries": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]LoadUncheckedUserSummariesArg, 1)
				if err = nxt(&args); err == nil {
					ret, err = i.LoadUncheckedUserSummaries(args[0])
				}
				return
			},
			"loadUser": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]LoadUserArg, 1)
				if err = nxt(&args); err == nil {
					ret, err = i.LoadUser(args[0])
				}
				return
			},
			"listTracking": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]ListTrackingArg, 1)
				if err = nxt(&args); err == nil {
					ret, err = i.ListTracking(args[0])
				}
				return
			},
			"listTrackingJSON": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]ListTrackingJSONArg, 1)
				if err = nxt(&args); err == nil {
					ret, err = i.ListTrackingJSON(args[0])
				}
				return
			},
			"search": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]SearchArg, 1)
				if err = nxt(&args); err == nil {
					ret, err = i.Search(args[0])
				}
				return
			},
		},
	}

}

type UserClient struct {
	Cli GenericClient
}

func (c UserClient) ListTrackers(__arg ListTrackersArg) (res []Tracker, err error) {
	err = c.Cli.Call("keybase.1.user.listTrackers", []interface{}{__arg}, &res)
	return
}

func (c UserClient) ListTrackersByName(__arg ListTrackersByNameArg) (res []Tracker, err error) {
	err = c.Cli.Call("keybase.1.user.listTrackersByName", []interface{}{__arg}, &res)
	return
}

func (c UserClient) ListTrackersSelf(sessionID int) (res []Tracker, err error) {
	__arg := ListTrackersSelfArg{SessionID: sessionID}
	err = c.Cli.Call("keybase.1.user.listTrackersSelf", []interface{}{__arg}, &res)
	return
}

func (c UserClient) LoadUncheckedUserSummaries(__arg LoadUncheckedUserSummariesArg) (res []UserSummary, err error) {
	err = c.Cli.Call("keybase.1.user.loadUncheckedUserSummaries", []interface{}{__arg}, &res)
	return
}

func (c UserClient) LoadUser(__arg LoadUserArg) (res User, err error) {
	err = c.Cli.Call("keybase.1.user.loadUser", []interface{}{__arg}, &res)
	return
}

func (c UserClient) ListTracking(__arg ListTrackingArg) (res []UserSummary, err error) {
	err = c.Cli.Call("keybase.1.user.listTracking", []interface{}{__arg}, &res)
	return
}

func (c UserClient) ListTrackingJSON(__arg ListTrackingJSONArg) (res string, err error) {
	err = c.Cli.Call("keybase.1.user.listTrackingJSON", []interface{}{__arg}, &res)
	return
}

func (c UserClient) Search(__arg SearchArg) (res []UserSummary, err error) {
	err = c.Cli.Call("keybase.1.user.search", []interface{}{__arg}, &res)
	return
}
