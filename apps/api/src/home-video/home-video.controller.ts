import { Controller, Get } from '@nestjs/common';
import { HomeVideoService } from './home-video.service';

@Controller('home-video')
export class HomeVideoController {
  constructor(private readonly homeVideo: HomeVideoService) {}

  @Get()
  async active() {
    const video = await this.homeVideo.getActive();
    return { video };
  }
}
