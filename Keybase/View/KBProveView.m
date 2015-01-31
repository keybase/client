//
//  KBTwitterView.m
//  Keybase
//
//  Created by Gabriel on 1/13/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBProveView.h"

//#import <Accounts/Accounts.h>
//#import <Social/Social.h>
#import <Slash/Slash.h>

#import "AppDelegate.h"

@implementation KBProveView

- (void)viewInit {
  [super viewInit];
  GHWeakSelf gself = self;

  _inputView = [[KBProveInputView alloc] init];
  _inputView.button.targetBlock = ^{
    [gself generateProof];
  };
  [self addSubview:_inputView];

  _instructionsView = [[KBProveInstructionsView alloc] init];
  _instructionsView.hidden = YES;
  [self addSubview:_instructionsView];

  [AppDelegate.client registerMethod:@"keybase.1.proveUi.promptUsername" requestHandler:^(NSString *method, NSArray *params, MPRequestCompletion completion) {
    //NSString *prompt = params[0][@"prompt"];
    completion(nil, gself.inputView.inputField.text);
  }];

  [AppDelegate.client registerMethod:@"keybase.1.proveUi.okToCheck" requestHandler:^(NSString *method, NSArray *params, MPRequestCompletion completion) {
    /*
    NSInteger attempt = [params[0][@"attempt"] integerValue];
    NSString *name = params[0][@"name"];
    NSString *prompt = NSStringWithFormat(@"Check %@%@?", name, attempt > 0 ? @" again" : @"");

    [KBAlert promptWithTitle:name description:prompt style:NSInformationalAlertStyle buttonTitles:@[@"OK", @"Cancel"] view:self completion:^(NSModalResponse response) {
      completion(nil, @(response == NSAlertFirstButtonReturn));
    }];
     */
    completion(nil, @(YES));
  }];

  [AppDelegate.client registerMethod:@"keybase.1.proveUi.promptOverwrite" requestHandler:^(NSString *method, NSArray *params, MPRequestCompletion completion) {

    NSString *account = params[0][@"account"];
    KBRPromptOverwriteType type = [params[0][@"typ"] integerValue];

    NSString *prompt;
    switch (type) {
      case KBRPromptOverwriteTypeSocial:
        prompt = NSStringWithFormat(@"You already have a proof for %@.", account);
        break;
      case KBRPromptOverwriteTypeSite:
        prompt = NSStringWithFormat(@"You already have claimed ownership of %@.", account);
        break;
    }

    [KBAlert promptWithTitle:@"Overwrite?" description:prompt style:NSWarningAlertStyle buttonTitles:@[NSStringWithFormat(@"Yes, Overwrite %@", account), @"Cancel"] view:self completion:^(NSModalResponse response) {
      completion(nil, @(response == NSAlertFirstButtonReturn));
    }];
  }];

  [AppDelegate.client registerMethod:@"keybase.1.proveUi.outputInstructions" requestHandler:^(NSString *method, NSArray *params, MPRequestCompletion completion) {
    // TODO: Verify sessionId?
    //sessionId = params[0][@"sessionId"];
    KBRText *instructions = [MTLJSONAdapter modelOfClass:KBRText.class fromJSONDictionary:params[0][@"instructions"] error:nil];
    NSString *proof = params[0][@"proof"];

    [self setInstructions:instructions proofText:proof targetBlock:^{
      completion(nil, @(YES));
    }];
  }];

  YOSelf yself = self;
  self.viewLayout = [YOLayout layoutWithLayoutBlock:^(id<YOLayout> layout, CGSize size) {
    CGFloat y = 40;

    [layout setFrame:CGRectMake(0, y, size.width, 0) view:yself.instructionsView];

    y += [layout sizeToFitVerticalInFrame:CGRectMake(0, y, size.width, 0) view:yself.inputView].size.height;

    return CGSizeMake(size.width, y);
  }];
}

KBProveType KBProveTypeForServiceName(NSString *serviceName) {
  if ([serviceName isEqualTo:@"twitter"]) return KBProveTypeTwitter;
  if ([serviceName isEqualTo:@"github"]) return KBProveTypeGithub;
  if ([serviceName isEqualTo:@"reddit"]) return KBProveTypeReddit;
  if ([serviceName isEqualTo:@"coinbase"]) return KBProveTypeCoinbase;
  if ([serviceName isEqualTo:@"hackernews"]) return KBProveTypeHackernews;
  if ([serviceName isEqualTo:@"dns"]) return KBProveTypeDNS;
  if ([serviceName isEqualTo:@"https"]) return KBProveTypeHTTPS;
  return KBProveTypeUnknown;
}

