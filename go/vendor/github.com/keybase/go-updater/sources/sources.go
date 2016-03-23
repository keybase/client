package sources

import (
	"strings"

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
	LocalSource                       = "local"
	PrereleaseSource                  = "prerelease"
	ErrorSource                       = "error"
)

var UpdateSourceNames = []UpdateSourceName{KeybaseSource, RemoteSource, PrereleaseSource, LocalSource}

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
	case string(LocalSource):
		return LocalSource
	default:
		return defaultSourceName
	}
}
