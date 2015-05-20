package keybase1

import (
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
)

type GenericClient interface {
	Call(s string, args interface{}, res interface{}) error
}

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

type UID [16]byte
type FOKID struct {
	PgpFingerprint *[]byte `codec:"pgpFingerprint,omitempty" json:"pgpFingerprint"`
	Kid            *[]byte `codec:"kid,omitempty" json:"kid"`
}

type Text struct {
	Data   string `codec:"data" json:"data"`
	Markup bool   `codec:"markup" json:"markup"`
}

type PgpIdentity struct {
	Username string `codec:"username" json:"username"`
	Comment  string `codec:"comment" json:"comment"`
	Email    string `codec:"email" json:"email"`
}

type Image struct {
	Url    string `codec:"url" json:"url"`
	Width  int    `codec:"width" json:"width"`
	Height int    `codec:"height" json:"height"`
}

type PublicKey struct {
	KID               string        `codec:"KID" json:"KID"`
	PGPFingerprint    string        `codec:"PGPFingerprint" json:"PGPFingerprint"`
	PGPIdentities     []PgpIdentity `codec:"PGPIdentities" json:"PGPIdentities"`
	IsSibkey          bool          `codec:"isSibkey" json:"isSibkey"`
	IsEldest          bool          `codec:"isEldest" json:"isEldest"`
	IsWeb             bool          `codec:"isWeb" json:"isWeb"`
	ParentID          string        `codec:"parentID" json:"parentID"`
	DeviceID          string        `codec:"deviceID" json:"deviceID"`
	DeviceDescription string        `codec:"deviceDescription" json:"deviceDescription"`
	CTime             int64         `codec:"cTime" json:"cTime"`
	ETime             int64         `codec:"eTime" json:"eTime"`
}

type User struct {
	Uid        UID         `codec:"uid" json:"uid"`
	Username   string      `codec:"username" json:"username"`
	Image      *Image      `codec:"image,omitempty" json:"image"`
	PublicKeys []PublicKey `codec:"publicKeys" json:"publicKeys"`
}

type Device struct {
	Type     string `codec:"type" json:"type"`
	Name     string `codec:"name" json:"name"`
	DeviceID string `codec:"deviceID" json:"deviceID"`
}

type Stream struct {
	Fd int `codec:"fd" json:"fd"`
}

type SIGID [32]byte
type BlockIdCombo struct {
	BlockId []byte `codec:"blockId" json:"blockId"`
	Size    int    `codec:"size" json:"size"`
}

type BlockInfo struct {
	ChargedTo UID    `codec:"chargedTo" json:"chargedTo"`
	Folder    []byte `codec:"folder" json:"folder"`
	SKey      []byte `codec:"sKey" json:"sKey"`
	Nonce     []byte `codec:"nonce" json:"nonce"`
}

type BIndexSessionArg struct {
	Sid string `codec:"sid" json:"sid"`
}

type GetBIndexSKeyArg struct {
	Bid BlockIdCombo `codec:"bid" json:"bid"`
}

type PutBIndexArg struct {
	Bid  BlockIdCombo `codec:"bid" json:"bid"`
	Info BlockInfo    `codec:"info" json:"info"`
}

type DecBIndexReferenceArg struct {
	Bid       BlockIdCombo `codec:"bid" json:"bid"`
	Nonce     []byte       `codec:"nonce" json:"nonce"`
	ChargedTo UID          `codec:"chargedTo" json:"chargedTo"`
}

type IncBIndexReferenceArg struct {
	Bid       BlockIdCombo `codec:"bid" json:"bid"`
	Nonce     []byte       `codec:"nonce" json:"nonce"`
	ChargedTo UID          `codec:"chargedTo" json:"chargedTo"`
}

type GetBIndexAllArg struct {
	Bid BlockIdCombo `codec:"bid" json:"bid"`
}

type BIndexInterface interface {
	BIndexSession(string) error
	GetBIndexSKey(BlockIdCombo) ([]byte, error)
	PutBIndex(PutBIndexArg) error
	DecBIndexReference(DecBIndexReferenceArg) error
	IncBIndexReference(IncBIndexReferenceArg) error
	GetBIndexAll(BlockIdCombo) ([]StringKVPair, error)
}

func BIndexProtocol(i BIndexInterface) rpc2.Protocol {
	return rpc2.Protocol{
		Name: "keybase.1.bIndex",
		Methods: map[string]rpc2.ServeHook{
			"bIndexSession": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]BIndexSessionArg, 1)
				if err = nxt(&args); err == nil {
					err = i.BIndexSession(args[0].Sid)
				}
				return
			},
			"getBIndexSKey": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]GetBIndexSKeyArg, 1)
				if err = nxt(&args); err == nil {
					ret, err = i.GetBIndexSKey(args[0].Bid)
				}
				return
			},
			"putBIndex": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]PutBIndexArg, 1)
				if err = nxt(&args); err == nil {
					err = i.PutBIndex(args[0])
				}
				return
			},
			"decBIndexReference": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]DecBIndexReferenceArg, 1)
				if err = nxt(&args); err == nil {
					err = i.DecBIndexReference(args[0])
				}
				return
			},
			"incBIndexReference": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]IncBIndexReferenceArg, 1)
				if err = nxt(&args); err == nil {
					err = i.IncBIndexReference(args[0])
				}
				return
			},
			"getBIndexAll": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]GetBIndexAllArg, 1)
				if err = nxt(&args); err == nil {
					ret, err = i.GetBIndexAll(args[0].Bid)
				}
				return
			},
		},
	}

}

type BIndexClient struct {
	Cli GenericClient
}

func (c BIndexClient) BIndexSession(sid string) (err error) {
	__arg := BIndexSessionArg{Sid: sid}
	err = c.Cli.Call("keybase.1.bIndex.bIndexSession", []interface{}{__arg}, nil)
	return
}

func (c BIndexClient) GetBIndexSKey(bid BlockIdCombo) (res []byte, err error) {
	__arg := GetBIndexSKeyArg{Bid: bid}
	err = c.Cli.Call("keybase.1.bIndex.getBIndexSKey", []interface{}{__arg}, &res)
	return
}

func (c BIndexClient) PutBIndex(__arg PutBIndexArg) (err error) {
	err = c.Cli.Call("keybase.1.bIndex.putBIndex", []interface{}{__arg}, nil)
	return
}

