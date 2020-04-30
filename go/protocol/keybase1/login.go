// Auto-generated to Go types and interfaces using avdl-compiler v1.4.9 (https://github.com/keybase/node-avdl-compiler)
//   Input file: avdl/keybase1/login.avdl

package keybase1

import (
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	context "golang.org/x/net/context"
	"time"
)

type ConfiguredAccount struct {
	Username        string   `codec:"username" json:"username"`
	Fullname        FullName `codec:"fullname" json:"fullname"`
	HasStoredSecret bool     `codec:"hasStoredSecret" json:"hasStoredSecret"`
	IsCurrent       bool     `codec:"isCurrent" json:"isCurrent"`
}

func (o ConfiguredAccount) DeepCopy() ConfiguredAccount {
	return ConfiguredAccount{
		Username:        o.Username,
		Fullname:        o.Fullname.DeepCopy(),
		HasStoredSecret: o.HasStoredSecret,
		IsCurrent:       o.IsCurrent,
	}
}

type GetConfiguredAccountsArg struct {
	SessionID int `codec:"sessionID" json:"sessionID"`
}

type LoginArg struct {
	SessionID    int          `codec:"sessionID" json:"sessionID"`
	DeviceType   DeviceTypeV2 `codec:"deviceType" json:"deviceType"`
	Username     string       `codec:"username" json:"username"`
	ClientType   ClientType   `codec:"clientType" json:"clientType"`
	DoUserSwitch bool         `codec:"doUserSwitch" json:"doUserSwitch"`
	PaperKey     string       `codec:"paperKey" json:"paperKey"`
	DeviceName   string       `codec:"deviceName" json:"deviceName"`
}

type LoginProvisionedDeviceArg struct {
	SessionID          int    `codec:"sessionID" json:"sessionID"`
	Username           string `codec:"username" json:"username"`
	NoPassphrasePrompt bool   `codec:"noPassphrasePrompt" json:"noPassphrasePrompt"`
}

type LoginWithPaperKeyArg struct {
	SessionID int    `codec:"sessionID" json:"sessionID"`
	Username  string `codec:"username" json:"username"`
}

type LogoutArg struct {
	SessionID   int  `codec:"sessionID" json:"sessionID"`
	Force       bool `codec:"force" json:"force"`
	KeepSecrets bool `codec:"keepSecrets" json:"keepSecrets"`
}

type DeprovisionArg struct {
	SessionID int    `codec:"sessionID" json:"sessionID"`
	Username  string `codec:"username" json:"username"`
	DoRevoke  bool   `codec:"doRevoke" json:"doRevoke"`
}

type RecoverAccountFromEmailAddressArg struct {
	Email string `codec:"email" json:"email"`
}

type RecoverPassphraseArg struct {
	SessionID int    `codec:"sessionID" json:"sessionID"`
	Username  string `codec:"username" json:"username"`
}

type PaperKeyArg struct {
	SessionID int `codec:"sessionID" json:"sessionID"`
}

type PaperKeySubmitArg struct {
	SessionID   int    `codec:"sessionID" json:"sessionID"`
	PaperPhrase string `codec:"paperPhrase" json:"paperPhrase"`
}

type UnlockArg struct {
	SessionID int `codec:"sessionID" json:"sessionID"`
}

type UnlockWithPassphraseArg struct {
	SessionID  int    `codec:"sessionID" json:"sessionID"`
	Passphrase string `codec:"passphrase" json:"passphrase"`
}

type AccountDeleteArg struct {
	SessionID  int     `codec:"sessionID" json:"sessionID"`
	Passphrase *string `codec:"passphrase,omitempty" json:"passphrase,omitempty"`
}

type LoginOneshotArg struct {
	SessionID int    `codec:"sessionID" json:"sessionID"`
	Username  string `codec:"username" json:"username"`
	PaperKey  string `codec:"paperKey" json:"paperKey"`
}

type IsOnlineArg struct {
}

