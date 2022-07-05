// Auto-generated to Go types and interfaces using avdl-compiler v1.4.9 (https://github.com/keybase/node-avdl-compiler)
//   Input file: avdl/keybase1/account.avdl

package keybase1

import (
	gregor1 "github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	context "golang.org/x/net/context"
	"time"
)

type HasServerKeysRes struct {
	HasServerKeys bool `codec:"hasServerKeys" json:"hasServerKeys"`
}

func (o HasServerKeysRes) DeepCopy() HasServerKeysRes {
	return HasServerKeysRes{
		HasServerKeys: o.HasServerKeys,
	}
}

type LockdownHistory struct {
	Status       bool     `codec:"status" json:"status"`
	CreationTime Time     `codec:"creationTime" json:"ctime"`
	DeviceID     DeviceID `codec:"deviceID" json:"device_id"`
	DeviceName   string   `codec:"deviceName" json:"deviceName"`
}

func (o LockdownHistory) DeepCopy() LockdownHistory {
	return LockdownHistory{
		Status:       o.Status,
		CreationTime: o.CreationTime.DeepCopy(),
		DeviceID:     o.DeviceID.DeepCopy(),
		DeviceName:   o.DeviceName,
	}
}

type GetLockdownResponse struct {
	History []LockdownHistory `codec:"history" json:"history"`
	Status  bool              `codec:"status" json:"status"`
}

