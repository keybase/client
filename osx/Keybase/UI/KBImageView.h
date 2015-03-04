//
//  KBImageView.h
//  Keybase
//
//  Created by Gabriel on 1/9/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>
#import <AppKit/AppKit.h>

@interface KBImageView : NSImageView

@property (nonatomic) NSString *URLString;
@property float roundedRatio;

// Can be image named or http
- (void)setImageSource:(NSString *)imageSource;

- (void)setURLString:(NSString *)URLString defaultImage:(NSImage *)defaultImage;

- (NSImage *)imageTintedWithColor:(NSColor *)tint;

@end
