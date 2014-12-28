package keybase_1

import (
	"net/rpc"
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

type LoadUserArg struct {
	Uid      *UID    `codec:"uid,omitempty"`
	Username *string `codec:"username,omitempty"`
	Self     bool    `codec:"self"`
}

type FOKID struct {
	PgpFingerprint *[]byte `codec:"pgpFingerprint,omitempty"`
	Kid            *[]byte `codec:"kid,omitempty"`
}

type ProofStatus struct {
	State  int    `codec:"state"`
	Status int    `codec:"status"`
	Desc   string `codec:"desc"`
}

type GetCurrentStatusResBody struct {
	Configured        bool `codec:"configured"`
	Registered        bool `codec:"registered"`
	LoggedIn          bool `codec:"loggedIn"`
	PublicKeySelected bool `codec:"publicKeySelected"`
	HasPrivateKey     bool `codec:"hasPrivateKey"`
}

type GetCurrentStatusRes struct {
	Body   *GetCurrentStatusResBody `codec:"body,omitempty"`
	Status Status                   `codec:"status"`
}

type GetCurrentStatusArg struct {
}

type ConfigInterface interface {
	GetCurrentStatus(arg *GetCurrentStatusArg, res *GetCurrentStatusRes) error
}

func RegisterConfig(server *rpc.Server, i ConfigInterface) error {
	return server.RegisterName("keybase.1.config", i)
}

type ConfigClient struct {
	Cli GenericClient
}

func (c ConfigClient) GetCurrentStatus(arg GetCurrentStatusArg, res *GetCurrentStatusRes) error {
	return c.Cli.Call("keybase.1.config.GetCurrentStatus", arg, res)
}

type IdentifyInterface interface {
	IdentifySelf(sessionId *int, res *Status) error
}

func RegisterIdentify(server *rpc.Server, i IdentifyInterface) error {
	return server.RegisterName("keybase.1.identify", i)
}

type IdentifyClient struct {
	Cli GenericClient
}

func (c IdentifyClient) IdentifySelf(sessionId int, res *Status) error {
	return c.Cli.Call("keybase.1.identify.identifySelf", sessionId, res)
}

type Identity struct {
	Status          Status        `codec:"status"`
	WhenLastTracked int           `codec:"whenLastTracked"`
	Key             IdentifyKey   `codec:"key"`
	Proofs          []IdentifyRow `codec:"proofs"`
	Cryptocurrency  []IdentifyRow `codec:"cryptocurrency"`
	Deleted         []TrackDiff   `codec:"deleted"`
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

type IdentifyOutcome struct {
	Status            Status `codec:"status"`
	NumTrackFailures  int    `codec:"numTrackFailures"`
	NumTrackChanges   int    `codec:"numTrackChanges"`
	NumProofFailures  int    `codec:"numProofFailures"`
	NumDeleted        int    `codec:"numDeleted"`
	NumProofSuccesses int    `codec:"numProofSuccesses"`
}

type FinishAndPromptRes struct {
	Status      Status `codec:"status"`
	TrackLocal  bool   `codec:"trackLocal"`
	TrackRemote bool   `codec:"trackRemote"`
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
	SessionId int    `codec:"sessionId"`
	Address   string `codec:"address"`
}

type DisplayKeyArg struct {
	SessionId int        `codec:"sessionId"`
	Fokid     FOKID      `codec:"fokid"`
	Diff      *TrackDiff `codec:"diff,omitempty"`
}

type ReportLastTrackArg struct {
	SessionId int `codec:"sessionId"`
	Time      int `codec:"time"`
}

type LaunchNetworkChecksArg struct {
	SessionId int      `codec:"sessionId"`
	Id        Identity `codec:"id"`
}

type IdentifyUiInterface interface {
	FinishAndPrompt(arg *FinishAndPromptArg, res *FinishAndPromptRes) error
	FinishWebProofCheck(arg *FinishWebProofCheckArg, res *Status) error
	FinishSocialProofCheck(arg *FinishSocialProofCheckArg, res *Status) error
	DisplayCryptocurrency(arg *DisplayCryptocurrencyArg, res *Status) error
	DisplayKey(arg *DisplayKeyArg, res *Status) error
	ReportLastTrack(arg *ReportLastTrackArg, res *Status) error
	LaunchNetworkChecks(arg *LaunchNetworkChecksArg, res *Status) error
}

func RegisterIdentifyUi(server *rpc.Server, i IdentifyUiInterface) error {
	return server.RegisterName("keybase.1.identifyUi", i)
}

type IdentifyUiClient struct {
	Cli GenericClient
}

func (c IdentifyUiClient) FinishAndPrompt(arg FinishAndPromptArg, res *FinishAndPromptRes) error {
	return c.Cli.Call("keybase.1.identifyUi.finishAndPrompt", arg, res)
}

func (c IdentifyUiClient) FinishWebProofCheck(arg FinishWebProofCheckArg, res *Status) error {
	return c.Cli.Call("keybase.1.identifyUi.finishWebProofCheck", arg, res)
}

func (c IdentifyUiClient) FinishSocialProofCheck(arg FinishSocialProofCheckArg, res *Status) error {
	return c.Cli.Call("keybase.1.identifyUi.finishSocialProofCheck", arg, res)
}

func (c IdentifyUiClient) DisplayCryptocurrency(arg DisplayCryptocurrencyArg, res *Status) error {
	return c.Cli.Call("keybase.1.identifyUi.displayCryptocurrency", arg, res)
}

func (c IdentifyUiClient) DisplayKey(arg DisplayKeyArg, res *Status) error {
	return c.Cli.Call("keybase.1.identifyUi.displayKey", arg, res)
}

func (c IdentifyUiClient) ReportLastTrack(arg ReportLastTrackArg, res *Status) error {
	return c.Cli.Call("keybase.1.identifyUi.reportLastTrack", arg, res)
}

func (c IdentifyUiClient) LaunchNetworkChecks(arg LaunchNetworkChecksArg, res *Status) error {
	return c.Cli.Call("keybase.1.identifyUi.launchNetworkChecks", arg, res)
}

type LoginResBody struct {
	Uid UID `codec:"uid"`
}

type LoginRes struct {
	Body   *LoginResBody `codec:"body,omitempty"`
	Status Status        `codec:"status"`
}

type PubkeyLoginArg struct {
}

type LogoutArg struct {
}

type LoginInterface interface {
	PassphraseLogin(passphrase *string, res *LoginRes) error
	PubkeyLogin(arg *PubkeyLoginArg, res *LoginRes) error
	Logout(arg *LogoutArg, res *Status) error
	SwitchUser(username *string, res *Status) error
}

func RegisterLogin(server *rpc.Server, i LoginInterface) error {
	return server.RegisterName("keybase.1.login", i)
}

type LoginClient struct {
	Cli GenericClient
}

func (c LoginClient) PassphraseLogin(passphrase string, res *LoginRes) error {
	return c.Cli.Call("keybase.1.login.PassphraseLogin", passphrase, res)
}

func (c LoginClient) PubkeyLogin(arg PubkeyLoginArg, res *LoginRes) error {
	return c.Cli.Call("keybase.1.login.PubkeyLogin", arg, res)
}

func (c LoginClient) Logout(arg LogoutArg, res *Status) error {
	return c.Cli.Call("keybase.1.login.Logout", arg, res)
}

func (c LoginClient) SwitchUser(username string, res *Status) error {
	return c.Cli.Call("keybase.1.login.SwitchUser", username, res)
}

type SignupResBody struct {
	PassphraseOk bool `codec:"passphraseOk"`
	PostOk       bool `codec:"postOk"`
	WriteOk      bool `codec:"writeOk"`
}

type SignupRes struct {
	Body   SignupResBody `codec:"body"`
	Status Status        `codec:"status"`
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
	CheckUsernameAvailable(username *string, res *Status) error
	Signup(arg *SignupArg, res *SignupRes) error
	InviteRequest(arg *InviteRequestArg, res *Status) error
}

func RegisterSignup(server *rpc.Server, i SignupInterface) error {
	return server.RegisterName("keybase.1.signup", i)
}

type SignupClient struct {
	Cli GenericClient
}

func (c SignupClient) CheckUsernameAvailable(username string, res *Status) error {
	return c.Cli.Call("keybase.1.signup.CheckUsernameAvailable", username, res)
}

func (c SignupClient) Signup(arg SignupArg, res *SignupRes) error {
	return c.Cli.Call("keybase.1.signup.Signup", arg, res)
}

func (c SignupClient) InviteRequest(arg InviteRequestArg, res *Status) error {
	return c.Cli.Call("keybase.1.signup.InviteRequest", arg, res)
}