func (c BIndexClient) DecBIndexReference(__arg DecBIndexReferenceArg) (err error) {
	err = c.Cli.Call("keybase.1.bIndex.decBIndexReference", []interface{}{__arg}, nil)
	return
}

func (c BIndexClient) IncBIndexReference(__arg IncBIndexReferenceArg) (err error) {
	err = c.Cli.Call("keybase.1.bIndex.incBIndexReference", []interface{}{__arg}, nil)
	return
}

func (c BIndexClient) GetBIndexAll(bid BlockIdCombo) (res []StringKVPair, err error) {
	__arg := GetBIndexAllArg{Bid: bid}
	err = c.Cli.Call("keybase.1.bIndex.getBIndexAll", []interface{}{__arg}, &res)
	return
}

type BlockCharge struct {
	Bid BlockIdCombo `codec:"bid" json:"bid"`
	Uid UID          `codec:"uid" json:"uid"`
}

type BlockSessionArg struct {
	Sid string `codec:"sid" json:"sid"`
}

type GetBlockArg struct {
	Bid BlockIdCombo `codec:"bid" json:"bid"`
}

type PutBlockArg struct {
	Bid BlockIdCombo `codec:"bid" json:"bid"`
	Buf []byte       `codec:"buf" json:"buf"`
}

type BlockInterface interface {
	BlockSession(string) error
	GetBlock(BlockIdCombo) ([]byte, error)
	PutBlock(PutBlockArg) error
}

func BlockProtocol(i BlockInterface) rpc2.Protocol {
	return rpc2.Protocol{
		Name: "keybase.1.block",
		Methods: map[string]rpc2.ServeHook{
			"blockSession": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]BlockSessionArg, 1)
				if err = nxt(&args); err == nil {
					err = i.BlockSession(args[0].Sid)
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
			"putBlock": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]PutBlockArg, 1)
				if err = nxt(&args); err == nil {
					err = i.PutBlock(args[0])
				}
				return
			},
		},
	}

}

type BlockClient struct {
	Cli GenericClient
}

func (c BlockClient) BlockSession(sid string) (err error) {
	__arg := BlockSessionArg{Sid: sid}
	err = c.Cli.Call("keybase.1.block.blockSession", []interface{}{__arg}, nil)
	return
}

func (c BlockClient) GetBlock(bid BlockIdCombo) (res []byte, err error) {
	__arg := GetBlockArg{Bid: bid}
	err = c.Cli.Call("keybase.1.block.getBlock", []interface{}{__arg}, &res)
	return
}

func (c BlockClient) PutBlock(__arg PutBlockArg) (err error) {
	err = c.Cli.Call("keybase.1.block.putBlock", []interface{}{__arg}, nil)
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
	User       *User `codec:"user,omitempty" json:"user"`
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
}

type GetConfigArg struct {
}

type ConfigInterface interface {
	GetCurrentStatus() (GetCurrentStatusRes, error)
	GetConfig() (Config, error)
}

func ConfigProtocol(i ConfigInterface) rpc2.Protocol {
	return rpc2.Protocol{
		Name: "keybase.1.config",
		Methods: map[string]rpc2.ServeHook{
			"getCurrentStatus": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]GetCurrentStatusArg, 1)
				if err = nxt(&args); err == nil {
					ret, err = i.GetCurrentStatus()
				}
				return
			},
			"getConfig": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]GetConfigArg, 1)
				if err = nxt(&args); err == nil {
					ret, err = i.GetConfig()
				}
				return
			},
		},
	}

}

type ConfigClient struct {
	Cli GenericClient
}

func (c ConfigClient) GetCurrentStatus() (res GetCurrentStatusRes, err error) {
	err = c.Cli.Call("keybase.1.config.getCurrentStatus", []interface{}{GetCurrentStatusArg{}}, &res)
	return
}

func (c ConfigClient) GetConfig() (res Config, err error) {
	err = c.Cli.Call("keybase.1.config.getConfig", []interface{}{GetConfigArg{}}, &res)
	return
}

type SignatureInfo struct {
	Sig             []byte `codec:"sig" json:"sig"`
	VerifyingKeyKid string `codec:"verifyingKeyKid" json:"verifyingKeyKid"`
}

type SignArg struct {
	SessionID int    `codec:"sessionID" json:"sessionID"`
	Msg       []byte `codec:"msg" json:"msg"`
	Reason    string `codec:"reason" json:"reason"`
}

type CryptoInterface interface {
	Sign(SignArg) (SignatureInfo, error)
}

func CryptoProtocol(i CryptoInterface) rpc2.Protocol {
	return rpc2.Protocol{
		Name: "keybase.1.crypto",
		Methods: map[string]rpc2.ServeHook{
			"sign": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]SignArg, 1)
				if err = nxt(&args); err == nil {
					ret, err = i.Sign(args[0])
				}
				return
			},
		},
	}

}

type CryptoClient struct {
	Cli GenericClient
}

func (c CryptoClient) Sign(__arg SignArg) (res SignatureInfo, err error) {
	err = c.Cli.Call("keybase.1.crypto.sign", []interface{}{__arg}, &res)
	return
}

type StopArg struct {
}

type LogRotateArg struct {
}

