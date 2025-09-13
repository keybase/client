#import "DropView.h"
#import <KBCommon/KBCommon-Swift.h>

@interface DropView ()
  @property(nonatomic, strong) ItemProviderHelper *iph;
@end

@implementation DropView

- (id)init {
  if (self = [super init]) {
    UIDropInteraction *udi = [[UIDropInteraction alloc] initWithDelegate:self];
    udi.allowsSimultaneousDropSessions = YES;
    [self addInteraction:udi];
  }
  return self;
}

- (id)initWithCoder:(NSCoder *)coder {
  if (self = [super initWithCoder:coder]) {
    UIDropInteraction *udi = [[UIDropInteraction alloc] initWithDelegate:self];
    udi.allowsSimultaneousDropSessions = YES;
    [self addInteraction:udi];
  }
  return self;
}

- (id)initWithFrame:(CGRect)frame {
  if (self = [super initWithFrame:frame]) {
    UIDropInteraction *udi = [[UIDropInteraction alloc] initWithDelegate:self];
    udi.allowsSimultaneousDropSessions = YES;
    [self addInteraction:udi];
  }
  return self;
}

- (BOOL)dropInteraction:(UIDropInteraction *)interaction
       canHandleSession:(id<UIDropSession>)session {
  return YES;
}

- (UIDropProposal *)dropInteraction:(UIDropInteraction *)interaction
                   sessionDidUpdate:(id<UIDropSession>)session {
  return [[UIDropProposal alloc] initWithDropOperation:UIDropOperationCopy];
}

- (void)dropInteraction:(UIDropInteraction *)interaction
            performDrop:(id<UIDropSession>)session {
  NSMutableArray *items = [NSMutableArray arrayWithCapacity:session.items.count];
  [session.items enumerateObjectsUsingBlock:^(id obj, NSUInteger idx, BOOL *stop) {
        UIDragItem *i = obj;
        [items addObject:i.itemProvider];
      }];
  __weak __typeof(self) weakSelf = self;
  self.iph = [[ItemProviderHelper alloc] initForShare:false withItems:@[items]
      completionHandler:^{
        if (weakSelf.onDropped != nil) {
            NSArray * manifest = weakSelf.iph.manifest;
            NSMutableArray *cleanItems = [NSMutableArray array];
            for (NSDictionary* item in manifest) {
                NSString * path = item[@"originalPath"];
                NSString * content = item[@"content"];
                if ((path && ![path isEqual:[NSNull null]] && (path.length > 0)) ||
                    (content && ![content isEqual:[NSNull null]] && (content.length > 0))) {
                    [cleanItems addObject:item];
                }
            }
            weakSelf.onDropped(@{@"items": cleanItems});
        }
        weakSelf.iph = nil;
      }];
  [self.iph startProcessing];
}

@end


