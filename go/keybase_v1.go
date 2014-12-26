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

type LoadUserArg struct {
	Uid      *UID    `codec:"uid,omitempty"`
	Username *string `codec:"username,omitempty"`
	Self     bool    `codec:"self"`
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

type IdentifyStartResBody struct {
	SessionId       int           `codec:"sessionId"`
	WhenLastTracked int           `codec:"whenLastTracked"`
	Key             IdentifyKey   `codec:"key"`
	Proofs          []IdentifyRow `codec:"proofs"`
	Cryptocurrency  []IdentifyRow `codec:"cryptocurrency"`
	Deleted         []TrackDiff   `codec:"deleted"`
}

type IdentifyStartRes struct {
	Status Status                `codec:"status"`
	Body   *IdentifyStartResBody `codec:"body,omitempty"`
}

type ProofStatus struct {
	State  int    `codec:"state"`
	Status int    `codec:"status"`
	Desc   string `codec:"desc"`
}

type IdentifyCheckResBody struct {
	ProofStatus     ProofStatus `codec:"proofStatus"`
	CachedTimestamp int         `codec:"cachedTimestamp"`
	TrackDiff       *TrackDiff  `codec:"trackDiff,omitempty"`
}

type IdentifyCheckRes struct {
	Status Status                `codec:"status"`
	Body   *IdentifyCheckResBody `codec:"body,omitempty"`
}

type IdentifyWaitResBody struct {
	NumTrackFailures  int `codec:"numTrackFailures"`
	NumTrackChanges   int `codec:"numTrackChanges"`
	NumProofFailures  int `codec:"numProofFailures"`
	NumDeleted        int `codec:"numDeleted"`
	NumProofSuccesses int `codec:"numProofSuccesses"`
}

type IdentifyWaitRes struct {
	Status Status               `codec:"status"`
	Body   *IdentifyWaitResBody `codec:"body,omitempty"`
}

type IdentifySelfStartArg struct {
}

type IdentifyCheckArg struct {
	SessionId int `codec:"sessionId"`
	RowId     int `codec:"rowId"`
}

type IdentifyFinishArg struct {
	SessionId     int    `codec:"sessionId"`
	DoRemoteTrack bool   `codec:"doRemoteTrack"`
	DoLocalTrack  bool   `codec:"doLocalTrack"`
	Status        Status `codec:"status"`
}

type TrackInterface interface {
	IdentifySelfStart(arg *IdentifySelfStartArg, res *IdentifyStartRes) error
	IdentifyStart(arg *LoadUserArg, res *IdentifyStartRes) error
	IdentifyCheck(arg *IdentifyCheckArg, res *IdentifyCheckRes) error
	IdentifyWait(sessionId *int, res *IdentifyWaitRes) error
	IdentifyFinish(arg *IdentifyFinishArg, res *Status) error
}

func RegisterTrack(server *rpc.Server, i TrackInterface) error {
	return server.RegisterName("keybase.1.track", i)
}

type TrackClient struct {
	Cli GenericClient
}

func (c TrackClient) IdentifySelfStart(arg IdentifySelfStartArg, res *IdentifyStartRes) error {
	return c.Cli.Call("keybase.1.track.IdentifySelfStart", arg, res)
}

func (c TrackClient) IdentifyStart(arg LoadUserArg, res *IdentifyStartRes) error {
	return c.Cli.Call("keybase.1.track.IdentifyStart", arg, res)
}

func (c TrackClient) IdentifyCheck(arg IdentifyCheckArg, res *IdentifyCheckRes) error {
	return c.Cli.Call("keybase.1.track.IdentifyCheck", arg, res)
}

func (c TrackClient) IdentifyWait(sessionId int, res *IdentifyWaitRes) error {
	return c.Cli.Call("keybase.1.track.IdentifyWait", sessionId, res)
}

func (c TrackClient) IdentifyFinish(arg IdentifyFinishArg, res *Status) error {
	return c.Cli.Call("keybase.1.track.IdentifyFinish", arg, res)
}
