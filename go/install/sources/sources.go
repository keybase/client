package sources

import (
	"fmt"
	"strings"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
)

type UpdateSource interface {
	Description() string
	FindUpdate(options keybase1.UpdateOptions) (*keybase1.Update, error)
}

type UpdateSourceName string

const (
	KeybaseSource    UpdateSourceName = "keybase"
	RemoteSource                      = "remote"
	PrereleaseSource                  = "prerelease"
	ErrorSource                       = "error"
)

var UpdateSourceNames = []UpdateSourceName{KeybaseSource, RemoteSource, PrereleaseSource}

// The https cert won't work with dots (.) in bucket name, so use alternate URI
const PrereleaseURI = "https://s3.amazonaws.com/prerelease.keybase.io"

func DefaultUpdateSourceName() UpdateSourceName {
	if IsPrerelease {
		return PrereleaseSource
	}
	return KeybaseSource
}

func DefaultUpdateSource(g *libkb.GlobalContext) UpdateSource {
	u, _ := NewUpdateSource(g, DefaultUpdateSourceName())
	return u
}

func UpdateSourcesDescription(delimeter string) string {
	var updateSourceStrings []string
	for _, n := range UpdateSourceNames {
		updateSourceStrings = append(updateSourceStrings, string(n))
	}
	return strings.Join(updateSourceStrings, delimeter)
}

func UpdateSourceNameFromString(name string, defaultSourceName UpdateSourceName) UpdateSourceName {
	switch name {
	case "":
		return DefaultUpdateSourceName()
	case string(KeybaseSource):
		return KeybaseSource
	case string(RemoteSource):
		return RemoteSource
	case string(PrereleaseSource):
		return PrereleaseSource
	default:
		return defaultSourceName
	}
}

func NewUpdateSourceFromString(g *libkb.GlobalContext, name string) (UpdateSource, error) {
	sourceName := UpdateSourceNameFromString(name, ErrorSource)
	return NewUpdateSource(g, sourceName)
}

func NewUpdateSource(g *libkb.GlobalContext, sourceName UpdateSourceName) (UpdateSource, error) {
	switch sourceName {
	case KeybaseSource:
		return NewKeybaseUpdateSource(g), nil
	case RemoteSource:
		return NewRemoteUpdateSource(g, ""), nil
	case PrereleaseSource:
		return NewRemoteUpdateSource(g, PrereleaseURI), nil
	}
	return nil, fmt.Errorf("Invalid update source: %s", string(sourceName))
}
