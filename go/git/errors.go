package git

import (
	"fmt"

	"github.com/keybase/client/go/libkb"
)

// For errors that expect, replace them with nice strings for the user. The GUI
// will show these directly.
func HumanizeGitErrors(err error) error {
	switch e := err.(type) {
	case libkb.RepoAlreadyExistsError:
		return fmt.Errorf("A repo named %q already exists.", e.ExistingName)
	case libkb.InvalidRepoNameError:
		return fmt.Errorf("%q isn't a valid repo name.", e.Name)
	default:
		return err
	}
}
