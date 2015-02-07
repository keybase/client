//
//  KBProgressOverlayView.m
//  Keybase
//
//  Created by Gabriel on 1/19/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBProgressOverlayView.h"

#import "KBActivityIndicatorView.h"
#import "KBLabel.h"
#import "KBLookAndFeel.h"

@interface KBProgressOverlayView ()
//@property NSView *overlay;
@property KBLabel *label;
@property (nonatomic) KBActivityIndicatorView *indicatorView;
@end

@implementation KBProgressOverlayView

- (void)viewInit {
  [super viewInit];

  self.hidesWhenStopped = YES;
  self.hidden = YES;

  self.wantsLayer = YES;

//  _overlay = [[NSView alloc] init];
//  _overlay.wantsLayer = YES;
//  self.layer.backgroundColor = [NSColor colorWithDeviceRed:1.0 green:0 blue:0 alpha:0.5].CGColor;
//  [self addSubview:_overlay];

  _label = [[KBLabel alloc] init];
  [_label setText:@"Loading ..." font:[NSFont systemFontOfSize:20] color:[KBLookAndFeel textColor] alignment:NSCenterTextAlignment];
  [self addSubview:_label];

  _indicatorView = [[KBActivityIndicatorView alloc] init];
  [self addSubview:_indicatorView];
}

//- (NSView *)hitTest:(NSPoint)point {
//  if (self.hidden) return nil;
//  return self;
//}

- (void)layout {
  [super layout];

  CGFloat indicatorWidth = 84;
  CGFloat x = self.frame.size.width/2.0 - indicatorWidth/2.0;
  CGFloat y = self.frame.size.height/2.0 - indicatorWidth/2.0;

  _indicatorView.frame = CGRectMake(x, y, indicatorWidth, indicatorWidth);
  _label.frame = CGRectMake(0, y - 40, self.bounds.size.width, 40);

  //_overlay.frame = self.bounds;
}

- (void)setAnimating:(BOOL)animating {
  animating ? [self startAnimating] : [self stopAnimating];
}

- (BOOL)animating {
  return _indicatorView.animating;
}

- (void)startAnimating {
  if (self.hidesWhenStopped) self.hidden = NO;
  [_indicatorView startAnimating];
}

- (void)stopAnimating {
  if (self.hidesWhenStopped) self.hidden = YES;
  [_indicatorView stopAnimating];
}

@end
