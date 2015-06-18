//
//  KBImageLoader.m
//  Keybase
//
//  Created by Gabriel on 3/9/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBImageLoader.h"

#import <GHKit/GHKit.h>

@interface KBImageLoader ()
@property (nonatomic) NSString *imageNamed;
@property (nonatomic) NSString *URLString;
@end

@implementation KBImageLoader

- (void)setURLString:(NSString *)URLString defaultURLString:(NSString *)defaultURLString {
  NSAssert(!_imageNamed, @"Using for named image");

  if (!URLString && defaultURLString) URLString = defaultURLString;

  BOOL isSame = (URLString && _URLString && [_URLString isEqualTo:URLString] && self.imageView.image);
  _URLString = URLString;

  if (!isSame) { // Only clear if new image
    _imageView.image = nil;
    [_imageView setNeedsDisplay:YES];
  }
  if (!URLString) return;

  GHWeakSelf gself = self;
  dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0), ^{
    NSImage *image = [[NSImage alloc] initWithContentsOfURL:[NSURL URLWithString:URLString]];
    dispatch_async(dispatch_get_main_queue(), ^{
      gself.imageView.image = image;
      if (!gself.imageView.image && defaultURLString) {
        [self setURLString:defaultURLString defaultURLString:nil];
      }
      [gself.imageView setNeedsDisplay:YES];
    });
  });
}

- (void)setImageNamed:(NSString *)imageNamed {
  NSAssert(!_URLString, @"Using for URL image");

  BOOL isSame = (imageNamed && _imageNamed && [_imageNamed isEqualTo:imageNamed] && self.imageView.image);
  _imageNamed = imageNamed;

  if (!isSame) { // Only clear if new image
    _imageView.image = nil;
    [_imageView setNeedsDisplay:YES];
  }
  if (!imageNamed) return;

  GHWeakSelf gself = self;
  dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0), ^{
    NSImage *image = [NSImage imageNamed:gself.imageNamed];
    dispatch_async(dispatch_get_main_queue(), ^{
      gself.imageView.image = image;
      [gself.imageView setNeedsDisplay:YES];
    });
  });
}

- (void)setImageSource:(NSString *)imageSource {
  if ([imageSource gh_startsWith:@"http"]) {
    self.URLString = imageSource;
  } else {
    self.imageNamed = imageSource;
  }
}

- (void)setURLString:(NSString *)URLString {
  [self setURLString:URLString defaultURLString:nil];
}

- (void)setURLString:(NSString *)URLString loadingImage:(NSImage *)loadingImage {
  self.imageView.image = loadingImage;
  [self setURLString:URLString];
}

@end
