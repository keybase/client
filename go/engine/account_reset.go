// This engine enters a user into the reset pipeline.
package engine

import (
	"fmt"
	"time"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

// AccountReset is an engine.
type AccountReset struct {
	libkb.Contextified
	username           string
	passphrase         string
	skipPasswordPrompt bool
	completeReset      bool

	resetPending  bool
	resetComplete bool
}

// NewAccountReset creates a AccountReset engine.
func NewAccountReset(g *libkb.GlobalContext, username string) *AccountReset {
	return &AccountReset{
		Contextified: libkb.NewContextified(g),
		username:     username,
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

// SetPassphrase lets a caller add a passphrase
func (e *AccountReset) SetPassphrase(passphrase string) {
	e.passphrase = passphrase
	e.skipPasswordPrompt = true
}

// SubConsumers returns the other UI consumers for this engine.
func (e *AccountReset) SubConsumers() []libkb.UIConsumer {
	return nil
}

// Run starts the engine.
func (e *AccountReset) Run(mctx libkb.MetaContext) (err error) {
	mctx = mctx.WithLogTag("RST")
	defer mctx.Trace("Account#Run", &err)()

	// User's with active devices cannot reset at all
	if mctx.ActiveDevice().Valid() {
		return libkb.ResetWithActiveDeviceError{}
	}

	// We can enter the reset pipeline with exactly one of these parameters
	// set. We first attempt to establish a session for the user. Otherwise we
	// send up a username. If the user only has an email,
	// they should go through the "recover username" flow first.
	var self bool
	var username string

	arg := keybase1.GUIEntryArg{
		SubmitLabel: "Submit",
		CancelLabel: "I don't know",
		WindowTitle: "Keybase passphrase",
		Type:        keybase1.PassphraseType_PASS_PHRASE,
		Username:    e.username,
		Prompt: fmt.Sprintf("Please enter the Keybase password for %s ("+
			"%d+ characters) if you know it (if not, cancel this prompt)", e.username, libkb.MinPassphraseLength),
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

	if len(e.username) == 0 {
		err = libkb.NewResetMissingParamsError("Unable to start reset process, no username provided")
		return
	}

	if e.passphrase != "" {
		err = libkb.PassphraseLoginNoPrompt(mctx, e.username, e.passphrase)
		if err != nil {
			return err
		}
		self = true
	} else if !e.skipPasswordPrompt {
		err = libkb.PassphraseLoginPromptWithArg(mctx, 3, arg)
		switch err.(type) {
		case nil:
			self = true
		case
			// ignore these errors since we can verify the reset process from username
			libkb.NoUIError,
			libkb.PassphraseError,
			libkb.RetryExhaustedError,
			libkb.InputCanceledError,
			libkb.SkipSecretPromptError:
			mctx.Debug("unable to authenticate a session: %v, charging forward without it", err)
			username = e.username
		default:
			return err
		}
	} else {
		username = e.username
	}

	willVerifyUnverifiedState := false
	if self {
		status, err := e.loadResetStatus(mctx)
		if err != nil {
			return err
		}
		if status.ResetID != nil {
			if status.EventType == libkb.AutoresetEventStart {
				willVerifyUnverifiedState = true
			} else {
				return e.resetPrompt(mctx, status)
			}
		}
	}

	res, err := mctx.G().API.Post(mctx, libkb.APIArg{
		Endpoint:    "autoreset/enter",
		SessionType: libkb.APISessionTypeOPTIONAL,
		Args: libkb.HTTPArgs{
			"username": libkb.S{Val: username},
			"self":     libkb.B{Val: self},
		},
	})
	if err != nil {
		return err
	}
	mctx.G().Log.Debug("autoreset/enter result: %s", res.Body.MarshalToDebug())
	if willVerifyUnverifiedState {
		// If we got here, then we supplied a correct passphrase thus verifying
		// a pipeline that was previously in START.
		if err := mctx.UIs().LoginUI.DisplayResetMessage(mctx.Ctx(), keybase1.DisplayResetMessageArg{
			Kind: keybase1.ResetMessage_REQUEST_VERIFIED,
		}); err != nil {
			return err
		}
	} else {
		if self {
			if err := mctx.UIs().LoginUI.DisplayResetMessage(mctx.Ctx(), keybase1.DisplayResetMessageArg{
				Kind: keybase1.ResetMessage_ENTERED_PASSWORDLESS,
			}); err != nil {
				return err
			}
		} else {
			if err := mctx.UIs().LoginUI.DisplayResetMessage(mctx.Ctx(), keybase1.DisplayResetMessageArg{
				Kind: keybase1.ResetMessage_ENTERED_VERIFIED,
			}); err != nil {
				return err
			}
		}
	}
	e.resetPending = true

	// Ask the server, so that we have the correct reset time to tell the UI
	if self {
		status, err := e.loadResetStatus(mctx)
		if err != nil {
			return err
		}
		if status.ResetID != nil {
			return e.resetPrompt(mctx, status)
		}
	} else {
		if err := mctx.UIs().LoginUI.DisplayResetProgress(mctx.Ctx(), keybase1.DisplayResetProgressArg{
			Text:       "Please verify your phone number or email address to proceed with the reset.",
			NeedVerify: true,
		}); err != nil {
			return err
		}
	}

	return nil
}

type accountResetStatusResponse struct {
	ResetID   *string `json:"reset_id"`
	EventTime string  `json:"event_time"`
	DelaySecs int     `json:"delay_secs"`
	EventType int     `json:"event_type"`
	HasWallet bool    `json:"has_wallet"`
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
	if status.EventType == libkb.AutoresetEventReady {
		// Ask the user if they'd like to reset if we're in login + it's ready
		response, err := mctx.UIs().LoginUI.PromptResetAccount(mctx.
			Ctx(), keybase1.PromptResetAccountArg{
			Prompt: keybase1.NewResetPromptWithComplete(keybase1.ResetPromptInfo{HasWallet: status.HasWallet}),
		})
		if err != nil {
			return err
		}
		if response == keybase1.ResetPromptResponse_NOTHING {
			// noop
			return mctx.UIs().LoginUI.DisplayResetMessage(mctx.Ctx(), keybase1.DisplayResetMessageArg{
				Kind: keybase1.ResetMessage_NOT_COMPLETED,
			})
		} else if response == keybase1.ResetPromptResponse_CANCEL_RESET {
			// noop
			if err := mctx.UIs().LoginUI.DisplayResetMessage(mctx.Ctx(), keybase1.DisplayResetMessageArg{
				Kind: keybase1.ResetMessage_CANCELED,
			}); err != nil {
				return err
			}
			return libkb.CancelResetPipeline(mctx)
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
		if err := mctx.UIs().LoginUI.DisplayResetMessage(mctx.Ctx(), keybase1.DisplayResetMessageArg{
			Kind: keybase1.ResetMessage_COMPLETED,
		}); err != nil {
			return err
		}

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
			"You will be able to reset your account %s.",
			libkb.HumanizeResetTime(readyTime),
		)
	}
	if err := mctx.UIs().LoginUI.DisplayResetProgress(mctx.Ctx(), keybase1.DisplayResetProgressArg{
		EndTime: keybase1.Time(readyTime.Unix()),
		Text:    notificationText,
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
