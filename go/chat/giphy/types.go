package giphy

type gifImage struct {
	MP4    string
	Width  string
	Height string
}

type gifObject struct {
	URL    string `json:bitly_url`
	Images map[string]gifImage
}

type giphyResponse struct {
	Data []gifObject
}
