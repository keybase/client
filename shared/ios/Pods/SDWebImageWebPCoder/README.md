# SDWebImageWebPCoder

[![CI Status](http://img.shields.io/travis/SDWebImage/SDWebImageWebPCoder.svg?style=flat)](https://travis-ci.org/SDWebImage/SDWebImageWebPCoder)
[![Version](https://img.shields.io/cocoapods/v/SDWebImageWebPCoder.svg?style=flat)](http://cocoapods.org/pods/SDWebImageWebPCoder)
[![License](https://img.shields.io/cocoapods/l/SDWebImageWebPCoder.svg?style=flat)](http://cocoapods.org/pods/SDWebImageWebPCoder)
[![Platform](https://img.shields.io/cocoapods/p/SDWebImageWebPCoder.svg?style=flat)](http://cocoapods.org/pods/SDWebImageWebPCoder)
[![SwiftPM compatible](https://img.shields.io/badge/SwiftPM-compatible-brightgreen.svg?style=flat)](https://swift.org/package-manager/)
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

#### Swift Package Manager (Xcode 11+)

SDWebImageWebPCoder is available through [Swift Package Manager](https://swift.org/package-manager).

```swift
let package = Package(
    dependencies: [
        .package(url: "https://github.com/SDWebImage/SDWebImageWebPCoder.git", from: "0.3.0")
    ]
)
```

## Usage

### Add Coder

Before using SDWebImage to load WebP images, you need to register the WebP Coder to your coders manager. This step is recommended to be done after your App launch (like AppDelegate method).

+ Objective-C

```objective-c
// Add coder
SDImageWebPCoder *webPCoder = [SDImageWebPCoder sharedCoder];
[[SDImageCodersManager sharedManager] addCoder:webPCoder];
```

+ Swift

```swift
// Add coder
let WebPCoder = SDImageWebPCoder.shared
SDImageCodersManager.shared.addCoder(WebPCoder)
```

### Modify HTTP Accept Header

Some of image server provider may try to detect the client supported format, by default, SDWebImage use `image/*,*/*;q=0.8` for [Accept](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Accept). You can modify it with the `image/webp` as well.

+ Objective-C

```objective-c
[[SDWebImageDownloader sharedDownloader] setValue:@"image/webp,image/*,*/*;q=0.8" forHTTPHeaderField:@"Accept"];
```

+ Swift

```swift
SDWebImageDownloader.shared.setValue("image/webp,image/*,*/*;q=0.8", forHTTPHeaderField:"Accept")
```

### Loading

+ Objective-C

```objective-c
// WebP image loading
UIImageView *imageView;
NSURL *webpURL;
[imageView sd_setImageWithURL:webpURL];
```

+ Swift

```swift
// WebP online image loading
let webpURL: URL
let imageView: UIImageView
imageView.sd_setImage(with: webpURL)
```

### Decoding

+ Objective-C

```objective-c
// WebP image decoding
NSData *webpData;
UIImage *image = [[SDImageWebPCoder sharedCoder] decodedImageWithData:webpData options:nil];
```

+ Swift

```swift
// WebP image decoding
let webpData: Data
let image = SDImageWebPCoder.shared.decodedImage(with: data, options: nil)
```

### Thumbnail Decoding

+ Objective-C

```objective-c
// WebP thumbnail image decoding
NSData *webpData;
CGSize thumbnailSize = CGSizeMake(300, 300);
UIImage *thumbnailImage = [[SDImageWebPCoder sharedCoder] decodedImageWithData:webpData options:@{SDImageCoderDecodeThumbnailPixelSize : @(thumbnailSize}];
```

+ Swift

```swift
// WebP thumbnail image decoding
let webpData: Data
let thumbnailSize = CGSize(width: 300, height: 300)
let image = SDImageWebPCoder.shared.decodedImage(with: data, options: [.decodeThumbnailPixelSize: thumbnailSize])
```

### Encoding

+ Objective-c

```objective-c
// WebP image encoding
UIImage *image;
NSData *webpData = [[SDImageWebPCoder sharedCoder] encodedDataWithImage:image format:SDImageFormatWebP options:nil];
```

+ Swift

```swift
// WebP image encoding
let image: UIImage
let webpData = SDImageWebPCoder.shared.encodedData(with: image, format: .webP, options: nil)
```

See more documentation in [SDWebImage Wiki - Coders](https://github.com/SDWebImage/SDWebImage/wiki/Advanced-Usage#custom-coder-420)

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


