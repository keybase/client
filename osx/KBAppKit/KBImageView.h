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

@class KBImageView;

typedef void (^KBImageViewDispatchBlock)(KBImageView *imageView, dispatch_block_t completion);

@interface KBImageView : NSImageView

@property float roundedRatio;
@property (nonatomic, copy) KBImageViewDispatchBlock dispatchBlock;

- (void)viewInit;

- (void)setImageNamed:(NSString *)imageNamed;

- (void)tint:(NSColor *)color;

- (void)revert;

@end
