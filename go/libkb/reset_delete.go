package libkb

import (
	"errors"
)

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
