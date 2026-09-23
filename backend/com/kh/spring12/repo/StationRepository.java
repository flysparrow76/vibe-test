package com.kh.spring12.repo;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;
import com.kh.spring12.entity.Station;

public interface StationRepository extends JpaRepository<Station, Long> {
    List<Station> findByLocationContainingOrderByStationNoAsc(String keyword);

    @Transactional
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("""
        update Station s
        set s.stationName = :#{#station.stationName},
            s.subwayLine = :#{#station.subwayLine},
            s.location = :#{#station.location},
            s.utime = CURRENT_TIMESTAMP
        where s.stationNo = :#{#station.stationNo}
        """)
    int updateStation(@Param("station") Station station);
}
