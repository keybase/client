//
//  KBProver.m
//  Keybase
//
//  Created by Gabriel on 6/25/15.
//  Copyright (c) 2015 Keybase. All rights reserved.
//

#import "KBProver.h"

#import "KBProofView.h"
#import "KBProveView.h"
#import "KBProofRepairView.h"
#import "KBWorkspace.h"

@interface KBProver ()
@property KBRPClient *client;
@end

@implementation KBProver

- (void)createProofWithServiceName:(NSString *)serviceName client:(KBRPClient *)client sender:(id)sender completion:(KBCompletion)completion {
  self.client = client;
  [KBProveView createProofWithServiceName:serviceName client:self.client sender:sender completion:^(id sender, BOOL success) {
    completion(nil);
  }];
}

- (void)handleProofAction:(KBProofAction)proofAction proofResult:(KBProofResult *)proofResult client:(KBRPClient *)client sender:(id)sender completion:(KBCompletion)completion {
  switch (proofAction) {
    case KBProofActionRetry: [self _retryProof:proofResult sender:sender completion:completion]; break;
    case KBProofActionReplace: [self _replaceProof:proofResult sender:sender completion:completion]; break;
    case KBProofActionRevoke: [self _revokeProof:proofResult sender:sender completion:completion]; break;
    case KBProofActionOpen: [self _openProof:proofResult sender:sender completion:completion]; break;
    case KBProofActionRepair: [self _repairProof:proofResult sender:sender completion:completion]; break;
    case KBProofActionView: [self _viewProof:proofResult sender:sender completion:completion]; break;
    case KBProofActionCancel: break;
  }
}

- (void)_viewProof:(KBProofResult *)proofResult sender:(id)sender completion:(KBCompletion)completion {
  KBProofView *proofView = [[KBProofView alloc] init];
  proofView.proofResult = proofResult;
  proofView.client = self.client;
  GHWeakSelf gself = self;
  proofView.completion = ^(id proofSender, KBProofAction action) {
    [gself handleProofAction:action proofResult:proofResult client:self.client sender:sender completion:completion];
    [[proofSender window] close];
  };
  NSString *title = KBNameForServiceName(proofResult.proof.key);
  [[sender window] kb_addChildWindowForView:proofView rect:CGRectMake(0, 0, 500, 200) position:KBWindowPositionCenter title:title fixed:NO makeKey:YES];
}

- (void)_repairProof:(KBProofResult *)proofResult sender:(id)sender completion:(KBCompletion)completion {
  KBProofRepairView *proofRepairView = [[KBProofRepairView alloc] init];
  proofRepairView.proofResult = proofResult;
  proofRepairView.client = self.client;
  GHWeakSelf gself = self;
  proofRepairView.completion = ^(id sender, KBProofAction action) {
    [gself handleProofAction:action proofResult:proofResult client:self.client sender:sender completion:completion];
    [[sender window] close];
  };
  [[sender window] kb_addChildWindowForView:proofRepairView rect:CGRectMake(0, 0, 500, 200) position:KBWindowPositionCenter title:@"Proof Failed" fixed:NO makeKey:YES];
}

- (void)_retryProof:(KBProofResult *)proofResult sender:(id)sender completion:(KBCompletion)completion {
  NSString *sigID = proofResult.proof.sigID;
  KBRProveRequest *request = [[KBRProveRequest alloc] initWithClient:self.client];
  [KBActivity setProgressEnabled:YES sender:self];
  [request checkProofWithSigID:sigID completion:^(NSError *error, KBRCheckProofStatus *checkProofStatus) {
    [KBActivity setProgressEnabled:NO sender:self];
    if ([KBActivity setError:error sender:self]) return;

    if (checkProofStatus.found) {
      completion(nil);
    } else {
      completion(KBMakeError(checkProofStatus.status, @"Oops, we couldn't find the proof."));
    }
  }];
}

- (void)_replaceProof:(KBProofResult *)proofResult sender:(id)sender completion:(KBCompletion)completion {
  [KBProveView replaceProof:proofResult client:self.client sender:sender completion:^(id sender, BOOL success) {
    completion(nil);
  }];
}

- (void)_openProof:(KBProofResult *)proofResult sender:(id)sender completion:(KBCompletion)completion {
  [KBWorkspace openURLString:proofResult.result.hint.humanUrl prompt:NO sender:self];
}

- (void)_revokeProof:(KBProofResult *)proofResult sender:(id)sender completion:(KBCompletion)completion {
  [KBAlert yesNoWithTitle:@"Quit" description:@"Are you sure you want to revoke this proof?" yes:@"Revoke" view:sender completion:^(BOOL yes) {
    if (yes) [self __revokeProof:proofResult sender:sender completion:completion];
  }];
}

- (void)__revokeProof:(KBProofResult *)proofResult sender:(id)sender completion:(KBCompletion)completion {
  NSAssert(proofResult.proof.sigID, @"No proof sigId");
  [KBActivity setProgressEnabled:YES sender:self];
  KBRRevokeRequest *request = [[KBRRevokeRequest alloc] initWithClient:self.client];
  // TODO: Protocol changed
  /*
  [request revokeSigsWithSigIDs:@[proofResult.proof.sigID] completion:^(NSError *error) {
    [KBActivity setProgressEnabled:NO sender:self];
    completion(error);
  }];
   */
}

@end