func (o GetLockdownResponse) DeepCopy() GetLockdownResponse {
	return GetLockdownResponse{
		History: (func(x []LockdownHistory) []LockdownHistory {
			if x == nil {
				return nil
			}
			ret := make([]LockdownHistory, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.History),
		Status: o.Status,
	}
}

type TeamContactSettings struct {
	TeamID  TeamID `codec:"teamID" json:"team_id"`
	Enabled bool   `codec:"enabled" json:"enabled"`
}

func (o TeamContactSettings) DeepCopy() TeamContactSettings {
	return TeamContactSettings{
		TeamID:  o.TeamID.DeepCopy(),
		Enabled: o.Enabled,
	}
}

type ContactSettings struct {
	Version              *int                  `codec:"version,omitempty" json:"version,omitempty"`
	AllowFolloweeDegrees int                   `codec:"allowFolloweeDegrees" json:"allow_followee_degrees"`
	AllowGoodTeams       bool                  `codec:"allowGoodTeams" json:"allow_good_teams"`
	Enabled              bool                  `codec:"enabled" json:"enabled"`
	Teams                []TeamContactSettings `codec:"teams" json:"teams"`
}

func (o ContactSettings) DeepCopy() ContactSettings {
	return ContactSettings{
		Version: (func(x *int) *int {
			if x == nil {
				return nil
			}
			tmp := (*x)
			return &tmp
		})(o.Version),
		AllowFolloweeDegrees: o.AllowFolloweeDegrees,
		AllowGoodTeams:       o.AllowGoodTeams,
		Enabled:              o.Enabled,
		Teams: (func(x []TeamContactSettings) []TeamContactSettings {
			if x == nil {
				return nil
			}
			ret := make([]TeamContactSettings, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.Teams),
	}
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

type PassphraseCheckArg struct {
	SessionID  int    `codec:"sessionID" json:"sessionID"`
	Passphrase string `codec:"passphrase" json:"passphrase"`
}

type EmailChangeArg struct {
	SessionID int    `codec:"sessionID" json:"sessionID"`
	NewEmail  string `codec:"newEmail" json:"newEmail"`
}

type HasServerKeysArg struct {
	SessionID int `codec:"sessionID" json:"sessionID"`
}

type ResetAccountArg struct {
	SessionID  int    `codec:"sessionID" json:"sessionID"`
	Passphrase string `codec:"passphrase" json:"passphrase"`
}

type GetLockdownModeArg struct {
	SessionID int `codec:"sessionID" json:"sessionID"`
}

type SetLockdownModeArg struct {
	SessionID int  `codec:"sessionID" json:"sessionID"`
	Enabled   bool `codec:"enabled" json:"enabled"`
}

type RecoverUsernameWithEmailArg struct {
	SessionID int    `codec:"sessionID" json:"sessionID"`
	Email     string `codec:"email" json:"email"`
}

type RecoverUsernameWithPhoneArg struct {
	SessionID int         `codec:"sessionID" json:"sessionID"`
	Phone     PhoneNumber `codec:"phone" json:"phone"`
}

type EnterResetPipelineArg struct {
	SessionID       int    `codec:"sessionID" json:"sessionID"`
	UsernameOrEmail string `codec:"usernameOrEmail" json:"usernameOrEmail"`
	Passphrase      string `codec:"passphrase" json:"passphrase"`
	Interactive     bool   `codec:"interactive" json:"interactive"`
}

type CancelResetArg struct {
	SessionID int `codec:"sessionID" json:"sessionID"`
}

type TimeTravelResetArg struct {
	SessionID int                 `codec:"sessionID" json:"sessionID"`
	Username  string              `codec:"username" json:"username"`
	Duration  gregor1.DurationSec `codec:"duration" json:"duration"`
}

type GuessCurrentLocationArg struct {
	SessionID      int    `codec:"sessionID" json:"sessionID"`
	DefaultCountry string `codec:"defaultCountry" json:"defaultCountry"`
}

type UserGetContactSettingsArg struct {
}

type UserSetContactSettingsArg struct {
	Settings ContactSettings `codec:"settings" json:"settings"`
}

type AccountInterface interface {
	// Change the passphrase from old to new. If old isn't set, and force is false,
	// then prompt at the UI for it. If old isn't set and force is true, then
	// we'll try to force a passphrase change.
	PassphraseChange(context.Context, PassphraseChangeArg) error
	PassphrasePrompt(context.Context, PassphrasePromptArg) (GetPassphraseRes, error)
	// * Check if user passphrase matches argument. Launches SecretUI prompt if
	// * passphrase argument is empty. Returns `true` if passphrase is correct,
	// * false if not, or an error if something else went wrong.
	PassphraseCheck(context.Context, PassphraseCheckArg) (bool, error)
	// * change email to the new given email by signing a statement.
	EmailChange(context.Context, EmailChangeArg) error
	// * Whether the logged-in user has uploaded private keys
	// * Will error if not logged in.
	HasServerKeys(context.Context, int) (HasServerKeysRes, error)
	// resetAccount resets the user's account. It is used in the CLI.
	// passphrase is optional and will be prompted for if not supplied.
	ResetAccount(context.Context, ResetAccountArg) error
	GetLockdownMode(context.Context, int) (GetLockdownResponse, error)
	SetLockdownMode(context.Context, SetLockdownModeArg) error
	RecoverUsernameWithEmail(context.Context, RecoverUsernameWithEmailArg) error
	RecoverUsernameWithPhone(context.Context, RecoverUsernameWithPhoneArg) error
	// Start reset process for the user based on their username or email.  If
	// neither are known the user will be prompted for their passphrase to start
	// the process.
	// TODO: change this to just username
	EnterResetPipeline(context.Context, EnterResetPipelineArg) error
	// Aborts the reset process
	CancelReset(context.Context, int) error
	TimeTravelReset(context.Context, TimeTravelResetArg) error
	GuessCurrentLocation(context.Context, GuessCurrentLocationArg) (string, error)
	UserGetContactSettings(context.Context) (ContactSettings, error)
	UserSetContactSettings(context.Context, ContactSettings) error
}

func AccountProtocol(i AccountInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.account",
		Methods: map[string]rpc.ServeHandlerDescription{
			"passphraseChange": {
				MakeArg: func() interface{} {
					var ret [1]PassphraseChangeArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]PassphraseChangeArg)
					if !ok {
						err = rpc.NewTypeError((*[1]PassphraseChangeArg)(nil), args)
						return
					}
					err = i.PassphraseChange(ctx, typedArgs[0])
					return
				},
			},
			"passphrasePrompt": {
				MakeArg: func() interface{} {
					var ret [1]PassphrasePromptArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]PassphrasePromptArg)
					if !ok {
						err = rpc.NewTypeError((*[1]PassphrasePromptArg)(nil), args)
						return
					}
					ret, err = i.PassphrasePrompt(ctx, typedArgs[0])
					return
				},
			},
			"passphraseCheck": {
				MakeArg: func() interface{} {
					var ret [1]PassphraseCheckArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]PassphraseCheckArg)
					if !ok {
						err = rpc.NewTypeError((*[1]PassphraseCheckArg)(nil), args)
						return
					}
					ret, err = i.PassphraseCheck(ctx, typedArgs[0])
					return
				},
			},
			"emailChange": {
				MakeArg: func() interface{} {
					var ret [1]EmailChangeArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]EmailChangeArg)
					if !ok {
						err = rpc.NewTypeError((*[1]EmailChangeArg)(nil), args)
						return
					}
					err = i.EmailChange(ctx, typedArgs[0])
					return
				},
			},
			"hasServerKeys": {
				MakeArg: func() interface{} {
					var ret [1]HasServerKeysArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]HasServerKeysArg)
					if !ok {
						err = rpc.NewTypeError((*[1]HasServerKeysArg)(nil), args)
						return
					}
					ret, err = i.HasServerKeys(ctx, typedArgs[0].SessionID)
					return
				},
			},
			"resetAccount": {
				MakeArg: func() interface{} {
					var ret [1]ResetAccountArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]ResetAccountArg)
					if !ok {
						err = rpc.NewTypeError((*[1]ResetAccountArg)(nil), args)
						return
					}
					err = i.ResetAccount(ctx, typedArgs[0])
					return
				},
			},
			"getLockdownMode": {
				MakeArg: func() interface{} {
					var ret [1]GetLockdownModeArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]GetLockdownModeArg)
					if !ok {
						err = rpc.NewTypeError((*[1]GetLockdownModeArg)(nil), args)
						return
					}
					ret, err = i.GetLockdownMode(ctx, typedArgs[0].SessionID)
					return
				},
			},
			"setLockdownMode": {
				MakeArg: func() interface{} {
					var ret [1]SetLockdownModeArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]SetLockdownModeArg)
					if !ok {
						err = rpc.NewTypeError((*[1]SetLockdownModeArg)(nil), args)
						return
					}
					err = i.SetLockdownMode(ctx, typedArgs[0])
					return
				},
			},
			"recoverUsernameWithEmail": {
				MakeArg: func() interface{} {
					var ret [1]RecoverUsernameWithEmailArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]RecoverUsernameWithEmailArg)
					if !ok {
						err = rpc.NewTypeError((*[1]RecoverUsernameWithEmailArg)(nil), args)
						return
					}
					err = i.RecoverUsernameWithEmail(ctx, typedArgs[0])
					return
				},
			},
			"recoverUsernameWithPhone": {
				MakeArg: func() interface{} {
					var ret [1]RecoverUsernameWithPhoneArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]RecoverUsernameWithPhoneArg)
					if !ok {
						err = rpc.NewTypeError((*[1]RecoverUsernameWithPhoneArg)(nil), args)
						return
					}
					err = i.RecoverUsernameWithPhone(ctx, typedArgs[0])
					return
				},
			},
			"enterResetPipeline": {
				MakeArg: func() interface{} {
					var ret [1]EnterResetPipelineArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]EnterResetPipelineArg)
					if !ok {
						err = rpc.NewTypeError((*[1]EnterResetPipelineArg)(nil), args)
						return
					}
					err = i.EnterResetPipeline(ctx, typedArgs[0])
					return
				},
			},
			"cancelReset": {
				MakeArg: func() interface{} {
					var ret [1]CancelResetArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]CancelResetArg)
					if !ok {
						err = rpc.NewTypeError((*[1]CancelResetArg)(nil), args)
						return
					}
					err = i.CancelReset(ctx, typedArgs[0].SessionID)
					return
				},
			},
			"timeTravelReset": {
				MakeArg: func() interface{} {
					var ret [1]TimeTravelResetArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]TimeTravelResetArg)
					if !ok {
						err = rpc.NewTypeError((*[1]TimeTravelResetArg)(nil), args)
						return
					}
					err = i.TimeTravelReset(ctx, typedArgs[0])
					return
				},
			},
			"guessCurrentLocation": {
				MakeArg: func() interface{} {
					var ret [1]GuessCurrentLocationArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]GuessCurrentLocationArg)
					if !ok {
						err = rpc.NewTypeError((*[1]GuessCurrentLocationArg)(nil), args)
						return
					}
					ret, err = i.GuessCurrentLocation(ctx, typedArgs[0])
					return
				},
			},
			"userGetContactSettings": {
				MakeArg: func() interface{} {
					var ret [1]UserGetContactSettingsArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					ret, err = i.UserGetContactSettings(ctx)
					return
				},
			},
			"userSetContactSettings": {
				MakeArg: func() interface{} {
					var ret [1]UserSetContactSettingsArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]UserSetContactSettingsArg)
					if !ok {
						err = rpc.NewTypeError((*[1]UserSetContactSettingsArg)(nil), args)
						return
					}
					err = i.UserSetContactSettings(ctx, typedArgs[0].Settings)
					return
				},
			},
		},
	}
}

