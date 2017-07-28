package hostmanifest

import (
	"os/user"
)

// User is an interface for an OS user.
type User interface {
	// IsAdmin returns true if the user is root, usually uid == 0
	IsAdmin() bool
	// PrefixPath is where paths relative to that user should be. Usually $HOME.
	PrefixPath() string
}

// UserPath is a straightforward implementation of UserPath.
type UserPath struct {
	Admin bool
	Path  string
}

func (u *UserPath) IsAdmin() bool      { return u.Admin }
func (u *UserPath) PrefixPath() string { return u.Path }

// CurrentUser returns a UserPath representing the current user.
func CurrentUser() (*UserPath, error) {
	current, err := user.Current()
	if err != nil {
		return nil, err
	}
	u := &UserPath{
		Admin: current.Uid == "0",
	}
	if !u.IsAdmin() {
		u.Path = current.HomeDir
	}
	return u, nil
}
