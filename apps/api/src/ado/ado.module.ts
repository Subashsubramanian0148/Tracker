import { Global, Module } from '@nestjs/common';
import { AdoClient } from './ado.client';

@Global()
@Module({
  providers: [AdoClient],
  exports: [AdoClient],
})
export class AdoModule {}
