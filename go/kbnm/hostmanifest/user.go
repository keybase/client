package hostmanifest

import (
	"os/user"
)

type User interface {
	// IsAdmin returns true if the user is root, usually uid == 0
	IsAdmin() bool
	// PrefixPath is where paths relative to that user should be. Usually $HOME.
	PrefixPath() string
}

type userPath struct {
	Admin bool
	Path  string
}

func (u *userPath) IsAdmin() bool      { return u.Admin }
func (u *userPath) PrefixPath() string { return u.Path }

// CurrentUser returns a User representing the current user.
func CurrentUser() (*userPath, error) {
	current, err := user.Current()
	if err != nil {
		return nil, err
	}
	u := &userPath{
		Admin: current.Uid == "0",
	}
	if !u.IsAdmin() {
		u.Path = current.HomeDir
	}
	return u, nil
}
