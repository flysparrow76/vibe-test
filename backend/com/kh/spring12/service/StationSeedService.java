package com.kh.spring12.service;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.kh.spring12.entity.Station;
import com.kh.spring12.repo.StationRepository;
import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class StationSeedService {
    private final StationRepository stationRepository;

    @Transactional(rollbackFor = Exception.class)
    public int importStations() throws IOException {
        Map<String, Station> existing = new LinkedHashMap<>();
        for (Station station : stationRepository.findAll()) {
            String key = nameKey(station.getStationName());
            if (existing.putIfAbsent(key, station) != null) {
                throw new IllegalStateException("동일 역으로 보이는 데이터가 중복되어 있습니다: "
                        + station.getStationName() + ". 기존 데이터를 확인한 후 다시 실행해주세요.");
            }
        }
        // 전체 TSV를 먼저 검증한다. 실패하면 트랜잭션 전체가 취소된다.
        List<Station> seeds = readSeeds();
        int inserted = 0;
        for (Station seed : seeds) {
            Station target = existing.get(nameKey(seed.getStationName()));
            if (target == null) {
                stationRepository.save(seed);
                existing.put(nameKey(seed.getStationName()), seed);
                inserted++;
                continue;
            }
            // 기존 역명·주소·입력된 좌표는 유지하고 누락된 좌표와 노선만 보충한다.
            if (target.getLatitude() == null || target.getLongitude() == null) {
                target.setLatitude(seed.getLatitude());
                target.setLongitude(seed.getLongitude());
            }
            Set<String> lines = new LinkedHashSet<>();
            if (target.getSubwayLine() != null) {
                for (String line : target.getSubwayLine().split(",")) {
                    if (!line.isBlank()) lines.add(line.trim());
                }
            }
            for (String line : seed.getSubwayLine().split(",")) lines.add(line.trim());
            target.setSubwayLine(String.join(", ", lines));
        }
        stationRepository.flush();
        return inserted;
    }

    private static List<Station> readSeeds() throws IOException {
        List<Station> seeds = new ArrayList<>();
        Set<String> names = new LinkedHashSet<>();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(
                new ClassPathResource("station-seed.tsv").getInputStream(), StandardCharsets.UTF_8))) {
            if (!"stationName\tsubwayLine\tlocation\tlatitude\tlongitude".equals(reader.readLine())) {
                throw new IOException("station-seed.tsv 헤더가 올바르지 않습니다.");
            }
            String line;
            while ((line = reader.readLine()) != null) {
                if (line.isBlank()) continue;
                String[] values = line.split("\t", -1);
                if (values.length != 5 || values[0].isBlank() || values[1].isBlank()
                        || !names.add(nameKey(values[0]))) {
                    throw new IOException("station-seed.tsv 행 형식 또는 역명 중복을 확인해주세요.");
                }
                double latitude = Double.parseDouble(values[3]);
                double longitude = Double.parseDouble(values[4]);
                if (!Double.isFinite(latitude) || !Double.isFinite(longitude)
                        || latitude < 33 || latitude > 39 || longitude < 124 || longitude > 132) {
                    throw new IOException("station-seed.tsv 좌표가 올바르지 않습니다: " + values[0]);
                }
                seeds.add(Station.builder().stationName(values[0]).subwayLine(values[1])
                        .location(values[2].isBlank() ? "주소 미등록" : values[2])
                        .latitude(latitude).longitude(longitude).build());
            }
        }
        if (seeds.size() != 404) throw new IOException("station-seed.tsv의 404개 역 데이터를 확인해주세요.");
        return seeds;
    }

    private static String nameKey(String name) {
        String key = Normalizer.normalize(name, Normalizer.Form.NFKC).trim()
                .replaceAll("\\([^)]*\\)", "");
        if (key.endsWith("역")) key = key.substring(0, key.length() - 1);
        return switch (key) {
            case "이수", "총신대입구" -> "총신대입구";
            case "뚝섬유원지" -> "자양";
            case "지제" -> "평택지제";
            default -> key;
        };
    }
}
