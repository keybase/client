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
  _name1Label.font = [NSFont systemFontOfSize:20];
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
    CGFloat x = 15;
    CGFloat y = 12;

    [layout setFrame:CGRectMake(x, y, 50, 50) view:yself.imageView];
    x += 50 + 15;

    y += [layout setFrame:CGRectMake(x, y, size.width - x - 5, 0) view:yself.name1Label sizeToFit:YES].size.height + 6;

    if (yself.locationLabel.attributedText.length > 0) {
      y += [layout setFrame:CGRectMake(x, y, size.width - x - 10, 0) view:yself.locationLabel sizeToFit:YES].size.height + 6;
    }

    if (yself.bioLabel.attributedText.length > 0) {
      y += [layout setFrame:CGRectMake(x, y, size.width - x - 10, 0) view:yself.bioLabel sizeToFit:YES].size.height + 6;
    }

    y += 6;

    if (y < 74) y = 74;

    return CGSizeMake(size.width, y);
  }];
}

- (void)setUser:(KBUser *)user {

  if (user.fullName) {
    _name1Label.text = user.fullName;
  } else {
    _name1Label.placeholder = @"Full Name";
  }

  _locationLabel.text = user.location;
  _bioLabel.text = user.bio;

  [_imageView setURLString:user.image.URLString ? user.image.URLString : @"https://keybase.io/images/no_photo.png"];

  [self setNeedsLayout];
}

@end

