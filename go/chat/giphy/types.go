package giphy

type gifImage struct {
	MP4    string
	Width  string
	Height string
}

type gifObject struct {
	URL    string
	Images map[string]gifImage
}

type giphyResponse struct {
	Data []gifObject
}
