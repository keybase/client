//
//  KBTwitterView.m
//  Keybase
//
//  Created by Gabriel on 1/13/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBTwitterConnectView.h"

//#import <Accounts/Accounts.h>
//#import <Social/Social.h>
#import <Slash/Slash.h>

#import "AppDelegate.h"
#import "KBRPC.h"

@interface KBTwitterInputView : KBView
@property KBTextField *usernameField;
@property KBButton *button;
@property KBButton *skipButton;
@end

@interface KBTwitterProofView : KBView
@property KBTextLabel *instructionsLabel;
@property KBTextLabel *proofLabel;
@property KBButton *button;
@end

@interface KBTwitterConnectView ()
@property KBTextLabel *titleLabel;
@property KBTextLabel *infoLabel;
@property KBTwitterInputView *inputView;
@property KBTwitterProofView *proofView;

@property id sessionId;
@end

@implementation KBTwitterConnectView

- (void)viewInit {
  [super viewInit];
  GHWeakSelf gself = self;

  _infoLabel = [[KBTextLabel alloc] init];
  [_infoLabel setText:@"Do you want to connect your Twitter account? This will add a photo to your profile and will help people verify your identity." font:[KBLookAndFeel textFont] color:[KBLookAndFeel textColor] alignment:NSLeftTextAlignment];
  [self addSubview:_infoLabel];

  _inputView = [[KBTwitterInputView alloc] init];
  _inputView.button.targetBlock = ^{
    [gself generateProof];
  };
  [self addSubview:_inputView];

  _proofView = [[KBTwitterProofView alloc] init];
  _proofView.hidden = YES;
  [self addSubview:_proofView];

  [AppDelegate.client registerMethod:@"keybase.1.proveUi.outputInstructions" requestHandler:^(NSString *method, NSArray *params, MPRequestCompletion completion) {
    // TODO: Verify sessionId
    gself.sessionId = params[0][@"sessionId"];
    NSString *instructions = params[0][@"instructions"][@"data"];
    NSString *proofText = params[0][@"proof"];
    [self setInstructions:instructions proofText:proofText];

    gself.proofView.button.targetBlock = ^{
      completion(nil, @(YES));
    };
  }];

  [AppDelegate.client registerMethod:@"keybase.1.proveUi.promptOverwrite1" requestHandler:^(NSString *method, NSArray *params, MPRequestCompletion completion) {
    // TODO
    completion(nil, @(YES));
  }];

  [AppDelegate.client registerMethod:@"keybase.1.proveUi.okToCheck" requestHandler:^(NSString *method, NSArray *params, MPRequestCompletion completion) {
    // TODO
    completion(nil, @(YES));
  }];

  YOSelf yself = self;
  self.viewLayout = [YOLayout layoutWithLayoutBlock:^(id<YOLayout> layout, CGSize size) {
    CGFloat y = 40;

    y += [layout setFrame:CGRectMake(20, y, size.width - 40, 80) view:yself.titleLabel].size.height;

    y += [layout sizeToFitVerticalInFrame:CGRectMake(40, y, size.width - 80, 0) view:yself.infoLabel].size.height + 30;

    [layout setFrame:CGRectMake(0, y, size.width, 0) view:yself.proofView];

    y += [layout sizeToFitVerticalInFrame:CGRectMake(0, y, size.width, 0) view:yself.inputView].size.height;

    return CGSizeMake(size.width, y);
  }];
}

- (void)setInstructions:(NSString *)instructions proofText:(NSString *)proofText {
  NSDictionary *style = @{@"$default": @{NSFontAttributeName: [KBLookAndFeel textFont]},
                          @"p": @{NSFontAttributeName: [KBLookAndFeel textFont]},
                          @"strong": @{NSFontAttributeName: [KBLookAndFeel boldTextFont]},};
  NSMutableAttributedString *str = [[SLSMarkupParser attributedStringWithMarkup:instructions style:style error:nil] mutableCopy];
  [str addAttribute:NSForegroundColorAttributeName value:[NSColor blackColor] range:NSMakeRange(0, str.length)];

  self.proofView.instructionsLabel.attributedText = str;

  [self.proofView.proofLabel setText:proofText font:[KBLookAndFeel textFont] color:[KBLookAndFeel textColor] alignment:NSLeftTextAlignment];
  [self.proofView setNeedsLayout];
  [self.proofView sizeToFit];

  // TODO Animate change
  self.inputView.hidden = YES;
  self.proofView.hidden = NO;
}

- (void)generateProof {
  NSString *userName = [_inputView.usernameField.text gh_strip];

  if ([NSString gh_isBlank:userName]) {
    // TODO Become first responder
    [self setError:KBErrorAlert(@"You need to choose a username.")];
    return;
  }

  GHWeakSelf gself = self;
  [self setInProgress:YES sender:_inputView];
  KBRProve *prove = [[KBRProve alloc] initWithClient:AppDelegate.client];
  [prove proveWithService:@"twitter" username:userName force:NO completion:^(NSError *error) {
    [self setInProgress:NO sender:gself.inputView];
    if (error) {
      [gself setError:error];
      return;
    }

    [AppDelegate.sharedDelegate.windowController showUser:AppDelegate.sharedDelegate.status.user animated:YES];
  }];
}

@end


@implementation KBTwitterInputView

- (void)viewInit {
  [super viewInit];
  _usernameField = [[KBTextField alloc] init];
  _usernameField.placeholder = @"@username";
  [self addSubview:_usernameField];

  _button = [[KBButton alloc] init];
  _button.text = @"Connect";
  [self addSubview:_button];

  _skipButton = [KBButton buttonAsLinkWithText:@"No Thanks"];
  _skipButton.targetBlock = ^{
  };
  [self addSubview:_skipButton];

  YOSelf yself = self;
  self.viewLayout = [YOLayout layoutWithLayoutBlock:^(id<YOLayout> layout, CGSize size) {
    CGFloat y = 0;

    y += [layout sizeToFitVerticalInFrame:CGRectMake(40, y, size.width - 80, 0) view:yself.usernameField].size.height + 20;

    y += [layout setFrame:CGRectMake(40, y, size.width - 80, 56) view:yself.button].size.height + 20;

    y += [layout setFrame:CGRectMake(40, y, 80, 30) view:yself.skipButton].size.height;

    return CGSizeMake(size.width, y);
  }];
}

@end

@implementation KBTwitterProofView

- (void)viewInit {
  [super viewInit];
  _instructionsLabel = [[KBTextLabel alloc] init];
  [self addSubview:_instructionsLabel];

  _proofLabel = [[KBTextLabel alloc] init];
  // TODO Make selectable
  //_proofLabel.selectable = YES;
  [self addSubview:_proofLabel];

  _button = [KBButton buttonWithText:@"OK, I posted it."];
  [self addSubview:_button];

  YOSelf yself = self;
  self.viewLayout = [YOLayout layoutWithLayoutBlock:^(id<YOLayout> layout, CGSize size) {
    CGFloat y = 0;

    y += [layout sizeToFitVerticalInFrame:CGRectMake(40, y, size.width - 80, 0) view:yself.instructionsLabel].size.height + 20;
    y += [layout sizeToFitVerticalInFrame:CGRectMake(40, y, size.width - 80, 0) view:yself.proofLabel].size.height + 20;

    y += [layout setFrame:CGRectMake(40, y, size.width - 80, 56) view:yself.button].size.height;

    return CGSizeMake(size.width, y);
  }];
}

@end