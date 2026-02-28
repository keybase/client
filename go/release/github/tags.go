// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package github

import "fmt"

const (
	tagListPath = "/repos/%s/%s/tags"
)

// Tag is a Github API Tag type
type Tag struct {
	Name string `json:"name"`
}

// Tags returns tags for a repo
func Tags(user, repo, token string) (tags []Tag, err error) {
	u, err := githubURL(githubAPIURL)
	if err != nil {
		return nil, err
	}
	u.Path = fmt.Sprintf(tagListPath, user, repo)
	err = Get(token, u.String(), &tags)
	if err != nil {
		return
	}
	return
}

// LatestTag returns latest tag for a repo
func LatestTag(user, repo, token string) (tag *Tag, err error) {
	tags, err := Tags(user, repo, token)
	if err != nil {
		return
	}
	if len(tags) > 0 {
		tag = &tags[0]
	}
	return
}
