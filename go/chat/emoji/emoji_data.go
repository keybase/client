package main

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"sort"
	"strconv"
	"strings"
)

// NOTE when update shared/package.json when updating this version
const emojiDataJSONURL = "https://github.com/iamcal/emoji-data/raw/v4.1.0/emoji.json"

// EmojiData json parse struct
type EmojiData struct {
	Unified     string `json:"unified"`
	ShortName   string `json:"short_name"`
	ObsoletedBy string `json:"obsoleted_by"`
}

// UnifiedToChar renders a character from its hexadecimal codepoint
func UnifiedToChar(unified string) (string, error) {
	codes := strings.Split(unified, "-")
	var sb strings.Builder
	for _, code := range codes {
		s, err := strconv.ParseInt(code, 16, 32)
		if err != nil {
			return "", err
		}
		sb.WriteRune(rune(s))
	}
	return sb.String(), nil
}

func createEmojiDataCodeMap() (map[string]string, map[string][]string, error) {
	res, err := http.Get(emojiDataJSONURL)
	if err != nil {
		return nil, nil, err
	}
	defer res.Body.Close()

	emojiFile, err := ioutil.ReadAll(res.Body)
	if err != nil {
		return nil, nil, err
	}

	var data []EmojiData
	if err := json.Unmarshal(emojiFile, &data); err != nil {
		return nil, nil, err
	}

	// emojiRevCodeMap maps unicode characters to lists of short codes.

	emojiCodeMap := make(map[string]string)
	emojiRevCodeMap := make(map[string][]string)
	for _, emoji := range data {
		if len(emoji.ShortName) == 0 || len(emoji.Unified) == 0 {
			continue
		}
		unified := emoji.Unified
		if len(emoji.ObsoletedBy) > 0 {
			unified = emoji.ObsoletedBy
		}
		unicode, err := UnifiedToChar(unified)
		if err != nil {
			return nil, nil, err
		}
		unicode = fmt.Sprintf("%+q", strings.ToLower(unicode))
		emojiCodeMap[emoji.ShortName] = unicode
		emojiRevCodeMap[unicode] = append(emojiRevCodeMap[unicode], emoji.ShortName)
	}

	// ensure deterministic ordering for aliases
	for _, value := range emojiRevCodeMap {
		sort.Slice(value, func(i, j int) bool {
			if len(value[i]) == len(value[j]) {
				return value[i] < value[j]
			}
			return len(value[i]) < len(value[j])
		})
	}

	return emojiCodeMap, emojiRevCodeMap, nil
}
