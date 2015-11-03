//
//  KBFatalErrorView.m
//  Keybase
//
//  Created by Gabriel on 1/26/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBFatalErrorView.h"

@interface KBFatalErrorView ()
@property KBLabel *titleLabel;
@property KBLabel *descriptionLabel;
@property KBScrollView *scrollView;
@property KBButton *button;
@end

@implementation KBFatalErrorView

- (void)viewInit {
  [super viewInit];
  [self kb_setBackgroundColor:NSColor.whiteColor];

//  KBImageView *imageView = [[KBImageView alloc] init];
//  [imageView setImageSource:@"General-Outline-Sad_Face-25"];
//  [self addSubview:imageView];

  KBLabel *headerLabel = [[KBLabel alloc] init];
  [headerLabel setText:@"Oops!" font:[NSFont boldSystemFontOfSize:32] color:NSColor.blackColor alignment:NSCenterTextAlignment lineBreakMode:NSLineBreakByClipping];
  [self addSubview:headerLabel];

  _titleLabel = [[KBLabel alloc] init];
  [self addSubview:_titleLabel];

  _descriptionLabel = [[KBLabel alloc] init];
  _descriptionLabel.selectable = YES;
  [self addSubview:_descriptionLabel];

  _scrollView = [[KBScrollView alloc] init];
  [_scrollView setDocumentView:_descriptionLabel];
  _scrollView.scrollView.borderType = NSBezelBorder;
  [self addSubview:_scrollView];

//  GHWeakSelf gself = self;
//  _button = [KBButton buttonWithText:@"Quit" style:KBButtonStyleLink];
//  self.button.targetBlock = ^{
//    [NSApplication.sharedApplication terminate:gself];
//  };
//  [self addSubview:_button];

  YOSelf yself = self;
  self.viewLayout = [YOLayout layoutWithLayoutBlock:^(id<YOLayout> layout, CGSize size) {
    CGFloat y = 20;

    //y += [layout setFrame:CGRectMake(20, 20, size.width, 50) view:imageView].size.height;

    y += [layout sizeToFitVerticalInFrame:CGRectMake(40, y, size.width - 80, 0) view:headerLabel].size.height + 10;
    y += [layout sizeToFitVerticalInFrame:CGRectMake(40, y, size.width - 80, 0) view:yself.titleLabel].size.height + 20;
    y += [layout sizeToFitVerticalInFrame:CGRectMake(40, y, size.width - 80, size.height - y - 40) view:yself.scrollView].size.height;

    //y += [layout sizeToFitVerticalInFrame:CGRectMake(size.width - 200, y, 160, 0) view:yself.button].size.height + 20;

    return CGSizeMake(size.width, y);
  }];
}

- (void)setError:(NSError *)error {
  [_titleLabel setText:@"There was a problem and we couldn't recover. This usually means there is something wrong with your Keybase installation. This information might help you resolve this issue:" font:[NSFont systemFontOfSize:14] color:[KBAppearance.currentAppearance textColor] alignment:NSLeftTextAlignment lineBreakMode:NSLineBreakByWordWrapping];

  NSMutableArray *info = [NSMutableArray array];

  if (error.localizedDescription) [info addObject:error.localizedDescription];
  if (error.localizedFailureReason) [info addObject:error.localizedFailureReason];
  if (error.localizedRecoverySuggestion) [info addObject:error.localizedRecoverySuggestion];

  NSMutableDictionary *other = [error.userInfo mutableCopy];
  [other removeObjectForKey:NSLocalizedDescriptionKey];
  [other removeObjectForKey:NSLocalizedFailureReasonErrorKey];
  [other removeObjectForKey:NSLocalizedRecoverySuggestionErrorKey];
  [other removeObjectForKey:NSLocalizedRecoveryOptionsErrorKey]; // Don't need options in error description

  for (id key in other) {
    [info addObject:NSStringWithFormat(@"%@: %@", key, error.userInfo[key])];
  }

  [_descriptionLabel setText:[info join:@"\n\n"] font:[NSFont systemFontOfSize:14] color:[KBAppearance.currentAppearance textColor] alignment:NSLeftTextAlignment lineBreakMode:NSLineBreakByWordWrapping];
  [self setNeedsLayout];
}

@end
