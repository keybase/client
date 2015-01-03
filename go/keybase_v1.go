package keybase_1

import (
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
)

type GenericClient interface {
	Call(s string, args interface{}, res interface{}) error
}

type Status struct {
	Code   int      `codec:"code"`
	Name   string   `codec:"name"`
	Desc   string   `codec:"desc"`
	Fields []string `codec:"fields"`
}

type UID [16]byte
type LoadUserArg struct {
	Uid      *UID    `codec:"uid,omitempty"`
	Username *string `codec:"username,omitempty"`
	Self     bool    `codec:"self"`
}

type FOKID struct {
	PgpFingerprint *[]byte `codec:"pgpFingerprint,omitempty"`
	Kid            *[]byte `codec:"kid,omitempty"`
}

type GetCurrentStatusRes struct {
	Configured        bool `codec:"configured"`
	Registered        bool `codec:"registered"`
	LoggedIn          bool `codec:"loggedIn"`
	PublicKeySelected bool `codec:"publicKeySelected"`
	HasPrivateKey     bool `codec:"hasPrivateKey"`
}

type ConfigInterface interface {
	GetCurrentStatus() (GetCurrentStatusRes, error)
}

func ConfigProtocol(i ConfigInterface) rpc2.Protocol {
	return rpc2.Protocol{
		Name: "keybase.1.config",
		Methods: map[string]rpc2.ServeHook{
			"getCurrentStatus": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				var args interface{}
				if err = nxt(&args); err == nil {
					ret, err = i.GetCurrentStatus()
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
	err = c.Cli.Call("keybase.1.config.getCurrentStatus", nil, &res)
	return
}

type IdentifyInterface interface {
	IdentifySelf(sessionId int) error
}

func IdentifyProtocol(i IdentifyInterface) rpc2.Protocol {
	return rpc2.Protocol{
		Name: "keybase.1.identify",
		Methods: map[string]rpc2.ServeHook{
			"identifySelf": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				var args int
				if err = nxt(&args); err == nil {
					err = i.IdentifySelf(args)
				}
				return
			},
		},
	}

}

type IdentifyClient struct {
	Cli GenericClient
}

func (c IdentifyClient) IdentifySelf(sessionId int) (err error) {
	err = c.Cli.Call("keybase.1.identify.identifySelf", sessionId, nil)
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
	Type          TrackDiffType `codec:"type"`
	DisplayMarkup string        `codec:"displayMarkup"`
}

type ProofStatus struct {
	State  int    `codec:"state"`
	Status int    `codec:"status"`
	Desc   string `codec:"desc"`
}

type RemoteProof struct {
	ProofType     int    `codec:"proofType"`
	Key           string `codec:"key"`
	Value         string `codec:"value"`
	DisplayMarkup string `codec:"displayMarkup"`
}

type IdentifyRow struct {
	RowId     int         `codec:"rowId"`
	Proof     RemoteProof `codec:"proof"`
	TrackDiff *TrackDiff  `codec:"trackDiff,omitempty"`
}

type IdentifyKey struct {
	PgpFingerprint []byte     `codec:"pgpFingerprint"`
	KID            []byte     `codec:"KID"`
	TrackDiff      *TrackDiff `codec:"trackDiff,omitempty"`
}

type Cryptocurrency struct {
	RowId   int    `codec:"rowId"`
	Pkhash  []byte `codec:"pkhash"`
	Address string `codec:"address"`
}

type Identity struct {
	Status          Status           `codec:"status"`
	WhenLastTracked int              `codec:"whenLastTracked"`
	Key             IdentifyKey      `codec:"key"`
	Proofs          []IdentifyRow    `codec:"proofs"`
	Cryptocurrency  []Cryptocurrency `codec:"cryptocurrency"`
	Deleted         []TrackDiff      `codec:"deleted"`
}

type SigHint struct {
	RemoteId  string `codec:"remoteId"`
	HumanUrl  string `codec:"humanUrl"`
	ApiUrl    string `codec:"apiUrl"`
	CheckText string `codec:"checkText"`
}

type CheckResult struct {
	ProofStatus   ProofStatus `codec:"proofStatus"`
	Timestamp     int         `codec:"timestamp"`
	DisplayMarkup string      `codec:"displayMarkup"`
}

type LinkCheckResult struct {
	ProofId     int          `codec:"proofId"`
	ProofStatus ProofStatus  `codec:"proofStatus"`
	Cached      *CheckResult `codec:"cached,omitempty"`
	Diff        *TrackDiff   `codec:"diff,omitempty"`
	RemoteDiff  *TrackDiff   `codec:"remoteDiff,omitempty"`
	Hint        *SigHint     `codec:"hint,omitempty"`
}

type TrackSummary struct {
	Time     int  `codec:"time"`
	IsRemote bool `codec:"isRemote"`
}

type IdentifyOutcome struct {
	Status            Status        `codec:"status"`
	Warnings          []string      `codec:"warnings"`
	TrackUsed         *TrackSummary `codec:"trackUsed,omitempty"`
	NumTrackFailures  int           `codec:"numTrackFailures"`
	NumTrackChanges   int           `codec:"numTrackChanges"`
	NumProofFailures  int           `codec:"numProofFailures"`
	NumDeleted        int           `codec:"numDeleted"`
	NumProofSuccesses int           `codec:"numProofSuccesses"`
	Deleted           []TrackDiff   `codec:"deleted"`
}

type FinishAndPromptRes struct {
	TrackLocal  bool `codec:"trackLocal"`
	TrackRemote bool `codec:"trackRemote"`
}

type FinishAndPromptArg struct {
	SessionId int             `codec:"sessionId"`
	Outcome   IdentifyOutcome `codec:"outcome"`
}

type FinishWebProofCheckArg struct {
	SessionId int             `codec:"sessionId"`
	Rp        RemoteProof     `codec:"rp"`
	Lcr       LinkCheckResult `codec:"lcr"`
}

type FinishSocialProofCheckArg struct {
	SessionId int             `codec:"sessionId"`
	Rp        RemoteProof     `codec:"rp"`
	Lcr       LinkCheckResult `codec:"lcr"`
}

type DisplayCryptocurrencyArg struct {
	SessionId int            `codec:"sessionId"`
	C         Cryptocurrency `codec:"c"`
}

type DisplayKeyArg struct {
	SessionId int        `codec:"sessionId"`
	Fokid     FOKID      `codec:"fokid"`
	Diff      *TrackDiff `codec:"diff,omitempty"`
}

type ReportLastTrackArg struct {
	SessionId int           `codec:"sessionId"`
	Track     *TrackSummary `codec:"track,omitempty"`
}

type LaunchNetworkChecksArg struct {
	SessionId int      `codec:"sessionId"`
	Id        Identity `codec:"id"`
}

type WarningArg struct {
	SessionId int    `codec:"sessionId"`
	Msg       string `codec:"msg"`
}

type IdentifyUiInterface interface {
	FinishAndPrompt(arg FinishAndPromptArg) (FinishAndPromptRes, error)
	FinishWebProofCheck(arg FinishWebProofCheckArg) error
	FinishSocialProofCheck(arg FinishSocialProofCheckArg) error
	DisplayCryptocurrency(arg DisplayCryptocurrencyArg) error
	DisplayKey(arg DisplayKeyArg) error
	ReportLastTrack(arg ReportLastTrackArg) error
	LaunchNetworkChecks(arg LaunchNetworkChecksArg) error
	Warning(arg WarningArg) error
}

func IdentifyUiProtocol(i IdentifyUiInterface) rpc2.Protocol {
	return rpc2.Protocol{
		Name: "keybase.1.identifyUi",
		Methods: map[string]rpc2.ServeHook{
			"finishAndPrompt": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				var args FinishAndPromptArg
				if err = nxt(&args); err == nil {
					ret, err = i.FinishAndPrompt(args)
				}
				return
			},
			"finishWebProofCheck": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				var args FinishWebProofCheckArg
				if err = nxt(&args); err == nil {
					err = i.FinishWebProofCheck(args)
				}
				return
			},
			"finishSocialProofCheck": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				var args FinishSocialProofCheckArg
				if err = nxt(&args); err == nil {
					err = i.FinishSocialProofCheck(args)
				}
				return
			},
			"displayCryptocurrency": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				var args DisplayCryptocurrencyArg
				if err = nxt(&args); err == nil {
					err = i.DisplayCryptocurrency(args)
				}
				return
			},
			"displayKey": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				var args DisplayKeyArg
				if err = nxt(&args); err == nil {
					err = i.DisplayKey(args)
				}
				return
			},
			"reportLastTrack": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				var args ReportLastTrackArg
				if err = nxt(&args); err == nil {
					err = i.ReportLastTrack(args)
				}
				return
			},
			"launchNetworkChecks": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				var args LaunchNetworkChecksArg
				if err = nxt(&args); err == nil {
					err = i.LaunchNetworkChecks(args)
				}
				return
			},
			"warning": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				var args WarningArg
				if err = nxt(&args); err == nil {
					err = i.Warning(args)
				}
				return
			},
		},
	}

}

