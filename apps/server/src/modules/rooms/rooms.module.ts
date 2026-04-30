import { Module } from '@nestjs/common'
import { WordsModule } from '../words/words.module'
import { RoomsService } from './rooms.service'

@Module({
  imports: [WordsModule],
  providers: [RoomsService],
  exports: [RoomsService],
})
export class RoomsModule {}
