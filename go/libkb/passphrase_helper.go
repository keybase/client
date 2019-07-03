package libkb

import (
	"errors"
	"fmt"
	"strings"
	"time"

	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

func GetKeybasePassphrase(m MetaContext, ui SecretUI, arg keybase1.GUIEntryArg) (keybase1.GetPassphraseRes, error) {
	resCh := make(chan keybase1.GetPassphraseRes)
	errCh := make(chan error)
	go func() {
		res, err := GetPassphraseUntilCheckWithChecker(m, arg,
			newUIPrompter(ui), &CheckPassphraseSimple)
		if err != nil {
			errCh <- err
			return
		}
		res.StoreSecret = true
		resCh <- res
	}()

	select {
	case res := <-resCh:
		return res, nil
	case err := <-errCh:
		return keybase1.GetPassphraseRes{}, err
	case <-time.After(3 * time.Minute):
		return keybase1.GetPassphraseRes{}, TimeoutError{}
	}
}

func GetSecret(m MetaContext, ui SecretUI, title, prompt, retryMsg string, allowSecretStore bool) (keybase1.GetPassphraseRes, error) {
	arg := DefaultPassphraseArg(m)
	arg.WindowTitle = title
	arg.Type = keybase1.PassphraseType_PASS_PHRASE
	arg.Prompt = prompt
	arg.RetryLabel = retryMsg
	res, err := GetPassphraseUntilCheckWithChecker(m, arg, newUIPrompter(ui), &CheckPassphraseSimple)
	if err != nil {
		return res, err
	}
	res.StoreSecret = allowSecretStore
	return res, nil
}

func GetPaperKeyPassphrase(m MetaContext, ui SecretUI, username string, lastErr error, expectedPrefix *string) (string, error) {
	arg := DefaultPassphraseArg(m)
	arg.WindowTitle = "Paper Key"
	arg.Type = keybase1.PassphraseType_PAPER_KEY
	if len(username) == 0 {
		username = "your account"
	}
	arg.Prompt = fmt.Sprintf("Please enter a paper key for %s", username)
	arg.Username = username
	arg.Features.ShowTyping.Allow = true
	arg.Features.ShowTyping.DefaultValue = true
	if lastErr != nil {
		arg.RetryLabel = lastErr.Error()
	}
	res, err := GetPassphraseUntilCheck(m, arg, newUIPrompter(ui), &PaperChecker{expectedPrefix})
	if err != nil {
		return "", err
	}
	return res.Passphrase, nil
}

func GetPaperKeyForCryptoPassphrase(m MetaContext, ui SecretUI, reason string, devices []*Device) (string, error) {
	if len(devices) == 0 {
		return "", errors.New("empty device list")
	}
	arg := DefaultPassphraseArg(m)
	arg.WindowTitle = "Paper Key"
	arg.Type = keybase1.PassphraseType_PAPER_KEY
	arg.Features.ShowTyping.Allow = true
	arg.Features.ShowTyping.DefaultValue = true
	if len(devices) == 1 {
		arg.Prompt = fmt.Sprintf("%s: please enter the paper key '%s...'", reason, *devices[0].Description)
	} else {
		descs := make([]string, len(devices))
		for i, dev := range devices {
			descs[i] = fmt.Sprintf("'%s...'", *dev.Description)
		}
		paperOpts := strings.Join(descs, " or ")
		arg.Prompt = fmt.Sprintf("%s: please enter one of the following paper keys %s", reason, paperOpts)
	}

	res, err := GetPassphraseUntilCheck(m, arg, newUIPrompter(ui), &PaperChecker{})
	if err != nil {
		return "", err
	}
	return res.Passphrase, nil
}

func GetNewKeybasePassphrase(mctx MetaContext, ui SecretUI, arg keybase1.GUIEntryArg, confirm string) (keybase1.GetPassphraseRes, error) {
	initialPrompt := arg.Prompt

	for i := 0; i < 10; i++ {
		res, err := GetPassphraseUntilCheckWithChecker(mctx, arg,
			newUIPrompter(ui), &CheckPassphraseNew)
		if err != nil {
			return keybase1.GetPassphraseRes{}, nil
		}

		// confirm the password
		arg.RetryLabel = ""
		arg.Prompt = confirm
		confirm, err := GetPassphraseUntilCheckWithChecker(mctx, arg,
			newUIPrompter(ui), &CheckPassphraseNew)
		if err != nil {
			return keybase1.GetPassphraseRes{}, nil
		}

		if res.Passphrase == confirm.Passphrase {
			return res, nil
		}

		// setup the prompt, label for new first attempt
		arg.Prompt = initialPrompt
		arg.RetryLabel = "Passphrase mismatch"
	}

	return keybase1.GetPassphraseRes{}, RetryExhaustedError{}
}

type PassphrasePrompter interface {
	Prompt(keybase1.GUIEntryArg) (keybase1.GetPassphraseRes, error)
}

type uiPrompter struct {
	ui SecretUI
}

var _ PassphrasePrompter = &uiPrompter{}

func newUIPrompter(ui SecretUI) *uiPrompter {
	return &uiPrompter{ui: ui}
}

func (u *uiPrompter) Prompt(arg keybase1.GUIEntryArg) (keybase1.GetPassphraseRes, error) {
	return u.ui.GetPassphrase(arg, nil)
}

func GetPassphraseUntilCheckWithChecker(m MetaContext, arg keybase1.GUIEntryArg, prompter PassphrasePrompter, checker *Checker) (keybase1.GetPassphraseRes, error) {
	if checker == nil {
		return keybase1.GetPassphraseRes{}, errors.New("nil passphrase checker")
	}
	w := &CheckerWrapper{checker: *checker}
	return GetPassphraseUntilCheck(m, arg, prompter, w)
}

func GetPassphraseUntilCheck(m MetaContext, arg keybase1.GUIEntryArg, prompter PassphrasePrompter, checker PassphraseChecker) (keybase1.GetPassphraseRes, error) {
	for i := 0; i < 10; i++ {
		res, err := prompter.Prompt(arg)
		if err != nil {
			return keybase1.GetPassphraseRes{}, err
		}
		if checker == nil {
			return res, nil
		}

		s := res.Passphrase
		t, err := checker.Automutate(m, s)
		if err != nil {
			return keybase1.GetPassphraseRes{}, err
		}
		res = keybase1.GetPassphraseRes{Passphrase: t, StoreSecret: res.StoreSecret}

		err = checker.Check(m, res.Passphrase)
		if err == nil {
			return res, nil
		}
		arg.RetryLabel = err.Error()
	}
	return keybase1.GetPassphraseRes{}, RetryExhaustedError{}
}

func DefaultPassphraseArg(m MetaContext) keybase1.GUIEntryArg {
	arg := keybase1.GUIEntryArg{
		SubmitLabel: "Submit",
		CancelLabel: "Cancel",
		Features: keybase1.GUIEntryFeatures{
			ShowTyping: keybase1.Feature{
				Allow:        true,
				DefaultValue: false,
				Readonly:     true,
				Label:        "Show typing",
			},
		},
	}
	return arg
}

func DefaultPassphrasePromptArg(mctx MetaContext, username string) keybase1.GUIEntryArg {
	arg := DefaultPassphraseArg(mctx)
	arg.WindowTitle = "Keybase password"
	arg.Type = keybase1.PassphraseType_PASS_PHRASE
	arg.Username = username
	arg.Prompt = fmt.Sprintf("Please enter the Keybase password for %s (%d+ characters)", username, MinPassphraseLength)
	return arg
}

// PassphraseChecker is an interface for checking the format of a
// passphrase. Returns nil if the format is ok, or a descriptive
// hint otherwise.
type PassphraseChecker interface {
	Check(MetaContext, string) error
	Automutate(MetaContext, string) (string, error)
}

// CheckerWrapper wraps a Checker type to make it conform to the
// PassphraseChecker interface.
type CheckerWrapper struct {
	checker Checker
}

func (w *CheckerWrapper) Automutate(m MetaContext, s string) (string, error) {
	return s, nil
}

// Check s using checker, respond with checker.Hint if check
// fails.
func (w *CheckerWrapper) Check(m MetaContext, s string) error {
	if w.checker.F(s) {
		return nil
	}
	return errors.New(w.checker.Hint)
}

// PaperChecker implements PassphraseChecker for paper keys.
type PaperChecker struct {
	expectedPrefix *string
}

func (p *PaperChecker) Automutate(m MetaContext, s string) (string, error) {
	phrase := NewPaperKeyPhrase(s)
	if phrase.NumWords() == PaperKeyNoPrefixLen {
		if p.expectedPrefix == nil {
			return "", errors.New("No prefix given but expectedPrefix is nil; must give the entire paper key.")
		}
		return fmt.Sprintf("%s %s", *p.expectedPrefix, s), nil
	}
	return s, nil
}

// Check a paper key format.  Will return a detailed error message
// specific to the problems found in s.
func (p *PaperChecker) Check(m MetaContext, s string) error {
	phrase := NewPaperKeyPhrase(s)

	// check for empty
	if len(phrase.String()) == 0 {
		m.Debug("paper phrase is empty")
		return PassphraseError{Msg: "Empty paper key. Please try again."}
	}

	// check for at least PaperKeyWordCountMin words
	if phrase.NumWords() < PaperKeyWordCountMin {
		return PassphraseError{Msg: "Your paper key should have more words than this. Please double check."}
	}

	// check for invalid words
	invalids := phrase.InvalidWords()
	if len(invalids) > 0 {
		m.Debug("paper phrase has invalid word(s) in it")
		var perr PassphraseError
		if len(invalids) > 1 {
			perr.Msg = fmt.Sprintf("Please try again. These words are invalid: %s", strings.Join(invalids, ", "))
		} else {
			perr.Msg = fmt.Sprintf("Please try again. This word is invalid: %s", invalids[0])
		}
		return perr
	}

	// check version
	version, err := phrase.Version()
	if err != nil {
		m.Debug("error getting paper key version: %s", err)
		// despite the error, just tell the user the paper key is wrong:
		return PassphraseError{Msg: "Wrong paper key. Please try again."}
	}
	if version != PaperKeyVersion {
		m.Debug("paper key version mismatch: generated version = %d, libkb version = %d", version, PaperKeyVersion)
		return PassphraseError{Msg: "Wrong paper key. Please try again."}
	}

	return nil
}
