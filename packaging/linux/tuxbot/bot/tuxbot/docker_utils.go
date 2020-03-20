package main

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"io"
	"os"
	"strings"
	"time"

	"github.com/docker/docker/api/types"
	"github.com/keybase/backoff"
)

// Tags and pushes images to Docker Hub
func (c Tuxbot) tagAndPush(ctx context.Context, tagsList [][2]string) error {
	authBytes, err := json.Marshal(types.AuthConfig{
		Username: c.dockerUsername,
		Password: c.dockerPassword,
	})
	if err != nil {
		return err
	}
	registryAuth := base64.URLEncoding.EncodeToString(authBytes)

	pushedTags := []string{}

	for _, pair := range tagsList {
		// Only tag if source is set
		if pair[0] != "" {
			// 0 is the source, 1 is the target
			if err := c.docker.ImageTag(ctx, pair[0], pair[1]); err != nil {
				// shouldn't err at all
				c.Info("Failed to tag %s as %s.", pair[0], pair[1])
				return err
			}
		}

		if err := backoff.RetryNotifyWithContext(ctx, func() error {
			// We're entering the Docker Hub territory here. Expect failures.
			output, err := c.docker.ImagePush(ctx, pair[1], types.ImagePushOptions{
				All:          true,
				RegistryAuth: registryAuth,
			})
			if err != nil {
				return err
			}
			if _, err := io.Copy(os.Stdout, output); err != nil {
				return err
			}

			pushedTags = append(pushedTags, pair[1])
			return nil
		}, backoff.NewExponentialBackOff(), func(err error, wait time.Duration) {
			c.Info("Upload of %s failed: %v, retrying in %v", pair[1], err, wait)
		}); err != nil {
			c.Info("Upload of %s failed after backoff: %s", pair[1], err)
			return err
		}
	}

	c.Info("Pushed tags:\n - %s", strings.Join(pushedTags, "\n - "))

	return nil
}

// Checks that the image exists
func (c Tuxbot) imageExists(ctx context.Context, name string) bool {
	_, _, err := c.docker.ImageInspectWithRaw(ctx, name)
	return err == nil
}
