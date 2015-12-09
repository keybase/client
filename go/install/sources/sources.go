package sources

import (
	"fmt"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
)

type UpdateSource interface {
	FindUpdate(config keybase1.UpdateConfig) (*keybase1.Update, error)
}

type Source string

const (
	KeybaseSource Source = "keybase"
	GithubSource         = "github"
	RemoteSource         = "remote"
	DefaultSource        = ""
)

var Sources = []Source{KeybaseSource, GithubSource, DefaultSource}

func UpdateSourceForName(g *libkb.GlobalContext, name string) (UpdateSource, error) {
	switch name {
	case string(DefaultSource), string(KeybaseSource):
		return NewKeybaseUpdateSource(g), nil
	case string(GithubSource):
		return NewGithubUpdateSource(g), nil
	case string(RemoteSource):
		return NewRemoteUpdateSource(g), nil
	}

	return nil, fmt.Errorf("Invalid update source: %s", name)
}
