package libkb

import (
	"fmt"

	keybase1 "github.com/keybase/client/go/protocol"
)

type KeyUnlocker struct {
	Tries          int
	Reason         string
	KeyDesc        string
	Which          string
	UseSecretStore bool
	UI             SecretUI
	Unlocker       func(pw string, storeSecret bool) (ret GenericKey, err error)
}

func (arg KeyUnlocker) Run() (ret GenericKey, err error) {
	var emsg string

	which := arg.Which
	if len(which) == 0 {
		which = "the"
	}
	desc := "Please enter " + which + " passphrase to unlock the secret key for:\n" +
		arg.KeyDesc + "\n"
	if len(arg.Reason) > 0 {
		desc = desc + "\nReason: " + arg.Reason
	}

	if arg.UI == nil {
		err = NoUIError{"secret"}
		return
	}

	prompt := "Your key passphrase"

	for i := 0; (arg.Tries <= 0 || i < arg.Tries) && ret == nil && err == nil; i++ {
		var res *keybase1.SecretEntryRes
		res, err = arg.UI.GetSecret(keybase1.SecretEntryArg{
			Err:            emsg,
			Desc:           desc,
			Prompt:         prompt,
			Reason:         arg.Reason,
			UseSecretStore: arg.UseSecretStore,
		}, nil)

		if err == nil && res.Canceled {
			err = CanceledError{"Attempt to unlock secret key entry canceled"}
		} else if err != nil {
			// noop
		} else if ret, err = arg.Unlocker(res.Text, res.StoreSecret); err == nil {
			// noop
		} else if _, ok := err.(PassphraseError); ok {
			emsg = "Failed to unlock key; bad passphrase"
			err = nil
		}
	}

	if ret == nil && err == nil {
		err = fmt.Errorf("Too many failures; giving up")
	}
	if err != nil {
		ret = nil
	}
	return
}
