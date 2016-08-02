//
//  KBInstallStatusView.m
//  KBKit
//
//  Created by Gabriel on 1/6/16.
//  Copyright © 2016 Gabriel Handford. All rights reserved.
//

#import "KBInstallStatusView.h"

#import "KBHeaderLabelView.h"
#import "KBInstaller.h"

#import <YOLayout/YOVBorderLayout.h>

@interface KBInstallStatusView () <NSSharingServicePickerDelegate>
@property KBLabel *header;
@property KBLabel *infoLabel;
@property KBTextView *textView;
@property YOHBox *debugOptionsView;
@property YOHBox *buttonViews;
@property YOHBox *skipButtons;
@end

@implementation KBInstallStatusView

- (void)viewInit {
  [super viewInit];
  [self kb_setBackgroundColor:KBAppearance.currentAppearance.secondaryBackgroundColor];
  YOVBox *topView = [YOVBox box];
  {
    YOVBox *headerView = [YOVBox box:@{@"spacing": @(20), @"insets": @"0,0,20,0"}];
    {
      _header = [[KBLabel alloc] init];
      [headerView addSubview:_header];

      _infoLabel = [[KBLabel alloc] init];
      [headerView addSubview:_infoLabel];
    }
    [topView addSubview:headerView];
    [topView addSubview:[KBBox horizontalLine]];
  }
  [self addSubview:topView];

  _textView = [[KBTextView alloc] init];
  _textView.editable = NO;
  _textView.view.textContainerInset = CGSizeMake(5, 5);
  [self addSubview:_textView];

  YOVBox *bottomView = [YOVBox box];
  {
    [bottomView addSubview:[KBBox horizontalLine]];
    YOVBox *footerView = [YOVBox box:@{@"spacing": @(20), @"insets": @"20,0,0,0"}];
    {
  //    _debugOptionsView = [YOHBox box:@{@"horizontalAlignment": @"center", @"spacing": @(10)}];
  //    [_debugOptionsView addSubview:[KBButton buttonWithText:@"Open Control Panel" style:KBButtonStyleLink options:0 targetBlock:^{ self.onSelect(KBInstallStatusSelectControlPanel); }]];
  //    [bottomView addSubview:_debugOptionsView];

      _buttonViews = [YOHBox box:@{@"horizontalAlignment": @"center", @"spacing": @(10)}];    
      [footerView addSubview:_buttonViews];
    }
    [bottomView addSubview:footerView];
  }
  [self addSubview:bottomView];

  self.viewLayout = [YOVBorderLayout layoutWithCenter:_textView top:@[topView] bottom:@[bottomView] insets:UIEdgeInsetsMake(20, 0, 20, 0) spacing:0];
}

- (void)viewDidAppear:(BOOL)animated { }

- (void)setTitle:(NSString *)title headerText:(NSString *)headerText {
  [_header setText:title style:KBTextStyleHeaderLarge alignment:NSCenterTextAlignment lineBreakMode:NSLineBreakByTruncatingTail];
  [_infoLabel setText:headerText style:KBTextStyleDefault alignment:NSCenterTextAlignment lineBreakMode:NSLineBreakByWordWrapping];
}

- (void)setButtons:(NSArray *)buttons {
  NSArray *views = [_buttonViews.subviews copy];
  for (NSView *subview in views) [subview removeFromSuperview];

  for (NSView *view in buttons) {
    [_buttonViews addSubview:view];
  }
  [self setNeedsLayout];
}

- (void)setEnvironment:(KBEnvironment *)environment {
  _environment = environment;
  [self refreshInstallables];
}

- (void)setDebugOptionsViewEnabled:(BOOL)debugOptionsViewEnabled {
  _debugOptionsView.hidden = !debugOptionsViewEnabled;
  [self setNeedsLayout];
}

- (void)refreshInstallables {
  NSMutableString *info = [NSMutableString stringWithString:[_environment debugInstallables]];

  if (_log) {
    [info appendString:@"Log:\n"];
    [info appendString:[_log messages]];
  }

  [_textView setText:info style:KBTextStyleDefault options:KBTextOptionsMonospace alignment:NSLeftTextAlignment lineBreakMode:NSLineBreakByCharWrapping];
  [self setNeedsLayout];
}

- (void)clear {
  _textView.attributedText = nil;
}

- (void)refresh {
  NSAssert(self.environment, @"No environment");
  [KBActivity setProgressEnabled:YES sender:self];
  [_log clear];
  [self clear];
  KBInstaller *installer = [[KBInstaller alloc] init];
  [installer refreshStatusWithEnvironment:self.environment completion:^() {
    [KBActivity setProgressEnabled:NO sender:self];
    [self refreshInstallables];
  }];
}

- (void)install {
  NSAssert(self.environment, @"No environment");
  [KBActivity setProgressEnabled:YES sender:self];
  [_log clear];
  [self clear];
  KBInstaller *installer = [[KBInstaller alloc] init];
  [installer installWithEnvironment:self.environment force:NO stopOnError:NO completion:^(NSError *error, NSArray *installables) {
    [KBActivity setProgressEnabled:NO sender:self];
    [self refreshInstallables];
  }];
}

- (void)share:(id)sender completion:(dispatch_block_t)completion {
  NSMutableArray *items = [NSMutableArray array];
  [items addObject:_textView.text];

  NSSharingServicePicker *sharingServicePicker = [[NSSharingServicePicker alloc] initWithItems:items];
  sharingServicePicker.delegate = self;
  [sharingServicePicker showRelativeToRect:[sender bounds] ofView:sender preferredEdge:NSMinYEdge];
  completion();
}

@end

