// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package main

import (
	"flag"
	"fmt"
	"log"
	"os"
	"runtime"
	"strings"

	"github.com/keybase/client/go/libkb"
	gh "github.com/keybase/client/go/tools/release/github"
)

func githubToken() string {
	token := os.Getenv("GITHUB_TOKEN")
	if token == "" {
		log.Fatal("No GITHUB_TOKEN set")
	}
	return token
}

func tag(version string) string {
	return fmt.Sprintf("v%s", version)
}

var repo = flag.String("repo", "client", "Repository in keybase")
var version = flag.String("version", libkb.VersionString(), "Version for tag")
var src = flag.String("src", "", "Path to source file")
var dest = flag.String("dest", "", "Path to destination file")

func main() {
	flag.Parse()

	if len(flag.Args()) < 1 {
		log.Fatal("Specify action")
	}
	action := flag.Arg(0)

	switch action {
	case "version":
		fmt.Printf("%s", libkb.VersionString())
	case "increment-build":
		err := libkb.WriteVersion(libkb.Version, libkb.Build+1, *src)
		if err != nil {
			log.Fatal(err)
		}
	case "latest-version":
		release, err := gh.LatestRelease("keybase", *repo, githubToken())
		if _, ok := err.(*gh.ErrNotFound); ok {
			// No release
		} else if err != nil {
			log.Fatal(err)
		} else {
			if strings.HasPrefix(release.TagName, "v") {
				version := release.TagName[1:]
				fmt.Printf("%s", version)
			}
		}
	case "os-name":
		fmt.Printf("%s", runtime.GOOS)
	case "url":
		release, err := gh.ReleaseOfTag("keybase", *repo, tag(*version), githubToken())
		if _, ok := err.(*gh.ErrNotFound); ok {
			// No release
		} else if err != nil {
			log.Fatal(err)
		} else {
			fmt.Printf("%s", release.URL)
		}
	case "create":
		err := gh.CreateRelease(githubToken(), *repo, tag(*version), tag(*version))
		if err != nil {
			log.Fatal(err)
		}
	case "upload":
		if *src == "" {
			log.Fatal("Need to specify src")
		}
		if *dest == "" {
			dest = src
		}
		log.Printf("Uploading %s as %s (%s)", *src, *dest, tag(*version))
		err := gh.Upload(githubToken(), *repo, tag(*version), *dest, *src)
		if err != nil {
			log.Fatal(err)
		}
	case "download-source":
		err := gh.DownloadSource(githubToken(), *repo, tag(*version))
		if err != nil {
			log.Fatal(err)
		}
	case "download":
		defaultSrc := fmt.Sprintf("keybase-%s-%s.tgz", *version, runtime.GOOS)
		if *src == "" {
			src = &defaultSrc
		}
		log.Printf("Downloading %s (%s)", *src, tag(*version))
		err := gh.DownloadAsset(githubToken(), *repo, tag(*version), *src)
		if err != nil {
			log.Fatal(err)
		}
	}
}