type IdentifyUiClient struct {
	Cli GenericClient
}

func (c IdentifyUiClient) FinishAndPrompt(arg FinishAndPromptArg) (res FinishAndPromptRes, err error) {
	err = c.Cli.Call("keybase.1.identifyUi.finishAndPrompt", arg, &res)
	return
}

func (c IdentifyUiClient) FinishWebProofCheck(arg FinishWebProofCheckArg) (err error) {
	err = c.Cli.Call("keybase.1.identifyUi.finishWebProofCheck", arg, nil)
	return
}

func (c IdentifyUiClient) FinishSocialProofCheck(arg FinishSocialProofCheckArg) (err error) {
	err = c.Cli.Call("keybase.1.identifyUi.finishSocialProofCheck", arg, nil)
	return
}

func (c IdentifyUiClient) DisplayCryptocurrency(arg DisplayCryptocurrencyArg) (err error) {
	err = c.Cli.Call("keybase.1.identifyUi.displayCryptocurrency", arg, nil)
	return
}

func (c IdentifyUiClient) DisplayKey(arg DisplayKeyArg) (err error) {
	err = c.Cli.Call("keybase.1.identifyUi.displayKey", arg, nil)
	return
}

func (c IdentifyUiClient) ReportLastTrack(arg ReportLastTrackArg) (err error) {
	err = c.Cli.Call("keybase.1.identifyUi.reportLastTrack", arg, nil)
	return
}