NSString *KBServiceNameForProveType(KBProveType proveType) {
  switch (proveType) {
    case KBProveTypeUnknown: return nil;
    case KBProveTypeTwitter: return @"twitter";
    case KBProveTypeGithub: return @"github";
    case KBProveTypeReddit: return @"reddit";
    case KBProveTypeCoinbase: return @"coinbase";
    case KBProveTypeHackernews: return @"hackernews";
    case KBProveTypeDNS: return @"dns";
    case KBProveTypeHTTPS: return @"https";
  }
}

NSString *KBImageNameForProveType(KBProveType proveType) {
  switch (proveType) {
    case KBProveTypeTwitter: return @"Social networks-Outline-Twitter-25";
    case KBProveTypeGithub: return @"Social networks-Outline-Github-25";
    case KBProveTypeReddit: return @"Social networks-Outline-Reddit-25";
    default:
      return nil;
  }
}

NSString *KBNameForProveType(KBProveType proveType) {
  switch (proveType) {
    case KBProveTypeUnknown: return nil;
    case KBProveTypeTwitter: return @"Twitter";
    case KBProveTypeGithub: return @"Github";
    case KBProveTypeReddit: return @"Reddit";
    case KBProveTypeCoinbase: return @"Coinbase";
    case KBProveTypeHackernews: return @"HN";
    case KBProveTypeDNS: return @"DNS";
    case KBProveTypeHTTPS: return @"HTTPS";
  }
}

- (void)viewDidAppear:(BOOL)animated {
  [self.window makeFirstResponder:_inputView];
}

- (void)setProveType:(KBProveType)proveType {
  _proveType = proveType;
  [_inputView setProveType:proveType];
}

- (void)setInstructions:(KBRText *)instructions proofText:(NSString *)proofText targetBlock:(KBButtonTargetBlock)targetBlock {
  [_instructionsView setInstructions:instructions proofText:proofText targetBlock:targetBlock];

  // TODO Animate change
  self.inputView.hidden = YES;
  self.instructionsView.hidden = NO;
}

- (void)generateProof {
  NSString *userName = [_inputView.inputField.text gh_strip];

  if ([NSString gh_isBlank:userName]) {
    // TODO Become first responder
    [self setError:KBErrorAlert(@"You need to choose a username.")];
    return;
  }

  NSString *service = KBServiceNameForProveType(self.proveType);
  NSAssert(service, @"No service");

  GHWeakSelf gself = self;
  [self setInProgress:YES sender:_inputView];
  KBRProveRequest *prove = [[KBRProveRequest alloc] initWithClient:AppDelegate.client];
  [self.navigation.titleView setProgressEnabled:YES];
  [prove proveWithService:service username:userName force:NO completion:^(NSError *error) {
    [self setInProgress:NO sender:gself.inputView];
    [self.navigation.titleView setProgressEnabled:NO];
    if (error) {
      [gself setError:error];
      return;
    }

    [KBView setInProgress:NO view:gself];
    [KBAlert promptWithTitle:@"Success!" description:@"Ok that worked." style:NSInformationalAlertStyle buttonTitles:@[@"OK"] view:self completion:^(NSModalResponse response) {
      [self.navigation popViewAnimated:YES];
    }];
  }];
}

@end


@implementation KBProveInputView

- (void)viewInit {
  [super viewInit];
  _inputField = [[KBTextField alloc] init];
  [self addSubview:_inputField];

  _label = [[KBLabel alloc] init];
  [self addSubview:_label];

  _button = [KBButton buttonWithText:@"Connect" style:KBButtonStylePrimary];
  [self addSubview:_button];

  _skipButton = [KBButton buttonWithText:@"No Thanks" style:KBButtonStyleLink];
  _skipButton.targetBlock = ^{
  };
  [self addSubview:_skipButton];

  YOSelf yself = self;
  self.viewLayout = [YOLayout layoutWithLayoutBlock:^(id<YOLayout> layout, CGSize size) {
    CGFloat y = 0;

    y += [layout centerWithSize:CGSizeMake(240, 0) frame:CGRectMake(40, y, size.width - 80, 0) view:yself.label].size.height + 20;

    y += [layout centerWithSize:CGSizeMake(200, 0) frame:CGRectMake(0, y, size.width, 0) view:yself.inputField].size.height + 20;

    y += [layout centerWithSize:CGSizeMake(200, 0) frame:CGRectMake(0, y, size.width, 0) view:yself.button].size.height + 20;
    y += [layout centerWithSize:CGSizeMake(200, 0) frame:CGRectMake(0, y, size.width, 0) view:yself.skipButton].size.height + 20;

    return CGSizeMake(size.width, y);
  }];
}

