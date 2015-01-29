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

type Text struct {
	Data   string `codec:"data"`
	Markup bool   `codec:"markup"`
}

type PgpIdentity struct {
	Username string `codec:"username"`
	Comment  string `codec:"comment"`
	Email    string `codec:"email"`
}

type User struct {
	Uid      UID    `codec:"uid"`
	Username string `codec:"username"`
}

type GetCurrentStatusRes struct {
	Configured        bool  `codec:"configured"`
	Registered        bool  `codec:"registered"`
	LoggedIn          bool  `codec:"loggedIn"`
	PublicKeySelected bool  `codec:"publicKeySelected"`
	HasPrivateKey     bool  `codec:"hasPrivateKey"`
	User              *User `codec:"user,omitempty"`
}

type GetCurrentStatusArg struct {
}

type ConfigInterface interface {
	GetCurrentStatus() (GetCurrentStatusRes, error)
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

type TrackSummary struct {
	Time     int  `codec:"time"`
	IsRemote bool `codec:"isRemote"`
}

type IdentifyOutcome struct {
	Status            *Status       `codec:"status,omitempty"`
	Warnings          []string      `codec:"warnings"`
	TrackUsed         *TrackSummary `codec:"trackUsed,omitempty"`
	NumTrackFailures  int           `codec:"numTrackFailures"`
	NumTrackChanges   int           `codec:"numTrackChanges"`
	NumProofFailures  int           `codec:"numProofFailures"`
	NumDeleted        int           `codec:"numDeleted"`
	NumProofSuccesses int           `codec:"numProofSuccesses"`
	Deleted           []TrackDiff   `codec:"deleted"`
}

type IdentifyRes struct {
	User    *User           `codec:"user,omitempty"`
	Outcome IdentifyOutcome `codec:"outcome"`
}

type IdentifyArg struct {
	Uid            UID    `codec:"uid"`
	Username       string `codec:"username"`
	TrackStatement bool   `codec:"trackStatement"`
	Luba           bool   `codec:"luba"`
	LoadSelf       bool   `codec:"loadSelf"`
}

type IdentifyDefaultArg struct {
	Username string `codec:"username"`
}

type IdentifyInterface interface {
	Identify(IdentifyArg) (IdentifyRes, error)
	IdentifyDefault(string) (IdentifyRes, error)
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
					ret, err = i.IdentifyDefault(args[0].Username)
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

func (c IdentifyClient) IdentifyDefault(username string) (res IdentifyRes, err error) {
	__arg := IdentifyDefaultArg{Username: username}
	err = c.Cli.Call("keybase.1.identify.identifyDefault", []interface{}{__arg}, &res)
	return
}

type SIGID [32]byte
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
	SigId         SIGID  `codec:"sigId"`
	Mtime         int    `codec:"mtime"`
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
	Status          *Status          `codec:"status,omitempty"`
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

type DisplayTrackStatementArg struct {
	SessionId int    `codec:"sessionId"`
	Stmt      string `codec:"stmt"`
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
	SessionId int      `codec:"sessionId"`
	Level     LogLevel `codec:"level"`
	Text      Text     `codec:"text"`
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

type PassphraseLoginArg struct {
	Identify   bool   `codec:"identify"`
	Username   string `codec:"username"`
	Passphrase string `codec:"passphrase"`
}

type PubkeyLoginArg struct {
}

type LogoutArg struct {
}

type SwitchUserArg struct {
	Username string `codec:"username"`
}

type LoginInterface interface {
	PassphraseLogin(PassphraseLoginArg) error
	PubkeyLogin() error
	Logout() error
	SwitchUser(string) error
}

func LoginProtocol(i LoginInterface) rpc2.Protocol {
	return rpc2.Protocol{
		Name: "keybase.1.login",
		Methods: map[string]rpc2.ServeHook{
			"passphraseLogin": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]PassphraseLoginArg, 1)
				if err = nxt(&args); err == nil {
					err = i.PassphraseLogin(args[0])
				}
				return
			},
			"pubkeyLogin": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]PubkeyLoginArg, 1)
				if err = nxt(&args); err == nil {
					err = i.PubkeyLogin()
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
			"switchUser": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]SwitchUserArg, 1)
				if err = nxt(&args); err == nil {
					err = i.SwitchUser(args[0].Username)
				}
				return
			},
		},
	}

}

type LoginClient struct {
	Cli GenericClient
}

func (c LoginClient) PassphraseLogin(__arg PassphraseLoginArg) (err error) {
	err = c.Cli.Call("keybase.1.login.passphraseLogin", []interface{}{__arg}, nil)
	return
}

