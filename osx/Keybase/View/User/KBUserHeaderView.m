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
#import "KBUserImageView.h"

@interface KBUserHeaderView ()
@property KBLabel *name1Label;
@property KBButton *name2View;
@property KBLabel *locationLabel;
@property KBLabel *bioLabel;
@property KBUserImageView *imageView;

@property KBActivityIndicatorView *progressView;

@property (nonatomic) KBRUser *user;
@end


@implementation KBUserHeaderView

- (void)viewInit {
  [super viewInit];

  _progressView = [[KBActivityIndicatorView alloc] init];
  [self addSubview:_progressView];

  _imageView = [[KBUserImageView alloc] init];
  _imageView.hidden = YES;
  [self addSubview:_imageView];

  _name1Label = [[KBLabel alloc] init];
  [self addSubview:_name1Label];

  _name2View = [KBButton button];
  _name2View.hidden = YES;
  GHWeakSelf gself = self;
  _name2View.targetBlock = ^ {
    [AppDelegate.sharedDelegate openURLString:KBURLStringForUsername(gself.user.username) sender:gself];
  };
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

    y += 16;
    y += [layout sizeToFitVerticalInFrame:CGRectMake(x, y, size.width - x, 0) view:yself.name1Label].size.height + 4;

    y += [layout sizeToFitVerticalInFrame:CGRectMake(x, y, size.width - x, 30) view:yself.name2View].size.height;

    [layout setFrame:CGRectMake(12, 2, imageHeight + 16, imageHeight + 16) view:yself.progressView];

    return CGSizeMake(size.width, imageHeight + 30);
  }];
}

- (void)setProgressEnabled:(BOOL)progressEnabled {
  [_progressView setAnimating:progressEnabled];
}

- (void)setUser:(KBRUser *)user {
  _user = user;
  if (!user) {
    _name1Label.attributedText = nil;
    _imageView.hidden = YES;
    _imageView.URLString = nil;
    _name2View.hidden = YES;
    return;
  }

  _imageView.hidden = NO;
  [_name1Label setText:user.username font:[NSFont boldSystemFontOfSize:36] color:[KBAppearance.currentAppearance textColor] alignment:NSLeftTextAlignment];

  _name2View.hidden = NO;
  [_name2View setText:KBDisplayURLStringForUsername(user.username) style:KBButtonStyleLink font:[NSFont systemFontOfSize:16] alignment:NSLeftTextAlignment lineBreakMode:NSLineBreakByWordWrapping];

  //[_name2View setMarkup:NSStringWithFormat(@"keybase.io/%@", user.username) style:KBButtonStyleLink alignment:NSLeftTextAlignment];

  self.imageView.username = user.username;

  [self setNeedsLayout];
}

@end

