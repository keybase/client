// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package update

import (
	"bytes"
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"text/tabwriter"
	"time"

	"github.com/alecthomas/template"
	"github.com/blang/semver"
	"github.com/keybase/client/go/release/version"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/s3"
)

const defaultCacheControl = "max-age=60"

const defaultChannel = "v2"

// Section defines a set of releases
type Section struct {
	Header   string
	Releases []Release
}

// Release defines a release bundle
type Release struct {
	Name       string
	Key        string
	URL        string
	Version    string
	DateString string
	Date       time.Time
	Commit     string
}

// ByRelease defines how to sort releases
type ByRelease []Release

func (s ByRelease) Len() int {
	return len(s)
}

func (s ByRelease) Swap(i, j int) {
	s[i], s[j] = s[j], s[i]
}

func (s ByRelease) Less(i, j int) bool {
	// Reverse date order
	return s[j].Date.Before(s[i].Date)
}

// Client is an S3 client
type Client struct {
	svc *s3.S3
}

// NewClient constructs a Client
func NewClient() (*Client, error) {
	sess, err := session.NewSession(&aws.Config{Region: aws.String("us-east-1")})
	if err != nil {
		return nil, err
	}
	svc := s3.New(sess)
	return &Client{svc: svc}, nil
}

func convertEastern(t time.Time) time.Time {
	locationNewYork, err := time.LoadLocation("America/New_York")
	if err != nil {
		log.Printf("Couldn't load location: %s", err)
	}
	return t.In(locationNewYork)
}

func loadReleases(objects []*s3.Object, bucketName string, prefix string, suffix string, truncate int) []Release {
	var releases []Release
	for _, obj := range objects {
		if strings.HasSuffix(*obj.Key, suffix) {
			urlString, name := urlStringForKey(*obj.Key, bucketName, prefix)
			if name == "index.html" {
				continue
			}
			version, _, date, commit, err := version.Parse(name)
			if err != nil {
				log.Printf("Couldn't get version from name: %s\n", name)
			}
			date = convertEastern(date)
			releases = append(releases,
				Release{
					Name:       name,
					Key:        *obj.Key,
					URL:        urlString,
					Version:    version,
					Date:       date,
					DateString: date.Format("Mon Jan _2 15:04:05 MST 2006"),
					Commit:     commit,
				})
		}
	}
	// TODO: Should also sanity check that version sort is same as time sort
	// otherwise something got messed up
	sort.Sort(ByRelease(releases))
	if truncate > 0 && len(releases) > truncate {
		releases = releases[0:truncate]
	}
	return releases
}

// WriteHTML creates an html file for releases
func WriteHTML(bucketName string, prefixes string, suffix string, outPath string, uploadDest string) error {
	var sections []Section
	for _, prefix := range strings.Split(prefixes, ",") {

		objs, listErr := listAllObjects(bucketName, prefix)
		if listErr != nil {
			return listErr
		}

		releases := loadReleases(objs, bucketName, prefix, suffix, 50)
		if len(releases) > 0 {
			log.Printf("Found %d release(s) at %s\n", len(releases), prefix)
			// for _, release := range releases {
			// 	log.Printf(" %s %s %s\n", release.Name, release.Version, release.DateString)
			// }
		}
		sections = append(sections, Section{
			Header:   prefix,
			Releases: releases,
		})
	}

	var buf bytes.Buffer
	err := WriteHTMLForLinks(bucketName, sections, &buf)
	if err != nil {
		return err
	}
	if outPath != "" {
		err = makeParentDirs(outPath)
		if err != nil {
			return err
		}
		err = os.WriteFile(outPath, buf.Bytes(), 0644)
		if err != nil {
			return err
		}
	}

	if uploadDest != "" {
		client, err := NewClient()
		if err != nil {
			return err
		}

		log.Printf("Uploading to %s", uploadDest)
		_, err = client.svc.PutObject(&s3.PutObjectInput{
			Bucket:        aws.String(bucketName),
			Key:           aws.String(uploadDest),
			CacheControl:  aws.String(defaultCacheControl),
			ACL:           aws.String("public-read"),
			Body:          bytes.NewReader(buf.Bytes()),
			ContentLength: aws.Int64(int64(buf.Len())),
			ContentType:   aws.String("text/html"),
		})
		if err != nil {
			return err
		}
	}

	return nil
}

