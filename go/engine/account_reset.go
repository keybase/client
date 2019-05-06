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
	usernameOrEmail    string
	skipPasswordPrompt bool
	completeReset      bool

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

	if e.skipPasswordPrompt {
		// Parent engine requested a flow where we shouldn't ask for a password
		username, email, err = e.processUsernameOrEmail()
		if err != nil {
			return err
		}
	} else {
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
			mctx.Debug("unable to authenticate a session: %v, charging forward without it", err)
			username, email, err = e.processUsernameOrEmail()
			if err != nil {
				return err
			}
		default:
			return err
		}

		if self {
			status, err := e.loadResetStatus(mctx)
			if err != nil {
				return err
			}
			if status.ResetID != nil {
				return e.resetPrompt(mctx, status)
			}
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

func (e *AccountReset) processUsernameOrEmail() (username string, email string, err error) {
	if len(e.usernameOrEmail) == 0 {
		err = libkb.NewResetMissingParamsError("Unable to start autoreset process, unable to establish session, no username or email provided")
		return
	}

	if libkb.CheckEmail.F(e.usernameOrEmail) {
		email = e.usernameOrEmail
	} else {
		username = e.usernameOrEmail
	}
	return
}

type accountResetStatusResponse struct {
	ResetID   *string `json:"reset_id"`
	EventTime string  `json:"event_time"`
	DelaySecs int     `json:"delay_secs"`
	EventType int     `json:"event_type"`
}

func (a *accountResetStatusResponse) ReadyTime() (time.Time, error) {
	eventTime, err := time.Parse(time.RFC3339, a.EventTime)
	if err != nil {
		return time.Time{}, err
	}

	return eventTime.Add(time.Second * time.Duration(a.DelaySecs)), nil
}

func (e *AccountReset) loadResetStatus(mctx libkb.MetaContext) (*accountResetStatusResponse, error) {
	// Check the status first
	res, err := mctx.G().API.Get(mctx, libkb.APIArg{
		Endpoint:    "autoreset/status",
		SessionType: libkb.APISessionTypeREQUIRED,
	})
	if err != nil {
		return nil, err
	}

	parsedResponse := accountResetStatusResponse{}
	if err := res.Body.UnmarshalAgain(&parsedResponse); err != nil {
		return nil, err
	}

	return &parsedResponse, nil
}

func (e *AccountReset) resetPrompt(mctx libkb.MetaContext, status *accountResetStatusResponse) error {
	if status.EventType == libkb.AutoresetEventReady && e.completeReset {
		// Ask the user if they'd like to reset if we're in login + it's ready
		shouldReset, err := mctx.UIs().LoginUI.PromptResetAccount(mctx.Ctx(), keybase1.PromptResetAccountArg{
			Kind: keybase1.ResetPromptType_COMPLETE,
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

	if status.EventType != libkb.AutoresetEventVerify {
		// Race condition against autoresetd. We've probably just canceled or reset.
		return nil
	}

	readyTime, err := status.ReadyTime()
	if err != nil {
		return err
	}

	// Notify the user how much time is left / if they can reset
	var notificationText string
	switch status.EventType {
	case libkb.AutoresetEventReady:
		notificationText = "Please log in to finish resetting your account."
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

func (e *AccountReset) ResetPending() bool {
	return e.resetPending
}
func (e *AccountReset) ResetComplete() bool {
	return e.resetComplete
}
