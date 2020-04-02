package main

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"strconv"
	"strings"
)

// NOTE when update shared/package.json when updating this version
const emojiDataJsonURL = "https://github.com/iamcal/emoji-data/raw/v4.1.0/emoji.json"

// EmojiData json parse struct
type EmojiData struct {
	Unified   string `json:"unified"`
	ShortName string `json:"short_name"`
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

func createEmojiDataCodeMap() (map[string]string, error) {
	res, err := http.Get(emojiDataJsonURL)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()

	emojiFile, err := ioutil.ReadAll(res.Body)
	if err != nil {
		return nil, err
	}

	var data []EmojiData
	if err := json.Unmarshal(emojiFile, &data); err != nil {
		return nil, err
	}

	emojiCodeMap := make(map[string]string)
	for _, emoji := range data {
		if len(emoji.ShortName) == 0 || len(emoji.Unified) == 0 {
			continue
		}
		code, err := UnifiedToChar(emoji.Unified)
		if err != nil {
			return nil, err
		}
		emojiCodeMap[emoji.ShortName] = fmt.Sprintf("%+q", strings.ToLower(code))
	}

	return emojiCodeMap, nil
}
