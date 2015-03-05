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

@implementation KBImageView

//- (instancetype)initWithFrame:(NSRect)frame {
//  if ((self = [super initWithFrame:frame])) {
//    [self unregisterDraggedTypes];
//  }
//  return self;
//}

- (BOOL)mouseDownCanMoveWindow {
  return YES;
}

- (void)setURLString:(NSString *)URLString defaultURLString:(NSString *)defaultURLString {
  _URLString = URLString;
  if (!URLString) {
    self.image = nil;
    [self setNeedsDisplay:YES];
  }
  dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0), ^{
    NSImage *image = [[NSImage alloc] initWithContentsOfURL:[NSURL URLWithString:URLString]];
    dispatch_async(dispatch_get_main_queue(), ^{
      self.image = image;
      if (!self.image && defaultURLString) {
        [self setURLString:defaultURLString defaultURLString:nil];
      }
      [self setNeedsDisplay:YES];
    });
  });
}

- (void)setFrame:(NSRect)frame {
  [super setFrame:frame];
  if (_roundedRatio > 0) {
    [self setRounded:roundf(frame.size.width/2.0)];
  }
}

- (void)setImageSource:(NSString *)imageSource {
  if (!imageSource) {
    self.image = nil;
    return;
  }
  if ([imageSource gh_startsWith:@"http"]) self.URLString = imageSource;
  else self.image = [NSImage imageNamed:imageSource];
}

- (void)setURLString:(NSString *)URLString {
  [self setURLString:URLString defaultURLString:nil];
}

- (void)setURLString:(NSString *)URLString defaultImage:(NSImage *)defaultImage {
  self.image = defaultImage;
  [self setURLString:URLString];
}

- (void)setRounded:(CGFloat)cornerRadius {
  [self setWantsLayer: YES];
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
