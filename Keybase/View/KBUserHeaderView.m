//
//  KBUserHeaderView.m
//  Keybase
//
//  Created by Gabriel on 1/9/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBUserHeaderView.h"

#import "KBActivityIndicatorView.h"
#import "AppDelegate.h"

@interface KBUserHeaderView ()
@property KBLabel *name1Label;
@property KBButton *name2View;
@property KBLabel *locationLabel;
@property KBLabel *bioLabel;
@property KBImageView *imageView;

@property KBActivityIndicatorView *progressView;
@end


@implementation KBUserHeaderView

- (void)viewInit {
  [super viewInit];

  _progressView = [[KBActivityIndicatorView alloc] init];
  [self addSubview:_progressView];

  _imageView = [[KBImageView alloc] init];
  _imageView.roundedRatio = 1.0;
  _imageView.hidden = YES;
  [self addSubview:_imageView];

  _name1Label = [[KBLabel alloc] init];
  _name1Label.verticalAlignment = KBVerticalAlignmentMiddle;
  [self addSubview:_name1Label];

  _name2View = [KBButton button];
  [self addSubview:_name2View];

  _locationLabel = [[KBLabel alloc] init];
  [self addSubview:_locationLabel];

  _bioLabel = [[KBLabel alloc] init];
  [self addSubview:_bioLabel];

  YOSelf yself = self;
  self.viewLayout = [YOLayout layoutWithLayoutBlock:^(id<YOLayout> layout, CGSize size) {

    CGFloat x = 20;
    CGFloat y = 10;
    CGFloat imageHeight = 100;

    x += [layout setFrame:CGRectMake(20, y, imageHeight, imageHeight) view:yself.imageView].size.width + 20;

    y += 20;
    y += [layout setFrame:CGRectMake(x, y, size.width - x, 30) view:yself.name1Label].size.height + 4;

    y += [layout setFrame:CGRectMake(x, y, size.width - x, 30) view:yself.name2View].size.height;

    [layout setFrame:CGRectMake(12, y - 8, imageHeight + 16, imageHeight + 16) view:yself.progressView];

    return CGSizeMake(size.width, imageHeight + 30);
  }];

//  YOSelf yself = self;
//  self.viewLayout = [YOLayout layoutWithLayoutBlock:^(id<YOLayout> layout, CGSize size) {
//    CGFloat y = 20;
//
//    y += [layout setFrame:CGRectMake(size.width/2.0 - 80, y, 160, 160) view:yself.imageView].size.height + 10;
//    y += [layout sizeToFitVerticalInFrame:CGRectMake(20, y, size.width - 40, 0) view:yself.name1Label].size.height + 10;
//
//    if ([yself.name2Label hasText]) {
//      y += [layout sizeToFitVerticalInFrame:CGRectMake(20, y, size.width - 40, 0) view:yself.name2Label].size.height + 10;
//    }
//
//    if ([yself.locationLabel hasText]) {
//      y += [layout sizeToFitVerticalInFrame:CGRectMake(20, y, size.width - 40, 0) view:yself.locationLabel].size.height + 10;
//    }
//
//    if ([yself.bioLabel hasText]) {
//      //[layout centerWithSize:CGSizeMake(200, 0) frame:CGRectMake(20, y, size.width - 40, 0) view:yself.bioLabel].size.height + 10;
//      y += [layout sizeToFitVerticalInFrame:CGRectMake(80, y, size.width - 160, 0) view:yself.bioLabel].size.height + 10;
//    }
//
//    y += 10;
//
//    return CGSizeMake(size.width, y);
//  }];
}

- (void)setProgressEnabled:(BOOL)progressEnabled {
  [_progressView setAnimating:progressEnabled];
}

- (void)setUser:(KBRUser *)user {
  if (!user) {
    _name1Label.attributedText = nil;
    _imageView.hidden = YES;
    _imageView.URLString = nil;
    return;
  }

  _imageView.hidden = NO;
  [_name1Label setText:user.username font:[NSFont boldSystemFontOfSize:36] color:[KBLookAndFeel textColor] alignment:NSLeftTextAlignment];

  [_name2View setText:NSStringWithFormat(@"keybase.io/%@", user.username) style:KBButtonStyleLink font:[NSFont systemFontOfSize:16] alignment:NSLeftTextAlignment lineBreakMode:NSLineBreakByWordWrapping];

  //[_name2View setMarkup:NSStringWithFormat(@"keybase.io/%@", user.username) style:KBButtonStyleLink alignment:NSLeftTextAlignment];

  if (user.image.url) {

  } else {
    GHWeakSelf gself = self;
    [AppDelegate.APIClient userForKey:@"usernames" value:user.username fields:@"pictures" success:^(KBUser *user) {
      [gself.imageView setURLString:user.image.URLString];
    } failure:^(NSError *error) {
      [gself.imageView setURLString:@"https://keybase.io/images/no_photo.png"];
    }];
  }

  [self setNeedsLayout];
}

@end

