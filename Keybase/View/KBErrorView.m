//
//  KBErrorView.m
//  Keybase
//
//  Created by Gabriel on 1/26/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBErrorView.h"
#import "KBAppKit.h"

@interface KBErrorView ()
@property KBLabel *titleLabel;
@property KBLabel *descriptionLabel;
@property KBScrollView *scrollView;
@property KBButton *button;
@end

@implementation KBErrorView

- (void)viewInit {
  [super viewInit];
  self.wantsLayer = YES;
  self.layer.backgroundColor = NSColor.whiteColor.CGColor;

//  KBImageView *imageView = [[KBImageView alloc] init];
//  [imageView setImageSource:@"General-Outline-Sad_Face-25"];
//  [self addSubview:imageView];

  KBLabel *headerLabel = [[KBLabel alloc] init];
  [headerLabel setText:@"Oops!" font:[NSFont boldSystemFontOfSize:32] color:NSColor.blackColor alignment:NSCenterTextAlignment];
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

  GHWeakSelf gself = self;
  _button = [KBButton buttonWithText:@"Quit" style:KBButtonStyleDefault];
  self.button.targetBlock = ^{
    [NSApplication.sharedApplication terminate:gself];
  };
  [self addSubview:_button];

  YOSelf yself = self;
  self.viewLayout = [YOLayout layoutWithLayoutBlock:^(id<YOLayout> layout, CGSize size) {
    CGFloat y = 20;

    //y += [layout setFrame:CGRectMake(20, 20, size.width, 50) view:imageView].size.height;

    y += [layout sizeToFitVerticalInFrame:CGRectMake(40, y, size.width - 80, 0) view:headerLabel].size.height + 10;
    y += [layout sizeToFitVerticalInFrame:CGRectMake(40, y, size.width - 80, 0) view:yself.titleLabel].size.height + 20;
    y += [layout sizeToFitVerticalInFrame:CGRectMake(40, y, size.width - 80, 150) view:yself.scrollView].size.height + 20;

    y += [layout sizeToFitVerticalInFrame:CGRectMake(size.width - 200, y, 160, 0) view:yself.button].size.height + 20;

    return CGSizeMake(size.width, y);
  }];
}

- (void)setError:(NSError *)error {
  [_titleLabel setText:@"There was a problem and we couldn't recover. This usually means there is something wrong with your Keybase installation. This information might help you resolve this issue:" font:[NSFont systemFontOfSize:14] color:[KBAppearance.currentAppearance textColor] alignment:NSLeftTextAlignment];
  [_descriptionLabel setText:error.localizedDescription font:[NSFont systemFontOfSize:14] color:[KBAppearance.currentAppearance textColor] alignment:NSLeftTextAlignment];
  [self setNeedsLayout];
}

- (void)openInWindow {
  if (self.window) {
    [self.window makeKeyAndOrderFront:nil];
    return;
  }

  [self removeFromSuperview];
  KBNavigationView *navigation = [[KBNavigationView alloc] initWithView:self];
  NSWindow *window = [KBWindow windowWithContentView:navigation size:CGSizeMake(500, 410) retain:YES];
  navigation.titleView = [KBNavigationTitleView titleViewWithTitle:@"Keybase" navigation:navigation];
  [window setLevel:NSFloatingWindowLevel];
  [window makeKeyAndOrderFront:nil];
}

@end