type LoginInterface interface {
	// Returns an array of information about accounts configured on the local
	// machine. Currently configured accounts are defined as those that have stored
	// secrets, but this definition may be expanded in the future.
	GetConfiguredAccounts(context.Context, int) ([]ConfiguredAccount, error)
	// Performs login.  deviceType should be keybase1.DeviceTypeV2_DESKTOP
	// or keybase1.DeviceTypeV2_MOBILE. username is optional. If the current
	// device isn't provisioned, this function will provision it.
	Login(context.Context, LoginArg) error
	// Login a user only if the user is on a provisioned device. Username is optional.
	// If noPassphrasePrompt is set, then only a stored secret will be used to unlock
	// the device keys.
	LoginProvisionedDevice(context.Context, LoginProvisionedDeviceArg) error
	// Login and unlock by
	// - trying unlocked device keys if available
	// - prompting for a paper key and using that
	LoginWithPaperKey(context.Context, LoginWithPaperKeyArg) error
	Logout(context.Context, LogoutArg) error
	Deprovision(context.Context, DeprovisionArg) error
	RecoverAccountFromEmailAddress(context.Context, string) error
	// Guide the user through possibilities of changing their passphrase.
	// Lets them change their passphrase using a paper key or enter the reset pipeline.
	RecoverPassphrase(context.Context, RecoverPassphraseArg) error
	// PaperKey generates paper backup keys for restoring an account.
	// It calls login_ui.displayPaperKeyPhrase with the phrase.
	PaperKey(context.Context, int) error
	// paperKeySubmit checks that paperPhrase is a valid paper key
	// for the logged in user, caches the keys, and sends a notification.
	PaperKeySubmit(context.Context, PaperKeySubmitArg) error
	// Unlock restores access to local key store by priming passphrase stream cache.
	Unlock(context.Context, int) error
	UnlockWithPassphrase(context.Context, UnlockWithPassphraseArg) error
	// accountDelete deletes the current user's account.
	AccountDelete(context.Context, AccountDeleteArg) error
	// loginOneshot allows a service to have a "onetime login", without
	// provisioning a device. It bootstraps credentials with the given
	// paperkey
	LoginOneshot(context.Context, LoginOneshotArg) error
	// isOnline returns whether the device is able to open a connection to keybase.io.
	// Used for determining whether to offer proxy settings on the login screen.
	IsOnline(context.Context) (bool, error)
}

