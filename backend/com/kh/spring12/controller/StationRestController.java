package com.kh.spring12.controller;

import java.util.List;

import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.kh.spring12.entity.Station;
import com.kh.spring12.error.TargetNotfoundException;
import com.kh.spring12.repo.StationRepository;
import com.kh.spring12.service.StationSearchService;

import lombok.RequiredArgsConstructor;

@CrossOrigin
@RestController
@RequestMapping("/api/v1/station")
@RequiredArgsConstructor
public class StationRestController {
    private final StationRepository stationRepository;
    private final StationSearchService stationSearchService;

    @PostMapping(value = "/", produces = "application/json")
    public Station create(@RequestBody Station station) {
        validate(station);
        station.setStationNo(null);
        station.setCtime(null);
        station.setUtime(null);
        return stationRepository.save(station);
    }

    @GetMapping(value = "/", produces = "application/json")
    public List<Station> list() {
        return stationRepository.findAll(Sort.by("stationNo").ascending());
    }

    @GetMapping(value = "/search", produces = "application/json")
    public List<Station> search(@RequestParam(name = "keyword", defaultValue = "") String keyword) {
        return stationSearchService.search(keyword);
    }

    @GetMapping(value = "/{stationNo:[0-9]+}", produces = "application/json")
    public Station detail(@PathVariable("stationNo") long stationNo) {
        return stationRepository.findById(stationNo)
                .orElseThrow(() -> new TargetNotfoundException());
    }

    @PutMapping(value = "/{stationNo:[0-9]+}", produces = "application/json")
    public Station edit(@PathVariable("stationNo") long stationNo, @RequestBody Station station) {
        validate(station);
        Station target = stationRepository.findById(stationNo)
                .orElseThrow(() -> new TargetNotfoundException());
        target.setStationName(station.getStationName());
        target.setSubwayLine(station.getSubwayLine());
        target.setLocation(station.getLocation());
        target.setLatitude(station.getLatitude());
        target.setLongitude(station.getLongitude());
        return stationRepository.save(target);
    }

    @DeleteMapping(value = "/{stationNo:[0-9]+}")
    public void delete(@PathVariable("stationNo") long stationNo) {
        Station target = stationRepository.findById(stationNo)
                .orElseThrow(() -> new TargetNotfoundException());
        stationRepository.delete(target);
    }

    private static void validate(Station station) {
        if (station.getStationName() == null || station.getStationName().isBlank()
                || station.getSubwayLine() == null || station.getSubwayLine().isBlank()
                || station.getLocation() == null || station.getLocation().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "역 이름, 노선, 위치는 필수입니다.");
        }
        station.setStationName(station.getStationName().trim());
        station.setSubwayLine(station.getSubwayLine().trim());
        station.setLocation(station.getLocation().trim());
        if (station.getStationName().length() > 90 || station.getSubwayLine().length() > 90
                || station.getLocation().length() > 255) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "입력값이 허용 길이를 초과했습니다.");
        }
        Double latitude = station.getLatitude();
        Double longitude = station.getLongitude();
        if (latitude == null && longitude == null) return;
        if (latitude == null || longitude == null || !Double.isFinite(latitude)
                || !Double.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "올바른 위도와 경도를 함께 입력해주세요.");
        }
    }
}
