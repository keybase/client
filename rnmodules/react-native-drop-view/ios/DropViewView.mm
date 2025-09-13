#import "DropViewView.h"
#import "DropView.h"
#import <react/renderer/components/RNDropViewViewSpec/ComponentDescriptors.h>
#import <react/renderer/components/RNDropViewViewSpec/EventEmitters.h>
#import <react/renderer/components/RNDropViewViewSpec/Props.h>
#import <react/renderer/components/RNDropViewViewSpec/RCTComponentViewHelpers.h>

#import "RCTFabricComponentsPlugins.h"

using namespace facebook::react;

@interface DropViewView () <RCTDropViewViewViewProtocol>
@end

@implementation DropViewView {
  DropView *_dropView;
}

+ (ComponentDescriptorProvider)componentDescriptorProvider
{
    return concreteComponentDescriptorProvider<DropViewViewComponentDescriptor>();
}

- (instancetype)init
{
  if (self = [super init]) {
    static const auto defaultProps = std::make_shared<const DropViewViewProps>();
    _props = defaultProps;
    _dropView = [[DropView alloc] init];
    self.contentView = _dropView;
  }
  return self;
}

- (void)updateProps:(Props::Shared const &)props oldProps:(Props::Shared const &)oldProps
{
    [super updateProps:props oldProps:oldProps];
}

extern "C" Class<RCTComponentViewProtocol> DropViewViewCls(void)
{
    return DropViewView.class;
}

+ (Class) componentViewClass{
    return [DropViewView class];
}

@end