func LoginProtocol(i LoginInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.login",
		Methods: map[string]rpc.ServeHandlerDescription{
			"getConfiguredAccounts": {
				MakeArg: func() interface{} {
					var ret [1]GetConfiguredAccountsArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]GetConfiguredAccountsArg)
					if !ok {
						err = rpc.NewTypeError((*[1]GetConfiguredAccountsArg)(nil), args)
						return
					}
					ret, err = i.GetConfiguredAccounts(ctx, typedArgs[0].SessionID)
					return
				},
			},
			"login": {
				MakeArg: func() interface{} {
					var ret [1]LoginArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]LoginArg)
					if !ok {
						err = rpc.NewTypeError((*[1]LoginArg)(nil), args)
						return
					}
					err = i.Login(ctx, typedArgs[0])
					return
				},
			},
			"loginProvisionedDevice": {
				MakeArg: func() interface{} {
					var ret [1]LoginProvisionedDeviceArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]LoginProvisionedDeviceArg)
					if !ok {
						err = rpc.NewTypeError((*[1]LoginProvisionedDeviceArg)(nil), args)
						return
					}
					err = i.LoginProvisionedDevice(ctx, typedArgs[0])
					return
				},
			},
			"loginWithPaperKey": {
				MakeArg: func() interface{} {
					var ret [1]LoginWithPaperKeyArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]LoginWithPaperKeyArg)
					if !ok {
						err = rpc.NewTypeError((*[1]LoginWithPaperKeyArg)(nil), args)
						return
					}
					err = i.LoginWithPaperKey(ctx, typedArgs[0])
					return
				},
			},
			"logout": {
				MakeArg: func() interface{} {
					var ret [1]LogoutArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]LogoutArg)
					if !ok {
						err = rpc.NewTypeError((*[1]LogoutArg)(nil), args)
						return
					}
					err = i.Logout(ctx, typedArgs[0])
					return
				},
			},
			"deprovision": {
				MakeArg: func() interface{} {
					var ret [1]DeprovisionArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]DeprovisionArg)
					if !ok {
						err = rpc.NewTypeError((*[1]DeprovisionArg)(nil), args)
						return
					}
					err = i.Deprovision(ctx, typedArgs[0])
					return
				},
			},
			"recoverAccountFromEmailAddress": {
				MakeArg: func() interface{} {
					var ret [1]RecoverAccountFromEmailAddressArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]RecoverAccountFromEmailAddressArg)
					if !ok {
						err = rpc.NewTypeError((*[1]RecoverAccountFromEmailAddressArg)(nil), args)
						return
					}
					err = i.RecoverAccountFromEmailAddress(ctx, typedArgs[0].Email)
					return
				},
			},
			"recoverPassphrase": {
				MakeArg: func() interface{} {
					var ret [1]RecoverPassphraseArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]RecoverPassphraseArg)
					if !ok {
						err = rpc.NewTypeError((*[1]RecoverPassphraseArg)(nil), args)
						return
					}
					err = i.RecoverPassphrase(ctx, typedArgs[0])
					return
				},
			},
			"paperKey": {
				MakeArg: func() interface{} {
					var ret [1]PaperKeyArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]PaperKeyArg)
					if !ok {
						err = rpc.NewTypeError((*[1]PaperKeyArg)(nil), args)
						return
					}
					err = i.PaperKey(ctx, typedArgs[0].SessionID)
					return
				},
			},
			"paperKeySubmit": {
				MakeArg: func() interface{} {
					var ret [1]PaperKeySubmitArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]PaperKeySubmitArg)
					if !ok {
						err = rpc.NewTypeError((*[1]PaperKeySubmitArg)(nil), args)
						return
					}
					err = i.PaperKeySubmit(ctx, typedArgs[0])
					return
				},
			},
			"unlock": {
				MakeArg: func() interface{} {
					var ret [1]UnlockArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]UnlockArg)
					if !ok {
						err = rpc.NewTypeError((*[1]UnlockArg)(nil), args)
						return
					}
					err = i.Unlock(ctx, typedArgs[0].SessionID)
					return
				},
			},
			"unlockWithPassphrase": {
				MakeArg: func() interface{} {
					var ret [1]UnlockWithPassphraseArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]UnlockWithPassphraseArg)
					if !ok {
						err = rpc.NewTypeError((*[1]UnlockWithPassphraseArg)(nil), args)
						return
					}
					err = i.UnlockWithPassphrase(ctx, typedArgs[0])
					return
				},
			},
			"accountDelete": {
				MakeArg: func() interface{} {
					var ret [1]AccountDeleteArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]AccountDeleteArg)
					if !ok {
						err = rpc.NewTypeError((*[1]AccountDeleteArg)(nil), args)
						return
					}
					err = i.AccountDelete(ctx, typedArgs[0])
					return
				},
			},
			"loginOneshot": {
				MakeArg: func() interface{} {
					var ret [1]LoginOneshotArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]LoginOneshotArg)
					if !ok {
						err = rpc.NewTypeError((*[1]LoginOneshotArg)(nil), args)
						return
					}
					err = i.LoginOneshot(ctx, typedArgs[0])
					return
				},
			},
			"isOnline": {
				MakeArg: func() interface{} {
					var ret [1]IsOnlineArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					ret, err = i.IsOnline(ctx)
					return
				},
			},
		},
	}
}

type LoginClient struct {
	Cli rpc.GenericClient
}

