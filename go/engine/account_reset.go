// This engine enters a user into the reset pipeline.
package engine

import (
	"fmt"
	"time"

	humanize "github.com/dustin/go-humanize"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

// AccountReset is an engine.
type AccountReset struct {
	libkb.Contextified
	usernameOrEmail string
	completeReset   bool

	resetPending  bool
	resetComplete bool
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
		libkb.LoginUIKind,
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

	arg := keybase1.GUIEntryArg{
		SubmitLabel: "Submit",
		CancelLabel: "I don't know",
		WindowTitle: "Keybase passphrase",
		Type:        keybase1.PassphraseType_PASS_PHRASE,
		Username:    e.usernameOrEmail,
		Prompt:      fmt.Sprintf("Please enter the Keybase password for %s (%d+ characters) if you know it", e.usernameOrEmail, libkb.MinPassphraseLength),
		Features: keybase1.GUIEntryFeatures{
			ShowTyping: keybase1.Feature{
				Allow:        true,
				DefaultValue: false,
				Readonly:     true,
				Label:        "Show typing",
			},
		},
	}

	// Reuse the existing login context whenever possible to prevent duplicate password prompts
	if mctx.LoginContext() == nil {
		mctx = mctx.WithNewProvisionalLoginContext()
	}
	err = libkb.PassphraseLoginPromptWithArg(mctx, 3, arg)
	switch err.(type) {
	case nil:
		self = true
	case
		// ignore these errors since we can verify the reset process from usernameOrEmail
		libkb.NoUIError,
		libkb.PassphraseError,
		libkb.RetryExhaustedError,
		libkb.InputCanceledError,
		libkb.SkipSecretPromptError:
		mctx.Debug("unable to create a session: %v, charging forward without it", err)
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

	if self {
		eventType, readyTime, err := e.checkStatus(mctx)
		if err != nil {
			return err
		}
		if eventType != libkb.AutoresetEventStart {
			return e.resetPrompt(mctx, eventType, readyTime)
		}
	}

	// NOTE `uid` field currently unused. Drop if we don't find a use for it.
	res, err := mctx.G().API.Post(mctx, libkb.APIArg{
		Endpoint:    "autoreset/enter",
		SessionType: libkb.APISessionTypeOPTIONAL,
		Args: libkb.HTTPArgs{
			"username": libkb.S{Val: username},
			"email":    libkb.S{Val: email},
			"self":     libkb.B{Val: self},
		},
	})
	if err != nil {
		return err
	}
	mctx.G().Log.Debug("autoreset/enter result: %s", res.Body.MarshalToDebug())
	mctx.G().Log.Info("Your account has been added to the reset pipeline.")
	e.resetPending = true
	return nil
}

func (e *AccountReset) checkStatus(mctx libkb.MetaContext) (int, time.Time, error) {
	// Check the status first
	res, err := mctx.G().API.Get(mctx, libkb.APIArg{
		Endpoint:    "autoreset/status",
		SessionType: libkb.APISessionTypeREQUIRED,
	})
	if err != nil {
		// Start is the same as not in pipeline
		return libkb.AutoresetEventStart, time.Time{}, err
	}

	resetID := res.Body.AtKey("reset_id")
	if resetID.IsNil() {
		// There's no autoreset pending
		return libkb.AutoresetEventStart, time.Time{}, nil
	}

	eventTimeStr, err := res.Body.AtKey("event_time").GetString()
	if err != nil {
		return libkb.AutoresetEventStart, time.Time{}, err
	}
	eventTime, err := time.Parse(time.RFC3339, eventTimeStr)
	if err != nil {
		return libkb.AutoresetEventStart, time.Time{}, err
	}
	delaySecs, err := res.Body.AtKey("delay_secs").GetInt()
	if err != nil {
		return libkb.AutoresetEventStart, time.Time{}, err
	}
	eventType, err := res.Body.AtKey("event_type").GetInt()
	if err != nil {
		return libkb.AutoresetEventStart, time.Time{}, err
	}

	return eventType, eventTime.Add(time.Second * time.Duration(delaySecs)), nil
}

func (e *AccountReset) resetPrompt(mctx libkb.MetaContext, eventType int, readyTime time.Time) error {
	if eventType == libkb.AutoresetEventReady && e.completeReset {
		// Ask the user if they'd like to reset if we're in login + it's ready
		shouldReset, err := mctx.UIs().LoginUI.PromptResetAccount(mctx.Ctx(), keybase1.PromptResetAccountArg{
			Text: "Would you like to complete the reset of your account?",
		})
		if err != nil {
			return err
		}
		if !shouldReset {
			// noop
			return nil
		}

		arg := libkb.NewAPIArg("autoreset/reset")
		arg.SessionType = libkb.APISessionTypeREQUIRED
		payload := libkb.JSONPayload{
			"src": "app",
		}
		arg.JSONPayload = payload
		if _, err := mctx.G().API.Post(mctx, arg); err != nil {
			return err
		}
		mctx.G().Log.Info("Your account has been reset.")

		e.resetComplete = true

		return nil
	}

	if eventType != libkb.AutoresetEventVerify {
		// Race condition against autoresetd. We've probably just canceled or reset.
		return nil
	}

	// Notify the user how much time is left / if they can already reset
	var notificationText string
	switch eventType {
	case libkb.AutoresetEventReady:
		notificationText = "Your account reset is ready! Log in to complete the process."
	default:
		notificationText = fmt.Sprintf(
			"You will be able to reset your account in %s.",
			humanize.Time(readyTime),
		)
	}
	if err := mctx.UIs().LoginUI.DisplayResetProgress(mctx.Ctx(), keybase1.DisplayResetProgressArg{
		Text: notificationText,
	}); err != nil {
		return err
	}
	e.resetPending = true
	return nil
}
