// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package github

import "fmt"

// Commit defines a git commit on Github
type Commit struct {
	SHA string `json:"sha"`
}

const (
	commitListPath = "/repos/%s/%s/commits"
)

// Commits lists commits from Github repo
func Commits(user, repo, token string) ([]Commit, error) {
	url, err := githubURL(githubAPIURL)
	if err != nil {
		return nil, err
	}
	url.Path = fmt.Sprintf(commitListPath, user, repo)
	var commits []Commit
	if err = Get(token, url.String(), &commits); err != nil {
		return nil, err
	}
	return commits, nil
}
