// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package github

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"strconv"
)

func CreateRelease(token string, repo string, tag string, name string) error {
	params := ReleaseCreate{
		TagName: tag,
		Name:    name,
	}

	payload, err := json.Marshal(params)
	if err != nil {
		return fmt.Errorf("can't encode release creation params, %v", err)
	}
	reader := bytes.NewReader(payload)

	uri := fmt.Sprintf("/repos/keybase/%s/releases", repo)
	resp, err := DoAuthRequest("POST", GithubAPIURL+uri, "application/json", token, nil, reader)
	if resp != nil {
		defer resp.Body.Close()
	}
	if err != nil {
		return fmt.Errorf("while submitting %v, %v", string(payload), err)
	}
	if resp.StatusCode != http.StatusCreated {
		if resp.StatusCode == 422 {
			return fmt.Errorf("github returned %v (this is probably because the release already exists)",
				resp.Status)
		}
		return fmt.Errorf("github returned %v", resp.Status)
	}
	return nil
}

func Upload(token string, repo string, tag string, name string, file string) error {
	release, err := ReleaseOfTag("keybase", repo, tag, token)
	if err != nil {
		return err
	}
	v := url.Values{}
	v.Set("name", name)
	url := release.CleanUploadURL() + "?" + v.Encode()
	osfile, err := os.Open(file)
	if err != nil {
		return err
	}
	resp, err := DoAuthRequest("POST", url, "application/octet-stream", token, nil, osfile)
	if resp != nil {
		defer resp.Body.Close()
	}
	if err != nil {
		return err
	}
	if resp.StatusCode != http.StatusCreated {
		if resp.StatusCode == 422 {
			return fmt.Errorf("github returned %v (this is probably because the release already exists)",
				resp.Status)
		}
		return fmt.Errorf("github returned %v", resp.Status)
	}
	return nil
}

func DownloadSource(token string, repo string, tag string) error {
	url := GithubAPIURL + fmt.Sprintf("/repos/keybase/%s/tarball/%s", repo, tag)
	name := fmt.Sprintf("%s-%s.tar.gz", repo, tag)
	log.Printf("Url: %s", url)
	return Download(token, url, name)
}

func DownloadAsset(token string, repo string, tag string, name string) error {
	release, err := ReleaseOfTag("keybase", repo, tag, token)
	if err != nil {
		return err
	}

	assetID := 0
	for _, asset := range release.Assets {
		if asset.Name == name {
			assetID = asset.ID
		}
	}

	if assetID == 0 {
		return fmt.Errorf("could not find asset named %s", name)
	}

	url := GithubAPIURL + fmt.Sprintf(AssetDownloadURI, "keybase", repo, assetID)
	return Download(token, url, name)
}

func Download(token string, url string, name string) error {
	resp, err := DoAuthRequest("GET", url, "", token, map[string]string{
		"Accept": "application/octet-stream",
	}, nil)
	if resp != nil {
		defer resp.Body.Close()
	}
	if err != nil {
		return fmt.Errorf("could not fetch releases, %v", err)
	}

	contentLength, err := strconv.ParseInt(resp.Header.Get("Content-Length"), 10, 64)
	if err != nil {
		return err
	}

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("github did not respond with 200 OK but with %v", resp.Status)
	}

	out, err := os.Create(name)
	if err != nil {
		return fmt.Errorf("could not create file %s", name)
	}
	defer out.Close()

	n, err := io.Copy(out, resp.Body)
	if n != contentLength {
		return fmt.Errorf("downloaded data did not match content length %d != %d", contentLength, n)
	}
	return err
}
