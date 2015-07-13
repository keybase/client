//
//  KBImageView.m
//  Keybase
//
//  Created by Gabriel on 1/9/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBImageView.h"

#import <GHKit/GHKit.h>
#import "KBImage.h"
#import "KBAppearance.h"

@interface KBImageView ()
@property NSString *source;
@property NSImage *originalImage;
@end

@implementation KBImageView

- (void)_viewInit {
}

- (void)viewInit { } // Don't put anything in here in case subclasses forget to call super

- (instancetype)initWithFrame:(NSRect)frame {
  if ((self = [super initWithFrame:frame])) {
    [self _viewInit];
    [self viewInit];
  }
  return self;
}

- (instancetype)initWithCoder:(NSCoder *)coder {
  if ((self = [super initWithCoder:coder])) {
    [self _viewInit];
    [self viewInit];
  }
  return self;
}

- (void)setFrame:(NSRect)frame {
  [super setFrame:frame];
  if (_roundedRatio > 0) {
    [self setRounded:frame.size.width/2.0];
  }
}

- (void)setRounded:(CGFloat)cornerRadius {
  self.wantsLayer = YES;
  self.layer.borderWidth = 0.0;
  //self.layer.borderColor = nil;
  self.layer.cornerRadius = cornerRadius;
  self.layer.masksToBounds = YES;
}

- (void)setImage:(NSImage *)image {
  self.originalImage = image;
  [super setImage:image];
}

- (void)tint:(NSColor *)color {
  self.image = [self.image kb_imageTintedWithColor:color];
}

- (void)revert {
  [super setImage:self.originalImage];
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

- (void)mouseDown:(NSEvent *)event {
  if (!self.dispatchBlock || event.type != NSLeftMouseDown) {
    [super mouseDown:event];
  }
}

- (void)mouseUp:(NSEvent *)event {
  if (self.dispatchBlock && event.type == NSLeftMouseUp) {
    self.dispatchBlock(self, ^{});
  } else {
    [super mouseUp:event];
  }
}

- (BOOL)mouseDownCanMoveWindow {
  return !self.dispatchBlock;
}

@end
