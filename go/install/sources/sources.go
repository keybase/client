package sources

import (
	"fmt"
	"strings"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
)

type UpdateSource interface {
	FindUpdate(config keybase1.UpdateConfig) (*keybase1.Update, error)
}

type UpdateSourceName string

const (
	KeybaseSource    UpdateSourceName = "keybase"
	GithubSource                      = "github"
	RemoteSource                      = "remote"
	PrereleaseSource                  = "prerelease"
	ErrorSource                       = "error"
)

var UpdateSourceNames = []UpdateSourceName{KeybaseSource, GithubSource, RemoteSource, PrereleaseSource}

// The https cert won't work with dots (.) in bucket name, so use alternate URI
const PrereleaseURI = "https://s3.amazonaws.com/prerelease.keybase.io"

func DefaultUpdateSourceName() UpdateSourceName {
	if IsPrerelease {
		return PrereleaseSource
	}
	return KeybaseSource
}

func UpdateSourcesDescription(delimeter string) string {
	var updateSourceStrings []string
	for _, n := range UpdateSourceNames {
		updateSourceStrings = append(updateSourceStrings, string(n))
	}
	return strings.Join(updateSourceStrings, delimeter)
}

func UpdateSourceNameForString(name string, defaultSourceName UpdateSourceName) UpdateSourceName {
	switch name {
	case "":
		return DefaultUpdateSourceName()
	case string(KeybaseSource):
		return KeybaseSource
	case string(GithubSource):
		return GithubSource
	case string(RemoteSource):
		return RemoteSource
	case string(PrereleaseSource):
		return PrereleaseSource
	default:
		return defaultSourceName
	}
}

func NewUpdateSourceForName(g *libkb.GlobalContext, name string) (UpdateSource, error) {
	source := UpdateSourceNameForString(name, ErrorSource)
	switch source {
	case KeybaseSource:
		return NewKeybaseUpdateSource(g), nil
	case GithubSource:
		return NewGithubUpdateSource(g), nil
	case RemoteSource:
		return NewRemoteUpdateSource(g, ""), nil
	case PrereleaseSource:
		return NewRemoteUpdateSource(g, PrereleaseURI), nil
	}
	return nil, fmt.Errorf("Invalid update source: %s", name)
}
