//
//  KBLogoView.m
//  Keybase
//
//  Created by Gabriel on 1/14/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBLogoView.h"


@implementation KBLogoView

- (void)viewInit {
  [super viewInit];

  self.wantsLayer = YES;
  self.layer.backgroundColor = [NSColor colorWithWhite:0.0/255.0 alpha:0.7].CGColor; // NSColor.blackColor.CGColor;

  KBImageView *imageView = [[KBImageView alloc] init];
  imageView.image = [NSImage imageNamed:@"Logo"];
  imageView.imageAlignment = NSImageAlignCenter;
  [self addSubview:imageView];

  _backView = [KBButton buttonWithImage:[NSImage imageNamed:@"46-Arrows-white-arrow-65-30"]];
  [self addSubview:_backView];

  YOSelf yself = self;
  self.viewLayout = [YOLayout layoutWithLayoutBlock:^(id<YOLayout> layout, CGSize size) {
    [layout setFrame:CGRectMake(10, 24, yself.backView.image.size.width + 20, size.height - 40) view:yself.backView];

    [layout setFrame:CGRectMake(20, 30, size.width - 40, size.height - 40) view:imageView];
    return CGSizeMake(size.width, size.height);
  }];
}

- (void)navigationView:(KBNavigationView *)navigationView willTransitionView:(NSView *)view transitionType:(KBNavigationTransitionType)transitionType {
  if (transitionType == KBNavigationTransitionTypePush && navigationView.views.count >= 1) {
    _backView.hidden = NO;
  } else if (transitionType == KBNavigationTransitionTypePop && navigationView.views.count > 2) {
    _backView.hidden = NO;
  } else {
    _backView.hidden = YES;
  }
}

@end
