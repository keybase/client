//
//  KBImageView.m
//  Keybase
//
//  Created by Gabriel on 1/9/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBImageView.h"

#import <GHKit/GHKit.h>
#import "KBAppearance.h"

@interface KBImageView ()
@property KBImageLoader *imageLoader;
@end

@implementation KBImageView

- (void)viewInit {
  //[self unregisterDraggedTypes];
  _imageLoader = [[KBImageLoader alloc] init];
  _imageLoader.imageView = self;
}

- (instancetype)initWithFrame:(NSRect)frame {
  if ((self = [super initWithFrame:frame])) {
    [self viewInit];
  }
  return self;
}

- (instancetype)initWithCoder:(NSCoder *)coder {
  if ((self = [super initWithCoder:coder])) {
    [self viewInit];
  }
  return self;
}

- (BOOL)mouseDownCanMoveWindow {
  return YES;
}

- (void)setFrame:(NSRect)frame {
  [super setFrame:frame];
  if (_roundedRatio > 0) {
    [self setRounded:roundf(frame.size.width/2.0)];
  }
}

- (void)setRounded:(CGFloat)cornerRadius {
  self.wantsLayer = YES;
  self.layer.borderWidth = 1.0;
  self.layer.borderColor = KBAppearance.currentAppearance.lineColor.CGColor;
  self.layer.cornerRadius = cornerRadius;
  self.layer.masksToBounds = YES;
}

- (NSImage *)imageTintedWithColor:(NSColor *)tint {
  NSParameterAssert(tint);
  NSImage *image = [self.image copy];
  [image lockFocus];
  [tint set];
  NSRect imageRect = {NSZeroPoint, [image size]};
  NSRectFillUsingOperation(imageRect, NSCompositeSourceAtop);
  [image unlockFocus];
  return image;
}

@end