var htmlTemplate = `
<!doctype html>
<html lang="en">
<head>
  <title>{{ .Title }}</title>
	<style>
  body { font-family: monospace; }
  </style>
</head>
<body>
	{{ range $index, $sec := .Sections }}
		<h3>{{ $sec.Header }}</h3>
		<ul>
		{{ range $index2, $rel := $sec.Releases }}
		<li><a href="{{ $rel.URL }}">{{ $rel.Name }}</a> <strong>{{ $rel.Version }}</strong> <em>{{ $rel.Date }}</em> <a href="https://github.com/keybase/client/commit/{{ $rel.Commit }}"">{{ $rel.Commit }}</a></li>
		{{ end }}
		</ul>
	{{ end }}
</body>
</html>
`

// WriteHTMLForLinks writes a summary document for a set of releases
func WriteHTMLForLinks(title string, sections []Section, writer io.Writer) error {
	vars := map[string]interface{}{
		"Title":    title,
		"Sections": sections,
	}

	t, err := template.New("t").Parse(htmlTemplate)
	if err != nil {
		return err
	}

	return t.Execute(writer, vars)
}

// Platform defines where platform specific files are (in darwin, linux, windows)
type Platform struct {
	Name          string
	Prefix        string
	PrefixSupport string
	Suffix        string
	LatestName    string
}

// CopyLatest copies latest release to a fixed path
func CopyLatest(bucketName string, platform string, dryRun bool) error {
	client, err := NewClient()
	if err != nil {
		return err
	}
	return client.CopyLatest(bucketName, platform, dryRun)
}

const (
	// PlatformTypeDarwin is platform type for OS X
	PlatformTypeDarwin      = "darwin"
	PlatformTypeDarwinArm64 = "darwin-arm64"
	// PlatformTypeLinux is platform type for Linux
	PlatformTypeLinux = "linux"
	// PlatformTypeWindows is platform type for windows
	PlatformTypeWindows = "windows"
)

var platformDarwin = Platform{Name: PlatformTypeDarwin, Prefix: "darwin/", PrefixSupport: "darwin-support/", LatestName: "Keybase.dmg"}
var platformDarwinArm64 = Platform{Name: PlatformTypeDarwinArm64, Prefix: "darwin-arm64/", PrefixSupport: "darwin-arm64-support/", LatestName: "Keybase-arm64.dmg"}
var platformLinuxDeb = Platform{Name: "deb", Prefix: "linux_binaries/deb/", Suffix: "_amd64.deb", LatestName: "keybase_amd64.deb"}
var platformLinuxRPM = Platform{Name: "rpm", Prefix: "linux_binaries/rpm/", Suffix: ".x86_64.rpm", LatestName: "keybase_amd64.rpm"}
var platformWindows = Platform{Name: PlatformTypeWindows, Prefix: "windows/", PrefixSupport: "windows-support/", LatestName: "keybase_setup_amd64.msi"}

var platformsAll = []Platform{
	platformDarwin,
	platformDarwinArm64,
	platformLinuxDeb,
	platformLinuxRPM,
	platformWindows,
}

// Platforms returns platforms for a name (linux may have multiple platforms) or all platforms is "" is specified
func Platforms(name string) ([]Platform, error) {
	switch name {
	case PlatformTypeDarwin:
		return []Platform{platformDarwin}, nil
	case PlatformTypeDarwinArm64:
		return []Platform{platformDarwinArm64}, nil
	case PlatformTypeLinux:
		return []Platform{platformLinuxDeb, platformLinuxRPM}, nil
	case PlatformTypeWindows:
		return []Platform{platformWindows}, nil
	case "":
		return platformsAll, nil
	default:
		return nil, fmt.Errorf("Invalid platform %s", name)
	}
}

