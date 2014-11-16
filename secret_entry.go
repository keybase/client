package libkb

import (
	"fmt"
	"io"
)

type SecretEntry struct {
	pinentry *Pinentry
	terminal Terminal
	initRes  *error
}

func NewSecretEntry() *SecretEntry {
	return &SecretEntry{}
}

func (se *SecretEntry) Init() (err error) {

	G.Log.Debug("+ SecretEntry.Init()")

	if se.initRes != nil {
		G.Log.Debug("- SecretEntry.Init() -> cached %s", ErrToOk(*se.initRes))
		return *se.initRes
	}

	se.terminal = G.Terminal

	if G.Env.GetNoPinentry() {
		G.Log.Debug("| Pinentry skipped due to config")
	} else {
		pe := NewPinentry()
		if e2, fatalerr := pe.Init(); fatalerr != nil {
			err = fatalerr
		} else if e2 != nil {
			G.Log.Debug("| Pinentry initialization failed: %s", e2.Error())
		} else {
			se.pinentry = pe
			G.Log.Debug("| Pinentry initialized")
		}
	}

	if err != nil {
		// We can't proceed if we hit a fatal error above
	} else if se.pinentry == nil && se.terminal == nil {
		err = fmt.Errorf("No terminal and pinentry init; cannot input secrets")
	}

	se.initRes = &err

	G.Log.Debug("- SecretEntry.Init() -> %s", ErrToOk(err))
	return err
}

func (se *SecretEntry) Get(arg SecretEntryArg, term_arg *SecretEntryArg) (
	res *SecretEntryRes, err error) {

	if err = se.Init(); err != nil {
		return
	}

	if pe := se.pinentry; pe != nil {
		res, err = pe.Get(arg)
	} else {
		if term_arg == nil {
			term_arg = &arg
		}
		res, err = TerminalGetSecret(se.terminal, term_arg)
	}

	return
}

func TerminalGetSecret(t Terminal, arg *SecretEntryArg) (
	res *SecretEntryRes, err error) {

	desc := arg.Desc
	prompt := arg.Prompt

	if len(arg.Error) > 0 {
		G.Log.Error(arg.Error)
	}

	if len(desc) > 0 {
		if err = t.Write(desc + "\n"); err != nil {
			return
		}
	}

	var txt string
	txt, err = t.PromptPassword(prompt)

	if err != nil {
		if err == io.EOF {
			err = nil
			res = &SecretEntryRes{Canceled: true}
		}
	} else {
		res = &SecretEntryRes{Text: txt}
	}

	return
}

type KeyUnlocker struct {
	Tries    int
	Reason   string
	KeyDesc  string
	Unlocker func(pw string) (ret *PgpKeyBundle, err error)
}

func (arg KeyUnlocker) Run() (ret *PgpKeyBundle, err error) {

	var emsg string

	desc := "You need a passphrase to unlock the secret key for:\n" +
		arg.KeyDesc + "\n"
	if len(arg.Reason) > 0 {
		desc = desc + "\nReason: " + arg.Reason
	}

	for i := 0; (arg.Tries <= 0 || i < arg.Tries) && ret == nil && err == nil; i++ {
		var res *SecretEntryRes
		res, err = G.SecretEntry.Get(SecretEntryArg{
			Error:  emsg,
			Desc:   desc,
			Prompt: "Your key passphrase",
		}, nil)

		if err == nil && res.Canceled {
			err = fmt.Errorf("Attempt to unlock secret key entry canceled")
		} else if err != nil {
			// noop
		} else if ret, err = arg.Unlocker(res.Text); err == nil {
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
