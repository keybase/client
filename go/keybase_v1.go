package keybase_1

import (
	"net/rpc"
)

type Status struct {
	Code   int      `codec:"code"`
	Name   string   `codec:"name"`
	Desc   string   `codec:"desc"`
	Fields []string `codec:"fields"`
}

type UID [16]byte
type LoginResBody struct {
	Uid UID `codec:"uid"`
}

type IsLoggedInRes struct {
	Body   *LoginResBody `codec:"body,omitempty"`
	Status Status        `codec:"status"`
}

type IsLoggedInArg struct {
}

type PasswordLoginArg struct {
	Password string `codec:"password"`
}

type PubkeyLoginArg struct {
}

type PasswordLoginRes struct {
	Body   *LoginResBody `codec:"body,omitempty"`
	Status Status        `codec:"status"`
}

type PubkeyLoginRes struct {
	Body   *LoginResBody `codec:"body,omitempty"`
	Status Status        `codec:"status"`
}

type LogoutRes struct {
	Status Status `codec:"status"`
}

type LogoutArg struct {
}

type SwitchUserRes struct {
	Status Status `codec:"status"`
}

type SwitchUserArg struct {
	Username string `codec:"username"`
}

type LoginInterface interface {
	IsLoggedIn(arg *IsLoggedInArg, res *IsLoggedInRes) error
	PasswordLogin(arg *PasswordLoginArg, res *PasswordLoginRes) error
	PubkeyLogin(arg *PubkeyLoginArg, res *PubkeyLoginRes) error
	Logout(arg *LogoutArg, res *LogoutRes) error
	SwitchUser(arg *SwitchUserArg, res *SwitchUserRes) error
}

func RegisterLogin(server *rpc.Server, i LoginInterface) error {
	return server.RegisterName("keybase.1.login", i)
}

type CheckUsernameAvailableRes struct {
	Status Status `codec:"status"`
}

type CheckUsernameAvailableArg struct {
	Username string `codec:"username"`
}

type SignupArg struct {
	Email      string `codec:"email"`
	InviteCode string `codec:"inviteCode"`
	Password   string `codec:"password"`
	Username   string `codec:"username"`
}

type InviteRequestArg struct {
	Email    string `codec:"email"`
	FullName string `codec:"fullName"`
	Notes    string `codec:"notes"`
}

type InviteRequestResBody struct {
	Code  string `codec:"code"`
	Place int    `codec:"place"`
}

type InviteRequestRes struct {
	Body   *InviteRequestResBody `codec:"body,omitempty"`
	Status Status                `codec:"status"`
}

type SignupResSuccess struct {
	Uid UID `codec:"uid"`
}

type SignupRes struct {
	Body         *SignupResSuccess `codec:"body,omitempty"`
	PassphraseOk bool              `codec:"passphraseOk"`
	PostOk       bool              `codec:"postOk"`
	WriteOk      bool              `codec:"writeOk"`
	Status       Status            `codec:"status"`
}

type SignupInterface interface {
	CheckUsernameAvailable(arg *CheckUsernameAvailableArg, res *CheckUsernameAvailableRes) error
	Signup(arg *SignupArg, res *SignupRes) error
	InviteResuest(arg *InviteRequestArg, res *InviteRequestRes) error
}

func RegisterSignup(server *rpc.Server, i SignupInterface) error {
	return server.RegisterName("keybase.1.signup", i)
}