type CtlInterface interface {
	Stop() error
	LogRotate() error
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

type DeviceInterface interface {
	DeviceList(int) ([]Device, error)
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
					ret, err = i.DeviceList(args[0].SessionID)
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

func (c DeviceClient) DeviceList(sessionID int) (res []Device, err error) {
	__arg := DeviceListArg{SessionID: sessionID}
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
	DoctorFixType_NONE               = 0
	DoctorFixType_ADD_ELDEST_DEVICE  = 1
	DoctorFixType_ADD_SIBLING_DEVICE = 2
)

type DoctorSignerOpts struct {
	OtherDevice bool `codec:"otherDevice" json:"otherDevice"`
	Pgp         bool `codec:"pgp" json:"pgp"`
	Internal    bool `codec:"internal" json:"internal"`
}

type DoctorStatus struct {
	Fix           DoctorFixType    `codec:"fix" json:"fix"`
	SignerOpts    DoctorSignerOpts `codec:"signerOpts" json:"signerOpts"`
	Devices       []Device         `codec:"devices" json:"devices"`
	WebDevice     *Device          `codec:"webDevice,omitempty" json:"webDevice"`
	CurrentDevice *Device          `codec:"currentDevice,omitempty" json:"currentDevice"`
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
	Algorithm  string   `codec:"algorithm" json:"algorithm"`
	KeyID      string   `codec:"keyID" json:"keyID"`
	Creation   string   `codec:"creation" json:"creation"`
	Expiration string   `codec:"expiration" json:"expiration"`
	Identities []string `codec:"identities" json:"identities"`
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

type TrackDiffType int

const (
	TrackDiffType_NONE           = 0
	TrackDiffType_ERROR          = 1
	TrackDiffType_CLASH          = 2
	TrackDiffType_DELETED        = 3
	TrackDiffType_UPGRADED       = 4
	TrackDiffType_NEW            = 5
	TrackDiffType_REMOTE_FAIL    = 6
	TrackDiffType_REMOTE_WORKING = 7
	TrackDiffType_REMOTE_CHANGED = 8
)

type TrackDiff struct {
	Type          TrackDiffType `codec:"type" json:"type"`
	DisplayMarkup string        `codec:"displayMarkup" json:"displayMarkup"`
}

type TrackSummary struct {
	Username string `codec:"username" json:"username"`
	Time     int    `codec:"time" json:"time"`
	IsRemote bool   `codec:"isRemote" json:"isRemote"`
}

type IdentifyOutcome struct {
	Username          string        `codec:"username" json:"username"`
	Status            *Status       `codec:"status,omitempty" json:"status"`
	Warnings          []string      `codec:"warnings" json:"warnings"`
	TrackUsed         *TrackSummary `codec:"trackUsed,omitempty" json:"trackUsed"`
	NumTrackFailures  int           `codec:"numTrackFailures" json:"numTrackFailures"`
	NumTrackChanges   int           `codec:"numTrackChanges" json:"numTrackChanges"`
	NumProofFailures  int           `codec:"numProofFailures" json:"numProofFailures"`
	NumDeleted        int           `codec:"numDeleted" json:"numDeleted"`
	NumProofSuccesses int           `codec:"numProofSuccesses" json:"numProofSuccesses"`
	Deleted           []TrackDiff   `codec:"deleted" json:"deleted"`
	LocalOnly         bool          `codec:"localOnly" json:"localOnly"`
	ApproveRemote     bool          `codec:"approveRemote" json:"approveRemote"`
}

type IdentifyRes struct {
	User    *User           `codec:"user,omitempty" json:"user"`
	Outcome IdentifyOutcome `codec:"outcome" json:"outcome"`
}

type RemoteProof struct {
	ProofType     int    `codec:"proofType" json:"proofType"`
	Key           string `codec:"key" json:"key"`
	Value         string `codec:"value" json:"value"`
	DisplayMarkup string `codec:"displayMarkup" json:"displayMarkup"`
	SigID         string `codec:"sigID" json:"sigID"`
	Mtime         int    `codec:"mtime" json:"mtime"`
}

type IdentifyArg struct {
	SessionID      int    `codec:"sessionID" json:"sessionID"`
	UserAssertion  string `codec:"userAssertion" json:"userAssertion"`
	TrackStatement bool   `codec:"trackStatement" json:"trackStatement"`
}

type IdentifyDefaultArg struct {
	SessionID     int    `codec:"sessionID" json:"sessionID"`
	UserAssertion string `codec:"userAssertion" json:"userAssertion"`
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

type ProofStatus struct {
	State  int    `codec:"state" json:"state"`
	Status int    `codec:"status" json:"status"`
	Desc   string `codec:"desc" json:"desc"`
}

type IdentifyRow struct {
	RowId     int         `codec:"rowId" json:"rowId"`
	Proof     RemoteProof `codec:"proof" json:"proof"`
	TrackDiff *TrackDiff  `codec:"trackDiff,omitempty" json:"trackDiff"`
}

type IdentifyKey struct {
	PgpFingerprint []byte     `codec:"pgpFingerprint" json:"pgpFingerprint"`
	KID            []byte     `codec:"KID" json:"KID"`
	TrackDiff      *TrackDiff `codec:"trackDiff,omitempty" json:"trackDiff"`
}

type Cryptocurrency struct {
	RowId   int    `codec:"rowId" json:"rowId"`
	Pkhash  []byte `codec:"pkhash" json:"pkhash"`
	Address string `codec:"address" json:"address"`
}

type Identity struct {
	Status          *Status          `codec:"status,omitempty" json:"status"`
	WhenLastTracked int              `codec:"whenLastTracked" json:"whenLastTracked"`
	Keys            []IdentifyKey    `codec:"keys" json:"keys"`
	Proofs          []IdentifyRow    `codec:"proofs" json:"proofs"`
	Cryptocurrency  []Cryptocurrency `codec:"cryptocurrency" json:"cryptocurrency"`
	Deleted         []TrackDiff      `codec:"deleted" json:"deleted"`
}

type SigHint struct {
	RemoteId  string `codec:"remoteId" json:"remoteId"`
	HumanUrl  string `codec:"humanUrl" json:"humanUrl"`
	ApiUrl    string `codec:"apiUrl" json:"apiUrl"`
	CheckText string `codec:"checkText" json:"checkText"`
}

type CheckResult struct {
	ProofStatus   ProofStatus `codec:"proofStatus" json:"proofStatus"`
	Timestamp     int         `codec:"timestamp" json:"timestamp"`
	DisplayMarkup string      `codec:"displayMarkup" json:"displayMarkup"`
}

type LinkCheckResult struct {
	ProofId     int          `codec:"proofId" json:"proofId"`
	ProofStatus ProofStatus  `codec:"proofStatus" json:"proofStatus"`
	Cached      *CheckResult `codec:"cached,omitempty" json:"cached"`
	Diff        *TrackDiff   `codec:"diff,omitempty" json:"diff"`
	RemoteDiff  *TrackDiff   `codec:"remoteDiff,omitempty" json:"remoteDiff"`
	Hint        *SigHint     `codec:"hint,omitempty" json:"hint"`
}

type FinishAndPromptRes struct {
	TrackLocal  bool `codec:"trackLocal" json:"trackLocal"`
	TrackRemote bool `codec:"trackRemote" json:"trackRemote"`
}

type FinishAndPromptArg struct {
	SessionID int             `codec:"sessionID" json:"sessionID"`
	Outcome   IdentifyOutcome `codec:"outcome" json:"outcome"`
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

type DisplayKeyArg struct {
	SessionID int        `codec:"sessionID" json:"sessionID"`
	Fokid     FOKID      `codec:"fokid" json:"fokid"`
	Diff      *TrackDiff `codec:"diff,omitempty" json:"diff"`
}

type ReportLastTrackArg struct {
	SessionID int           `codec:"sessionID" json:"sessionID"`
	Track     *TrackSummary `codec:"track,omitempty" json:"track"`
}

type LaunchNetworkChecksArg struct {
	SessionID int      `codec:"sessionID" json:"sessionID"`
	Id        Identity `codec:"id" json:"id"`
	User      User     `codec:"user" json:"user"`
}

type DisplayTrackStatementArg struct {
	SessionID int    `codec:"sessionID" json:"sessionID"`
	Stmt      string `codec:"stmt" json:"stmt"`
}

type StartArg struct {
	SessionID int    `codec:"sessionID" json:"sessionID"`
	Username  string `codec:"username" json:"username"`
}

type FinishArg struct {
	SessionID int `codec:"sessionID" json:"sessionID"`
}

type IdentifyUiInterface interface {
	FinishAndPrompt(FinishAndPromptArg) (FinishAndPromptRes, error)
	FinishWebProofCheck(FinishWebProofCheckArg) error
	FinishSocialProofCheck(FinishSocialProofCheckArg) error
	DisplayCryptocurrency(DisplayCryptocurrencyArg) error
	DisplayKey(DisplayKeyArg) error
	ReportLastTrack(ReportLastTrackArg) error
	LaunchNetworkChecks(LaunchNetworkChecksArg) error
	DisplayTrackStatement(DisplayTrackStatementArg) error
	Start(StartArg) error
	Finish(int) error
}

func IdentifyUiProtocol(i IdentifyUiInterface) rpc2.Protocol {
	return rpc2.Protocol{
		Name: "keybase.1.identifyUi",
		Methods: map[string]rpc2.ServeHook{
			"finishAndPrompt": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]FinishAndPromptArg, 1)
				if err = nxt(&args); err == nil {
					ret, err = i.FinishAndPrompt(args[0])
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
			"start": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]StartArg, 1)
				if err = nxt(&args); err == nil {
					err = i.Start(args[0])
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

func (c IdentifyUiClient) FinishAndPrompt(__arg FinishAndPromptArg) (res FinishAndPromptRes, err error) {
	err = c.Cli.Call("keybase.1.identifyUi.finishAndPrompt", []interface{}{__arg}, &res)
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

func (c IdentifyUiClient) Start(__arg StartArg) (err error) {
	err = c.Cli.Call("keybase.1.identifyUi.start", []interface{}{__arg}, nil)
	return
}

func (c IdentifyUiClient) Finish(sessionID int) (err error) {
	__arg := FinishArg{SessionID: sessionID}
	err = c.Cli.Call("keybase.1.identifyUi.finish", []interface{}{__arg}, nil)
	return
}

type DeviceSignerKind int

const (
	DeviceSignerKind_DEVICE = 0
	DeviceSignerKind_PGP    = 1
)

type SelectSignerAction int

const (
	SelectSignerAction_SIGN          = 0
	SelectSignerAction_CANCEL        = 1
	SelectSignerAction_RESET_ACCOUNT = 2
)

type DeviceSigner struct {
	Kind       DeviceSignerKind `codec:"kind" json:"kind"`
	DeviceID   *string          `codec:"deviceID,omitempty" json:"deviceID"`
	DeviceName *string          `codec:"deviceName,omitempty" json:"deviceName"`
}

type SelectSignerRes struct {
	Action SelectSignerAction `codec:"action" json:"action"`
	Signer *DeviceSigner      `codec:"signer,omitempty" json:"signer"`
}

type KexStatusCode int

const (
	KexStatusCode_START_SEND           = 0
	KexStatusCode_HELLO_WAIT           = 1
	KexStatusCode_HELLO_RECEIVED       = 2
	KexStatusCode_PLEASE_SIGN_SEND     = 3
	KexStatusCode_DONE_WAIT            = 4
	KexStatusCode_DONE_RECEIVED        = 5
	KexStatusCode_START_WAIT           = 6
	KexStatusCode_START_RECEIVED       = 7
	KexStatusCode_HELLO_SEND           = 8
	KexStatusCode_PLEASE_SIGN_WAIT     = 9
	KexStatusCode_PLEASE_SIGN_RECEIVED = 10
	KexStatusCode_DONE_SEND            = 11
	KexStatusCode_END                  = 12
)

type PromptDeviceNameArg struct {
	SessionID int `codec:"sessionID" json:"sessionID"`
}

type SelectSignerArg struct {
	SessionID int      `codec:"sessionID" json:"sessionID"`
	Devices   []Device `codec:"devices" json:"devices"`
	HasPGP    bool     `codec:"hasPGP" json:"hasPGP"`
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
	LogLevel_NONE     = 0
	LogLevel_DEBUG    = 1
	LogLevel_INFO     = 2
	LogLevel_NOTICE   = 3
	LogLevel_WARN     = 4
	LogLevel_ERROR    = 5
	LogLevel_CRITICAL = 6
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
	Username string `codec:"username" json:"username"`
}

type CancelLoginArg struct {
	SessionID int `codec:"sessionID" json:"sessionID"`
}

type LogoutArg struct {
}

type ResetArg struct {
}

type LoginInterface interface {
	GetConfiguredAccounts() ([]ConfiguredAccount, error)
	LoginWithPrompt(LoginWithPromptArg) error
	LoginWithStoredSecret(LoginWithStoredSecretArg) error
	LoginWithPassphrase(LoginWithPassphraseArg) error
	ClearStoredSecret(string) error
	CancelLogin(int) error
	Logout() error
	Reset() error
}

func LoginProtocol(i LoginInterface) rpc2.Protocol {
	return rpc2.Protocol{
		Name: "keybase.1.login",
		Methods: map[string]rpc2.ServeHook{
			"getConfiguredAccounts": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]GetConfiguredAccountsArg, 1)
				if err = nxt(&args); err == nil {
					ret, err = i.GetConfiguredAccounts()
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
					err = i.ClearStoredSecret(args[0].Username)
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
					err = i.Logout()
				}
				return
			},
			"reset": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]ResetArg, 1)
				if err = nxt(&args); err == nil {
					err = i.Reset()
				}
				return
			},
		},
	}

}

type LoginClient struct {
	Cli GenericClient
}

func (c LoginClient) GetConfiguredAccounts() (res []ConfiguredAccount, err error) {
	err = c.Cli.Call("keybase.1.login.getConfiguredAccounts", []interface{}{GetConfiguredAccountsArg{}}, &res)
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

func (c LoginClient) ClearStoredSecret(username string) (err error) {
	__arg := ClearStoredSecretArg{Username: username}
	err = c.Cli.Call("keybase.1.login.clearStoredSecret", []interface{}{__arg}, nil)
	return
}

func (c LoginClient) CancelLogin(sessionID int) (err error) {
	__arg := CancelLoginArg{SessionID: sessionID}
	err = c.Cli.Call("keybase.1.login.cancelLogin", []interface{}{__arg}, nil)
	return
}

func (c LoginClient) Logout() (err error) {
	err = c.Cli.Call("keybase.1.login.logout", []interface{}{LogoutArg{}}, nil)
	return
}

func (c LoginClient) Reset() (err error) {
	err = c.Cli.Call("keybase.1.login.reset", []interface{}{ResetArg{}}, nil)
	return
}

type GetEmailOrUsernameArg struct {
	SessionID int `codec:"sessionID" json:"sessionID"`
}

type LoginUiInterface interface {
	GetEmailOrUsername(int) (string, error)
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

type SignMode int

const (
	SignMode_ATTACHED = 0
	SignMode_DETACHED = 1
	SignMode_CLEAR    = 2
)

type PgpSignOptions struct {
	KeyQuery  string   `codec:"keyQuery" json:"keyQuery"`
	Mode      SignMode `codec:"mode" json:"mode"`
	BinaryIn  bool     `codec:"binaryIn" json:"binaryIn"`
	BinaryOut bool     `codec:"binaryOut" json:"binaryOut"`
}

type PgpEncryptOptions struct {
	Recipients    []string `codec:"recipients" json:"recipients"`
	NoSign        bool     `codec:"noSign" json:"noSign"`
	NoSelf        bool     `codec:"noSelf" json:"noSelf"`
	BinaryOut     bool     `codec:"binaryOut" json:"binaryOut"`
	KeyQuery      string   `codec:"keyQuery" json:"keyQuery"`
	LocalOnly     bool     `codec:"localOnly" json:"localOnly"`
	ApproveRemote bool     `codec:"approveRemote" json:"approveRemote"`
}

type PgpSigVerification struct {
	IsSigned bool      `codec:"isSigned" json:"isSigned"`
	Verified bool      `codec:"verified" json:"verified"`
	Signer   User      `codec:"signer" json:"signer"`
	SignKey  PublicKey `codec:"signKey" json:"signKey"`
}

type PgpDecryptOptions struct {
	AssertSigned  bool   `codec:"assertSigned" json:"assertSigned"`
	SignedBy      string `codec:"signedBy" json:"signedBy"`
	LocalOnly     bool   `codec:"localOnly" json:"localOnly"`
	ApproveRemote bool   `codec:"approveRemote" json:"approveRemote"`
}

type PgpVerifyOptions struct {
	SignedBy      string `codec:"signedBy" json:"signedBy"`
	LocalOnly     bool   `codec:"localOnly" json:"localOnly"`
	ApproveRemote bool   `codec:"approveRemote" json:"approveRemote"`
	Signature     []byte `codec:"signature" json:"signature"`
}

type KeyInfo struct {
	Fingerprint string `codec:"fingerprint" json:"fingerprint"`
	Key         string `codec:"key" json:"key"`
	Desc        string `codec:"desc" json:"desc"`
}

type PgpCreateUids struct {
	UseDefault bool          `codec:"useDefault" json:"useDefault"`
	Ids        []PgpIdentity `codec:"ids" json:"ids"`
}

type PgpSignArg struct {
	SessionID int            `codec:"sessionID" json:"sessionID"`
	Source    Stream         `codec:"source" json:"source"`
	Sink      Stream         `codec:"sink" json:"sink"`
	Opts      PgpSignOptions `codec:"opts" json:"opts"`
}

type PgpPullArg struct {
	SessionID   int      `codec:"sessionID" json:"sessionID"`
	UserAsserts []string `codec:"userAsserts" json:"userAsserts"`
}

type PgpEncryptArg struct {
	SessionID int               `codec:"sessionID" json:"sessionID"`
	Source    Stream            `codec:"source" json:"source"`
	Sink      Stream            `codec:"sink" json:"sink"`
	Opts      PgpEncryptOptions `codec:"opts" json:"opts"`
}

type PgpDecryptArg struct {
	SessionID int               `codec:"sessionID" json:"sessionID"`
	Source    Stream            `codec:"source" json:"source"`
	Sink      Stream            `codec:"sink" json:"sink"`
	Opts      PgpDecryptOptions `codec:"opts" json:"opts"`
}

type PgpVerifyArg struct {
	SessionID int              `codec:"sessionID" json:"sessionID"`
	Source    Stream           `codec:"source" json:"source"`
	Opts      PgpVerifyOptions `codec:"opts" json:"opts"`
}

type PgpImportArg struct {
	SessionID  int    `codec:"sessionID" json:"sessionID"`
	Key        []byte `codec:"key" json:"key"`
	PushSecret bool   `codec:"pushSecret" json:"pushSecret"`
}

type PgpExportArg struct {
	SessionID int    `codec:"sessionID" json:"sessionID"`
	Secret    bool   `codec:"secret" json:"secret"`
	Query     string `codec:"query" json:"query"`
}

type PgpKeyGenArg struct {
	PrimaryBits int           `codec:"primaryBits" json:"primaryBits"`
	SubkeyBits  int           `codec:"subkeyBits" json:"subkeyBits"`
	CreateUids  PgpCreateUids `codec:"createUids" json:"createUids"`
	AllowMulti  bool          `codec:"allowMulti" json:"allowMulti"`
	DoExport    bool          `codec:"doExport" json:"doExport"`
}

type PgpKeyGenDefaultArg struct {
	CreateUids PgpCreateUids `codec:"createUids" json:"createUids"`
}

type PgpDeletePrimaryArg struct {
}

type PgpSelectArg struct {
	Query      string `codec:"query" json:"query"`
	AllowMulti bool   `codec:"allowMulti" json:"allowMulti"`
	SkipImport bool   `codec:"skipImport" json:"skipImport"`
}

type PgpUpdateArg struct {
	SessionID    int      `codec:"sessionID" json:"sessionID"`
	All          bool     `codec:"all" json:"all"`
	Fingerprints []string `codec:"fingerprints" json:"fingerprints"`
}

type PgpInterface interface {
	PgpSign(PgpSignArg) error
	PgpPull(PgpPullArg) error
	PgpEncrypt(PgpEncryptArg) error
	PgpDecrypt(PgpDecryptArg) (PgpSigVerification, error)
	PgpVerify(PgpVerifyArg) (PgpSigVerification, error)
	PgpImport(PgpImportArg) error
	PgpExport(PgpExportArg) ([]KeyInfo, error)
	PgpKeyGen(PgpKeyGenArg) error
	PgpKeyGenDefault(PgpCreateUids) error
	PgpDeletePrimary() error
	PgpSelect(PgpSelectArg) error
	PgpUpdate(PgpUpdateArg) error
}

func PgpProtocol(i PgpInterface) rpc2.Protocol {
	return rpc2.Protocol{
		Name: "keybase.1.pgp",
		Methods: map[string]rpc2.ServeHook{
			"pgpSign": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]PgpSignArg, 1)
				if err = nxt(&args); err == nil {
					err = i.PgpSign(args[0])
				}
				return
			},
			"pgpPull": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]PgpPullArg, 1)
				if err = nxt(&args); err == nil {
					err = i.PgpPull(args[0])
				}
				return
			},
			"pgpEncrypt": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]PgpEncryptArg, 1)
				if err = nxt(&args); err == nil {
					err = i.PgpEncrypt(args[0])
				}
				return
			},
			"pgpDecrypt": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]PgpDecryptArg, 1)
				if err = nxt(&args); err == nil {
					ret, err = i.PgpDecrypt(args[0])
				}
				return
			},
			"pgpVerify": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]PgpVerifyArg, 1)
				if err = nxt(&args); err == nil {
					ret, err = i.PgpVerify(args[0])
				}
				return
			},
			"pgpImport": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]PgpImportArg, 1)
				if err = nxt(&args); err == nil {
					err = i.PgpImport(args[0])
				}
				return
			},
			"pgpExport": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]PgpExportArg, 1)
				if err = nxt(&args); err == nil {
					ret, err = i.PgpExport(args[0])
				}
				return
			},
			"PgpKeyGen": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]PgpKeyGenArg, 1)
				if err = nxt(&args); err == nil {
					err = i.PgpKeyGen(args[0])
				}
				return
			},
			"pgpKeyGenDefault": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]PgpKeyGenDefaultArg, 1)
				if err = nxt(&args); err == nil {
					err = i.PgpKeyGenDefault(args[0].CreateUids)
				}
				return
			},
			"pgpDeletePrimary": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]PgpDeletePrimaryArg, 1)
				if err = nxt(&args); err == nil {
					err = i.PgpDeletePrimary()
				}
				return
			},
			"pgpSelect": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]PgpSelectArg, 1)
				if err = nxt(&args); err == nil {
					err = i.PgpSelect(args[0])
				}
				return
			},
			"pgpUpdate": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]PgpUpdateArg, 1)
				if err = nxt(&args); err == nil {
					err = i.PgpUpdate(args[0])
				}
				return
			},
		},
	}

}

