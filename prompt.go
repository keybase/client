package libkb

import (
	"fmt"
)

func Prompt(prompt string, password bool, checker Checker) (string, error) {
	var prompter func(string) (string, error)

	if G.Terminal == nil {
		return "", fmt.Errorf("Can't prompt; no terminal available")
	}

	if password {
		prompter = func(s string) (string, error) {
			return G.Terminal.PromptPassword(s)
		}
	} else {
		prompter = func(s string) (string, error) {
			return G.Terminal.Prompt(s)
		}
	}

	var res string
	var err error

	first := true
	for {
		p := prompt
		if !first && len(checker.Hint) > 0 {
			p = p + " (" + checker.Hint + ")"
		}
		p = p + ": "
		res, err = prompter(p)
		if err != nil || checker.F(res) {
			break
		}
		res = ""
		first = false
	}

	return res, err
}

func PromptForConfirmation(prompt string) error {

	if G.Terminal == nil {
		return fmt.Errorf("Can't prompt; no terminal available")
	}

	res, err := G.Terminal.Prompt(prompt + " (type 'YES' to confirm): ")
	if err != nil {
		return err
	}
	if res != "YES" {
		return fmt.Errorf("Not confirmed")
	}
	return nil

}
