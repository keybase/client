//
//  KBUserStatusView.m
//  Keybase
//
//  Created by Gabriel on 3/3/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBUserStatusView.h"
#import "KBUserImageView.h"

@interface KBUserStatusView ()
@property KBUserImageView *imageView;
@property KBLabel *nameLabel;
@property KBLabel *statusLabel;
@end

@implementation KBUserStatusView

- (void)viewInit {
  [super viewInit];
  [self kb_setBackgroundColor:NSColor.clearColor];

  _imageView = [[KBUserImageView alloc] init];
  [self addSubview:_imageView];

  _nameLabel = [[KBLabel alloc] init];
  [_nameLabel kb_setBackgroundColor:NSColor.clearColor];
  [self addSubview:_nameLabel];

  _statusLabel = [[KBLabel alloc] init];
  [self addSubview:_statusLabel];

  YOSelf yself = self;
  self.viewLayout = [YOLayout layoutWithLayoutBlock:^(id<YOLayout> layout, CGSize size) {
    CGFloat x = 10;
    CGFloat y = 10;
    CGFloat imageHeight = 40;

    x += [layout setFrame:CGRectMake(x, y, imageHeight, imageHeight) view:yself.imageView].size.width + 10;

    y += [layout sizeToFitVerticalInFrame:CGRectMake(x, y, size.width - x, 0) view:yself.nameLabel].size.height;
    y += [layout sizeToFitVerticalInFrame:CGRectMake(x, y, size.width - x, 0) view:yself.statusLabel].size.height + 4;

    return CGSizeMake(size.width, 60);
  }];
}

- (void)setStatus:(KBRGetCurrentStatusRes *)status {
  _status = status;
  KBRUser *user = status.user;

  [_nameLabel setText:user.username font:KBAppearance.currentAppearance.boldLargeTextFont color:KBAppearance.currentAppearance.textColor alignment:NSLeftTextAlignment lineBreakMode:NSLineBreakByTruncatingTail];

  self.imageView.username = user.username;

  [self setNeedsLayout];
}

- (void)setConnected:(BOOL)connected {
  if (connected) {
    [_statusLabel setText:@"Connected" font:KBAppearance.currentAppearance.textFont color:KBAppearance.currentAppearance.secondaryTextColor alignment:NSLeftTextAlignment lineBreakMode:NSLineBreakByTruncatingTail];
  } else {
    [_statusLabel setText:@"Disconnected" font:KBAppearance.currentAppearance.textFont color:KBAppearance.currentAppearance.dangerColor alignment:NSLeftTextAlignment lineBreakMode:NSLineBreakByTruncatingTail];
  }
  [self setNeedsLayout];
}

@end
