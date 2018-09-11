package git

import (
	"fmt"

	"github.com/keybase/client/go/libkb"
	"golang.org/x/net/context"
)

// For errors that expect, replace them with nice strings for the user. The GUI
// will show these directly.
func HumanizeGitErrors(ctx context.Context, g *libkb.GlobalContext, err error) error {
	switch e := err.(type) {
	case libkb.RepoAlreadyExistsError:
		g.Log.CDebugf(ctx, "replacing error: %v", err)
		return fmt.Errorf("A repo named %q already exists.", e.ExistingName)
	case libkb.InvalidRepoNameError:
		g.Log.CDebugf(ctx, "replacing error: %v", err)
		return fmt.Errorf("%q isn't a valid repo name.", e.Name)
	default:
		return err
	}
}