func listAllObjects(bucketName string, prefix string) ([]*s3.Object, error) {
	client, err := NewClient()
	if err != nil {
		return nil, err
	}

	marker := ""
	objs := make([]*s3.Object, 0, 1000)
	for {
		resp, err := client.svc.ListObjects(&s3.ListObjectsInput{
			Bucket:    aws.String(bucketName),
			Delimiter: aws.String("/"),
			Prefix:    aws.String(prefix),
			Marker:    aws.String(marker),
		})
		if err != nil {
			return nil, err
		}
		if resp == nil {
			break
		}

		out := *resp
		nextMarker := ""
		truncated := false
		if out.NextMarker != nil {
			nextMarker = *out.NextMarker
		}
		if out.IsTruncated != nil {
			truncated = *out.IsTruncated
		}

		objs = append(objs, out.Contents...)
		if !truncated {
			break
		}

		log.Printf("Response is truncated, next marker is %s\n", nextMarker)
		marker = nextMarker
	}

	return objs, nil
}

// FindRelease searches for a release matching a predicate
func (p *Platform) FindRelease(bucketName string, f func(r Release) bool) (*Release, error) {
	contents, err := listAllObjects(bucketName, p.Prefix)
	if err != nil {
		return nil, err
	}

	releases := loadReleases(contents, bucketName, p.Prefix, p.Suffix, 0)
	for _, release := range releases {
		if !strings.HasSuffix(release.Key, p.Suffix) {
			continue
		}
		if f(release) {
			return &release, nil
		}
	}
	return nil, nil
}

// Files returns all files associated with this platforms release
func (p Platform) Files(releaseName string) ([]string, error) {
	switch p.Name {
	case PlatformTypeDarwin:
		return []string{
			fmt.Sprintf("darwin/Keybase-%s.dmg", releaseName),
			fmt.Sprintf("darwin-updates/Keybase-%s.zip", releaseName),
			fmt.Sprintf("darwin-support/update-darwin-prod-%s.json", releaseName),
		}, nil
	case PlatformTypeDarwinArm64:
		return []string{
			fmt.Sprintf("darwin-arm64/Keybase-%s.dmg", releaseName),
			fmt.Sprintf("darwin-arm64-updates/Keybase-%s.zip", releaseName),
			fmt.Sprintf("darwin-arm64-support/update-darwin-prod-%s.json", releaseName),
		}, nil
	default:
		return nil, fmt.Errorf("Unsupported for this platform: %s", p.Name)
	}
}

// WriteHTML will generate index.html for the platform
func (p Platform) WriteHTML(bucketName string) error {
	return WriteHTML(bucketName, p.Prefix, "", "", p.Prefix+"/index.html")
}

// CopyLatest copies latest release to a fixed path for the Client
func (c *Client) CopyLatest(bucketName string, platform string, dryRun bool) error {
	platforms, err := Platforms(platform)
	if err != nil {
		return err
	}
	for _, platform := range platforms {
		var url string
		// Use update json to look for current DMG (for darwin)
		// TODO: Fix for linux
		switch platform.Name {
		case PlatformTypeDarwin, PlatformTypeDarwinArm64, PlatformTypeWindows:
			url, err = c.copyFromUpdate(platform, bucketName)
		default:
			_, url, err = c.copyFromReleases(platform, bucketName)
		}
		if err != nil {
			return err
		}
		if url == "" {
			continue
		}

		if dryRun {
			log.Printf("DRYRUN: Would copy latest %s to %s\n", url, platform.LatestName)
			return nil
		}

		_, err := c.svc.CopyObject(&s3.CopyObjectInput{
			Bucket:       aws.String(bucketName),
			CopySource:   aws.String(url),
			Key:          aws.String(platform.LatestName),
			CacheControl: aws.String(defaultCacheControl),
			ACL:          aws.String("public-read"),
		})
		if err != nil {
			return err
		}
	}
	return nil
}