- (void)setProveType:(KBProveType)proveType {
  _proveType = proveType;
  _inputField.placeholder = nil;
  _label.attributedText = nil;

  switch (proveType) {
    case KBProveTypeTwitter:
      [_label setText:@"Do you want to connect your Twitter account?" font:[KBLookAndFeel textFont] color:[KBLookAndFeel textColor] alignment:NSLeftTextAlignment];
      _inputField.placeholder = @"@username";
      break;
    case KBProveTypeGithub:
      [_label setText:@"Do you want to connect your Github account?" font:[KBLookAndFeel textFont] color:[KBLookAndFeel textColor] alignment:NSLeftTextAlignment];
      _inputField.placeholder = @"username";
      break;
    case KBProveTypeReddit:
      [_label setText:@"Do you want to connect your Reddit account?" font:[KBLookAndFeel textFont] color:[KBLookAndFeel textColor] alignment:NSLeftTextAlignment];
      _inputField.placeholder = @"username";
      break;
    case KBProveTypeCoinbase:
      [_label setText:@"Do you want to connect your Coinbase account?" font:[KBLookAndFeel textFont] color:[KBLookAndFeel textColor] alignment:NSLeftTextAlignment];
      _inputField.placeholder = @"username";
      break;
    case KBProveTypeHackernews:
      [_label setText:@"Do you want to connect your Hackernews account?" font:[KBLookAndFeel textFont] color:[KBLookAndFeel textColor] alignment:NSLeftTextAlignment];
      _inputField.placeholder = @"username";
      break;
    case KBProveTypeDNS:
      [_label setText:@"Do you want to connect your domain name?" font:[KBLookAndFeel textFont] color:[KBLookAndFeel textColor] alignment:NSLeftTextAlignment];
      _inputField.placeholder = @"yoursite.com";
      break;
    case KBProveTypeHTTPS:
      [_label setText:@"Do you want to connect your web site?" font:[KBLookAndFeel textFont] color:[KBLookAndFeel textColor] alignment:NSLeftTextAlignment];
      _inputField.placeholder = @"yoursite.com";
      break;
    case KBProveTypeUnknown:
      break;
  }
  [self setNeedsLayout];
}

@end

@implementation KBProveInstructionsView

- (void)viewInit {
  [super viewInit];
  _instructionsLabel = [[KBLabel alloc] init];
  [self addSubview:_instructionsLabel];

  _proofLabel = [[KBLabel alloc] init];
  _proofLabel.selectable = YES;

  _scrollView = [[NSScrollView alloc] init];
  [_scrollView setHasVerticalScroller:YES];
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

  YOSelf yself = self;
  self.viewLayout = [YOLayout layoutWithLayoutBlock:^(id<YOLayout> layout, CGSize size) {
    CGFloat y = 10;

    y += [layout sizeToFitVerticalInFrame:CGRectMake(40, y, size.width - 80, 0) view:yself.instructionsLabel].size.height + 10;

    [layout sizeToFitVerticalInFrame:CGRectMake(0, 0, size.width - 80, CGFLOAT_MAX) view:yself.proofLabel];
    y += [layout setFrame:CGRectMake(40, y, size.width - 80, size.height - y - 170) view:yself.scrollView].size.height + 10;

    y += [layout centerWithSize:CGSizeMake(200, 0) frame:CGRectMake(40, y, size.width - 80, 0) view:yself.clipboardCopyButton].size.height + 30;

    y += [layout centerWithSize:CGSizeMake(200, 0) frame:CGRectMake(40, y, size.width - 80, 0) view:yself.button].size.height;

    return CGSizeMake(size.width, y);
  }];
}

- (void)setInstructions:(KBRText *)instructions proofText:(NSString *)proofText targetBlock:(KBButtonTargetBlock)targetBlock {
  // TODO Check instructions.markup
  self.instructionsLabel.attributedText = [KBLabel parseMarkup:instructions.data font:[KBLookAndFeel textFont] color:[KBLookAndFeel textColor]];

  _proofText = proofText;
  [self.proofLabel setText:proofText font:[KBLookAndFeel textFont] color:[KBLookAndFeel textColor] alignment:NSLeftTextAlignment];
  [self setNeedsLayout];
  [self sizeToFit];

  GHWeakSelf gself = self;
  self.button.targetBlock = ^{
    [KBView setInProgress:YES view:gself.superview];
    targetBlock();
  };
}

@end