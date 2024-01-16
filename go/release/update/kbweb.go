// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package update

import (
	"bytes"
	"crypto/tls"
	"crypto/x509"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"time"

	"github.com/keybase/client/go/libkb"
)

const (
	kbwebAPIUrl = "https://api-1.core.keybaseapi.com"
)

type kbwebClient struct {
	http *http.Client
}

type APIResponseWrapper interface {
	StatusCode() int
}

type AppResponseBase struct {
	Status struct {
		Code int
		Desc string
	}
}

func (s *AppResponseBase) StatusCode() int {
	return s.Status.Code
}

// newKbwebClient constructs a Client
func newKbwebClient() (*kbwebClient, error) {
	certPool := x509.NewCertPool()
	ok := certPool.AppendCertsFromPEM([]byte(libkb.APICA))
	if !ok {
		return nil, fmt.Errorf("Could not read CA for keybase.io")
	}
	client := &http.Client{
		Transport: &http.Transport{
			TLSClientConfig: &tls.Config{RootCAs: certPool},
		},
	}
	return &kbwebClient{http: client}, nil
}

func (client *kbwebClient) post(keybaseToken string, path string, data []byte, response APIResponseWrapper) error {
	req, err := http.NewRequest("POST", kbwebAPIUrl+path, bytes.NewBuffer(data))
	if err != nil {
		return fmt.Errorf("newrequest failed, %v", err)
	}
	req.Header.Add("content-type", "application/json")
	req.Header.Add("x-keybase-admin-token", keybaseToken)
	resp, err := client.http.Do(req)
	if err != nil {
		return fmt.Errorf("request failed, %v", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("body err, %v", err)
	}

	if response == nil {
		response = new(AppResponseBase)
	}
	if err := json.Unmarshal(body, &response); err != nil {
		return fmt.Errorf("json reply err, %v", err)
	}

	if response.StatusCode() != 0 {
		return fmt.Errorf("Server returned failure, %s", body)
	}

	fmt.Printf("Success.\n")
	return nil
}

type announceBuildArgs struct {
	VersionA string `json:"version_a"`
	VersionB string `json:"version_b"`
	Platform string `json:"platform"`
}

// AnnounceBuild tells the API server about the existence of a new build.
// It does not enroll it in smoke testing.
func AnnounceBuild(keybaseToken string, buildA string, buildB string, platform string) error {
	client, err := newKbwebClient()
	if err != nil {
		return fmt.Errorf("client create failed, %v", err)
	}
	args := &announceBuildArgs{
		VersionA: buildA,
		VersionB: buildB,
		Platform: platform,
	}
	jsonStr, err := json.Marshal(args)
	if err != nil {
		return fmt.Errorf("json marshal err, %v", err)
	}
	var data = jsonStr
	return client.post(keybaseToken, "/_/api/1.0/pkg/add_build.json", data, nil)
}

type promoteBuildArgs struct {
	VersionA string `json:"version_a"`
	Platform string `json:"platform"`
}

type promoteBuildResponse struct {
	AppResponseBase
	ReleaseTimeMs int64 `json:"release_time"`
}

// KBWebPromote tells the API server that a new build is promoted.
func KBWebPromote(keybaseToken string, buildA string, platform string, dryRun bool) (releaseTime time.Time, err error) {
	client, err := newKbwebClient()
	if err != nil {
		return releaseTime, fmt.Errorf("client create failed, %v", err)
	}
	args := &promoteBuildArgs{
		VersionA: buildA,
		Platform: platform,
	}
	jsonStr, err := json.Marshal(args)
	if err != nil {
		return releaseTime, fmt.Errorf("json marshal err, %v", err)
	}
	var data = jsonStr
	var response promoteBuildResponse
	if dryRun {
		log.Printf("DRYRUN: Would post %s\n", data)
		return releaseTime, nil
	}
	err = client.post(keybaseToken, "/_/api/1.0/pkg/set_released.json", data, &response)
	if err != nil {
		return releaseTime, err
	}
	releaseTime = time.Unix(0, response.ReleaseTimeMs*int64(time.Millisecond))
	log.Printf("Release time set to %v for build %v", releaseTime, buildA)
	return releaseTime, nil
}

type setBuildInTestingArgs struct {
	VersionA   string `json:"version_a"`
	Platform   string `json:"platform"`
	InTesting  string `json:"in_testing"`
	MaxTesters int    `json:"max_testers"`
}

// SetBuildInTesting tells the API server to enroll or unenroll a build in smoke testing.
func SetBuildInTesting(keybaseToken string, buildA string, platform string, inTesting string, maxTesters int) error {
	client, err := newKbwebClient()
	if err != nil {
		return fmt.Errorf("client create failed, %v", err)
	}
	args := &setBuildInTestingArgs{
		VersionA:   buildA,
		Platform:   platform,
		InTesting:  inTesting,
		MaxTesters: maxTesters,
	}
	jsonStr, err := json.Marshal(args)
	if err != nil {
		return fmt.Errorf("json marshal err: %v", err)
	}
	var data = jsonStr
	return client.post(keybaseToken, "/_/api/1.0/pkg/set_in_testing.json", data, nil)
}