func (c *Client) copyFromUpdate(platform Platform, bucketName string) (url string, err error) {
	currentUpdate, path, err := c.CurrentUpdate(bucketName, defaultChannel, platform.Name, "prod")
	if err != nil {
		err = fmt.Errorf("Error getting current public update: %s", err)
		return
	}
	if currentUpdate == nil {
		err = fmt.Errorf("No latest for %s at %s", platform.Name, path)
		return
	}
	switch platform.Name {
	case PlatformTypeDarwin, PlatformTypeDarwinArm64:
		url = urlString(bucketName, platform.Prefix, fmt.Sprintf("Keybase-%s.dmg", currentUpdate.Version))
	case PlatformTypeWindows:
		url = urlString(bucketName, platform.Prefix, fmt.Sprintf("Keybase_%s.amd64.msi", currentUpdate.Version))
	default:
		err = fmt.Errorf("Unsupported platform for copyFromUpdate")
	}
	return
}

func (c *Client) copyFromReleases(platform Platform, bucketName string) (release *Release, url string, err error) {
	release, err = platform.FindRelease(bucketName, func(r Release) bool { return true })
	if err != nil || release == nil {
		return
	}
	url, _ = urlStringForKey(release.Key, bucketName, platform.Prefix)
	return
}

// CurrentUpdate returns current update for a platform
func (c *Client) CurrentUpdate(bucketName string, channel string, platformName string, env string) (currentUpdate *Update, path string, err error) {
	path = updateJSONName(channel, platformName, env)
	log.Printf("Fetching current update at %s", path)
	resp, err := c.svc.GetObject(&s3.GetObjectInput{
		Bucket: aws.String(bucketName),
		Key:    aws.String(path),
	})
	if err != nil {
		return
	}
	defer func() { _ = resp.Body.Close() }()
	currentUpdate, err = DecodeJSON(resp.Body)
	return
}

func promoteRelease(bucketName string, delay time.Duration, hourEastern int, toChannel string, platform Platform, env string, allowDowngrade bool, release string) (*Release, error) {
	client, err := NewClient()
	if err != nil {
		return nil, err
	}
	return client.PromoteRelease(bucketName, delay, hourEastern, toChannel, platform, env, allowDowngrade, release)
}

func updateJSONName(channel string, platformName string, env string) string {
	if channel == "" {
		return fmt.Sprintf("update-%s-%s.json", platformName, env)
	}
	return fmt.Sprintf("update-%s-%s-%s.json", platformName, env, channel)
}

// PromoteARelease promotes a specific release to Prod.
func PromoteARelease(releaseName string, bucketName string, platform string, dryRun bool) (release *Release, err error) {
	switch platform {
	case PlatformTypeDarwin, PlatformTypeDarwinArm64, PlatformTypeWindows:
		// pass
	default:
		return nil, fmt.Errorf("Promoting releases is only supported for darwin or windows")

	}

	client, err := NewClient()
	if err != nil {
		return nil, err
	}

	platformRes, err := Platforms(platform)
	if err != nil {
		return nil, err
	}
	if len(platformRes) != 1 {
		return nil, fmt.Errorf("Promoting on multiple platforms is not supported")
	}

	platformType := platformRes[0]
	release, err = client.promoteAReleaseToProd(releaseName, bucketName, platformType, "prod", defaultChannel, dryRun)
	if err != nil {
		return nil, err
	}
	if dryRun {
		return release, nil
	}
	log.Printf("Promoted %s release: %s\n", platform, releaseName)
	return release, nil
}

