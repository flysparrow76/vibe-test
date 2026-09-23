package com.kh.spring12.service;

import java.text.Normalizer;
import java.util.List;
import java.util.Locale;

import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.kh.spring12.entity.Station;
import com.kh.spring12.repo.StationRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class StationSearchService {
    private final StationRepository stationRepository;

    public List<Station> search(String keyword) {
        String query = normalize(keyword).strip();
        if (query.isEmpty()) return List.of();

        // DB 종류에 관계없이 저장값도 NFKC 비교하기 위해 서버에서 처리한다.
        // 소규모·페이징 없는 목록을 전제로 하며, 저장된 원본 값은 변경하지 않는다.
        List<Station> stations = stationRepository.findAll(Sort.by("stationNo").ascending());
        List<Station> matches = stations.stream()
                .filter(station -> matches(station, query, false))
                .toList();
        if (!matches.isEmpty()) return matches;

        // 일반 검색 결과가 없고 검색어가 한글 음절로만 구성된 경우에만 유사 검색한다.
        if (!query.chars().allMatch(StationSearchService::isHangul)) return List.of();
        return stations.stream()
                .filter(station -> matches(station, query, true))
                .toList();
    }

    private static boolean matches(Station station, String query, boolean fuzzy) {
        return matchesField(station.getStationName(), query, fuzzy)
                || matchesField(station.getSubwayLine(), query, fuzzy)
                || matchesField(station.getLocation(), query, fuzzy);
    }

    private static boolean matchesField(String value, String query, boolean fuzzy) {
        String normalized = normalize(value);
        return fuzzy ? similarHangul(normalized, query) : normalized.contains(query);
    }

    private static String normalize(String value) {
        return value == null ? "" : Normalizer.normalize(value, Normalizer.Form.NFKC)
                .toLowerCase(Locale.ROOT);
    }

    private static boolean isHangul(int value) {
        return value >= 0xAC00 && value <= 0xD7A3;
    }

    private static boolean similarHangul(String value, String query) {
        // 같은 길이의 구간에서 초성·중성·종성 중 최대 한 자리 차이만 허용한다.
        // 예: 엯(ㅇ/ㅕ/ㄳ)과 역(ㅇ/ㅕ/ㄱ)은 종성 한 자리 차이다.
        // 임의의 삽입·삭제나 초성만 입력하는 검색은 지원하지 않는다.
        for (int start = 0; start <= value.length() - query.length(); start++) {
            int difference = 0;
            for (int index = 0; index < query.length(); index++) {
                char actual = value.charAt(start + index);
                if (!isHangul(actual)) {
                    difference = 2;
                    break;
                }
                int left = actual - 0xAC00;
                int right = query.charAt(index) - 0xAC00;
                if (left / 588 != right / 588) difference++;
                if (left % 588 / 28 != right % 588 / 28) difference++;
                if (left % 28 != right % 28) difference++;
                if (difference > 1) break;
            }
            if (difference <= 1) return true;
        }
        return false;
    }
}