type PgpClient struct {
	Cli GenericClient
}

func (c PgpClient) PgpSign(__arg PgpSignArg) (err error) {
	err = c.Cli.Call("keybase.1.pgp.pgpSign", []interface{}{__arg}, nil)
	return
}

func (c PgpClient) PgpPull(__arg PgpPullArg) (err error) {
	err = c.Cli.Call("keybase.1.pgp.pgpPull", []interface{}{__arg}, nil)
	return
}

func (c PgpClient) PgpEncrypt(__arg PgpEncryptArg) (err error) {
	err = c.Cli.Call("keybase.1.pgp.pgpEncrypt", []interface{}{__arg}, nil)
	return
}

func (c PgpClient) PgpDecrypt(__arg PgpDecryptArg) (res PgpSigVerification, err error) {
	err = c.Cli.Call("keybase.1.pgp.pgpDecrypt", []interface{}{__arg}, &res)
	return
}

func (c PgpClient) PgpVerify(__arg PgpVerifyArg) (res PgpSigVerification, err error) {
	err = c.Cli.Call("keybase.1.pgp.pgpVerify", []interface{}{__arg}, &res)
	return
}

func (c PgpClient) PgpImport(__arg PgpImportArg) (err error) {
	err = c.Cli.Call("keybase.1.pgp.pgpImport", []interface{}{__arg}, nil)
	return
}

