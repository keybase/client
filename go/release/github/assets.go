// Modified from https://github.com/aktau/github-release/blob/master/assets.go

package github

import (
	"time"
)

const (
	assetDownloadURI = "/repos/%s/%s/releases/assets/%d"
)

// Asset is a Github API Asset
type Asset struct {
	URL                string    `json:"url"`
	ID                 int       `json:"id"`
	Name               string    `json:"name"`
	ContentType        string    `json:"content_type"`
	State              string    `json:"state"`
	Size               uint64    `json:"size"`
	Downloads          uint64    `json:"download_count"`
	Created            time.Time `json:"created_at"`
	Published          time.Time `json:"published_at"`
	BrowserDownloadURL string    `json:"browser_download_url"`
}