type AccountClient struct {
	Cli rpc.GenericClient
}

// Change the passphrase from old to new. If old isn't set, and force is false,
// then prompt at the UI for it. If old isn't set and force is true, then
// we'll try to force a passphrase change.
func (c AccountClient) PassphraseChange(ctx context.Context, __arg PassphraseChangeArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.account.passphraseChange", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c AccountClient) PassphrasePrompt(ctx context.Context, __arg PassphrasePromptArg) (res GetPassphraseRes, err error) {
	err = c.Cli.Call(ctx, "keybase.1.account.passphrasePrompt", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

// * Check if user passphrase matches argument. Launches SecretUI prompt if
// * passphrase argument is empty. Returns `true` if passphrase is correct,
// * false if not, or an error if something else went wrong.
func (c AccountClient) PassphraseCheck(ctx context.Context, __arg PassphraseCheckArg) (res bool, err error) {
	err = c.Cli.Call(ctx, "keybase.1.account.passphraseCheck", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

// * change email to the new given email by signing a statement.
func (c AccountClient) EmailChange(ctx context.Context, __arg EmailChangeArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.account.emailChange", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

// * Whether the logged-in user has uploaded private keys
// * Will error if not logged in.
func (c AccountClient) HasServerKeys(ctx context.Context, sessionID int) (res HasServerKeysRes, err error) {
	__arg := HasServerKeysArg{SessionID: sessionID}
	err = c.Cli.Call(ctx, "keybase.1.account.hasServerKeys", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

// resetAccount resets the user's account. It is used in the CLI.
// passphrase is optional and will be prompted for if not supplied.
func (c AccountClient) ResetAccount(ctx context.Context, __arg ResetAccountArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.account.resetAccount", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c AccountClient) GetLockdownMode(ctx context.Context, sessionID int) (res GetLockdownResponse, err error) {
	__arg := GetLockdownModeArg{SessionID: sessionID}
	err = c.Cli.Call(ctx, "keybase.1.account.getLockdownMode", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c AccountClient) SetLockdownMode(ctx context.Context, __arg SetLockdownModeArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.account.setLockdownMode", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c AccountClient) RecoverUsernameWithEmail(ctx context.Context, __arg RecoverUsernameWithEmailArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.account.recoverUsernameWithEmail", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c AccountClient) RecoverUsernameWithPhone(ctx context.Context, __arg RecoverUsernameWithPhoneArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.account.recoverUsernameWithPhone", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

// Start reset process for the user based on their username or email.  If
// neither are known the user will be prompted for their passphrase to start
// the process.
// TODO: change this to just username
func (c AccountClient) EnterResetPipeline(ctx context.Context, __arg EnterResetPipelineArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.account.enterResetPipeline", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

// Aborts the reset process
func (c AccountClient) CancelReset(ctx context.Context, sessionID int) (err error) {
	__arg := CancelResetArg{SessionID: sessionID}
	err = c.Cli.Call(ctx, "keybase.1.account.cancelReset", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c AccountClient) TimeTravelReset(ctx context.Context, __arg TimeTravelResetArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.account.timeTravelReset", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c AccountClient) GuessCurrentLocation(ctx context.Context, __arg GuessCurrentLocationArg) (res string, err error) {
	err = c.Cli.Call(ctx, "keybase.1.account.guessCurrentLocation", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c AccountClient) UserGetContactSettings(ctx context.Context) (res ContactSettings, err error) {
	err = c.Cli.Call(ctx, "keybase.1.account.userGetContactSettings", []interface{}{UserGetContactSettingsArg{}}, &res, 0*time.Millisecond)
	return
}

func (c AccountClient) UserSetContactSettings(ctx context.Context, settings ContactSettings) (err error) {
	__arg := UserSetContactSettingsArg{Settings: settings}
	err = c.Cli.Call(ctx, "keybase.1.account.userSetContactSettings", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}
