package com.kh.spring12.controller;

import java.util.List;

import org.springframework.data.domain.Sort;
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
        return stationRepository.save(station);
    }

    @GetMapping(value = "/", produces = "application/json")
    public List<Station> list() {
        return stationRepository.findAll(Sort.by("stationNo").ascending());
    }

    @GetMapping(value = "/search", produces = "application/json")
    public List<Station> search(@RequestParam(defaultValue = "") String keyword) {
        return stationSearchService.search(keyword);
    }

    @GetMapping(value = "/{stationNo:[0-9]+}", produces = "application/json")
    public Station detail(@PathVariable long stationNo) {
        return stationRepository.findById(stationNo)
                .orElseThrow(() -> new TargetNotfoundException());
    }

    @PutMapping(value = "/{stationNo:[0-9]+}", produces = "application/json")
    public Station edit(@PathVariable long stationNo, @RequestBody Station station) {
        Station target = stationRepository.findById(stationNo)
                .orElseThrow(() -> new TargetNotfoundException());
        target.setStationName(station.getStationName());
        target.setSubwayLine(station.getSubwayLine());
        target.setLocation(station.getLocation());
        return stationRepository.save(target);
    }

    @DeleteMapping(value = "/{stationNo:[0-9]+}")
    public void delete(@PathVariable long stationNo) {
        Station target = stationRepository.findById(stationNo)
                .orElseThrow(() -> new TargetNotfoundException());
        stationRepository.delete(target);
    }
}