func (c *Client) promoteAReleaseToProd(releaseName string, bucketName string, platform Platform, env string, toChannel string, dryRun bool) (release *Release, err error) {
	var filePath string
	switch platform.Name {
	case PlatformTypeDarwin, PlatformTypeDarwinArm64:
		filePath = fmt.Sprintf("Keybase-%s.dmg", releaseName)
	case PlatformTypeWindows:
		filePath = fmt.Sprintf("Keybase_%s.amd64.msi", releaseName)
	default:
		return nil, fmt.Errorf("Unsupported for this platform: %s", platform.Name)
	}

	release, err = platform.FindRelease(bucketName, func(r Release) bool {
		return r.Name == filePath
	})
	if err != nil {
		return nil, err
	}
	if release == nil {
		return nil, fmt.Errorf("No matching release found")
	}
	log.Printf("Found %s release %s (%s), %s", platform.Name, release.Name, time.Since(release.Date), release.Version)
	jsonName := updateJSONName(toChannel, platform.Name, env)
	jsonURL := urlString(bucketName, platform.PrefixSupport, fmt.Sprintf("update-%s-%s-%s.json", platform.Name, env, release.Version))

	if dryRun {
		log.Printf("DRYRUN: Would PutCopy %s to %s\n", jsonURL, jsonName)
		return release, nil
	}
	log.Printf("PutCopying %s to %s\n", jsonURL, jsonName)
	_, err = c.svc.CopyObject(&s3.CopyObjectInput{
		Bucket:       aws.String(bucketName),
		CopySource:   aws.String(jsonURL),
		Key:          aws.String(jsonName),
		CacheControl: aws.String(defaultCacheControl),
		ACL:          aws.String("public-read"),
	})
	return release, err
}

// PromoteRelease promotes a release to a channel
func (c *Client) PromoteRelease(bucketName string, delay time.Duration, beforeHourEastern int, toChannel string, platform Platform, env string, allowDowngrade bool, releaseName string) (*Release, error) {
	log.Printf("Finding release to promote to %q (%s delay) in env %s", toChannel, delay, env)
	var release *Release
	var err error

	if releaseName != "" {
		releaseName = fmt.Sprintf("Keybase-%s.dmg", releaseName)
		release, err = platform.FindRelease(bucketName, func(r Release) bool {
			return r.Name == releaseName
		})
	} else {
		release, err = platform.FindRelease(bucketName, func(r Release) bool {
			log.Printf("Checking release date %s", r.Date)
			if delay != 0 && time.Since(r.Date) < delay {
				return false
			}
			hour, _, _ := r.Date.Clock()
			if beforeHourEastern != 0 && hour >= beforeHourEastern {
				return false
			}
			return true
		})
	}

	if err != nil {
		return nil, err
	}

	if release == nil {
		log.Printf("No matching release found")
		return nil, nil
	}
	log.Printf("Found release %s (%s), %s", release.Name, time.Since(release.Date), release.Version)

	currentUpdate, _, err := c.CurrentUpdate(bucketName, toChannel, platform.Name, env)
	if err != nil {
		log.Printf("Error looking for current update: %s (%s)", err, platform.Name)
	}
	if currentUpdate != nil {
		log.Printf("Found current update: %s", currentUpdate.Version)
		var currentVer semver.Version
		currentVer, err = semver.Make(currentUpdate.Version)
		if err != nil {
			return nil, err
		}
		var releaseVer semver.Version
		releaseVer, err = semver.Make(release.Version)
		if err != nil {
			return nil, err
		}

		if releaseVer.Equals(currentVer) {
			log.Printf("Release unchanged")
			return nil, nil
		} else if releaseVer.LT(currentVer) {
			if !allowDowngrade {
				log.Printf("Release older than current update")
				return nil, nil
			}
			log.Printf("Allowing downgrade")
		}
	}

	jsonURL := urlString(bucketName, platform.PrefixSupport, fmt.Sprintf("update-%s-%s-%s.json", platform.Name, env, release.Version))
	jsonName := updateJSONName(toChannel, platform.Name, env)
	log.Printf("PutCopying %s to %s\n", jsonURL, jsonName)
	_, err = c.svc.CopyObject(&s3.CopyObjectInput{
		Bucket:       aws.String(bucketName),
		CopySource:   aws.String(jsonURL),
		Key:          aws.String(jsonName),
		CacheControl: aws.String(defaultCacheControl),
		ACL:          aws.String("public-read"),
	})

	if err != nil {
		return nil, err
	}
	return release, nil
}

