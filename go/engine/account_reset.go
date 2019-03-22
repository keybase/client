// This engine enters a user into the reset pipeline.
package engine

import (
	"github.com/keybase/client/go/libkb"
)

// AccountReset is an engine.
type AccountReset struct {
	libkb.Contextified
	usernameOrEmail string
}

// NewAccountReset creates a AccountReset engine.
func NewAccountReset(g *libkb.GlobalContext, usernameOrEmail string) *AccountReset {
	return &AccountReset{
		Contextified:    libkb.NewContextified(g),
		usernameOrEmail: usernameOrEmail,
	}
}

// Name is the unique engine name.
func (e *AccountReset) Name() string {
	return "AccountReset"
}

// Prereqs returns the engine prereqs.
func (e *AccountReset) Prereqs() Prereqs {
	return Prereqs{}
}

// RequiredUIs returns the required UIs.
func (e *AccountReset) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{
		libkb.SecretUIKind,
	}
}

// SubConsumers returns the other UI consumers for this engine.
func (e *AccountReset) SubConsumers() []libkb.UIConsumer {
	return nil
}

// Run starts the engine.
func (e *AccountReset) Run(mctx libkb.MetaContext) (err error) {
	mctx = mctx.WithLogTag("RST")
	defer mctx.TraceTimed("Account#Run", func() error { return err })()

	// User's with active devices cannot reset at all
	if mctx.ActiveDevice().Valid() {
		return libkb.ResetWithActiveDeviceError{}
	}

	// We can enter the reset pipeline with exactly one of these parameters
	// set. We first attempt to establish a session for the user. Otherwise we
	// send up an email or username.
	var self bool
	var username, email string

	mctx = mctx.WithNewProvisionalLoginContext()
	err = libkb.PassphraseLoginPrompt(mctx, e.usernameOrEmail, 3)
	switch err.(type) {
	case nil:
		self = true
		tokener, err := libkb.NewSessionTokener(mctx)
		if err != nil {
			return err
		}
		mctx = mctx.WithAPITokener(tokener)
	case
		// ignore these errors since we can verify the reset process from usernameOrEmail
		libkb.NoUIError,
		libkb.PassphraseError,
		libkb.RetryExhaustedError,
		libkb.InputCanceledError,
		libkb.SkipSecretPromptError:
		mctx.Debug("unable to make NewSessionTokener: %v, charging forward without it", err)
		if len(e.usernameOrEmail) == 0 {
			return libkb.NewResetMissingParamsError("Unable to start autoreset process, unable to establish session, no username or email provided")
		}

		if libkb.CheckEmail.F(e.usernameOrEmail) {
			email = e.usernameOrEmail
		} else {
			username = e.usernameOrEmail
		}
	default:
		return err
	}

	// NOTE `uid` field currently unused. Drop if we don't find a use for it.
	_, err = mctx.G().API.Post(mctx, libkb.APIArg{
		Endpoint:    "autoreset/enter",
		SessionType: libkb.APISessionTypeOPTIONAL,
		Args: libkb.HTTPArgs{
			"username": libkb.S{Val: username},
			"email":    libkb.S{Val: email},
			"self":     libkb.B{Val: self},
		},
	})
	return err
}
