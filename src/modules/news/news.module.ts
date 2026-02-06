import { Module } from "@nestjs/common";
import { NewsController } from "./news.controller";
import { NewsService } from "./news.service";
import { NewsRepository } from "./news.repository";
import { NewsSseService } from "./news-sse.service";

@Module({
  controllers: [NewsController],
  providers: [NewsService, NewsRepository, NewsSseService],
  exports: [NewsService],
})
export class NewsModule {}