// Returns an array of information about accounts configured on the local
// machine. Currently configured accounts are defined as those that have stored
// secrets, but this definition may be expanded in the future.
func (c LoginClient) GetConfiguredAccounts(ctx context.Context, sessionID int) (res []ConfiguredAccount, err error) {
	__arg := GetConfiguredAccountsArg{SessionID: sessionID}
	err = c.Cli.Call(ctx, "keybase.1.login.getConfiguredAccounts", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

// Performs login.  deviceType should be keybase1.DeviceTypeV2_DESKTOP
// or keybase1.DeviceTypeV2_MOBILE. username is optional. If the current
// device isn't provisioned, this function will provision it.
func (c LoginClient) Login(ctx context.Context, __arg LoginArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.login.login", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

// Login a user only if the user is on a provisioned device. Username is optional.
// If noPassphrasePrompt is set, then only a stored secret will be used to unlock
// the device keys.
func (c LoginClient) LoginProvisionedDevice(ctx context.Context, __arg LoginProvisionedDeviceArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.login.loginProvisionedDevice", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

// Login and unlock by
// - trying unlocked device keys if available
// - prompting for a paper key and using that
func (c LoginClient) LoginWithPaperKey(ctx context.Context, __arg LoginWithPaperKeyArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.login.loginWithPaperKey", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c LoginClient) Logout(ctx context.Context, __arg LogoutArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.login.logout", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c LoginClient) Deprovision(ctx context.Context, __arg DeprovisionArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.login.deprovision", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c LoginClient) RecoverAccountFromEmailAddress(ctx context.Context, email string) (err error) {
	__arg := RecoverAccountFromEmailAddressArg{Email: email}
	err = c.Cli.Call(ctx, "keybase.1.login.recoverAccountFromEmailAddress", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

// Guide the user through possibilities of changing their passphrase.
// Lets them change their passphrase using a paper key or enter the reset pipeline.
func (c LoginClient) RecoverPassphrase(ctx context.Context, __arg RecoverPassphraseArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.login.recoverPassphrase", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

// PaperKey generates paper backup keys for restoring an account.
// It calls login_ui.displayPaperKeyPhrase with the phrase.
func (c LoginClient) PaperKey(ctx context.Context, sessionID int) (err error) {
	__arg := PaperKeyArg{SessionID: sessionID}
	err = c.Cli.Call(ctx, "keybase.1.login.paperKey", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

// paperKeySubmit checks that paperPhrase is a valid paper key
// for the logged in user, caches the keys, and sends a notification.
func (c LoginClient) PaperKeySubmit(ctx context.Context, __arg PaperKeySubmitArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.login.paperKeySubmit", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

// Unlock restores access to local key store by priming passphrase stream cache.
func (c LoginClient) Unlock(ctx context.Context, sessionID int) (err error) {
	__arg := UnlockArg{SessionID: sessionID}
	err = c.Cli.Call(ctx, "keybase.1.login.unlock", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c LoginClient) UnlockWithPassphrase(ctx context.Context, __arg UnlockWithPassphraseArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.login.unlockWithPassphrase", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

// accountDelete deletes the current user's account.
func (c LoginClient) AccountDelete(ctx context.Context, __arg AccountDeleteArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.login.accountDelete", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

// loginOneshot allows a service to have a "onetime login", without
// provisioning a device. It bootstraps credentials with the given
// paperkey
func (c LoginClient) LoginOneshot(ctx context.Context, __arg LoginOneshotArg) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.login.loginOneshot", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

// isOnline returns whether the device is able to open a connection to keybase.io.
// Used for determining whether to offer proxy settings on the login screen.
func (c LoginClient) IsOnline(ctx context.Context) (res bool, err error) {
	err = c.Cli.Call(ctx, "keybase.1.login.isOnline", []interface{}{IsOnlineArg{}}, &res, 0*time.Millisecond)
	return
}
