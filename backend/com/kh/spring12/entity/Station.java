package com.kh.spring12.entity;

import java.time.LocalDateTime;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.SequenceGenerator;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "station")
@SequenceGenerator(name = "station_seq", allocationSize = 1, initialValue = 1)
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Station {
    @Id
    @GeneratedValue(generator = "station_seq")
    private Long stationNo;
    @Column(nullable = false, unique = true, length = 90)
    private String stationName;
    @Column(nullable = false, length = 90)
    private String subwayLine;
    @Column
    private String location;
    // 기존 행과 좌표 없는 신규 역을 위해 null을 허용한다.
    @Column
    private Double latitude;
    @Column
    private Double longitude;
    @CreationTimestamp
    private LocalDateTime ctime;
    @UpdateTimestamp
    private LocalDateTime utime;
}