func copyUpdateJSON(bucketName string, fromChannel string, toChannel string, platformName string, env string) error {
	client, err := NewClient()
	if err != nil {
		return err
	}
	jsonNameDest := updateJSONName(toChannel, platformName, env)
	jsonURLSource := urlString(bucketName, "", updateJSONName(fromChannel, platformName, env))

	log.Printf("PutCopying %s to %s\n", jsonURLSource, jsonNameDest)
	_, err = client.svc.CopyObject(&s3.CopyObjectInput{
		Bucket:       aws.String(bucketName),
		CopySource:   aws.String(jsonURLSource),
		Key:          aws.String(jsonNameDest),
		CacheControl: aws.String(defaultCacheControl),
		ACL:          aws.String("public-read"),
	})
	return err
}

func (c *Client) report(tw io.Writer, bucketName string, channel string, platformName string) {
	update, jsonPath, err := c.CurrentUpdate(bucketName, channel, platformName, "prod")
	fmt.Fprintf(tw, "%s\t%s\t", platformName, channel)
	if err != nil {
		fmt.Fprintln(tw, "Error")
	} else if update != nil {
		published := ""
		if update.PublishedAt != nil {
			published = convertEastern(FromTime(*update.PublishedAt)).Format(time.UnixDate)
		}
		fmt.Fprintf(tw, "%s\t%s\t%s\n", update.Version, published, jsonPath)
	} else {
		fmt.Fprintln(tw, "None")
	}
}

// Report returns a summary of releases
func Report(bucketName string, writer io.Writer) error {
	client, err := NewClient()
	if err != nil {
		return err
	}

	tw := tabwriter.NewWriter(writer, 5, 0, 3, ' ', 0)
	fmt.Fprintln(tw, "Platform\tChannel\tVersion\tCreated\tSource")
	client.report(tw, bucketName, "test-v2", PlatformTypeDarwin)
	client.report(tw, bucketName, "v2", PlatformTypeDarwin)
	client.report(tw, bucketName, "test-v2", PlatformTypeDarwinArm64)
	client.report(tw, bucketName, "v2", PlatformTypeDarwinArm64)
	client.report(tw, bucketName, "test", PlatformTypeLinux)
	client.report(tw, bucketName, "", PlatformTypeLinux)
	return tw.Flush()
}

// promoteTestReleaseForDarwin creates a test release for darwin
func promoteTestReleaseForDarwin(bucketName string, release string) (*Release, error) {
	return promoteRelease(bucketName, time.Duration(0), 0, "test-v2", platformDarwin, "prod", true, release)
}

func promoteTestReleaseForDarwinArm64(bucketName string, release string) (*Release, error) {
	return promoteRelease(bucketName, time.Duration(0), 0, "test-v2", platformDarwinArm64, "prod", true, release)
}

// promoteTestReleaseForLinux creates a test release for linux
func promoteTestReleaseForLinux(bucketName string) error {
	// This just copies public to test since we don't do promotion on this platform yet
	return copyUpdateJSON(bucketName, "", "test", PlatformTypeLinux, "prod")
}

// promoteTestReleaseForWindows creates a test release for windows
func promoteTestReleaseForWindows(bucketName string) error {
	// This just copies public to test since we don't do promotion on this platform yet
	return copyUpdateJSON(bucketName, "", "test", PlatformTypeWindows, "prod")
}

// PromoteTestReleases creates test releases for a platform
func PromoteTestReleases(bucketName string, platformName string, release string) error {
	switch platformName {
	case PlatformTypeDarwin:
		_, err := promoteTestReleaseForDarwin(bucketName, release)
		return err
	case PlatformTypeDarwinArm64:
		_, err := promoteTestReleaseForDarwinArm64(bucketName, release)
		return err
	case PlatformTypeLinux:
		return promoteTestReleaseForLinux(bucketName)
	case PlatformTypeWindows:
		return promoteTestReleaseForWindows(bucketName)
	default:
		return fmt.Errorf("Invalid platform %s", platformName)
	}
}