func (c PgpClient) PgpExport(__arg PgpExportArg) (res []KeyInfo, err error) {
	err = c.Cli.Call("keybase.1.pgp.pgpExport", []interface{}{__arg}, &res)
	return
}

func (c PgpClient) PgpKeyGen(__arg PgpKeyGenArg) (err error) {
	err = c.Cli.Call("keybase.1.pgp.PgpKeyGen", []interface{}{__arg}, nil)
	return
}

func (c PgpClient) PgpKeyGenDefault(createUids PgpCreateUids) (err error) {
	__arg := PgpKeyGenDefaultArg{CreateUids: createUids}
	err = c.Cli.Call("keybase.1.pgp.pgpKeyGenDefault", []interface{}{__arg}, nil)
	return
}

func (c PgpClient) PgpDeletePrimary() (err error) {
	err = c.Cli.Call("keybase.1.pgp.pgpDeletePrimary", []interface{}{PgpDeletePrimaryArg{}}, nil)
	return
}

func (c PgpClient) PgpSelect(__arg PgpSelectArg) (err error) {
	err = c.Cli.Call("keybase.1.pgp.pgpSelect", []interface{}{__arg}, nil)
	return
}

func (c PgpClient) PgpUpdate(__arg PgpUpdateArg) (err error) {
	err = c.Cli.Call("keybase.1.pgp.pgpUpdate", []interface{}{__arg}, nil)
	return
}

