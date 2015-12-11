// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package github

import "fmt"

const (
	TagListPath = "/repos/%s/%s/tags"
)

type Tag struct {
	Name string `json:"name"`
}

func Tags(user, repo, token string) (tags []Tag, err error) {
	u, err := githubURL(GithubAPIURL, token)
	if err != nil {
		return nil, err
	}
	u.Path = fmt.Sprintf(TagListPath, user, repo)
	err = Get(u.String(), &tags)
	if err != nil {
		return
	}
	return
}

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