// PromoteReleases creates releases for a platform
func PromoteReleases(bucketName string, platformType string) (release *Release, err error) {
	var platform Platform
	switch platformType {
	case PlatformTypeDarwin:
		platform = platformDarwin
	case PlatformTypeDarwinArm64:
		platform = platformDarwinArm64
	default:
		log.Printf("Promoting releases is unsupported for %s", platformType)
		return
	}
	release, err = promoteRelease(bucketName, time.Hour*27, 10, defaultChannel, platform, "prod", false, "")
	if err != nil {
		return nil, err
	}
	if release != nil {
		log.Printf("Promoted (darwin) release: %s\n", release.Name)
	}
	return release, nil
}

// ReleaseBroken marks a release as broken. The releaseName is the version,
// for example, 1.2.3+400-deadbeef.
func ReleaseBroken(releaseName string, bucketName string, platformName string) ([]string, error) {
	client, err := NewClient()
	if err != nil {
		return nil, err
	}
	platforms, err := Platforms(platformName)
	if err != nil {
		return nil, err
	}
	removed := []string{}
	for _, platform := range platforms {
		files, err := platform.Files(releaseName)
		if err != nil {
			return nil, err
		}
		for _, path := range files {
			sourceURL := urlString(bucketName, "", path)
			brokenPath := fmt.Sprintf("broken/%s", path)
			log.Printf("Copying %s to %s", sourceURL, brokenPath)

			_, err := client.svc.CopyObject(&s3.CopyObjectInput{
				Bucket:       aws.String(bucketName),
				CopySource:   aws.String(sourceURL),
				Key:          aws.String(brokenPath),
				CacheControl: aws.String(defaultCacheControl),
				ACL:          aws.String("public-read"),
			})
			if err != nil {
				log.Printf("There was an error trying to (put) copy %s: %s", sourceURL, err)
				continue
			}

			log.Printf("Deleting: %s", path)
			_, err = client.svc.DeleteObject(&s3.DeleteObjectInput{Bucket: aws.String(bucketName), Key: aws.String(path)})
			if err != nil {
				return removed, err
			}
			removed = append(removed, path)
		}

		// Update html for platform
		if err := platform.WriteHTML(bucketName); err != nil {
			log.Printf("Error updating html: %s", err)
		}

		// Fix test releases if needed
		if err := PromoteTestReleases(bucketName, platform.Name, ""); err != nil {
			log.Printf("Error fixing test releases: %s", err)
		}
	}
	log.Printf("Deleted %d files for %s", len(removed), releaseName)
	if len(removed) == 0 {
		return removed, fmt.Errorf("No files to remove for %s", releaseName)
	}

	return removed, nil
}

// SaveLog saves log to S3 bucket (last maxNumBytes) and returns the URL.
// The log is publicly readable on S3 but the url is not discoverable.
func SaveLog(bucketName string, localPath string, maxNumBytes int64) (string, error) {
	client, err := NewClient()
	if err != nil {
		return "", err
	}

	file, err := os.Open(localPath)
	if err != nil {
		return "", fmt.Errorf("Error opening: %s", err)
	}
	defer func() { _ = file.Close() }()

	stat, err := os.Stat(localPath)
	if err != nil {
		return "", fmt.Errorf("Error in stat: %s", err)
	}
	if maxNumBytes > stat.Size() {
		maxNumBytes = stat.Size()
	}

	data := make([]byte, maxNumBytes)
	start := stat.Size() - maxNumBytes
	_, err = file.ReadAt(data, start)
	if err != nil {
		return "", fmt.Errorf("Error reading: %s", err)
	}

	filename := filepath.Base(localPath)
	logID, err := RandomID()
	if err != nil {
		return "", err
	}
	uploadDest := filepath.ToSlash(filepath.Join("logs", fmt.Sprintf("%s-%s%s", filename, logID, ".txt")))

	_, err = client.svc.PutObject(&s3.PutObjectInput{
		Bucket:        aws.String(bucketName),
		Key:           aws.String(uploadDest),
		CacheControl:  aws.String(defaultCacheControl),
		ACL:           aws.String("public-read"),
		Body:          bytes.NewReader(data),
		ContentLength: aws.Int64(int64(len(data))),
		ContentType:   aws.String("text/plain"),
	})
	if err != nil {
		return "", err
	}

	url := urlStringNoEscape(bucketName, uploadDest)
	return url, nil
}