func (c LoginClient) PubkeyLogin() (err error) {
	err = c.Cli.Call("keybase.1.login.pubkeyLogin", []interface{}{PubkeyLoginArg{}}, nil)
	return
}

func (c LoginClient) Logout() (err error) {
	err = c.Cli.Call("keybase.1.login.logout", []interface{}{LogoutArg{}}, nil)
	return
}

func (c LoginClient) SwitchUser(username string) (err error) {
	__arg := SwitchUserArg{Username: username}
	err = c.Cli.Call("keybase.1.login.switchUser", []interface{}{__arg}, nil)
	return
}

type GetEmailOrUsernameArg struct {
}

type LoginUiInterface interface {
	GetEmailOrUsername() (string, error)
}

func LoginUiProtocol(i LoginUiInterface) rpc2.Protocol {
	return rpc2.Protocol{
		Name: "keybase.1.loginUi",
		Methods: map[string]rpc2.ServeHook{
			"getEmailOrUsername": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]GetEmailOrUsernameArg, 1)
				if err = nxt(&args); err == nil {
					ret, err = i.GetEmailOrUsername()
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
	err = c.Cli.Call("keybase.1.loginUi.getEmailOrUsername", []interface{}{GetEmailOrUsernameArg{}}, &res)
	return
}

type PgpCreateUids struct {
	UseDefault bool          `codec:"useDefault"`
	Ids        []PgpIdentity `codec:"ids"`
}

type KeyGenArg struct {
	PrimaryBits  int           `codec:"primaryBits"`
	SubkeyBits   int           `codec:"subkeyBits"`
	CreateUids   PgpCreateUids `codec:"createUids"`
	NoPassphrase bool          `codec:"noPassphrase"`
	KbPassphrase bool          `codec:"kbPassphrase"`
	NoNaclEddsa  bool          `codec:"noNaclEddsa"`
	NoNaclDh     bool          `codec:"noNaclDh"`
	Pregen       string        `codec:"pregen"`
}

type KeyGenDefaultArg struct {
	CreateUids PgpCreateUids `codec:"createUids"`
	PushPublic bool          `codec:"pushPublic"`
	PushSecret bool          `codec:"pushSecret"`
	Passphrase string        `codec:"passphrase"`
}

type DeletePrimaryArg struct {
}

type ShowArg struct {
}

type MykeyInterface interface {
	KeyGen(KeyGenArg) error
	KeyGenDefault(KeyGenDefaultArg) error
	DeletePrimary() error
	Show() error
}

func MykeyProtocol(i MykeyInterface) rpc2.Protocol {
	return rpc2.Protocol{
		Name: "keybase.1.mykey",
		Methods: map[string]rpc2.ServeHook{
			"keyGen": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]KeyGenArg, 1)
				if err = nxt(&args); err == nil {
					err = i.KeyGen(args[0])
				}
				return
			},
			"keyGenDefault": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]KeyGenDefaultArg, 1)
				if err = nxt(&args); err == nil {
					err = i.KeyGenDefault(args[0])
				}
				return
			},
			"deletePrimary": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]DeletePrimaryArg, 1)
				if err = nxt(&args); err == nil {
					err = i.DeletePrimary()
				}
				return
			},
			"show": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]ShowArg, 1)
				if err = nxt(&args); err == nil {
					err = i.Show()
				}
				return
			},
		},
	}

}

type MykeyClient struct {
	Cli GenericClient
}

func (c MykeyClient) KeyGen(__arg KeyGenArg) (err error) {
	err = c.Cli.Call("keybase.1.mykey.keyGen", []interface{}{__arg}, nil)
	return
}

func (c MykeyClient) KeyGenDefault(__arg KeyGenDefaultArg) (err error) {
	err = c.Cli.Call("keybase.1.mykey.keyGenDefault", []interface{}{__arg}, nil)
	return
}

func (c MykeyClient) DeletePrimary() (err error) {
	err = c.Cli.Call("keybase.1.mykey.deletePrimary", []interface{}{DeletePrimaryArg{}}, nil)
	return
}

func (c MykeyClient) Show() (err error) {
	err = c.Cli.Call("keybase.1.mykey.show", []interface{}{ShowArg{}}, nil)
	return
}

type PushPreferences struct {
	Public  bool `codec:"public"`
	Private bool `codec:"private"`
}

type GetPushPreferencesArg struct {
}

type MykeyUiInterface interface {
	GetPushPreferences() (PushPreferences, error)
}

func MykeyUiProtocol(i MykeyUiInterface) rpc2.Protocol {
	return rpc2.Protocol{
		Name: "keybase.1.mykeyUi",
		Methods: map[string]rpc2.ServeHook{
			"getPushPreferences": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]GetPushPreferencesArg, 1)
				if err = nxt(&args); err == nil {
					ret, err = i.GetPushPreferences()
				}
				return
			},
		},
	}

}

