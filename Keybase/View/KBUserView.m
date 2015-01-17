//
//  KBUserView.m
//  Keybase
//
//  Created by Gabriel on 1/7/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBUserView.h"
#import "KBDefines.h"
#import "KBUIDefines.h"

@interface KBUserView ()
@property KBImageView *imageView;
@property KBTextLabel *nameLabel;
@property KBTextLabel *descriptionLabel;
@end

@implementation KBUserView

- (void)viewInit {
  [super viewInit];

  self.imageView = [[KBImageView alloc] init];
  [self addSubview:self.imageView];

  self.nameLabel = [[KBTextLabel alloc] init];
  [self addSubview:self.nameLabel];

  self.descriptionLabel = [[KBTextLabel alloc] init];
  [self addSubview:self.descriptionLabel];

  YOSelf yself = self;
  self.viewLayout = [YOLayout layoutWithLayoutBlock:^(id<YOLayout> layout, CGSize size) {
    CGFloat x = 10;
    CGFloat y = 10;

    [layout setFrame:CGRectMake(x, y, 40, 40) view:yself.imageView];
    x += 50;

    y += [layout sizeToFitVerticalInFrame:CGRectMake(x, y - 2, size.width - x, 30) view:yself.nameLabel].size.height;
    y += [layout sizeToFitVerticalInFrame:CGRectMake(x, y, size.width - x, 30) view:yself.descriptionLabel].size.height + 10;

    if (y < 60) y = 60;

    return CGSizeMake(size.width, y);
  }];
}

- (void)setUser:(KBUser *)user {
  [self.nameLabel setText:user.userName font:[NSFont boldSystemFontOfSize:16] color:[KBLookAndFeel textColor] alignment:NSLeftTextAlignment];
  [self.descriptionLabel setText:user.bio font:[KBLookAndFeel textFont] color:[KBLookAndFeel secondaryTextColor] alignment:NSLeftTextAlignment];
  self.imageView.URLString = user.image.URLString;
  [self setNeedsLayout];
}

@end
