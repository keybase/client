//
//  KBUserStatusView.m
//  Keybase
//
//  Created by Gabriel on 3/3/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBUserStatusView.h"

@interface KBUserStatusView ()
@property KBImageView *imageView;
@property KBLabel *nameLabel;
@property KBLabel *statusLabel;
@end

@implementation KBUserStatusView

- (void)viewInit {
  [super viewInit];
  self.wantsLayer = YES;
  self.layer.backgroundColor = NSColor.whiteColor.CGColor;

  _imageView = [[KBImageView alloc] init];
  _imageView.roundedRatio = 1.0;
  [self addSubview:_imageView];

  _nameLabel = [[KBLabel alloc] init];
  [self addSubview:_nameLabel];

  _statusLabel = [[KBLabel alloc] init];
  [self addSubview:_statusLabel];

  YOSelf yself = self;
  self.viewLayout = [YOLayout layoutWithLayoutBlock:^(id<YOLayout> layout, CGSize size) {
    CGFloat x = 10;
    CGFloat y = 10;
    CGFloat imageHeight = 40;

    x += [layout setFrame:CGRectMake(x, y, imageHeight, imageHeight) view:yself.imageView].size.width + 10;

    y += [layout sizeToFitVerticalInFrame:CGRectMake(x, y, size.width - x, 0) view:yself.nameLabel].size.height + 4;
    y += [layout sizeToFitVerticalInFrame:CGRectMake(x, y, size.width - x, 0) view:yself.statusLabel].size.height + 4;

    return CGSizeMake(size.width, 60);
  }];
}

- (void)setStatus:(KBRGetCurrentStatusRes *)status {
  KBRUser *user = status.user;

  [_nameLabel setText:user.username font:[NSFont boldSystemFontOfSize:16] color:KBAppearance.currentAppearance.textColor alignment:NSLeftTextAlignment lineBreakMode:NSLineBreakByTruncatingTail];

  [_statusLabel setText:@"Connected" font:[NSFont systemFontOfSize:14] color:KBAppearance.currentAppearance.okColor alignment:NSLeftTextAlignment lineBreakMode:NSLineBreakByTruncatingTail];

  if (user.image.url) {
    [self.imageView setURLString:user.image.url];
  } else {
    [self.imageView setURLString:@"https://keybase.io/images/no_photo.png"];
  }

  [self setNeedsLayout];
}

@end
