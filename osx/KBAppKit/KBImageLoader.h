//
//  KBImageLoader.h
//  Keybase
//
//  Created by Gabriel on 3/9/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>
#import <AppKit/AppKit.h>

@interface KBImageLoader : NSObject

@property (weak) NSImageView *imageView;

- (void)setURLString:(NSString *)URLString;
- (void)setURLString:(NSString *)URLString loadingImage:(NSImage *)loadingImage;
- (void)setURLString:(NSString *)URLString defaultURLString:(NSString *)defaultURLString;

- (void)setImageNamed:(NSString *)imageNamed;

- (void)setImageSource:(NSString *)imageSource;

@end
