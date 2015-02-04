//
//  KBUserHeaderView.m
//  Keybase
//
//  Created by Gabriel on 1/9/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBUserHeaderView.h"

#import "KBActivityIndicatorView.h"

@interface KBUserHeaderView ()
@property KBLabel *name1Label;
@property KBLabel *name2Label;
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
  [self addSubview:_imageView];

  _name1Label = [[KBLabel alloc] init];
  _name1Label.verticalAlignment = KBTextAlignmentMiddle;
  [self addSubview:_name1Label];

  _name2Label = [[KBLabel alloc] init];
  [self addSubview:_name2Label];

  _locationLabel = [[KBLabel alloc] init];
  [self addSubview:_locationLabel];

  _bioLabel = [[KBLabel alloc] init];
  [self addSubview:_bioLabel];

  YOSelf yself = self;
  self.viewLayout = [YOLayout layoutWithLayoutBlock:^(id<YOLayout> layout, CGSize size) {

    CGFloat x = 20;
    CGFloat y = 10;
    CGFloat imageWidth = 100;

    x += [layout setFrame:CGRectMake(20, y, imageWidth, imageWidth) view:yself.imageView].size.width + 10;

    CGRect name1Rect = [layout setFrame:CGRectMake(x, y, size.width - x, imageWidth) view:yself.name1Label options:YOLayoutOptionsSizeToFitHorizontal];

    [layout setFrame:CGRectMake(12, y - 8, imageWidth + 16, imageWidth + 16) view:yself.progressView];

    return CGSizeMake(x + name1Rect.size.width, imageWidth + 30);
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

- (void)setUserInfo:(KBUser *)user {
//  [_name2Label setText:user.fullName font:[NSFont systemFontOfSize:16] color:[KBLookAndFeel secondaryTextColor] alignment:NSCenterTextAlignment];
//
//  [_locationLabel setText:user.location font:[NSFont systemFontOfSize:16] color:[KBLookAndFeel secondaryTextColor] alignment:NSCenterTextAlignment];
//  [_bioLabel setText:user.bio font:[NSFont systemFontOfSize:15] color:[KBLookAndFeel secondaryTextColor] alignment:NSCenterTextAlignment];

  [_imageView setURLString:user.image.URLString ? user.image.URLString : @"https://keybase.io/images/no_photo.png"];
  [self setNeedsLayout];
}

- (void)setUser:(KBRUser *)user {
  [_name1Label setMarkup:NSStringWithFormat(@"<p>keybase.io/<strong>%@</strong></p>", user.username) font:[NSFont systemFontOfSize:36] color:[KBLookAndFeel textColor] alignment:NSCenterTextAlignment lineBreakMode:NSLineBreakByWordWrapping];

  [self setNeedsLayout];
}

@end

