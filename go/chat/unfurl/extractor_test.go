package unfurl

import (
	"context"
	"fmt"
	"testing"

	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/stretchr/testify/require"
)

const codeBlock = "```"

func TestExtractor(t *testing.T) {
	uid := gregor1.UID([]byte{0, 1})
	convID := chat1.ConversationID([]byte{0, 1})
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
			message: fmt.Sprintf(`%s
			[mike@lisa-keybase]-[~/go/src/github.com/keybase/client/go] (mike/markdown)$ scraper https://www.wsj.com/articles/a-silicon-valley-tech-leader-walks-a-high-wire-between-the-u-s-and-china-1542650707?mod=hp_lead_pos4
			2018/11/19 16:33:52 ++Chat: + Scraper: Scrape
			2018/11/19 16:33:53 ++Chat: | Scraper: scrapeGeneric: pubdate: 2018-11-19T18:05:00.000Z
			2018/11/19 16:33:53 ++Chat: | Scraper: scrapeGeneric: success: 1542650700
			2018/11/19 16:33:53 ++Chat: - Scraper: Scrape -> ok [time=893.809968ms]
			Title: A Silicon Valley Tech Leader Walks a High Wire Between the U.S. and China
			Url: https://www.wsj.com/articles/a-silicon-valley-tech-leader-walks-a-high-wire-between-the-u-s-and-china-1542650707
			SiteName: WSJ
			PublishTime: 2018-11-19 13:05:00 -0500 EST
			Description: Nvidia sells lots of artificial-intelligence chips in China. That creates a dilemma as the company tries to navigate political and trade tensions.
			ImageUrl: https://images.wsj.net/im-37707/social,
			FaviconUrl: https://s.wsj.net/media/wsj_apple-touch-icon-180x180.png
			%s`, codeBlock, codeBlock),
			mode:   chat1.UnfurlMode_ALWAYS,
			result: nil,
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
			message: "check out this lame post: ```http://www.twitter.com/mike/383878473873````",
			mode:    chat1.UnfurlMode_ALWAYS,
			result:  nil,
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
		res, err := extractor.Extract(context.TODO(), uid, convID, 1, tcase.message, settingsMod)
		require.NoError(t, err)
		require.Equal(t, tcase.result, res)
	}
}

func TestExtractorExemptions(t *testing.T) {
	uid := gregor1.UID([]byte{0, 1})
	convID := chat1.ConversationID([]byte{0, 1})
	msgID := chat1.MessageID(1)
	log := logger.NewTestLogger(t)
	extractor := NewExtractor(log)
	settings := chat1.NewUnfurlSettings()
	settings.Mode = chat1.UnfurlMode_WHITELISTED
	settings.Whitelist["amazon.com"] = true
	settingsMod := NewSettings(log, newMemConversationBackedStorage())

	extractor.AddWhitelistExemption(context.TODO(), uid,
		NewOneTimeWhitelistExemption(convID, msgID, "amazon.com"))
	res, err := extractor.Extract(context.TODO(), uid, convID, msgID, "http://amazon.com", settingsMod)
	require.NoError(t, err)
	require.Equal(t, 1, len(res))
	require.Equal(t, ExtractorHitUnfurl, res[0].Typ)
	extractor.AddWhitelistExemption(context.TODO(), uid,
		NewOneTimeWhitelistExemption(convID, msgID, "cnn.com"))
	res, err = extractor.Extract(context.TODO(), uid, convID, msgID, "http://amazon.com", settingsMod)
	require.NoError(t, err)
	require.Equal(t, 1, len(res))
	require.Equal(t, ExtractorHitPrompt, res[0].Typ)
	res, err = extractor.Extract(context.TODO(), uid, convID, msgID, "http://cnn.com", settingsMod)
	require.NoError(t, err)
	require.Equal(t, 1, len(res))
	require.Equal(t, ExtractorHitUnfurl, res[0].Typ)
	res, err = extractor.Extract(context.TODO(), uid, convID, msgID, "http://cnn.com", settingsMod)
	require.NoError(t, err)
	require.Equal(t, 1, len(res))
	require.Equal(t, ExtractorHitPrompt, res[0].Typ)

	res, err = extractor.Extract(context.TODO(), uid, convID, msgID, "http://google.com", settingsMod)
	require.NoError(t, err)
	require.Equal(t, 1, len(res))
	require.Equal(t, ExtractorHitPrompt, res[0].Typ)
	extractor.AddWhitelistExemption(context.TODO(), uid,
		NewSingleMessageWhitelistExemption(convID, msgID, "google.com"))
	res, err = extractor.Extract(context.TODO(), uid, convID, msgID, "http://google.com", settingsMod)
	require.NoError(t, err)
	require.Equal(t, 1, len(res))
	require.Equal(t, ExtractorHitUnfurl, res[0].Typ)
	res, err = extractor.Extract(context.TODO(), uid, convID, msgID, "http://google.com", settingsMod)
	require.NoError(t, err)
	require.Equal(t, 1, len(res))
	require.Equal(t, ExtractorHitUnfurl, res[0].Typ)

	require.NoError(t, settingsMod.Set(context.TODO(), uid, settings))
	res, err = extractor.Extract(context.TODO(), uid, convID, msgID, "http://amazon.com", settingsMod)
	require.NoError(t, err)
	require.Equal(t, 1, len(res))
	require.Equal(t, ExtractorHitUnfurl, res[0].Typ)
}