func (c IdentifyUiClient) LaunchNetworkChecks(arg LaunchNetworkChecksArg) (err error) {
	err = c.Cli.Call("keybase.1.identifyUi.launchNetworkChecks", arg, nil)
	return
}

func (c IdentifyUiClient) Warning(arg WarningArg) (err error) {
	err = c.Cli.Call("keybase.1.identifyUi.warning", arg, nil)
	return
}

type LoginInterface interface {
	PassphraseLogin() error
	PubkeyLogin() error
	Logout() error
	SwitchUser(username string) error
}

func LoginProtocol(i LoginInterface) rpc2.Protocol {
	return rpc2.Protocol{
		Name: "keybase.1.login",
		Methods: map[string]rpc2.ServeHook{
			"passphraseLogin": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				var args interface{}
				if err = nxt(&args); err == nil {
					err = i.PassphraseLogin()
				}
				return
			},
			"pubkeyLogin": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				var args interface{}
				if err = nxt(&args); err == nil {
					err = i.PubkeyLogin()
				}
				return
			},
			"logout": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				var args interface{}
				if err = nxt(&args); err == nil {
					err = i.Logout()
				}
				return
			},
			"switchUser": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				var args string
				if err = nxt(&args); err == nil {
					err = i.SwitchUser(args)
				}
				return
			},
		},
	}

}

