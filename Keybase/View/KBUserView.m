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
  self.nameLabel.textColor = [KBLookAndFeel textColor];
  self.nameLabel.font = [NSFont boldSystemFontOfSize:16];
  [self addSubview:self.nameLabel];

  self.descriptionLabel = [[KBTextLabel alloc] init];
  self.descriptionLabel.textColor = [KBLookAndFeel secondaryTextColor];
  self.descriptionLabel.font = [KBLookAndFeel textFont];
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
  self.nameLabel.text = user.userName;
  self.descriptionLabel.text = user.bio;
  self.imageView.URLString = user.image.URLString;
  [self setNeedsLayout];
}

@end
