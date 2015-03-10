//
//  KBImageView.h
//  Keybase
//
//  Created by Gabriel on 1/9/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>
#import <AppKit/AppKit.h>
#import "KBImageLoader.h"

@interface KBImageView : NSImageView

@property (nonatomic) NSString *URLString;
@property float roundedRatio;

@property (readonly) KBImageLoader *imageLoader;

- (void)viewInit;

- (NSImage *)imageTintedWithColor:(NSColor *)tint;

@end