type LoginClient struct {
	Cli GenericClient
}

func (c LoginClient) PassphraseLogin() (err error) {
	err = c.Cli.Call("keybase.1.login.passphraseLogin", nil, nil)
	return
}

func (c LoginClient) PubkeyLogin() (err error) {
	err = c.Cli.Call("keybase.1.login.pubkeyLogin", nil, nil)
	return
}

func (c LoginClient) Logout() (err error) {
	err = c.Cli.Call("keybase.1.login.logout", nil, nil)
	return
}

func (c LoginClient) SwitchUser(username string) (err error) {
	err = c.Cli.Call("keybase.1.login.switchUser", username, nil)
	return
}

type GetKeybasePassphraseArg struct {
	Username string `codec:"username"`
	Retry    string `codec:"retry"`
}

type LoginUiInterface interface {
	GetEmailOrUsername() (string, error)
	GetKeybasePassphrase(arg GetKeybasePassphraseArg) (string, error)
}

func LoginUiProtocol(i LoginUiInterface) rpc2.Protocol {
	return rpc2.Protocol{
		Name: "keybase.1.loginUi",
		Methods: map[string]rpc2.ServeHook{
			"getEmailOrUsername": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				var args interface{}
				if err = nxt(&args); err == nil {
					ret, err = i.GetEmailOrUsername()
				}
				return
			},
			"getKeybasePassphrase": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				var args GetKeybasePassphraseArg
				if err = nxt(&args); err == nil {
					ret, err = i.GetKeybasePassphrase(args)
				}
				return
			},
		},
	}

}

type LoginUiClient struct {
	Cli GenericClient
}

func (c LoginUiClient) GetEmailOrUsername() (res string, err error) {
	err = c.Cli.Call("keybase.1.loginUi.getEmailOrUsername", nil, &res)
	return
}

func (c LoginUiClient) GetKeybasePassphrase(arg GetKeybasePassphraseArg) (res string, err error) {
	err = c.Cli.Call("keybase.1.loginUi.getKeybasePassphrase", arg, &res)
	return
}

type SignupRes struct {
	PassphraseOk bool `codec:"passphraseOk"`
	PostOk       bool `codec:"postOk"`
	WriteOk      bool `codec:"writeOk"`
}

type SignupArg struct {
	Email      string `codec:"email"`
	InviteCode string `codec:"inviteCode"`
	Passphrase string `codec:"passphrase"`
	Username   string `codec:"username"`
}

type InviteRequestArg struct {
	Email    string `codec:"email"`
	Fullname string `codec:"fullname"`
	Notes    string `codec:"notes"`
}

type SignupInterface interface {
	CheckUsernameAvailable(username string) error
	Signup(arg SignupArg) (SignupRes, error)
	InviteRequest(arg InviteRequestArg) error
}

func SignupProtocol(i SignupInterface) rpc2.Protocol {
	return rpc2.Protocol{
		Name: "keybase.1.signup",
		Methods: map[string]rpc2.ServeHook{
			"checkUsernameAvailable": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				var args string
				if err = nxt(&args); err == nil {
					err = i.CheckUsernameAvailable(args)
				}
				return
			},
			"signup": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				var args SignupArg
				if err = nxt(&args); err == nil {
					ret, err = i.Signup(args)
				}
				return
			},
			"inviteRequest": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				var args InviteRequestArg
				if err = nxt(&args); err == nil {
					err = i.InviteRequest(args)
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
	err = c.Cli.Call("keybase.1.signup.checkUsernameAvailable", username, nil)
	return
}

func (c SignupClient) Signup(arg SignupArg) (res SignupRes, err error) {
	err = c.Cli.Call("keybase.1.signup.signup", arg, &res)
	return
}

func (c SignupClient) InviteRequest(arg InviteRequestArg) (err error) {
	err = c.Cli.Call("keybase.1.signup.inviteRequest", arg, nil)
	return
}
