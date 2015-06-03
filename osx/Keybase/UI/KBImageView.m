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
@property NSString *source;
@end

@implementation KBImageView

- (void)viewInit { }

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
    [self setRounded:ceilf(frame.size.width/2.0)];
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
  return [self.image copy];

  // TODO Tint image with valid graphics context
  /*
  NSImage *image = [self.image copy];
  [image lockFocus];
  [[NSGraphicsContext currentContext] saveGraphicsState];
  [tint set];
  NSRect imageRect = {NSZeroPoint, [image size]};
  NSRectFillUsingOperation(imageRect, NSCompositeSourceAtop);
  [[NSGraphicsContext currentContext] restoreGraphicsState];
  [image unlockFocus];
  return image;
   */
}

- (void)setImageNamed:(NSString *)imageNamed {
  BOOL isSame = (imageNamed && _source && [_source isEqualTo:imageNamed] && self.image);
  _source = imageNamed;

  if (!isSame) { // Only clear if new image
    self.image = nil;
    [self setNeedsDisplay:YES];
  }
  if (!imageNamed) return;

  GHWeakSelf gself = self;
  dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0), ^{
    NSImage *image = [NSImage imageNamed:imageNamed];
    dispatch_async(dispatch_get_main_queue(), ^{
      gself.image = image;
      [gself setNeedsDisplay:YES];
    });
  });
}

@end
