// Modified from https://github.com/aktau/github-release/blob/master/releases.go

package github

import (
	"fmt"
	"strings"
	"time"
)

const (
	ReleaseListPath   = "/repos/%s/%s/releases"
	ReleaseLatestPath = "/repos/%s/%s/releases/latest"
)

type Release struct {
	URL         string     `json:"url"`
	PageURL     string     `json:"html_url"`
	UploadURL   string     `json:"upload_url"`
	ID          int        `json:"id"`
	Name        string     `json:"name"`
	Description string     `json:"body"`
	TagName     string     `json:"tag_name"`
	Draft       bool       `json:"draft"`
	Prerelease  bool       `json:"prerelease"`
	Created     *time.Time `json:"created_at"`
	Published   *time.Time `json:"published_at"`
	Assets      []Asset    `json:"assets"`
}

func (r *Release) CleanUploadURL() string {
	bracket := strings.Index(r.UploadURL, "{")

	if bracket == -1 {
		return r.UploadURL
	}

	return r.UploadURL[0:bracket]
}

type ReleaseCreate struct {
	TagName         string `json:"tag_name"`
	TargetCommitish string `json:"target_commitish,omitempty"`
	Name            string `json:"name"`
	Body            string `json:"body"`
	Draft           bool   `json:"draft"`
	Prerelease      bool   `json:"prerelease"`
}

func Releases(user, repo, token string) (releases []Release, err error) {
	u, err := githubURL(GithubAPIURL, token)
	if err != nil {
		return nil, err
	}
	u.Path = fmt.Sprintf(ReleaseListPath, user, repo)
	err = Get(u.String(), &releases)
	if err != nil {
		return
	}
	return
}

func LatestRelease(user, repo, token string) (release *Release, err error) {
	u, err := githubURL(GithubAPIURL, token)
	if err != nil {
		return
	}
	u.Path = fmt.Sprintf(ReleaseLatestPath, user, repo)
	err = Get(u.String(), &release)
	return
}

func ReleaseOfTag(user, repo, tag, token string) (*Release, error) {
	releases, err := Releases(user, repo, token)
	if err != nil {
		return nil, err
	}

	for _, release := range releases {
		if release.TagName == tag {
			return &release, nil
		}
	}

	return nil, &ErrNotFound{Name: "release", Key: "tag", Value: tag}
}
