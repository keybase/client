//
//  KBUserHeaderView.m
//  Keybase
//
//  Created by Gabriel on 1/9/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBUserHeaderView.h"

#import "KBUser.h"

@interface KBUserHeaderView ()
@property KBTextLabel *name1Label;
@property KBTextLabel *locationLabel;
@property KBTextLabel *bioLabel;
@property KBImageView *imageView;
@end


@implementation KBUserHeaderView

- (void)viewInit {
  [super viewInit];

  _imageView = [[KBImageView alloc] init];
  [self addSubview:_imageView];

  _name1Label = [[KBTextLabel alloc] init];
  _name1Label.font = [NSFont systemFontOfSize:24];
  [self addSubview:_name1Label];

  _locationLabel = [[KBTextLabel alloc] init];
  _locationLabel.font = [NSFont systemFontOfSize:16];
  [self addSubview:_locationLabel];

  _bioLabel = [[KBTextLabel alloc] init];
  _bioLabel.font = [NSFont systemFontOfSize:14];
  _bioLabel.textColor = [NSColor colorWithWhite:145.0/255.0 alpha:1.0];
  [self addSubview:_bioLabel];

  YOSelf yself = self;
  self.viewLayout = [YOLayout layoutWithLayoutBlock:^(id<YOLayout> layout, CGSize size) {
    CGFloat x = 0;
    CGFloat y = 20;

    y += [layout setFrame:CGRectMake(size.width/2.0 - 80, y, 160, 160) view:yself.imageView].size.height + 20;

    y += [layout sizeToFitVerticalInFrame:CGRectMake(x, y, size.width - x - 5, 0) view:yself.name1Label].size.height + 6;

    if (yself.locationLabel.attributedText.length > 0) {
      y += [layout sizeToFitVerticalInFrame:CGRectMake(x, y, size.width - x - 10, 0) view:yself.locationLabel].size.height + 6;
    }

    if (yself.bioLabel.attributedText.length > 0) {
      y += [layout sizeToFitVerticalInFrame:CGRectMake(x, y, size.width - x - 10, 0) view:yself.bioLabel].size.height + 6;
    }

    y += 6;

    if (y < 74) y = 74;

    return CGSizeMake(size.width, y);
  }];
}

- (void)setUser:(KBUser *)user {

  [_name1Label setText:user.userName textAlignment:NSCenterTextAlignment];

  _locationLabel.text = user.location;
  _bioLabel.text = user.bio;

  [_imageView setURLString:user.image.URLString ? user.image.URLString : @"https://keybase.io/images/no_photo.png"];

  [self setNeedsLayout];
}

@end

