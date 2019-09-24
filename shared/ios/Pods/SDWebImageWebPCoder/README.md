# SDWebImageWebPCoder

[![CI Status](http://img.shields.io/travis/SDWebImage/SDWebImageWebPCoder.svg?style=flat)](https://travis-ci.org/SDWebImage/SDWebImageWebPCoder)
[![Version](https://img.shields.io/cocoapods/v/SDWebImageWebPCoder.svg?style=flat)](http://cocoapods.org/pods/SDWebImageWebPCoder)
[![License](https://img.shields.io/cocoapods/l/SDWebImageWebPCoder.svg?style=flat)](http://cocoapods.org/pods/SDWebImageWebPCoder)
[![Platform](https://img.shields.io/cocoapods/p/SDWebImageWebPCoder.svg?style=flat)](http://cocoapods.org/pods/SDWebImageWebPCoder)
[![Carthage compatible](https://img.shields.io/badge/Carthage-compatible-4BC51D.svg?style=flat)](https://github.com/SDWebImage/SDWebImageWebPCoder)

Starting with the SDWebImage 5.0 version, we moved the WebP support code and [libwebp](https://github.com/webmproject/libwebp) from the Core Repo to this stand-alone repo.

SDWebImageWebPCoder supports both WebP decoding and encoding, for Static WebP or Animated WebP as well.

## Requirements

+ iOS 8
+ macOS 10.10
+ tvOS 9.0
+ watchOS 2.0

## Installation

#### CocoaPods

SDWebImageWebPCoder is available through [CocoaPods](http://cocoapods.org). To install it, simply add the following line to your Podfile:

```ruby
pod 'SDWebImageWebPCoder'
```

#### Carthage

SDWebImageWebPCoder is available through [Carthage](https://github.com/Carthage/Carthage).

```
github "SDWebImage/SDWebImageWebPCoder"
```

## Usage

+ Objective-C

```objective-c
// Add coder
SDImageWebPCoder *webPCoder = [SDImageWebPCoder sharedCoder];
[[SDImageCodersManager sharedManager] addCoder:webPCoder];

// WebP image loading
UIImageView *imageView;
NSURL *webpURL;
[imageView sd_setImageWithURL:webpURL];

// WebP image encoding
UIImage *image;
NSData *webpData = [[SDImageWebPCoder sharedCoder] encodedDataWithImage:image format:SDImageFormatWebP options:nil];
```

+ Swift

```swift
// Add coder
let WebPCoder = SDImageWebPCoder.shared
SDImageCodersManager.shared.addCoder(WebPCoder)

// WebP online image loading
let webpURL: URL
let imageView: UIImageView
imageView.sd_setImage(with: webpURL)

// WebP image encoding
let image: UIImage
let webpData = SDImageWebPCoder.shared.encodedData(with: image, format: .webP, options: nil)
```

## Example

To run the example project, clone the repo, and run `pod install` from the Example directory first.

This is a demo to show how to use `WebP` and animated `WebP` images via `SDWebImage`.

## Screenshot

<img src="https://raw.githubusercontent.com/SDWebImage/SDWebImageWebPCoder/master/Example/Screenshot/WebPDemo.png" width="300" />

These WebP images are from [WebP Gallery](https://developers.google.com/speed/webp/gallery1) and [GIF vs APNG vs WebP](http://littlesvr.ca/apng/gif_apng_webp.html)

## Author

[Bogdan Poplauschi](https://github.com/bpoplauschi)
[DreamPiggy](https://github.com/dreampiggy)

## License

SDWebImageWebPCoder is available under the MIT license. See [the LICENSE file](https://github.com/SDWebImage/SDWebImageWebPCoder/blob/master/LICENSE) for more info.


