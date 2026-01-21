// Copyright 2025 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"sort"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

const (
	defaultRetentionDays = 7
	defaultKeepLatest    = 5
)

// fileInfo represents an S3 object with its metadata
type fileInfo struct {
	key          string
	lastModified time.Time
	size         int64
}

// formatSize converts bytes to human-readable format (GB, MB, KB, or B)
func formatSize(size int64) string {
	const (
		gb = 1073741824
		mb = 1048576
		kb = 1024
	)

	switch {
	case size >= gb:
		return fmt.Sprintf("%.2f GB", float64(size)/gb)
	case size >= mb:
		return fmt.Sprintf("%.2f MB", float64(size)/mb)
	case size >= kb:
		return fmt.Sprintf("%.2f KB", float64(size)/kb)
	default:
		return fmt.Sprintf("%d B", size)
	}
}

// listAllObjects lists all objects in the given bucket and prefix
func listAllObjects(ctx context.Context, client *s3.Client, bucketName, prefix string) ([]fileInfo, error) {
	var files []fileInfo
	var continuationToken *string

	for {
		input := &s3.ListObjectsV2Input{
			Bucket:            aws.String(bucketName),
			Prefix:            aws.String(prefix),
			ContinuationToken: continuationToken,
		}

		resp, err := client.ListObjectsV2(ctx, input)
		if err != nil {
			return nil, fmt.Errorf("failed to list objects: %w", err)
		}

		for _, obj := range resp.Contents {
			if obj.Key == nil || obj.LastModified == nil {
				continue
			}
			files = append(files, fileInfo{
				key:          *obj.Key,
				lastModified: *obj.LastModified,
				size:         aws.ToInt64(obj.Size),
			})
		}

		if !aws.ToBool(resp.IsTruncated) {
			break
		}
		continuationToken = resp.NextContinuationToken
	}

	return files, nil
}

// cleanupOldPackages deletes packages older than retentionDays, but always keeps the latest keepLatest files
func cleanupOldPackages(ctx context.Context, client *s3.Client, bucketName, prefix string, retentionDays, keepLatest int) error {
	fmt.Printf("Cleaning up old packages in s3://%s/%s (retention: %d days, keep latest: %d files)\n",
		bucketName, prefix, retentionDays, keepLatest)

	// List all objects
	files, err := listAllObjects(ctx, client, bucketName, prefix)
	if err != nil {
		return err
	}

	if len(files) == 0 {
		fmt.Printf("  No objects found in %s\n", prefix)
		return nil
	}

	// Sort by last modified time (newest first)
	sort.Slice(files, func(i, j int) bool {
		return files[i].lastModified.After(files[j].lastModified)
	})

	// Get the latest keepLatest files
	latestFiles := make(map[string]bool)
	for i := 0; i < keepLatest && i < len(files); i++ {
		latestFiles[files[i].key] = true
	}

	// Calculate cutoff time
	cutoffTime := time.Now().AddDate(0, 0, -retentionDays)

	// Delete old files
	var deletedCount int
	var totalDeletedSize int64
	for _, file := range files {
		// Skip if this file should be kept (in latest N)
		if latestFiles[file.key] {
			continue
		}

		// Delete if older than cutoff
		if file.lastModified.Before(cutoffTime) {
			ageDays := int(time.Since(file.lastModified).Hours() / 24)
			fmt.Printf("  Deleting old file: %s (age: %d days, size: %s)\n",
				file.key, ageDays, formatSize(file.size))

			// Uncomment to actually delete:
			// _, err := client.DeleteObject(ctx, &s3.DeleteObjectInput{
			// 	Bucket: aws.String(bucketName),
			// 	Key:    aws.String(file.key),
			// })
			// if err != nil {
			// 	log.Printf("    Warning: Failed to delete %s: %v", file.key, err)
			// 	continue
			// }

			deletedCount++
			totalDeletedSize += file.size
		}
	}

	if deletedCount > 0 {
		fmt.Printf("  Deleted %d old file(s) from %s (total size: %s)\n",
			deletedCount, prefix, formatSize(totalDeletedSize))
	} else {
		fmt.Printf("  No old files to delete in %s\n", prefix)
	}

	return nil
}

func main() {
	var (
		bucketName    = flag.String("bucket", "", "S3 bucket name (required)")
		prefix        = flag.String("prefix", "", "S3 prefix/path (required)")
		retentionDays = flag.Int("retention", defaultRetentionDays, "Number of days to retain files")
		keepLatest    = flag.Int("keep-latest", defaultKeepLatest, "Number of latest files to always keep")
	)
	flag.Parse()

	if *bucketName == "" {
		log.Fatal("Error: -bucket is required")
	}
	if *prefix == "" {
		log.Fatal("Error: -prefix is required")
	}

	// Ensure prefix ends with / if it doesn't already
	if !strings.HasSuffix(*prefix, "/") {
		*prefix += "/"
	}

	// Load AWS config
	ctx := context.Background()
	cfg, err := config.LoadDefaultConfig(ctx, config.WithRegion("us-east-1"))
	if err != nil {
		log.Fatalf("Failed to load AWS config: %v", err)
	}

	// Create S3 client
	client := s3.NewFromConfig(cfg)

	// Run cleanup
	if err := cleanupOldPackages(ctx, client, *bucketName, *prefix, *retentionDays, *keepLatest); err != nil {
		log.Fatalf("Error cleaning up packages: %v", err)
	}
}
