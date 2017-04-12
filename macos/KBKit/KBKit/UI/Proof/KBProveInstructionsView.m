//
//  KBProveInstructionsView.m
//  Keybase
//
//  Created by Gabriel on 2/9/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBProveInstructionsView.h"

#import "KBDefines.h"
#import "KBWorkspace.h"
#import <GHKit/GHKit.h>

@interface KBProveInstructionsView ()
@property KBLabel *instructionsLabel;
@property KBButton *linkButton;
@property KBTextView *proofView;
@property KBButton *clipboardCopyButton;
@property NSString *proofText;
@property NSString *serviceName;
@end

@implementation KBProveInstructionsView

- (void)viewInit {
  [super viewInit];
  [self kb_setBackgroundColor:KBAppearance.currentAppearance.backgroundColor];

  YOVBox *topView = [YOVBox box];
  {
    YOVBox *instructionsView = [YOVBox box:@{@"spacing": @(10), @"insets": @(20)}];
    instructionsView.ignoreLayoutForHidden = YES;
    {
      _instructionsLabel = [[KBLabel alloc] init];
      [instructionsView addSubview:_instructionsLabel];
      _linkButton = [KBButton button];
      _linkButton.hidden = YES;
      [instructionsView addSubview:_linkButton];
    }
    [topView addSubview:instructionsView];
    [topView addSubview:[KBBox horizontalLine]];
  }
  [self addSubview:topView];

  _proofView = [[KBTextView alloc] init];
  _proofView.view.editable = NO;
  _proofView.view.textContainerInset = CGSizeMake(10, 10);
  [self addSubview:_proofView];

  YOVBox *bottomView = [YOVBox box];
  [bottomView kb_setBackgroundColor:KBAppearance.currentAppearance.secondaryBackgroundColor];
  {
    [bottomView addSubview:[KBBox horizontalLine]];
    YOHBox *buttons = [YOHBox box:@{@"spacing": @(10), @"insets": @(20)}];
    {
      GHWeakSelf gself = self;
      _clipboardCopyButton = [KBButton buttonWithText:@"Copy to Clipboard" style:KBButtonStyleDefault options:KBButtonOptionsToolbar];
      _clipboardCopyButton.targetBlock = ^{ [gself copyToClipboard]; };
      [buttons addSubview:_clipboardCopyButton];

      YOHBox *rightButtons = [YOHBox box:@{@"spacing": @(10), @"horizontalAlignment": @"right", @"minSize": @"90,0"}];
      {
        _button = [KBButton buttonWithText:@"OK, I posted it." style:KBButtonStylePrimary options:KBButtonOptionsToolbar];
        [rightButtons addSubview:_button];

        _cancelButton = [KBButton buttonWithText:@"Close" style:KBButtonStyleDefault options:KBButtonOptionsToolbar];
        [rightButtons addSubview:_cancelButton];
      }
      [buttons addSubview:rightButtons];
    }
    [bottomView addSubview:buttons];
  }
  [self addSubview:bottomView];

  self.viewLayout = [YOVBorderLayout layoutWithCenter:_proofView top:@[topView] bottom:@[bottomView]];
}

- (void)copyToClipboard {
  [NSPasteboard.generalPasteboard clearContents];
  if (self.proofText) {
    [NSPasteboard.generalPasteboard writeObjects:@[self.proofText]];
  }
}

- (void)viewDidAppear:(BOOL)animated {
  self.navigation.titleView.title = NSStringWithFormat(@"Connect to %@", KBNameForServiceName(_serviceName));
}

- (void)setProofText:(NSString *)proofText serviceName:(NSString *)serviceName {
  _proofText = proofText;
  _serviceName = serviceName;
  NSString *name = KBNameForServiceName(serviceName);

  NSString *instructionsText;
  if ([serviceName isEqualToString:@"github"]) {
    instructionsText = @"Please login to GitHub and save a <strong>public gist</strong> called <code>keybase.md</code>:";
  } else if (name) {
    instructionsText = NSStringWithFormat(@"Post the following to %@:", name);
  } else {
    instructionsText = @"Post the following:";
  }

  [self.instructionsLabel setMarkup:instructionsText];

  GHWeakSelf gself = self;
  NSString *linkLabel = nil;
  if ([serviceName isEqualToString:@"twitter"]) linkLabel = @"Open Twitter";
  else if ([serviceName isEqualToString:@"github"]) linkLabel = @"Open Github";
  else if ([serviceName isEqualToString:@"rooter"]) linkLabel = @"Open Rooter";
  if (linkLabel) {
    _linkButton.hidden = NO;
    [_linkButton setText:linkLabel style:KBButtonStyleLink alignment:NSLeftTextAlignment lineBreakMode:NSLineBreakByCharWrapping];
    _linkButton.targetBlock = ^{ [gself open:serviceName proofText:proofText]; };
  } else {
    _linkButton.hidden = YES;
  }

  [self.proofView setText:_proofText style:KBTextStyleDefault options:KBTextOptionsMonospace alignment:NSLeftTextAlignment lineBreakMode:NSLineBreakByCharWrapping];
  [self setNeedsLayout];
}

- (void)open:(NSString *)serviceName proofText:(NSString *)proofText {
  NSString *URLString = nil;
  if ([serviceName isEqualToString:@"twitter"]) {
    URLString = NSStringWithFormat(@"https://twitter.com/intent/tweet?text=%@", [NSURL gh_encodeComponent:proofText]);
  } else if ([serviceName isEqualToString:@"github"]) {
    URLString = @"https://gist.github.com";
  } else if ([serviceName isEqualToString:@"rooter"]) {
    URLString = NSStringWithFormat(@"http://localhost:3000/_/api/1.0/rooter.json?post=%@", [NSURL gh_encodeComponent:proofText]);
  }
  if (URLString) {
    [KBWorkspace openURLString:URLString prompt:NO sender:self];
  }
//  KBWebView *webView = [[KBWebView alloc] init];
//  [webView openURLString:URLString];
//  [self openInWindow:webView];
}

- (void)openInWindow:(YOView *)view {
  [[self window] kb_addChildWindowForView:view rect:CGRectMake(0, 0, 600, 400) position:KBWindowPositionCenter title:@"Twitter" fixed:NO makeKey:YES];
}

@end
