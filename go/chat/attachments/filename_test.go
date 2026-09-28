package attachments

import (
	"context"
	"testing"

	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/stretchr/testify/require"
)

func TestPreprocessCallerPreviewKeepsFilename(t *testing.T) {
	tc := libkb.SetupTest(t, "preprocess", 1)
	defer tc.Cleanup()
	ctx := context.Background()
	log := utils.NewDebugLabeler(tc.G, "preprocess", false)
	callerPreview, err := (&Sender{DebugLabeler: log}).MakeAudioPreview(ctx, []float64{-10, -20, -30}, 1500)
	require.NoError(t, err)
	pre, err := PreprocessAsset(ctx, nil, log, nil, "/tmp/recording-ABC.m4a", nil, &callerPreview)
	require.NoError(t, err)
	require.Equal(t, "/tmp/recording-ABC.m4a", pre.Filename)
}

func TestDownloadBasename(t *testing.T) {
	audioMd := chat1.NewAssetMetadataWithVideo(chat1.AssetMetadataVideo{IsAudio: true})
	videoMd := chat1.NewAssetMetadataWithVideo(chat1.AssetMetadataVideo{})
	cases := []struct {
		asset chat1.Asset
		want  string
	}{
		{chat1.Asset{Filename: "/tmp/recording-ABC.m4a", MimeType: "video/mp4", Metadata: audioMd}, "recording-ABC.m4a"},
		{chat1.Asset{Filename: "", MimeType: "video/mp4", Metadata: audioMd}, "audio.m4a"},
		{chat1.Asset{Filename: ".", MimeType: "video/mp4", Metadata: audioMd}, "audio.m4a"},
		{chat1.Asset{Filename: ".", MimeType: "text/plain; charset=utf-8"}, "attachment.txt"},
		{chat1.Asset{Filename: "", MimeType: "video/mp4", Metadata: videoMd}, "attachment.mp4"},
		{chat1.Asset{Filename: "", MimeType: "image/jpeg"}, "attachment.jpeg"},
		{chat1.Asset{Filename: "", MimeType: ""}, "attachment"},
	}
	for _, c := range cases {
		require.Equal(t, c.want, DownloadBasename(c.asset), "%+v", c.asset)
	}
}
