// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package sources

import (
	"fmt"
	"runtime"
	"strings"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol"
	gh "github.com/keybase/client/go/tools/release/github"
)

// GithubUpdateSource finds releases/updates on Github
type GithubUpdateSource struct {
	libkb.Contextified
}

func NewGithubUpdateSource(g *libkb.GlobalContext) GithubUpdateSource {
	return GithubUpdateSource{
		Contextified: libkb.NewContextified(g),
	}
}

func (g GithubUpdateSource) FindUpdate(config keybase1.UpdateConfig) (update *keybase1.Update, err error) {
	// Get release from Github
	ghRelease, err := gh.LatestRelease("keybase", "client", "")
	if err != nil {
		return
	}
	g.G().Log.Debug("Found Github release: %#v", ghRelease)

	uver := ghRelease.TagName[1:]

	// Find the asset matching asset
	var asset *keybase1.Asset
	for _, a := range ghRelease.Assets {
		if strings.HasPrefix(a.Name, "Keybase-") && strings.HasSuffix(a.Name, fmt.Sprintf("-%s.zip", runtime.GOOS)) {
			asset = &keybase1.Asset{Name: a.Name, DownloadURL: a.BrowserDownloadURL}
			break
		}
	}

	if asset == nil {
		return
	}

	update = &keybase1.Update{Version: uver, Name: ghRelease.Name, Description: ghRelease.Description, Asset: *asset}
	return
}
