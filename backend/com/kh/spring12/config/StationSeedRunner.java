package com.kh.spring12.config;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import com.kh.spring12.service.StationSeedService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = "station.seed.enabled", havingValue = "true")
public class StationSeedRunner implements ApplicationRunner {
    private final StationSeedService stationSeedService;

    @Override
    public void run(ApplicationArguments args) throws Exception {
        int inserted = stationSeedService.importStations();
        log.info("지하철 1~9호선 데이터 적용 완료: 신규 {}개. station.seed.enabled를 false로 변경하세요.", inserted);
    }
}
