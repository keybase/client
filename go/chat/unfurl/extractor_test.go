package unfurl

import (
	"context"
	"testing"

	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/stretchr/testify/require"
)

func TestExtractor(t *testing.T) {
	log := logger.NewTestLogger(t)
	settingsMod := NewSettings(log, newMemConvesationBackedStorage())
	extractor := NewExtractor(log)
	type testCase struct {
		message   string
		mode      chat1.UnfurlMode
		whitelist []string
		result    []ExtractorHit
	}
	cases := []testCase{
		testCase{
			message: "check out this lame post: http://www.twitter.com/mike/383878473873",
			mode:    chat1.UnfurlMode_NEVER,
		},
	}
	for _, tcase := range cases {
		settings := chat1.NewUnfurlSettings()
		settings.Mode = tcase.mode
		for _, w := range tcase.whitelist {
			settings.Whitelist[w] = true
		}
		require.NoError(t, settingsMod.Set(context.TODO(), settings))
		res, err := extractor.Extract(context.TODO(), tcase.message, settingsMod)
		require.NoError(t, err)
		require.Equal(t, tcase.result, res)
	}
}