type CheckProofStatus struct {
	Found  bool `codec:"found" json:"found"`
	Status int  `codec:"status" json:"status"`
}

type StartProofArg struct {
	SessionID    int    `codec:"sessionID" json:"sessionID"`
	Service      string `codec:"service" json:"service"`
	Username     string `codec:"username" json:"username"`
	Force        bool   `codec:"force" json:"force"`
	PromptPosted bool   `codec:"promptPosted" json:"promptPosted"`
}

type CheckProofArg struct {
	SessionID int    `codec:"sessionID" json:"sessionID"`
	SigID     string `codec:"sigID" json:"sigID"`
}

type ProveInterface interface {
	StartProof(StartProofArg) error
	CheckProof(CheckProofArg) (CheckProofStatus, error)
}

func ProveProtocol(i ProveInterface) rpc2.Protocol {
	return rpc2.Protocol{
		Name: "keybase.1.prove",
		Methods: map[string]rpc2.ServeHook{
			"startProof": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]StartProofArg, 1)
				if err = nxt(&args); err == nil {
					err = i.StartProof(args[0])
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

func (c ProveClient) StartProof(__arg StartProofArg) (err error) {
	err = c.Cli.Call("keybase.1.prove.startProof", []interface{}{__arg}, nil)
	return
}

func (c ProveClient) CheckProof(__arg CheckProofArg) (res CheckProofStatus, err error) {
	err = c.Cli.Call("keybase.1.prove.checkProof", []interface{}{__arg}, &res)
	return
}

type PromptOverwriteType int

const (
	PromptOverwriteType_SOCIAL = 0
	PromptOverwriteType_SITE   = 1
)

type PromptOverwriteArg struct {
	SessionID int                 `codec:"sessionID" json:"sessionID"`
	Account   string              `codec:"account" json:"account"`
	Typ       PromptOverwriteType `codec:"typ" json:"typ"`
}

type PromptUsernameArg struct {
	SessionID int     `codec:"sessionID" json:"sessionID"`
	Prompt    string  `codec:"prompt" json:"prompt"`
	PrevError *Status `codec:"prevError,omitempty" json:"prevError"`
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
	Id        string `codec:"id" json:"id"`
}

type RevokeDeviceArg struct {
	SessionID int    `codec:"sessionID" json:"sessionID"`
	Id        string `codec:"id" json:"id"`
}

type RevokeSigsArg struct {
	SessionID int      `codec:"sessionID" json:"sessionID"`
	Ids       []string `codec:"ids" json:"ids"`
	Seqnos    []int    `codec:"seqnos" json:"seqnos"`
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

type GetSecretArg struct {
	SessionID int             `codec:"sessionID" json:"sessionID"`
	Pinentry  SecretEntryArg  `codec:"pinentry" json:"pinentry"`
	Terminal  *SecretEntryArg `codec:"terminal,omitempty" json:"terminal"`
}

type GetNewPassphraseArg struct {
	TerminalPrompt string `codec:"terminalPrompt" json:"terminalPrompt"`
	PinentryDesc   string `codec:"pinentryDesc" json:"pinentryDesc"`
	PinentryPrompt string `codec:"pinentryPrompt" json:"pinentryPrompt"`
	RetryMessage   string `codec:"retryMessage" json:"retryMessage"`
}

type GetKeybasePassphraseArg struct {
	SessionID int    `codec:"sessionID" json:"sessionID"`
	Username  string `codec:"username" json:"username"`
	Retry     string `codec:"retry" json:"retry"`
}

type SecretUiInterface interface {
	GetSecret(GetSecretArg) (SecretEntryRes, error)
	GetNewPassphrase(GetNewPassphraseArg) (string, error)
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

func (c SecretUiClient) GetNewPassphrase(__arg GetNewPassphraseArg) (res string, err error) {
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
	DeviceSubkeyKid string `codec:"deviceSubkeyKid" json:"deviceSubkeyKid"`
}

type CurrentSessionArg struct {
}

type SessionInterface interface {
	CurrentSession() (Session, error)
}

func SessionProtocol(i SessionInterface) rpc2.Protocol {
	return rpc2.Protocol{
		Name: "keybase.1.session",
		Methods: map[string]rpc2.ServeHook{
			"currentSession": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]CurrentSessionArg, 1)
				if err = nxt(&args); err == nil {
					ret, err = i.CurrentSession()
				}
				return
			},
		},
	}

}

type SessionClient struct {
	Cli GenericClient
}

func (c SessionClient) CurrentSession() (res Session, err error) {
	err = c.Cli.Call("keybase.1.session.currentSession", []interface{}{CurrentSessionArg{}}, &res)
	return
}

type SignupRes struct {
	PassphraseOk bool `codec:"passphraseOk" json:"passphraseOk"`
	PostOk       bool `codec:"postOk" json:"postOk"`
	WriteOk      bool `codec:"writeOk" json:"writeOk"`
}

type CheckUsernameAvailableArg struct {
	Username string `codec:"username" json:"username"`
}

type SignupArg struct {
	Email      string `codec:"email" json:"email"`
	InviteCode string `codec:"inviteCode" json:"inviteCode"`
	Passphrase string `codec:"passphrase" json:"passphrase"`
	Username   string `codec:"username" json:"username"`
	DeviceName string `codec:"deviceName" json:"deviceName"`
}

type InviteRequestArg struct {
	Email    string `codec:"email" json:"email"`
	Fullname string `codec:"fullname" json:"fullname"`
	Notes    string `codec:"notes" json:"notes"`
}

type SignupInterface interface {
	CheckUsernameAvailable(string) error
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
					err = i.CheckUsernameAvailable(args[0].Username)
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

func (c SignupClient) CheckUsernameAvailable(username string) (err error) {
	__arg := CheckUsernameAvailableArg{Username: username}
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
	SigIdDisplay string `codec:"sigIdDisplay" json:"sigIdDisplay"`
	Type         string `codec:"type" json:"type"`
	Ctime        int    `codec:"ctime" json:"ctime"`
	Revoked      bool   `codec:"revoked" json:"revoked"`
	Active       bool   `codec:"active" json:"active"`
	Key          string `codec:"key" json:"key"`
	Body         string `codec:"body" json:"body"`
}

type SigTypes struct {
	Track          bool `codec:"track" json:"track"`
	Proof          bool `codec:"proof" json:"proof"`
	Cryptocurrency bool `codec:"cryptocurrency" json:"cryptocurrency"`
	Self           bool `codec:"self" json:"self"`
}

type SigListArgs struct {
	SessionID int       `codec:"sessionID" json:"sessionID"`
	Username  string    `codec:"username" json:"username"`
	AllKeys   bool      `codec:"allKeys" json:"allKeys"`
	Types     *SigTypes `codec:"types,omitempty" json:"types"`
	Filterx   string    `codec:"filterx" json:"filterx"`
	Verbose   bool      `codec:"verbose" json:"verbose"`
	Revoked   bool      `codec:"revoked" json:"revoked"`
}

type SigListArg struct {
	Arg SigListArgs `codec:"arg" json:"arg"`
}

type SigListJSONArg struct {
	Arg SigListArgs `codec:"arg" json:"arg"`
}

type SigsInterface interface {
	SigList(SigListArgs) ([]Sig, error)
	SigListJSON(SigListArgs) (string, error)
}

func SigsProtocol(i SigsInterface) rpc2.Protocol {
	return rpc2.Protocol{
		Name: "keybase.1.sigs",
		Methods: map[string]rpc2.ServeHook{
			"sigList": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]SigListArg, 1)
				if err = nxt(&args); err == nil {
					ret, err = i.SigList(args[0].Arg)
				}
				return
			},
			"sigListJSON": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]SigListJSONArg, 1)
				if err = nxt(&args); err == nil {
					ret, err = i.SigListJSON(args[0].Arg)
				}
				return
			},
		},
	}

}

