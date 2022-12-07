package main

import (
	"bytes"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"os/exec"
	"strconv"
	"strings"

	"github.com/blang/semver"
	"github.com/heroku/docker-registry-client/registry"
)

var (
	hub *registry.Registry

	dryRun    = flag.Bool("dry", false, "dry run")
	imageName = flag.String("image-name", "keybaseio/client", "name of the docker hub image")

	username = flag.String("username", "keybasebuild", "docker hub username")
	password = flag.String("password", os.Getenv("DOCKERHUB_PASSWORD"), "docker hub password")

	// keep up to (maxStableCount+maxNightlyCount)*(variants count)=80 tags
	maxStableCount  = flag.Int("max-stable-count", 10, "how many stable versions should be kept")
	maxNightlyCount = flag.Int("max-nightly-count", 10, "how many nightly versions should be kept")

	// min tags count is len(skippedPrefixes)*(variants count)=12
	skippedPrefixes = []string{
		"latest",
		"nightly",
		"stable",
	}
)

func isNumber(x string) bool {
	_, err := strconv.Atoi(x)
	return err == nil
}

func getHubToken(un string, pw string) (string, error) {
	body := &bytes.Buffer{}
	if err := json.NewEncoder(body).Encode(map[string]string{
		"username": un,
		"password": pw,
	}); err != nil {
		return "", err
	}

	req, err := http.NewRequest("POST", "https://hub.docker.com/v2/users/login/", body)
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	var res struct {
		Token string `json:"token"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&res); err != nil {
		return "", err
	}

	return res.Token, nil
}

func deleteTag(token string, repository string, tag string) error {
	req, err := http.NewRequest("DELETE", "https://hub.docker.com/v2/repositories/"+repository+"/tags/"+tag+"/", nil)
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "JWT "+token)
	req.Header.Set("Accept", "application/json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusNoContent {
		return nil
	}
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return err
	}
	return fmt.Errorf("unexpected response (%v): %v", resp.Status, string(body))
}

func main() {
	err := main2()
	msg := "Docker cleanup succeeded."
	if err != nil {
		fmt.Sprintf("Docker cleanup failed: %s.", err)
	}
	cmd := exec.Command("keybase", "chat", "send", os.Getenv("CHAT_TEAM"), msg, "--channel", os.Getenv("CHAT_CHANNEL"))
	ret, err := cmd.CombinedOutput()
	fmt.Println("ret", ret, "err", err)
}

func main2() error {
	flag.Parse()

	// Start by fetching variants
	configRes, err := http.Get("https://raw.githubusercontent.com/keybase/client/master/packaging/linux/docker/config.json")
	if err != nil {
		return err
	}
	var cfg struct {
		Variants map[string]interface{} `json:"variants"`
	}
	if err := json.NewDecoder(configRes.Body).Decode(&cfg); err != nil {
		return err
	}
	variants := []string{}
	for variant := range cfg.Variants {
		log.Printf("Acquired variant %s", variant)
		variants = append(variants, variant)
	}

	hub = &registry.Registry{
		URL: "https://registry-1.docker.io",
		Client: &http.Client{
			Transport: registry.WrapTransport(http.DefaultTransport, "https://registry-1.docker.io", *username, *password),
		},
		Logf: func(format string, args ...interface{}) {},
	}
	if err := hub.Ping(); err != nil {
		return err
	}

	hubToken, err := getHubToken(*username, *password)
	if err != nil {
		return err
	}

	tags, err := hub.Tags("keybaseio/client")
	if err != nil {
		return err
	}

	var (
		remainingTagsCount int
		stableVersionsMap  = map[string]struct{}{}
		nightlyVersionsMap = map[string]struct{}{}
		existingTags       = map[string]struct{}{}
	)
tagLoop:
	for _, tag := range tags {
		existingTags[tag] = struct{}{}

		// We're ignoring all the "skipped prefixes"
		for _, prefix := range skippedPrefixes {
			if strings.HasPrefix(tag, prefix) {
				remainingTagsCount++
				continue tagLoop
			}
		}

		tagParts := strings.Split(tag, "-")
		if len(tagParts) <= 2 ||
			!isNumber(tagParts[1]) {
			// We're dealing with a stable release
			stableVersionsMap[tagParts[0]] = struct{}{}
		} else {
			// For nightlies the identifier consists of 3 dash-separated parts
			nightlyVersionsMap[strings.Join(tagParts[:3], "-")] = struct{}{}
		}
	}

	// Do some processing and sort the currently released tags
	var (
		stableVersions  = []semver.Version{}
		nightlyVersions = []semver.Version{}
	)
	for version := range stableVersionsMap {
		stableVersions = append(stableVersions, semver.MustParse(version))
	}
	for version := range nightlyVersionsMap {
		nightlyVersions = append(nightlyVersions, semver.MustParse(version))
	}
	semver.Sort(stableVersions)
	semver.Sort(nightlyVersions)

	removeTags := func(tags []semver.Version) error {
		for _, tag := range tags {
			baseTag := tag.String()

			for _, variant := range variants {
				fullTag := baseTag
				if variant != "" {
					fullTag += variant
				}
				if _, ok := existingTags[fullTag]; !ok {
					log.Printf("Tag %v does not exist, skipping", fullTag)
					continue
				}
				if *dryRun {
					log.Printf("Would remove %v:%v", *imageName, fullTag)
					continue
				}

				if err := deleteTag(hubToken, *imageName, fullTag); err != nil {
					return fmt.Errorf("Failed to remove tag %v - %v", fullTag, err.Error())
				}

				log.Printf("Tag %v deleted.", fullTag)
			}
		}
		return nil
	}
	countRemainingTags := func(tags []semver.Version) {
		for _, tag := range tags {
			baseTag := tag.String()
			for _, variant := range variants {
				fullTag := baseTag
				if variant != "" {
					fullTag += variant
				}
				if _, ok := existingTags[fullTag]; ok {
					remainingTagsCount++
				}
			}
		}
	}

	// Do the cleanup!
	if len(stableVersions) > *maxStableCount {
		err := removeTags(stableVersions[:len(stableVersions)-*maxStableCount])
		if err != nil {
			return err
		}
		countRemainingTags(stableVersions[len(stableVersions)-*maxStableCount:])
		remainingTagsCount += *maxStableCount * len(variants)
	} else {
		log.Printf("No need to remove any stable tags, %v < %v", len(stableVersions), *maxStableCount)
		countRemainingTags(stableVersions)
	}
	if len(nightlyVersions) > *maxNightlyCount {
		err := removeTags(nightlyVersions[:len(nightlyVersions)-*maxNightlyCount])
		if err != nil {
			return err
		}
		countRemainingTags(nightlyVersions[len(nightlyVersions)-*maxNightlyCount:])
	} else {
		log.Printf("No need to remove any nightly tags, %v < %v", len(nightlyVersions), *maxNightlyCount)
		countRemainingTags(nightlyVersions)
	}

	log.Printf("Started with %v tags, after cleanup we're left with %v tags", len(tags), remainingTagsCount)
	return nil
}
