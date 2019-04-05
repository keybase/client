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
	usernameOrEmail   string
	reuseLoginContext bool
	resetPending      bool
	resetComplete     bool
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
func (e *AccountReset) Run(m libkb.MetaContext) (err error) {
	m = m.WithLogTag("RST")
	defer m.TraceTimed("Account#Run", func() error { return err })()

	// User's with active devices cannot reset at all
	if m.ActiveDevice().Valid() {
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
	if !e.reuseLoginContext {
		m = m.WithNewProvisionalLoginContext()
	}
	err = libkb.PassphraseLoginPromptWithArg(m, 3, arg)
	switch err.(type) {
	case nil:
		self = true
		tokener, err := libkb.NewSessionTokener(m)
		if err != nil {
			return err
		}
		m = m.WithAPITokener(tokener)
	case
		// ignore these errors since we can verify the reset process from usernameOrEmail
		libkb.NoUIError,
		libkb.PassphraseError,
		libkb.RetryExhaustedError,
		libkb.InputCanceledError,
		libkb.SkipSecretPromptError:
		m.Debug("unable to make NewSessionTokener: %v, charging forward without it", err)
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
		eventType, readyTime, err := e.checkStatus(m)
		if err != nil {
			return err
		}
		if eventType != 0 && err == nil {
			return e.resetPrompt(m, eventType, readyTime)
		}
	}

	// NOTE `uid` field currently unused. Drop if we don't find a use for it.
	_, err = m.G().API.Post(m, libkb.APIArg{
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
	m.G().Log.Info("Your account has been added to the reset pipeline.")
	e.resetPending = true
	return nil
}

func (e *AccountReset) checkStatus(m libkb.MetaContext) (int, time.Time, error) {
	// Check the status first
	res, err := m.G().API.Get(m, libkb.APIArg{
		Endpoint:    "autoreset/status",
		SessionType: libkb.APISessionTypeREQUIRED,
	})
	if err != nil {
		return 0, time.Time{}, err
	}

	resetID := res.Body.AtKey("reset_id")
	if resetID.IsNil() {
		// There's no autoreset pending
		return 0, time.Time{}, nil
	}

	eventTimeStr, err := res.Body.AtKey("event_time").GetString()
	if err != nil {
		return 0, time.Time{}, err
	}
	eventTime, err := time.Parse(time.RFC3339, eventTimeStr)
	if err != nil {
		return 0, time.Time{}, err
	}
	delaySecs, err := res.Body.AtKey("delay_secs").GetInt()
	if err != nil {
		return 0, time.Time{}, err
	}
	eventType, err := res.Body.AtKey("event_type").GetInt()
	if err != nil {
		return 0, time.Time{}, err
	}

	return eventType, eventTime.Add(time.Second * time.Duration(delaySecs)), nil
}

func (e *AccountReset) resetPrompt(m libkb.MetaContext, eventType int, readyTime time.Time) error {
	// Ask the user if they'd like to reset
	if eventType == libkb.AutoresetEventReady {
		shouldReset, err := m.UIs().LoginUI.PromptResetAccount(m.Ctx(), keybase1.PromptResetAccountArg{
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
		if _, err := m.G().API.Post(m, arg); err != nil {
			return err
		}
		m.G().Log.Info("Your account has been reset.")

		e.resetComplete = true

		return nil
	}

	if eventType != libkb.AutoresetEventVerify {
		// Race condition against autoresetd. We've probably just canceled or reset.
		return nil
	}

	// Notify the user how much time is left
	if err := m.UIs().LoginUI.DisplayResetProgress(m.Ctx(), keybase1.DisplayResetProgressArg{
		Text: fmt.Sprintf(
			"You will be able to reset your account in %s.",
			humanize.Time(readyTime),
		),
	}); err != nil {
		return err
	}
	e.resetPending = true
	return nil
}
