//
//  KBProveInstructionsView.m
//  Keybase
//
//  Created by Gabriel on 2/9/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBProveInstructionsView.h"

#import "AppDelegate.h"

@implementation KBProveInstructionsView

- (void)viewInit {
  [super viewInit];
  self.wantsLayer = YES;
  self.layer.backgroundColor = NSColor.whiteColor.CGColor;

  _instructionsLabel = [[KBLabel alloc] init];
  [self addSubview:_instructionsLabel];

  _proofLabel = [[KBLabel alloc] init];
  _proofLabel.selectable = YES;

  _scrollView = [[NSScrollView alloc] init];
  _scrollView.hasVerticalScroller = YES;
  _scrollView.autohidesScrollers = YES;
  [_scrollView setAutoresizingMask:NSViewWidthSizable|NSViewHeightSizable];
  [_scrollView setDocumentView:_proofLabel];
  _scrollView.borderType = NSBezelBorder;
  [self addSubview:_scrollView];

  GHWeakSelf gself = self;
  _clipboardCopyButton = [KBButton buttonWithText:@"Copy to clipboard" style:KBButtonStyleLink];
  _clipboardCopyButton.targetBlock = ^{
    [NSPasteboard.generalPasteboard clearContents];
    BOOL pasted = [NSPasteboard.generalPasteboard writeObjects:@[gself.proofText]];
    GHDebug(@"Pasted? %@", @(pasted));
  };
  [self addSubview:_clipboardCopyButton];

  _button = [KBButton buttonWithText:@"OK, I posted it." style:KBButtonStylePrimary];
  [self addSubview:_button];

  _cancelButton = [KBButton buttonWithText:@"Cancel" style:KBButtonStyleLink];
  [self addSubview:_cancelButton];

  YOSelf yself = self;
  self.viewLayout = [YOLayout layoutWithLayoutBlock:^(id<YOLayout> layout, CGSize size) {
    CGFloat y = 10;

    y += [layout sizeToFitVerticalInFrame:CGRectMake(40, y, size.width - 80, 0) view:yself.instructionsLabel].size.height + 10;

    [layout sizeToFitVerticalInFrame:CGRectMake(0, 0, size.width - 80, CGFLOAT_MAX) view:yself.proofLabel];
    y += [layout setFrame:CGRectMake(40, y, size.width - 80, size.height - y - 190) view:yself.scrollView].size.height + 10;

    y += [layout centerWithSize:CGSizeMake(200, 0) frame:CGRectMake(40, y, size.width - 80, 0) view:yself.clipboardCopyButton].size.height + 20;

    y += [layout centerWithSize:CGSizeMake(200, 0) frame:CGRectMake(40, y, size.width - 80, 0) view:yself.button].size.height + 20;

    y += [layout centerWithSize:CGSizeMake(200, 0) frame:CGRectMake(40, y, size.width - 80, 0) view:yself.cancelButton].size.height;

    return CGSizeMake(size.width, y);
  }];
}

- (void)setInstructions:(KBRText *)instructions proofText:(NSString *)proofText {
  // TODO Check instructions.markup
  self.instructionsLabel.attributedText = [KBLabel parseMarkup:instructions.data font:[KBLookAndFeel textFont] color:[KBLookAndFeel textColor]];

  _proofText = proofText;
  [self.proofLabel setText:proofText font:[KBLookAndFeel textFont] color:[KBLookAndFeel textColor] alignment:NSLeftTextAlignment];
  [self layoutView];
}

@end