type MykeyUiClient struct {
	Cli GenericClient
}

func (c MykeyUiClient) GetPushPreferences() (res PushPreferences, err error) {
	err = c.Cli.Call("keybase.1.mykeyUi.getPushPreferences", []interface{}{GetPushPreferencesArg{}}, &res)
	return
}

type ProveArg struct {
	Service  string `codec:"service"`
	Username string `codec:"username"`
	Force    bool   `codec:"force"`
}

type ProveInterface interface {
	Prove(ProveArg) error
}

func ProveProtocol(i ProveInterface) rpc2.Protocol {
	return rpc2.Protocol{
		Name: "keybase.1.prove",
		Methods: map[string]rpc2.ServeHook{
			"prove": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]ProveArg, 1)
				if err = nxt(&args); err == nil {
					err = i.Prove(args[0])
				}
				return
			},
		},
	}

}

type ProveClient struct {
	Cli GenericClient
}

func (c ProveClient) Prove(__arg ProveArg) (err error) {
	err = c.Cli.Call("keybase.1.prove.prove", []interface{}{__arg}, nil)
	return
}

type PromptOverwriteType int

const (
	PromptOverwriteType_SOCIAL = 0
	PromptOverwriteType_SITE   = 1
)

type PromptOverwriteArg struct {
	SessionId int                 `codec:"sessionId"`
	Account   string              `codec:"account"`
	Typ       PromptOverwriteType `codec:"typ"`
}

type PromptUsernameArg struct {
	SessionId int     `codec:"sessionId"`
	Prompt    string  `codec:"prompt"`
	PrevError *Status `codec:"prevError,omitempty"`
}

type OutputPrechecksArg struct {
	SessionId int  `codec:"sessionId"`
	Text      Text `codec:"text"`
}

type PreProofWarningArg struct {
	SessionId int  `codec:"sessionId"`
	Text      Text `codec:"text"`
}

type OutputInstructionsArg struct {
	SessionId    int    `codec:"sessionId"`
	Instructions Text   `codec:"instructions"`
	Proof        string `codec:"proof"`
}

type OkToCheckArg struct {
	SessionId int    `codec:"sessionId"`
	Name      string `codec:"name"`
	Attempt   int    `codec:"attempt"`
}

type DisplayRecheckWarningArg struct {
	SessionId int  `codec:"sessionId"`
	Text      Text `codec:"text"`
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

type SecretEntryArg struct {
	Desc   string `codec:"desc"`
	Prompt string `codec:"prompt"`
	Err    string `codec:"err"`
	Cancel string `codec:"cancel"`
	Ok     string `codec:"ok"`
}

type SecretEntryRes struct {
	Text     string `codec:"text"`
	Canceled bool   `codec:"canceled"`
}

type GetSecretArg struct {
	Pinentry SecretEntryArg  `codec:"pinentry"`
	Terminal *SecretEntryArg `codec:"terminal,omitempty"`
}

type GetNewPassphraseArg struct {
	TerminalPrompt string `codec:"terminalPrompt"`
	PinentryDesc   string `codec:"pinentryDesc"`
	PinentryPrompt string `codec:"pinentryPrompt"`
	RetryMessage   string `codec:"retryMessage"`
}

type GetKeybasePassphraseArg struct {
	Username string `codec:"username"`
	Retry    string `codec:"retry"`
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
	Uid      UID    `codec:"uid"`
	Username string `codec:"username"`
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
	PassphraseOk bool `codec:"passphraseOk"`
	PostOk       bool `codec:"postOk"`
	WriteOk      bool `codec:"writeOk"`
}

type CheckUsernameAvailableArg struct {
	Username string `codec:"username"`
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

type TrackArg struct {
	TheirName string `codec:"theirName"`
}

type TrackInterface interface {
	Track(string) error
}

func TrackProtocol(i TrackInterface) rpc2.Protocol {
	return rpc2.Protocol{
		Name: "keybase.1.track",
		Methods: map[string]rpc2.ServeHook{
			"track": func(nxt rpc2.DecodeNext) (ret interface{}, err error) {
				args := make([]TrackArg, 1)
				if err = nxt(&args); err == nil {
					err = i.Track(args[0].TheirName)
				}
				return
			},
		},
	}

}

type TrackClient struct {
	Cli GenericClient
}

func (c TrackClient) Track(theirName string) (err error) {
	__arg := TrackArg{TheirName: theirName}
	err = c.Cli.Call("keybase.1.track.track", []interface{}{__arg}, nil)
	return
}

type PromptYesNoArg struct {
	Text Text  `codec:"text"`
	Def  *bool `codec:"def,omitempty"`
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