type SigsClient struct {
	Cli GenericClient
}

func (c SigsClient) SigList(arg SigListArgs) (res []Sig, err error) {
	__arg := SigListArg{Arg: arg}
	err = c.Cli.Call("keybase.1.sigs.sigList", []interface{}{__arg}, &res)
	return
}

func (c SigsClient) SigListJSON(arg SigListArgs) (res string, err error) {
	__arg := SigListJSONArg{Arg: arg}
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
	SessionID     int    `codec:"sessionID" json:"sessionID"`
	TheirName     string `codec:"theirName" json:"theirName"`
	LocalOnly     bool   `codec:"localOnly" json:"localOnly"`
	ApproveRemote bool   `codec:"approveRemote" json:"approveRemote"`
}

type UntrackArg struct {
	SessionID int    `codec:"sessionID" json:"sessionID"`
	TheirName string `codec:"theirName" json:"theirName"`
}

type TrackInterface interface {
	Track(TrackArg) error
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

func (c TrackClient) Untrack(__arg UntrackArg) (err error) {
	err = c.Cli.Call("keybase.1.track.untrack", []interface{}{__arg}, nil)
	return
}

type PromptYesNoArg struct {
	SessionID int   `codec:"sessionID" json:"sessionID"`
	Text      Text  `codec:"text" json:"text"`
	Def       *bool `codec:"def,omitempty" json:"def"`
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
	Tracker UID `codec:"tracker" json:"tracker"`
	Status  int `codec:"status" json:"status"`
	Mtime   int `codec:"mtime" json:"mtime"`
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
	Uid       UID    `codec:"uid" json:"uid"`
	Thumbnail string `codec:"thumbnail" json:"thumbnail"`
	Username  string `codec:"username" json:"username"`
	IdVersion int    `codec:"idVersion" json:"idVersion"`
	FullName  string `codec:"fullName" json:"fullName"`
	Bio       string `codec:"bio" json:"bio"`
	Proofs    Proofs `codec:"proofs" json:"proofs"`
	SigId     string `codec:"sigId" json:"sigId"`
	TrackTime int64  `codec:"trackTime" json:"trackTime"`
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
	Uids []UID `codec:"uids" json:"uids"`
}

type LoadUserArg struct {
	Uid      *UID   `codec:"uid,omitempty" json:"uid"`
	Username string `codec:"username" json:"username"`
	Self     bool   `codec:"self" json:"self"`
}

type ListTrackingArg struct {
	Filter string `codec:"filter" json:"filter"`
}

type ListTrackingJsonArg struct {
	Filter  string `codec:"filter" json:"filter"`
	Verbose bool   `codec:"verbose" json:"verbose"`
}

type SearchArg struct {
	SessionID int    `codec:"sessionID" json:"sessionID"`
	Query     string `codec:"query" json:"query"`
}

type UserInterface interface {
	ListTrackers(ListTrackersArg) ([]Tracker, error)
	ListTrackersByName(ListTrackersByNameArg) ([]Tracker, error)
	ListTrackersSelf(int) ([]Tracker, error)
	LoadUncheckedUserSummaries([]UID) ([]UserSummary, error)
	LoadUser(LoadUserArg) (User, error)
	ListTracking(string) ([]UserSummary, error)
	ListTrackingJson(ListTrackingJsonArg) (string, error)
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
					ret, err = i.LoadUncheckedUserSummaries(args[0].Uids)
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
					ret, err = i.ListTracking(args[0].Filter)
				}
				return
			},
			"listTrackingJson": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]ListTrackingJsonArg, 1)
				if err = nxt(&args); err == nil {
					ret, err = i.ListTrackingJson(args[0])
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

func (c UserClient) LoadUncheckedUserSummaries(uids []UID) (res []UserSummary, err error) {
	__arg := LoadUncheckedUserSummariesArg{Uids: uids}
	err = c.Cli.Call("keybase.1.user.loadUncheckedUserSummaries", []interface{}{__arg}, &res)
	return
}

func (c UserClient) LoadUser(__arg LoadUserArg) (res User, err error) {
	err = c.Cli.Call("keybase.1.user.loadUser", []interface{}{__arg}, &res)
	return
}

func (c UserClient) ListTracking(filter string) (res []UserSummary, err error) {
	__arg := ListTrackingArg{Filter: filter}
	err = c.Cli.Call("keybase.1.user.listTracking", []interface{}{__arg}, &res)
	return
}

func (c UserClient) ListTrackingJson(__arg ListTrackingJsonArg) (res string, err error) {
	err = c.Cli.Call("keybase.1.user.listTrackingJson", []interface{}{__arg}, &res)
	return
}

func (c UserClient) Search(__arg SearchArg) (res []UserSummary, err error) {
	err = c.Cli.Call("keybase.1.user.search", []interface{}{__arg}, &res)
	return
}
