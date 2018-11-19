package unfurl

import (
	"context"
	"testing"

	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/stretchr/testify/require"
)

func TestExtractor(t *testing.T) {
	uid := gregor1.UID([]byte{0, 1})
	log := logger.NewTestLogger(t)
	settingsMod := NewSettings(log, newMemConversationBackedStorage())
	extractor := NewExtractor(log)
	type testCase struct {
		message   string
		mode      chat1.UnfurlMode
		whitelist []string
		result    []ExtractorHit
	}
	var maxCase string
	var maxRes []ExtractorHit
	for i := 0; i < extractor.maxHits+5; i++ {
		maxCase += " http://www.wsj.com"
	}
	for i := 0; i < extractor.maxHits; i++ {
		maxRes = append(maxRes, ExtractorHit{
			URL: "http://www.wsj.com",
			Typ: ExtractorHitUnfurl,
		})
	}
	cases := []testCase{
		testCase{
			message: "check out this lame post: http://www.twitter.com/mike/383878473873",
			mode:    chat1.UnfurlMode_NEVER,
		},
		testCase{
			message: "check out this lame site: www.google.com",
			mode:    chat1.UnfurlMode_ALWAYS,
		},
		testCase{
			message: maxCase,
			mode:    chat1.UnfurlMode_ALWAYS,
			result:  maxRes,
		},
		testCase{
			message: "check out this lame post: http://www.twitter.com/mike/383878473873",
			mode:    chat1.UnfurlMode_ALWAYS,
			result: []ExtractorHit{
				ExtractorHit{
					URL: "http://www.twitter.com/mike/383878473873",
					Typ: ExtractorHitUnfurl,
				},
			},
		},
		testCase{
			message: "check out this lame post: `http://www.twitter.com/mike/383878473873`",
			mode:    chat1.UnfurlMode_ALWAYS,
			result:  nil,
		},
		testCase{
			message: "check out this lame post: ```http://www.twitter.com/mike/383878473873````",
			mode:    chat1.UnfurlMode_ALWAYS,
			result:  nil,
		},
		testCase{
			message: "check out this lame post: `http://www.twitter.com/mike/383878473873` http://www.twitter.com/mike/MIKE",
			mode:    chat1.UnfurlMode_ALWAYS,
			result: []ExtractorHit{
				ExtractorHit{
					URL: "http://www.twitter.com/mike/MIKE",
					Typ: ExtractorHitUnfurl,
				},
			},
		},
		testCase{
			message: "check out this lame post: http://www.twitter.com/mike/383878473873",
			mode:    chat1.UnfurlMode_WHITELISTED,
			result: []ExtractorHit{
				ExtractorHit{
					URL: "http://www.twitter.com/mike/383878473873",
					Typ: ExtractorHitPrompt,
				},
			},
		},
		testCase{
			message:   "check out this lame post: http://www.twitter.com/mike/383878473873",
			mode:      chat1.UnfurlMode_WHITELISTED,
			whitelist: []string{"twitter.com"},
			result: []ExtractorHit{
				ExtractorHit{
					URL: "http://www.twitter.com/mike/383878473873",
					Typ: ExtractorHitUnfurl,
				},
			},
		},
		testCase{
			message:   "http://www.github.com/keybase/client check out this lame post: http://www.twitter.com/mike/383878473873",
			mode:      chat1.UnfurlMode_WHITELISTED,
			whitelist: []string{"twitter.com", "github.com"},
			result: []ExtractorHit{
				ExtractorHit{
					URL: "http://www.github.com/keybase/client",
					Typ: ExtractorHitUnfurl,
				},
				ExtractorHit{
					URL: "http://www.twitter.com/mike/383878473873",
					Typ: ExtractorHitUnfurl,
				},
			},
		},
	}
	for _, tcase := range cases {
		settings := chat1.NewUnfurlSettings()
		settings.Mode = tcase.mode
		for _, w := range tcase.whitelist {
			settings.Whitelist[w] = true
		}
		require.NoError(t, settingsMod.Set(context.TODO(), uid, settings))
		res, err := extractor.Extract(context.TODO(), uid, tcase.message, settingsMod)
		require.NoError(t, err)
		require.Equal(t, tcase.result, res)
	}
}
