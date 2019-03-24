package libkb

import (
	"errors"
)

func EnterResetPipeline(mctx MetaContext, username, email string) (err error) {
	defer mctx.TraceTimed("EnterResetPipeline", func() error { return err })()
	// TODO CORE-10466, fully support the `uid` and `self` fields, we should
	// not attempt to enter the pipeline if the user has an active device. We
	// should establish a session with a passphrase if at is available.
	self := mctx.HasAnySession()
	if self { // clear out other args if we have a session.
		username = ""
		email = ""

		tokener, err := NewSessionTokener(mctx)
		if err != nil {
			return err
		}
		mctx = mctx.WithAPITokener(tokener)
	}
	_, err = mctx.G().API.Post(mctx, APIArg{
		Endpoint:    "autoreset/enter",
		SessionType: APISessionTypeNONIST,
		Args: HTTPArgs{
			"username": S{Val: username},
			"email":    S{Val: email},
			"self":     B{Val: self},
		},
	})
	return err
}

func CancelResetPipeline(mctx MetaContext) (err error) {
	defer mctx.TraceTimed("CancelResetPipeline", func() error { return err })()
	_, err = mctx.G().API.Post(mctx, APIArg{
		Endpoint:    "autoreset/cancel",
		SessionType: APISessionTypeREQUIRED,
		Args: HTTPArgs{
			"src": S{Val: "app"},
		},
	})
	return err
}

func ResetAccount(mctx MetaContext, username NormalizedUsername, passphrase string) (err error) {
	defer mctx.Trace("ResetAccount", func() error { return err })()
	return resetOrDeleteAccount(mctx, username, passphrase, "nuke")
}

func DeleteAccount(mctx MetaContext, username NormalizedUsername, passphrase string) (err error) {
	defer mctx.Trace("DeleteAccount", func() error { return err })()
	return resetOrDeleteAccount(mctx, username, passphrase, "delete")
}

func resetOrDeleteAccount(mctx MetaContext, username NormalizedUsername, passphrase string, endpoint string) (err error) {
	defer mctx.Trace("resetOrDeleteAccount", func() error { return err })()

	mctx = mctx.WithNewProvisionalLoginContext()
	err = PassphraseLoginNoPrompt(mctx, username.String(), passphrase)
	if err != nil {
		return err
	}
	pps := mctx.PassphraseStream()
	if pps == nil {
		return errors.New("unexpected nil passphrase stream")
	}

	pdpka, err := ComputeLoginPackage2(mctx, pps)
	if err != nil {
		return err
	}

	arg := APIArg{
		Endpoint:    endpoint,
		SessionType: APISessionTypeREQUIRED,
		Args:        NewHTTPArgs(),
	}
	pdpka.PopulateArgs(&arg.Args)
	_, err = mctx.G().API.Post(mctx, arg)
	return err
}
