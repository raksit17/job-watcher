import { Module } from '@nestjs/common';
import { NetworkInspectorService } from './network-inspector/network-inspector.service';

@Module({
  providers: [NetworkInspectorService]
})
export class NetworkModule {}
