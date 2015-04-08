//
//  KBImageView.h
//  Keybase
//
//  Created by Gabriel on 1/9/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>
#import <AppKit/AppKit.h>
#import "NSImageView+AFNetworking.h"

@interface KBImageView : NSImageView

@property float roundedRatio;

- (void)viewInit;

- (NSImage *)imageTintedWithColor:(NSColor *)tint;

- (void)setImageNamed:(NSString *)imageNamed;

@end
