// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package github

import "fmt"

// Status defines a git commit on Github
type Status struct {
	State   string `json:"state"`
	Context string `json:"context"`
}

// Statuses defines the overall status of a git commit on Github
type Statuses struct {
	State    string   `json:"state"`
	Statuses []Status `json:"statuses"`
}

const (
	statusesListPath = "/repos/%s/%s/statuses/%s"
	statusListPath   = "/repos/%s/%s/commits/%s/status"
)

// Statuses lists statuses for a git commit
func getStatuses(token, user, repo, sha string) ([]Status, error) {
	url, err := githubURL(githubAPIURL)
	if err != nil {
		return nil, err
	}
	url.Path = fmt.Sprintf(statusesListPath, user, repo, sha)
	var statuses []Status
	if err = Get(token, url.String()+"?per_page=100", &statuses); err != nil {
		return nil, err
	}
	return statuses, nil
}

// OverallStatus lists the overall status for a git commit.
// Instead of all the statuses, it gives an overall status
// if all have passed, plus a list of the most recent results
// for each context.
func overallStatus(token, user, repo, sha string) (Statuses, error) {
	url, err := githubURL(githubAPIURL)
	if err != nil {
		return Statuses{}, err
	}
	url.Path = fmt.Sprintf(statusListPath, user, repo, sha)
	var statuses Statuses
	if err = Get(token, url.String(), &statuses); err != nil {
		return Statuses{}, err
	}
	return statuses, nil
}
