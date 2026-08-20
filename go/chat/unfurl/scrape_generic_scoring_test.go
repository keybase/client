// Copyright 2026 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package unfurl

import (
	"testing"

	"github.com/gocolly/colly/v2"
	"github.com/stretchr/testify/require"
	"golang.org/x/net/html"
)

func faviconElement(t *testing.T, sizes string) *colly.HTMLElement {
	t.Helper()
	node := &html.Node{
		Type: html.ElementNode,
		Data: "link",
		Attr: []html.Attribute{{Key: "sizes", Val: sizes}},
	}
	return colly.NewHTMLElementFromSelectionNode(&colly.Response{}, nil, node, 0)
}

func TestGetFaviconMultiplierMalformedSizes(t *testing.T) {
	for _, sizes := range []string{"", "192", "192x", "x192"} {
		require.Equal(t, 1, getFaviconMultiplier(faviconElement(t, sizes)), sizes)
	}
	require.Equal(t, 384, getFaviconMultiplier(faviconElement(t, "192x192")))
}

func TestSetVideoMalformedDescription(t *testing.T) {
	for _, description := range []string{"", "url", "url 360 640"} {
		var scored scoredGenericRaw
		require.NotPanics(t, func() {
			scored.setVideo(description, 1)
		})
		require.Nil(t, scored.Video, description)
	}

	tests := []struct {
		description string
		height      int
		width       int
	}{
		{description: "url nope 640 video/mp4", height: 0, width: 640},
		{description: "url 360 -1 video/mp4", height: 360, width: 0},
		{description: "url   360   640   video/mp4", height: 360, width: 640},
	}
	for _, test := range tests {
		var scored scoredGenericRaw
		require.NotPanics(t, func() {
			scored.setVideo(test.description, 1)
		})
		require.NotNil(t, scored.Video, test.description)
		require.Equal(t, test.height, scored.Video.Height, test.description)
		require.Equal(t, test.width, scored.Video.Width, test.description)
	}
}
